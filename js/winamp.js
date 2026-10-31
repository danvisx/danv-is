import { h, bindOpen, store } from './dom.js';
import { icons, glyph } from './icons.js';
import { loadTracks } from './data.js';

// Plays the audio files listed in data/tracks.json, which `npm run tracks`
// builds from the music/ folder.

class Player {
  constructor(ev) {
    this.ev = ev;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('playing', () => this.ev.state(true));
    this.audio.addEventListener('pause', () => this.ev.state(false));
    this.audio.addEventListener('ended', () => this.ev.ended());
    this.audio.addEventListener('loadedmetadata', () => this.ev.duration(this.audio.duration));
    this.audio.addEventListener('error', () => this.ev.error('could not load audio file'));
  }

  load(url) {
    // Only same-origin audio can feed an analyser; cross-origin audio
    // without CORS would be silenced by Web Audio.
    this.sameOrigin = new URL(url, location.href).origin === location.origin;
    this.audio.src = url;
    return this.audio.play().catch((err) => this.refused(err));
  }

  refused(err) {
    if (err.name === 'AbortError') return;
    this.ev.state(false);
    if (err.name === 'NotAllowedError') this.ev.blocked();
  }

  // The visualizer taps the audio through Web Audio. Its context has to be
  // started inside a click, and the element is only routed into it once it is
  // actually running: audio sent into a suspended context plays in silence,
  // which is what strict browsers and embedded previews would otherwise do.
  prime() {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
    }
  }

  analyser() {
    if (!this.sameOrigin || this.ctx?.state !== 'running') return null;
    if (!this.an) {
      try {
        this.an = this.ctx.createAnalyser();
        this.an.fftSize = 64;
        this.ctx.createMediaElementSource(this.audio).connect(this.an);
        this.an.connect(this.ctx.destination);
        // Once routed, the sound depends on the context, so keep it running.
        this.ctx.addEventListener('statechange', () => {
          if (this.ctx.state === 'suspended' && !this.audio.paused) this.ctx.resume().catch(() => {});
        });
      } catch {
        this.sameOrigin = false;
        return null;
      }
    }
    return this.an;
  }

  play() { this.audio.play().catch((err) => this.refused(err)); }
  pause() { this.audio.pause(); }
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
  seek(sec) { this.audio.currentTime = sec; }
  volume(v) { this.audio.volume = v / 100; }
  time() { return { pos: this.audio.currentTime, dur: this.audio.duration || 0 }; }
  destroy() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.ctx?.close();
  }
}

const clock = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const short = (s) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');

function fileName(url) {
  const last = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || url);
  return last.replace(/\.[a-z0-9]+$/i, '');
}

const formatOf = (url) => (url.match(/\.([a-z0-9]{2,4})(?:[?#]|$)/i)?.[1] ?? 'mp3').toUpperCase();

// opts.play: a track url to start, either in a new Winamp or the running one.
export function openWinamp(wm, opts = {}) {
  const running = wm.get('winamp');
  if (running) {
    wm.focus(running);
    if (opts.play) running.playUrl(opts.play);
    return;
  }

  const S = {
    tracks: [],
    index: -1,
    selected: 0,
    playing: false,
    wantPlay: false,
    remaining: false,
    shuffle: store('wa.shuffle') === '1',
    repeat: store('wa.repeat') !== '0',
    volume: Number(store('wa.volume') ?? 70),
    showPl: store('wa.pl') !== '0',
    errors: 0,
    seeking: false,
    message: '',
  };

  const btn = (cls, label, g, fn, text) =>
    h('button', { class: `wa-btn ${cls}`, title: label, 'aria-label': label, onclick: fn }, g && glyph(g, 1), text);

  // ── Main window ─────────────────────────────────────────────────────────
  const stateIcon = h('span', { class: 'wa-state' });
  const timeEl = h('button', { class: 'wa-time', title: 'Toggle elapsed / remaining', onclick: () => { S.remaining = !S.remaining; tick(true); } });
  const vis = h('canvas', { class: 'wa-vis', width: '76', height: '16', title: 'Visualizer' });
  const marquee = h('div', { class: 'wa-marquee' }, h('span'));
  const format = h('span', { class: 'wa-lcd-sm' }, '--');
  const mono = h('span', { class: 'wa-flag' }, 'mono');
  const stereo = h('span', { class: 'wa-flag' }, 'stereo');
  const volume = h('input', {
    type: 'range', class: 'wa-range wa-volume', min: '0', max: '100', value: String(S.volume), 'aria-label': 'Volume',
    oninput: (e) => setVolume(+e.target.value),
  });
  const plBtn = btn('wa-toggle', 'Toggle playlist', null, () => { S.showPl = !S.showPl; store('wa.pl', S.showPl ? '1' : '0'); layout(); }, 'PL');
  const seek = h('input', {
    type: 'range', class: 'wa-range wa-seek', min: '0', max: '1000', value: '0', 'aria-label': 'Seek',
    oninput: () => { S.seeking = true; tick(true); },
    onchange: (e) => {
      S.seeking = false;
      const { dur } = player.time();
      if (dur) player.seek((e.target.value / 1000) * dur);
    },
  });
  const shuffleBtn = btn('wa-toggle wa-wide', 'Shuffle', null, () => { S.shuffle = !S.shuffle; store('wa.shuffle', S.shuffle ? '1' : '0'); paintToggles(); }, 'SHUFFLE');
  const repeatBtn = btn('wa-toggle', 'Repeat', 'refresh', () => { S.repeat = !S.repeat; store('wa.repeat', S.repeat ? '1' : '0'); paintToggles(); });

  const titlebar = (label, extra) =>
    h('div', { class: 'wa-titlebar', 'data-drag': '' },
      h('span', { class: 'wa-stripes' }), h('b', {}, label), h('span', { class: 'wa-stripes' }), extra);

  const main = h('div', { class: 'wa-main' },
    titlebar('WINAMP', h('span', { class: 'wa-tbtns' },
      btn('wa-tbtn', 'Minimize', null, () => win.minimize(), '_'),
      btn('wa-tbtn', 'Close', null, () => win.close(), 'x'))),
    h('div', { class: 'wa-top' },
      h('div', { class: 'wa-lcd' }, h('div', { class: 'wa-lcd-row' }, stateIcon, timeEl), vis),
      h('div', { class: 'wa-right' },
        marquee,
        h('div', { class: 'wa-badges' }, format, h('span', {}, 'fmt'), h('span', { class: 'wa-lcd-sm' }, '44'), h('span', {}, 'kHz'), h('span', { class: 'grow' }), mono, stereo),
        h('div', { class: 'wa-sliders' }, volume, plBtn),
      ),
    ),
    seek,
    h('div', { class: 'wa-controls' },
      h('div', { class: 'wa-transport' },
        btn('', 'Previous (Z)', 'prev', () => step(-1)),
        btn('', 'Play (X)', 'play', play),
        btn('', 'Pause (C)', 'pause', pause),
        btn('', 'Stop (V)', 'stop', stop),
        btn('', 'Next (B)', 'next', () => step(1)),
      ),
      shuffleBtn,
      repeatBtn,
      h('img', { class: 'wa-logo', src: icons.winamp, alt: '' }),
    ),
  );

  // ── Playlist editor ─────────────────────────────────────────────────────
  const list = h('ol', { class: 'wa-list', role: 'listbox', 'aria-label': 'Playlist' });
  const plInfo = h('span');
  const playlist = h('div', { class: 'wa-sub wa-pl' },
    titlebar('WINAMP PLAYLIST', h('span', { class: 'wa-tbtns' }, btn('wa-tbtn', 'Close playlist', null, () => { S.showPl = false; layout(); }, 'x'))),
    list,
    h('div', { class: 'wa-plfoot' }, plInfo, h('span', { class: 'wa-lcd-sm' }, 'music/')),
  );

  const root = h('div', { class: 'wa', tabindex: '-1' }, main, playlist);
  const win = wm.open({ id: 'winamp', title: 'Winamp', icon: icons.winamp, body: root, frameless: true, onClose: shutdown });
  // Opening a track that is already playing starts it over.
  win.playUrl = (url) => {
    const i = S.tracks.findIndex((t) => t.url === url);
    if (i >= 0) playIndex(i);
  };

  const player = new Player({
    state: (playing) => {
      S.playing = playing;
      if (playing) {
        S.errors = 0;
        S.message = '';
      }
      paintState();
    },
    ended: () => onEnded(),
    duration: (d) => {
      const t = S.tracks[S.index];
      if (t && d > 0 && Number.isFinite(d)) {
        t.duration = d;
        paintTitle();
        paintList();
      }
    },
    error: (msg) => onError(msg),
    blocked: () => {
      S.wantPlay = false;
      S.message = 'the browser blocked playback - press play';
      paintAll();
    },
  });

  // ── Playback ────────────────────────────────────────────────────────────
  function playIndex(i) {
    const t = S.tracks[i];
    if (!t) return;
    player.prime();
    S.index = i;
    S.selected = i;
    S.wantPlay = true;
    S.playing = false;
    S.message = '';
    paintAll();
    player.load(t.url);
    player.volume(S.volume);
  }

  function play() {
    if (S.index < 0 || S.selected !== S.index) return playIndex(S.selected);
    S.wantPlay = true;
    S.message = '';
    player.prime();
    player.play();
  }

  function pause() {
    if (S.playing) {
      S.wantPlay = false;
      player.pause();
    } else if (S.index >= 0) play();
  }

  function stop() {
    S.wantPlay = false;
    player.stop();
    S.playing = false;
    paintState();
  }

  function pickNext(dir) {
    const n = S.tracks.length;
    if (S.shuffle && n > 1) {
      let j;
      do j = Math.floor(Math.random() * n); while (j === S.index);
      return j;
    }
    const j = (S.index < 0 ? S.selected : S.index) + dir;
    if (j >= n) return S.repeat ? 0 : -1;
    if (j < 0) return S.repeat ? n - 1 : 0;
    return j;
  }

  function step(dir) {
    const j = pickNext(dir);
    if (j >= 0) playIndex(j);
  }

  function onEnded() {
    const j = pickNext(1);
    if (j >= 0) playIndex(j);
    else stop();
  }

  function onError(msg) {
    S.playing = false;
    S.message = msg;
    paintAll();
    // Skip unplayable tracks, like Winamp does, unless everything is broken.
    if (S.wantPlay && ++S.errors < S.tracks.length) {
      const at = S.index;
      setTimeout(() => S.index === at && S.wantPlay && step(1), 2000);
    }
  }

  function setVolume(v) {
    S.volume = v;
    store('wa.volume', String(v));
    player.volume(v);
    volume.style.setProperty('--fill', `${v}%`);
  }

  // ── Painting ────────────────────────────────────────────────────────────
  const titleOf = (t) => t.title || fileName(t.url);

  function paintState() {
    stateIcon.replaceChildren(glyph(S.playing ? 'play' : S.index >= 0 && S.wantPlay ? 'pause' : 'stop', 1));
    stateIcon.classList.toggle('on', S.playing);
    paintTitle();
  }

  function paintTitle() {
    const t = S.tracks[S.index] ?? S.tracks[S.selected];
    const i = S.index >= 0 ? S.index : S.selected;
    let text = t ? `${i + 1}. ${titleOf(t)}${t.duration ? ` (${short(t.duration)})` : ''}` : 'Winamp 2.95 · pixel edition';
    if (S.message) text = `${text}  *** ${S.message}`;
    const span = marquee.firstChild;
    if (span.dataset.text !== text) {
      span.dataset.text = text;
      span.textContent = `${text}  ***  ${text}  ***  `;
      span.style.setProperty('--chars', String(text.length + 7));
    }
    format.textContent = t ? formatOf(t.url) : '--';
    stereo.classList.toggle('on', S.playing);
    win.setTitle(t && S.index >= 0 ? `${i + 1}. ${titleOf(t)} - Winamp` : 'Winamp');
  }

  function paintList() {
    const total = S.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const known = S.tracks.every((t) => t.duration);
    plInfo.textContent = `${S.tracks.length} tracks · ${short(total) || '0:00'}${known ? '' : '+'}`;
    list.replaceChildren(...S.tracks.map((t, i) => {
      const li = h('li', {
        class: `${i === S.index ? 'current' : ''} ${i === S.selected ? 'selected' : ''}`,
        role: 'option',
        tabindex: '0',
        'aria-selected': String(i === S.selected),
      }, h('span', { class: 'n' }, `${i + 1}.`), h('span', { class: 't' }, titleOf(t)), h('span', { class: 'd' }, short(t.duration)));
      bindOpen(li, () => playIndex(i), () => {
        S.selected = i;
        list.querySelectorAll('.selected').forEach((o) => o.classList.remove('selected'));
        li.classList.add('selected');
      });
      return li;
    }));
    if (!S.tracks.length) list.append(h('li', { class: 'empty' }, S.message || 'No tracks yet. Add audio to music/ and run npm run tracks.'));
  }

  function paintToggles() {
    shuffleBtn.classList.toggle('on', S.shuffle);
    repeatBtn.classList.toggle('on', S.repeat);
    plBtn.classList.toggle('on', S.showPl);
  }

  function layout() {
    playlist.hidden = !S.showPl;
    paintToggles();
  }

  function paintAll() {
    paintState();
    paintList();
    layout();
  }

  let lastTick = 0;
  function tick(force) {
    const now = performance.now();
    if (!force && now - lastTick < 200) return;
    lastTick = now;
    const { pos, dur } = player.time();
    const shown = S.seeking ? (seek.value / 1000) * dur : pos;
    timeEl.textContent = S.index < 0 ? '00:00' : S.remaining && dur ? `-${clock(dur - shown)}` : clock(shown);
    seek.disabled = !dur;
    if (!S.seeking) seek.value = dur ? String(Math.round((pos / dur) * 1000)) : '0';
    seek.style.setProperty('--fill', `${seek.value / 10}%`);
  }

  // ── Visualizer: the real spectrum, or simulated bars for cross-origin audio
  const g = vis.getContext('2d');
  const bars = new Array(19).fill(0);
  const peaks = new Array(19).fill(0);
  const COLORS = ['#18b818', '#18b818', '#30c818', '#58d018', '#88d810', '#b8d810', '#d8c010', '#d89010', '#d86010', '#d83010', '#e01010'];
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    tick(false);
    if (win.min) return;
    const an = S.playing ? player.analyser() : null;
    let data = null;
    if (an) {
      data = new Uint8Array(an.frequencyBinCount);
      an.getByteFrequencyData(data);
    }
    g.clearRect(0, 0, 76, 16);
    g.fillStyle = '#0a0a0a';
    for (let x = 1; x < 76; x += 2) for (let y = 1; y < 16; y += 2) g.fillRect(x, y, 1, 1);
    for (let i = 0; i < 19; i++) {
      let target = 0;
      if (data) target = (data[Math.min(data.length - 1, Math.floor(i * 1.3))] / 255) * 16;
      else if (S.playing) target = Math.max(1, (16 - i * 0.35) * (0.35 + Math.random() * 0.65));
      bars[i] = target > bars[i] ? target : Math.max(0, bars[i] - 1);
      peaks[i] = Math.max(peaks[i] - 0.25, bars[i]);
      const hgt = Math.round(bars[i]);
      for (let y = 0; y < hgt; y++) {
        g.fillStyle = COLORS[Math.min(COLORS.length - 1, Math.floor((y / 16) * COLORS.length))];
        g.fillRect(i * 4, 15 - y, 3, 1);
      }
      if (peaks[i] > 0.5) {
        g.fillStyle = '#9a9a9a';
        g.fillRect(i * 4, 15 - Math.round(peaks[i]), 3, 1);
      }
    }
  }

  // Winamp's classic keys.
  root.addEventListener('keydown', (e) => {
    if (e.target.matches('input') || e.ctrlKey || e.metaKey || e.altKey) return;
    const act = { z: () => step(-1), x: play, c: pause, v: stop, b: () => step(1) }[e.key.toLowerCase()];
    if (act) {
      e.preventDefault();
      act();
    }
  });

  function shutdown() {
    cancelAnimationFrame(raf);
    player.destroy();
  }

  setVolume(S.volume);
  paintAll();
  frame();

  loadTracks()
    .then((json) => {
      S.tracks = (json.tracks ?? []).filter((t) => t.url);
      paintAll();
      if (opts.play) win.playUrl(opts.play);
    })
    .catch((err) => {
      S.message = `could not load tracks.json (${err.message})`;
      paintAll();
    });
}

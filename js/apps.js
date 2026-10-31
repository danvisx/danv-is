import { h, bindOpen, fmtDate } from './dom.js';
import { icons, glyph } from './icons.js';
import { loadBooks, loadPhotos, loadProfile, loadTracks, coverAt, photoAt, photoName } from './data.js';
import { SITE } from './config.js';
import { openWinamp } from './winamp.js';

const utm = (url) => `${url}${url.includes('?') ? '&' : '?'}utm_source=danv_is&utm_medium=referral`;

const tb = (g, label, fn, text) =>
  h('button', { class: 'tb', title: label, 'aria-label': label, onclick: fn }, glyph(g), text && h('span', {}, text));

const spinner = (text = 'Loading…') => h('div', { class: 'empty' }, h('span', { class: 'spinner' }), text);

function stars(n) {
  const el = h('span', { class: 'stars', 'aria-label': n ? `${n} of 5 stars` : 'Not rated' });
  for (let i = 1; i <= 5; i++) {
    const s = glyph('star');
    if (i <= n) s.classList.add('on');
    else if (i - 0.5 <= n) s.classList.add('half');
    el.append(s);
  }
  return el;
}

// "FUJIFILM X-E5 · 23 mm · f/3.2 · 1/80 s · ISO 1000"
function exifLine(e) {
  if (!e) return '';
  return [
    e.camera,
    e.focal && `${Number(e.focal)} mm`,
    e.aperture && `f/${e.aperture}`,
    e.exposure && `${e.exposure} s`,
    e.iso && `ISO ${e.iso}`,
  ].filter(Boolean).join(' · ');
}

export function createApps(wm, notify) {
  // ── Dolphin ────────────────────────────────────────────────────────────
  const PLACES = {
    home: { label: 'Home', icon: icons.files },
    books: { label: 'books', icon: icons.folderBooks },
    music: { label: 'music', icon: icons.folderMusic },
    photos: { label: 'photos', icon: icons.folderPhotos },
  };

  const COLUMNS = {
    home: ['Size', 'Type'],
    books: ['Author', 'Rating', 'Read'],
    photos: ['Location', 'Camera', 'Likes', 'Uploaded'],
    music: ['Album', 'Length', 'Type'],
  };

  const DETAILS_ON_DESKTOP = new Set(['books', 'music']);

  const EMPTY = {
    books: 'No books on the shelf yet.',
    photos: 'No photos here yet.',
    music: 'No music here yet.',
  };

  async function list(path) {
    if (path === 'books') {
      const { items } = await loadBooks();
      return items.map((b) => ({
        name: b.title,
        sub: b.author,
        thumb: b.cover,
        pixelate: true,
        fallback: icons.book,
        search: `${b.title} ${b.author}`,
        open: () => book(b),
        cols: [b.author, stars(b.rating), fmtDate(b.readAt)],
      }));
    }
    if (path === 'photos') {
      const { items } = await loadPhotos();
      return items.map((p, i) => ({
        name: photoName(p),
        sub: p.location || fmtDate(p.created),
        thumb: photoAt(p, 240),
        fallback: icons.image,
        search: [p.description, p.alt, p.location, ...(p.tags ?? [])].join(' '),
        tip: [photoName(p), p.location, exifLine(p.exif)].filter(Boolean).join('\n'),
        open: () => viewer(items, i),
        cols: [p.location ?? '', p.exif?.camera ?? '', String(p.likes ?? 0), fmtDate(p.created)],
      }));
    }
    if (path === 'music') {
      const { tracks = [] } = await loadTracks();
      const album = tracks[0]?.album ?? 'Playlist';
      const mins = (s) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
      return [
        // A real file in music/, shown in VS Code like the rest of the source.
        { name: 'important!!!.md', icon: icons.text, open: () => kwrite('music/important!!!.md'), cols: ['', '', 'Markdown document'] },
        // Not a real file: a shortcut that opens Winamp with the whole list.
        { name: `${album}.m3u`, icon: icons.playlist, open: () => openWinamp(wm), cols: [album, mins(tracks.reduce((s, t) => s + (t.duration || 0), 0)), 'M3U playlist'] },
        ...tracks.map((t) => {
          const file = decodeURIComponent(t.url.split('/').pop());
          return {
            // "artist - album - 01 title.mp3" is cut to "01 title.mp3"; the tooltip keeps it all.
            name: file.split(' - ').pop(),
            thumb: t.cover,
            fallback: icons.audio,
            search: `${file} ${t.title ?? ''}`,
            tip: file,
            open: () => openWinamp(wm, { play: t.url }),
            cols: [t.album ?? '', mins(t.duration), `${file.split('.').pop().toUpperCase()} audio`],
          };
        }),
      ];
    }
    const [b, p, m] = await Promise.allSettled([loadBooks(), loadPhotos(), loadTracks()]);
    const count = (s) => (s.status === 'fulfilled' ? `${s.value.items.length} items` : '—');
    return [
      { name: 'books', folder: true, icon: icons.folderBooks, open: (ctl) => ctl.go('books'), cols: [count(b), 'Folder'] },
      { name: 'music', folder: true, icon: icons.folderMusic, open: (ctl) => ctl.go('music'), cols: [m.status === 'fulfilled' ? `${(m.value.tracks?.length ?? 0) + 2} items` : '—', 'Folder'] },
      { name: 'photos', folder: true, icon: icons.folderPhotos, open: (ctl) => ctl.go('photos'), cols: [count(p), 'Folder'] },
    ];
  }

  // Covers that can't be resized by URL are shrunk onto a tiny canvas instead,
  // which keeps the chunky look. Drawing a cross-origin image is fine because
  // the canvas is only displayed, never read back.
  function pixelThumb(it) {
    const c = h('canvas', { class: 'preview', width: '24', height: '36' });
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const img = new Image();
      img.onload = () => {
        c.width = Math.max(1, Math.round((36 * img.naturalWidth) / img.naturalHeight));
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, 36);
      };
      img.onerror = () => c.replaceWith(h('img', { src: it.fallback, alt: '', class: 'icon' }));
      img.src = it.thumb;
    }, { rootMargin: '200px' });
    io.observe(c);
    return c;
  }

  function files(path = 'home') {
    const running = wm.get('files');
    if (running) {
      wm.focus(running);
      running.ctl.go(path);
      return;
    }

    const state = { path: null, back: [], fwd: [], view: 'icons', chosen: {}, filter: '' };
    let items = [];
    let token = 0;

    const backBtn = tb('left', 'Back', () => {
      if (!state.back.length) return;
      state.fwd.push(state.path);
      go(state.back.pop(), false);
    });
    const fwdBtn = tb('right', 'Forward', () => {
      if (!state.fwd.length) return;
      state.back.push(state.path);
      go(state.fwd.pop(), false);
    });
    const upBtn = tb('up', 'Up', () => go('home'));
    const crumbs = h('div', { class: 'crumbs' });
    const iconsBtn = tb('grid', 'Icons view', () => setView('icons'));
    const detailsBtn = tb('list', 'Details view', () => setView('details'));
    const filter = h('input', {
      class: 'field filter',
      type: 'search',
      placeholder: 'Filter…',
      'aria-label': 'Filter items',
      oninput: (e) => {
        state.filter = e.target.value.trim().toLowerCase();
        paint();
      },
    });

    const placeBtns = {};
    const places = h('aside', { class: 'places' },
      h('h3', {}, 'Places'),
      Object.entries(PLACES).map(([key, p]) =>
        (placeBtns[key] = h('button', { class: 'place', onclick: () => go(key) }, h('img', { src: p.icon, alt: '' }), p.label))),
      h('h3', {}, 'Remote'),
      h('a', { class: 'place', href: SITE.hardcover, target: '_blank', rel: 'noopener' }, glyph('external'), 'hardcover.app'),
      h('a', { class: 'place', href: utm(SITE.unsplash), target: '_blank', rel: 'noopener' }, glyph('external'), 'unsplash.com'),
    );

    const view = h('div', { class: 'view', role: 'listbox', 'aria-label': 'Folder contents' });
    const status = h('span', { class: 'status-text' });
    const body = h('div', { class: 'dolphin' },
      h('div', { class: 'toolbar' }, backBtn, fwdBtn, upBtn, crumbs, h('div', { class: 'grow' }), iconsBtn, detailsBtn, filter),
      h('div', { class: 'split' }, places, view),
      h('footer', { class: 'statusbar' }, status, h('span', { class: 'free' }, h('span', { class: 'meter' }, h('span')), '∞ GiB free')),
    );

    const win = wm.open({ id: 'files', title: 'Home — Dolphin', icon: icons.files, body, width: 800, height: 520 });

    // Phones get big icons everywhere, as they're easier to tap. Wider screens
    // get the details list for books and music, where the columns are the
    // point. A view picked with the toolbar sticks to that folder this visit.
    const defaultView = (path) => (!matchMedia('(max-width: 700px)').matches && DETAILS_ON_DESKTOP.has(path) ? 'details' : 'icons');

    function setView(v) {
      state.view = v;
      state.chosen[state.path] = v;
      paint();
    }

    async function go(path, push = true) {
      if (path === state.path) return;
      if (push && state.path) {
        state.back.push(state.path);
        state.fwd = [];
      }
      state.path = path;
      state.view = state.chosen[path] ?? defaultView(path);
      state.filter = '';
      filter.value = '';
      const label = PLACES[path].label;
      win.setTitle(`${label} — Dolphin`);
      crumbs.replaceChildren(h('button', { class: 'crumb', onclick: () => go('home') }, glyph('home'), 'Home'));
      if (path !== 'home') {
        crumbs.append(h('span', { class: 'sep' }, '›'), h('button', { class: 'crumb', 'aria-current': 'page' }, label));
      }
      for (const [k, b] of Object.entries(placeBtns)) b.classList.toggle('active', k === path);
      backBtn.disabled = !state.back.length;
      fwdBtn.disabled = !state.fwd.length;
      upBtn.disabled = path === 'home';

      const mine = ++token;
      items = [];
      view.replaceChildren(spinner());
      status.textContent = 'Loading…';
      try {
        const got = await list(path);
        if (mine !== token) return;
        items = got;
        paint();
      } catch (err) {
        if (mine !== token) return;
        console.error(err);
        view.replaceChildren(h('div', { class: 'empty' }, `Could not read "${label}".`, h('small', {}, err.message)));
        status.textContent = 'Error';
      }
    }

    function select(el) {
      view.querySelectorAll('.selected').forEach((o) => o.classList.remove('selected'));
      el.classList.add('selected');
      el.setAttribute('aria-selected', 'true');
      status.textContent = `"${el.dataset.name}" selected`;
    }

    function thumb(it) {
      if (!it.thumb) return h('img', { src: it.icon ?? it.fallback, alt: '', class: 'icon' });
      if (it.pixelate) return pixelThumb(it);
      const img = h('img', { src: it.thumb, alt: '', loading: 'lazy', class: 'preview' });
      img.addEventListener('error', () => {
        img.src = it.fallback;
        img.className = 'icon';
      }, { once: true });
      return img;
    }

    function paint() {
      iconsBtn.classList.toggle('on', state.view === 'icons');
      detailsBtn.classList.toggle('on', state.view === 'details');
      const shown = state.filter
        ? items.filter((it) => (it.search || it.name).toLowerCase().includes(state.filter))
        : items;

      const folders = shown.filter((it) => it.folder).length;
      const count = shown.length - folders;
      const parts = [];
      if (folders) parts.push(`${folders} Folder${folders > 1 ? 's' : ''}`);
      if (count || !folders) parts.push(`${count} File${count === 1 ? '' : 's'}`);
      status.textContent = parts.join(', ');

      if (!shown.length) {
        view.replaceChildren(h('div', { class: 'empty' }, state.filter ? 'No items match the filter.' : EMPTY[state.path] ?? 'This folder is empty.'));
        return;
      }

      const make = (it, el) => {
        el.dataset.name = it.name;
        bindOpen(el, () => it.open(win.ctl), select);
        return el;
      };

      if (state.view === 'icons') {
        view.replaceChildren(h('div', { class: 'grid' }, shown.map((it) =>
          make(it, h('div', { class: 'item', role: 'option', tabindex: '0', title: it.tip ?? (it.sub ? `${it.name}\n${it.sub}` : it.name) },
            h('span', { class: 'thumb' }, thumb(it)),
            h('span', { class: 'name' }, it.name),
            it.sub && h('span', { class: 'sub' }, it.sub),
          )))));
      } else {
        const tpl = `22px minmax(160px, 2.2fr) repeat(${COLUMNS[state.path].length}, minmax(90px, 1fr))`;
        view.replaceChildren(h('div', { class: 'rows', style: `--cols: ${tpl}` },
          h('div', { class: 'row head' }, h('span'), h('span', {}, 'Name'), COLUMNS[state.path].map((c) => h('span', {}, c))),
          shown.map((it) =>
            make(it, h('div', { class: 'row item', role: 'option', tabindex: '0' },
              h('span', { class: 'mini' }, thumb(it)),
              h('span', { class: 'name' }, it.name),
              it.cols.map((c) => h('span', { class: 'col' }, c)),
            ))),
        ));
      }
    }

    win.ctl = { go };
    go(path);
  }

  // ── Gwenview ───────────────────────────────────────────────────────────
  function viewer(photos, index) {
    const running = wm.get('gwenview');
    if (running) {
      wm.focus(running);
      running.ctl.show(photos, index);
      return;
    }

    let list = photos;
    let i = index;
    let showInfo = !matchMedia('(max-width: 700px)').matches;

    const img = h('img', { alt: '' });
    const counter = h('span', { class: 'dim' });
    const info = h('aside', { class: 'gv-info' });
    const infoBtn = tb('list', 'Information', () => {
      showInfo = !showInfo;
      paintInfoToggle();
    }, 'Information');
    const exifBar = h('div', { class: 'gv-exif' });
    const stage = h('div', { class: 'gv-stage loading' },
      img,
      exifBar,
      h('span', { class: 'spinner' }),
      h('button', { class: 'gv-nav prev', 'aria-label': 'Previous photo', onclick: () => step(-1) }, glyph('left', 3)),
      h('button', { class: 'gv-nav next', 'aria-label': 'Next photo', onclick: () => step(1) }, glyph('right', 3)),
    );
    const body = h('div', { class: 'gv' },
      h('div', { class: 'toolbar' },
        tb('left', 'Previous', () => step(-1)),
        tb('right', 'Next', () => step(1)),
        counter,
        h('div', { class: 'grow' }),
        infoBtn,
      ),
      h('div', { class: 'gv-split' }, stage, info),
    );

    const win = wm.open({ id: 'gwenview', title: 'Gwenview', icon: icons.image, body, width: 980, height: 640 });

    img.addEventListener('load', () => stage.classList.remove('loading'));
    win.el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });

    function step(d) {
      i = (i + d + list.length) % list.length;
      render();
    }

    function paintInfoToggle() {
      info.hidden = !showInfo;
      infoBtn.classList.toggle('on', showInfo);
    }

    function render() {
      const p = list[i];
      const e = p.exif ?? {};
      stage.classList.add('loading');
      img.src = photoAt(p, 1600);
      img.alt = p.alt || p.description || 'Photo';
      exifBar.textContent = exifLine(p.exif);
      exifBar.hidden = !exifBar.textContent;
      win.setTitle(`${photoName(p)} — Gwenview`);
      counter.textContent = `${i + 1} of ${list.length}`;

      const row = (k, v) => v != null && v !== '' && [h('dt', {}, k), h('dd', {}, v)];
      const num = (n) => (n == null ? null : Number(n).toLocaleString());
      info.replaceChildren(
        h('h3', {}, 'Information'),
        h('p', { class: 'gv-desc' }, p.description || p.alt || 'Untitled'),
        h('dl', {},
          row('Uploaded', fmtDate(p.created)),
          row('Size', `${p.width} x ${p.height}`),
          row('Location', p.location),
          row('Camera', e.camera),
          row('Focal length', e.focal && `${e.focal} mm`),
          row('Aperture', e.aperture && `f/${e.aperture}`),
          row('Exposure', e.exposure && `${e.exposure} s`),
          row('ISO', e.iso),
          row('Views', num(p.views)),
          row('Downloads', num(p.downloads)),
          row('Likes', h('span', { class: 'likes' }, glyph('heart'), num(p.likes ?? 0))),
        ),
        h('div', { class: 'gv-tags' }, (p.tags ?? []).map((t) => h('span', {}, t))),
        h('a', { class: 'btn', href: utm(p.page), target: '_blank', rel: 'noopener' }, glyph('external'), 'View on Unsplash'),
      );
    }

    win.ctl = {
      show(photos2, index2) {
        list = photos2;
        i = index2;
        render();
      },
    };
    paintInfoToggle();
    render();
  }

  // ── Book properties ────────────────────────────────────────────────────
  function book(b) {
    const row = (k, v) => v && [h('dt', {}, k), h('dd', {}, v)];
    const cover = b.cover
      ? h('img', { src: coverAt(b.cover, 'SY480'), alt: `Cover of ${b.title}` })
      : h('img', { src: icons.book, alt: '', class: 'icon' });
    const body = h('div', { class: 'props' },
      h('div', { class: 'props-cover' }, cover),
      h('div', { class: 'props-info' },
        h('h2', {}, b.title),
        h('p', { class: 'dim' }, `by ${b.author}`),
        h('dl', {},
          row('My rating', stars(b.rating)),
          row('Average', b.avgRating && `${b.avgRating} / 5`),
          row('Pages', b.pages),
          row('Published', b.published),
          row('Finished', fmtDate(b.readAt)),
        ),
        b.review && h('blockquote', {}, b.review),
        h('a', { class: 'btn', href: b.url, target: '_blank', rel: 'noopener' }, glyph('external'), 'Open on Hardcover'),
      ),
    );
    wm.open({ id: `book-${b.id}`, title: `${b.title} — Properties`, icon: icons.book, body, width: 600, height: 400 });
  }

  // ── KWrite (Markdown preview / source) ─────────────────────────────────
  let markedReady;
  const loadMarked = () => (markedReady ??= new Promise((resolve) => {
    if (window.marked) return resolve(window.marked);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js';
    s.onload = () => resolve(window.marked ?? null);
    s.onerror = () => resolve(null);
    document.head.append(s);
  }));

  function kwrite(path) {
    const id = `kwrite-${path}`;
    if (wm.get(id)) return wm.focus(wm.get(id));
    const name = path.split('/').pop();
    let source = '';
    let mode = 'preview';
    const doc = h('div', { class: 'doc-scroll' }, spinner());
    const previewBtn = tb('eye', 'Preview', () => show('preview'), 'Preview');
    const sourceBtn = tb('code', 'Source', () => show('source'), 'Source');
    const body = h('div', { class: 'docview' },
      h('div', { class: 'toolbar' }, previewBtn, sourceBtn),
      doc,
      h('footer', { class: 'statusbar' }, h('span', { class: 'status-text' }, 'Markdown · UTF-8'), h('span', { class: 'dim' }, 'INS')),
    );
    wm.open({ id, title: `${name} — KWrite`, icon: icons.text, body, width: 680, height: 420 });

    async function show(m) {
      mode = m;
      previewBtn.classList.toggle('on', m === 'preview');
      sourceBtn.classList.toggle('on', m === 'source');
      if (!source) return;
      if (m === 'source') {
        doc.replaceChildren(h('ol', { class: 'source' }, source.split('\n').map((line) => h('li', {}, line || ' '))));
      } else {
        const marked = await loadMarked();
        if (mode !== 'preview') return;
        const art = h('article', { class: 'doc' });
        if (marked) art.innerHTML = marked.parse(source);
        else art.append(h('pre', {}, source));
        art.querySelectorAll('a[href^="http"]').forEach((a) => {
          a.target = '_blank';
          a.rel = 'noopener';
        });
        doc.replaceChildren(art);
      }
      doc.scrollTop = 0;
    }

    show(mode);
    fetch(path.split('/').map(encodeURIComponent).join('/'), { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        source = text.replace(/\n$/, '');
        show(mode);
      })
      .catch((err) => doc.replaceChildren(h('div', { class: 'empty' }, `Could not open ${name}`, h('small', {}, err.message))));
  }

  // ── KMail composer ─────────────────────────────────────────────────────
  function mail() {
    if (wm.get('mail')) return wm.focus(wm.get('mail'));
    const status = h('span', { class: 'status-text' }, 'Ready');
    const sendBtn = h('button', { class: 'tb primary', type: 'submit', form: 'mail-form' }, glyph('send'), h('span', {}, 'Send'));
    const field = (label, input) => [h('label', { for: input.id }, label), input];
    const name = h('input', { class: 'field', id: 'mail-name', name: 'name', required: true, placeholder: 'Your name', autocomplete: 'name' });
    const email = h('input', { class: 'field', id: 'mail-email', name: 'email', type: 'email', required: true, placeholder: 'you@example.com', autocomplete: 'email' });
    const subject = h('input', { class: 'field', id: 'mail-subject', name: 'subject', required: true, placeholder: 'Hello!' });
    const message = h('textarea', { class: 'field', id: 'mail-message', name: 'message', required: true, placeholder: 'Write your message…', 'aria-label': 'Message' });
    const trap = h('input', { type: 'checkbox', name: 'botcheck', class: 'trap', tabindex: '-1', 'aria-hidden': 'true' });

    const form = h('form', { id: 'mail-form', class: 'mail', onsubmit: send },
      h('div', { class: 'headers' },
        field('From:', name),
        field('Email:', email),
        h('label', {}, 'To:'),
        h('span', { class: 'to' }, h('img', { src: icons.avatar, alt: '' }), `${SITE.owner}`),
        field('Subject:', subject),
      ),
      message,
      trap,
    );
    const body = h('div', { class: 'kmail' },
      h('div', { class: 'toolbar' }, sendBtn, tb('trash', 'Discard', () => win.close(), 'Discard')),
      form,
      h('footer', { class: 'statusbar' }, status),
    );
    const win = wm.open({ id: 'mail', title: 'New Message — KMail', icon: icons.mail, body, width: 620, height: 500 });
    name.focus();

    async function send(e) {
      e.preventDefault();
      if (trap.checked) return;
      if (!SITE.web3formsKey || SITE.web3formsKey.startsWith('YOUR_')) {
        status.textContent = 'Mail is not set up yet (missing Web3Forms key).';
        return;
      }
      sendBtn.disabled = true;
      status.textContent = 'Sending…';
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: SITE.web3formsKey,
            from_name: SITE.host,
            name: name.value,
            email: email.value,
            subject: subject.value,
            message: message.value,
            botcheck: false,
          }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.success) throw new Error(out.message || `HTTP ${res.status}`);
        notify({ icon: icons.mail, title: 'Message sent', body: `Thanks, ${name.value.split(' ')[0]}! I'll get back to you soon.` });
        win.close();
      } catch (err) {
        status.textContent = `Sending failed: ${err.message}`;
        sendBtn.disabled = false;
      }
    }
  }

  // ── LinkedIn ───────────────────────────────────────────────────────────
  // A Falkon window showing a preview of the profile (data/profile.json: the
  // top card, About and the current job) with the rest behind a blurred wall.
  // linkedin.com sends X-Frame-Options, so the real page can't be framed.
  function linkedin() {
    if (wm.get('linkedin')) return wm.focus(wm.get('linkedin'));
    let p = {};
    const url = SITE.linkedin;
    const external = () => window.open(url, '_blank', 'noopener');
    const page = h('div', { class: 'li-page' });
    const status = h('span', { class: 'status-text' }, 'Done');
    const card = (title, ...kids) => h('section', { class: 'li-card' }, title && h('h2', {}, title), ...kids);

    const logo = (name) => h('div', { class: 'li-logo', 'aria-hidden': 'true' }, (name ?? '?')[0]);

    // Roles at the same company sit under one logo, as on LinkedIn.
    function experience(list) {
      const groups = [];
      for (const x of list) {
        if (groups.at(-1)?.company === x.company) groups.at(-1).roles.push(x);
        else groups.push({ company: x.company, roles: [x] });
      }
      return groups.map((g) => h('div', { class: 'li-entry' },
        logo(g.company),
        h('div', { class: 'li-roles' },
          g.roles.length > 1 && h('h3', {}, g.company),
          ...g.roles.map((x) => h('div', { class: 'li-role' },
            h(g.roles.length > 1 ? 'h4' : 'h3', {}, x.role),
            g.roles.length === 1 && h('p', {}, x.company),
            h('p', { class: 'li-dim' }, [x.period, x.place].filter(Boolean).join(' · ')),
            x.text && h('p', { class: 'li-text' }, x.text),
          )),
        ),
      ));
    }

    // Stand-in rows under the blur: nothing real is rendered there.
    const FILLER = [
      ['Quality Assurance Specialist', 'Lorem Systems', 'Jan 2020 – Dec 2021 · Bucharest', 'Testing of web and mobile apps across several client projects and teams.'],
      ['Software Tester', 'Ipsum Health', 'Mar 2018 – Dec 2019 · Bucharest', 'Validation of clinical software releases and regression suites.'],
      ['Education', 'University of Dolor', '2012 – 2016', 'Engineering degree.'],
    ];
    const locked = () => h('section', { class: 'li-card li-locked' },
      h('div', { class: 'li-blur', 'aria-hidden': 'true' }, FILLER.map(([a, b, c, d]) =>
        h('div', { class: 'li-entry' }, logo(b), h('div', {}, h('h3', {}, a), h('p', {}, b), h('p', { class: 'li-dim' }, c), h('p', { class: 'li-text' }, d))))),
      h('div', { class: 'li-wall' },
        h('h2', {}, `See the rest of ${(p.name ?? SITE.owner).split(' ')[0]}'s profile`),
        h('p', {}, 'Past roles, education, certifications and skills are on LinkedIn.'),
        h('button', { class: 'li-btn primary', onclick: external }, 'View full profile'),
      ),
    );

    function render() {
      const jobs = p.experience ?? [];
      page.replaceChildren(...[
        h('section', { class: 'li-card li-top' },
          h('div', { class: 'li-banner' }),
          h('img', { class: 'li-avatar', src: icons.avatar, alt: '' }),
          h('h1', {}, p.name ?? SITE.owner),
          p.headline && h('p', { class: 'li-headline' }, p.headline),
          h('p', { class: 'li-meta' }, p.location && `${p.location} · `,
            h('button', { class: 'li-link', onclick: () => mail() }, 'Contact info')),
          h('div', { class: 'li-actions' },
            h('button', { class: 'li-btn primary', onclick: external }, 'Connect'),
            h('button', { class: 'li-btn', onclick: () => mail() }, 'Message'),
          ),
        ),
        p.about && card('About', h('p', { class: 'li-text' }, p.about)),
        jobs.length && card('Experience', ...experience(jobs)),
        locked(),
        h('p', { class: 'li-note' }, `This is a preview kept on ${SITE.host}. `,
          h('a', { href: url, target: '_blank', rel: 'noopener' }, 'See the full profile on LinkedIn'), '.'),
      ].filter(Boolean));
      page.scrollTop = 0;
    }

    function reload() {
      status.textContent = `Loading ${url.replace(/^https?:\/\//, '')}…`;
      page.replaceChildren(spinner());
      setTimeout(() => {
        render();
        status.textContent = 'Done';
      }, 350);
    }

    const back = tb('left', 'Back');
    const fwd = tb('right', 'Forward');
    back.disabled = fwd.disabled = true;
    const body = h('div', { class: 'falkon' },
      h('div', { class: 'toolbar' },
        back, fwd,
        tb('refresh', 'Reload', reload),
        h('div', { class: 'falkon-url field', title: url },
          h('span', { class: 'falkon-lock' }, glyph('lock')),
          h('span', { class: 'falkon-host' }, url.replace(/^https?:\/\//, '').replace(/\/$/, '')),
        ),
        tb('external', 'Open in a new tab', external, 'Open'),
      ),
      h('div', { class: 'falkon-view' }, page),
      h('footer', { class: 'statusbar' }, status),
    );
    const win = wm.open({ id: 'linkedin', title: 'LinkedIn — Falkon', icon: icons.linkedin, body, width: 760, height: 640 });
    page.replaceChildren(spinner());
    loadProfile()
      .then((json) => {
        p = json;
        win.setTitle(`${p.name ?? SITE.owner} | LinkedIn — Falkon`);
      })
      .catch(() => {})
      .finally(render);
  }

  return {
    files,
    mail,
    linkedin,
    books: () => files('books'),
    music: () => files('music'),
    photos: () => files('photos'),
  };
}

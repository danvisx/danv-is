import { h } from './dom.js';
import { icons, dinoFrame } from './icons.js';
import { loadBooks, loadPhotos, loadTracks } from './data.js';
import { SITE } from './config.js';

const PALETTE = ['#232629', '#da4453', '#27ae60', '#fdbc4b', '#3daee9', '#8e44ad', '#16a085', '#cfd8dc',
  '#7f8c8d', '#ed1515', '#11d116', '#f67400', '#1d99f3', '#9b59b6', '#1abc9c', '#fcfcfc'];

const bootedAt = performance.now();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function uptime() {
  const s = Math.floor((performance.now() - bootedAt) / 1000);
  const m = Math.floor(s / 60);
  if (!m) return `${s} sec${s === 1 ? '' : 's'}`;
  return `${m} min${m === 1 ? '' : 's'}, ${s % 60} sec${s % 60 === 1 ? '' : 's'}`;
}

function pageWeight() {
  const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
  const bytes = entries.reduce((sum, e) => sum + (e.transferSize || e.encodedBodySize || 0), 0);
  return `${(bytes / 1024).toFixed(0)} KiB over ${entries.length} requests`;
}

function loadTime() {
  const nav = performance.getEntriesByType('navigation')[0];
  return nav ? `${Math.round(nav.domContentLoadedEventEnd)} ms to DOMContentLoaded` : 'unknown';
}

// What fastfetch prints, but about this website instead of a machine.
async function facts(info) {
  const [b, p, t] = await Promise.allSettled([loadBooks(), loadPhotos(), loadTracks()]);
  const count = (s) => (s.status === 'fulfilled' ? (s.value.items ?? s.value.tracks).length : '?');
  const { theme, seed } = info.wallpaper();
  return [
    ['OS', `${SITE.host} (static HTML/CSS/JS)`],
    ['Host', SITE.hosting],
    ['Kernel', 'ES2022 modules, no framework'],
    ['Uptime', uptime()],
    ['Packages', '2 (cdn: highlight.js@11.9.0, marked@12.0.2), 2 (fonts), 0 (npm)'],
    ['Shell', 'konsole.js'],
    ['Display', `${innerWidth}x${innerHeight} @ ${devicePixelRatio}x, wallpaper scaled ${innerWidth < 700 ? 2 : 3}x nearest-neighbour`],
    ['DE', 'Plasma (pixel edition)'],
    ['WM', 'wm.js (a very small KWin)'],
    ['Theme', 'Breeze Dark [pixelated]'],
    ['Icons', 'hand-drawn 16x16 pixel maps'],
    ['Font', 'JetBrains Mono (Google Fonts)'],
    ['Cursor', '12x16 pixel arrow'],
    ['Terminal', 'konsole.js'],
    ['Wallpaper', `procedural isometric ${theme} (seed 0x${seed.toString(16)})`],
    ['Books', `${count(b)} from Hardcover, refreshed daily`],
    ['Photos', `${count(p)} from Unsplash, refreshed daily`],
    ['Music', `${count(t)} local tracks in music/ (npm run tracks)`],
    ['Mail', 'Web3Forms'],
    ['Build', 'none (no bundler, no node_modules)'],
    ['Source', /^https?:/.test(SITE.source) ? h('a', { href: SITE.source, target: '_blank', rel: 'noopener' }, 'GitHub Repo') : SITE.source],
    ['Page weight', pageWeight()],
    ['Load', loadTime()],
  ];
}

export function openTerminal(wm, apps, info) {
  if (wm.get('konsole')) return wm.focus(wm.get('konsole'));

  const out = h('div', { class: 'term-out' });
  const input = h('input', {
    class: 'term-input',
    'aria-label': 'Command',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
  });
  const promptText = `[${SITE.user}@${SITE.host.replace(/\./g, '-')} ~]$ `;
  const promptLine = h('div', { class: 'term-line term-prompt' }, h('span', { class: 'ps1' }, promptText), input);
  const screen = h('div', { class: 'term', onclick: () => getSelection().isCollapsed && input.focus() }, out, promptLine);
  const win = wm.open({ id: 'konsole', title: `${SITE.user}@${SITE.host}:~ — Konsole`, icon: icons.terminal, body: screen, width: 820, height: 560 });

  const history = [];
  let cursor = 0;
  let busy = false;

  const print = (...nodes) => {
    out.append(h('div', { class: 'term-line' }, ...nodes));
    screen.scrollTop = screen.scrollHeight;
  };
  const c = (cls, text) => h('span', { class: cls }, text);
  const echoCommand = (cmd) => print(c('ps1', promptText), cmd);

  async function fastfetch() {
    const rows = await facts(info);
    const title = `${SITE.user}@${SITE.host}`;
    const keys = h('div', { class: 'ff-info' },
      h('div', {}, c('ff-key', SITE.user), '@', c('ff-key', SITE.host)),
      h('div', {}, '-'.repeat(title.length)),
      rows.map(([k, v]) => h('div', {}, c('ff-key', k), ': ', v)),
      h('div', { class: 'ff-colors' }, PALETTE.slice(0, 8).map((col) => h('span', { style: `background:${col}` }))),
      h('div', { class: 'ff-colors' }, PALETTE.slice(8).map((col) => h('span', { style: `background:${col}` }))),
    );
    out.append(h('div', { class: 'ff' }, h('img', { class: 'ff-logo', src: dinoFrame, alt: '' }), keys));
    screen.scrollTop = screen.scrollHeight;
  }

  const OPENERS = {
    files: () => apps.files(),
    books: apps.books,
    photos: apps.photos,
    music: apps.music,
    mail: apps.mail,
    linkedin: apps.linkedin,
  };

  const COMMANDS = {
    help: () => {
      print('Available commands:');
      for (const [name, desc] of [
        ['fastfetch', 'what this site is made of'],
        ['ls', 'list files'],
        ['open <name>', 'files, books, photos, music, mail, linkedin'],
        ['code .', "browse this site's source"],
        ['whoami', 'who am I'],
        ['date', 'print the date'],
        ['echo <text>', 'say something'],
        ['clear', 'clear the screen'],
        ['exit', 'close the terminal'],
      ]) print(c('ff-key term-cmd', name), desc);
    },
    fastfetch,
    neofetch: fastfetch,
    ls: () => print(c('dir', 'books'), '  ', c('dir', 'music'), '  ', c('dir', 'photos')),
    cat: (args) => print(`cat: ${args[0] ?? ''}: No such file or directory`),
    open: (args) => {
      const run = OPENERS[args[0]];
      if (run) run();
      else print(`open: ${args[0] ?? ''}: unknown. Try: ${Object.keys(OPENERS).join(', ')}`);
    },
    'xdg-open': (args) => COMMANDS.open(args),
    code: () => info.code(),
    cd: (args) => args[0] && print(`bash: cd: ${args[0]}: Permission denied (this is a website)`),
    pwd: () => print(`/home/${SITE.user}`),
    whoami: () => print(`${SITE.user}, or rather a visitor to ${SITE.host}`),
    date: () => print(new Date().toString()),
    uname: () => print(`${SITE.host} pixel-plasma ${navigator.userAgent.includes('Firefox') ? 'gecko' : 'blink/webkit'} js`),
    echo: (args) => print(args.join(' ')),
    sudo: () => print(`${SITE.user} is not in the sudoers file. This incident will be reported.`),
    clear: () => out.replaceChildren(),
    exit: () => win.close(),
  };

  async function run(line) {
    const [cmd, ...args] = line.trim().split(/\s+/);
    echoCommand(line);
    if (!cmd) return;
    const fn = COMMANDS[cmd];
    if (fn) await fn(args);
    else print(`bash: ${cmd}: command not found...`);
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !busy) {
      const line = input.value;
      input.value = '';
      if (line.trim()) history.push(line);
      cursor = history.length;
      busy = true;
      await run(line);
      busy = false;
      if (wm.get('konsole') === win) print();
      screen.scrollTop = screen.scrollHeight;
    } else if (e.key === 'ArrowUp' && cursor > 0) {
      e.preventDefault();
      input.value = history[--cursor];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.min(history.length, cursor + 1);
      input.value = history[cursor] ?? '';
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.replaceChildren();
    }
  });

  // Type "fastfetch" at the prompt as if someone just opened the terminal.
  (async () => {
    busy = true;
    const cmd = 'fastfetch';
    for (const ch of cmd) {
      if (!reduced) await new Promise((r) => setTimeout(r, 70));
      input.value += ch;
    }
    if (!reduced) await new Promise((r) => setTimeout(r, 200));
    input.value = '';
    history.push(cmd);
    cursor = history.length;
    await run(cmd);
    print();
    busy = false;
    input.focus();
  })();
}

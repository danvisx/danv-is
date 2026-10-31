import { h, bindOpen, debounce, isTouch } from './dom.js';
import { icons, glyph, cursorUrl, dinoSheet } from './icons.js';
import { paintWallpaper } from './wallpaper.js';
import { WM } from './wm.js';
import { createApps } from './apps.js';
import { openTerminal } from './konsole.js';
import { openWinamp } from './winamp.js';
import { openCode } from './vscode.js';
import { SITE } from './config.js';

const $ = (s) => document.querySelector(s);

document.documentElement.style.setProperty('--cursor', `url(${cursorUrl}) 0 0, default`);
document.head.append(h('link', { rel: 'icon', href: icons.fedora }));

// ── Notifications ─────────────────────────────────────────────────────────
function notify({ icon, title, body, timeout = 5000 }) {
  const toast = h('div', { class: 'toast', role: 'status' },
    h('img', { src: icon, alt: '' }),
    h('div', {}, h('strong', {}, title), h('p', {}, body)),
    h('button', { class: 'wb', 'aria-label': 'Dismiss', onclick: () => toast.remove() }, glyph('close')),
  );
  $('#toasts').append(toast);
  setTimeout(() => toast.remove(), timeout);
}

const wm = new WM($('#windows'), $('#tasks'));
const apps = createApps(wm, notify);

// ── Wallpaper ─────────────────────────────────────────────────────────────
const newSeed = () => (Math.random() * 2 ** 32) >>> 0;
let seed = newSeed();
let theme = '';
const paint = () => (theme = paintWallpaper($('#wallpaper'), seed));
const nextWallpaper = () => {
  seed = newSeed();
  paint();
};
paint();
addEventListener('resize', debounce(paint, 150));

const code = () => openCode(wm);
const terminal = () => openTerminal(wm, apps, { wallpaper: () => ({ seed, theme }), code });

// ── Desktop icons ─────────────────────────────────────────────────────────
const DESKTOP = [
  { label: 'Files', icon: icons.files, open: () => apps.files() },
  { label: 'Terminal', icon: icons.terminal, open: terminal },
  { label: 'Winamp', icon: icons.winamp, open: () => openWinamp(wm) },
  { label: 'VS Code', icon: icons.code, open: code },
  { label: 'LinkedIn', icon: icons.linkedin, open: apps.linkedin },
  { label: 'Mail', icon: icons.mail, open: apps.mail },
];

const desk = $('#desktop-icons');
const selectIcon = (el) => desk.querySelectorAll('.dicon').forEach((o) => o.classList.toggle('selected', o === el));
for (const item of DESKTOP) {
  const btn = h('button', { class: 'dicon' }, h('img', { src: item.icon, alt: '' }), h('span', {}, item.label));
  bindOpen(btn, item.open, selectIcon);
  desk.append(h('li', {}, btn));
}
$('#desktop').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.dicon, .win')) selectIcon(null);
});

// ── Popup menus (desktop context menu + launcher) ─────────────────────────
const ctx = $('#ctxmenu');
const kickoff = $('#kickoff');
const launcher = $('#launcher');

function closePopups() {
  ctx.hidden = true;
  kickoff.hidden = true;
  launcher.setAttribute('aria-expanded', 'false');
}

function menuItem({ label, icon, g, run }) {
  return h('button', {
    class: 'menu-item',
    role: 'menuitem',
    onclick: () => {
      closePopups();
      run();
    },
  }, icon ? h('img', { src: icon, alt: '' }) : glyph(g), h('span', {}, label));
}

$('#desktop').addEventListener('contextmenu', (e) => {
  if (e.target.closest('.win')) return;
  e.preventDefault();
  closePopups();
  ctx.replaceChildren(
    menuItem({ label: 'Next Wallpaper Image', g: 'wallpaper', run: nextWallpaper }),
    h('hr'),
    menuItem({ label: 'Open Files', icon: icons.files, run: () => apps.files() }),
    menuItem({ label: 'Open Terminal', icon: icons.terminal, run: terminal }),
    menuItem({ label: 'New Message…', icon: icons.mail, run: apps.mail }),
    h('hr'),
    menuItem({ label: 'Lock Screen', g: 'lock', run: lock }),
  );
  ctx.hidden = false;
  const r = ctx.getBoundingClientRect();
  ctx.style.left = `${Math.min(e.clientX, innerWidth - r.width - 8)}px`;
  ctx.style.top = `${Math.min(e.clientY, innerHeight - r.height - 8)}px`;
  ctx.querySelector('button').focus();
});

const LAUNCH = [
  { label: 'Files', hint: 'Dolphin file manager', icon: icons.files, run: () => apps.files() },
  { label: 'Konsole', hint: 'Terminal (try fastfetch)', icon: icons.terminal, run: terminal },
  { label: 'Winamp', hint: 'It really whips', icon: icons.winamp, run: () => openWinamp(wm) },
  { label: 'VS Code', hint: "This site's source code", icon: icons.code, run: code },
  { label: 'Books', hint: 'What I have been reading', icon: icons.folderBooks, run: apps.books },
  { label: 'Photos', hint: 'My Unsplash uploads', icon: icons.folderPhotos, run: apps.photos },
  { label: 'Mail', hint: 'Send me a message', icon: icons.mail, run: apps.mail },
  { label: 'LinkedIn', hint: 'linkedin.com', icon: icons.linkedin, run: apps.linkedin },
];

const appList = h('div', { class: 'k-apps' });
const search = h('input', {
  class: 'field',
  type: 'search',
  placeholder: 'Search…',
  'aria-label': 'Search applications',
  oninput: () => renderLaunch(),
  onkeydown: (e) => {
    if (e.key === 'Enter') appList.querySelector('button')?.click();
  },
});

function renderLaunch() {
  const q = search.value.trim().toLowerCase();
  const hits = LAUNCH.filter((a) => `${a.label} ${a.hint}`.toLowerCase().includes(q));
  appList.replaceChildren(...hits.map((a) =>
    h('button', {
      class: 'menu-item k-app',
      role: 'menuitem',
      onclick: () => {
        closePopups();
        a.run();
      },
    }, h('img', { src: a.icon, alt: '' }), h('span', {}, h('b', {}, a.label), h('small', {}, a.hint)))));
  if (!hits.length) appList.append(h('p', { class: 'empty' }, 'No results.'));
}

kickoff.append(
  h('header', { class: 'k-head' },
    h('img', { src: icons.avatar, alt: '' }),
    h('div', {}, h('b', {}, SITE.owner), h('small', {}, `${SITE.user}@${SITE.host}`)),
  ),
  h('div', { class: 'k-search' }, glyph('search'), search),
  h('h3', {}, 'Applications'),
  appList,
  h('footer', { class: 'k-foot' },
    menuItem({ label: 'Wallpaper', g: 'wallpaper', run: nextWallpaper }),
    menuItem({ label: 'Lock', g: 'lock', run: lock }),
    menuItem({ label: 'Restart', g: 'refresh', run: () => location.reload() }),
  ),
);
renderLaunch();

launcher.append(h('img', { src: icons.fedora, alt: '' }));
launcher.addEventListener('click', () => {
  const open = kickoff.hidden;
  closePopups();
  if (!open) return;
  kickoff.hidden = false;
  launcher.setAttribute('aria-expanded', 'true');
  search.value = '';
  renderLaunch();
  if (!isTouch()) search.focus();
});

document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#ctxmenu, #kickoff, #launcher')) closePopups();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePopups();
});

// ── Panel: tray, clock, peek ──────────────────────────────────────────────
const tray = $('#tray');
const battery = h('span', { class: 'tray-icon', title: 'Battery' }, glyph('battery'));
tray.append(
  h('span', { class: 'tray-icon', title: 'Connected' }, glyph('wifi')),
  h('span', { class: 'tray-icon', title: 'Volume: 70%' }, glyph('volume')),
  battery,
);
navigator.getBattery?.().then((b) => {
  const show = () => (battery.title = `Battery: ${Math.round(b.level * 100)}%${b.charging ? ' (charging)' : ''}`);
  show();
  b.addEventListener('levelchange', show);
  b.addEventListener('chargingchange', show);
}).catch(() => {});

const clock = $('#clock');
function tick() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
  clock.querySelector('.time').textContent = time;
  clock.querySelector('.date').textContent = date;
  clock.title = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const lockClock = $('#lock .l-time');
  if (lockClock) {
    lockClock.textContent = time;
    $('#lock .l-date').textContent = clock.title;
  }
}
tick();
setInterval(tick, 5000);

$('#peek').addEventListener('click', () => wm.peek());

// ── Lock screen ───────────────────────────────────────────────────────────
function lock() {
  const el = $('#lock');
  const unlock = () => {
    el.hidden = true;
    el.replaceChildren();
  };
  el.replaceChildren(
    h('div', { class: 'l-clock' }, h('div', { class: 'l-time' }), h('div', { class: 'l-date' })),
    h('div', { class: 'l-user' },
      h('img', { src: icons.avatar, alt: '' }),
      h('b', {}, SITE.owner),
      h('button', { class: 'btn', onclick: unlock }, glyph('lock'), 'Unlock'),
    ),
  );
  el.hidden = false;
  el.querySelector('button').focus();
  tick();
}

// ── Boot splash ───────────────────────────────────────────────────────────
const splash = $('#splash');
splash.querySelector('.splash-dino').style.backgroundImage = `url(${dinoSheet})`;
let booted = null;
try {
  booted = sessionStorage.getItem('booted');
  sessionStorage.setItem('booted', '1');
} catch {}
const quick = booted || matchMedia('(prefers-reduced-motion: reduce)').matches;
setTimeout(() => {
  splash.classList.add('done');
  setTimeout(() => splash.remove(), 300);
  if (!booted) {
    notify({
      icon: icons.avatar,
      title: `Hey,`,
      body: `${isTouch() ? 'Tap' : 'Double-click'} an icon to open it. ${isTouch() ? '' : 'Right-click the desktop for more.'}`,
      timeout: 8000,
    });
  }
}, quick ? 50 : 1400);

import { h, fmtBytes } from './dom.js';
import { icons, glyph } from './icons.js';
import { SITE } from './config.js';

// A small VS Code that opens this site's own source. data/source.json lists
// the files (scripts/build-manifest.mjs); each one is fetched from the site
// itself when opened, so what's shown is exactly what's deployed.

const HLJS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
const MAX_HIGHLIGHT = 200 * 1024;

let hljsReady;
function loadHighlighter() {
  hljsReady ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = HLJS;
    s.onload = () => resolve(window.hljs ?? null);
    s.onerror = () => resolve(null);
    document.head.append(s);
  });
  return hljsReady;
}

const TYPES = {
  js: { lang: 'javascript', name: 'JavaScript', badge: 'JS', color: '#f1dd35' },
  mjs: { lang: 'javascript', name: 'JavaScript', badge: 'JS', color: '#f1dd35' },
  css: { lang: 'css', name: 'CSS', badge: '#', color: '#42a5f5' },
  html: { lang: 'xml', name: 'HTML', badge: '<>', color: '#e44d26' },
  md: { lang: 'markdown', name: 'Markdown', badge: 'M', color: '#519aba' },
  json: { lang: 'json', name: 'JSON', badge: '{}', color: '#cbcb41' },
  yml: { lang: 'yaml', name: 'YAML', badge: '!', color: '#a074c4' },
  yaml: { lang: 'yaml', name: 'YAML', badge: '!', color: '#a074c4' },
  png: { image: true, name: 'Image', badge: 'img', color: '#a074c4' },
  jpg: { image: true, name: 'Image', badge: 'img', color: '#a074c4' },
  jpeg: { image: true, name: 'Image', badge: 'img', color: '#a074c4' },
  svg: { image: true, name: 'SVG', badge: 'svg', color: '#ffb13b' },
  mp3: { binary: true, name: 'Audio', badge: '♪', color: '#e37933' },
};
const typeOf = (path) => TYPES[path.split('.').pop().toLowerCase()] ?? { lang: 'plaintext', name: 'Plain Text', badge: '·', color: '#8a8f98' };
const urlOf = (path) => path.split('/').map(encodeURIComponent).join('/');
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Cuts highlighted HTML into lines, closing the spans still open at each line
// end and reopening them on the next, so every line can be its own row.
function splitLines(html) {
  const lines = [];
  const open = [];
  let line = '';
  for (const [, tag, close, br, text] of html.matchAll(/(<span[^>]*>)|(<\/span>)|(\n)|([^<\n]+)/g)) {
    if (tag) {
      open.push(tag);
      line += tag;
    } else if (close) {
      open.pop();
      line += close;
    } else if (br) {
      lines.push(line + '</span>'.repeat(open.length));
      line = open.join('');
    } else line += text;
  }
  lines.push(line + '</span>'.repeat(open.length));
  return lines;
}

function buildTree(files) {
  const root = { name: SITE.host.replace(/\./g, '-'), dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      if (!node.dirs.has(dir)) node.dirs.set(dir, { name: dir, path: node.path ? `${node.path}/${dir}` : dir, dirs: new Map(), files: [] });
      node = node.dirs.get(dir);
    }
    node.files.push({ ...f, name: parts.at(-1) });
  }
  return root;
}

// path: a file to show, in a new window or the running one.
export function openCode(wm, path) {
  const running = wm.get('vscode');
  if (running) {
    wm.focus(running);
    if (path) running.openFile(path);
    return;
  }

  const narrow = matchMedia('(max-width: 700px)').matches;
  const expanded = new Set(['']);
  const tabs = [];
  const cache = new Map();
  let active = null;
  let files = [];

  const explorer = h('div', { class: 'vs-tree', role: 'tree', 'aria-label': 'Explorer' });
  const sidebar = h('aside', { class: 'vs-side' }, h('h3', {}, 'Explorer'), explorer);
  const activity = (g, label, on, fn) => h('button', { class: `vs-act${on ? ' on' : ''}`, title: label, 'aria-label': label, onclick: fn }, glyph(g));
  const actbar = h('nav', { class: 'vs-actbar' },
    activity('files', 'Explorer (toggle)', true, () => {
      sidebar.hidden = !sidebar.hidden;
    }),
    activity('search', 'Search', false, () => {}),
    activity('branch', 'Source Control', false, () => {}),
    activity('grid', 'Extensions', false, () => {}),
  );
  const tabbar = h('div', { class: 'vs-tabs', role: 'tablist' });
  const crumbs = h('div', { class: 'vs-crumbs' });
  const editor = h('div', { class: 'vs-editor' });
  const status = {
    pos: h('span', {}, ''),
    lang: h('span', {}, ''),
    size: h('span', {}, ''),
  };
  const statusbar = h('footer', { class: 'vs-status' },
    h('span', { class: 'vs-branch' }, glyph('branch'), 'main'),
    h('span', {}, '⊗ 0  ⚠ 0'),
    h('span', { class: 'grow' }),
    status.pos, status.size, h('span', {}, 'Spaces: 2'), h('span', {}, 'UTF-8'), h('span', {}, 'LF'), status.lang,
  );
  sidebar.hidden = narrow;

  const body = h('div', { class: 'vscode' },
    h('div', { class: 'vs-main' }, actbar, sidebar, h('section', { class: 'vs-pane' }, tabbar, crumbs, editor)),
    statusbar,
  );
  const win = wm.open({ id: 'vscode', title: 'Visual Studio Code', icon: icons.code, body, width: 980, height: 620 });

  // ── Explorer ─────────────────────────────────────────────────────────────
  function paintTree() {
    const rows = [];
    const walk = (node, depth) => {
      const dirs = [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
      for (const d of dirs) {
        const open = expanded.has(d.path);
        rows.push(h('button', {
          class: 'vs-row vs-dir',
          role: 'treeitem',
          'aria-expanded': String(open),
          style: `--depth: ${depth}`,
          onclick: () => {
            if (open) expanded.delete(d.path);
            else expanded.add(d.path);
            paintTree();
          },
        }, h('span', { class: 'vs-chev' }, open ? '⌄' : '›'), d.name));
        if (open) walk(d, depth + 1);
      }
      for (const f of [...node.files].sort((a, b) => a.name.localeCompare(b.name))) {
        const t = typeOf(f.path);
        rows.push(h('button', {
          class: `vs-row${active === f.path ? ' active' : ''}`,
          role: 'treeitem',
          title: `${f.path} · ${fmtBytes(f.size)}`,
          style: `--depth: ${depth}`,
          onclick: () => {
            open(f.path);
            if (narrow) sidebar.hidden = true;
          },
        }, h('span', { class: 'vs-badge', style: `color: ${t.color}` }, t.badge), f.name));
      }
    };
    const tree = buildTree(files);
    explorer.replaceChildren(
      h('div', { class: 'vs-root' }, '⌄ ', tree.name.toUpperCase()),
      ...((walk(tree, 1), rows)),
    );
  }

  // ── Tabs and editor ──────────────────────────────────────────────────────
  function paintTabs() {
    tabbar.replaceChildren(...tabs.map((path) => {
      const t = typeOf(path);
      return h('div', { class: `vs-tab${path === active ? ' active' : ''}`, role: 'tab', 'aria-selected': String(path === active) },
        h('button', { class: 'vs-tab-name', onclick: () => open(path) }, h('span', { class: 'vs-badge', style: `color: ${t.color}` }, t.badge), path.split('/').pop()),
        h('button', { class: 'vs-tab-close', 'aria-label': `Close ${path}`, onclick: () => close(path) }, '×'),
      );
    }));
  }

  function close(path) {
    const i = tabs.indexOf(path);
    tabs.splice(i, 1);
    if (active === path) {
      active = tabs[Math.min(i, tabs.length - 1)] ?? null;
      if (active) return open(active);
      editor.replaceChildren(h('div', { class: 'vs-empty' }, h('img', { src: icons.code, alt: '' }), 'Select a file in the Explorer'));
      crumbs.replaceChildren();
      win.setTitle('Visual Studio Code');
      status.pos.textContent = status.lang.textContent = status.size.textContent = '';
    }
    paintTabs();
    paintTree();
  }

  async function open(path) {
    const entry = files.find((f) => f.path === path);
    if (!entry) return;
    if (!tabs.includes(path)) tabs.push(path);
    active = path;
    const t = typeOf(path);
    win.setTitle(`${path.split('/').pop()} — ${SITE.host.replace(/\./g, '-')} — Visual Studio Code`);
    crumbs.replaceChildren(...path.split('/').flatMap((p, i, all) => [i ? h('span', { class: 'sep' }, '›') : null, h('span', {}, p)]).filter(Boolean));
    status.lang.textContent = t.name;
    status.size.textContent = fmtBytes(entry.size);
    status.pos.textContent = 'Ln 1, Col 1';
    paintTabs();
    paintTree();

    if (t.image) {
      editor.replaceChildren(h('div', { class: 'vs-image' }, h('img', { src: urlOf(path), alt: path })));
      return;
    }
    if (t.binary) {
      editor.replaceChildren(h('div', { class: 'vs-empty' },
        'The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.'));
      return;
    }

    editor.replaceChildren(h('div', { class: 'vs-empty' }, h('span', { class: 'spinner' })));
    try {
      if (!cache.has(path)) {
        const res = await fetch(urlOf(path), { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        cache.set(path, await res.text());
      }
      const text = cache.get(path);
      const hljs = entry.size <= MAX_HIGHLIGHT ? await loadHighlighter() : null;
      if (active !== path) return;
      let html = escapeHtml(text);
      if (hljs?.getLanguage(t.lang)) html = hljs.highlight(text, { language: t.lang, ignoreIllegals: true }).value;
      // One row per line so long lines wrap and the numbers stay beside them.
      const lines = splitLines(html);
      if (text.endsWith('\n') && lines.length > 1) lines.pop();
      const code = h('div', { class: 'vs-code hljs' }, lines.map((line, k) =>
        h('div', { class: 'vs-line' },
          h('span', { class: 'vs-ln', 'aria-hidden': 'true' }, String(k + 1)),
          h('span', { class: 'vs-lc', innerHTML: line || ' ' }))));
      code.addEventListener('click', () => {
        const sel = getSelection();
        if (!sel.rangeCount) return;
        const node = sel.anchorNode;
        const lc = (node.nodeType === 1 ? node : node.parentElement)?.closest('.vs-lc');
        if (!lc) return;
        const before = document.createRange();
        before.selectNodeContents(lc);
        before.setEnd(node, sel.anchorOffset);
        const row = [...code.children].indexOf(lc.parentElement);
        status.pos.textContent = `Ln ${row + 1}, Col ${before.toString().length + 1}`;
      });
      editor.replaceChildren(h('div', { class: 'vs-scroll' }, code));
    } catch (err) {
      editor.replaceChildren(h('div', { class: 'vs-empty' }, `Could not open ${path}: ${err.message}`));
    }
  }

  // Unfolds the file's folders in the Explorer, then opens it.
  win.openFile = (p) => {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join('/'));
    open(p);
  };

  fetch('data/source.json', { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((json) => {
      files = json.files ?? [];
      const first = [path, 'README.md'].find((p) => p && files.some((f) => f.path === p)) ?? files[0]?.path;
      if (first) win.openFile(first);
      else paintTree();
    })
    .catch((err) => {
      explorer.replaceChildren(h('p', { class: 'vs-empty' }, `No source.json yet (${err.message}). Run npm run manifest.`));
    });
}

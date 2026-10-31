// Tiny hyperscript helper: h('div', { class: 'x', onclick: fn }, child, 'text')
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value' || k === 'innerHTML') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const coarse = matchMedia('(pointer: coarse)');

// KDE-style activation: click selects, double-click opens. Touch opens on tap.
export function bindOpen(el, open, select) {
  el.addEventListener('click', (e) => {
    select?.(el);
    if (coarse.matches) open(e);
  });
  el.addEventListener('dblclick', (e) => {
    if (!coarse.matches) open(e);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      open(e);
    }
  });
}

export const isTouch = () => coarse.matches;

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KiB`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  // A bare YYYY-MM-DD is a calendar day, not UTC midnight.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = day ? new Date(+day[1], day[2] - 1, +day[3]) : new Date(iso);
  if (Number.isNaN(+d)) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    return null;
  }
}

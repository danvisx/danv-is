import { h } from './dom.js';
import { glyph } from './icons.js';

let seq = 0;

// A small KWin: stacking, focus, drag, resize, maximise, minimise, taskbar.
export class WM {
  constructor(layer, taskbar) {
    this.layer = layer;
    this.taskbar = taskbar;
    this.wins = [];
    this.z = 10;
    this.cascade = 0;
  }

  get(id) {
    return this.wins.find((w) => w.id === id);
  }

  // frameless: the app draws its own chrome, sizes itself, and marks drag
  // handles with [data-drag].
  open({ id = `win${++seq}`, title, icon, body, width = 640, height = 440, onClose, frameless = false }) {
    const existing = this.get(id);
    if (existing) {
      this.focus(existing);
      return existing;
    }

    const w = { id, icon, onClose, frameless, max: false, min: false };
    const btn = (name, label, fn) =>
      h('button', {
        class: `wb wb-${name}`,
        'aria-label': label,
        title: label,
        onclick: (e) => {
          e.stopPropagation();
          fn();
        },
      }, glyph(name));

    w.titleEl = h('span', { class: 'win-name' });
    w.maxBtn = btn('max', 'Maximize', () => this.toggleMax(w));
    const bar = h('header', { class: 'win-title', ondblclick: (e) => !e.target.closest('button') && this.toggleMax(w) },
      h('img', { class: 'win-icon', src: icon, alt: '' }),
      w.titleEl,
      h('div', { class: 'win-btns' },
        btn('min', 'Minimize', () => this.minimize(w)),
        w.maxBtn,
        btn('close', 'Close', () => this.close(w)),
      ),
    );
    w.body = h('div', { class: 'win-body' }, body);
    const grip = h('div', { class: 'win-grip', 'aria-hidden': 'true' });
    w.el = h('section', { class: frameless ? 'win frameless' : 'win', role: 'dialog', tabindex: '-1' },
      h('div', { class: 'win-frame' }, bar, w.body, grip));

    w.taskLabel = h('span');
    w.task = h('button', { class: 'task', onclick: () => this.taskClick(w) }, h('img', { src: icon, alt: '' }), w.taskLabel);

    w.setTitle = (t) => {
      w.title = t;
      w.titleEl.textContent = t;
      w.taskLabel.textContent = t;
      w.task.title = t;
      w.el.setAttribute('aria-label', t);
    };
    w.close = () => this.close(w);
    w.minimize = () => this.minimize(w);
    w.setTitle(title);

    const L = this.layer.getBoundingClientRect();
    // Phones keep a margin above and below, clear of the system swipe areas.
    const phone = matchMedia('(max-width: 700px)').matches;
    w.width = Math.min(width, L.width - 16);
    w.height = Math.min(height, L.height - (phone ? 96 : 16));
    const step = (this.cascade++ % 6) * 28;
    w.x = clamp(Math.round((L.width - w.width) / 2) - 70 + step, 8, L.width - w.width - 8);
    w.y = clamp(Math.round((L.height - w.height) / 2) - (phone ? 0 : 50) + step, 8, L.height - w.height - 8);
    this.place(w);

    this.layer.append(w.el);
    this.taskbar.append(w.task);
    this.wins.push(w);
    if (frameless) {
      w.width = w.el.offsetWidth;
      w.height = w.el.offsetHeight;
      w.x = clamp(Math.round((L.width - w.width) / 2) + 60 - step, 8, L.width - w.width - 8);
      w.y = clamp(Math.round((L.height - w.height) / 2) - 40 + step, 8, L.height - w.height - 8);
      this.place(w);
      body.querySelectorAll('[data-drag]').forEach((handle) => this.dragging(w, handle));
    } else {
      this.dragging(w, bar);
      this.resizing(w, grip);
    }
    w.el.addEventListener('pointerdown', () => this.focus(w), true);
    this.focus(w);
    return w;
  }

  place(w) {
    Object.assign(w.el.style, { left: `${w.x}px`, top: `${w.y}px` });
    if (!w.frameless) Object.assign(w.el.style, { width: `${w.width}px`, height: `${w.height}px` });
  }

  focus(w) {
    if (w.min) {
      w.min = false;
      w.el.hidden = false;
    }
    for (const o of this.wins) {
      o.el.classList.toggle('active', o === w);
      o.task.classList.toggle('active', o === w);
      o.task.classList.toggle('minimized', o.min);
    }
    if (w.el.style.zIndex != this.z) w.el.style.zIndex = ++this.z;
    if (!w.el.contains(document.activeElement)) w.el.focus({ preventScroll: true });
  }

  focusTop() {
    const top = this.wins.filter((o) => !o.min).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    if (top) this.focus(top);
    else for (const o of this.wins) {
      o.el.classList.remove('active');
      o.task.classList.remove('active');
      o.task.classList.toggle('minimized', o.min);
    }
  }

  minimize(w) {
    w.min = true;
    w.el.hidden = true;
    this.focusTop();
  }

  taskClick(w) {
    if (w.min || !w.el.classList.contains('active')) this.focus(w);
    else this.minimize(w);
  }

  toggleMax(w, force) {
    w.max = force ?? !w.max;
    w.el.classList.toggle('max', w.max);
    const label = w.max ? 'Restore' : 'Maximize';
    w.maxBtn.replaceChildren(glyph(w.max ? 'restore' : 'max'));
    w.maxBtn.title = label;
    w.maxBtn.setAttribute('aria-label', label);
  }

  close(w) {
    w.el.remove();
    w.task.remove();
    this.wins = this.wins.filter((o) => o !== w);
    w.onClose?.();
    this.focusTop();
  }

  // Plasma's "Peek at desktop": hide everything, or bring it all back.
  peek() {
    const visible = this.wins.filter((o) => !o.min);
    if (visible.length) {
      this.peeked = visible;
      visible.forEach((o) => this.minimize(o));
    } else {
      (this.peeked ?? []).filter((o) => this.wins.includes(o)).forEach((o) => this.focus(o));
      this.peeked = null;
    }
  }

  dragging(w, bar) {
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input')) return;
      const L = this.layer.getBoundingClientRect();
      const sx = e.clientX;
      const sy = e.clientY;
      let ox = sx - L.left - w.x;
      let oy = sy - L.top - w.y;
      let moved = false;
      bar.setPointerCapture(e.pointerId);

      const move = (ev) => {
        if (!moved) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
          moved = true;
          w.el.classList.add('moving');
          if (w.max) {
            // Like KWin: un-maximise and keep the grab point under the cursor.
            const ratio = (sx - L.left) / L.width;
            this.toggleMax(w, false);
            ox = Math.round(w.width * ratio);
            oy = 16;
          }
        }
        w.x = Math.round(clamp(ev.clientX - L.left - ox, 48 - w.width, L.width - 48));
        w.y = Math.round(clamp(ev.clientY - L.top - oy, 0, L.height - 32));
        this.place(w);
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
        w.el.classList.remove('moving');
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
  }

  resizing(w, grip) {
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || w.max) return;
      e.preventDefault();
      const sx = e.clientX;
      const sy = e.clientY;
      const sw = w.width;
      const sh = w.height;
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        w.width = Math.max(300, sw + ev.clientX - sx);
        w.height = Math.max(200, sh + ev.clientY - sy);
        this.place(w);
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

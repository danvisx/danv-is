// Procedural isometric pixel-art sky islands, painted at low resolution and
// scaled up with nearest-neighbour sampling. Same seed, same picture.

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
};

const hash = (a, b, c, d) => {
  let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791) ^ Math.imul(d, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

const LAND = {
  water: ['#3b9be0', '#2a7cc0', '#1f5f99'],
  deep: ['#2a7cc0', '#2a7cc0', '#1f5f99'],
  sand: ['#f1d58a', '#d9b25f', '#b98d44'],
  grass: ['#6cc24a', '#4f9f35', '#3a7f28'],
  farm: ['#8cbf45', '#4f9f35', '#3a7f28'],
  path: ['#d1ad74', '#a8824e', '#8a6a3c'],
  rock: ['#9aa3ab', '#7b848c', '#5d656c'],
  snow: ['#f4f8fb', '#cfdae3', '#a6b5c2'],
  dirt: ['#8a5a3b', '#6e452b'],
  under: ['#6e452b', '#5d5450', '#45464d', '#2f3238'],
  stone: '#3f444a',
  grass2: '#7fd457',
  crop: '#e8c95a',
  leaf: '#3f9c3a',
  leafDark: '#2b7428',
  pine: '#2f8a4a',
  pineDark: '#1f6436',
  trunk: '#6b4226',
  roof: '#d9534f',
  roofDark: '#a8322f',
  wall: '#f3e7cf',
  window: '#3d5a80',
  flower: ['#ff6b8b', '#ffd23f', '#ffffff', '#b07cff'],
  boat: '#8a5a3b',
  sail: '#fcfcfc',
  plank: '#9a6a40',
  foam: '#f0faff',
  fall: ['#a8dcff', '#62b6f0'],
  beacon: '#fcfcfc',
  stripe: '#d9534f',
  slate: '#3b3b52',
  blade: '#ead8ac',
  hub: '#5b3a24',
  castle: ['#b3b5bc', '#868a93'],
  flag: '#d9534f',
  vine: '#3a7f28',
  crystal: '#7fe3ff',
  road: ['#55585f', '#7a7d84', '#5f626a'],
  lane: '#d8d2b8',
  lamp: '#ffd75e',
  car: ['#d9534f', '#3daee9', '#f3e7cf', '#fdbc4b', '#27ae60'],
  // [left face, right face, roof, window]
  facades: [
    ['#c9c3b6', '#a39d91', '#8d877c', '#3d4f66'],
    ['#b5654a', '#8f4c37', '#6e3b2c', '#2d3a4a'],
    ['#7fb3dc', '#5a8fbd', '#3a5f80', '#c4e3f7'],
    ['#5b6070', '#454957', '#353844', '#232733'],
    ['#e8dcc0', '#c4b896', '#9c9070', '#3d4f66'],
  ],
};

// sky: [top, middle, bottom]. The middle colour fills most of the screen so
// desktop text always sits on a flat background.
const THEMES = [
  {
    name: 'day',
    sky: ['#4f9de0', '#7fbfeb', '#b9e0f5'],
    tint: null,
    stars: 0,
    orb: { at: [0.82, 0.14], r: 8, color: '#fff6c2', glow: '#ffe98a' },
    clouds: ['#ffffff', '#d6ecfa'],
    birds: true,
  },
  {
    name: 'sunset',
    sky: ['#3a2152', '#a3466d', '#f39060'],
    tint: ['#ff8a5c', 0.2],
    stars: 30,
    orb: { at: [0.2, 0.7], r: 12, color: '#ffe0a0', glow: '#ff9f6b' },
    clouds: ['#f6a38a', '#b8577a'],
  },
  {
    name: 'night',
    sky: ['#05081a', '#0f1a40', '#1c2c5e'],
    tint: ['#1a2a6c', 0.5],
    stars: 170,
    orb: { at: [0.8, 0.16], r: 7, color: '#eef3ff', glow: '#5c74b8', moon: true },
    clouds: ['#2c3c70', '#1f2c56'],
    lit: true,
  },
  {
    name: 'dawn',
    sky: ['#3b4f8c', '#9585bb', '#f2b8c2'],
    tint: ['#c792c9', 0.15],
    stars: 12,
    orb: { at: [0.74, 0.68], r: 10, color: '#fff1d6', glow: '#ffc4a8' },
    clouds: ['#fde2e4', '#c7a3c9'],
  },
];

function tinted(theme) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    return theme.tint ? mix(v, theme.tint[0], theme.tint[1]) : v;
  };
  const out = {};
  for (const [k, v] of Object.entries(LAND)) out[k] = walk(v);
  if (theme.lit) {
    out.window = '#ffd75e';
    out.beacon = '#ffe680';
  }
  return out;
}

function valueNoise(rnd, g) {
  const v = Array.from({ length: (g + 1) * (g + 1) }, rnd);
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.min(g - 1, Math.floor(x));
    const yi = Math.min(g - 1, Math.floor(y));
    const xf = s(x - xi);
    const yf = s(y - yi);
    const a = v[yi * (g + 1) + xi];
    const b = v[yi * (g + 1) + xi + 1];
    const c = v[(yi + 1) * (g + 1) + xi];
    const d = v[(yi + 1) * (g + 1) + xi + 1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

const SPRITES = {
  pine: ['...g...', '..ggg..', '..gGg..', '.ggGgg.', '.gggGg.', 'ggGgggg', 'gggggGg', '...t...', '...t...'],
  tree: ['..ggg..', '.gGggg.', 'gGggggg', 'ggggggg', 'gggggGg', '.ggggg.', '...t...', '...t...'],
  bush: ['.ggg.', 'ggGgg', 'gGggg'],
  palm: ['gg...gg', '.ggggg.', 'gg.t.gg', 'g..t..g', '...t...', '...t...', '....t..', '....t..'],
  house: ['...rrr...', '..rrrrr..', '.rrrrrrr.', 'RRRRRRRRR', '.wwwwwww.', '.wwdwwWw.', '.wwdwwww.', '.wwwwwww.'],
  boulder: ['.rrr.', 'rrrRr', 'rRRRR'],
  boat: ['..s...', '..ss..', '..sss.', 'bbbbbb', '.bbbb.'],
  lighthouse: ['..lll..', '.kkkkk.', '..www..', '..rrr..', '..www..', '..rrr..', '.wwwww.', '.rrrrr.', '.wwwww.', '.rrrrr.', 'wwwwwww', 'sssssss'],
  windmill: ['x.......x', '.x.....x.', '..x...x..', '...xox...', '...oxo...', '..xwwwx..', '.x.www.x.', 'x..www..x', '...www...', '..wwwww..', '..wwdww..', '..wwdww..'],
  castle: ['....f....', '....ff...', '....f....', 's.s.s.s.s', 'sssssssss', '.sssssSs.', '.sWssSSs.', '.sssssSs.', '.sssWsSs.', '.sssssSs.', '.ssdddSs.', '.ssdddSs.'],
};

function sprite(g, map, ax, ay, pal) {
  const x0 = ax - Math.floor(map[0].length / 2);
  const y0 = ay - map.length + 1;
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(x0 + x, y0 + y, 1, 1);
    }
  });
}

function cloud(g, rnd, cx, cy, colors, size = 1) {
  const puffs = 3 + Math.floor(rnd() * 4);
  const base = Math.floor((6 + rnd() * 6) * size);
  for (let p = 0; p < puffs; p++) {
    const px = cx + (p - puffs / 2) * base * 0.9 + Math.floor(rnd() * 4);
    const pr = base * (0.6 + rnd() * 0.6);
    g.fillStyle = colors[0];
    for (let y = -pr; y <= 0; y++) {
      const hw = Math.floor(Math.sqrt(pr * pr - y * y) * 1.6);
      g.fillRect(Math.round(px - hw), Math.round(cy + y), hw * 2, 1);
    }
  }
  g.fillStyle = colors[1];
  g.fillRect(Math.round(cx - (puffs / 2) * base * 1.3), cy + 1, Math.round(puffs * base * 1.5), 2);
}

function paintSky(g, W, H, theme, rnd) {
  const img = g.createImageData(W, H);
  const [top, mid, bottom] = theme.sky.map(hex2rgb);
  for (let y = 0; y < H; y++) {
    const t = y / H;
    let a = mid;
    let b = mid;
    let f = 0;
    if (t < 0.12) {
      a = top;
      f = t / 0.12;
    } else if (t > 0.84) {
      b = bottom;
      f = (t - 0.84) / 0.16;
    }
    for (let x = 0; x < W; x++) {
      const c = f > bayer(x, y) ? b : a;
      const i = (y * W + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  for (let i = 0; i < theme.stars; i++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * H * 0.7);
    g.fillStyle = rnd() < 0.3 ? '#ffe9a8' : '#ffffff';
    g.fillRect(x, y, 1, 1);
    if (rnd() < 0.08) {
      g.globalAlpha = 0.6;
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x, y - 1, 1, 3);
      g.globalAlpha = 1;
    }
  }

  const { at, r, color, glow, moon } = theme.orb;
  const ox = Math.round(W * at[0]);
  const oy = Math.round(H * at[1]);
  for (let y = -r - 4; y <= r + 4; y++) {
    for (let x = -r - 4; x <= r + 4; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) g.fillStyle = color;
      else if (d <= r + 4 && (x + y) % 2 === 0 && d - r < 2 + ((x * 7 + y * 3) & 1)) g.fillStyle = glow;
      else continue;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  if (moon) {
    g.fillStyle = mix(color, '#7d8bb8', 0.35);
    for (const [cx, cy, cr] of [[-2, -2, 2], [3, 1, 1], [-1, 3, 1]]) g.fillRect(ox + cx, oy + cy, cr, cr);
  }

  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) cloud(g, rnd, Math.floor(rnd() * W), Math.floor(H * (0.06 + rnd() * 0.3)), theme.clouds);

  if (theme.birds) {
    g.fillStyle = '#2b3a55';
    for (let i = 0; i < 6; i++) {
      const bx = Math.floor(W * (0.15 + rnd() * 0.6));
      const by = Math.floor(H * (0.08 + rnd() * 0.2));
      g.fillRect(bx - 2, by - 1, 1, 1);
      g.fillRect(bx - 1, by, 1, 1);
      g.fillRect(bx + 1, by, 1, 1);
      g.fillRect(bx + 2, by - 1, 1, 1);
    }
  }
}

// ── Terrain ────────────────────────────────────────────────────────────────
const SEA = 0.34;
const MAXL = 9;
const SLAB = 10;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function terrain(rnd, N, islet) {
  const n1 = valueNoise(rnd, 3);
  const n2 = valueNoise(rnd, 6);
  const n3 = valueNoise(rnd, 12);
  const ox = (rnd() - 0.5) * 0.2;
  const oy = (rnd() - 0.5) * 0.2;
  const L = [];
  const mat = [];
  const deco = [];
  for (let i = 0; i < N; i++) {
    L.push([]);
    mat.push([]);
    deco.push([]);
    for (let j = 0; j < N; j++) {
      const u = i / (N - 1);
      const v = j / (N - 1);
      const n = 0.55 * n1(u * 3, v * 3) + 0.3 * n2(u * 6, v * 6) + 0.15 * n3(u * 12, v * 12);
      const d = Math.hypot(u - 0.5 - ox, v - 0.5 - oy) * 2;
      let h;
      let m;
      if (islet) {
        h = d > 1.05 ? null : 1 + Math.floor(n * 3 * (1.2 - d));
        m = h == null ? null : h <= 1 ? 'sand' : 'grass';
      } else {
        const e = n * 0.95 + 0.42 - Math.pow(d, 1.6) * 0.9;
        h = e < SEA ? (e < SEA - 0.2 ? null : 0) : Math.min(MAXL, 1 + Math.floor((e - SEA) * 13));
        m = h == null ? null : h === 0 ? (e < SEA - 0.12 ? 'deep' : 'water') : h === 1 ? 'sand' : h <= 5 ? 'grass' : h <= 7 ? 'rock' : 'snow';
      }
      L[i].push(h);
      mat[i].push(m);
      deco[i].push(null);
    }
  }
  return { N, L, mat, deco };
}

// A city block grid: roads every few tiles, towers rising toward a downtown
// core, the odd park, and a harbour ring of water around the edge.
function cityTerrain(rnd, N) {
  const n1 = valueNoise(rnd, 4);
  const ox = (rnd() - 0.5) * 0.15;
  const oy = (rnd() - 0.5) * 0.15;
  const cu = 0.5 + (rnd() - 0.5) * 0.3;
  const cv = 0.5 + (rnd() - 0.5) * 0.3;
  const step = 3 + (rnd() < 0.5 ? 1 : 0);
  const offI = Math.floor(rnd() * step);
  const offJ = Math.floor(rnd() * step);
  const onRoad = (k, off) => (((k - off) % step) + step) % step === 0;
  const L = [];
  const mat = [];
  const deco = [];
  const b = [];
  let tallest = null;
  for (let i = 0; i < N; i++) {
    L.push([]);
    mat.push([]);
    deco.push([]);
    b.push([]);
    for (let j = 0; j < N; j++) {
      const u = i / (N - 1);
      const v = j / (N - 1);
      const d = Math.hypot(u - 0.5 - ox, v - 0.5 - oy) * 2 + (n1(u * 4, v * 4) - 0.5) * 0.35;
      let h = 1;
      let m = 'road';
      let bld = null;
      if (d > 1.02) {
        h = null;
        m = null;
      } else if (d > 0.86) {
        h = 0;
        m = d > 0.95 ? 'deep' : 'water';
      } else if (!onRoad(i, offI) && !onRoad(j, offJ)) {
        if (rnd() < 0.12) {
          m = 'grass';
        } else {
          const dc = Math.hypot(u - cu, v - cv) * 2;
          const floors = Math.max(1, Math.round(Math.pow(Math.max(0, 1 - dc), 1.6) * 16 * (0.45 + rnd() * 0.75)) + (rnd() < 0.3 ? 1 : 0));
          h = 1 + floors;
          m = 'bldg';
          const f = floors >= 9 && rnd() < 0.6 ? 2 : Math.floor(rnd() * LAND.facades.length);
          bld = { f, lit: 0.25 + rnd() * 0.5, floors, roof: floors >= 5 && rnd() < 0.45 };
          if (!tallest || h > L[tallest[0]][tallest[1]]) tallest = [i, j];
        }
      }
      L[i].push(h);
      mat[i].push(m);
      deco[i].push(null);
      b[i].push(bld);
    }
  }
  if (tallest) b[tallest[0]][tallest[1]].antenna = true;
  return { N, L, mat, deco, b };
}

function features(isl, rnd, full) {
  const { N, L, mat, deco } = isl;
  const at = (i, j) => (i >= 0 && j >= 0 && i < N && j < N ? L[i][j] : null);
  const matAt = (i, j) => mat[i]?.[j] ?? null;
  const tiles = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (L[i][j] != null) tiles.push([i, j]);
  const pick = (list) => list[Math.floor(rnd() * list.length)];

  if (full) {
    // A village on flat lowland, ringed by fields with a windmill.
    const flat = tiles.filter(([i, j]) => mat[i][j] === 'grass' && L[i][j] <= 3 &&
      DIRS.every(([a, b]) => matAt(i + a, j + b) === 'grass' && Math.abs(L[i + a][j + b] - L[i][j]) <= 1));
    if (flat.length) {
      const [ci, cj] = pick(flat);
      for (const [i, j] of tiles) {
        if (mat[i][j] !== 'grass' || L[i][j] > 4) continue;
        const d = Math.hypot(i - ci, j - cj);
        if (d <= 2.3) {
          if (rnd() < 0.5) deco[i][j] = 'house';
          else mat[i][j] = 'path';
        } else if (d <= 4.6 && L[i][j] <= 3 && rnd() < 0.65) {
          mat[i][j] = 'farm';
        }
      }
      const farms = tiles.filter(([i, j]) => mat[i][j] === 'farm');
      if (farms.length) {
        const [i, j] = pick(farms);
        deco[i][j] = 'windmill';
      }
    }

    // A castle on the highest hill that isn't snowed in.
    let top = null;
    for (const [i, j] of tiles) {
      if ((mat[i][j] === 'grass' || mat[i][j] === 'rock') && !deco[i][j] && (!top || L[i][j] > L[top[0]][top[1]])) top = [i, j];
    }
    if (top && L[top[0]][top[1]] >= 3) deco[top[0]][top[1]] = 'castle';

    // A lighthouse on the front coast, and a couple of docks.
    const coast = tiles.filter(([i, j]) => mat[i][j] === 'sand' && i + j >= N - 2 && DIRS.some(([a, b]) => at(i + a, j + b) === 0));
    if (coast.length) {
      const [i, j] = pick(coast);
      deco[i][j] = 'lighthouse';
    }
    const shore = tiles.filter(([i, j]) => L[i][j] === 0 && DIRS.some(([a, b]) => matAt(i + a, j + b) === 'sand'));
    for (let k = 0; k < 2 && shore.length; k++) {
      const [i, j] = shore.splice(Math.floor(rnd() * shore.length), 1)[0];
      deco[i][j] = 'dock';
    }
  }

  for (const [i, j] of tiles) {
    if (deco[i][j]) continue;
    const r = rnd();
    const m = mat[i][j];
    if (m === 'grass') deco[i][j] = r < 0.16 ? (L[i][j] >= 4 || rnd() < 0.4 ? 'pine' : 'tree') : r < 0.25 ? 'bush' : r < 0.36 ? 'flowers' : null;
    else if (m === 'rock') deco[i][j] = r < 0.15 ? 'boulder' : r < 0.22 ? 'pine' : null;
    else if (m === 'snow') deco[i][j] = r < 0.14 ? 'snowpine' : null;
    else if (m === 'sand') deco[i][j] = r < 0.07 ? 'palm' : null;
    else if (m === 'deep') deco[i][j] = r < 0.03 ? 'boat' : null;
  }
}

// ── Drawing ────────────────────────────────────────────────────────────────
function drawIsland(g, isl, X0, Y0, pal, rnd, lit) {
  const { N, L, mat, deco } = isl;
  const at = (i, j) => (i >= 0 && j >= 0 && i < N && j < N ? L[i][j] : null);
  const under = new Map();
  const falls = [];
  const beams = [];
  const vines = [];

  for (let s = 0; s <= 2 * (N - 1); s++) {
    for (let i = Math.max(0, s - N + 1); i <= Math.min(N - 1, s); i++) {
      const j = s - i;
      const lv = L[i][j];
      if (lv == null) continue;
      const m = mat[i][j];
      const bld = isl.b?.[i][j];
      const facade = bld && pal.facades[bld.f];
      const [topC, sideL, sideR] = facade ?? pal[m];
      const cx = X0 + (i - j) * 8;
      const ty = Y0 + (i + j) * 4 - lv * 4;
      const sideH = lv * 4 + SLAB;
      const wet = lv === 0;
      const openL = at(i, j + 1) == null;
      const openR = at(i + 1, j) == null;

      for (let dx = 0; dx < 16; dx++) {
        const x = cx - 8 + dx;
        const c = dx < 8 ? 7 - dx : dx - 8;
        const r0 = c >> 1;
        const r1 = 8 - r0;
        const left = dx < 8;
        const sy = ty + r1;

        // Side: material lip, then dirt, then bedrock.
        if (wet) {
          g.fillStyle = left ? pal.deep[1] : pal.deep[2];
          g.fillRect(x, sy, 1, sideH - 3);
        } else if (bld) {
          const fh = (lv - 1) * 4;
          g.fillStyle = left ? sideL : sideR;
          g.fillRect(x, sy, 1, fh);
          const k = left ? dx : dx - 8;
          if (k % 3 !== 0) {
            for (let fy = 1; fy + 2 < fh; fy += 4) {
              const on = lit && hash(i * 31 + j, fy, Math.floor(k / 3), left ? 1 : 2) < bld.lit;
              g.fillStyle = on ? pal.lamp : left ? facade[3] : mix(facade[3], '#000000', 0.2);
              g.fillRect(x, sy + fy, 1, 2);
            }
          }
          g.fillStyle = left ? pal.road[1] : pal.road[2];
          g.fillRect(x, sy + fh, 1, 2);
          g.fillStyle = left ? pal.dirt[0] : pal.dirt[1];
          g.fillRect(x, sy + fh + 2, 1, sideH - fh - 5);
        } else {
          g.fillStyle = left ? sideL : sideR;
          g.fillRect(x, sy, 1, 2);
          g.fillStyle = left ? pal.dirt[0] : pal.dirt[1];
          g.fillRect(x, sy + 2, 1, sideH - 5);
        }
        g.fillStyle = pal.stone;
        g.fillRect(x, sy + sideH - 3, 1, 3);
        if (left ? openL : openR) {
          const bottom = sy + sideH;
          under.set(x, Math.max(under.get(x) ?? -Infinity, bottom));
          if (!wet && (m === 'grass' || m === 'farm') && rnd() < 0.12) vines.push([x, sy + 2, bottom]);
        }

        // Top, with a highlight where the tile behind is lower or missing.
        g.fillStyle = topC;
        g.fillRect(x, ty + r0, 1, r1 - r0);
        if (m === 'farm') {
          g.fillStyle = pal.crop;
          for (let y = ty + r0; y < ty + r1; y++) if ((((x + 2 * y) % 4) + 4) % 4 === 0) g.fillRect(x, y, 1, 1);
        }
        const behind = left ? at(i - 1, j) : at(i, j - 1);
        if (behind == null || behind < lv) {
          g.fillStyle = mix(topC, '#ffffff', 0.35);
          g.fillRect(x, ty + r0, 1, 1);
        }
      }

      if (wet && (openL || openR) && rnd() < 0.5) falls.push({ cx, ty, left: openL && (!openR || rnd() < 0.5) });

      const mx = cx;
      const my = ty + 4;
      if (m === 'grass') {
        g.fillStyle = pal.grass2;
        for (let k = 0; k < 3; k++) g.fillRect(mx - 5 + Math.floor(rnd() * 10), ty + 2 + Math.floor(rnd() * 4), 1, 1);
      }
      if (m === 'road') {
        g.fillStyle = pal.lane;
        g.fillRect(mx, ty + 4, 2, 1);
        if (rnd() < 0.25) {
          g.fillStyle = pal.car[Math.floor(rnd() * pal.car.length)];
          const carX = mx - 5 + Math.floor(rnd() * 7);
          const carY = ty + 2 + Math.floor(rnd() * 3);
          g.fillRect(carX, carY, 3, 2);
          g.fillStyle = lit ? pal.lamp : '#20242a';
          g.fillRect(carX + (rnd() < 0.5 ? 0 : 2), carY, 1, 1);
        }
        if (rnd() < 0.3) {
          g.fillStyle = pal.stone;
          g.fillRect(mx - 6, ty + 1, 1, 3);
          g.fillStyle = lit ? pal.lamp : pal.castle[0];
          g.fillRect(mx - 6, ty, 1, 1);
        }
      }
      if (bld?.roof) {
        g.fillStyle = pal.castle[1];
        g.fillRect(mx - 2, ty + 2, 4, 2);
        g.fillStyle = pal.castle[0];
        g.fillRect(mx - 2, ty + 1, 4, 1);
      }
      if (bld?.antenna) {
        g.fillStyle = pal.castle[0];
        g.fillRect(mx, ty - 6, 1, 10);
        g.fillStyle = '#ff3b3b';
        g.fillRect(mx, ty - 7, 1, 1);
      }
      if (wet && rnd() < 0.25) {
        g.fillStyle = mix(topC, '#ffffff', 0.5);
        g.fillRect(mx - 4 + Math.floor(rnd() * 6), ty + 2 + Math.floor(rnd() * 4), 2, 1);
      }

      switch (deco[i][j]) {
        case 'pine':
          sprite(g, SPRITES.pine, mx, my, { g: pal.pine, G: pal.pineDark, t: pal.trunk });
          break;
        case 'snowpine':
          sprite(g, SPRITES.pine, mx, my, { g: pal.pineDark, G: pal.snow[0], t: pal.trunk });
          break;
        case 'tree':
          sprite(g, SPRITES.tree, mx, my, { g: pal.leaf, G: pal.leafDark, t: pal.trunk });
          break;
        case 'bush':
          sprite(g, SPRITES.bush, mx + Math.floor(rnd() * 5) - 2, my, { g: pal.leaf, G: pal.leafDark });
          break;
        case 'palm':
          sprite(g, SPRITES.palm, mx, my, { g: pal.leaf, t: pal.trunk });
          break;
        case 'flowers':
          for (let k = 0; k < 4; k++) {
            g.fillStyle = pal.flower[Math.floor(rnd() * pal.flower.length)];
            g.fillRect(mx - 4 + Math.floor(rnd() * 8), ty + 2 + Math.floor(rnd() * 4), 1, 1);
          }
          break;
        case 'boulder':
          sprite(g, SPRITES.boulder, mx, my, { r: pal.rock[1], R: pal.rock[2] });
          break;
        case 'house':
          sprite(g, SPRITES.house, mx, my + 1, { r: pal.roof, R: pal.roofDark, w: pal.wall, d: pal.trunk, W: pal.window });
          break;
        case 'windmill':
          sprite(g, SPRITES.windmill, mx, my + 1, { x: pal.blade, o: pal.hub, w: pal.wall, d: pal.trunk });
          break;
        case 'castle':
          sprite(g, SPRITES.castle, mx, my + 1, { s: pal.castle[0], S: pal.castle[1], W: pal.window, d: pal.hub, f: pal.flag });
          break;
        case 'lighthouse':
          sprite(g, SPRITES.lighthouse, mx, my + 1, { l: pal.beacon, k: pal.slate, w: pal.wall, r: pal.stripe, s: pal.stone });
          if (lit) beams.push([mx, my - 10]);
          break;
        case 'dock':
          g.fillStyle = pal.plank;
          for (let t = 0; t < 8; t++) g.fillRect(mx - 7 + t, ty + 2 + (t >> 1), 2, 1);
          g.fillStyle = pal.hub;
          g.fillRect(mx - 7, ty + 3, 1, 2);
          g.fillRect(mx - 1, ty + 6, 1, 2);
          break;
        case 'boat':
          sprite(g, SPRITES.boat, mx, my + 1, { b: pal.boat, s: pal.sail });
          break;
      }
    }
  }

  // Jagged rock underside, longest under the middle.
  const xs = [...under.keys()].sort((a, b) => a - b);
  const len = new Map();
  if (xs.length) {
    const minX = xs[0];
    const maxX = xs[xs.length - 1];
    const mid = (minX + maxX) / 2;
    const half = (maxX - minX) / 2 + 1;
    const maxLen = Math.round(N * 2.4);
    const groups = new Map();
    for (const x of xs) {
      const k = Math.floor((x - minX) / 3);
      if (!groups.has(k)) groups.set(k, 0.55 + 0.45 * rnd());
      const shape = Math.pow(Math.max(0, 1 - Math.abs(x - mid) / half), 1.3);
      const l = Math.max(2, Math.round(shape * maxLen * groups.get(k)));
      len.set(x, l);
      const y0 = under.get(x);
      const side = x < mid;
      for (let y = 0; y < l; y++) {
        const depth = y / l;
        const band = y < 2 ? 0 : depth + 0.25 * (bayer(x, y) - 0.5) < 0.45 ? 1 : depth < 0.8 ? 2 : 3;
        g.fillStyle = band === 0 ? pal.dirt[side ? 0 : 1] : side || band === 3 ? pal.under[band] : mix(pal.under[band], '#000000', 0.15);
        g.fillRect(x, y0 + y, 1, 1);
      }
      if (lit && rnd() < 0.03) {
        g.fillStyle = pal.crystal;
        g.fillRect(x, y0 + 2 + Math.floor(rnd() * Math.max(1, l - 3)), 1, 2);
      }
    }
  }

  // Roots and vines hanging from grassy edges.
  for (const [x, , bottom] of vines) {
    g.fillStyle = pal.vine;
    const l = 3 + Math.floor(rnd() * 6);
    for (let y = 0; y < l; y++) if (y < l - 1 || rnd() < 0.5) g.fillRect(x, bottom - 2 + y, 1, 1);
  }

  // Waterfalls pouring off the edge and down past the underside.
  falls.sort(() => rnd() - 0.5).slice(0, 3).forEach(({ cx, ty, left }) => {
    const phase = Math.floor(rnd() * 6);
    for (let k = 0; k < 4; k++) {
      const dx = left ? 2 + k : 10 + k;
      const x = cx - 8 + dx;
      const c = dx < 8 ? 7 - dx : dx - 8;
      const yTop = ty + 8 - (c >> 1);
      const yEnd = (under.get(x) ?? yTop + SLAB) + (len.get(x) ?? 0) + 6 + Math.floor(rnd() * 10);
      for (let y = yTop; y < yEnd; y++) {
        if (yEnd - y < 8 && (x + y) % 2) continue;
        g.fillStyle = (y + x * 2 + phase) % 6 === 0 ? pal.foam : pal.fall[k % 2];
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = pal.foam;
      g.fillRect(x - 1 + Math.floor(rnd() * 3), yEnd + 1 + Math.floor(rnd() * 3), 1, 1);
    }
  });

  // Lighthouse beams at night.
  for (const [bx, by] of beams) {
    g.fillStyle = mix(pal.beacon, '#ffffff', 0.3);
    for (let d = 2; d < 34; d++) {
      const hw = Math.floor(d * 0.18);
      for (let y = -hw; y <= hw; y++) if ((d + y) % 2 === 0 && rnd() < 0.7 - d / 60) g.fillRect(bx - d, by + y + Math.floor(d / 6), 1, 1);
    }
  }
}

export function paintWallpaper(canvas, seed) {
  const scale = innerWidth < 700 ? 2 : 3;
  const W = Math.ceil(innerWidth / scale);
  const H = Math.ceil(innerHeight / scale);
  canvas.width = W;
  canvas.height = H;

  const rnd = mulberry32(seed);
  const theme = THEMES[Math.floor(rnd() * THEMES.length)];
  const pal = tinted(theme);
  const g = canvas.getContext('2d');
  paintSky(g, W, H, theme, rnd);

  const N = Math.max(8, Math.min(30, Math.floor(Math.min((W * (W < 300 ? 0.8 : 0.55)) / 16, (H * 0.66 - 50) / 8))));
  const city = rnd() < 0.5;
  const main = city ? cityTerrain(rnd, N) : terrain(rnd, N, false);
  features(main, rnd, !city);
  const peak = Math.max(...main.L.flat().filter((v) => v != null));
  const headroom = Math.max(0, peak - 7) * 2;
  const X0 = Math.round(W / 2);
  // On tall phone screens the note widget covers the upper middle, so the
  // island sits in the open space below it.
  const Y0 = H > W * 1.2
    ? Math.round(H * 0.72 - N * 4 + headroom)
    : Math.round((H - N * 8 - SLAB - N * 2.4) / 2 + 12 - H * 0.03 + headroom);

  // Two small islets drifting beside the main island, when there's room.
  if (W >= 300) {
    for (const [dir, dy] of [[-1, N * 0.8], [1, N * 6.2]]) {
      const n = 3 + Math.floor(rnd() * 3);
      const isl = terrain(rnd, n, true);
      features(isl, rnd, false);
      const x = Math.round(X0 + dir * (N * 8 * 0.85 + n * 8 + 4 + rnd() * 6));
      if (x - n * 8 < W * 0.1 || x + n * 8 > W * 0.95) continue;
      drawIsland(g, isl, x, Math.round(Y0 + dy), pal, rnd, theme.lit);
    }
  }

  drawIsland(g, main, X0, Y0, pal, rnd, theme.lit);

  // A couple of low clouds in front for depth.
  for (let i = 0; i < 2; i++) {
    cloud(g, rnd, Math.round(W * (i ? 0.72 + rnd() * 0.15 : 0.12 + rnd() * 0.15)), Math.round(H * (0.74 + rnd() * 0.08)), theme.clouds, 1.2);
  }
  return `${theme.name} ${city ? 'city' : 'island'}`;
}

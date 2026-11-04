import { SITE } from './config.js';

// All artwork is hand-drawn pixel maps. Colored icons are rasterised to
// data URLs; monochrome glyphs become crisp SVGs that follow currentColor.

function pixmap(rows, pal, scale = 1) {
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = rows.length * scale;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!pal[ch]) return;
      g.fillStyle = pal[ch];
      g.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return c.toDataURL();
}

function overlay(base, emblem, ox, oy) {
  const rows = base.map((r) => [...r]);
  emblem.forEach((r, y) => {
    [...r].forEach((ch, x) => {
      if (ch !== '.') rows[oy + y][ox + x] = ch;
    });
  });
  return rows.map((r) => r.join(''));
}

const FOLDER = [
  '................',
  '.kkkkkk.........',
  'kttttttk........',
  'kttttttkkkkkkkk.',
  'kttttttttttttttk',
  'kkkkkkkkkkkkkkkk',
  'kFFFFFFFFFFFFFFk',
  'kffffffffffffffk',
  'kffffffffffffffk',
  'kffffffffffffffk',
  'kffffffffffffffk',
  'kffffffffffffffk',
  'kffffffffffffffk',
  'kffffffffffffffk',
  'kddddddddddddddk',
  '.kkkkkkkkkkkkkk.',
];
const FOLDER_PAL = {
  k: '#0d2c40', t: '#1b7fbf', F: '#93d2f5', f: '#3daee9', d: '#2483bf',
  w: '#eaf6fd', e: '#14557d', y: '#fdbc4b',
};

const EMBLEM_HOME = ['...w...', '..www..', '.wwwww.', 'wwwwwww', '.wweww.', '.wweww.'];
const EMBLEM_BOOK = ['www.www', 'wew.wew', 'www.www', 'wew.wew', 'wwwewww'];
const EMBLEM_PICTURE = ['wwwwwww', 'wfffyyw', 'wfefffw', 'weeefew', 'wwwwwww'];
const EMBLEM_CODE = ['....w...', '.w..w.w.', 'w..w...w', '.w.w..w.', '...w....'];

const LINKEDIN = [
  '.kkkkkkkkkkkkkk.',
  'kLLLLLLLLLLLLLLk',
  'kLwwLLLLLLLLLLLk',
  'kLwwLLLLLLLLLLLk',
  'kLLLLLLLLLLLLLLk',
  'kLwwLwwwwwwLLLLk',
  'kLwwLwwLLLwwwLLk',
  'kLwwLwwLLLLwwLLk',
  'kLwwLwwLLLLwwLLk',
  'kLwwLwwLLLLwwLLk',
  'kLwwLwwLLLLwwLLk',
  'kLwwLwwLLLLwwLLk',
  'kLwwLwwLLLLwwLLk',
  'kLwwLwwLLLLwwLLk',
  'kLLLLLLLLLLLLLLk',
  '.kkkkkkkkkkkkkk.',
];

const MAIL = [
  '................',
  '................',
  'kkkkkkkkkkkkkkkk',
  'kgwwwwwwwwwwwwgk',
  'kwgwwwwwwwwwwgwk',
  'kwwgwwwwwwwwgwwk',
  'kwwwgwwwwwwgwwwk',
  'kwwwwgwwwwgwwwwk',
  'kwwwwwgwwgwwwwwk',
  'kwwwwgwggwgwwwwk',
  'kwwwgwwwwwwgwwwk',
  'kwwgwwwwwwwwgwwk',
  'kwgwwwwwwwwwwgwk',
  'kgwwwwwwwwwwwwgk',
  'kkkkkkkkkkkkkkkk',
  '................',
];

const FEDORA = [
  '.....kkkkkk.....',
  '...kkBBBBBBkk...',
  '..kBBBBBwwwBBk..',
  '.kBBBBBwBBBwBBk.',
  '.kBBBBBwBBBBBBk.',
  'kBBBBBBwBBBBBBBk',
  'kBBBBwwwwwBBBBBk',
  'kBBBBBBwBBBBBBBk',
  'kBBBBBBwBBBBBBBk',
  'kBBBBBBwBBBBBBBk',
  'kBwBBBBwBBBBBBBk',
  '.kBwBBBwBBBBBBk.',
  '.kBBwwwBBBBBBBk.',
  'kBBBBBBBBBBBBk..',
  'kBBBBBBBBBBkk...',
  'kkkkkkkkkkk.....',
];

const IMAGE = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kwwwwwwwwwwwwk.',
  '.kwssssssssyywk.',
  '.kwssssssssyywk.',
  '.kwsssssssssswk.',
  '.kwsssssmsssswk.',
  '.kwssssmmmssswk.',
  '.kwsmsmmmmmsswk.',
  '.kwmmmmmmmmmmwk.',
  '.kwMMMMMMMMMMwk.',
  '.kwMMMMMMMMMMwk.',
  '.kwwwwwwwwwwwwk.',
  '.kkkkkkkkkkkkkk.',
];

const BOOK = [
  '................',
  '..kkkkkkkkkkkk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrwwwwwwrrk..',
  '..kRrwwwwwwrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrrk..',
  '..kRrrrrrrrrrk..',
  '..kRwwwwwwwwwk..',
  '..kkkkkkkkkkkk..',
];

const EMBLEM_MUSIC = ['..wwwww', '..w...w', '..w...w', 'www.www', 'www.www'];

const PAGE = [
  '..kkkkkkkkk.....',
  '..kwwwwwwwkk....',
  '..kwwwwwwwkgk...',
  '..kwwwwwwwkggk..',
  '..kwwwwwwwkkkkk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kwwwwwwwwwwwk.',
  '..kkkkkkkkkkkkk.',
];
const EMBLEM_TEXT = ['bbbbbbb', '.......', 'ggggggggg', '.......', 'ggggggg', '.......', 'gggggggg', '.......', 'gggg'];
const EMBLEM_NOTE = ['...nnnnn', '...n...n', '...n...n', '...n...n', '.nnn.nnn', 'nnnn.nnn', '.nn...nn'];
const EMBLEM_PLAYLIST = ['n.gggggg', '........', 'n.gggggg', '........', 'n.ggg.o.', '.....oo.', '.....ooo', '.....oo.', '.....o..'];
const PAGE_PAL = { k: '#232629', w: '#fcfcfc', g: '#a1a9b1', b: '#3daee9', n: '#1d6f99', o: '#f67400' };

const AVATAR = [
  '......kkkk......',
  '....kkwwwwkk....',
  '...kwwwwwwwwk...',
  '...kwwwwwwwwk...',
  '..kwwwwwwwwwwk..',
  '..kwwwwwwwwwwk..',
  '...kwwwwwwwwk...',
  '...kwwwwwwwwk...',
  '....kkwwwwkk....',
  '......kkkk......',
  '...kkkkkkkkkk...',
  '..kwwwwwwwwwwk..',
  '.kwwwwwwwwwwwwk.',
  '.kwwwwwwwwwwwwk.',
  '.kwwwwwwwwwwwwk.',
  '.kkkkkkkkkkkkkk.',
];

const CURSOR = [
  'k...........',
  'kk..........',
  'kwk.........',
  'kwwk........',
  'kwwwk.......',
  'kwwwwk......',
  'kwwwwwk.....',
  'kwwwwwwk....',
  'kwwwwwwwk...',
  'kwwwwwwwwk..',
  'kwwwwwkkkkk.',
  'kwwkwwk.....',
  'kwk.kwwk....',
  'kk..kwwk....',
  'k....kwwk...',
  '.....kkk....',
];

const DINO_BODY = [
  '...........kkkkkkkk.',
  '..........kBBBBBBBBk',
  '..........kBwkBBBBBk',
  '..........kBkkBBBBBk',
  '..........kBBBBBBBBk',
  '..........kBBBBBkkkk',
  '.........LkBBBBBBBk.',
  'k.......LkBBBBkkkk..',
  'kk.....LkBBBBBk.....',
  'kBkL.LkBBBBBBBkkk...',
  'kBBkkkkBBBBBBBkBk...',
  '.kBBBBBBBBBBBBkk....',
  '..kbBBBBBBBBBk......',
  '...kbbBBBBBBk.......',
];
const DINO_LEGS = [
  ['....kbbk.kBBk.......', '....kBk...kBk.......', '....kBkk..kBkk......', '....kkk...kkk.......'],
  ['....kbk..kBBk.......', '...kBk....kBk.......', '..kBk.....kBkk......', '..kk......kkk.......'],
  ['....kbbk.kBk........', '....kBk..kBk........', '....kBkk.kBkk.......', '....kkk..kkk........'],
  ['....kbk..kBBk.......', '....kBk...kBk.......', '....kBkk...kBk......', '....kkk.....kk......'],
];
// Run cycle laid out left to right as one sprite sheet.
const DINO_SHEET = [...DINO_BODY, ...DINO_LEGS[0]].map((_, y) =>
  DINO_LEGS.map((legs) => [...DINO_BODY, ...legs][y]).join(''));

const TERMINAL = [
  '................',
  'kkkkkkkkkkkkkkkk',
  'kggggggggggggggk',
  'kkkkkkkkkkkkkkkk',
  'kddddddddddddddk',
  'kdGddddddddddddk',
  'kddGdddddddddddk',
  'kdddGddddddddddk',
  'kddGdddddddddddk',
  'kdGddddddGGGGddk',
  'kddddddddddddddk',
  'kddddddddddddddk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
];

const WINAMP = [
  '.eeeeeeeeeeeeee.',
  'edddddddkyyyykde',
  'eddddddkyyyyykde',
  'edddddkyyyyykdde',
  'eddddkyyyyyykdde',
  'eddddkoooookkdde',
  'edddkooooooookde',
  'eddkooooooookdde',
  'eddkoooooookddde',
  'edddkkrrrrkdddde',
  'eddddkrrrkddddde',
  'edddkrrrkdddddde',
  'edddkrrkddddddde',
  'edddkrkdddddddde',
  'eddddkddddddddde',
  '.eeeeeeeeeeeeee.',
];

const CODE = [
  '..........kLLkk.',
  '.........kALLLHk',
  '........kAALLLHH',
  '..k....kAAALLLHH',
  '.kBk..kAAAALLLHH',
  'kBBBkkAAAAkLLLHH',
  'kBBBBAAAAkkLLLHH',
  '.kBBBBAkk.kLLLHH',
  '.kABBBBkk.kLLLHH',
  'kAAAABBBBkkLLLHH',
  'kAAAkkBBBBkLLLHH',
  '.kAk..kBBBBLLLHH',
  '..k....kBBBLLLHH',
  '........kBBLLLHH',
  '.........kBLLLHk',
  '..........kLLkk.',
];


export const icons = {
  files: pixmap(overlay(FOLDER, EMBLEM_HOME, 4, 8), FOLDER_PAL),
  folder: pixmap(FOLDER, FOLDER_PAL),
  folderBooks: pixmap(overlay(FOLDER, EMBLEM_BOOK, 4, 8), FOLDER_PAL),
  folderPhotos: pixmap(overlay(FOLDER, EMBLEM_PICTURE, 4, 8), FOLDER_PAL),
  folderMusic: pixmap(overlay(FOLDER, EMBLEM_MUSIC, 4, 8), FOLDER_PAL),
  folderProjects: pixmap(overlay(FOLDER, EMBLEM_CODE, 4, 8), FOLDER_PAL),
  text: pixmap(overlay(PAGE, EMBLEM_TEXT, 4, 6), PAGE_PAL),
  audio: pixmap(overlay(PAGE, EMBLEM_NOTE, 4, 7), PAGE_PAL),
  playlist: pixmap(overlay(PAGE, EMBLEM_PLAYLIST, 4, 5), PAGE_PAL),
  linkedin: pixmap(LINKEDIN, { k: '#06335e', L: '#0a66c2', w: '#ffffff' }),
  mail: pixmap(MAIL, { k: '#232629', w: '#fcfcfc', g: '#7f8c8d' }),
  fedora: pixmap(FEDORA, { k: '#294172', B: '#51a2da', w: '#ffffff' }),
  image: pixmap(IMAGE, { k: '#232629', w: '#fcfcfc', s: '#7ec8f0', y: '#fdbc4b', m: '#27ae60', M: '#1e8449' }),
  book: pixmap(BOOK, { k: '#2b0f0f', R: '#7a1f1f', r: '#c0392b', w: '#f3e7cf' }),
  terminal: pixmap(TERMINAL, { k: '#5c636a', g: '#31363b', d: '#0f1113', G: '#3daee9' }),
  winamp: pixmap(WINAMP, { e: '#0b0b10', d: '#2b2b3d', k: '#141008', y: '#ffe84a', o: '#ffae1a', r: '#e86a00' }),
  code: pixmap(CODE, { k: '#0a2a4a', A: '#005f9e', B: '#007acc', L: '#249ae6', H: '#5cc0f5' }),
  avatar: SITE.avatar || pixmap(AVATAR, { k: '#1d6f99', w: '#3daee9' }),
};

const DINO_PAL = { k: '#294172', B: '#51a2da', b: '#3a7fb5', L: '#93d2f5', w: '#ffffff' };
export const dinoSheet = pixmap(DINO_SHEET, DINO_PAL);
export const dinoFrame = pixmap([...DINO_BODY, ...DINO_LEGS[0]], DINO_PAL);

export const cursorUrl =pixmap(CURSOR, { k: '#fcfcfc', w: '#232629' }, 2);

const GLYPHS = {
  min: ['........', '........', 'xx....xx', '.xx..xx.', '..xxxx..', '...xx...', '........', '........'],
  max: ['........', '........', '...xx...', '..xxxx..', '.xx..xx.', 'xx....xx', '........', '........'],
  restore: ['...xx...', '..xxxx..', '.xx..xx.', 'xx....xx', '.xx..xx.', '..xxxx..', '...xx...', '........'],
  close: ['xx....xx', 'xxx..xxx', '.xxxxxx.', '..xxxx..', '..xxxx..', '.xxxxxx.', 'xxx..xxx', 'xx....xx'],
  left: ['...x...', '..x....', '.x.....', 'xxxxxxx', '.x.....', '..x....', '...x...'],
  right: ['...x...', '....x..', '.....x.', 'xxxxxxx', '.....x.', '....x..', '...x...'],
  up: ['...x...', '..xxx..', '.x.x.x.', 'x..x..x', '...x...', '...x...', '...x...'],
  grid: ['xxx.xxx', 'xxx.xxx', 'xxx.xxx', '.......', 'xxx.xxx', 'xxx.xxx', 'xxx.xxx'],
  list: ['x.xxxxx', '.......', 'x.xxxxx', '.......', 'x.xxxxx', '.......', 'x.xxxxx'],
  search: ['.xxx...', 'x...x..', 'x...x..', 'x...x..', '.xxx...', '....xx.', '.....xx'],
  power: ['...x...', '.x.x.x.', 'x..x..x', 'x.....x', 'x.....x', '.x...x.', '..xxx..'],
  lock: ['..xxx..', '.x...x.', '.x...x.', 'xxxxxxx', 'xxx.xxx', 'xxx.xxx', 'xxxxxxx'],
  wifi: ['..xxxxx..', '.x.....x.', 'x..xxx..x', '..x...x..', '....x....'],
  volume: ['...x.....', '..xx..x..', 'xxxx...x.', 'xxxx.x.x.', 'xxxx...x.', '..xx..x..', '...x.....'],
  battery: ['xxxxxxxxxx..', 'x........x..', 'x.xxxxxx.xx.', 'x.xxxxxx.xx.', 'x.xxxxxx.xx.', 'x........x..', 'xxxxxxxxxx..'],
  send: ['xx......', 'xxxx....', 'xxxxxx..', 'xxxxxxxx', 'xxxxxx..', 'xxxx....', 'xx......'],
  download: ['...xx...', '...xx...', '.xxxxxx.', '..xxxx..', '...xx...', 'x......x', 'xxxxxxxx'],
  eye: ['..xxxx..', '.x....x.', 'x..xx..x', 'x..xx..x', '.x....x.', '..xxxx..'],
  code: ['..x..x..', '.x....x.', 'x......x', '.x....x.', '..x..x..'],
  external: ['....xxxx', '......xx', '.....x.x', 'x...x..x', 'x..x....', 'x.......', 'x.......', 'xxxxxx..'],
  trash: ['..xxxx..', 'xxxxxxxx', '.x....x.', '.x.xx.x.', '.x.xx.x.', '.x.xx.x.', '.x....x.', '..xxxx..'],
  wallpaper: ['xxxxxxxx', 'x......x', 'x...x..x', 'x..xxx.x', 'x.xxxxxx', 'xxxxxxxx'],
  star: ['...x...', '...x...', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', 'x.....x'],
  heart: ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
  home: ['...xx...', '..xxxx..', '.xxxxxx.', 'xxxxxxxx', '.xx..xx.', '.xx..xx.', '.xxxxxx.'],
  play: ['x......', 'xxx....', 'xxxxx..', 'xxxxxxx', 'xxxxx..', 'xxx....', 'x......'],
  pause: ['xx.xx', 'xx.xx', 'xx.xx', 'xx.xx', 'xx.xx', 'xx.xx', 'xx.xx'],
  stop: ['xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx', 'xxxxxx'],
  prev: ['x....x', 'x...xx', 'x..xxx', 'x.xxxx', 'x..xxx', 'x...xx', 'x....x'],
  next: ['x....x', 'xx...x', 'xxx..x', 'xxxx.x', 'xxx..x', 'xx...x', 'x....x'],
  eject: ['...x...', '..xxx..', '.xxxxx.', 'xxxxxxx', '.......', 'xxxxxxx'],
  files: ['xxxx....', 'x..xxxx.', 'x.....x.', 'x.xxxxxx', 'x.x....x', 'x.x....x', 'x.x....x', 'xxxxxxxx'],
  branch: ['x....x', 'x....x', 'x...x.', 'x..x..', 'xxx...', 'x.....', 'x.....'],
  refresh: ['..xxxx.x', '.x....xx', 'x....xxx', 'x.......', 'x......x', '.x....x.', '..xxxx..'],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function glyph(name, scale = 2) {
  const rows = GLYPHS[name];
  const w = Math.max(...rows.map((r) => r.length));
  let d = '';
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === 'x') d += `M${x} ${y}h1v1h-1z`;
  });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${rows.length}`);
  svg.setAttribute('width', w * scale);
  svg.setAttribute('height', rows.length * scale);
  svg.setAttribute('class', `glyph glyph-${name}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

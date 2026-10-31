#!/usr/bin/env node
// Rebuilds data/tracks.json from the audio files in music/.
//
//   npm run tracks
//
// Titles, artists, albums and track numbers come from ID3 tags when an MP3
// has them, otherwise from the file name. MP3 durations are worked out here
// so the playlist can show its total length before anything is played.
// Embedded cover art is saved once per distinct image in data/covers/.
// Order: by folder, then track number, then file name, so "01 - …" prefixes
// or one folder per album both work.

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, extname, basename, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MUSIC = join(ROOT, 'music');
const OUT = join(ROOT, 'data', 'tracks.json');
const COVERS = join(ROOT, 'data', 'covers');
const AUDIO = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.wav', '.webm']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (AUDIO.has(extname(e.name).toLowerCase())) files.push(full);
  }
  return files;
}

// ── ID3v2 (v2.3 / v2.4) text frames ──────────────────────────────────────
function syncsafe(b, i) {
  return (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];
}

function decodeText(bytes) {
  const enc = bytes[0];
  const body = bytes.subarray(1);
  let text;
  if (enc === 1 || enc === 2) {
    const le = enc === 1 ? !(body[0] === 0xfe && body[1] === 0xff) : false;
    const start = enc === 1 && ((body[0] === 0xff && body[1] === 0xfe) || (body[0] === 0xfe && body[1] === 0xff)) ? 2 : 0;
    text = new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(body.subarray(start));
  } else {
    text = new TextDecoder(enc === 3 ? 'utf-8' : 'latin1').decode(body);
  }
  return text.replace(/\0+$/, '').split('\0')[0].trim();
}

function readId3(buf) {
  const tags = {};
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return { tags, audioStart: 0 };
  const version = buf[3];
  const size = syncsafe(buf, 6);
  const end = Math.min(buf.length, 10 + size);
  let picture = null;
  let i = 10;
  if (buf[5] & 0x40) i += version === 4 ? syncsafe(buf, i) : buf.readUInt32BE(i) + 4; // extended header
  const WANT = { TIT2: 'title', TPE1: 'artist', TALB: 'album', TRCK: 'track' };
  while (i + 10 <= end) {
    const id = buf.toString('latin1', i, i + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const len = version === 4 ? syncsafe(buf, i + 4) : buf.readUInt32BE(i + 4);
    if (WANT[id] && len > 1) tags[WANT[id]] = decodeText(buf.subarray(i + 10, i + 10 + len));
    if (id === 'APIC' && !picture) picture = readPicture(buf.subarray(i + 10, i + 10 + len));
    i += 10 + len;
  }
  return { tags, picture, audioStart: 10 + size + (buf[5] & 0x10 ? 10 : 0) };
}

// APIC: encoding, MIME type\0, picture type, description\0, image bytes.
function readPicture(frame) {
  const enc = frame[0];
  let i = frame.indexOf(0, 1);
  if (i < 0) return null;
  const mime = frame.toString('latin1', 1, i) || 'image/jpeg';
  i += 2; // the null, then the picture type
  if (enc === 1 || enc === 2) {
    while (i + 1 < frame.length && (frame[i] || frame[i + 1])) i += 2;
    i += 2;
  } else {
    while (i < frame.length && frame[i]) i++;
    i += 1;
  }
  const data = frame.subarray(i);
  if (data.length < 64) return null;
  const ext = /png/i.test(mime) ? 'png' : 'jpg';
  return { data, ext };
}

// ── MP3 duration: Xing/Info/VBRI frame count, else constant-bitrate estimate
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function mp3Duration(buf, start) {
  let i = start;
  while (i + 4 < buf.length && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i++;
  if (i + 4 >= buf.length) return null;
  const ver = (buf[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layer = (buf[i + 1] >> 1) & 3; // 1 = Layer III
  const bitrate = BITRATES[ver === 3 ? 1 : 2][buf[i + 2] >> 4] * 1000;
  const rate = RATES[ver]?.[(buf[i + 2] >> 2) & 3];
  if (layer !== 1 || !bitrate || !rate) return null;
  const mono = buf[i + 3] >> 6 === 3;
  const samplesPerFrame = ver === 3 ? 1152 : 576;

  const sideInfo = ver === 3 ? (mono ? 17 : 32) : mono ? 9 : 17;
  const xing = i + 4 + sideInfo;
  const tag = buf.toString('latin1', xing, xing + 4);
  if ((tag === 'Xing' || tag === 'Info') && buf.readUInt32BE(xing + 4) & 1) {
    return (buf.readUInt32BE(xing + 8) * samplesPerFrame) / rate;
  }
  if (buf.toString('latin1', i + 36, i + 40) === 'VBRI') {
    return (buf.readUInt32BE(i + 36 + 14) * samplesPerFrame) / rate;
  }
  return ((buf.length - i) * 8) / bitrate;
}

const cleanName = (file) =>
  basename(file, extname(file))
    .replace(/[_]+/g, ' ')
    .replace(/^\s*\d{1,3}\s*[-.)]\s*/, '')
    .trim();

const files = await walk(MUSIC);
const tracks = [];
const covers = new Map();
await rm(COVERS, { recursive: true, force: true });
for (const file of files) {
  const rel = relative(ROOT, file).split(sep);
  const t = { url: rel.map(encodeURIComponent).join('/') };
  if (extname(file).toLowerCase() === '.mp3') {
    const buf = await readFile(file);
    const { tags, picture, audioStart } = readId3(buf);
    if (picture) {
      const key = `${createHash('sha1').update(picture.data).digest('hex').slice(0, 12)}.${picture.ext}`;
      if (!covers.has(key)) {
        await mkdir(COVERS, { recursive: true });
        await writeFile(join(COVERS, key), picture.data);
        covers.set(key, picture.data.length);
      }
      t.cover = `data/covers/${key}`;
    }
    const name = tags.title || cleanName(file);
    t.title = tags.artist ? `${tags.artist} - ${name}` : name;
    if (tags.album) t.album = tags.album;
    const n = parseInt(tags.track, 10);
    if (n) t.track = n;
    const d = mp3Duration(buf, audioStart);
    if (d) t.duration = Math.round(d);
  } else {
    t.title = cleanName(file);
  }
  t._dir = dirname(file);
  t._file = basename(file);
  tracks.push(t);
}

const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
tracks.sort((a, b) => byName(a._dir, b._dir) || (a.track ?? 1e9) - (b.track ?? 1e9) || byName(a._file, b._file));
for (const t of tracks) {
  delete t._dir;
  delete t._file;
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify({ tracks }, null, 2)}\n`);
const total = tracks.reduce((s, t) => s + (t.duration ?? 0), 0);
console.log(`✓ tracks.json: ${tracks.length} tracks, ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')} total`);
if (covers.size) console.log(`  ${covers.size} cover${covers.size === 1 ? '' : 's'} in data/covers/ (${[...covers.values()].map((n) => `${Math.round(n / 1024)} KiB`).join(', ')})`);
if (!files.length) console.log('  (music/ is empty: drop audio files in it and run this again)');

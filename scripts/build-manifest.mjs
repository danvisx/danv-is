#!/usr/bin/env node
// Writes data/source.json: the list of files this site is made of, so the
// Code window can show its own source. Browsers can fetch any file the site
// serves but can't list a folder, hence the manifest.
//
//   npm run manifest

import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'data', 'source.json');

// Never list these, even if they end up in the folder.
const SKIP = [/^\.git$/, /^node_modules$/, /^\.env/, /^\.DS_Store$/, /^\.wrangler$/, /^\.netlify$/, /\.log$/];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.some((re) => re.test(e.name))) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile()) out.push({ path: relative(ROOT, full).split(sep).join('/'), size: (await stat(full)).size });
  }
  return out;
}

// Served like any other file, just not listed in the Code window.
const HIDDEN = ['data/source.json', 'data/profile.json'];
const files = (await walk(ROOT)).filter((f) => !HIDDEN.includes(f.path));
files.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(OUT, `${JSON.stringify({ files }, null, 2)}\n`);
const kib = files.reduce((s, f) => s + f.size, 0) / 1024;
console.log(`✓ source.json: ${files.length} files, ${kib.toFixed(0)} KiB`);

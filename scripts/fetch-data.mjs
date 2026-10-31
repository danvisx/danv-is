#!/usr/bin/env node
// Pulls the "Read" shelf from Hardcover and Unsplash uploads into data/*.json.
// Both need a secret token, so the site serves these snapshots instead of
// calling the APIs from the browser.
//
//   HARDCOVER_TOKEN=hc_pat_… \
//   UNSPLASH_USERNAME=you UNSPLASH_ACCESS_KEY=xxx \
//   node scripts/fetch-data.mjs
//
// A source whose variables are missing is skipped and its file left as is.
// HARDCOVER_TOKEN is the personal access token from hardcover.app/account/api.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../data/', import.meta.url);
const UA = 'danv.is data refresh (+https://danv.is)';
const { HARDCOVER_TOKEN, UNSPLASH_USERNAME, UNSPLASH_ACCESS_KEY } = process.env;

const HC_READ = 3;
const HC_PUBLIC = 1;
const HC_QUERY = `query Read($limit: Int!, $offset: Int!) {
  me {
    user_books(
      where: { status_id: { _eq: ${HC_READ} }, privacy_setting_id: { _eq: ${HC_PUBLIC} } }
      order_by: [{ last_read_date: desc_nulls_last }, { date_added: desc }]
      limit: $limit
      offset: $offset
    ) {
      rating
      last_read_date
      first_read_date
      date_added
      review_raw
      edition { pages image { url } }
      book { id slug title pages release_year rating cached_contributors cached_image }
    }
  }
}`;

async function hardcover(token) {
  const auth = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  const books = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const res = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth, 'User-Agent': UA },
      body: JSON.stringify({ query: HC_QUERY, variables: { limit: 100, offset } }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || out.errors) throw new Error(`Hardcover ${res.status}: ${out.errors?.[0]?.message ?? res.statusText}`);
    const batch = out.data.me[0]?.user_books ?? [];
    for (const ub of batch) {
      const b = ub.book;
      const authors = (b.cached_contributors ?? []).filter((c) => !c.contribution || c.contribution === 'Author');
      books.push({
        id: String(b.id),
        title: b.title,
        author: (authors.length ? authors : b.cached_contributors ?? []).map((c) => c.author?.name).filter(Boolean).join(', '),
        cover: ub.edition?.image?.url ?? b.cached_image?.url ?? null,
        rating: ub.rating ?? 0,
        avgRating: b.rating ? b.rating.toFixed(2) : null,
        pages: ub.edition?.pages ?? b.pages ?? null,
        published: b.release_year ? String(b.release_year) : null,
        readAt: ub.last_read_date ?? ub.first_read_date ?? null,
        addedAt: ub.date_added ?? null,
        review: ub.review_raw?.trim() || null,
        url: `https://hardcover.app/books/${b.slug}`,
      });
    }
    if (batch.length < 100) break;
  }
  return books;
}

// Unsplash's photo list has the basics; camera, location, tags and view
// counts need one request per photo. Demo keys allow 50 requests an hour, so
// details are reused from the last run and topped up while budget remains,
// oldest first.
async function unsplash(username, key) {
  const headers = { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1', 'User-Agent': UA };
  let remaining = Infinity;
  const get = async (url) => {
    const res = await fetch(url, { headers });
    remaining = Number(res.headers.get('x-ratelimit-remaining') ?? remaining);
    if (!res.ok) throw new Error(`Unsplash ${res.status}: ${await res.text()}`);
    return res.json();
  };

  const listed = [];
  for (let page = 1; page <= 50; page++) {
    const batch = await get(`https://api.unsplash.com/users/${encodeURIComponent(username)}/photos?per_page=30&page=${page}&order_by=latest`);
    listed.push(...batch);
    if (batch.length < 30) break;
  }

  const previous = new Map((await readItems('photos.json')).map((p) => [p.id, p]));
  const photos = listed.map((p) => {
    const old = previous.get(p.id);
    return {
      id: p.id,
      description: p.description || p.alt_description || '',
      alt: p.alt_description || '',
      width: p.width,
      height: p.height,
      color: p.color,
      likes: p.likes,
      created: p.created_at,
      raw: p.urls.raw,
      regular: p.urls.regular,
      page: p.links.html,
      ...(old?.detailedAt && {
        exif: old.exif, location: old.location, tags: old.tags,
        views: old.views, downloads: old.downloads, detailedAt: old.detailedAt,
      }),
    };
  });

  const queue = [...photos].sort((a, b) => (a.detailedAt ?? '').localeCompare(b.detailedAt ?? ''));
  let detailed = 0;
  for (const photo of queue) {
    if (remaining <= 2) break;
    const d = await get(`https://api.unsplash.com/photos/${photo.id}`);
    const e = d.exif ?? {};
    const loc = d.location ?? {};
    Object.assign(photo, {
      exif: {
        camera: [e.make, e.model].filter(Boolean).join(' ').replace(/^(\S+) \1 /i, '$1 ') || null,
        exposure: e.exposure_time || null,
        aperture: e.aperture || null,
        focal: e.focal_length || null,
        iso: e.iso || null,
      },
      location: loc.name || [loc.city, loc.country].filter(Boolean).join(', ') || null,
      tags: (d.tags ?? []).map((t) => t.title).filter(Boolean),
      views: d.views ?? null,
      downloads: d.downloads ?? null,
      detailedAt: new Date().toISOString(),
    });
    detailed++;
  }
  const missing = photos.filter((p) => !p.detailedAt).length;
  console.log(`  unsplash: refreshed details for ${detailed} photos${missing ? `, ${missing} still waiting for rate-limit budget` : ''}`);
  return photos;
}

async function readItems(name) {
  try {
    return JSON.parse(await readFile(new URL(name, OUT), 'utf8')).items ?? [];
  } catch {
    return [];
  }
}

async function save(name, items) {
  await mkdir(OUT, { recursive: true });
  const body = JSON.stringify({ items }, null, 2);
  await writeFile(new URL(name, OUT), `${body}\n`);
  console.log(`✓ ${name}: ${items.length} items`);
}

let failed = false;
async function run(label, ready, job) {
  if (!ready) return console.log(`- ${label}: skipped (env vars not set)`);
  try {
    await job();
  } catch (err) {
    failed = true;
    console.error(`✗ ${label}: ${err.message}`);
  }
}

await run('hardcover', HARDCOVER_TOKEN, async () => save('books.json', await hardcover(HARDCOVER_TOKEN)));
await run('unsplash', UNSPLASH_USERNAME && UNSPLASH_ACCESS_KEY, async () =>
  save('photos.json', await unsplash(UNSPLASH_USERNAME, UNSPLASH_ACCESS_KEY)));

process.exitCode = failed ? 1 : 0;

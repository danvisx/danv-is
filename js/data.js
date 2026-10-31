// Lazy, cached loaders for the static data written by scripts/fetch-data.mjs.
const cache = {};

function load(key, url, parse = (r) => r.json()) {
  cache[key] ??= fetch(url, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return parse(r);
    })
    .catch((err) => {
      delete cache[key];
      throw err;
    });
  return cache[key];
}

export const loadBooks = () => load('books', 'data/books.json');
export const loadPhotos = () => load('photos', 'data/photos.json');
export const loadTracks = () => load('tracks', 'data/tracks.json');
export const loadProfile = () => load('profile', 'data/profile.json');

// Goodreads covers live on Amazon's image servers, which resize on a
// "._SY36_" style modifier placed before the extension. Other hosts are
// served as is.
export function coverAt(url, size) {
  if (!url) return null;
  if (!/gr-assets\.com|media-amazon\.com|images-amazon\.com/.test(url)) return url;
  return url.replace(/(\.(?:jpe?g|png|gif))$/i, `._${size}_$1`);
}

// Unsplash raw URLs are imgix URLs, so size and crop are query params.
export function photoAt(p, w, hgt) {
  const crop = hgt ? `&h=${hgt}&fit=crop` : '';
  return `${p.raw}&w=${w}${crop}&q=70&auto=format`;
}

export function photoName(p) {
  const slug = (p.description || p.alt || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `${slug || p.id}.jpg`;
}

# danv.is

My personal site, made to look like a pixelated Fedora KDE desktop. Plain HTML, CSS and JS with no framework and no bundler. The only outside pieces are Google Fonts, highlight.js for the code viewer and marked for the one Markdown file.

On the desktop:

- Home: books from Hardcover, photos from Unsplash, the music folder and my projects
- Terminal: runs fastfetch on start, `help` lists the rest
- Winamp: plays whatever is in `music/`
- VS Code: shows the site's own source
- LinkedIn: a short preview of my profile that links to the real one
- Mail: a contact form sent through Web3Forms

The wallpaper is a random isometric island or city, new on every load.

## Running it

```sh
npm run dev
```

Then open http://localhost:8080. Opening `index.html` from disk won't work since the page fetches its data. The dev server is a small Node script because Python's built-in server can't seek inside audio files.

Page views are counted with Cloudflare Web Analytics, on `danv.is` only (token in `js/config.js`).

Settings live in `js/config.js`, the LinkedIn preview in `data/profile.json`.

## Projects

Each project is one entry in `data/projects.json` and opens in Falkon as a store-style page. To add one, copy an entry and fill in:

- `id`, `name`, `subtitle`, `url` (shown in the address bar), `version`, `license`, `tags`
- `logo`: an image in `data/projects/`, shown at 96 px
- `about`: a short Markdown file in `data/projects/`, shown under the header
- `repo`: a source link, the Source button shows when it is set
- `kofi`: a Ko-fi page, the Support button stays hidden until it is set

## Books and photos

Hardcover and Unsplash both need API tokens, which can't go in a public page, so the site reads JSON snapshots from `data/`. To refresh them by hand:

```sh
HARDCOVER_TOKEN=... UNSPLASH_ACCESS_KEY=... npm run fetch
```

The GitHub workflow in `.github/workflows/refresh-data.yml` does the same every day and commits the result. It needs the `HARDCOVER_TOKEN` and `UNSPLASH_ACCESS_KEY` repository secrets.

Unsplash's demo keys allow 50 requests an hour, so photo details (camera, location and so on) fill in over a few runs.

## Music

Put audio files in `music/` and run `npm run tracks`. It rebuilds `data/tracks.json` from the ID3 tags and saves any embedded cover art to `data/covers/`.

The current album is Barbershop Simulator by slowerpace, see `music/important!!!.md`. Only add music you're allowed to stream publicly.

## Source viewer

Browsers can't list a folder, so the VS Code window reads its file list from `data/source.json`. `npm run manifest` regenerates it. Everything in the folder is public once deployed, so no secrets in here.

## Deploying

Cloudflare Pages, connected to this repo. Build command `npm run build`, output directory `/`. The daily data commit triggers a redeploy.

# AGENTS.md

## What this is

The source of [neuron-lens.com](https://neuron-lens.com): the Neuron Lens explorer of Qwen3-8B's and
Gemma 4 12B's neurons and attention heads, with its About and Credits pages. A static single-page app
(Vite 8, Svelte 5 runes, TypeScript; no SvelteKit, no server code) over a prebuilt catalog of static
files. It left [drowse.ai](https://drowse.ai) (`stdlogits/drowse.ai`), which now redirects its old
`/neuron-lens` and `/neurons` links here; `src/lib/router.svelte.ts` rewrites their queries to paths.

## Layout

- `src/main.ts`, `src/App.svelte`: the shell (header, footer, page switch).
- `src/explorer/`: the explorer. `lens.svelte.ts` is its state (get it with `useLens()`): it reads the
  address, loads what that place needs and changes place only by going to another address. The rest
  are its parts: `Atlas` (and `atlas/`), `LayerList`, `UnitView` (and `unit/`), `Search` (and
  `search/`), `media/`.
- `src/pages/`: About, Credits, the missing page.
- `src/lib/`: `data.ts` (the catalog's types and loaders), `models.ts` (each model's shape and the
  words for its depth bands), `router.svelte.ts` (every view is a path), `site.ts` (the name and
  origin), `motion.ts`, `tips.ts`, `translate.svelte.ts`, `media.ts`, `theme.svelte.ts`.
- `src/ui/`: the shared pieces (`Segmented`, `Tabs`, `Swap`, `MorphText`, `Icon`, …).
- `src/styles/`: tokens, base styles, the Wix Madefor faces.
- `public/`: copied into the build as is. `_headers` (CSP, security headers, caching), `robots.txt`,
  `theme.js` (applies the stored theme before first paint; a file, not inline, because the CSP allows
  no inline script), the mark (`favicon.svg`) and the images drawn from it and the card (below),
  `data/` (the catalog, gitignored except `data/404.html`).
- `scripts/neurons/`: the catalog's build (below). `scripts/site/`: what the site says about itself
  (below). `scripts/deploy.sh`, `scripts/verify-deployment.mjs`: deploy and the live check.
- `e2e/`: Playwright specs on a mock catalog (`e2e/fixtures/catalog`, committed: a few units cut from
  `public/data` by `e2e/fixtures/build.mjs`, ~0.5 MB).

Addresses: `/`, `/<model>`, `/<model>/L<layer>`, `/<model>/L<layer>/n<neuron>` (`?all` lists every
neuron of the layer), `/<model>/heads`, `/<model>/L<layer>/heads`, `/<model>/L<layer>/h<head>`,
`/about`, `/credits`. Anything else is the missing page. Bare addresses are Qwen3-8B.

## Design

`DESIGN.md` is the design: tokens, type, motion and pieces, in Ledger, the design language of every
Standard Logits product, which this site defines (a change here is a change to Ledger). Follow it
exactly: flat and borderless, the depth tint as the one accent and only as fill, Wix Madefor only with
tabular numbers, motion on one curve through the `motion.ts` actions and `Swap`/`MorphText`, show
rather than tell (no explanatory paragraphs or provenance in the explorer; tips and the About page
hold the words). The only credit in the explorer is "Labels by Claude Haiku 5.5". Phone widths down to
320 px must not scroll sideways.

## What the site says about itself

Every address is served the same `index.html`, and the explorer draws each view in the browser, so
crawlers, link previews and language models that run no script see only what the build writes into
it. `scripts/site/meta.ts`, a Vite plugin, writes all of it, from `src/lib/models.ts` and
`src/lib/site.ts`: the description, Open Graph and Twitter tags, icons and JSON-LD (the site, the
explorer, the catalog as a schema.org `Dataset` with its Hub release as its id, a9lim under a9l.im's
person id, treetown, Standard Logits); a short summary in `#app` for readers without script (hidden by
`@media (scripting: enabled)` and cleared by `main.ts`); `/llms.txt` from `scripts/site/llms.md`;
`/sitemap.xml`; and the web app manifest. `App.svelte` sets each view's canonical link (`?all`
dropped) and marks the missing page `noindex`. There is no `og:url`: every address is served this
page, so a static one would name the home page for all of them.

The site describes the project and points at the Hub release; it never writes a unit's data as text
or pages (a9's call: anyone who wants the data uses `stdlogits/neuron-lens`). `robots.txt` welcomes
every crawler and keeps them out of `/data/`.

`node scripts/site/render.mjs` draws the images into `public/`: the social card (`card.png`, from
`scripts/site/card.html` in the site's own tokens: Qwen3-8B's atlas from the built catalog and
L8·n344 as the explorer shows it) and, from `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` and
the manifest's icons. Rerun it when the mark, the card or Qwen3-8B's catalog changes.

## The catalog

The explorer reads static JSON (and Gemma 4's media packs) from `public/data/<model>/`, served at
`/data/<model>/`. It is built from the private neuron-lens catalogs
(`~/Work/neuron-lens/data/catalog/<model>`, laid out as the Hub release `stdlogits/neuron-lens`) and is
gitignored like them (~6 GB, ~4,850 files). Stages, from the repository root (each script's docstring
has the full invocation):

1. `scripts/neurons/translate.py` machine-translates non-English tokens, label terms, example contexts
   and media captions with Claude Haiku 5.5 on the Batch API (`collect`, `pilot`, `submit --cap`,
   `results`, then `fill` for what Haiku skipped). Each run keeps its state in its own folder,
   `.neuron-lens/<model>` by default (gitignored); `--parts` and `--known` let a later run (a model's
   labels, once labelled, as in `.neuron-lens/gemma-4-12b-labels`) skip what earlier runs sent. Rerun it
   only when a catalog's vocabulary, labels or contexts change.
2. Gemma 4 only: `scripts/neurons/media.py <catalog> public/data/gemma-4-12b` packs the images and
   sounds of the collections whose licences allow showing them (its `ALLOWED` table), matched to the
   catalog by SHA-1, and their credits. Others are linked, never hosted.
3. `scripts/neurons/build-neuron-catalog.py <catalog> <tokenizer.json> public/data
   <translations.jsonl,...>` writes every neuron and head into `public/data/<model>/`, given every
   translation run that applies (a term means the same whichever model's run translated it). The
   model's profile (geometry, the labeller's reading plan, depth bands) sits at the top of the builder;
   the site's words for the bands live in `src/lib/models.ts`. `NEURON_LAYERS=8,21` builds a subset for
   development.

Labels come from neuron-lens's `scripts/10_labels.py`, per model. The builder also works without them:
titles then fall back to a unit's media label or its peak tokens.

The types in `src/lib/data.ts` mirror the builder's output. Change both together, then regenerate the
e2e mock catalog (`node e2e/fixtures/build.mjs`) so the specs see the new shape.

`public/data/404.html` makes a missing data file answer 404 rather than the app. There must be no
top-level `404.html`: Pages serves `index.html` for every path without a file only while there isn't
one.

## Images and sounds, and the CSP

Each image and sound shown is cut from a media pack by an HTTP range request (Pages answers 206) and
shown from a `blob:` URL; optimised patches come inline as `data:` images, and optimised sounds are
made into `blob:` WAVs. The CSP in `public/_headers` allows exactly that (`img-src 'self' data: blob:`,
`media-src 'self' blob:`). The dev server sends no CSP, so a page that breaks under it only breaks once
deployed: any new way of showing fetched bytes (another scheme, another origin, a worker, inline
script) needs `_headers` changed with it, and a check of the deployed page's console.
`scripts/verify-deployment.mjs` reads `_headers` itself, so the two can't drift.

Pages caps a site at 20,000 files (Free plan) and a file at 25 MiB; media packs stay under both.

## Testing

- `npm run check` (svelte-check) must be clean.
- `npm run test:e2e` runs the specs in `e2e/` against the dev server on port 5195, with every `/data`
  request answered from `e2e/fixtures/catalog` (`e2e/fixtures/catalog.mjs`, which also makes up
  `scores.json` and answers range requests). The mock's media bytes are made up, not the collections'.
  Specs test the address and the shell through roles and names; markup-level tests of the atlas, list
  and unit view are marked `test.fixme` until those parts settle.
- `node scripts/verify-deployment.mjs <origin>` checks a deployed site: status codes, the headers from
  `_headers`, the JSON-LD and the files the site serves about itself (icons, card, manifest, llms.txt,
  sitemap; byte for byte against `dist` when deploying), catalog JSON, 404s for missing data, 206
  ranges on media packs, immutable assets, then a
  Chromium smoke that a Gemma neuron's images load and a sound plays with no CSP violation. Its
  selectors are constants at the top of its browser section.

## Deploy

`scripts/deploy.sh` (`npm run deploy`) deploys to the Cloudflare Pages project `neuron-lens` in a9's
own Cloudflare account, production branch `main`, then verifies `https://neuron-lens.com`. The
Cloudflare user logged in on this machine reaches that account and also the one that hosts drowse.ai,
so the script pins every Wrangler call to `CLOUDFLARE_ACCOUNT_ID`, which it requires (from the
environment or `~/.config/cloudflare/neuron-lens.env`, outside the repo). It signs in with
`CLOUDFLARE_API_TOKEN` when set (then Wrangler gets an empty home), else with the machine's
`wrangler login`, and passes Wrangler no other credential variable and an empty `.env`. Never run a
Wrangler command for this site without that account ID.

It refuses a dirty tree, a HEAD not on `origin/main`, or a missing catalog; runs `npm ci`, `check` and
`build`; checks `dist` against Pages' file limits; uploads with the pinned Wrangler
(`--commit-hash` HEAD); and waits for the live site to serve this build before verifying it.
`--dry-run` stops before the upload. The Pages project and the custom domain must exist in that
account first. Cloudflare Web Analytics is on (a9's choice): the CSP allows its beacon from
`static.cloudflareinsights.com` and its reports to `cloudflareinsights.com`. Keep Rocket Loader and
email obfuscation off: they add inline scripts the CSP blocks. The zone's security-headers transform
sets `Referrer-Policy: same-origin` and `X-Frame-Options: SAMEORIGIN`, so `_headers` says the same
(the CSP's `frame-ancestors 'none'` still forbids framing). Its Browser Cache TTL (4 hours) raises a
shorter `max-age`, so `/data/*` asks for 4 hours itself.

# AGENTS.md

## What this is

The source of [neuron-lens.com](https://neuron-lens.com): the Neuron Lens explorer of Qwen3-8B's and
Gemma 4 12B's neurons and attention heads, and of the other Qwen3 sizes (0.6B to 14B) and, unlabelled, the
base models, with its About and Credits pages. A static single-page app
(Vite 8, Svelte 5 runes, TypeScript; no SvelteKit, and no server code but `scripts/site/unfurl.js`, below)
over a prebuilt catalog of static files.
It left [drowse.ai](https://drowse.ai) (`stdlogits/drowse.ai`), which now redirects its old
`/neuron-lens` and `/neurons` links here; `src/lib/router.svelte.ts` rewrites their queries to paths.

## Layout

- `src/main.ts`, `src/App.svelte`: the shell (header, footer, page switch).
- `src/explorer/`: the explorer. `lens.svelte.ts` is its state (get it with `useLens()`): it reads the
  address, loads what that place needs and changes place only by going to another address. The rest
  are its parts: `Atlas` (and `atlas/`), `graph/` (the unit's connections: `trace.ts` walks them,
  `layout.ts` places them, `stage.ts` moves them, `Graph` draws them (its links on a canvas, `ink.ts`), `Connections` is the rail, `Navigator` the same graph full
  screen with its Find (`find.ts`), `Card` a tapped unit's card), `UnitView` (and `unit/`), `Search`
  (and `search/`), `media/`, and `LinkCard`, a unit drawn as the picture its shared link carries.
- `src/pages/`: About, Credits, the missing page.
- `src/lib/`: `data.ts` (the catalog's types and loaders), `models.ts` (each model's shape, its depth
  ramp and the words for its depth bands; the models listed are those with a build in `catalog.json`), `depth.json`
  (every model's reading plan and bands, with the numbers their words cite) and `ladder.json` (the other Qwen3 sizes'
  profiles), both written by `bands.py` (below), `router.svelte.ts` (every view is a path), `site.ts` (the
  name and origin), `translate.svelte.ts` (the translations, and the site's `Translator` for Ledger),
  `theme.ts` (the theme, from Ledger's `createTheme`), `media.ts`.
- `src/styles/site.css`: the site's own rules over Ledger's (the no-script summary).
- `@stdlogits/ledger` (below, "Design"): the tokens, faces and base styles, motion, the tip, the
  theme and the shared pieces (`Segmented`, `Tabs`, `Token`, `Swap`, `MorphText`, `Icon`, …).
- `public/`: copied into the build as is. `_headers` (CSP, security headers, caching), `robots.txt`,
  the mark (`favicon.svg`) and the images drawn from it and the card (below). `vite.config.ts` serves Ledger's `theme-preflight.js` beside them
  (it applies the stored theme before first paint; a file, not inline, because the CSP allows no inline
  script); `index.html` gives it the theme's key.
- `catalog/` (gitignored): the built catalog, which the dev server serves at `/data` and the site reads
  from R2 (below, "The catalog").
- `scripts/neurons/`: the catalog's build (below). `scripts/catalog/`: its upload to R2, the bucket's
  CORS rules and robots.txt, and the dev server's `/data`. `scripts/site/`: what the site says about
  itself (below). `scripts/deploy.sh`, `scripts/verify-deployment.mjs`: deploy and the live check;
  `scripts/wrangler.sh`: the account and sign-in every Wrangler call uses.
- `e2e/`: Playwright specs on a mock catalog (`e2e/fixtures/catalog`, committed: a few units cut from
  `catalog/` by `e2e/fixtures/build.mjs`, ~0.5 MB).
- `CONTRIBUTING.md`, `SECURITY.md`, `.github/` (CI, the issue forms, Dependabot for CI's actions): what
  the repository tells people outside it. CONTRIBUTING repeats this file's rules that CI can't check,
  so change it with them. Security reports go through private advisories only, with no email. The
  issue forms send the analysis to `stdlogits/neuron-lens` and the design to `stdlogits/ledger`.

Addresses: `/`, `/<model>`, `/<model>/L<layer>`, `/<model>/L<layer>/n<neuron>` (`?all` lists every
neuron of the layer), `/<model>/heads`, `/<model>/L<layer>/heads`, `/<model>/L<layer>/h<head>`,
`/about`, `/credits`. A unit's address with `?graph` opens its connections full screen, and with `?card` is its link card alone (below, "What the site says about itself"). Anything else is the missing page. Bare addresses are Qwen3-8B.

## Design

The site is drawn in Ledger, the design language of every Standard Logits product, which lives in
[`stdlogits/ledger`](https://github.com/stdlogits/ledger): the package `@stdlogits/ledger`, pinned in
`package.json` to a tag. Its `DESIGN.md` (`node_modules/@stdlogits/ledger/DESIGN.md` at the pinned
version) is the design, and its tokens, faces, motion, tip, theme and pieces are the only ones the site
uses. A change to Ledger lands in that repository first, as a new tag, and reaches the site as a pin
bump; never copy a piece into the site to change it. This repository's `DESIGN.md` lists what the site
draws for itself.

Follow Ledger exactly: flat and borderless, the depth tint as the one accent and only as fill, Wix
Madefor only with tabular numbers, motion on one curve through its actions and `Swap`/`MorphText`, show
rather than tell (no explanatory paragraphs or provenance in the explorer; tips and the About page
hold the words). The only credit in the explorer is "Labels by Claude Haiku 5.5" (on a base model, "…, written for
Qwen3-8B" or its size); above it sits the
labeller's note on the chosen labels, which is evidence for them, not an explanation of the site. A
unit's view shows all of its evidence on one page, with nothing behind a "more" button, sorted into
baskets under a bar that stays in reach, in this order: Weights (every read the labeller saw, and what it adds
beyond what it reads), Stream (what the residual holds where it fires, which never reached the labeller) and
Firings (its images and sounds, its firings, what it does in real text, what the model says next there,
how often and how hard).
A head has the same three: Weights holds its QK and OV reads with how it attends and copies, Stream what its own output says where it fires, and Firings also what it attends to and its attention pattern.
A head's QK diagonal, a token at the query seeking an earlier copy of itself, is read twice: with the query through the S-lens
(the token it holds: duplicate-token heads) and through the R-lens (the token it is about to say: copy suppression's lookup).
Each model trusts the first up to a layer and the second from the next (`self` in the builder's profile, from neuron-lens findings §10 and §15).
Each read shows its normal list, or with the Distinctive switch beside English its layer-contrastive (z) list; a
normal list left with nothing once hub tokens are gone shows its distinctive list instead (most of Stream's early reads).
Every model's depth bands are neuron-lens's, cut from its reading plan (`arch.PLANS`, findings §8: which read a label card
shows at each depth, set by blind ratings of each read's coherence), in order: sensory layers, whose cards read what drives
a neuron through the S-lens; association layers, through the R-lens, which there often names a concept associated with
what it fires on; workspace layers; and motor layers, from where a write often reads as the next word. A plan may skip one
(Gemma 4 has no sensory band, Qwen3-1.7B no workspace band). The same plan says which read is lit on each side: the
card's input read, the R-lens write read at every depth, and a head's OV read by the plan's head line. Any other read is
quiet until pointed at, and comes last; so is a read the findings say fails on that model. The catalog keeps no per-unit test of a read
(neuron-lens: a read that misses a unit's firings isn't wrong for it), so the site shows none and nothing lifts a read out of quiet.
Left is always what comes in and right what goes out. Beside them the rail holds its connections: a
directed graph at true depth, and its strongest links in words. The graph opens at Near (only the units most
of its flow passes through); Far and All follow it further. Wired to, driven by and fires with are
three relations and stay three views (findings §12). A head has no wired to, because two heads meet through a matrix and not a dot product;
what drives it is split over its three inputs, so its views are Value, Query, Key and Fires with.
Each view but Fires with also shows the unit's siblings, beside it in its own row (a9's idea, 2026-11-17): units of its layer (heads for
a head) that share both what feeds it and what it feeds in that view's relation. They are a kind of node, like what is above and below it,
and not a fourth relation, so Wired to and Driven by each have their own. `siblings` in `trace.ts` reads them from the unit's first parents'
and children's records, already on the page: each parent's links down into the row and each child's up from it, weighted as the walk
weighs the unit's own, summed per unit, a sibling sharing both the same way (their geometric mean). Fires with has none: its lists hold
only earlier neurons, one way. On Qwen3-8B their labels share a word with the unit's about half the time, against 6% for random units of the layer. A link's sign has no colour of its own, since the one
hue is depth: a link that pushes against is grey and dashed. Full screen, the graph moves like a map, held over the
graph whatever its shape, and keeps its titles one size on screen, each placed where it covers no mark and no other
title; one without room waits for a closer zoom. Its Find (`find.ts`) narrows it to the units an ID or a word finds.
A touch has no hover, so a tap on a unit in either graph opens its card rather than going there.
The model is picked in two rows: its family, then its size and, where both are up, post-trained or base (About's depth
figure picks among the labelled ones the same way). Another model keeps the place (a9's call): the same layer and neuron or
head number, clipped to its shape and never matched to a similar unit, Easiest or All as it was (a trip through a base model,
which lists all, changes neither), the filter where it has one, and the side being read. The one exception is a pruning
(neuron-lens findings §20): Qwen3-4B and Qwen3-0.6B were pruned from Qwen3-8B and Qwen3-1.7B, so between a pruned model and
its parent, post-trained or base, a neuron goes to its traced counterpart, provisional or not, and to the same number only
where none is traced (a near-silent neuron, or one the pruning cut) (a9's call, 2026-11-16). Heads keep their numbers,
which are the parent's. A pruned model's neuron also names its parent at the end of its meta line, and a parent's its
child or that it was cut (`UnitBar.svelte`; DESIGN.md).
A base model whose post-trained model is labelled (`labelsFrom` in `models.ts`) shows that model's labels, ratings, Easiest
and search over its own evidence (a9's call: the two are empirically close enough that the labels hold), its labels in
italic wherever they show, as lent (Ledger's `lent`; a9's call). Its build stays
unlabelled; `src/lib/data.ts`'s loaders merge the lender's build into it (titles, scores and confidences in the rows,
graph records and details; the Easiest list, the scores texture, the terms and the word index), so nothing above them
knows, and a base unit's graph reads two records a node. Its Easiest filters use the lender's flags.
An unlabelled model (a size whose labels aren't released yet, and its base) has no Easiest: its layers list every neuron, and its
search finds heads and addresses only (a9's calls). Five sizes fill a 320 px row; a sixth needs another layout.
Phone widths down to 320 px must not scroll sideways.

`main.ts` loads `@stdlogits/ledger/ledger.css`, then `site.css`, and installs `translator` with
`setTranslator` before mounting. The dev server serves Ledger as source rather than pre-bundling it
(`optimizeDeps.exclude`), because vite-plugin-svelte's pre-bundling hands its `.svelte.ts` modules to
Svelte with their types still in; that also needs vite-plugin-svelte 7.3.1 or newer, which finds a
`node_modules` component's CSS under Vite's `?v=` query.

## What the site says about itself

Every address is served the same `index.html`, and the explorer draws each view in the browser, so
crawlers, link previews and language models that run no script see only what the build writes into
it. `scripts/site/meta.ts`, a Vite plugin, writes all of it, from `src/lib/models.ts` and
`src/lib/site.ts`: the description, Open Graph and Twitter tags, icons and JSON-LD (the site, the
explorer, the catalog as a schema.org `Dataset` with its Hub release as its id, a9lim under a9l.im's
person id, and treetown and Standard Logits under standardlogits.com's); a short summary in `#app` for readers without script (hidden by
`@media (scripting: enabled)` and cleared by `main.ts`); `/llms.txt` from `scripts/site/llms.md`;
`/sitemap.xml`; and the web app manifest. `App.svelte` sets each view's canonical link (`?all` and
`?graph` dropped) and marks the missing page `noindex`. There is no `og:url`: every address is served this
page, so a static one would name the home page for all of them.

The site describes the project and points at the Hub release; it writes no unit's data as text or
pages (a9's call: anyone who wants the data uses `stdlogits/neuron-lens`), with one exception since
2026-11-22: the words of a shared link to a unit (next). `robots.txt` welcomes every crawler; the
catalog's own host, `data.neuron-lens.com`, has a robots.txt that keeps them out.

A shared link to a neuron or a head carries that unit's own words, where before every link showed the
site's. `scripts/site/unfurl.js` does it, and is the site's one piece of server code: Pages runs it
(advanced mode: `meta.ts` writes it into the build as `_worker.js`, one file with no imports, filled in
from `src/lib/models.ts` and `src/lib/catalog.json`) in front of a unit's address and its picture's (next paragraph) and no other, which
`_routes.json`, also written by `meta.ts`, names (`/<model>/L*/n*`, `/<model>/L*/h*` and `/card/*`). Every other
request is served as a file and counts as none of the account's Function requests. It reads the unit
from the catalog as the explorer does (a neuron's two sides in its layer's `graph.bin` and its detail in
the units pack; a head's record and its layer's `heads/L<layer>.json`) and rewrites the page's `<title>`
(as the explorer sets it), its description, `og:title`, `og:description` and its last `theme-color`
(the one `meta.ts` writes for Discord's bar): the model, layer and band, what it fires on with one
firing, what it makes the model say, its other side and the labels' credit, within the 70 and 350 bytes
Discord shows, and its layer's colour on the depth ramp in Ledger's light tokens. A neuron is described
on the side the explorer opens it on, and a base model's unit with its post-trained model's labels. The
picture is the unit's own card (next paragraph). If the catalog is slow (2.5 s), changed or missing, or the address names
no unit, the page goes out untouched; it returns what `env.ASSETS.fetch` gives it, so `_headers` still
applies. It gives up if `graph.bin` isn't the size its record widths expect, so it changes with the
builder's `WIRE` and `HEAD_WIRE` and with `src/lib/data.ts`. On the Workers Free plan it has 100,000
requests a day and 10 ms of CPU a request; the Pages project is set to fail open, so past the allowance
a unit's page is served without its words.

A shared link to a unit also carries the unit's own picture since 2026-11-23 (Luna's call), where the
project is set up to draw them, and the site's card otherwise. `src/explorer/LinkCard.svelte` is the
picture: a unit's address with `?card` (a neuron's with `?all&card`) draws only its link card, 1200 × 630
in the dark tokens (DESIGN.md), and sets `data-card="drawn"` once it has. `unfurl.js` names
`/card/<the unit's address>.webp?v=<version>` as the page's `og:image` and answers it. The first request
has Cloudflare's hosted browser (Browser Run's REST screenshot endpoint; Pages Functions get no browser
binding) photograph the card page at 2× as a WebP at quality 75 (70 to 115 kB), sends that, and keeps it
in Workers KV for 60 days; every later request is served what was kept, and the zone's edge caches that
answer, so a unit costs the browser's time once. The version is the card's look (`DRAWN` in `unfurl.js`:
raise it when `LinkCard.svelte` or the photograph's settings change) and the builds the card reads, so a
new look or build is a new address and a new key; a picture not kept yet is named with `-new` after its
version, so whatever a preview fetched under that address never stands in the kept card's way. If the
browser takes over 7.5 s, is busy (it is then asked once more, in the background), is out of its day's
time, or hands back a blank page, the site's card goes out under the unit's address, uncached, and a
drawing still under way is kept for the next request. The card page goes out with `Link` headers naming
its own chunk and style, the build's manifest and the catalog files a card reads first (`ahead` in
`unfurl.js`), so the browser fetches them alongside the script; a drawing takes about 3 s of the hosted
browser. `scripts/site/unit-cards/` holds the prototypes the card was drawn from, and one of a card for
Discord alone (a unit's connections) that nothing serves.

The project's settings hold what the pictures need, for Production only: the KV namespace
`neuron-lens-cards` bound as `CARDS`, the variable `BROWSER_ACCOUNT` (the account's ID) and the secret
`BROWSER_TOKEN` (the account API token `neuron-lens-cards`: Browser Run, Edit). Without all three every
unit keeps the site's card, as on a preview deployment. KV and not R2, because the catalog already fills
R2's free 10 GB and KV's free plan holds 1 GB, some ten thousand cards. On the Workers Free plan the
hosted browser has 10 minutes a day and takes one request every 10 seconds, and KV has 100,000 reads and
1,000 writes a day.

`node scripts/site/render.mjs` draws the images into `public/`: the social card (`card.webp`: WebP at
quality 92, as a9l.im's cards are) and, from `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` and the
manifest's icons. The card is the site's own drawing, not one of Ledger's painted cards (its DESIGN.md, "The marks
and the cards"), though its type is Ledger's `card.css`: flat paper like the site, the name and the model, then six
of Qwen3-8B's neurons (`scripts/site/card/card.json`: L3·n10265 coffee, L8·n344 owl, L12·n11885 tree, L20·n11348
bell, L24·n10369 moon, L30·n10935 cat; the labeller was sure of each, 85 to 95 of 100), each a small figure of
what it fires on drawn as dots in its layer's colour, with the tokens it fires on and its ID beneath, and a thread
from each down to its layer in the model's atlas, the neuron pinned where the explorer pins it.
`scripts/site/card.html` lays it out. `scripts/site/card/figures.py` draws the figures into `figures/`: each is
modelled (`models.py`), meshed (`mesh.py`), rendered in Blender's Cycles (`blend.py`) and that render drawn as dots
along flowing strands (`dots.py`); it needs Python with numpy, scipy, scikit-image and Pillow, and Blender.
`scripts/site/card/atlas.mjs` takes the atlas (`atlas.webp`) and the pins (`atlas.json`) from the site itself.
Rerun `render.mjs` when the mark or the card changes (`figures.py` first if a figure or a neuron did, `atlas.mjs`
if the explorer's atlas or a neuron did), and change the card's alt text (`scripts/site/meta.ts`) with what it
shows; encoding the card needs Python with Pillow (`PYTHON`, or `python3`). `scripts/site/paint/lens.py` painted
the card before this one (a lens held up to the atlas, an owl through it) and is kept, unused.

## The catalog

The explorer reads static JSON (and Gemma 4's media packs), built into `catalog/<model>/` from the
private neuron-lens catalogs (`~/Work/neuron-lens/data/catalog/<model>`, laid out as the Hub release
`stdlogits/neuron-lens`) and gitignored like them (~6 GB, ~600 files). The dev server serves it at
`/data/<model>/`; the site reads it from R2 (below, "On R2"), and so does the dev server started with
`VITE_CATALOG=live` (`src/lib/data.ts`), for work that needs real units but not a local build. Stages, from the repository root (each
script's docstring has the full invocation):

1. `scripts/neurons/translate.py` machine-translates non-English tokens, label terms, example contexts
   and media captions with Claude Haiku 5.5 on the Batch API (`collect`, `pilot`, `submit --cap`,
   `results`, then `fill` for what Haiku skipped). Each run keeps its state in its own folder,
   `.neuron-lens/<model>` by default (gitignored); `--parts` and `--known` let a later run (a model's
   labels, once labelled, as in `.neuron-lens/gemma-4-12b-labels`) skip what earlier runs sent. Rerun it
   only when a catalog's vocabulary, labels or contexts change.
2. Gemma 4 only: `scripts/neurons/media.py <catalog> catalog/gemma-4-12b` packs the images and
   sounds of the collections whose licences allow showing them (its `ALLOWED` table), matched to the
   catalog by SHA-1, and their credits. The synthetic images come from the catalog folder's `media/image_synth.parquet`,
   which the Hub release leaves out. Others are linked, never hosted. `hosted.json` is keyed by document number,
   so rerun this whenever a catalog's `media/*_docs.parquet` change. The builder (3) reads it from its output
   folder, so a build into a fresh folder needs `media.py`'s output (`media/credits.json`, `media/<modality>/hosted.json`
   and the packs) there first, or its media documents list nothing as shown.
3. `scripts/neurons/build-neuron-catalog.py <catalog> <tokenizer.json> catalog
   <translations.jsonl,...>` writes every neuron and head into `catalog/<model>/`, given every
   translation run under `.neuron-lens/` (a term means the same whichever model's run translated it; the runs
   added since only reach `terms.json` and the word index, so an earlier build's other files rebuild the same). The
   model's profile (geometry, the reads that fail on it, its QK switch) sits at the top of the builder, and
   its reading plan and bands in `src/lib/depth.json`, which `scripts/neurons/bands.py <neuron-lens data/summary>
   [<model>]` copies from neuron-lens's `depth.json` (rerun `python -m neuron_lens.arch` there first if its plans
   changed) for every model with a build, with the spans of the census's and steering's numbers each band's words
   cite in `models.ts`. A Qwen3 size beside the 8B takes the rest of its profile from `ladder.json`, which the same
   run writes (its QK switch is the 8B's at the same relative depth), after neuron-lens's catalog queue has run its
   reads-at-firings and steering checks. A change to a plan changes which reads are lit, so every build it covers
   needs rebuilding. It is
   labelled once its release record lists labels of both sides (`labelled` in `ladder.json`); its labels' terms
   get a translation run of their own (`.neuron-lens/<model>-lean-labels`), and Qwen3-8B's runs serve the rest (one
   tokenizer; contexts the 8B never showed stay untranslated). `NEURON_LAYERS=8,21`
   builds a subset for development.
4. `scripts/catalog/upload.sh <model>` puts the build on R2 and names it in `src/lib/catalog.json`;
   commit that and deploy (below, "On R2").
5. The pruned pairs' links, once, apart from any model's build: `scripts/neurons/lineage.py
   ~/Work/neuron-lens/data/catalog catalog/lineage` turns the neuron-lens catalogs' `lineage` tables (Qwen3-4B, 0.6B,
   8B, 1.7B) into `catalog/lineage/<model>.bin`, a 4-byte record per neuron (the other model's neuron and how it is
   known), read by range (`loadLineage` in `data.ts`); a base reads its post-trained model's file (`models.ts`:
   `prunedFrom`, `prunedInto`, `traced`). `scripts/catalog/upload.sh lineage` puts it on R2 as a build of its own (`lineage/<build>.json`) and
   names it in `catalog.json`'s `lineage`, so no model's build changes with it; `deploy.sh` and the deployment check
   cover it.

Labels come from neuron-lens's `scripts/10_labels.py`, per model. The builder also works without them:
titles then fall back to a unit's media label or its peak tokens.

Each layer's neurons are two kinds of file, both read by HTTP range. `graph.bin` holds a fixed-width
record per pole (`WIRE` in the builder, 800 bytes): its title, where its detail is, and its 16 strongest
links per relation, ids and half-floats, so a pole's record costs one small request and the graph can follow
links as far as it likes. `units-<pack>.bin` holds each neuron's detail as deflated JSON, end to end, in
packs of at most 20 MiB. The builder inverts every `sources` table for what each pole and head drives (the
catalog lists only what drives a unit). `heads/graph.bin` holds a record per head (`HEAD_WIRE`, 1004 bytes): what drives
it through its value, its query and its key, what fires with it, and what it drives.
The graph's walk (`trace.ts`) settles a layer before the next, so it reads ahead: what already clears the floor
a few layers on is asked for at once, as a read that waits behind any needed now (`range` in `data.ts`) and
moves up when it is. The graph comes out the same; All settles in about a third of the time.

The search reads the word index (`search/`, `write_search` in the builder): `words.json` lists every word a unit is found
by, as `stem()` keys it, sorted and front-coded, with how many units each has and how it shows; it loads whole on the
search's first hover or focus (0.6–1.2 MB gzipped). `p<NN>.bin` packs (4 MiB) hold each word's postings, a uint32 each
(the unit's id, whether it is a head, whether the word is in its title, the word's weight), a word's best first, so a
search reads only the head of a long list by range (the engine's `EXACT` and `NEAR`). A labelled model indexes every
pole's label words, and its Easiest neurons' poles and its heads by all their words (reads, peaks, translations), as
the curated search did before it; an unlabelled one, its heads. A result outside the Easiest gets its title from its
graph record as it shows.

The types in `src/lib/data.ts` mirror the builder's output. Change both together, then regenerate the
e2e mock catalog (`node e2e/fixtures/build.mjs`) so the specs see the new shape. The builder's `stem()`
keys the word index and the variants a unit agrees on; the explorer computes the same keys with
Ledger's `stem()`, so the two must stay the same.

### On R2

The site reads each model's catalog from the R2 bucket `neuron-lens-data` in a9's account, served at
`https://data.neuron-lens.com` (a custom domain on the zone), through the build that `src/lib/catalog.json`
names. Every file is an object named by its contents, `/o/<the first 20 hex digits of its SHA-256><its
extension>`, and a build is a manifest from each of its files' paths to its object, `/<model>/<build>.json`,
the build being the first 12 hex digits of the manifest's hash (`dataUrl` in `src/lib/data.ts` reads it first,
then the objects it names). Neither ever changes once up, so both are cached for good (`immutable`), a page
reads one build throughout (a graph record and the units pack it points into always agree), and a new build
goes live with the deploy that names it. A file a new build shares with any earlier build (most layers of a
rebuild, and the Qwen3 builds' vocabularies) is the same object, so `scripts/catalog/upload.sh` sends only
the objects not up yet (8 at a time, logged in `catalog/.uploads/objects.log`, so an interrupted upload
resumes), then the manifest, checks it answers, and names it; `deploy.sh` refuses to deploy a
`catalog.json` whose manifests aren't up. Older builds, and the objects only they name, stay in the bucket
until deleted, at R2's storage price (10 GB free, then $0.015/GB-month; reads past 10 million a month
$0.36 a million; no egress fees). The catalog is public, so any page may read it: the bucket's CORS
rules (`scripts/catalog/cors.json`) allow any origin, with ranges. They must stay `*`. The edge caches a
file with the headers of the answer that filled it, and only with `*` does R2 put
`Access-Control-Allow-Origin` on every answer (with a list of origins it echoes the asker's, or sends
none to a request without an Origin, which then poisons the cached copy). A Transform Rule can't set
that header. After any change to the CORS rules, purge the hostname's cache. Its robots.txt keeps
crawlers out. Cloudflare's edge caches the `.bin` files (ranges cut from its copy); JSON goes to R2 each time
unless a cache rule for the hostname says otherwise. There must be no top-level `404.html`: Pages
serves `index.html` for every path without a file only while there isn't one.

## Images and sounds, and the CSP

Each image and sound shown is cut from a media pack by an HTTP range request (R2 answers 206) and
shown from a `blob:` URL; optimised patches come inline as `data:` images, and optimised sounds are
made into `blob:` WAVs. The CSP in `public/_headers` allows exactly that (`connect-src` the catalog's
origin, `img-src 'self' data: blob:`, `media-src 'self' blob:`). The dev server sends no CSP, so a page that breaks under it only breaks once
deployed: any new way of showing fetched bytes (another scheme, another origin, a worker, inline
script) needs `_headers` changed with it, and a check of the deployed page's console.
`scripts/verify-deployment.mjs` reads `_headers` itself, so the two can't drift.

Pages caps a site at 20,000 files (Free plan) and a file at 25 MiB, which the build no longer comes near;
the builder still keeps units packs under 20 MiB, so a range is cut from a file the edge caches whole.

## Testing

CI (`.github/workflows/ci.yml`) runs `npm ci`, `check`, `build` and the e2e specs on every push to
`main` and every pull request to it. It never deploys: deploys stay manual (below).

- `npm run check` (svelte-check) must be clean.
- `npm run test:e2e` runs the specs in `e2e/` against the dev server on port 5195, with every `/data`
  request answered from `e2e/fixtures/catalog` (`e2e/fixtures/catalog.mjs`, which also makes up
  `scores.json`, answers range requests and blanks the `graph.bin` records of units the mock doesn't keep). The mock's media bytes are made up, not the collections'.
  Specs test the address and the shell through roles and names; markup-level tests of the atlas, list
  and unit view are marked `test.fixme` until those parts settle.
- `node scripts/verify-deployment.mjs <origin>` checks a deployed site: status codes, the headers from
  `_headers`, the JSON-LD and the files the site serves about itself (icons, card, manifest, llms.txt,
  sitemap; byte for byte against `dist` when deploying), a unit's address carrying its own words and
  otherwise the same page, and its picture answering with a WebP, its own card or the site's standing in
  (`unfurl.js`), immutable assets; on the data origin each
  named build's `index.json`, CORS (a range's preflight too), immutable caching, a 404 for a missing
  file, robots.txt, and 206 ranges on graph records, units packs and media packs; then a
  Chromium smoke that a Gemma neuron's images load, a sound plays and a unit's card page draws, with no
  CSP violation. Its
  selectors are constants at the top of its browser section.

## Deploy

`scripts/deploy.sh` (`npm run deploy`) deploys to the Cloudflare Pages project `neuron-lens` in a9's
own Cloudflare account, production branch `main`, then verifies `https://neuron-lens.com`. The
Cloudflare user logged in on this machine reaches that account and also the one that hosts drowse.ai,
so `scripts/wrangler.sh` (which `deploy.sh` and `scripts/catalog/upload.sh` source) pins every Wrangler
call to `CLOUDFLARE_ACCOUNT_ID`, which it requires (from the environment or
`~/.config/cloudflare/neuron-lens.env`, outside the repo). It signs in with `CLOUDFLARE_API_TOKEN` when
set (then Wrangler gets an empty home), else with the machine's `wrangler login`, and passes Wrangler no
other credential variable and an empty `.env`. Never run a Wrangler command for this site without that
account ID.

It refuses a dirty tree, a HEAD not on `origin/main`, or a `catalog.json` build that isn't on R2; runs `npm ci`, `check` and
`build`; checks `dist` against Pages' file limits; uploads with the pinned Wrangler
(`--commit-hash` HEAD); and waits for the live site to serve this build before verifying it. `dist`
carries `_worker.js` and `_routes.json` (above, "What the site says about itself"), which the upload
takes with the files. The binding, variable and secret the pictures need (same section) are set in the
dashboard, not by a deploy, and a change to them waits for the next one.
`--dry-run` stops before the upload. The Pages project and the custom domain must exist in that
account first. Cloudflare Web Analytics is on (a9's choice): the CSP allows its beacon from
`static.cloudflareinsights.com` and its reports to `cloudflareinsights.com`. Keep Rocket Loader and
email obfuscation off: they add inline scripts the CSP blocks. The zone's security-headers transform
sets `Referrer-Policy: same-origin` and `X-Frame-Options: SAMEORIGIN`, so `_headers` says the same
(the CSP's `frame-ancestors 'none'` still forbids framing), and its HSTS setting (a9's) replaces the
header with `max-age=31536000; includeSubDomains; preload`, which `_headers` repeats (a year is the
least the preload list accepts). Its Browser Cache TTL (4 hours) raises a
shorter `max-age` (and `no-cache` on images), so the site's images ask for 4 hours themselves.

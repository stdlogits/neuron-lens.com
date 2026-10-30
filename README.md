# Neuron Lens

[neuron-lens.com](https://neuron-lens.com) shows what each neuron and attention head inside two open
language models, Qwen3-8B and Gemma 4 12B, responds to and what it makes the model say: the words and
ideas that set it off, the examples where it fired hardest, what pushing it promotes, and, for Gemma 4,
the images and sounds it responds to. Every unit has an address (`/qwen3-8b/L8/n344`,
`/gemma-4-12b/L35/h14`).

It started as a page of [drowse](https://drowse.ai), whose old links still lead here. The readings come
from the neuron-lens analysis (weight lenses, top firings, steering checks), with labels by Claude
Haiku 5.5.

## Run it

Node 24 or newer.

```bash
npm ci
npm run dev          # http://localhost:5180
npm run check        # svelte-check
npm run test:e2e     # Playwright, on a small mock catalog
npm run build        # dist/
```

The site is a static single-page app: Vite, Svelte 5 and TypeScript, no server code.

## The data

The explorer reads a prebuilt catalog of static JSON (and, for Gemma 4, packs of images and sounds)
from `/data`, which the build copies from `public/data`. It is several gigabytes and not in the
repository: `scripts/neurons/` builds it from the neuron-lens catalogs (see `AGENTS.md`, "The
catalog"). Without it the dev server shows the explorer's shell and an error where the data goes; the
e2e tests bring their own mock catalog (`e2e/fixtures`).

## Deploy

`scripts/deploy.sh` builds from a clean, pushed `main` with the catalog in place, uploads `dist` to
Cloudflare Pages with Wrangler, and checks the live site with `scripts/verify-deployment.mjs`. It
takes its credentials from `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; `--dry-run` stops
before the upload.

## Credits

By a9lim, treetown and Claude. Images and sounds are shown under their collections' licences, listed
on the site's Credits page. Wix Madefor is under the SIL Open Font License (`src/assets/fonts`).

## License

[AGPL-3.0](LICENSE).

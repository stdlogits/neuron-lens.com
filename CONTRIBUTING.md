# Contributing to neuron-lens.com

Bug reports, fixes and ideas for the site are all welcome. `AGENTS.md` is the full guide to this
repository: its layout, the design, how the catalog is built, the tests and the deploy. This page is
the short version for a first change.

## Running it

Set up as in the README (`npm ci`, `npm run dev`). Without a catalog in `catalog/`, the dev server
draws the explorer's shell and shows an error where the data should be; `VITE_CATALOG=live npm run dev`
reads the live catalog from `data.neuron-lens.com` instead, which is enough for any change that doesn't
touch the catalog's build. The e2e specs (`npm run test:e2e`) bring their own small mock catalog.

To see real units, build the catalog from neuron-lens's public Hub release,
[`stdlogits/neuron-lens`](https://huggingface.co/datasets/stdlogits/neuron-lens): download a model's
folder and run `scripts/neurons/build-neuron-catalog.py` on it with that model's `tokenizer.json`.
`NEURON_LAYERS=8,21` builds only those layers. Translations are optional. Gemma 4's images and sounds
need `scripts/neurons/media.py` first. The script's docstring and AGENTS.md ("The catalog") have the
full steps.

## What CI can't check

CI runs `npm run check`, the build, and the e2e specs. It can't catch these:

- **Ledger comes first.** The site's tokens, faces, motion and shared pieces come from
  [`@stdlogits/ledger`](https://github.com/stdlogits/ledger), pinned to a tag. A change to one of them
  lands there first, as a new tag, and reaches this site as a pin bump. Please don't copy a piece into
  the site to change it. This repository's `DESIGN.md` lists what the site draws for itself.
- **The CSP.** The dev server sends no Content-Security-Policy, so a change that shows fetched bytes
  in a new way (another URL scheme, another origin, a worker, an inline script) works locally and
  breaks once deployed. Change `public/_headers` along with it, and say so in the pull request so the
  deployed page's console gets checked.
- **The catalog's shape.** `src/lib/data.ts` mirrors what `scripts/neurons/build-neuron-catalog.py`
  writes. Change both together, then regenerate the mock catalog (`npm run e2e:fixtures`) so the
  specs see the new shape.
- **Narrow phones.** Every view must fit a screen 320 px wide without scrolling sideways.

## Pull requests

Open them against `main`. Deploys are manual (`scripts/deploy.sh`, run from a machine signed in to
the site's Cloudflare account), so a merged change reaches neuron-lens.com at the next deploy.

Contributions are licensed under this repository's licence, [AGPL-3.0](LICENSE).

## Elsewhere

- How neurons and heads are read, labelled and checked, and the Hub release itself, belong to
  [neuron-lens](https://github.com/stdlogits/neuron-lens).
- Please report security issues privately, as [SECURITY.md](SECURITY.md) describes.

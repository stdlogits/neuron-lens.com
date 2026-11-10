# Design

The site is drawn in Ledger, the design language of Standard Logits, which lives in
[`stdlogits/ledger`](https://github.com/stdlogits/ledger) as the package `@stdlogits/ledger` (pinned in
`package.json`). Its [`DESIGN.md`](https://github.com/stdlogits/ledger/blob/main/DESIGN.md) is the
design: principles, tokens, type, motion and pieces. The copy at the pinned version is
`node_modules/@stdlogits/ledger/DESIGN.md`. A change to Ledger lands there first and reaches this site
as a pin bump.

What the site draws for itself, in Ledger:

- The depth ramp per model (`depthColor`, `src/lib/models.ts`), which the explorer sets as `--tint`
  for the current layer.
- The mark (`public/favicon.svg`) and the social card (`scripts/site/card.html`), both described in
  Ledger's DESIGN.md.
- The header's placement of `ThemeButton`, and the no-script summary's rules (`src/styles/site.css`).
- The translations Ledger draws (`src/lib/translate.svelte.ts`, installed with `setTranslator`).
- The connections graph (`src/explorer/graph/`): a band per layer down the page, a dot per neuron side
  and a bar per head, both in the depth colour of their layer. A link is as heavy as its
  flow, in the depth colour of its source, or grey and dashed where it pushes against: the one hue is depth.
- The graph's motion (`src/explorer/graph/stage.ts`), on Ledger's curve and durations, all on one clock so a link
  never parts from its nodes. Arriving: the unit swells in; its neighbours bud from it ring by ring (at most
  340 ms in all, strongest first, each link growing with its node); the links that make it a graph draw in behind them; the
  finished graph untangles; then one pulse runs down the layers to the unit and on out of it, along the 48 strongest links.
  What stays glides, what goes withdraws into what it budded from, and any change takes over from wherever things are.
  Reduced motion keeps the fades and drops the rest.

The explorer's one credit is "Labels by Claude Haiku 5.5".

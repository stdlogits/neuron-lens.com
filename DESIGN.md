# Design

The site is drawn in Ledger, the design language of Standard Logits, which lives in
[`stdlogits/ledger`](https://github.com/stdlogits/ledger) as the package `@stdlogits/ledger` (pinned in
`package.json`). Its [`DESIGN.md`](https://github.com/stdlogits/ledger/blob/main/DESIGN.md) is the
design: principles, tokens, type, motion and pieces. The copy at the pinned version is
`node_modules/@stdlogits/ledger/DESIGN.md`. A change to Ledger lands there first and reaches this site
as a pin bump.

What the site draws for itself, in Ledger:

- The depth ramp per model (`depthColor`, `src/lib/models.ts`), which the explorer sets as `--tint`
  for the current layer, and its three depth bands. A read through the lens its band doesn't use on that side is quiet
  (the whole read at reduced opacity, full again when pointed at or focused) and comes last.
- The mark (`public/favicon.svg`) and the social card (`scripts/site/card.html`), both described in
  Ledger's DESIGN.md.
- The header's placement of `ThemeButton`, and the no-script summary's rules (`src/styles/site.css`).
- The translations Ledger draws (`src/lib/translate.svelte.ts`, installed with `setTranslator`).
- The connections graph (`src/explorer/graph/`): a band per layer down the page, a dot per neuron side
  and a bar per head, both in the depth colour of their layer. A link is as heavy as its
  flow, in the depth colour of its source, or grey and dashed where it pushes against: the one hue is depth.
  A head is a node like a neuron, with links both ways. On a head's own page, what feeds it is what feeds the input chosen
  (Value, Query or Key). A path through any other head goes by its value, and a path into a head's query or key stops there,
  because what those set is where the head looks.
- The full-screen graph (`src/explorer/graph/Navigator.svelte`, at a unit's address with `?graph`): the same marks, links
  and motion, opening at 1.5 times the rail's size and moved like a map (drag or scroll, pinch or ⌘/ctrl-scroll or the zoom
  buttons). Titles stay one size on screen at any zoom, wrapped on the tip's frosted glass, and each sits where it
  touches no mark and no other title: the unit's first, then by flow, under its mark if it can, else over it or beside it.
  A title with no room waits for a closer zoom, and its tip still names it. Rows are spaced for a two-line title under
  each mark at the opening zoom. The bar over it holds the unit, the views and the reach; the depth axis down the left
  names the bands; the credit sits at the foot, so a screenshot carries it.
- The graph's motion (`src/explorer/graph/stage.ts`), on Ledger's curve and durations, all on one clock so a link
  never parts from its nodes. Arriving: the unit swells in; its neighbours bud from it ring by ring (at most
  340 ms in all, strongest first, each link growing with its node); the links that make it a graph draw in behind them; the
  finished graph untangles.
  What stays glides, what goes withdraws into what it budded from, and any change takes over from wherever things are.
  Reduced motion keeps the fades and drops the rest.

The explorer's one credit is "Labels by Claude Haiku 5.5".

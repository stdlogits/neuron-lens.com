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
- The search (`src/explorer/Search.svelte`, matching in `search/engine.ts`), as wide as the atlas under it. A word finds
  the curated neurons' poles and the heads whose labels hold it; an ID (or a unit's pasted address) opens its unit, and
  "L8" or "layer 8" its layer. Each word counts: units matching every word come first, and a title holding the whole
  phrase rises; a quoted phrase must be in the title. A word with nothing close is matched within a typo or two (≈), and
  a query that finds nothing offers what it might mean. Each result shows its layer's depth colour, the query marked in
  its title in the tint's wash (with the browser's highlights, so the title stays a `LabelText`), what it matched, and
  a track of where it sits in depth; chips narrow it to neurons or heads, and it shows ten at a time. Every match lights
  on the atlas; the one arrowed to or pointed at is picked out there too. An empty field shows the recent searches (this
  browser only). ⌘/ctrl-click or a middle click opens a result in a new tab; a press outside puts the results away.
  As the query changes, results that stay glide to their new places (240 ms), those that go fade (120 ms) and new ones
  rise; the chips' paper slides like a segmented control's, counts morph, and the notes open and close. On the atlas,
  a change of what is lit (a search, a filter) spreads out from the best match's layer, 10 ms a layer, at most 300 ms;
  a bar pointed at or looked at never waits. A result looked at for 180 ms starts loading its unit, so it opens ready.
  Reduced motion keeps the fades and drops the glides.
- The connections graph (`src/explorer/graph/`): a band per layer down the page, a dot per neuron side
  and a bar per head, both in the depth colour of their layer. A link is as heavy as its
  flow, in the depth colour of its source, or grey and dashed where it pushes against: the one hue is depth.
  A head is a node like a neuron, with links both ways. On a head's own page, what feeds it is what feeds the input chosen
  (Value, Query or Key). A path through any other head goes by its value, and a path into a head's query or key stops there,
  because what those set is where the head looks.
- The full-screen graph (`src/explorer/graph/Navigator.svelte`, at a unit's address with `?graph`): the same marks, links
  and motion, opening at 1.5 times the rail's size and moved like a map (drag, scroll or the arrow keys; pinch,
  ⌘/ctrl-scroll, a double tap or the zoom buttons). A drag let go of while moving coasts. The view is held over the
  graph, whatever shape it has grown to: some mark always stays near the middle of the screen, and a drag or a scroll
  past that gives like a rubber band (a scroll only a little, however long a trackpad coasts) and springs back. It never
  zooms out further than the whole graph. Back to the unit glides there. The page under it never scrolls or zooms,
  whatever the pointer is over (the bar, a tip), and the view fits what the screen shows (a pinch-zoomed page, a phone's
  keyboard), so the bar stays whole. Titles stay one size on screen at any zoom, through a pinch too, wrapped on the
  tip's frosted glass, and each sits where it
  touches no mark and no other title: the unit's first, then by flow, under its mark if it can, else over it or beside it.
  A title with no room waits for a closer zoom, and its tip still names it; a title is part of its unit's target. Rows
  are spaced for a two-line title under each mark at the opening zoom. The bar over it holds the unit, the views, the
  reach, Back and Find, with close at the top right; on a phone the views and reach take a row under the unit. Find
  (the search button, "/" or ⌘/ctrl-F) takes a unit's ID (L8·n344, n344, L8, h3) or a word in a unit's title or among
  its labels (the search file): what it finds stays and rings once, the rest falls away, both spreading out from
  the middle of the screen, the view glides to take in what was found, and Enter steps from one to the next.
  The depth axis down the left names the bands; the credit sits at the foot, so a screenshot carries it.
- A tap (touch or pen) on a unit in either graph opens its card (`src/explorer/graph/Card.svelte`), the tip's words on
  the tip's glass low on the screen, with a button that goes there; a mouse's click still goes straight there.
- The graph's motion (`src/explorer/graph/stage.ts`), on Ledger's curve and durations, all on one clock so a link
  never parts from its nodes. Arriving: the unit swells in; its neighbours bud from it ring by ring (at most
  340 ms in all, strongest first, each link growing with its node); the links that make it a graph draw in behind them; the
  finished graph untangles.
  What stays glides, what goes withdraws into what it budded from, and any change takes over from wherever things are.
  A frame moves each mark by a transform alone, and draws the links as strokes on one canvas (`ink.ts`), in
  the navigator under its view so they stay sharp at any zoom, so a large graph moves as smoothly on a slow machine.
  In the navigator the canvas also paints each title's frosted glass (the titles are text alone), and a pan moves one
  layer holding the marks and the canvas by a translation, so panning paints nothing; marks don't take hover while the
  view moves, and during a pinch each title's own scale (set on it, not inherited, so no mark is restyled) keeps it one
  size on screen, while where the titles sit is worked out again only once the pinch rests.
  Reduced motion keeps the fades and drops the rest.

The explorer's one credit is "Labels by Claude Haiku 5.5".

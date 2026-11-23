# Design

The site is drawn in Ledger, the design language of Standard Logits, which lives in
[`stdlogits/ledger`](https://github.com/stdlogits/ledger) as the package `@stdlogits/ledger` (pinned in
`package.json`). Its [`DESIGN.md`](https://github.com/stdlogits/ledger/blob/main/DESIGN.md) is the
design: principles, tokens, type, motion and pieces. The copy at the pinned version is
`node_modules/@stdlogits/ledger/DESIGN.md`. A change to Ledger lands there first and reaches this site
as a pin bump.

What the site draws for itself, in Ledger:

- The depth ramp per model (`depthColor`, `src/lib/models.ts`), which the explorer sets as `--tint`
  for the current layer, and its depth bands. A read other than the one its depth's label cards rest on is quiet
  (the whole read at reduced opacity, full again when pointed at or focused) and comes last.
- The mark (`public/favicon.svg`), described in Ledger's DESIGN.md.
- The social card (`scripts/site/card.html` and `scripts/site/card/`), which is not one of Ledger's painted cards:
  flat paper like the site, with six of Qwen3-8B's neurons as small figures of what they fire on, each drawn as dots
  in its layer's colour along flowing strands, over the model's atlas as the explorer draws it. Its type is Ledger's
  `card.css`, and the depth ramp is still its only colour.
- A unit's link card (`src/explorer/LinkCard.svelte`, the unit's address with `?card`): the picture a shared link to a
  neuron or a head carries where the project draws them. Flat paper in the dark tokens, like the social card: the
  unit's pill and the site's name in one row, its label as the main wording (without the examples it ends on, and in
  the text face's italic where it is lent), what it fires on and what it makes the model say as tokens under their
  captions, and at the foot the explorer's own atlas, squashed into a strip, with the unit's layer lit and the unit
  marked. The light over the atlas is the unit's layer colour and the card's only effect.
- The card of a unit's connections (the same component, `?card=circuit`), which Discord shows, since its own text
  already carries the unit's words: the explorer's rail itself, laid out for a card. Its graph at true depth fills the
  left column, as large as fits, with the unit's own layer on the scale in ink and a little light about the links;
  on the right, under the same row and the unit's label, the three strongest of Driven by and of Drives and two
  Siblings, a line each. The rail's tools and mix stay out.
- The header's placement of `ThemeButton`, and the no-script summary's rules (`src/styles/site.css`).
- A pruned model's neuron, or its parent's, names its counterpart at the end of the unit's meta line, after its tags
  (`src/explorer/unit/UnitBar.svelte`): "From Qwen3-8B L20·n10768", "Likely from" where only the weights say so, "Kept
  in Qwen3-4B as …", "Cut from Qwen3-4B", and for a near-silent neuron the group it belongs to, unlinked. The neuron's
  ID is a link in the Credits page's underline (2 px, `--wash2`, `--ink3` on hover); the tip says how the match is known.
- The translations Ledger draws (`src/lib/translate.svelte.ts`, installed with `setTranslator`).
- The atlas's motion (`src/explorer/Atlas.svelte`, `atlas/Scale.svelte`). The page's first plot arrives column by column,
  as Ledger's motion says; after it, another model, or another unit, keeps the plot as it is until its units are in, then
  the bars move into theirs (240 ms): each layer's stack glides to its share of the width, a model with more layers
  bringing the new ones in from the right edge and one with fewer letting the rest slide off it and fade, while every
  bar takes its new strength and depth colour, new bars fade in and spare ones fade out. The layer numbers and band
  names glide with the columns, and the column wash with them. The All field, a canvas, crossfades instead.
- The search (`src/explorer/Search.svelte`, matching in `search/engine.ts`), as wide as the atlas under it. A word finds
  the curated neurons' poles and the heads whose labels hold it; an ID (or a unit's pasted address) opens its unit, and
  "L8" or "layer 8" its layer. Each word counts: units matching every word come first, and a title holding the whole
  phrase rises; a quoted phrase must be in the title. A word with nothing close is matched within a typo or two (≈), and
  a query that finds nothing offers what it might mean. Each result shows its layer's depth colour, the query marked in
  its title in the tint's wash (with the browser's highlights, so the title stays a `LabelText`), what it matched, and
  a track of where it sits in depth; chips narrow it to neurons or heads, and it shows ten at a time. Every match lights
  on the atlas; the one arrowed to or pointed at is picked out there too. An empty field shows the recent searches (this
  browser only). ⌘/ctrl-click or a middle click opens a result in a new tab; a press outside puts the results away.
  Random (or r) opens a curated neuron or a head at random.
  As the query changes, results that stay glide to their new places (240 ms), those that go fade (120 ms) and new ones
  rise; the chips' paper slides like a segmented control's, counts morph, and the notes open and close. On the atlas,
  a change of what is lit (a search, a filter) spreads out from the best match's layer, 10 ms a layer, at most 300 ms;
  a bar pointed at or looked at never waits, and moving into another model's units never sweeps. A result looked at for 180 ms starts loading its unit, so it opens ready.
  Reduced motion keeps the fades and drops the glides.
- The unit and its connections by the width the explorer has (`Explorer.svelte`'s panes, container queries on the
  explorer, not the screen). Under 736 px (a phone, a narrow window, a tablet upright) one column: the unit first, its
  number, band and labels in the first screen under the atlas, then its baskets, then its connections, which the
  basket bar then ends with ("Connections", `unit/BasketBar.svelte`), so they are a tap away; from 600 px their lists
  stand beside their graph. From 736 px two columns: the connections on the left at the 340 px they have on a desktop
  (their controls need it), graph above lists, and the unit on the right with all it has, its own two columns from
  600 px of its width; from 1028 px the gap widens to a desktop's. Side by side, the two columns are as tall as the
  screen and each scrolls on its own, as a mail app's list and message do, while the page around them scrolls as any
  page (`src/explorer/panes.ts`): a scroll over a column while they are only partly on screen moves the page first,
  until they fill it, and a column at its end hands the scroll back to the page, on to the footer. Where a scroll
  can't be redirected (touch), the page settles onto the columns when it comes to rest near them (CSS scroll snapping,
  proximity), and onto its foot near the end. A new unit opens both columns from their tops; the basket bar reads
  the unit's column, and search brings the columns right to the top of the screen.
- The connections graph (`src/explorer/graph/`): a band per layer down the page, a dot per neuron side
  and a bar per head, both in the depth colour of their layer. A link is as heavy as its
  flow, in the depth colour of its source, or grey and dashed where it pushes against: the one hue is depth.
  A head is a node like a neuron, with links both ways. On a head's own page, what feeds it is what feeds the input chosen
  (Value, Query or Key). A path through any other head goes by its value, and a path into a head's query or key stops there,
  because what those set is where the head looks. The unit's own row, which no link reaches, holds its siblings, split
  evenly to its left and right, each on the side nearer what it shares: smaller marks, linked only to the parents and
  children they share with it, and lighting those and the unit's own links to them when pointed at. The rail lists them
  under Siblings, each with how many of the unit's sources (↑) and of what it feeds (↓) it shares. The rail shows only the layers the graph reaches, as far apart as
  ever, with the same room above its first row and below its last; the layer numbers down the left keep to them, and a ^
  at the top (a v at the bottom) stands for the layers left out, its tip saying how many.
- The full-screen graph (`src/explorer/graph/Navigator.svelte`, at a unit's address with `?graph`): the same marks, links
  and motion, opening at 1.5 times the rail's size and moved like a map (drag, scroll or the arrow keys; pinch,
  ⌘/ctrl-scroll, a double tap or the zoom buttons). A drag let go of while moving coasts. The view is held over the
  graph, whatever shape it has grown to: its edges stop just past the outermost marks and their titles (down, the
  topmost and bottommost; across, the widest in the rows on screen), so the screen never shows mostly nothing; a unit
  at the top or bottom of its graph is centred no further than that allows. A drag or a scroll past that gives like a rubber band (a scroll only a little, however long a trackpad coasts) and springs back. It never
  zooms out further than the whole graph. Back to the unit glides there. The page under it never scrolls or zooms,
  whatever the pointer is over (the bar, a tip), and the view fits what the screen shows (a pinch-zoomed page, a phone's
  keyboard), so the bar stays whole. Titles stay one size on screen at any zoom, through a pinch too, wrapped on the
  tip's frosted glass, and each sits where it
  touches no mark and no other title: the unit's first, then by flow, under its mark if it can, else over it or beside it.
  A title with no room waits for a closer zoom, and its tip still names it; a title is part of its unit's target. Rows
  are spaced for a two-line title under each mark at the opening zoom. The bar over it holds the unit, the views, the
  reach, Back and Find, with close at the top right; on a phone the views and reach take a row under the unit. Find
  (the search button, "/" or ⌘/ctrl-F) takes a unit's ID (L8·n344, n344, L8, h3) or a word in a unit's title or among
  its labels (the word index): what it finds stays and rings once, the rest falls away, both spreading out from
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
- The missing page (`src/pages/NotFound.svelte`, its kinds in `src/pages/missing/`) shows what is wrong with the
  address, as the router found it (`src/lib/missing.ts`), and plays it once, as the Standard Logits hero plays its list:
  it moves fastest through what matters least and slows where the answer forms; pointing, a tap or the arrow keys take
  over; reduced motion shows where it lands. Every kind ends on a headline whose slot is marked as the hero marks its
  token (the depth tint at 22%, in the wash where it names something the model doesn't have), one line, and the ways
  back. A page the router can't read: "404" drawn in 404 dots, each a Qwen3-8B neuron whose label names an absence
  (`absent.json`, from `scripts/site/absent.mjs`), arriving in their layers and travelling into the figure while the
  name under it runs through a dozen and lands on L18·n3025, the not-found neuron; a lens follows the pointer, and "In
  the model" sends the dots back to their layers; the way back offers the nearest real address when a fix is small. A
  model the site doesn't have: the hero's own list, the models ranked by a softmax of minus each one's edit distance
  from what was typed, the slot running up it to the nearest, and the way back keeping the place in that model,
  clipped to its shape. A layer, a neuron or a head past the model's shape: a ride along that axis on one clock
  (`motion.ts`), easing up to the last the model has, a hold, then on into the part that isn't there, landing on the
  number asked. Layers are the atlas's columns (each layer's neurons at fourteen ranks, shaded as the atlas shades
  them); a layer's neurons are a cell each, as the All field draws them, crossed by an ink playhead; a layer's heads are
  a column each of where it attends. What the ride passes lights up from dim; what isn't there arrives in the wash. The
  number counts plainly while it rides, holds still a moment, then rolls into place (`roll.ts`): each digit that
  changes slides up out of its line as the new one rises in, 24 ms apart, started in the frame of the change, since
  Ledger's `MorphText` paints a change made in an animation frame one frame late. The names under the drawings change
  in place while a run passes them, and morph again once it rests; the depth tint is set on the headline alone, so a
  layer's change restyles only it and not the atlas's bars.

The explorer's one credit is "Labels by Claude Haiku 5.5"; a base model's adds ", written for" its post-trained model,
and its labels are italic wherever they show, as lent (Ledger's `lent`): the unit's faces and the labeller's note, the
rail, both graphs' titles, tips and cards, the search's results and the atlas's tips.

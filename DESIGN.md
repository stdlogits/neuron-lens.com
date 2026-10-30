# Design

Neuron Lens is drawn in one language, "Ledger": white paper, two washes, three inks, one accent, no
lines. It is where Drowse's next look is being tried out, so what works here may travel.

## Principles

- **Flat and borderless.** Surfaces are told apart by fill alone: paper, then `--wash`, then
  `--wash2` for something chosen. No borders, rules, outlines (except focus), side bars or shadows.
  The one shadow is under the tip, a pane of frosted glass in the page's own colours.
- **One accent, sparingly.** The accent is depth: a layer's place on the ramp from `--deep` (violet,
  layer 0) to `--late` (cyan, the last layer), set as `--tint` by the explorer for the current
  layer. It fills (a marked token, a meter, a bar); it never colours text.
- **Show, don't tell.** No explanatory paragraphs or provenance in the explorer. A number, a token
  or a picture beats a sentence; a sentence that is still needed goes in a tip (`data-tip`) or on
  the About page. The one credit in the explorer is "Labels by Claude Haiku 5.5".
- **One family.** Wix Madefor Display for titles and IDs, Wix Madefor Text for everything else.
  No monospace, no capitals, tabular numerals wherever numbers line up.
- **Motion everywhere, noticed nowhere.** Every change moves, quickly, on one curve. Nothing loops,
  pulses, sweeps or ripples.

## Tokens (`src/styles/tokens.css`)

| | light | dark |
| --- | --- | --- |
| `--paper` | `#FFFFFF` | `#0B0D12` |
| `--wash` | `#F4F5F7` | `#151821` |
| `--wash2` | `#EBEDF1` | `#1D212B` |
| `--ink` | `#0E1117` | `#EEF1F7` |
| `--ink2` | `#464F61` | `#AEB6C6` |
| `--ink3` | `#636B7D` | `#8A93A6` |
| `--deep` | `#6A4FE0` | `#A08BFF` |
| `--late` | `#0B87AD` | `#4FD8F5` |

Tints of the accent, always mixed with `color-mix(in oklch, …)`: 9% (a token a head attended to),
14% (a token two reads agree on), 22% (the token a unit fired on), 26% (variants of a hovered token).

Type, as `font:` shorthands: `--type-title` 56 Display 600, `--type-heading` 32 Display 600,
`--type-lead` 20/500, `--type-label` 16/500, `--type-body` 16/400, `--type-small` 14/400,
`--type-control` 14/500, `--type-meta` 12/500, `--type-head` 12/600 (section heads, in `--ink3`).

Space: `--s1`…`--s9` = 4, 8, 12, 16, 24, 32, 48, 64, 96. Radii: `--r-chip` 6, `--r-col` 8,
`--r-box` 12, `--r-row` 16, `--r-pill`.

## Motion (`src/lib/motion.ts`)

One curve, `--ease` = `cubic-bezier(.2, 0, 0, 1)` (`ease` in JS).

| What | How |
| --- | --- |
| Hover, press | 120 ms (`--fast`): colour or wash; buttons press to 0.97 |
| A selection moving | 240 ms (`--glide`): the `glide` action slides one thumb under the chosen child (segmented controls, the atlas column, the layer list, the faces table) |
| Content changing | out 120 ms, in 200 ms with a 6 px rise (`Swap`, `rise`, `fadeOut`) |
| Lists appearing | 24 ms apart, 160 ms at most (`.rise` with `--i`, `stagger(i)`) |
| Opening | height and fade together, 240 ms (`Expander`, `expand`) |
| The atlas arriving | columns 16 ms apart, once per load |
| Pages, theme | the new view fades in over the old (view transitions) |
| Text that changes in place | letter morph (`MorphText`, Torph) |

Reduced motion keeps fades and drops movement.

## Pieces (`src/ui`)

`Segmented` (a few exclusive options, ink thumb), `Tabs` (many options, text only), `Token` (a wash
chip; · marks a word start, ×n variants, a value in 12 px), `Context` (a firing on a wash, the token
marked), `LabelText` (a label whose foreign terms translate), `Switch`, `IconButton` (36 px round
wash), `Icon`, `Expander` (a text button that opens below), `Meter` (a 24 × 4 tint bar), `Swap`,
`MorphText`. The tip (frosted glass, blurred behind) is one element for the site (`src/lib/tips.ts`): give anything `data-tip`
(and optionally `data-tip-title`, `data-tip-sub`), or call `showTip`/`hideTip`.

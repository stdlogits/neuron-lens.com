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

The explorer's one credit is "Labels by Claude Haiku 5.5".

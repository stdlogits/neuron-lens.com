<script lang="ts">
  import { MorphText, fadeOut, rise } from "@stdlogits/ledger";

  // A unit, named under what the missing page draws: its ID in the display face, then its label (a lent label, a base
  // model's, in the text face's italic). The label changes as Ledger's Swap changes content, except while a run moves
  // through units faster than that, when it changes in place.
  let { id, label, href, lent = false, quiet = false }: { id: string; label: string; href: string; lent?: boolean; quiet?: boolean } = $props();
</script>

<a class="readout" class:lent {href}>
  <b><MorphText text={id} numbers={false} /></b>
  <span class="label">
    {#key label}<span class="line" in:rise={{ duration: quiet ? 0 : 200 }} out:fadeOut={{ duration: quiet ? 0 : 120 }}>{label}</span>{/key}
  </span>
</a>

<style>
  .readout { display: flex; align-items: baseline; gap: var(--s3); min-width: 0; min-height: 24px; color: var(--ink); text-decoration: none; }
  b { flex: none; font: 600 16px/24px var(--display); letter-spacing: -0.01em; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .label { display: grid; min-width: 0; }
  .line { grid-area: 1 / 1; min-width: 0; overflow: hidden; color: var(--ink2); font: var(--type-small); white-space: nowrap; text-overflow: ellipsis; }
  .lent .line { font-style: italic; }
  @media (hover: hover) { .readout:hover .line { color: var(--ink); } }
</style>

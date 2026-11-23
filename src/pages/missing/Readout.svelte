<script lang="ts">
  import { MorphText, fadeOut, rise } from "@stdlogits/ledger";

  // A unit, named under what the missing page draws: its ID in the display face, then its label (a lent label, a base
  // model's, in the text face's italic). The ID morphs and the label changes as Ledger's Swap changes content, except
  // while a run moves through units faster than either can (`quiet`), when both change in place, so neither starts only
  // to be cut off.
  let { id, label, href, lent = false, quiet = false }: { id: string; label: string; href: string; lent?: boolean; quiet?: boolean } = $props();
</script>

<a class="readout" class:lent {href}>
  <b>{#if quiet}{id}{:else}<MorphText text={id} numbers={false} />{/if}</b>
  <span class="label">
    {#if quiet}<span class="line">{label}</span>{:else}{#key label}<span class="line" in:rise out:fadeOut>{label}</span>{/key}{/if}
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

<script lang="ts">
  import { PATTERN_NAMES, PATTERN_THRESHOLDS, type HeadDetail } from "../../lib/data";

  // Where a head looks, as five tiny bars: attention to the first position, the token before and
  // itself, and its induction and duplicate-token scores. Those past the catalog's threshold are in ink.
  let { pattern }: { pattern: HeadDetail["pattern"] } = $props();

  const TIPS = [
    "Attention to the first position, a resting place",
    "Attention to the token just before",
    "Attention to its own position",
    "On repeated text, attention to the token after the earlier copy",
    "On repeated text, attention to the earlier copy of the current token",
  ];
  const rows = $derived(PATTERN_NAMES.map((name, i) => ({ name, value: pattern[i], on: pattern[i] > PATTERN_THRESHOLDS[i], tip: `${TIPS[i]}. Named past ${PATTERN_THRESHOLDS[i]}.` })));
</script>

<dl class="pat">
  {#each rows as row (row.name)}
    <div class:on={row.on}>
      <dt data-tip={row.tip}>{row.name}</dt>
      <dd><span class="tr" aria-hidden="true"><i style:transform="scaleX({Math.max(0.03, Math.min(1, row.value))})"></i></span><span class="v">{row.value.toFixed(2)}</span></dd>
    </div>
  {/each}
</dl>

<style>
  .pat { display: grid; gap: 6px; margin: 0; }
  .pat > div { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: var(--s2); }
  dt { color: var(--ink3); font: var(--type-meta); font-weight: 400; cursor: help; }
  dd { display: grid; grid-template-columns: minmax(0, 1fr) 32px; align-items: center; gap: var(--s2); margin: 0; }
  .tr { position: relative; height: 4px; border-radius: 2px; background: var(--wash2); overflow: hidden; }
  i { position: absolute; inset: 0; border-radius: 2px; background: color-mix(in oklch, var(--tint) 40%, var(--wash2)); transform-origin: left; transition: transform var(--glide) var(--ease); animation: fill var(--glide) var(--ease) backwards; }
  .v { color: var(--ink3); font: var(--type-meta); font-weight: 400; font-variant-numeric: tabular-nums; text-align: end; }
  .on dt { color: var(--ink); font-weight: 500; }
  .on i { background: var(--tint); }
  .on .v { color: var(--ink); }
  @keyframes fill { from { transform: scaleX(0); } }
  @media (prefers-reduced-motion: reduce) { i { animation: none; } }
</style>

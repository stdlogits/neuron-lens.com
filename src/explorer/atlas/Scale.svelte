<script lang="ts">
  import { bandOf, type ModelInfo } from "../../lib/models";

  // Beneath the atlas: each column's layer number (a dot under Gemma 4's global-attention layers
  // while heads are shown), then the depth bands spanning their columns.
  let { model, layer, hover, width, dots }: {
    model: ModelInfo;
    layer: number;
    /** The column under the pointer, if any. */
    hover: number | null;
    /** The atlas's width in px. */
    width: number;
    dots: boolean;
  } = $props();

  // About what two two-digit numbers need side by side.
  const ROOM = 22;
  const GAP = 12;
  const layers = $derived(Array.from({ length: model.layers }, (_, L) => L));
  const column = $derived((width || 1280) / model.layers);
  const global = $derived(new Set(model.globalLayers));
  const current = $derived(bandOf(model, layer));

  // Narrow maps number every few columns, plus the current one, and drop the numbers crowding it.
  const step = $derived([1, 2, 3, 4, 6, 8, 12].find((s) => s * column >= ROOM) ?? 12);
  const numbered = (L: number) => L === layer || (L % step === 0 && Math.abs(L - layer) * column >= ROOM);

  // Each band's word sits centred under its columns and may overhang them. Where words would collide,
  // the current band's wins, then the one under the pointer, then the widest band: a narrow band
  // names itself whenever it is current, and its neighbours step aside.
  let words = $state<number[]>([]);
  const spans = $derived(model.bands.map((band, i) => {
    const left = band.first * column;
    const right = (band.last + 1) * column;
    const w = words[i] ?? 0;
    return { band, w, x: Math.max(0, Math.min((width || 1280) - w, (left + right) / 2 - w / 2)), room: right - left };
  }));
  const overlap = (a: { x: number; w: number }, b: { x: number; w: number }) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP;
  const named = $derived.by(() => {
    const now = model.bands.indexOf(current);
    const hot = hover === null ? -1 : model.bands.indexOf(bandOf(model, hover));
    const rank = (i: number) => (i === now ? 2 : i === hot ? 1 : 0);
    const order = spans.map((_, i) => i).sort((a, b) => rank(b) - rank(a) || spans[b].room - spans[a].room);
    const show = spans.map(() => false);
    for (const i of order) show[i] = spans.every((span, j) => !show[j] || !overlap(spans[i], span));
    return show;
  });
</script>

<div class="nums" class:dotted={model.globalLayers.length > 0} style:--count={model.layers} aria-hidden="true">
  {#each layers as L (L)}
    <span class="cell" class:on={L === layer}>
      <span class="n" class:shown={numbered(L)}>{L}</span>
      {#if global.has(L)}<i class:shown={dots}></i>{/if}
    </span>
  {/each}
</div>
<div class="bands" aria-hidden="true">
  {#each spans as span, i (span.band.key)}
    <span class="band" class:on={span.band === current} class:shown={named[i]} style:translate="{span.x}px 0" bind:offsetWidth={words[i]}>{span.band.short}</span>
  {/each}
</div>

<style>
  .nums { display: grid; grid-template-columns: repeat(var(--count), minmax(0, 1fr)); height: 16px; }
  .nums.dotted { height: 22px; }
  .cell { position: relative; }
  /* Numbers are centred on their column and may overhang it: narrow columns are thinned instead. */
  .n {
    position: absolute;
    left: 50%;
    top: 0;
    translate: -50% 0;
    color: var(--ink3);
    font: var(--type-meta);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    opacity: 0;
    transition: opacity var(--fast) var(--ease), color var(--glide) var(--ease);
  }
  /* The end numbers stay inside the map when their columns are narrower than they are. */
  .cell:first-child .n { left: max(0px, 50% - 0.5ch); translate: none; }
  .cell:last-child .n { left: auto; right: max(0px, 50% - 1ch); translate: none; }
  .n.shown { opacity: 1; }
  .on .n { color: var(--ink); font-weight: 600; }
  .cell i {
    position: absolute;
    left: 50%;
    top: 18px;
    width: 4px;
    height: 4px;
    margin-left: -2px;
    border-radius: 50%;
    background: var(--ink3);
    opacity: 0;
    transition: opacity var(--in) var(--ease), background-color var(--glide) var(--ease);
  }
  .cell i.shown { opacity: 1; }
  .on i { background: var(--ink); }

  .bands { position: relative; height: 16px; margin-top: var(--s1); }
  .band {
    position: absolute;
    left: 0;
    top: 0;
    color: var(--ink3);
    font: var(--type-meta);
    font-weight: 400;
    white-space: nowrap;
    opacity: 0;
    transition: opacity var(--glide) var(--ease), color var(--glide) var(--ease);
  }
  .band.shown { opacity: 1; }
  .band.on { color: var(--ink); font-weight: 500; }
</style>

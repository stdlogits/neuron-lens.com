<script lang="ts">
  import { onMount } from "svelte";
  import MorphText from "../ui/MorphText.svelte";
  import LayerItems, { type ListItem } from "./unit/LayerItems.svelte";
  import { fadeOut } from "../lib/motion";
  import { matchKey, useLens } from "./lens.svelte";
  import type { HeadRow } from "../lib/data";

  // The chosen layer: its number and depth, then its units, easiest first. A new layer crossfades
  // the list, and its items rise in sequence.
  const lens = useLens();

  const CARD = { fires: 0, attends: 1, writes: 2 } as const;
  // A head row's labels sit at 3–5 and their confidences at 6–8, in the order fires, attends, writes.
  const headLabel = (row: HeadRow, k: number) => row[3 + k] as string;
  const headConf = (row: HeadRow, k: number) => row[6 + k] as number;
  const items = $derived.by<ListItem[]>(() => {
    if (lens.unit === "heads") {
      const [a, b] = lens.model.headCard.map((side) => CARD[side]);
      return lens.listHeads.map((row) => ({
        index: row[1],
        id: `h${row[1]}`,
        href: lens.unitHref("heads", row[0], row[1]),
        first: headLabel(row, a),
        firstLow: headConf(row, a) < 25,
        second: headLabel(row, b),
        secondLow: headConf(row, b) < 25,
        match: lens.matches.heads.has(matchKey(row[0], row[1])),
      }));
    }
    return lens.listNeurons.map((row) => ({
      index: row[1],
      id: `n${row[1]}`,
      href: lens.unitHref("neurons", row[0], row[1]),
      first: row[2],
      firstLow: row[6] < 25,
      second: row[3],
      secondLow: row[7] < 25,
      match: lens.matches.neurons.has(matchKey(row[0], row[1])),
    }));
  });

  // The rows have loaded for this place (the filter may still leave none).
  const loaded = $derived(lens.unit === "heads" ? lens.heads !== null : lens.all ? lens.layerRows?.model === lens.modelId && lens.layerRows.layer === lens.layer : lens.index?.id === lens.modelId);
  const listKey = $derived(`${lens.modelId}/${lens.unit}/${lens.layer}/${lens.all}/${lens.activeFilter.value}/${loaded}/${lens.listFailed}`);
  const sub = $derived(`${lens.band.name}, ${lens.unit === "heads" && lens.globalLayer ? "global attention" : "easiest first"}`);

  // A phone shows fewer before the button, so the unit isn't far below.
  let narrow = $state(false);
  onMount(() => {
    const query = matchMedia("(max-width: 720px)");
    const sync = () => (narrow = query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  });
</script>

<nav class="layer" aria-labelledby="layer-title">
  <div class="title">
    <h2 id="layer-title">Layer <MorphText text={lens.layer} /></h2>
    <p class="sub"><MorphText text={sub} numbers={false} /></p>
  </div>
  <div class="slot">
    {#key listKey}
      <div class="body" out:fadeOut>
        {#if !loaded && lens.listFailed}
          <p class="none rise">This layer's list didn't load. <button type="button" class="retry" onclick={() => lens.retry()}>Try again</button></p>
        {:else if !loaded}
          <div class="pending" aria-hidden="true">{#each { length: narrow ? 4 : 8 } as _, i (i)}<i></i>{/each}</div>
        {:else if items.length === 0}
          <p class="none rise">None in this layer</p>
        {:else}
          <LayerItems {items} selected={lens.selected} layer={lens.layer} first={narrow ? 5 : 12} page={lens.all ? 40 : Infinity} />
        {/if}
      </div>
    {/key}
  </div>
</nav>

<style>
  .layer { flex: 1 1 320px; max-width: 360px; display: grid; align-content: start; gap: var(--s4); min-width: 0; }
  @media (max-width: 720px) { .layer { max-width: none; } }
  .title { display: grid; padding: 0 var(--s4); }
  h2 { font: var(--type-heading); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .sub { color: var(--ink3); font: var(--type-small); }
  .slot { display: grid; min-width: 0; }
  .body { grid-area: 1 / 1; min-width: 0; }
  .none { padding: var(--s3) var(--s4); color: var(--ink3); font: var(--type-small); }
  .retry { display: block; margin-top: var(--s2); padding: 0; border: 0; background: none; color: var(--ink); font: var(--type-control); cursor: pointer; transition: color var(--fast) var(--ease); }
  @media (hover: hover) { .retry:hover { color: var(--ink2); } }
  .pending { display: grid; gap: 2px; animation: appear var(--in) var(--ease) 150ms backwards; }
  .pending i { display: block; height: 72px; border-radius: var(--r-box); background: var(--wash); }
  .pending i:nth-child(even) { height: 52px; }
  @keyframes appear { from { opacity: 0; } }
</style>

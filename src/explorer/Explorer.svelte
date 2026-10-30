<script lang="ts">
  import { onMount } from "svelte";
  import Segmented from "../ui/Segmented.svelte";
  import Tabs from "../ui/Tabs.svelte";
  import Swap from "../ui/Swap.svelte";
  import MorphText from "../ui/MorphText.svelte";
  import Search from "./Search.svelte";
  import Atlas from "./Atlas.svelte";
  import LayerList from "./LayerList.svelte";
  import UnitView from "./UnitView.svelte";
  import { Lens, provideLens } from "./lens.svelte";
  import { MODELS, MODEL_ORDER } from "../lib/models";
  import { formatCount, type Unit } from "../lib/data";

  // The explorer: the model and a search, then the atlas of every layer, then the chosen layer's
  // list beside the chosen unit. Everything below the intro follows the address (lens.svelte.ts).
  const lens = new Lens();
  provideLens(lens);

  const models = MODEL_ORDER.map((id) => ({ value: id, label: MODELS[id].name }));
  const units: { value: Unit; label: string }[] = [{ value: "neurons", label: "Neurons" }, { value: "heads", label: "Heads" }];
  const scopes = $derived(lens.unit === "heads"
    ? [{ value: "all", label: "All", count: formatCount(lens.totals.heads) }]
    : [
      { value: "easiest", label: "Easiest", count: lens.totals.easiest === null ? "" : formatCount(lens.totals.easiest), hint: "The neurons easiest to read, 40 a layer" },
      { value: "all", label: "All", count: formatCount(lens.totals.neurons) },
    ]);

  // j and k step through the layer; / finds the search.
  function keys(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, textarea, select, [role='slider'], [contenteditable]")) return;
    if (event.key === "j" || event.key === "k") { event.preventDefault(); lens.step(event.key === "j" ? 1 : -1); }
  }
  onMount(() => {
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  });
</script>

<div class="explorer" style:--tint={lens.tint}>
  <section class="intro" aria-labelledby="title">
    <h1 id="title" class="rise">Neuron Lens</h1>
    <div class="rise" style:--i="1"><Segmented options={models} value={lens.modelId} onchange={lens.setModel} label="Model" /></div>
    <div class="rise" style:--i="2">
      <Swap key={lens.modelId}><p class="lede">{lens.model.lede}</p></Swap>
    </div>
    <p class="figures rise" style:--i="3">
      {#each lens.figures as figure (figure.label)}<span><b><MorphText text={figure.value} /></b> {figure.label}</span>{/each}
    </p>
    <div class="find rise" style:--i="4"><Search /></div>
  </section>

  <section class="map" aria-label="Every layer">
    <div class="toolbar">
      <div class="left">
        <Segmented options={units} value={lens.unit} onchange={lens.setUnit} label="Units" />
        <Tabs options={scopes} value={lens.unit === "heads" || lens.all ? "all" : "easiest"} onchange={(value) => lens.setAll(value === "all")} label="Which units" />
      </div>
      <Tabs options={lens.filters} value={lens.activeFilter.value} onchange={(value) => (lens.filter = value)} label="Filter" />
    </div>
    <Atlas />
  </section>

  {#if lens.failed && !lens.index}
    <p class="notice" role="alert">The catalog didn't load. Check your connection and reload the page.</p>
  {:else}
    <section class="panes" id="layer">
      <LayerList />
      <UnitView />
    </section>
  {/if}

  <p class="foot meta">
    <span><kbd>j</kbd> <kbd>k</kbd> step through a layer</span>
    <span><kbd>/</kbd> search</span>
    {#if lens.model.media.length}<span>Images and sounds shown under their licences, listed in <a class="prose-link" href="/credits">Credits</a></span>{/if}
  </p>
</div>

<style>
  .explorer { display: grid; gap: var(--s7); min-width: 0; transition: --tint var(--glide) var(--ease); }
  .intro { display: grid; justify-items: start; gap: var(--s5); }
  h1 { font: var(--type-title); letter-spacing: -0.04em; }
  .lede { max-width: 56ch; color: var(--ink2); font: var(--type-body); }
  .figures { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s5); color: var(--ink3); font: var(--type-small); }
  .figures b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  .find { width: min(100%, 640px); }
  .map { display: grid; gap: var(--s4); min-width: 0; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s4); }
  .left { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s5); }
  .panes { display: flex; flex-wrap: wrap; align-items: start; gap: var(--s7); scroll-margin-top: var(--s5); }
  .notice { color: var(--ink2); }
  .foot { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s5); }
  kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 var(--s1); border-radius: var(--r-chip); background: var(--wash); color: var(--ink2); font: var(--type-meta); }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { MorphText, Segmented, Tabs } from "@stdlogits/ledger";
  import Search from "./Search.svelte";
  import Atlas from "./Atlas.svelte";
  import Connections from "./graph/Connections.svelte";
  import UnitView from "./UnitView.svelte";
  import { Lens, provideLens } from "./lens.svelte";
  import { MODELS, MODEL_ORDER } from "../lib/models";
  import { formatCount, type Unit } from "../lib/data";

  // The explorer: the model and a search, then the atlas of every layer, then the chosen layer's
  // list beside the chosen unit. Everything below the intro follows the address (lens.svelte.ts).
  const lens = new Lens();
  provideLens(lens);

  const models = MODEL_ORDER.map((id) => {
    const { name, layers, mlp, heads, media } = MODELS[id];
    return { value: id, label: name, hint: `${layers} layers, each ${formatCount(mlp)} neurons and ${heads} attention heads.${media.length ? " It also takes in images and sound." : " It reads text."}` };
  });
  const units: { value: Unit; label: string; hint: string }[] = [
    { value: "neurons", label: "Neurons", hint: "Single units of each layer's MLP, each with a positive and a negative side" },
    { value: "heads", label: "Heads", hint: "Attention heads: what each looks back at, and what it carries forward from there" },
  ];
  const scopes = $derived(lens.unit === "heads"
    ? [{ value: "all", label: "All", count: formatCount(lens.totals.heads), hint: "Every attention head of the model" }]
    : [
      { value: "easiest", label: "Easiest", count: lens.totals.easiest === null ? "" : formatCount(lens.totals.easiest), hint: "The neurons easiest to read, 40 a layer" },
      { value: "all", label: "All", count: formatCount(lens.totals.neurons), hint: "Every neuron of the model" },
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
    <h1 id="title" class="rise">Explorer</h1>
    <div class="rise" style:--i="1"><Segmented options={models} value={lens.modelId} onchange={lens.setModel} label="Model" /></div>
    <p class="figures rise" style:--i="2">
      {#each lens.figures as figure (figure.label)}<span class="figure" data-tip={figure.tip}><b><MorphText text={figure.value} /></b> {figure.label}</span>{/each}
    </p>
    <div class="find rise" style:--i="3"><Search /></div>
  </section>

  <section class="map" aria-label="Every layer">
    <div class="toolbar">
      <div class="left">
        <Segmented options={units} value={lens.unit} onchange={lens.setUnit} label="Units" />
        <Tabs options={scopes} value={lens.unit === "heads" || lens.all ? "all" : "easiest"} onchange={(value) => lens.setAll(value === "all")} label="Which units" />
      </div>
      <div class="filters"><Tabs options={lens.filters} value={lens.activeFilter.value} onchange={(value) => (lens.filter = value)} label="Filter" scroll /></div>
    </div>
    <Atlas />
  </section>

  {#if lens.failed && !lens.index}
    <p class="notice" role="alert">The catalog didn't load. Check your connection and reload the page.</p>
  {:else}
    <section class="panes" id="layer">
      <Connections />
      <UnitView />
    </section>
  {/if}

  <p class="foot meta">
    <span><kbd>j</kbd> <kbd>k</kbd> step through a layer</span>
    <span><kbd>/</kbd> search</span>
    <span><kbd>r</kbd> a random unit</span>
    {#if lens.model.media.length}<span>Images and sounds shown under their licences, listed in <a class="prose-link" href="/credits">Credits</a></span>{/if}
  </p>
</div>

<style>
  /* A container, so the panes below can lay themselves out by the width they have (Connections.svelte). */
  .explorer { container: explorer / inline-size; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s7); min-width: 0; transition: --tint var(--glide) var(--ease); }
  .intro { display: grid; justify-items: start; gap: var(--s5); }
  h1 { font: var(--type-title); letter-spacing: -0.04em; }
  .figures { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s5); color: var(--ink3); font: var(--type-small); }
  .figure { cursor: help; }
  .figures b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  /* As wide as the atlas under it, so its results have room for what each says. */
  .find { width: 100%; }
  .map { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s4); min-width: 0; }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s4); min-width: 0; }
  .left { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s5); }
  .filters { min-width: 0; max-width: 100%; }
  .panes { display: flex; flex-wrap: wrap; align-items: start; gap: var(--s7); scroll-margin-top: var(--s5); }
  /* On a phone the chosen unit comes first, under the atlas; its connections follow it. */
  @media (max-width: 720px) { .panes > :global(aside.rail) { order: 2; } }
  .notice { color: var(--ink2); }
  .foot { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s5); }
  kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 var(--s1); border-radius: var(--r-chip); background: var(--wash); color: var(--ink2); font: var(--type-meta); }
</style>

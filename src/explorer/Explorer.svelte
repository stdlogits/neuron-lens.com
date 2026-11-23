<script lang="ts">
  import { onMount } from "svelte";
  import { MorphText, Segmented, Tabs } from "@stdlogits/ledger";
  import Search from "./Search.svelte";
  import Atlas from "./Atlas.svelte";
  import Connections from "./graph/Connections.svelte";
  import UnitView from "./UnitView.svelte";
  import { panes } from "./panes";
  import { Lens, provideLens } from "./lens.svelte";
  import { DEFAULT_MODEL, MODELS, MODEL_ORDER, type ModelInfo } from "../lib/models";
  import { formatCount, type Unit } from "../lib/data";

  // The explorer: the model and a search, then the atlas of every layer, then the chosen layer's
  // list beside the chosen unit. Everything below the intro follows the address (lens.svelte.ts).
  const lens = new Lens();
  provideLens(lens);

  // The model, in two rows: its family, then its size and (where both are up) post-trained or base.
  const listed = MODEL_ORDER.map((id) => MODELS[id]);
  const shape = ({ layers, mlp, heads, media }: ModelInfo) => `${layers} layers of ${formatCount(mlp)} neurons and ${heads} heads. ${media.length ? "Also images and sound." : "Text only."}`;
  const families = [...new Set(listed.map((model) => model.family))].map((family) => ({ value: family, label: family }));
  const sizes = $derived(listed.filter((model) => model.family === lens.model.family && model.base === lens.model.base).map((model) => ({ value: model.id, label: model.size, hint: shape(model) })));
  const kinds = $derived(new Set(listed.filter((model) => model.family === lens.model.family).map((model) => model.base)).size > 1
    ? [{ value: "post", label: "Post-trained", hint: "The model as released, trained to chat" }, { value: "base", label: "Base", hint: "The same model before post-training" }]
    : []);
  function setFamily(family: string) {
    const first = MODELS[DEFAULT_MODEL].family === family ? DEFAULT_MODEL : listed.find((model) => model.family === family)?.id;
    if (first) lens.setModel(first);
  }
  /** The other kind at the same size, or else at the nearest size there is. */
  function setKind(kind: string) {
    const base = kind === "base", size = Math.log(parseFloat(lens.model.size));
    const near = listed.filter((model) => model.family === lens.model.family && model.base === base)
      .sort((a, b) => Math.abs(Math.log(parseFloat(a.size)) - size) - Math.abs(Math.log(parseFloat(b.size)) - size))[0];
    if (near) lens.setModel(near.id);
  }
  const units: { value: Unit; label: string; hint: string }[] = [
    { value: "neurons", label: "Neurons", hint: "MLP units, each with two sides" },
    { value: "heads", label: "Heads", hint: "What each looks back at, and carries forward" },
  ];
  // Until the index says how many, the count holds a four-figure count's width (figure and punctuation spaces), so the
  // toolbar doesn't rewrap when it arrives.
  const WAITING = "\u2007\u2008\u2007\u2007\u2007";
  const scopes = $derived(lens.unit === "heads"
    ? [{ value: "all", label: "All", count: formatCount(lens.totals.heads), hint: "Every attention head of the model" }]
    : !lens.model.labelled
    ? [{ value: "all", label: "All", count: formatCount(lens.totals.neurons), hint: "Every neuron of the model" }]
    : [
      { value: "easiest", label: "Easiest", count: lens.totals.easiest === null ? WAITING : formatCount(lens.totals.easiest), hint: "The 40 easiest to read in each layer" },
      { value: "all", label: "All", count: formatCount(lens.totals.neurons), hint: "Every neuron of the model" },
    ]);

  // j and k step through the layer; / finds the search. Not while the connections are full screen, which stepping would close.
  function keys(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (lens.graphOpen || event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, textarea, select, [role='slider'], [contenteditable]")) return;
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
    <div class="pick rise" style:--i="1">
      <Segmented options={families} value={lens.model.family} onchange={setFamily} label="Model family" />
      <div class="row">
        <Segmented options={sizes} value={lens.modelId} onchange={lens.setModel} label="Size" />
        {#if kinds.length}<Segmented options={kinds} value={lens.model.base ? "base" : "post"} onchange={setKind} label="Post-trained or base" />{/if}
      </div>
    </div>
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

  {#if lens.failed && lens.index?.id !== lens.modelId}
    <p class="notice" role="alert">This model's catalog didn't load. <button type="button" class="prose-link" onclick={() => lens.retry()}>Try again</button></p>
  {:else}
    <!-- The unit comes first, for the keyboard and screen readers as on a phone's screen; side by side the connections stand on its left. -->
    <section class="panes" id="layer" use:panes>
      <UnitView />
      <Connections />
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
  .pick { display: grid; justify-items: start; gap: var(--s2); max-width: 100%; }
  .row { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); max-width: 100%; }
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
  /* The chosen unit and its connections, by the width the explorer has. Narrow (a phone, a small window), one column:
     the unit first, under the atlas, its connections after it, and the page scrolls them. From 736 px, two: the
     connections at the width they have on a desktop (340 px, which their controls need) on the left, the unit on the
     right with all it has, side by side as tall as the screen, and each column scrolls on its own (panes.ts brings
     them to the top of the screen before they do). From 1028 px the gap grows. A column is padded and drawn out by the
     same 4 px, so a focus ring at its edge isn't clipped by its scrolling. */
  .panes { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: var(--s7); scroll-margin-top: var(--s5); }
  @container explorer (min-width: 736px) {
    .panes { grid-template-columns: 340px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); column-gap: var(--s6); height: calc(100svh - 2 * var(--s5)); align-items: stretch; }
    .panes > :global(aside.rail) { order: -1; }
    .panes > :global(aside.rail), .panes > :global(article.view) { min-height: 0; margin: -4px; padding: 4px 4px var(--s7); overflow-y: auto; overscroll-behavior-y: auto; scrollbar-width: thin; }
  }
  @container explorer (min-width: 1028px) { .panes { column-gap: var(--s7); } }
  /* Where they stand side by side, the page settles onto them as a scroll ends near them, and onto its foot near the
     end (for touch, whose scrolls panes.ts can't redirect). */
  :global(html:has(#layer.split)) { scroll-snap-type: y proximity; }
  .panes:global(.split) { scroll-snap-align: start; }
  :global(html:has(#layer.split) .site > footer) { scroll-snap-align: end; }
  .notice { color: var(--ink2); }
  .notice button { border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }
  .foot { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s5); }
  kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 var(--s1); border-radius: var(--r-chip); background: var(--wash); color: var(--ink2); font: var(--type-meta); }
</style>

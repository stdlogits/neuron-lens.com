<script lang="ts">
  import "./pages.css";
  import Units from "./about/Units.svelte";
  import Labels from "./about/Labels.svelte";
  import Media from "./about/Media.svelte";
  import Firings from "./about/Firings.svelte";
  import Lenses from "./about/Lenses.svelte";
  import Columns from "./about/Columns.svelte";
  import Numbers from "./about/Numbers.svelte";
  import Depth from "./about/Depth.svelte";
  import Languages from "./about/Languages.svelte";
  import { reveal } from "./reveal";
  import { MODELS, MODEL_ORDER } from "../lib/models";
  import { formatCount } from "../lib/data";
  import { ensureTerms, translation } from "../lib/translate.svelte";

  // What Neuron Lens shows and how far to trust it, for a reader who knows AI but not interpretability,
  // told through real units from the catalog. First what neurons and heads are, then a walk down a
  // unit's view in the explorer's order, drawn with the explorer's own pieces: labels, images and
  // sound, firings, the lenses that read the weights, the evidence in its columns, numbers. Then how
  // far to trust it: depth, and other languages. Each specimen opens in the explorer.
  const neurons = MODEL_ORDER.reduce((sum, id) => sum + MODELS[id].layers * MODELS[id].mlp, 0);
  const heads = MODEL_ORDER.reduce((sum, id) => sum + MODELS[id].layers * MODELS[id].heads, 0);
  const figures = [
    { value: formatCount(neurons), label: "neurons" },
    { value: formatCount(heads), label: "heads" },
    { value: "15 million", label: "tokens of text" },
    { value: "50,000", label: "images" },
    { value: "47,000", label: "sounds" },
  ];

  $effect(() => { document.title = "About · Neuron Lens"; });
  // Its specimens come from both models, so with English on both models' terms load.
  $effect(() => { if (translation.on) for (const id of MODEL_ORDER) void ensureTerms(id); });
</script>

<article class="pg">
  <header class="pg-hero" use:reveal>
    <h1>About</h1>
    <p class="pg-lead">Neuron Lens shows what each neuron and attention head inside {MODELS["qwen3-8b"].name} and {MODELS["gemma-4-12b"].name} responds to and what it makes the model say. This page explains how they work.</p>
    <p class="figures">{#each figures as figure (figure.label)}<span><b>{figure.value}</b> {figure.label}</span>{/each}</p>
  </header>

  <Units />
  <Labels />
  <Media />
  <Firings />
  <Lenses />
  <Columns />
  <Numbers />
  <Depth />
  <Languages />

  <footer class="end" use:reveal>
    <a class="pg-go" href="/">Open the explorer</a>
    <a class="prose-link" href="https://github.com/stdlogits/neuron-lens" rel="external noreferrer">Research and findings</a>
    <a class="prose-link" href="/credits">Credits</a>
  </footer>
</article>

<style>
  .figures { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s5); color: var(--ink3); font: var(--type-small); }
  .figures b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  .end { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s5); }
</style>

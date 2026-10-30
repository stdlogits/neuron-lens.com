<script lang="ts">
  import "./pages.css";
  import Units from "./about/Units.svelte";
  import Sides from "./about/Sides.svelte";
  import Lenses from "./about/Lenses.svelte";
  import Evidence from "./about/Evidence.svelte";
  import Depth from "./about/Depth.svelte";
  import Heads from "./about/Heads.svelte";
  import Media from "./about/Media.svelte";
  import Checks from "./about/Checks.svelte";
  import Languages from "./about/Languages.svelte";
  import { reveal } from "./reveal";
  import { MODELS, MODEL_ORDER } from "../lib/models";
  import { formatCount } from "../lib/data";
  import { ensureTerms, translation } from "../lib/translate.svelte";

  // What Neuron Lens shows and how far to trust it, told through real units from the catalog: what
  // neurons and heads are, a pole's two halves, the lenses, three ways to read, depth, heads, images
  // and sound, the blind checks of the labels, and other languages. Each specimen opens in the explorer.
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
    <p class="pg-lead">Neuron Lens shows what each neuron and attention head inside {MODELS["qwen3-8b"].name} and {MODELS["gemma-4-12b"].name} responds to, and what it makes the model say.</p>
    <p class="figures">{#each figures as figure (figure.label)}<span><b>{figure.value}</b> {figure.label}</span>{/each}</p>
  </header>

  <Units />
  <Sides />
  <Lenses />
  <Evidence />
  <Depth />
  <Heads />
  <Media />
  <Checks />
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

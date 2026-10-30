<script lang="ts">
  import "./pages.css";
  import { reveal } from "./reveal";
  import { MODELS, DEFAULT_MODEL, depthColor } from "../lib/models";

  // An address the catalog doesn't have: a small atlas of layers, every column full of readable
  // neurons but the one this address points at, which is empty. Then the way back.
  const model = MODELS[DEFAULT_MODEL];
  const COLUMNS = 24;
  const BARS = 14;
  const EMPTY = 15;
  // A fixed, atlas-like spread: each column's bars fade from its most readable neuron down.
  const columns = Array.from({ length: COLUMNS }, (_, c) => {
    const layer = Math.round((c / (COLUMNS - 1)) * (model.layers - 1));
    const top = 0.55 + 0.45 * Math.abs(Math.sin(c * 1.7 + 0.4));
    return {
      color: depthColor(model, layer),
      bars: c === EMPTY ? [] : Array.from({ length: BARS }, (_, b) => Math.max(0.08, top * (1 - b / BARS) ** (1.2 + (c % 3) * 0.5))),
    };
  });

  $effect(() => { document.title = "Not found · Neuron Lens"; });
</script>

<article class="pg missing">
  <div class="atlas" aria-hidden="true">
    {#each columns as column, c (c)}
      <span class="col" class:empty={column.bars.length === 0} style:--c={column.color} style:--d="{c * 16}ms">
        {#each column.bars as opacity, b (b)}<i style:opacity={opacity}></i>{/each}
      </span>
    {/each}
  </div>
  <header class="pg-hero" use:reveal>
    <h1>Nothing fires here</h1>
    <p class="pg-lead">There's no page at this address.</p>
    <nav class="ways" aria-label="Ways back">
      <a class="pg-go" href="/">Open the explorer</a>
      <a class="prose-link" href="/about">About</a>
    </nav>
  </header>
</article>

<style>
  .missing { justify-items: start; gap: var(--s7); padding-top: var(--s7); }
  .atlas { display: grid; grid-template-columns: repeat(24, 24px); gap: 2px; max-width: 100%; }
  .col { display: grid; align-content: start; gap: 2px; justify-items: center; height: 100%; padding: var(--s2) 0; border-radius: var(--r-col); animation: drop var(--glide) var(--ease) backwards; animation-delay: var(--d); }
  .col i { display: block; width: 62%; height: 3px; border-radius: 2px; background: var(--c); }
  /* The one this address points at: chosen, and empty. */
  .col.empty { background: var(--wash); }
  @keyframes drop { from { opacity: 0; transform: translateY(-6px); } }
  .ways { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s5); margin-top: var(--s2); }
  @media (max-width: 600px) { .atlas { grid-template-columns: repeat(24, minmax(0, 1fr)); width: 100%; } }
  @media (prefers-reduced-motion: reduce) { .col { animation: none; } }
</style>

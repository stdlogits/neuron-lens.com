<script lang="ts">
  import { onMount } from "svelte";
  import { MorphText, glide, reducedMotion } from "@stdlogits/ledger";
  import { MODEL_ORDER, MODELS, type ModelInfo } from "../../lib/models";
  import { edits } from "../../lib/missing";
  import { sequence } from "./motion";
  import { clip } from "./place";

  // Model: the first part names no model the site has. The site's models ranked as a distribution over what was meant,
  // a softmax of minus each one's edit distance from what was typed, drawn as the Standard Logits hero draws what
  // Qwen3-8B-Base expects after "Standard": the slot runs up the list from the least likely, faster through the far
  // ones, slowing as it nears the top, and lands on the nearest. Pointing at a row puts it in the slot; choosing one
  // keeps it there. The way back keeps the address's place in that model, clipped to its shape.
  let { typed, rest }: { typed: string; rest: string[] } = $props();

  const TOP = 5;
  interface Ranked { model: ModelInfo; d: number; p: number; rank: number }
  const ranked: Ranked[] = $derived.by(() => {
    const lower = typed.toLowerCase();
    const d = MODEL_ORDER.map((id) => edits(lower, id));
    const least = Math.min(...d);
    const weights = d.map((x) => Math.exp(least - x));
    const sum = weights.reduce((a, b) => a + b, 0);
    return MODEL_ORDER.map((id, i) => ({ model: MODELS[id], d: d[i], p: weights[i] / sum, rank: 0 }))
      .sort((a, b) => b.p - a.p)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  });
  const max = $derived(ranked[0].p);
  const cased = $derived(MODEL_ORDER.includes(typed.toLowerCase()) && typed !== typed.toLowerCase());
  const say = $derived(!typed ? "The address names no model." : cased ? `Addresses are lower case, so there’s no model called “${typed}”.` : `There’s no model called “${typed}”.`);

  let chosen = $state(0);
  let pointed = $state<number | null>(null);
  // While the run passes the far models faster than a morph, the words change in place, so no morph starts only to be
  // cut off; from the first step held long enough, they morph again.
  let quick = $state(false);
  const shown = $derived(ranked[pointed ?? chosen]);
  const place = $derived(clip(shown.model, rest));
  const skipped = $derived(chosen >= TOP ? `${ranked[chosen].model.name}, rank ${chosen + 1} of ${ranked.length}` : `${ranked.length - TOP} more`);
  const percent = (p: number) => { const v = p * 100; return `${v >= 1 ? v.toFixed(1) : Number(v.toPrecision(2))}%`; };

  let stop = () => {};
  const halt = () => { stop(); quick = false; };
  function leave(event: FocusEvent) {
    const into = event.relatedTarget;
    if (!(into instanceof Node) || !(event.currentTarget as HTMLElement).contains(into)) pointed = null;
  }
  onMount(() => {
    if (reducedMotion()) return;
    const n = ranked.length;
    const steps: [number, number][] = [];
    for (let k = n - 1; k >= 1; k -= 1) steps.push([k, 60 + 360 * (1 - k / (n - 1)) ** 2]);
    const begin = window.setTimeout(() => {
      stop = sequence(steps, (k, i) => { quick = steps[i][1] < 240; chosen = k; }, () => { quick = false; chosen = 0; });
    }, 500);
    return () => { clearTimeout(begin); stop(); };
  });
</script>

{#snippet row(r: Ranked, i: number)}
  <button type="button" class="row" aria-pressed={i === chosen} style:--i={i} onclick={() => { halt(); chosen = i; }} onpointerenter={() => { halt(); pointed = i; }} onfocus={() => { halt(); pointed = i; }}>
    <span class="name">{r.model.name}</span>
    <span class="bar" aria-hidden="true"><i style:--w={r.p / max}></i></span>
    <span class="pct">{r.d} edit{r.d === 1 ? "" : "s"} · <b>{percent(r.p)}</b></span>
  </button>
{/snippet}

<section class="ms">
<div class="ms-text">
  <h1>Did you mean <span class="ms-slot">{#if quick}{shown.model.name}{:else}<MorphText text={shown.model.name} numbers={false} />{/if}</span>?</h1>
  <p class="ms-say">{say}</p>
</div>
<div class="dist" role="group" aria-label="The models the site has, closest to what was typed first. Choose one to put it in the headline." use:glide={"[aria-pressed='true'], .skip.on"} onpointerleave={() => (pointed = null)} onfocusout={leave}>
  {#each ranked.slice(0, TOP) as r, i (r.model.id)}{@render row(r, i)}{/each}
  {#if ranked.length > TOP}
    <p class="skip" class:on={chosen >= TOP} aria-hidden="true">⋮ {#if quick}{skipped}{:else}<MorphText text={skipped} numbers={false} />{/if}</p>
  {/if}
</div>
<nav class="ms-ways" aria-label="Ways back">
  <a class="pg-go" href={place.path}>{#if quick}Open {place.label}{:else}<MorphText text="Open {place.label}" numbers={false} />{/if}</a>
  <a class="prose-link" href="/">Open the explorer</a>
</nav>
</section>

<style>
  /* As the Standard Logits hero's list: the rows share one grid, every bar the same track, the numbers sizing the
   * last column, and the wash thumb gliding to the chosen row (or the skipped line while the run passes below it). */
  .dist { --glide-bg: var(--wash); --glide-radius: var(--r-box); display: grid; grid-template-columns: minmax(0, 150px) minmax(0, 1fr) auto; gap: 2px var(--s4); width: min(calc(100% + var(--s3) * 2), 624px); margin-inline: calc(var(--s3) * -1); }
  .row { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; width: 100%; padding: var(--s2) var(--s3); border: 0; border-radius: var(--r-box); background: transparent; color: var(--ink); font: var(--type-small); text-align: start; cursor: pointer; transition: background-color var(--fast) var(--ease), scale var(--fast) var(--ease); }
  .row:active { scale: 0.99; }
  .name { min-width: 0; overflow: hidden; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
  @media (hover: hover) { .row:not([aria-pressed="true"]):hover { background: color-mix(in oklch, var(--wash) 60%, transparent); } }
  .bar { position: relative; height: 4px; border-radius: 2px; background: var(--wash); }
  .bar i { position: absolute; inset: 0 auto 0 0; width: max(2px, calc(var(--w) * 100%)); border-radius: 2px; background: var(--tint); transform-origin: left; animation: fill var(--glide) var(--ease) backwards; animation-delay: calc(80ms + var(--i, 0) * 24ms); }
  @keyframes fill { from { transform: scaleX(0); } }
  .pct { color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; text-align: end; white-space: nowrap; }
  .pct b { color: var(--ink); font-weight: 600; }
  .skip { grid-column: 1 / -1; margin: 0; padding: var(--s1) var(--s3); color: var(--ink3); font: var(--type-meta); }
  @media (max-width: 520px) { .dist { grid-template-columns: minmax(0, 112px) minmax(0, 1fr) auto; column-gap: var(--s3); } }
  @media (prefers-reduced-motion: reduce) { .bar i { animation: none; } }
</style>

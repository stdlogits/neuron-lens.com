<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { MorphText, reducedMotion } from "@stdlogits/ledger";
  import { MODELS, depthColor, type ModelId } from "../../lib/models";
  import { loadIndex, loadScores, type IndexRow } from "../../lib/data";
  import { byteStrengths } from "../../explorer/atlas/levels";
  import { STILL, ride } from "./motion";
  import { clip } from "./place";
  import Readout from "./Readout.svelte";

  // Layer: a layer at or past the model's depth. The model's atlas, a column a layer (its neurons at fourteen evenly
  // spaced ranks, surest at the top, shaded as the atlas shades them), then the layers the address asks for past it.
  // On one clock the thumb rides up the layers, lighting each column as it passes and naming its surest neuron, slows
  // into the last, holds, and glides on into columns that arrive empty, landing on the layer asked.
  let { id, asked, rest }: { id: ModelId; asked: number; rest: string[] } = $props();

  const FAINT = 0.1, EMPTIES = 24, RANKS = 14;
  type Spot = { layer: number } | { gap: true };
  const model = $derived(MODELS[id]);
  const real = $derived(model.layers);
  // Every real layer, then the ones asked for past them; a long way past, twenty of them, a gap, and the one asked.
  const spots: Spot[] = $derived.by(() => {
    const out: Spot[] = Array.from({ length: real }, (_, layer) => ({ layer }));
    if (asked - real + 1 <= EMPTIES) for (let layer = real; layer <= asked; layer += 1) out.push({ layer });
    else { for (let layer = real; layer < real + 20; layer += 1) out.push({ layer }); out.push({ gap: true }); out.push({ layer: asked }); }
    return out;
  });
  const last = $derived(spots.length - 1);
  const layerOf = (k: number) => { const spot = spots[k]; return "gap" in spot ? asked : spot.layer; };
  const place = $derived(clip(model, [`L${asked}`, ...rest]));

  let ranks = $state.raw<number[][] | null>(null);
  let surest = $state.raw<(IndexRow | undefined)[]>([]);
  // While its data loads the page waits where its run starts, on the first layer; at rest (and under reduced motion)
  // the thumb sits on the layer asked, the last spot. A key block remounts the page for another address.
  const start = untrack(() => (reducedMotion() ? last : 0));
  let pos = $state(start);
  let at = $state(start);
  let riding = $state(false);
  let quiet = $state(false);
  const layer = $derived(layerOf(at));
  const floor = $derived(Math.min(layer, real - 1));
  const row = $derived(surest[floor]);
  const side = $derived(row && row[7] > row[6] ? 1 : 0);

  let stop = () => {};
  function halt() { stop(); stop = () => {}; riding = false; quiet = false; pos = at; }
  function show(k: number) { if (!("gap" in spots[k])) { at = k; pos = k; } }
  function pointed(event: PointerEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    halt();
    let k = Math.min(last, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * spots.length)));
    if ("gap" in spots[k]) k += 1;
    show(k);
  }
  function key(event: KeyboardEvent) {
    let to = event.key === "ArrowRight" ? at + 1 : event.key === "ArrowLeft" ? at - 1 : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (to === null) return;
    event.preventDefault();
    halt();
    to = Math.min(last, Math.max(0, to));
    if ("gap" in spots[to]) to += event.key === "ArrowLeft" ? -1 : 1;
    show(to);
  }

  /** Up the real layers easing in and out, a hold at the last, then on through the missing ones to the one asked. The
   * number holds still for a moment before it lands, so the landing morphs. */
  function play() {
    halt();
    riding = true;
    quiet = true;
    stop = ride({
      edge: real - 1, end: last, t1: 1500 + 12 * real, hold: 420, t2: 650 + 22 * Math.min(last - real + 1, EMPTIES),
      step(p, left) {
        pos = p;
        let k = Math.round(p);
        if ("gap" in spots[k]) k = p < k ? k - 1 : k + 1;
        if (left > STILL && k < last) at = k;
      },
      done() { riding = false; quiet = false; at = last; pos = last; },
    });
  }

  onMount(() => {
    let live = true;
    Promise.all([loadIndex(id), loadScores(id)]).then(([index, scores]) => {
      if (!live) return;
      // Each layer's surest neuron, and the strength of each of its neurons at fourteen evenly spaced ranks.
      const top = index.neurons.reduce((most, r) => Math.max(most, r[4]), 0);
      const strength = byteStrengths(top);
      const best: (IndexRow | undefined)[] = [];
      for (const r of index.neurons) if (!best[r[0]] || r[4] > best[r[0]]![4]) best[r[0]] = r;
      surest = best;
      ranks = scores.map((bytes) => {
        const counts = new Uint32Array(256);
        for (const b of bytes) counts[b] += 1;
        const out: number[] = [];
        for (let i = 0; i < RANKS; i += 1) {
          let want = Math.round((i / (RANKS - 1)) * (bytes.length - 1)), b = 255;
          while (b > 0 && want >= counts[b]) { want -= counts[b]; b -= 1; }
          out.push(strength[b]);
        }
        return out;
      });
      requestAnimationFrame(play);
    }).catch(() => { if (live) { at = last; pos = last; } });
    return () => { live = false; stop(); };
  });
</script>

<section class="ms" style:--tint={depthColor(model, floor)}>
  <div class="lift" class:riding style:--n={spots.length} role="slider" tabindex="0" aria-label="Layer" aria-valuemin={0} aria-valuemax={asked} aria-valuenow={layer} aria-valuetext={layer < real ? `Layer ${layer}` : `Layer ${layer}, which ${model.name} doesn’t have`} onpointermove={pointed} onpointerdown={pointed} onpointerleave={(event) => { if (event.pointerType !== "touch") show(last); }} onkeydown={key}>
    <span class="ms-thumb" style:transform="translateX({pos * 100}%)"></span>
    {#each spots as spot, i}
      {#if "gap" in spot}
        <span class="col gap" class:on={i <= pos + 0.5}>⋯</span>
      {:else if spot.layer >= real}
        <span class="col ghost" class:on={i <= pos + 0.5} class:at={i === at}></span>
      {:else}
        <span class="col" class:dim={i > pos + 0.5}>{#each ranks?.[spot.layer] ?? [] as s, b (b)}<i style:background={depthColor(model, spot.layer)} style:opacity={FAINT + (1 - FAINT) * s}></i>{/each}</span>
      {/if}
    {/each}
  </div>
  {#if row}
    <Readout id="L{floor}·n{row[1]} {side ? '−' : '+'}" label={side ? row[3] : row[2]} href="/{id}/L{floor}/n{row[1]}" lent={!!model.labelsFrom} {quiet} />
  {:else}
    <Readout id="L{floor}" label="" href="/{id}/L{floor}" {quiet} />
  {/if}
  <div class="ms-text">
    <h1>There is no layer <span class="ms-slot" class:none={layer >= real}><MorphText text={String(layer)} /></span></h1>
    <p class="ms-say">{model.name} has {real}, numbered 0 to {real - 1}.</p>
    <nav class="ms-ways" aria-label="Ways back">
      <a class="pg-go" href={place.path}>Open {place.label}</a>
      <a class="prose-link" href="/">Open the explorer</a>
    </nav>
  </div>
</section>

<style>
  .lift { position: relative; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); height: 92px; cursor: ew-resize; touch-action: pan-y; }
  .col { position: relative; z-index: 1; display: grid; align-content: start; justify-items: center; gap: 2px; padding: var(--s2) 0; transition: opacity 320ms var(--ease); }
  .col i { display: block; width: 62%; max-width: 14px; height: 3px; border-radius: 2px; }
  .col.dim { opacity: 0.22; }
  /* A layer the model doesn't have: a column of wash, arriving as the ride reaches it. */
  .ghost { margin: 0 1px; border-radius: var(--r-chip); background: var(--wash); opacity: 0; transform: translateY(-6px); transition: opacity var(--in) var(--ease), transform var(--in) var(--ease), background-color var(--fast) var(--ease); }
  .ghost.on { opacity: 1; transform: none; }
  .ghost.at { background: var(--wash2); }
  .gap { place-items: center; align-content: center; padding: 0; color: var(--ink3); font: 600 14px/1 var(--display); opacity: 0; transition: opacity var(--in) var(--ease); }
  .gap.on { opacity: 1; }
</style>

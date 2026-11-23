<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { MorphText, reducedMotion } from "@stdlogits/ledger";
  import { MODELS, depthColor, type ModelId } from "../../lib/models";
  import { loadHeadIndex, type HeadRow } from "../../lib/data";
  import { headTitle } from "../../explorer/search/engine";
  import { STILL, ride } from "./motion";
  import Readout from "./Readout.svelte";

  // Head: a head at or past the layer's heads. The layer's heads, a column each of where it attends (its share on the
  // first token, the previous one and itself, and its induction and duplicate-token scores, heads/index.json), then the
  // heads the address asks for past them. On one clock the thumb rides across the heads, lighting and naming each,
  // slows into the last, holds, and glides on through columns that arrive empty, landing on the head asked.
  let { id, layer, asked }: { id: ModelId; layer: number; asked: number } = $props();

  const FAINT = 0.08, EMPTIES = 24;
  const ROWS = ["First token", "Previous", "Itself", "Induction", "Duplicate"];
  type Spot = { head: number } | { gap: true };
  const model = $derived(MODELS[id]);
  const real = $derived(model.heads);
  const spots: Spot[] = $derived.by(() => {
    const out: Spot[] = Array.from({ length: real }, (_, head) => ({ head }));
    if (asked - real + 1 <= EMPTIES) for (let head = real; head <= asked; head += 1) out.push({ head });
    else { for (let head = real; head < real + 20; head += 1) out.push({ head }); out.push({ gap: true }); out.push({ head: asked }); }
    return out;
  });
  const last = $derived(spots.length - 1);
  const headOf = (k: number) => { const spot = spots[k]; return "gap" in spot ? asked : spot.head; };

  let heads = $state.raw<(HeadRow | undefined)[]>([]);
  // While its data loads the page waits where its run starts, on the first head; at rest (and under reduced motion)
  // the thumb sits on the head asked, the last spot. A key block remounts the page for another address.
  const start = untrack(() => (reducedMotion() ? last : 0));
  let pos = $state(start);
  let at = $state(start);
  let riding = $state(false);
  let quiet = $state(false);
  const head = $derived(headOf(at));
  const named = $derived(Math.min(head, real - 1));
  const row = $derived(heads[named]);

  let stop = () => {};
  function halt() { stop(); stop = () => {}; riding = false; quiet = false; pos = at; }
  function show(k: number) { if (!("gap" in spots[k])) { at = k; pos = k; } }
  function pointed(event: PointerEvent) {
    const grid = (event.currentTarget as HTMLElement).querySelector(".grid")!.getBoundingClientRect();
    halt();
    let k = Math.min(last, Math.max(0, Math.floor(((event.clientX - grid.left) / grid.width) * spots.length)));
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

  /** Across the heads easing in and out, a hold at the last, then on through the missing ones to the one asked. */
  function play() {
    halt();
    riding = true;
    quiet = true;
    stop = ride({
      edge: real - 1, end: last, t1: 1100 + 25 * real, hold: 420, t2: 650 + 22 * Math.min(last - real + 1, EMPTIES),
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
    loadHeadIndex(id).then((rows) => {
      if (!live) return;
      const out: (HeadRow | undefined)[] = [];
      for (const r of rows) if (r[0] === layer) out[r[1]] = r;
      heads = out;
      requestAnimationFrame(play);
    }).catch(() => { if (live) { at = last; pos = last; } });
    return () => { live = false; stop(); };
  });
</script>

<section class="ms" style:--tint={depthColor(model, layer)}>
  <div class="heads" role="slider" tabindex="0" aria-label="Head of layer {layer}" aria-valuemin={0} aria-valuemax={asked} aria-valuenow={head} aria-valuetext={head < real ? `Head ${head}` : `Head ${head}, which layer ${layer} doesn’t have`} onpointermove={pointed} onpointerdown={pointed} onpointerleave={(event) => { if (event.pointerType !== "touch") show(last); }} onkeydown={key}>
    <div class="names" aria-hidden="true">{#each ROWS as name (name)}<span>{name}</span>{/each}</div>
    <div class="grid" class:riding style:--n={spots.length}>
      <span class="ms-thumb" style:transform="translateX({pos * 100}%)"></span>
      {#each spots as spot, i}
        {#if "gap" in spot}
          <span class="hc gap" class:on={i <= pos + 0.5}>⋯</span>
        {:else if spot.head >= real}
          <span class="hc ghost" class:on={i <= pos + 0.5}>{#each ROWS as name (name)}<i></i>{/each}</span>
        {:else}
          <span class="hc" class:dim={i > pos + 0.5}>{#each heads[spot.head]?.[11] ?? [0, 0, 0, 0, 0] as v, r (r)}<i style:opacity={FAINT + (1 - FAINT) * Math.min(1, v)}></i>{/each}</span>
        {/if}
      {/each}
    </div>
  </div>
  {#if row}
    <Readout id="L{layer}·h{named}" label={headTitle(row, model)} href="/{id}/L{layer}/h{named}" lent={!!model.labelsFrom} {quiet} />
  {:else}
    <Readout id="L{layer}·h{named}" label="" href="/{id}/L{layer}/h{named}" {quiet} />
  {/if}
  <div class="ms-text">
    <h1>There is no head <span class="ms-slot" class:none={head >= real}><MorphText text={String(head)} /></span></h1>
    <p class="ms-say">Layer {layer} of {model.name} has {real}, numbered 0 to {real - 1}.</p>
    <nav class="ms-ways" aria-label="Ways back">
      <a class="pg-go" href="/{id}/L{layer}/h{real - 1}">Open L{layer}·h{real - 1}</a>
      <a class="prose-link" href="/">Open the explorer</a>
    </nav>
  </div>
</section>

<style>
  .heads { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 0 var(--s3); cursor: ew-resize; touch-action: pan-y; }
  .names { display: grid; grid-auto-rows: 14px; gap: 4px; padding: 4px 0; }
  .names span { color: var(--ink3); font: 500 11px/14px var(--text); white-space: nowrap; }
  .grid { position: relative; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); min-width: 0; }
  .hc { position: relative; z-index: 1; display: grid; grid-auto-rows: 14px; gap: 4px; padding: 4px 1px; transition: opacity 320ms var(--ease); }
  .hc i { display: block; border-radius: 3px; background: var(--tint); }
  .hc.dim { opacity: 0.22; }
  /* A head the layer doesn't have: a column of wash, arriving as the ride reaches it. */
  .ghost { opacity: 0; transform: translateY(-6px); transition: opacity var(--in) var(--ease), transform var(--in) var(--ease); }
  .ghost i { background: var(--wash); }
  .ghost.on { opacity: 1; transform: none; }
  .gap { grid-auto-rows: auto; place-items: center; align-content: center; color: var(--ink3); font: 600 14px/1 var(--display); opacity: 0; transition: opacity var(--in) var(--ease); }
  .gap.on { opacity: 1; }
  @media (max-width: 520px) { .heads { grid-template-columns: 62px minmax(0, 1fr); } .names span { font-size: 10px; } }
</style>

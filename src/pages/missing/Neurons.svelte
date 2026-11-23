<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { GLIDE, reducedMotion } from "@stdlogits/ledger";
  import { MODELS, depthColor, type ModelId } from "../../lib/models";
  import { loadIndex, loadScores, type IndexRow } from "../../lib/data";
  import { byteStrengths, FAINT } from "../../explorer/atlas/levels";
  import { STILL, ride, tween } from "./motion";
  import { roll, type RollMode } from "./roll";
  import { dropDigit } from "./place";
  import { palette, surface } from "./paint";
  import Readout from "./Readout.svelte";

  // Neuron: a neuron at or past the layer's width. The layer's every neuron as a cell, in neuron order down each
  // column, shaded as the explorer's All view shades it (how sure the labeller was, scores.json); then the width the
  // layer doesn't have, in the wash, out to the number asked. On one clock an ink playhead crosses the layer, lighting
  // every neuron it passes while the number counts with it and the easiest neurons are named as it reaches them; it
  // slows into the last neuron, holds, and runs on across the empty width to the number asked.
  let { id, layer, asked }: { id: ModelId; layer: number; asked: number } = $props();

  const PAD = 2, DIM = 0.14;
  const model = $derived(MODELS[id]);
  const width = $derived(model.mlp);
  const typo = $derived(dropDigit(asked, width));
  const count = (n: number) => n.toLocaleString("en-US");

  let named = $state.raw<IndexRow[]>([]);
  // While its data loads the page waits where its run starts, at neuron 0; at rest (and under reduced motion) the ring
  // sits on the number asked. A key block remounts the page for another address.
  let at = $state(untrack(() => (reducedMotion() ? asked : 0)));
  let label = $state.raw<IndexRow | undefined>(undefined);
  let quiet = $state(false);
  let mode = $state<RollMode>("auto");
  let ticks = $state({ end: 0, last: 0, middle: true });
  const side = $derived(label && label[7] > label[6] ? 1 : 0);

  let canvas: HTMLCanvasElement;
  let hit: HTMLAnchorElement;
  let paint = () => {};
  let cells: Float32Array | null = null;
  let lit = 1, empty = 1;
  let head: { x: number; alpha: number } | null = null;
  let stop = () => {};
  let R = 0, span = 0, H = 0, rows = 1, cols = 1, squeezed = false;

  /** Where neuron n sits: a real one at its cell, a missing one along the empty part, out to the number asked. */
  function xOf(n: number) {
    if (n < width) return PAD + (Math.floor(n / rows) + 0.5) * (R / cols);
    return PAD + R + 4 + (asked === width ? 1 : (n - width) / (asked - width)) * (span - R - 4);
  }
  const yOf = (n: number) => (n < width ? PAD + ((n % rows) + 0.5) * (H / rows) : PAD + H / 2);
  function measure(w: number, h: number) {
    span = w - 2 * PAD;
    H = h - 2 * PAD;
    squeezed = asked + 1 > 4 * width;
    R = Math.min(squeezed ? span * 0.25 : span * (width / (asked + 1)), span - 40);
    // Square cells, as many rows as fit the height.
    rows = Math.max(1, Math.round(H / Math.sqrt((R * H) / width)));
    cols = Math.ceil(width / rows);
    ticks = { end: PAD + R, last: PAD + span, middle: span - R > 90 && R > 60 };
  }
  /** The last of the easiest neurons at or before neuron n. */
  function before(n: number): IndexRow | undefined {
    let lo = 0, hi = named.length - 1, best: IndexRow | undefined;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (named[mid][1] <= n) { best = named[mid]; lo = mid + 1; } else hi = mid - 1; }
    return best ?? named[0];
  }

  let riding = false;
  function halt() { stop(); stop = () => {}; riding = false; head = null; lit = 1; empty = 1; quiet = false; mode = "auto"; paint(); }
  function pointed(event: PointerEvent) {
    const box = canvas.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
    halt();
    hit.hidden = false;
    if (x > PAD + R + 4 || !named.length) { at = asked; paint(); return; }
    // The nearest named neuron, so the name under the field is always the one marked.
    let best = named[0], near = Infinity;
    for (const r of named) { const d = (xOf(r[1]) - x) ** 2 + (yOf(r[1]) - y) ** 2; if (d < near) { near = d; best = r; } }
    label = best;
    at = best[1];
    paint();
  }
  function key(event: KeyboardEvent) {
    const stops = [...named.map((r) => r[1]), asked], here = stops.indexOf(at);
    // As any slider: right and up raise, left and down lower.
    const up = event.key === "ArrowRight" || event.key === "ArrowUp", down = event.key === "ArrowLeft" || event.key === "ArrowDown";
    const to = up ? here + 1 : down ? (here < 0 ? stops.length - 1 : here - 1) : event.key === "Home" ? 0 : event.key === "End" ? stops.length - 1 : null;
    if (to === null) return;
    event.preventDefault();
    halt();
    const k = Math.min(stops.length - 1, Math.max(0, to));
    if (k < named.length) label = named[k];
    at = stops[k];
    paint();
  }

  function play() {
    halt();
    if (reducedMotion() || !cells || !R) { at = asked; paint(); return; }
    hit.hidden = true;
    riding = true; lit = 0; empty = 0; quiet = true; mode = "plain";
    head = { x: PAD, alpha: 1 };
    let counted = 0;
    const from = () => PAD + R + 4, to = () => PAD + span - 12;
    stop = ride({
      edge: 1, end: 2, t1: 2000, hold: 420, t2: 950,
      step(p, left) {
        let n: number;
        if (p <= 1) { lit = p; head!.x = PAD + p * R; n = Math.min(width - 1, Math.floor(p * cols) * rows + rows - 1); }
        else { lit = 1; empty = p - 1; head!.x = from() + (to() - from()) * empty; n = width + Math.round(empty * (asked - width)); }
        // The count changes at most every 50 ms, so it reads as it runs, and holds still before it lands.
        const now = performance.now();
        if (left > STILL && now - counted > 50) { counted = now; at = n; }
        if (n < width) label = before(n);
        paint();
      },
      done() {
        riding = false; empty = 1; lit = 1; quiet = false; mode = "land"; at = asked;
        const fading = head!;
        stop = tween(GLIDE, (t) => { fading.alpha = 1 - t; paint(); }, () => { head = null; paint(); });
      },
    });
  }
  /** A ride cut short by a new size lands where it was going, as it would have, so the page never rests mid-count. */
  function resized(w: number, h: number) {
    const landing = riding;
    halt();
    measure(w, h);
    if (landing) { label = named[named.length - 1]; mode = "land"; at = asked; }
  }

  onMount(() => {
    let live = true;
    let field: HTMLCanvasElement | null = null, fieldKey = "";
    const colors = palette(() => { fieldKey = ""; paint(); });
    /** The layer's field, painted once a size, a layer and a theme: a cell a neuron, on device pixels. */
    function image(ratio: number) {
      const key = `${R}:${H}:${ratio}:${colors.css("var(--paper)")}`;
      if (field && key === fieldKey) return field;
      fieldKey = key;
      const W = Math.max(1, Math.round(R * ratio)), V = Math.max(1, Math.round(H * ratio));
      const img = new ImageData(W, V), px = img.data;
      const [r, g, b] = colors.rgb(depthColor(model, layer));
      for (let k = 0; k < width; k += 1) {
        const col = Math.floor(k / rows), row = k % rows, a = Math.round((FAINT + (1 - FAINT) * cells![k]) * 255);
        const x0 = Math.floor((col * W) / cols), x1 = Math.floor(((col + 1) * W) / cols), y0 = Math.floor((row * V) / rows), y1 = Math.floor(((row + 1) * V) / rows);
        for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { const i = (y * W + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; }
      }
      field = Object.assign(document.createElement("canvas"), { width: W, height: V });
      field.getContext("2d")!.putImageData(img, 0, 0);
      return field;
    }
    const surf = surface(canvas, (ctx) => {
      if (!cells) return;
      const ink = colors.css("var(--ink)"), ink3 = colors.css("var(--ink3)"), wash = colors.css("var(--wash2)"), picture = image(surf.at.ratio);
      // The layer: dim ahead of the run, full where it has been.
      ctx.save();
      ctx.beginPath(); ctx.roundRect(PAD, PAD, R, H, 4); ctx.clip();
      ctx.globalAlpha = DIM; ctx.drawImage(picture, PAD, PAD, R, H);
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.rect(PAD, PAD, head && head.x < PAD + R ? head.x - PAD : R * lit, H); ctx.clip();
      ctx.drawImage(picture, PAD, PAD, R, H);
      ctx.restore();
      // Past the layer: the width it doesn't have, in the wash, as far as the run has reached.
      const from = PAD + R + 4, to = PAD + span, reach = from + (to - from) * empty;
      ctx.fillStyle = wash;
      if (squeezed) {
        const mid = (from + to) / 2;
        if (reach > from) { ctx.beginPath(); ctx.roundRect(from, PAD, Math.max(0, Math.min(reach, mid - 10) - from), H, 4); ctx.fill(); }
        if (reach > mid + 10) {
          ctx.beginPath(); ctx.roundRect(mid + 10, PAD, reach - mid - 10, H, 4); ctx.fill();
          ctx.fillStyle = ink3;
          for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.arc(mid + dx, PAD + H / 2, 1.3, 0, 6.2832); ctx.fill(); }
        }
      } else if (reach > from) { ctx.beginPath(); ctx.roundRect(from, PAD, reach - from, H, 4); ctx.fill(); }
      // During a run, the playhead: an ink bar the field's height where the run has reached.
      if (head) {
        ctx.globalAlpha = head.alpha;
        ctx.fillStyle = ink;
        ctx.beginPath(); ctx.roundRect(head.x - 1, PAD - 2, 2, H + 4, 1); ctx.fill();
        ctx.globalAlpha = 1;
        if (head.alpha >= 1) return;
      }
      // At rest, a ring round the named neuron's cell, or, past the layer, round the place of the number asked.
      const x = at >= width ? to - 12 : xOf(at), y = yOf(at);
      ctx.globalAlpha = head ? 1 - head.alpha : 1;
      ctx.strokeStyle = at >= width ? ink3 : ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, Math.max(4, R / cols / 2 + 3), 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = 1;
      hit.style.transform = `translate(${x}px, ${y}px)`;
    }, resized);
    paint = surf.paint;
    Promise.all([loadIndex(id), loadScores(id)]).then(([index, scores]) => {
      if (!live) return;
      const strength = byteStrengths(index.neurons.reduce((most, r) => Math.max(most, r[4]), 0));
      cells = Float32Array.from(scores[layer] ?? [], (b) => strength[b]);
      named = index.neurons.filter((r) => r[0] === layer).sort((a, b) => a[1] - b[1]);
      label = named[named.length - 1];
      if (surf.at.w) measure(surf.at.w, surf.at.h);
      paint();
      // Two frames on, so the ride doesn't start in the frame its data was parsed in.
      requestAnimationFrame(() => requestAnimationFrame(() => { if (live) play(); }));
    }).catch(() => { if (live) at = asked; });
    return () => { live = false; stop(); surf.destroy(); colors.destroy(); };
  });
</script>

<section class="ms" style:--tint={depthColor(model, layer)}>
  <div>
    <div class="strip" role="slider" tabindex="0" aria-label="Neuron of layer {layer}" aria-valuemin={0} aria-valuemax={asked} aria-valuenow={at} aria-valuetext={at < width ? `Neuron ${at}` : `Neuron ${at}, which layer ${layer} doesn’t have`} onpointermove={pointed} onpointerdown={pointed} onpointerleave={(event) => { if (event.pointerType !== "touch") { hit.hidden = true; at = asked; paint(); } }} onkeydown={key}>
      <canvas bind:this={canvas}></canvas>
      <a class="hit" bind:this={hit} href={label ? `/${id}/L${layer}/n${label[1]}` : `/${id}/L${layer}`} tabindex="-1" aria-hidden="true" hidden></a>
    </div>
    <p class="ticks" aria-hidden="true">
      <span style:left="{PAD}px">n0</span>
      {#if ticks.middle}<span class="end" style:left="{ticks.end}px">n{width - 1}</span>{/if}
      <span class="end" style:left="{ticks.last}px">n{asked}</span>
    </p>
  </div>
  {#if label}
    <Readout id="L{layer}·n{label[1]} {side ? '−' : '+'}" label={side ? label[3] : label[2]} href="/{id}/L{layer}/n{label[1]}" lent={!!model.labelsFrom} {quiet} />
  {/if}
  <div class="ms-text">
    <!-- Named for the neuron asked, whatever the slot counts through on its way there or is pointed at. -->
    <h1 aria-label="There is no neuron {count(asked)}">There is no neuron <span class="ms-slot" class:none={at >= width} aria-hidden="true"><span use:roll={{ text: count(at), mode }}></span></span></h1>
    <p class="ms-say">Layer {layer} of {model.name} has {count(width)}, numbered 0 to {count(width - 1)}.</p>
    <nav class="ms-ways" aria-label="Ways back">
      <a class="pg-go" href="/{id}/L{layer}/n{width - 1}">Open L{layer}·n{width - 1}</a>
      {#if typo !== null && typo !== width - 1}<a class="prose-link" href="/{id}/L{layer}/n{typo}">Or L{layer}·n{typo}</a>{:else}<a class="prose-link" href="/">Open the explorer</a>{/if}
    </nav>
  </div>
</section>

<style>
  .strip { position: relative; cursor: ew-resize; touch-action: pan-y; }
  canvas { display: block; width: 100%; height: 92px; }
  .hit { position: absolute; left: 0; top: 0; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; }
  .ticks { position: relative; height: 16px; margin: var(--s2) 0 0; color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; }
  .ticks span { position: absolute; top: 0; white-space: nowrap; }
  .ticks .end { transform: translateX(-100%); }
</style>

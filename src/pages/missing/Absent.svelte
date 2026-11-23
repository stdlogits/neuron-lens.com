<script lang="ts">
  import { onMount } from "svelte";
  import { Segmented, ease, reducedMotion } from "@stdlogits/ledger";
  import absent from "./absent.json";
  import { MODELS, depthColor } from "../../lib/models";
  import { palette, surface } from "./paint";
  import { sequence, tween } from "./motion";
  import { repair } from "./place";
  import Readout from "./Readout.svelte";

  // Page: an address the router can't read. "404" drawn in 404 dots, each a Qwen3-8B neuron whose label names an
  // absence (absent.json, from scripts/site/absent.mjs). They arrive where they sit in the model, a column a layer, then
  // travel into the figure, early layers first, while the name under it runs through a dozen of them and lands on
  // L18·n3025, the not-found neuron. A lens follows the pointer over them, the dot under it a link to its neuron, and
  // "In the model" sends them back to their places.
  let { parts }: { parts: string[] } = $props();

  type Row = [layer: number, neuron: number, side: number, label: string];
  type Point = { x: number; y: number };
  const U = absent as Row[];
  const N = U.length;
  const model = MODELS["qwen3-8b"];
  const LAYERS = model.layers;
  const FACE = '"Wix Madefor Display", system-ui, sans-serif';
  const CENTRE = Math.max(0, U.findIndex(([layer, neuron]) => layer === 18 && neuron === 3025));
  const fix = $derived(repair(parts));

  let shown = $state(CENTRE);
  let mode = $state<"figure" | "model">("figure");
  let quiet = $state(false);
  const unit = $derived(U[shown]);

  let canvas: HTMLCanvasElement;
  let hit: HTMLAnchorElement;
  const P = U.map(() => ({ x: 0, y: 0, a: 1 }));
  const lens = { x: 0, y: 0, k: 0, to: 0 };
  let figure: Point[] = [];
  let places: Point[] = [];
  let radius = 3;
  let reach = 80;
  let moving = false;
  let frame = 0;
  let names = 0;
  let stopMove = () => {};
  let stopNames = () => {};
  let paint = () => {};

  function random(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** N points spread evenly inside "404" set in the display face: best-candidate sampling, relaxed three times, then
   * ordered left to right, so depth runs across the figure as it runs across the atlas. */
  function numerals(w: number, h: number): Point[] {
    const scale = 3;
    const cw = Math.ceil(w / scale), ch = Math.ceil(h / scale);
    const g = Object.assign(document.createElement("canvas"), { width: cw, height: ch }).getContext("2d", { willReadFrequently: true })!;
    let size = ch * 1.3;
    g.font = `800 ${size}px ${FACE}`;
    const wide = g.measureText("404").width;
    if (wide > cw * 0.96) size *= (cw * 0.96) / wide;
    g.font = `800 ${size}px ${FACE}`;
    g.textAlign = "center";
    const m = g.measureText("404");
    g.fillText("404", cw / 2, (ch + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    const data = g.getImageData(0, 0, cw, ch).data;
    const inside: number[] = [];
    for (let y = 0; y < ch; y += 1) for (let x = 0; x < cw; x += 1) if (data[(y * cw + x) * 4 + 3] > 127) inside.push(x, y);
    const M = inside.length / 2;
    if (M < N) return places.map((p) => ({ ...p }));
    const next = random(404);
    const xs = new Float64Array(N), ys = new Float64Array(N);
    for (let i = 0; i < N; i += 1) {
      let best = 0, far = -1;
      for (let c = 0; c < 16; c += 1) {
        const k = Math.floor(next() * M), x = inside[2 * k], y = inside[2 * k + 1];
        let near = Infinity;
        for (let j = 0; j < i; j += 1) { const d = (xs[j] - x) ** 2 + (ys[j] - y) ** 2; if (d < near) near = d; }
        if (near > far) { far = near; best = k; }
      }
      xs[i] = inside[2 * best]; ys[i] = inside[2 * best + 1];
    }
    for (let pass = 0; pass < 3; pass += 1) {
      const sx = new Float64Array(N), sy = new Float64Array(N), n = new Uint32Array(N);
      for (let k = 0; k < M; k += 1) {
        const x = inside[2 * k], y = inside[2 * k + 1];
        let b = 0, near = Infinity;
        for (let i = 0; i < N; i += 1) { const d = (xs[i] - x) ** 2 + (ys[i] - y) ** 2; if (d < near) { near = d; b = i; } }
        sx[b] += x; sy[b] += y; n[b] += 1;
      }
      for (let i = 0; i < N; i += 1) if (n[i]) { xs[i] = sx[i] / n[i]; ys[i] = sy[i] / n[i]; }
    }
    return Array.from(xs, (x, i) => ({ x: (x + 0.5) * scale, y: (ys[i] + 0.5) * scale })).sort((a, b) => a.x - b.x || a.y - b.y);
  }
  function layout(w: number, h: number) {
    radius = Math.min(3.3, Math.max(2.1, w / 280));
    reach = Math.min(96, Math.max(56, w * 0.13));
    // In the model: a column a layer, a neuron at its own height in its layer.
    places = U.map(([layer, neuron]) => ({ x: 16 + ((layer + 0.5) / LAYERS) * (w - 32), y: 12 + (neuron / model.mlp) * (h - 24) }));
    figure = numerals(w, h);
  }
  const target = (k: number) => (mode === "model" ? places : figure)[k];
  function settle() {
    stopMove();
    moving = false;
    P.forEach((p, k) => { const to = target(k); p.x = to.x; p.y = to.y; p.a = 1; });
  }

  /** A dot seen through the lens: pushed out from the pointer and grown, as under a glass. */
  function through(p: Point): [number, number, number] {
    if (lens.k < 0.01) return [p.x, p.y, 1];
    const dx = p.x - lens.x, dy = p.y - lens.y, d = Math.hypot(dx, dy);
    if (d >= reach) return [p.x, p.y, 1];
    if (d < 0.01) return [p.x, p.y, 1 + 1.4 * lens.k];
    const t = d / reach, m = 2.6 * lens.k, f = ((m + 1) * t) / (m * t + 1);
    return [lens.x + (dx / d) * f * reach, lens.y + (dy / d) * f * reach, 1 + (1 - t) ** 2 * 1.4 * lens.k];
  }

  function quietNames() { stopNames(); clearTimeout(names); quiet = false; }
  function kick() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      lens.k = reducedMotion() ? lens.to : lens.k + (lens.to - lens.k) * 0.24;
      if (Math.abs(lens.to - lens.k) < 0.004) lens.k = lens.to;
      paint();
      if (lens.k !== lens.to) kick();
    });
  }
  function nearest(x: number, y: number) {
    let best = 0, near = Infinity;
    for (let k = 0; k < N; k += 1) { const d = (P[k].x - x) ** 2 + (P[k].y - y) ** 2; if (d < near) { near = d; best = k; } }
    return best;
  }
  function point(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    lens.x = event.clientX - box.left;
    lens.y = event.clientY - box.top;
    lens.to = 1;
    quietNames();
    hit.hidden = false;
    shown = nearest(lens.x, lens.y);
    kick();
  }
  function leave(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    lens.to = 0;
    hit.hidden = true;
    shown = CENTRE;
    kick();
  }
  function key(event: KeyboardEvent) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    quietNames();
    lens.to = 0;
    hit.hidden = true;
    shown = (shown + step + N) % N;
    kick();
  }

  /** Every dot to its place in the chosen layout, early layers first. */
  function travel(to: "figure" | "model") {
    mode = to;
    stopMove();
    quietNames();
    const from = P.map((p) => ({ ...p })), total = 700 + (LAYERS - 1) * 9;
    moving = true;
    stopMove = tween(total, (t) => {
      const at = t * total;
      P.forEach((p, k) => {
        const e = ease(Math.min(1, Math.max(0, (at - U[k][0] * 9) / 700))), goal = target(k);
        p.x = from[k].x + (goal.x - from[k].x) * e;
        p.y = from[k].y + (goal.y - from[k].y) * e;
        p.a = from[k].a + (1 - from[k].a) * e;
      });
      paint();
    }, () => { moving = false; });
  }

  /** The run: columns arrive in the model 16 ms apart, hold a beat, then every dot travels into the figure while the
   * name under it runs through a dozen of them, ever faster, and lands on the not-found neuron. */
  function play() {
    if (reducedMotion() || !figure.length) return;
    stopMove();
    quietNames();
    mode = "figure";
    lens.to = lens.k = 0;
    hit.hidden = true;
    shown = CENTRE;
    const ARRIVE = (LAYERS - 1) * 16 + 200, HOLD = 520, GO = 900 + (LAYERS - 1) * 14, total = ARRIVE + HOLD + GO;
    moving = true;
    stopMove = tween(total, (t) => {
      const at = t * total;
      P.forEach((p, k) => {
        const layer = U[k][0], from = places[k], to = figure[k];
        const a = ease(Math.min(1, Math.max(0, (at - layer * 16) / 200))), e = ease(Math.min(1, Math.max(0, (at - ARRIVE - HOLD - layer * 14) / 900)));
        p.a = a;
        p.x = from.x + (to.x - from.x) * e;
        p.y = from.y + (1 - a) * 6 + (to.y - from.y) * e - Math.sin(Math.PI * e) * 12;
      });
      paint();
    }, () => { moving = false; });
    names = window.setTimeout(() => {
      quiet = true;
      const steps = Array.from({ length: 12 }, (_, i): [number, number] => [Math.round((i * (N - 1)) / 11), 250 * 0.26 ** (i / 11)]);
      stopNames = sequence(steps, (k) => { shown = k; paint(); }, () => { quiet = false; shown = CENTRE; paint(); });
    }, ARRIVE + HOLD);
  }

  onMount(() => {
    let tint: string[] = [];
    let ink = "";
    const colors = palette(() => { tint = []; paint(); });
    const surf = surface(canvas, (ctx) => {
      if (!tint.length) { tint = Array.from({ length: LAYERS }, (_, l) => colors.css(depthColor(model, l))); ink = colors.css("var(--ink)"); }
      let at: [number, number, number, number] | null = null;
      for (let k = 0; k < N; k += 1) {
        const p = P[k];
        if (p.a <= 0.001) continue;
        const [x, y, s] = through(p);
        if (k === shown) at = [x, y, s, p.a];
        ctx.globalAlpha = p.a;
        ctx.fillStyle = tint[U[k][0]];
        ctx.beginPath(); ctx.arc(x, y, radius * s, 0, 6.2832); ctx.fill();
      }
      if (at) {
        // The one named below: ringed in ink, and under the pointer a link to it.
        ctx.globalAlpha = at[3];
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(at[0], at[1], radius * at[2] + 3.5, 0, 6.2832); ctx.stroke();
        hit.style.transform = `translate(${at[0]}px, ${at[1]}px)`;
      }
      ctx.globalAlpha = 1;
    }, (w, h) => { quietNames(); layout(w, h); settle(); });
    paint = surf.paint;
    let started = false;
    const start = () => {
      if (started || !surf.at.w) return;
      started = true;
      layout(surf.at.w, surf.at.h);
      settle();
      paint();
      play();
    };
    // The figure is set in the display face: wait a moment for it, never long.
    Promise.race([document.fonts?.load(`800 64px ${FACE}`), new Promise((done) => setTimeout(done, 700))]).then(start);
    return () => { stopMove(); quietNames(); cancelAnimationFrame(frame); surf.destroy(); colors.destroy(); };
  });
  $effect(() => { void shown; paint(); });
</script>

<section class="ms" style:--tint={depthColor(model, unit[0])}>
<div class="field" class:model={mode === "model"} tabindex="0" role="slider" aria-label="404 drawn in 404 dots, each a Qwen3-8B neuron whose label names an absence" aria-valuemin={0} aria-valuemax={N - 1} aria-valuenow={shown} aria-valuetext="L{unit[0]}·n{unit[1]}: {unit[3]}" onpointermove={point} onpointerdown={point} onpointerleave={leave} onkeydown={key}>
  <canvas bind:this={canvas}></canvas>
  <a class="hit" bind:this={hit} href="/{model.id}/L{unit[0]}/n{unit[1]}" tabindex="-1" aria-hidden="true" hidden></a>
  <p class="axis" aria-hidden="true"><span>L0</span><span>L{LAYERS - 1}</span></p>
</div>
<div class="ms-row">
  <Readout id="L{unit[0]}·n{unit[1]} {unit[2] ? '−' : '+'}" label={unit[3]} href="/{model.id}/L{unit[0]}/n{unit[1]}" {quiet} />
  <Segmented label="Where the dots sit" options={[{ value: "figure", label: "404" }, { value: "model", label: "In the model" }]} value={mode} onchange={(value) => { if (value !== mode) travel(value); }} />
</div>
<div class="ms-text">
  <h1>Nothing fires here</h1>
  <p class="ms-say">There’s no page at this address.</p>
  <nav class="ms-ways" aria-label="Ways back">
    <a class="pg-go" href="/">Open the explorer</a>
    {#if fix}<a class="prose-link" href={fix.path}>Did you mean {fix.label}?</a>{:else}<a class="prose-link" href="/about">About</a>{/if}
  </nav>
</div>
</section>

<style>
  .field { position: relative; cursor: crosshair; outline-offset: 6px; }
  canvas { display: block; width: 100%; aspect-ratio: 2.7 / 1; touch-action: pan-y; }
  .hit { position: absolute; left: 0; top: 0; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; }
  .axis { position: absolute; inset: auto 0 -14px; display: flex; justify-content: space-between; margin: 0; color: var(--ink3); font: var(--type-meta); opacity: 0; transition: opacity var(--in) var(--ease); pointer-events: none; }
  .model .axis { opacity: 1; }
  @media (max-width: 600px) { canvas { aspect-ratio: 2.25 / 1; } }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { GLIDE, IconButton, LabelText, Segmented, Tabs, ease, reducedMotion } from "@stdlogits/ledger";
  import Graph from "./Graph.svelte";
  import { OVERSCAN, type View } from "./ink";
  import { rows, type Layout, type Open, type Placed, type Spot } from "./layout";
  import type { Graph as GraphData, GraphNode, Mode, Reach } from "./trace";
  import { bandOf, type ModelInfo } from "../../lib/models";
  import { headId, neuronId } from "../../lib/data";

  // The unit's connections, full screen: the same graph and motion as the rail's, opening at HOME times
  // its size, moved like a map. Titles stay one size on screen at any zoom, each where it touches no mark
  // and no other title: the unit's first, then the strongest, under its mark if it can, else over it or
  // beside it. Rows are spaced so most fit at HOME; zooming in makes room for the rest. Drag (or scroll) to move,
  // pinch (or ⌘/ctrl and scroll, or + and −) to zoom; a unit's mark opens it here, re-centring the graph
  // on it. Its address is the unit's with ?graph, so Back and links work, and Escape closes it.
  // The view moves once a frame, however many events ask it to. The marks and the links (drawn on a canvas of the
  // view's size, under the view, so they stay sharp) are laid out at a base view, and a pan moves only the layer
  // that holds both, by a translation the compositor applies alone: nothing is painted or layered again until the
  // pan runs past what the canvas drew around the screen, or the zoom changes, which lay them out at the view anew.
  let { graph, model, mode, modes, onmode, reach, reaches, onreach, hovered, point, href, name, title, close }: {
    graph: GraphData;
    model: ModelInfo;
    mode: Mode;
    modes: { value: Mode; label: string; hint: string }[];
    onmode: (mode: Mode) => void;
    reach: Reach;
    reaches: { value: Reach; label: string; hint: string }[];
    onreach: (reach: Reach) => void;
    hovered: string | null;
    point: (key: string | null) => void;
    href: (kind: "neuron" | "head", layer: number, index: number) => string;
    name: string;
    title: string;
    close: () => void;
  } = $props();

  /** The widest a title sets before it wraps (Graph.svelte's .label), and its line's height. */
  const LABEL = 150;
  const LINE = 16;

  // How each title sets: as wide as its longest line, on as many lines as it wraps to. A run of
  // CJK may break between any two characters, as the browser breaks it; a word longer than a line breaks
  // inside itself (the label's overflow-wrap).
  let pen: CanvasRenderingContext2D | null = null;
  const set = new Map<string, { width: number; lines: number }>();
  const PIECE = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]|[^\s\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]+|\s+/g;
  function setting(text: string) {
    let found = set.get(text);
    if (found) return found;
    pen ??= document.createElement("canvas").getContext("2d");
    const face = getComputedStyle(document.documentElement).getPropertyValue("--text") || "sans-serif";
    if (pen) pen.font = `600 12px ${face}`;
    const width = (piece: string) => (pen ? pen.measureText(piece).width : piece.length * 7);
    let lines = 1;
    let line = 0;
    let widest = 0;
    for (const piece of text.match(PIECE) ?? []) {
      const w = width(piece);
      if (/^\s+$/.test(piece)) { if (line > 0) line += w; continue; }
      if (line > 0 && line + w > LABEL) { widest = Math.max(widest, line); lines += 1; line = 0; }
      if (w > LABEL) { lines += Math.ceil(w / LABEL) - 1; line = w % LABEL; widest = LABEL; continue; }
      line += w;
    }
    found = { width: Math.min(LABEL, Math.max(widest, line)), lines };
    set.set(text, found);
    return found;
  }
  const nameOf = (n: GraphNode) => (n.kind === "head" ? headId(n.layer, n.index) : `${neuronId(n.layer, n.index)} ${n.pole > 0 ? "+" : "−"}`);
  const titleOf = (n: GraphNode) => n.wire?.title || nameOf(n);
  /** The zoom it opens at: the marks larger than in the rail, the titles at their own size. */
  const HOME = 1.5;
  /** A title's box on screen, padding and backing included (Graph.svelte's .label): as wide as its text on one line, the whole LABEL once it wraps. */
  const box = (n: GraphNode) => { const { width, lines } = setting(titleOf(n)); return { w: (lines > 1 ? LABEL : width) + 10, h: lines * LINE + 2 }; };
  /** Room across for each title at HOME; rows far enough apart for a two-line title under each mark at HOME. */
  const open: Open = { gap: 8 / HOME, reach: (n) => box(n).w / 2 / HOME };
  const pitch = 13 + (3 + 2 * LINE + 2 + 6) / HOME;
  const height = $derived(2 * model.layers * pitch + 18);
  const depth = $derived(rows(graph, height, model.layers));

  // Where each title goes at this zoom: the unit's first, then by flow, the first side of its mark where it
  // overlaps no other mark and no title already placed. Without room it waits to be zoomed into, and its tip still names it.
  let placed = $state.raw<Placed[]>([]);
  type Box = [number, number, number, number];
  const meets = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const spots = $derived.by(() => {
    const s = 1 / labelK;
    // Boxes in a grid of cells about a title's height on screen, so each test meets only its neighbours.
    const cell = 48 * s;
    const grid = new Map<number, [Box, number][]>();
    const cells = (b: Box) => {
      const out: number[] = [];
      for (let x = Math.floor(b[0] / cell); x <= Math.floor(b[2] / cell); x += 1) for (let y = Math.floor(b[1] / cell); y <= Math.floor(b[3] / cell); y += 1) out.push(x * 65536 + y);
      return out;
    };
    const add = (b: Box, owner: number) => {
      for (const key of cells(b)) { const there = grid.get(key); if (there) there.push([b, owner]); else grid.set(key, [[b, owner]]); }
    };
    const free = (b: Box, owner: number) => cells(b).every((key) => (grid.get(key) ?? []).every(([other, who]) => who === owner || !meets(other, b)));
    placed.forEach((n, i) => add([n.x - n.w / 2 - 1, n.y - n.h / 2 - 1, n.x + n.w / 2 + 1, n.y + n.h / 2 + 1], i));
    const out = new Map<string, Spot>();
    const order = placed.map((n, i) => i).sort((a, b) => (placed[a].side === "focus" ? -1 : placed[b].side === "focus" ? 1 : placed[b].flow - placed[a].flow));
    for (const i of order) {
      const n = placed[i];
      const size = box(n);
      const w = size.w * s;
      const h = size.h * s;
      const g = 3 * s;
      const sides: [Spot, Box][] = [
        ["below", [n.x - w / 2, n.y + n.h / 2 + g, n.x + w / 2, n.y + n.h / 2 + g + h]],
        ["above", [n.x - w / 2, n.y - n.h / 2 - g - h, n.x + w / 2, n.y - n.h / 2 - g]],
        ["right", [n.x + n.w / 2 + g, n.y - h / 2, n.x + n.w / 2 + g + w, n.y + h / 2]],
        ["left", [n.x - n.w / 2 - g - w, n.y - h / 2, n.x - n.w / 2 - g, n.y + h / 2]],
      ];
      const found = sides.find(([, at]) => free(at, i));
      if (!found) continue;
      out.set(n.key, found[0]);
      add(found[1], -1);
    }
    return out;
  });

  // The view: the graph's x and y at full size map to x · k + tx, y · k + ty on screen. k, tx and ty are
  // where it is going; `shown` is where it is this frame. A re-centring or a step of the zoom buttons
  // glides there; a drag, a pinch or a scroll follows the hand.
  let view = $state<HTMLDivElement>();
  let k = HOME;
  let tx = 0;
  let ty = 0;
  let shown = $state.raw<View>({ k: HOME, tx: 0, ty: 0 });
  /** Where the marks and links were last laid out: `shown`, less a pan since. */
  let base = $state.raw<View>({ k: HOME, tx: 0, ty: 0 });
  /** The zoom the titles are placed for: a glide's end at once, a pinch or a scroll once it rests. */
  let labelK = $state(HOME);
  let gliding = false;
  let glideFrom: View = { k: HOME, tx: 0, ty: 0 };
  let glideStart = 0;
  let frame = 0;
  let resting = 0;
  /** Any move of the view under way (a pan or a zoom): marks sliding under a still pointer don't light up, show
   * their tips or take hover, which would restyle the whole graph each time one passed; they do again once it rests. */
  let moving = $state(false);
  /** A pinch or a ⌘/ctrl-scroll under way: the titles keep the size they had and scale with the graph until it rests,
   * as a map's labels do, rather than every title being restyled each frame of it. */
  let zooming = $state(false);
  let still = 0;
  function stir(zoom = false) {
    if (!moving) moving = true;
    if (zoom && !zooming) zooming = true;
    clearTimeout(still);
    still = window.setTimeout(rest, 160);
  }
  /** At rest again: the titles back to one size on screen, and the light out unless the pointer is still on a mark, which then lights it again. */
  function rest() {
    moving = false;
    if (zooming) { zooming = false; labelK = shown.k; }
    point(null);
  }
  /** How much the titles are scaled against the marks: one size on screen, except while a zoom is under way. */
  const labelScale = $derived(1 / (zooming ? labelK : base.k));
  /** While the view moves, what is lit stays lit: marks passing under the pointer neither light nor put out. */
  const pointHere = (key: string | null) => { if (!moving) point(key); };
  const panned = () => stir();
  function at(now: number): View {
    if (!gliding) return { k, tx, ty };
    const t = Math.min(1, (now - glideStart) / GLIDE);
    if (t >= 1) { gliding = false; return { k, tx, ty }; }
    const e = ease(t);
    return { k: glideFrom.k + (k - glideFrom.k) * e, tx: glideFrom.tx + (tx - glideFrom.tx) * e, ty: glideFrom.ty + (ty - glideFrom.ty) * e };
  }
  function step(now: number) {
    frame = 0;
    const next = at(now);
    if (next.k !== shown.k || next.tx !== shown.tx || next.ty !== shown.ty) {
      if (next.k !== shown.k && !gliding) {
        clearTimeout(resting);
        resting = window.setTimeout(() => (labelK = shown.k), 100);
      }
      shown = next;
      // A zoom or a glide lays everything out at the view; a pan only once it nears the edge of what was drawn.
      if (next.k !== base.k || gliding || Math.abs(next.tx - base.tx) > OVERSCAN * 0.75 || Math.abs(next.ty - base.ty) > OVERSCAN * 0.75) base = next;
    }
    if (gliding) frame = requestAnimationFrame(step);
  }
  /** Go to k, tx, ty: gliding, or on the next frame. `now` shows it at once (the first centring, before anything is drawn). */
  function apply(glide: boolean, now = false) {
    const time = performance.now();
    if (glide && !reducedMotion()) {
      glideFrom = at(time);
      glideStart = time;
      gliding = true;
      labelK = k;
    } else gliding = false;
    if (now) {
      cancelAnimationFrame(frame);
      frame = 0;
      shown = { k, tx, ty };
      base = shown;
      labelK = k;
      return;
    }
    if (!frame) frame = requestAnimationFrame(step);
  }
  let viewWidth = $state(0);
  let viewHeight = $state(0);
  let links = $state<HTMLCanvasElement>();
  const surface = $derived(links && viewWidth > 0 ? { canvas: links, width: viewWidth, height: viewHeight, view: base } : null);
  let centred: string | null = null;
  /** Where the unit sat when last centred on, and whether the view has been moved since. */
  let centredAt = 0;
  let moved = false;
  const MIN = 0.12;
  const MAX = 3;
  const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

  function centre(glide = true, now = false) {
    const focus = graph.nodes.find((n) => n.side === "focus");
    if (!view || !focus) return;
    const box = view.getBoundingClientRect();
    moved = false;
    centredAt = focus.kind === "head" ? depth.heads(focus.layer) : depth.neurons(focus.layer);
    tx = box.width / 2;
    ty = box.height * 0.45 - centredAt * k;
    apply(glide, now);
  }
  // A new unit at the centre: glide to it (the first, jump). Rows that open up as titles arrive keep it there, unless the view was moved.
  function laid(layout: Layout) {
    placed = layout.nodes;
    const focus = layout.nodes.find((n) => n.side === "focus");
    if (!view || !focus) return;
    if (focus.key !== centred) { centre(centred !== null); centred = focus.key; }
    else if (!moved && focus.y !== centredAt) centre();
  }

  function zoom(to: number, x?: number, y?: number, glide = false) {
    if (!view) return;
    const box = view.getBoundingClientRect();
    const px = x ?? box.width / 2;
    const py = y ?? box.height / 2;
    const next = clamp(to);
    moved = true;
    if (!glide) stir(true);
    tx = px - ((px - tx) * next) / k;
    ty = py - ((py - ty) * next) / k;
    k = next;
    apply(glide);
  }

  function wheel(event: WheelEvent) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const box = view!.getBoundingClientRect();
      zoom(k * Math.exp(-event.deltaY * 0.01), event.clientX - box.left, event.clientY - box.top);
    } else {
      moved = true;
      tx -= event.deltaX;
      ty -= event.deltaY;
      panned();
      apply(false);
    }
  }

  // Dragging with one pointer moves the graph; two pinch. A drag is no click.
  const pointers = new Map<number, { x: number; y: number }>();
  let travelled = 0;
  function down(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) travelled = 0;
  }
  function move(event: PointerEvent) {
    const was = pointers.get(event.pointerId);
    if (!was || !view) return;
    const now = { x: event.clientX, y: event.clientY };
    if (pointers.size === 1) {
      travelled += Math.abs(now.x - was.x) + Math.abs(now.y - was.y);
      if (travelled > 4) {
        if (!view.hasPointerCapture(event.pointerId)) view.setPointerCapture(event.pointerId);
        moved = true;
        tx += now.x - was.x;
        ty += now.y - was.y;
        panned();
        apply(false);
      }
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1];
      const box = view.getBoundingClientRect();
      const before = Math.hypot(was.x - other.x, was.y - other.y) || 1;
      const after = Math.hypot(now.x - other.x, now.y - other.y) || 1;
      travelled += 10;
      zoom(k * (after / before), (now.x + other.x) / 2 - box.left, (now.y + other.y) / 2 - box.top);
      tx += (now.x - was.x) / 2;
      ty += (now.y - was.y) / 2;
      apply(false);
    }
    pointers.set(event.pointerId, now);
  }
  function up(event: PointerEvent) {
    pointers.delete(event.pointerId);
  }
  function click(event: MouseEvent) {
    if (travelled > 4) { event.preventDefault(); event.stopPropagation(); }
  }

  function key(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "+" || event.key === "=") zoom(k * 1.25, undefined, undefined, true);
    else if (event.key === "-" || event.key === "_") zoom(k / 1.25, undefined, undefined, true);
    else if (event.key === "0") { k = HOME; centre(); }
  }

  let dialog = $state<HTMLElement>();
  onMount(() => {
    view!.addEventListener("wheel", wheel, { passive: false });
    if (centred === null && graph.nodes.some((n) => n.side === "focus")) {
      centre(false, true);
      centred = graph.nodes.find((n) => n.side === "focus")!.key;
    }
    const page = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog?.focus();
    return () => {
      view?.removeEventListener("wheel", wheel);
      document.documentElement.style.overflow = page;
      cancelAnimationFrame(frame);
      clearTimeout(resting);
      clearTimeout(still);
    };
  });

  // Layer numbers down the left, every layer once there's room for each, and each band's name where it starts.
  const every = $derived(2 * pitch * shown.k >= 18 ? 1 : 2 * pitch * shown.k >= 7 ? 5 : 10);
  const ticks = $derived(Array.from({ length: model.layers }, (_, layer) => layer).filter((layer) => layer % every === 0));
</script>

<svelte:window onkeydown={key} />

<div class="navigator" role="dialog" aria-modal="true" aria-label={`Connections of ${name}`} tabindex="-1" bind:this={dialog}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="view" class:moving bind:this={view} bind:clientWidth={viewWidth} bind:clientHeight={viewHeight} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onclickcapture={click}>
    <div class="pan" style:transform={`translate(${shown.tx - base.tx}px, ${shown.ty - base.ty}px)`}>
      <canvas class="links" bind:this={links} aria-hidden="true"></canvas>
      <div class="canvas" style:transform={`translate(${base.tx}px, ${base.ty}px) scale(${base.k})`}>
        <Graph {graph} {model} {mode} {href} {hovered} point={pointHere} {height} {open} labels={spots} {labelScale} axis={false} onlaid={laid} {surface} />
      </div>
    </div>
    <div class="axis" aria-hidden="true">
      <!-- A pan moves the whole rule at once; only a zoom spaces it again. -->
      <div class="rule" style:transform={`translateY(${shown.ty}px)`}>
        {#each model.bands as band (band.key)}
          <span class="band" style:top={`${depth.heads(band.first) * shown.k}px`} style:height={`${(depth.neurons(band.last) - depth.heads(band.first)) * shown.k}px`}><b>{band.short}</b></span>
        {/each}
        {#each ticks as layer (layer)}<span class="tick" style:top={`${depth.neurons(layer) * shown.k}px`}>{layer}</span>{/each}
      </div>
    </div>
  </div>

  <header class="bar">
    <div class="who">
      <span class="name meta">{name}</span>
      {#if title}<span class="title"><LabelText text={title} /></span>{/if}
    </div>
    <div class="tools">
      {#if modes.length > 1}<Segmented options={modes} value={mode} onchange={onmode} label="Which connections" />{/if}
      <div class="reach" class:off={mode === "with"} inert={mode === "with"}><Tabs options={reaches} value={reach} onchange={(value: string) => onreach(value as Reach)} label="How far" /></div>
      <div class="zoom">
        <IconButton icon="minus" label="Zoom out" onclick={() => zoom(k / 1.25, undefined, undefined, true)} />
        <IconButton icon="focus" label={`Back to ${name}`} onclick={() => { k = HOME; centre(); }} />
        <IconButton icon="plus" label="Zoom in" onclick={() => zoom(k * 1.25, undefined, undefined, true)} />
      </div>
      <IconButton icon="close" label="Close" onclick={close} />
    </div>
  </header>
  <p class="credit meta">Neuron Lens · {model.name} · Labels by Claude Haiku 5.5</p>
</div>

<style>
  .navigator { position: fixed; inset: 0; z-index: 20; background: var(--paper); outline: none; }
  .view { position: absolute; inset: 0; overflow: hidden; cursor: grab; touch-action: none; overscroll-behavior: contain; }
  .view:active { cursor: grabbing; }
  /* What moves every frame of a pan has a layer of its own and moves by a translation alone (the marks and links together,
     the axis's rule), so moving it is the compositor's work and never makes the hundreds of marks and titles be painted or
     layered again. The layer is never scaled, so it is never drawn from a stale picture: a zoom scales what is inside it. */
  .pan { position: absolute; inset: 0; will-change: transform; }
  .links { position: absolute; top: 0; left: 0; pointer-events: none; }
  .canvas { position: absolute; top: 0; left: 0; width: 100%; transform-origin: 0 0; }
  .axis { position: absolute; top: 0; bottom: 0; left: 0; width: 64px; overflow: hidden; background: color-mix(in oklch, var(--paper) 92%, transparent); pointer-events: none; }
  .rule { position: absolute; inset: 0; will-change: transform; }
  /* Off on the one layer, inherited by every mark, rather than set on each. */
  .moving .pan { pointer-events: none; }
  .band { position: absolute; left: 0; width: 6px; border-radius: 0 3px 3px 0; background: var(--wash); }
  .band b { position: absolute; top: 0; left: 12px; color: var(--ink3); font: var(--type-head); white-space: nowrap; writing-mode: vertical-rl; }
  .tick {
    position: absolute;
    left: 34px;
    width: 22px;
    color: var(--ink3);
    font: var(--type-meta);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    text-align: end;
    translate: 0 -50%;
  }
  .bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--s2) var(--s4);
    padding: var(--s3) var(--s4);
    background: color-mix(in oklch, var(--paper) 92%, transparent);
  }
  .who { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s3); min-width: 0; }
  .name { color: var(--ink2); }
  .title { font: var(--type-label); }
  .tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s4); }
  .zoom { display: flex; gap: var(--s1); }
  .reach { transition: opacity var(--fast) var(--ease); }
  .reach.off { opacity: 0; }
  .credit { position: absolute; right: var(--s4); bottom: var(--s3); padding: 1px 5px; border-radius: var(--r-chip); background: color-mix(in oklch, var(--paper) 84%, transparent); font-weight: 400; pointer-events: none; }
  @media (max-width: 600px) { .zoom { display: none; } .bar { padding: var(--s2) var(--s3); } }
</style>

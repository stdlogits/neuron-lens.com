<script lang="ts">
  import { onMount } from "svelte";
  import { IconButton, LabelText, Segmented, Tabs } from "@stdlogits/ledger";
  import Graph from "./Graph.svelte";
  import { rows, type Layout, type Open } from "./layout";
  import type { Graph as GraphData, GraphNode, Mode, Reach } from "./trace";
  import { bandOf, type ModelInfo } from "../../lib/models";
  import { headId, neuronId } from "../../lib/data";

  // The unit's connections, full screen: the same graph and motion as the rail's, laid out at its own
  // size with room under every mark for its title, and moved like a map. Drag (or scroll) to move,
  // pinch (or ⌘/ctrl and scroll, or + and −) to zoom; a unit's mark opens it here, re-centring the graph
  // on it. Its address is the unit's with ?graph, so Back and links work, and Escape closes it.
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

  /** Room between rows at full size: a mark, the line of title under it, and a little air. */
  const PITCH = 40;
  /** The widest a title runs before it is cut short (Graph.svelte's .label). */
  const LABEL = 200;
  const height = $derived(2 * model.layers * PITCH + 18);
  const depth = $derived(rows(graph, height, model.layers));

  // How wide each title sets, so the layout can leave it room.
  let pen: CanvasRenderingContext2D | null = null;
  const measured = new Map<string, number>();
  function measure(text: string) {
    let width = measured.get(text);
    if (width === undefined) {
      pen ??= document.createElement("canvas").getContext("2d");
      const face = getComputedStyle(document.documentElement).getPropertyValue("--text") || "sans-serif";
      if (pen) pen.font = `600 12px ${face}`;
      width = pen ? pen.measureText(text).width : text.length * 7;
      measured.set(text, width);
    }
    return Math.min(LABEL, width);
  }
  const nameOf = (n: GraphNode) => (n.kind === "head" ? headId(n.layer, n.index) : `${neuronId(n.layer, n.index)} ${n.pole > 0 ? "+" : "−"}`);
  const open: Open = { gap: 18, reach: (n) => (measure(n.wire?.title || nameOf(n)) + 2) / 2 };

  // The view: the graph's x and y at full size map to x · k + tx, y · k + ty on screen.
  let view = $state<HTMLDivElement>();
  let k = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  /** A re-centring glides; a drag or a zoom follows the hand. */
  let gliding = $state(false);
  let centred: string | null = null;
  const MIN = 0.12;
  const MAX = 3;
  const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

  function centre(glide = true) {
    const focus = graph.nodes.find((n) => n.side === "focus");
    if (!view || !focus) return;
    const box = view.getBoundingClientRect();
    gliding = glide;
    tx = box.width / 2;
    ty = box.height * 0.45 - (focus.kind === "head" ? depth.heads(focus.layer) : depth.neurons(focus.layer)) * k;
  }
  // A new unit at the centre: glide to it (the first, jump).
  function laid(placed: Layout) {
    const focus = placed.nodes.find((n) => n.side === "focus");
    if (!view || !focus || focus.key === centred) return;
    centre(centred !== null);
    centred = focus.key;
  }

  function zoom(to: number, x?: number, y?: number, glide = false) {
    if (!view) return;
    const box = view.getBoundingClientRect();
    const px = x ?? box.width / 2;
    const py = y ?? box.height / 2;
    const next = clamp(to);
    gliding = glide;
    tx = px - ((px - tx) * next) / k;
    ty = py - ((py - ty) * next) / k;
    k = next;
  }

  function wheel(event: WheelEvent) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const box = view!.getBoundingClientRect();
      zoom(k * Math.exp(-event.deltaY * 0.01), event.clientX - box.left, event.clientY - box.top);
    } else {
      gliding = false;
      tx -= event.deltaX;
      ty -= event.deltaY;
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
        gliding = false;
        tx += now.x - was.x;
        ty += now.y - was.y;
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
    else if (event.key === "0") { k = 1; centre(); }
  }

  let dialog = $state<HTMLElement>();
  onMount(() => {
    view!.addEventListener("wheel", wheel, { passive: false });
    if (centred === null && graph.nodes.some((n) => n.side === "focus")) {
      centre(false);
      centred = graph.nodes.find((n) => n.side === "focus")!.key;
    }
    const page = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog?.focus();
    return () => {
      view?.removeEventListener("wheel", wheel);
      document.documentElement.style.overflow = page;
    };
  });

  // Zoomed out past FAR, only the strongest few keep their titles, at a size that still reads; the rest return as it zooms in.
  const FAR = 0.55;
  const FEW = 12;
  const titled = $derived.by(() => {
    if (k >= FAR) return true;
    const strongest = graph.nodes.filter((n) => n.side !== "focus").sort((a, b) => b.flow - a.flow).slice(0, FEW);
    return new Set([...strongest.map((n) => n.key), ...graph.nodes.filter((n) => n.side === "focus").map((n) => n.key)]);
  });

  // Layer numbers down the left, every layer once there's room for each, and each band's name where it starts.
  const every = $derived(2 * PITCH * k >= 18 ? 1 : 2 * PITCH * k >= 7 ? 5 : 10);
  const ticks = $derived(Array.from({ length: model.layers }, (_, layer) => layer).filter((layer) => layer % every === 0));
</script>

<svelte:window onkeydown={key} />

<div class="navigator" role="dialog" aria-modal="true" aria-label={`Connections of ${name}`} tabindex="-1" bind:this={dialog}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="view" bind:this={view} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onclickcapture={click}>
    <div class="canvas" class:gliding style:transform={`translate(${tx}px, ${ty}px) scale(${k})`}>
      <Graph {graph} {model} {mode} {href} {hovered} {point} {height} {open} labels={titled} labelScale={k < FAR ? 1 / k : 1} axis={false} onlaid={laid} />
    </div>
    <div class="axis" aria-hidden="true">
      {#each model.bands as band (band.key)}
        <span class="band" style:top={`${ty + depth.heads(band.first) * k}px`} style:height={`${(depth.neurons(band.last) - depth.heads(band.first)) * k}px`}><b>{band.short}</b></span>
      {/each}
      {#each ticks as layer (layer)}<span class="tick" style:top={`${ty + depth.neurons(layer) * k}px`}>{layer}</span>{/each}
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
        <IconButton icon="focus" label={`Back to ${name}`} onclick={() => { k = 1; centre(); }} />
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
  .canvas { position: absolute; top: 0; left: 0; width: 100%; transform-origin: 0 0; }
  .canvas.gliding { transition: transform var(--glide) var(--ease); }
  .axis { position: absolute; top: 0; bottom: 0; left: 0; width: 64px; background: color-mix(in oklch, var(--paper) 92%, transparent); pointer-events: none; }
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
  .credit { position: absolute; right: var(--s4); bottom: var(--s3); font-weight: 400; pointer-events: none; }
  @media (max-width: 600px) { .zoom { display: none; } .bar { padding: var(--s2) var(--s3); } }
</style>

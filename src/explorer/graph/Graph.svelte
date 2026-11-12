<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { Icon, fadeIn, fadeOut, hideTip } from "@stdlogits/ledger";
  import { bandOf, depthColor, type ModelInfo } from "../../lib/models";
  import { headId, neuronId, percent } from "../../lib/data";
  import { Ink, OVERSCAN, type View } from "./ink";
  import { layout, rows, spanOf, type Crop, type Layout, type Open, type Spot } from "./layout";
  import { Stage, type Look, type Seated, type Shown } from "./stage";
  import { headInput, type Graph, type GraphEdge, type Mode } from "./trace";
  import type { Picked } from "./Card.svelte";

  // The unit's directed graph, drawn at true depth: a band per layer down the page, so what feeds it
  // sits above it and what it feeds below. A dot is a neuron's side and a bar a head, in the depth
  // colour of its layer and as large as the flow through it; a link is as heavy as its flow, grey and
  // dashed where it pushes against. Pointing at a unit lights what connects it to the centre. The
  // stage (stage.ts) owns where everything is and how it moves; this owns what each thing looks like.
  // The links are drawn on a canvas (ink.ts): its own, behind the marks, or the navigator's, which sits
  // outside its zoom and draws them under its view, so they stay sharp at any zoom. A touch, with no
  // hover to show a unit's tip, opens its card (onpick) where a mouse's click would go straight there.
  let { graph, model, mode, href, hovered, point, height = 780, open, labels = null, labelScale = 1, axis = true, onlaid, onpick, found = null, wave = null, round = 0, surface }: {
    graph: Graph;
    model: ModelInfo;
    mode: Mode;
    href: (kind: "neuron" | "head", layer: number, index: number) => string;
    hovered: string | null;
    /** The pointer has come to this unit, or left (null). */
    point: (key: string | null) => void;
    height?: number;
    /** The navigator's spacing: at its own size, with room under each mark for its title. */
    open?: Open;
    /** The units whose titles are shown, and on which side of the mark. */
    labels?: Map<string, Spot> | null;
    /** How much the titles are scaled against the marks: the navigator keeps them one size on screen at any zoom. */
    labelScale?: number;
    /** The layer numbers down the left. */
    axis?: boolean;
    /** Where it was laid out. */
    onlaid?: (placed: Layout) => void;
    /** A unit tapped (by touch or pen): its card, in place of going there. */
    onpick?: (picked: Picked) => void;
    /** What a search found (the navigator's): the rest falls away, and links between two found stand out. */
    found?: Set<string> | null;
    /** How long each unit waits (ms) before it falls away or rings, so the change spreads out from the middle of the screen. */
    wave?: Map<string, number> | null;
    /** Which search this is: each new one rings what it found again. */
    round?: number;
    /** A canvas of the navigator's own to draw the links on, its size on screen, and its view of the graph. */
    surface?: { canvas: HTMLCanvasElement; width: number; height: number; view: View } | null;
  } = $props();

  let width = $state(0);
  const HEIGHT = $derived(height);
  // The rail shows only the layers its graph reaches, as far apart as ever, with the same room above the first
  // row and below the last (a graph of a row or two gets a little more, evenly); the axis marks what it leaves
  // out with ^ and v. The navigator shows them all, to pan through.
  const PAD = 28;
  const SHORTEST = 140;
  const crop = $derived.by((): Crop | null => {
    if (open || !axis) return null;
    const span = spanOf(graph);
    if (!span) return null;
    const all = rows(graph, HEIGHT, model.layers);
    const reach = all.row(span[1]) - all.row(span[0]);
    return { first: span[0], last: span[1], pad: Math.max(PAD, (SHORTEST - reach) / 2) };
  });
  /** The box: the crop's rows and its room, or the whole height. */
  const BOX = $derived.by(() => {
    if (!crop) return HEIGHT;
    const all = rows(graph, HEIGHT, model.layers);
    return all.row(crop.last) - all.row(crop.first) + 2 * crop.pad;
  });
  let shown = $state.raw<Shown>({ nodes: [], edges: [] });
  const stage = new Stage(() => (shown = stage.shown()));
  onDestroy(() => stage.destroy());

  /** Each node's layer, for its links' colour: kept for as long as the model is, so a link leaving still finds its ends. */
  const layers = new Map<string, number>();
  let layersOf = "";

  let laidOut = 0;
  $effect(() => {
    const next = graph;
    const across = width;
    const cropped = crop;
    void HEIGHT;
    if (across <= 0) return;
    untrack(() => {
      if (layersOf !== model.id) { layers.clear(); layersOf = model.id; }
      for (const n of next.nodes) layers.set(n.key, n.layer);
      const placed = layout(next, across, HEIGHT, model.layers, next.settled ? undefined : stage.targets(), open, cropped ?? undefined);
      const snap = laidOut > 0 && across !== laidOut && !open;
      laidOut = across;
      shown = stage.update(next, placed, snap);
      onlaid?.(placed);
    });
  });
  const seat = (el: HTMLElement, key: string) => stage.attachNode(el, key);
  const titled = (el: HTMLElement, place: [string, Spot]) => stage.attachTitle(el, place);

  const top = $derived(graph.edges.reduce((max, e) => Math.max(max, e.flow), 1e-9));

  // What connects the pointed-at unit to the centre: every link on a path through it.
  const lit = $derived.by(() => {
    if (!hovered) return null;
    const start = graph.nodes.find((n) => n.key === hovered);
    if (!start) return null;
    const edges = new Set<string>();
    const nodes = new Set<string>([hovered]);
    if (start.side === "focus") {
      for (const e of graph.edges) if (e.from === hovered || e.to === hovered) { edges.add(e.key); nodes.add(e.from); nodes.add(e.to); }
      return { edges, nodes };
    }
    // Toward the unit: forward along links from above it, backward from below it.
    const onward = new Map<string, GraphEdge[]>();
    for (const e of graph.edges) {
      const here = start.side === "up" ? e.from : e.to;
      const list = onward.get(here);
      if (list) list.push(e);
      else onward.set(here, [e]);
    }
    const stack = [hovered];
    while (stack.length) {
      for (const e of onward.get(stack.pop()!) ?? []) {
        const next = start.side === "up" ? e.to : e.from;
        edges.add(e.key);
        if (!nodes.has(next)) { nodes.add(next); stack.push(next); }
      }
    }
    return { edges, nodes };
  });

  const nameOf = (n: { kind: string; layer: number; index: number; pole: number }) => (n.kind === "head" ? headId(n.layer, n.index) : `${neuronId(n.layer, n.index)} ${n.pole > 0 ? "+" : "−"}`);
  /** How it stands to the unit, under its title in the tip. */
  function standing(n: Seated): string | undefined {
    if (n.side === "focus") return undefined;
    if (mode === "with") return `Active at ${Math.round(n.flow * 5)} of its first 5 top firings`;
    if (mode !== "weights") {
      const share = percent(Math.min(1, n.flow), n.flow < 0.1 ? 1 : 0);
      if (n.side === "up") {
        const head = graph.nodes.some((other) => other.side === "focus" && other.kind === "head");
        return `${share} of ${head ? headInput("it", mode === "query" ? 1 : mode === "key" ? 2 : 0) : "its activation"} traces back here`;
      }
      const what = n.kind === "neuron" ? "this neuron's activation" : n.onward > 0 ? "what this head writes" : "where this head looks";
      return `${share} of ${what} traces back to it`;
    }
    const way = n.hop === 1 ? "Directly" : `${n.hop} links`;
    return `${way} ${n.side === "up" ? "upstream" : "downstream"} in the weights`;
  }
  // A tap shows the unit's card rather than its tip, which Ledger shows on a touch's pointerover (on the page's
  // root, which a delegated handler would reach too late) and its pointerdown (on the document).
  let touched = false;
  function hush(el: HTMLElement) {
    const over = (event: PointerEvent) => { if (event.pointerType !== "mouse" && onpick) event.stopPropagation(); };
    el.addEventListener("pointerover", over);
    return { destroy: () => el.removeEventListener("pointerover", over) };
  }
  function pressed(event: PointerEvent) {
    touched = event.pointerType !== "mouse";
    if (touched && onpick) {
      event.stopPropagation();
      hideTip();
    }
  }
  function clicked(event: MouseEvent, node: Seated) {
    const touch = touched;
    touched = false;
    if (!touch || !onpick || event.defaultPrevented) return;
    event.preventDefault();
    hideTip();
    onpick({ key: node.key, name: nameOf(node), title: node.wire?.title ?? "", sub: standing(node), href: href(node.kind, node.layer, node.index), color: depthColor(model, node.layer) });
  }
  const depth = $derived(rows(graph, HEIGHT, model.layers, crop ?? undefined));
  /** The layer numbers down the left, every fifth; with the rail cropped, those it shows, and at its top a ^ for
   * the layers above it leaves out (at its bottom a v for those below), with a number too close to one dropped. */
  type Tick = { key: string; y: number; layer?: number; edge?: "up" | "down"; count?: number; from?: number; to?: number };
  const ticks = $derived.by((): Tick[] => {
    if (!axis) return [];
    const every = Array.from({ length: model.layers }, (_, layer) => layer).filter((layer) => layer % 5 === 0);
    if (!crop) return every.map((layer) => ({ key: `${layer}`, y: depth.neurons(layer), layer }));
    const top = Math.floor(crop.first / 2);
    const bottom = Math.floor(crop.last / 2);
    const edges: Tick[] = [];
    if (top > 0) edges.push({ key: "up", y: depth.row(crop.first), edge: "up", count: top, from: 0, to: top - 1 });
    if (bottom < model.layers - 1) edges.push({ key: "down", y: depth.row(crop.last), edge: "down", count: model.layers - 1 - bottom, from: bottom + 1, to: model.layers - 1 });
    const numbers = every
      .filter((layer) => layer >= top && layer <= bottom)
      .map((layer): Tick => ({ key: `${layer}`, y: depth.neurons(layer), layer }))
      .filter((tick) => edges.every((edge) => Math.abs(edge.y - tick.y) >= 16));
    return [...edges, ...numbers].sort((a, b) => a.y - b.y);
  });
  const layersText = (from: number, to: number) => (from === to ? `Layer ${from}` : `Layers ${from}–${to}`);

  // The links: as heavy as their flow, in the depth colour of their upstream end, grey and dashed where they
  // push against; with a unit lit, what connects it stands out and the rest all but goes.
  let own = $state<HTMLCanvasElement>();
  /** How far the canvas reaches past the box above and below, so a link bending past a row at the edge isn't cut.
   * Not across: the marks keep inside the box's gutters (layout.ts), and a canvas wider than the box would widen a phone's page. */
  const MARGIN = 8;
  let ink = $state.raw<Ink | null>(null);
  function look(edge: GraphEdge): Look {
    const strength = Math.sqrt(Math.min(1, edge.flow / top));
    const against = edge.value < 0;
    const ends = found ? Number(found.has(edge.from)) + Number(found.has(edge.to)) : 0;
    return {
      color: ink ? ink.color(against ? "var(--ink3)" : depthColor(model, layers.get(edge.from) ?? 0)) : "",
      width: 0.7 + 3.3 * strength,
      alpha: lit ? (lit.edges.has(edge.key) ? 0.95 : 0.06) : found ? [0.03, 0.12, 0.5 + 0.45 * strength][ends] : 0.28 + 0.5 * strength,
      against,
    };
  }
  /** Out of what a search found, unless it lies on what the pointed-at unit lights. */
  const away = (key: string) => !!found && !found.has(key) && !(lit && lit.nodes.has(key));
  /** Faded while another unit is lit. */
  const dim = (key: string) => !!lit && !lit.nodes.has(key) && !away(key);
  /** The canvas alone, so the navigator's view moving doesn't make the painter anew. */
  const canvas = $derived(surface?.canvas ?? own);
  $effect(() => {
    if (!canvas) return;
    // The navigator's canvas draws past the screen, so a pan mostly moves what is drawn.
    const made = new Ink(canvas, () => stage.restyle(false), untrack(() => (surface ? OVERSCAN : 0)));
    ink = made;
    untrack(() => stage.draw(made, look, (key) => dim(key) || away(key), (n) => depthColor(model, n.layer)));
    return () => {
      made.destroy();
      if (ink === made) ink = null;
    };
  });
  // Its size and view, and the titles' scale against the marks (which a zoom changes with the view); then
  // draw as things stand, once.
  $effect(() => {
    if (!ink) return;
    const scale = labelScale;
    if (surface) {
      ink.resize(surface.width, surface.height);
      ink.setView(surface.view);
    } else {
      ink.resize(width, BOX + 2 * MARGIN);
      ink.setView({ k: 1, tx: 0, ty: MARGIN });
    }
    untrack(() => {
      stage.scaleTitles(scale);
      stage.redraw();
    });
  });
  // A unit lit or let go, the strongest link changed, a new model's colours: every link takes its look again.
  $effect(() => {
    void lit;
    void found;
    void top;
    void model;
    if (ink) untrack(() => stage.restyle());
  });
</script>

<div class="graph" bind:clientWidth={width} style:height={`${BOX}px`}>
  {#if width > 0}
    {#each ticks as tick, i (tick.key)}
      {#if tick.edge}
        <span class="tick edge" style:--i={i} style:top={`${tick.y}px`} data-tip-title={`${tick.count} ${tick.count === 1 ? "layer" : "layers"} ${tick.edge === "up" ? "above" : "below"}`} data-tip={`${layersText(tick.from!, tick.to!)}, with nothing on this graph`} aria-label={`${tick.count} more ${tick.count === 1 ? "layer" : "layers"} ${tick.edge === "up" ? "above" : "below"}`}><Icon name={tick.edge} size={14} /></span>
      {:else}
        <span class="tick" style:--i={i} style:top={`${tick.y}px`} data-tip-title={`Layer ${tick.layer}`} data-tip={bandOf(model, tick.layer!).name}>{tick.layer}</span>
      {/if}
    {/each}
    {#if !surface}<canvas class="links" bind:this={own} style:left="0" style:top={`${-MARGIN}px`} aria-hidden="true"></canvas>{/if}
    {#each shown.nodes as node (node.key)}
      <a
        class="node"
        class:focus={node.side === "focus"}
        class:hot={hovered === node.key}
        class:dim={dim(node.key)}
        class:away={away(node.key)}
        class:found={found?.has(node.key)}
        style:--wave={wave ? `${wave.get(node.key) ?? 0}ms` : undefined}
        style:--ring={round % 2 ? "ring-a" : "ring-b"}
        style:--c={depthColor(model, node.layer)}
        use:seat={node.key}
        use:hush
        href={href(node.kind, node.layer, node.index)}
        data-tip={node.wire?.title || nameOf(node)}
        data-tip-title={nameOf(node)}
        data-tip-sub={standing(node)}
        aria-label={`${nameOf(node)}${node.wire?.title ? `: ${node.wire.title}` : ""}`}
        onpointerenter={() => point(node.key)}
        onpointerleave={() => point(null)}
        onfocus={() => point(node.key)}
        onblur={() => point(null)}
        onpointerdown={pressed}
        onclick={(event) => clicked(event, node)}
      ><i style:background={depthColor(model, node.layer)}></i>{#if labels?.has(node.key)}<span class="label {labels.get(node.key)}" use:titled={[node.key, labels.get(node.key)!]} in:fadeIn out:fadeOut>{node.wire?.title || nameOf(node)}</span>{/if}</a>
    {/each}
  {/if}
</div>

<style>
  .graph { position: relative; min-width: 0; transition: height var(--glide) var(--ease); }
  .links { position: absolute; pointer-events: none; }
  .tick {
    position: absolute;
    left: 0;
    width: 20px;
    color: var(--ink3);
    font: var(--type-meta);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    text-align: end;
    translate: 0 -50%;
    cursor: help;
    transition: top var(--glide) var(--ease);
    animation: appear var(--in) var(--ease) backwards;
    animation-delay: calc(var(--i) * 32ms);
  }
  @keyframes appear { from { opacity: 0; } }
  .tick.edge { display: flex; justify-content: flex-end; color: var(--ink2); }
  /* The stage moves the link and fades it, at the size its mark is going to; the mark inside grows to fill it by a transform. */
  .node { position: absolute; left: 0; top: 0; display: block; }
  .node::after { content: ""; position: absolute; inset: -6px; }
  .node i {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: var(--r-pill);
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition: opacity var(--in) var(--ease), scale var(--in) var(--ease), background-color var(--glide) var(--ease), outline-color var(--glide) var(--ease);
  }
  /* A search: what it didn't find falls away and what it found rings once, both spreading out from the middle
     of the screen (--wave); each new search rings again (--ring alternates between two names for one ring). */
  .node i { transition-delay: var(--wave, 0ms), 0ms, 0ms, 0ms; }
  .away i { opacity: 0.12; scale: 0.7; }
  .away .label { opacity: 0; }
  .found::before {
    content: "";
    position: absolute;
    inset: -3px;
    border-radius: var(--r-pill);
    box-shadow: 0 0 0 2px var(--c);
    opacity: 0;
    pointer-events: none;
    animation: var(--ring) calc(2 * var(--glide)) var(--ease) var(--wave, 0ms) both;
  }
  @keyframes ring-a { from { opacity: 0.9; scale: 0.6; } to { opacity: 0; scale: 2.2; } }
  @keyframes ring-b { from { opacity: 0.9; scale: 0.6; } to { opacity: 0; scale: 2.2; } }
  @media (prefers-reduced-motion: reduce) { .found::before { animation: none; } .node i { transition-delay: 0ms; } }
  .focus { z-index: 1; }
  .focus i { outline-color: var(--ink); }
  .dim i { opacity: 0.25; }
  /* A title by its mark, where the navigator found room for it, one size on screen at any zoom, wrapped at
     LABEL (Navigator.svelte). Its frosted glass, the tip's, is painted on the links' canvas behind it (ink.ts),
     where moving the view costs nothing; a backdrop-filter on each title blurred anew every frame. Its scale
     against the marks, --s, is set on each title (stage.ts) rather than inherited from the graph, so a zoom
     restyles the titles alone. It covers no mark and no other title, so it is part of its unit's target: a
     pointer or a tap on it is one on the unit. */
  .label {
    --s: 1;
    position: absolute;
    width: max-content;
    max-width: 160px;
    padding: 1px 5px;
    border-radius: var(--r-chip);
    color: var(--ink2);
    font: var(--type-meta);
    text-align: center;
    overflow-wrap: anywhere;
    scale: var(--s);
    transition: opacity var(--in) var(--ease), color var(--fast) var(--ease);
  }
  .label.below { top: 100%; left: 50%; transform-origin: top center; translate: -50% calc(3px * var(--s)); }
  .label.above { bottom: 100%; left: 50%; transform-origin: bottom center; translate: -50% calc(-3px * var(--s)); }
  .label.right { top: 50%; left: 100%; transform-origin: left center; translate: calc(3px * var(--s)) -50%; text-align: start; }
  .label.left { top: 50%; right: 100%; transform-origin: right center; translate: calc(-3px * var(--s)) -50%; text-align: end; }
  .focus .label { color: var(--ink); font-weight: 600; }
  .hot .label { color: var(--ink); }
  .dim .label { opacity: 0.25; }
  .hot i { scale: 1.3; }
  .node:active i { scale: 0.92; }
  @media (hover: hover) { .node:hover i { scale: 1.3; } }
</style>

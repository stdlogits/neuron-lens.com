<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { fadeIn, fadeOut } from "@stdlogits/ledger";
  import { bandOf, depthColor, type ModelInfo } from "../../lib/models";
  import { headId, neuronId, percent } from "../../lib/data";
  import { Ink, type View } from "./ink";
  import { layout, rows, type Layout, type Open, type Spot } from "./layout";
  import { Stage, type Look, type Seated, type Shown } from "./stage";
  import { headInput, type Graph, type GraphEdge, type Mode } from "./trace";

  // The unit's directed graph, drawn at true depth: a band per layer down the page, so what feeds it
  // sits above it and what it feeds below. A dot is a neuron's side and a bar a head, in the depth
  // colour of its layer and as large as the flow through it; a link is as heavy as its flow, grey and
  // dashed where it pushes against. Pointing at a unit lights what connects it to the centre. The
  // stage (stage.ts) owns where everything is and how it moves; this owns what each thing looks like.
  // The links are drawn on a canvas (ink.ts): its own, behind the marks, or the navigator's, which sits
  // outside its zoom and draws them under its view, so they stay sharp at any zoom.
  let { graph, model, mode, href, hovered, point, height = 780, open, labels = null, labelScale = 1, axis = true, onlaid, surface }: {
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
    /** A canvas of the navigator's own to draw the links on, its size on screen, and its view of the graph. */
    surface?: { canvas: HTMLCanvasElement; width: number; height: number; view: View } | null;
  } = $props();

  let width = $state(0);
  const HEIGHT = $derived(height);
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
    void HEIGHT;
    if (across <= 0) return;
    untrack(() => {
      if (layersOf !== model.id) { layers.clear(); layersOf = model.id; }
      for (const n of next.nodes) layers.set(n.key, n.layer);
      const placed = layout(next, across, HEIGHT, model.layers, next.settled ? undefined : stage.targets(), open);
      const snap = laidOut > 0 && across !== laidOut && !open;
      laidOut = across;
      shown = stage.update(next, placed, snap);
      onlaid?.(placed);
    });
  });
  const seat = (el: HTMLElement, key: string) => stage.attachNode(el, key);

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
  const ticks = $derived(axis ? Array.from({ length: model.layers }, (_, layer) => layer).filter((layer) => layer % 5 === 0) : []);
  const depth = $derived(rows(graph, HEIGHT, model.layers));

  // The links: as heavy as their flow, in the depth colour of their upstream end, grey and dashed where they
  // push against; with a unit lit, what connects it stands out and the rest all but goes.
  let own = $state<HTMLCanvasElement>();
  /** How far the canvas reaches past the box above and below, so a link bending past a row at the edge isn't cut.
   * Not across: the marks keep inside the box's gutters (layout.ts), and a canvas wider than the box would widen a phone's page. */
  const MARGIN = 8;
  /** How far past the screen the navigator's canvas draws, in CSS pixels. */
  const OVERSCAN = 160;
  let ink = $state.raw<Ink | null>(null);
  function look(edge: GraphEdge): Look {
    const strength = Math.sqrt(Math.min(1, edge.flow / top));
    const against = edge.value < 0;
    return {
      color: ink ? ink.color(against ? "var(--ink3)" : depthColor(model, layers.get(edge.from) ?? 0)) : "",
      width: 0.7 + 3.3 * strength,
      alpha: lit ? (lit.edges.has(edge.key) ? 0.95 : 0.06) : 0.28 + 0.5 * strength,
      against,
    };
  }
  /** The canvas alone, so the navigator's view moving doesn't make the painter anew. */
  const canvas = $derived(surface?.canvas ?? own);
  $effect(() => {
    if (!canvas) return;
    // The navigator's canvas draws past the screen, so a pan mostly slides it.
    const made = new Ink(canvas, () => stage.restyle(false), untrack(() => (surface ? OVERSCAN : 0)));
    ink = made;
    untrack(() => stage.draw(made, look));
    return () => {
      made.destroy();
      if (ink === made) ink = null;
    };
  });
  // Its size and view; then draw as things stand.
  $effect(() => {
    if (!ink) return;
    if (surface) {
      const resized = ink.resize(surface.width, surface.height);
      if (!ink.slide(surface.view) || resized) untrack(() => stage.redraw());
    } else {
      ink.resize(width, HEIGHT + 2 * MARGIN);
      ink.setView({ k: 1, tx: 0, ty: MARGIN });
      untrack(() => stage.redraw());
    }
  });
  // A unit lit or let go, the strongest link changed, a new model's colours: every link takes its look again.
  $effect(() => {
    void lit;
    void top;
    void model;
    if (ink) untrack(() => stage.restyle());
  });
</script>

<div class="graph" bind:clientWidth={width} style:height={`${HEIGHT}px`} style:--label-scale={labelScale}>
  {#if width > 0}
    {#each ticks as layer, i (layer)}<span class="tick" style:--i={i} style:top={`${depth.neurons(layer)}px`} data-tip-title={`Layer ${layer}`} data-tip={bandOf(model, layer).name}>{layer}</span>{/each}
    {#if !surface}<canvas class="links" bind:this={own} style:left="0" style:top={`${-MARGIN}px`} aria-hidden="true"></canvas>{/if}
    {#each shown.nodes as node (node.key)}
      <a
        class="node"
        class:focus={node.side === "focus"}
        class:hot={hovered === node.key}
        class:dim={lit && !lit.nodes.has(node.key)}
        use:seat={node.key}
        href={href(node.kind, node.layer, node.index)}
        data-tip={node.wire?.title || nameOf(node)}
        data-tip-title={nameOf(node)}
        data-tip-sub={standing(node)}
        aria-label={`${nameOf(node)}${node.wire?.title ? `: ${node.wire.title}` : ""}`}
        onpointerenter={() => point(node.key)}
        onpointerleave={() => point(null)}
        onfocus={() => point(node.key)}
        onblur={() => point(null)}
      ><i style:background={depthColor(model, node.layer)}></i>{#if labels?.has(node.key)}<span class="label {labels.get(node.key)}" in:fadeIn out:fadeOut>{node.wire?.title || nameOf(node)}</span>{/if}</a>
    {/each}
  {/if}
</div>

<style>
  .graph { position: relative; min-width: 0; }
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
  .focus { z-index: 1; }
  .focus i { outline-color: var(--ink); }
  .dim i { opacity: 0.25; }
  /* A title by its mark, where the navigator found room for it, one size on screen at any zoom: wrapped
     at LABEL (Navigator.svelte) on the tip's frosted glass, so links behind it blur rather than cross its words. */
  .label {
    --s: var(--label-scale, 1);
    position: absolute;
    width: max-content;
    max-width: 160px;
    padding: 1px 5px;
    border-radius: var(--r-chip);
    background: color-mix(in oklch, var(--paper) 72%, transparent);
    -webkit-backdrop-filter: blur(20px) saturate(1.6);
    backdrop-filter: blur(20px) saturate(1.6);
    color: var(--ink2);
    font: var(--type-meta);
    text-align: center;
    overflow-wrap: anywhere;
    scale: var(--s);
    pointer-events: none;
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
  /* Without a blur behind it, the glass would let the links show through: make it solid instead, as the tip does. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .label { background: var(--paper); } }
  @media (prefers-reduced-transparency: reduce) { .label { background: var(--paper); } }
</style>

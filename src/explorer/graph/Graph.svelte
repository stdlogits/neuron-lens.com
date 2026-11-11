<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { fadeIn, fadeOut } from "@stdlogits/ledger";
  import { bandOf, depthColor, type ModelInfo } from "../../lib/models";
  import { headId, neuronId, percent } from "../../lib/data";
  import { layout, rows, type Layout, type Open, type Spot } from "./layout";
  import { Stage, type Seated, type Shown } from "./stage";
  import { headInput, type Graph, type GraphEdge, type Mode } from "./trace";

  // The unit's directed graph, drawn at true depth: a band per layer down the page, so what feeds it
  // sits above it and what it feeds below. A dot is a neuron's side and a bar a head, in the depth
  // colour of its layer and as large as the flow through it; a link is as heavy as its flow, grey and
  // dashed where it pushes against. Pointing at a unit lights what connects it to the centre. The
  // stage (stage.ts) owns where everything is and how it moves; this owns what each thing looks like.
  let { graph, model, mode, href, hovered, point, height = 780, open, labels = null, labelScale = 1, axis = true, onlaid }: {
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
  } = $props();

  let width = $state(0);
  const HEIGHT = $derived(height);
  let shown = $state.raw<Shown>({ nodes: [], edges: [] });
  const stage = new Stage(() => (shown = stage.shown()));
  onDestroy(() => stage.destroy());

  let laidOut = 0;
  $effect(() => {
    const next = graph;
    const across = width;
    void HEIGHT;
    if (across <= 0) return;
    untrack(() => {
      const placed = layout(next, across, HEIGHT, model.layers, next.settled ? undefined : stage.targets(), open);
      const snap = laidOut > 0 && across !== laidOut && !open;
      laidOut = across;
      shown = stage.update(next, placed, snap);
      onlaid?.(placed);
    });
  });
  const seat = (el: HTMLElement, key: string) => stage.attachNode(el, key);
  const strand = (el: SVGPathElement, key: string) => stage.attachEdge(el, key);

  const top = $derived(graph.edges.reduce((max, e) => Math.max(max, e.flow), 1e-9));
  const layerOf = $derived(new Map(shown.nodes.map((n) => [n.key, n.layer])));

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
      onward.set(here, [...(onward.get(here) ?? []), e]);
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
</script>

<div class="graph" bind:clientWidth={width} style:height={`${HEIGHT}px`} style:--label-scale={labelScale}>
  {#if width > 0}
    {#each ticks as layer, i (layer)}<span class="tick" style:--i={i} style:top={`${depth.neurons(layer)}px`} data-tip-title={`Layer ${layer}`} data-tip={bandOf(model, layer).name}>{layer}</span>{/each}
    <svg width={width} height={HEIGHT} aria-hidden="true">
      {#each shown.edges as edge (edge.key)}
        {@const on = lit?.edges.has(edge.key)}
        <path
          use:strand={edge.key}
          pathLength={edge.value < 0 ? undefined : 1}
          class:against={edge.value < 0}
          style:stroke={edge.value < 0 ? undefined : depthColor(model, layerOf.get(edge.from) ?? 0)}
          style:stroke-width={`${(0.7 + 3.3 * Math.sqrt(Math.min(1, edge.flow / top))).toFixed(2)}px`}
          style:opacity={lit ? (on ? 0.95 : 0.06) : (0.28 + 0.5 * Math.sqrt(Math.min(1, edge.flow / top))).toFixed(2)}
        />
      {/each}
    </svg>
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
  svg { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
  path { fill: none; stroke-linecap: round; transition: opacity var(--in) var(--ease), stroke-width var(--glide) var(--ease), stroke var(--glide) var(--ease); }
  path.against { stroke: var(--ink3); stroke-dasharray: 3 3; }
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
  /* The stage moves the link and fades it; what it looks like at any moment is the mark inside. */
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

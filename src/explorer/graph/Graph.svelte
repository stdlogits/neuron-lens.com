<script lang="ts">
  import { depthColor, type ModelInfo } from "../../lib/models";
  import { headId, neuronId } from "../../lib/data";
  import { layout } from "./layout";
  import type { Graph, GraphEdge } from "./trace";

  // The unit's directed graph, drawn at true depth: a band per layer down the page, so what feeds it
  // sits above it and what it feeds below. A dot is a neuron's side and a bar a head, in the depth
  // colour of its layer and as large as the flow through it; a link is as heavy as its flow, grey and
  // dashed where it pushes against. Pointing at a unit lights what connects it to the centre.
  let { graph, model, href, hovered = $bindable(null) }: {
    graph: Graph;
    model: ModelInfo;
    href: (kind: "neuron" | "head", layer: number, index: number) => string;
    hovered?: string | null;
  } = $props();

  let width = $state(0);
  const HEIGHT = 780;
  const placed = $derived(width > 0 ? layout(graph, width, HEIGHT, model.layers) : null);
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
  const ticks = $derived(Array.from({ length: model.layers }, (_, layer) => layer).filter((layer) => layer % 5 === 0));
</script>

<div class="graph" bind:clientWidth={width} style:height={`${HEIGHT}px`}>
  {#if placed}
    {#each ticks as layer (layer)}<span class="tick" style:top={`${(layer + 0.62) * (HEIGHT / model.layers)}px`} aria-hidden="true">{layer}</span>{/each}
    <svg width={width} height={HEIGHT} aria-hidden="true">
      {#each graph.edges as edge (edge.key)}
        {@const path = placed.paths.get(edge.key)}
        {#if path}
          {@const on = lit?.edges.has(edge.key)}
          <path
            d={path}
            class:against={edge.value < 0}
            style:stroke={edge.value < 0 ? undefined : depthColor(model, placed.nodes.find((n) => n.key === edge.from)?.layer ?? 0)}
            style:stroke-width={`${(0.7 + 3.3 * Math.sqrt(edge.flow / top)).toFixed(2)}px`}
            style:opacity={lit ? (on ? 0.95 : 0.06) : (0.28 + 0.5 * Math.sqrt(edge.flow / top)).toFixed(2)}
          />
        {/if}
      {/each}
    </svg>
    {#each placed.nodes as node (node.key)}
      <a
        class="node"
        class:focus={node.side === "focus"}
        class:dim={lit && !lit.nodes.has(node.key)}
        href={href(node.kind, node.layer, node.index)}
        style:transform={`translate(${(node.x - node.w / 2).toFixed(1)}px, ${(node.y - node.h / 2).toFixed(1)}px)`}
        style:width={`${node.w.toFixed(1)}px`}
        style:height={`${node.h.toFixed(1)}px`}
        style:background={depthColor(model, node.layer)}
        data-tip={node.wire?.title || nameOf(node)}
        data-tip-title={nameOf(node)}
        aria-label={`${nameOf(node)}${node.wire?.title ? `: ${node.wire.title}` : ""}`}
        onpointerenter={() => (hovered = node.key)}
        onpointerleave={() => (hovered = null)}
        onfocus={() => (hovered = node.key)}
        onblur={() => (hovered = null)}
      ></a>
    {/each}
  {/if}
</div>

<style>
  .graph { position: relative; min-width: 0; }
  svg { position: absolute; inset: 0; pointer-events: none; }
  path { fill: none; stroke-linecap: round; transition: opacity var(--fast) var(--ease), d var(--glide) var(--ease); }
  path.against { stroke: var(--ink3); stroke-dasharray: 3 3; }
  .tick { position: absolute; left: 0; width: 20px; color: var(--ink3); font: var(--type-meta); font-weight: 400; font-variant-numeric: tabular-nums; text-align: end; translate: 0 -50%; }
  .node {
    position: absolute;
    left: 0;
    top: 0;
    border-radius: var(--r-pill);
    transition: transform var(--glide) var(--ease), width var(--glide) var(--ease), height var(--glide) var(--ease), opacity var(--fast) var(--ease);
  }
  .node::after { content: ""; position: absolute; inset: -6px; }
  .focus { box-shadow: none; outline: 2px solid var(--ink); outline-offset: 2px; }
  .dim { opacity: 0.25; }
  @media (prefers-reduced-motion: reduce) { .node, path { transition: opacity var(--fast) var(--ease); } }
</style>

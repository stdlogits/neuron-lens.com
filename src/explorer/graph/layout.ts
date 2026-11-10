// Where a graph's nodes sit: depth down the page, a band per layer, and across it whatever crosses
// the fewest links (a few sweeps of the barycentre rule; the unit stays on the centre line). While the
// walk is still growing the graph, `was` holds where everything already is: each row keeps its order and
// a new node joins beside what it connects to, so only the finished graph is seated from scratch.
import type { Graph, GraphNode } from "./trace";

export interface Placed extends GraphNode { x: number; y: number; w: number; h: number }
export interface Layout { nodes: Placed[]; height: number }

const SWEEPS = 4;
export const GUTTER = 28;
const MIN_STEP = 12;
// How much further the unit at the centre, with its ring, reaches toward the next row than a row's own marks do.
const ROOM = 9;

// A layer is two rows: its heads, which write into its stream, then its neurons.
const rowOf = (n: GraphNode) => n.layer * 2 + (n.kind === "head" ? 0 : 1);

/** How far down the page a layer's rows sit: every row the same distance from the next, except that the unit at the centre opens its own by ROOM on each side, so what is next to it stands as clear as any row does. */
export function rows(graph: Graph, height: number, layers: number) {
  const focus = graph.nodes.find((n) => n.side === "focus");
  const opened = focus ? rowOf(focus) : Infinity;
  const pitch = (height - 2 * ROOM) / (2 * layers);
  const down = (row: number) => (row + 0.5) * pitch + (row < opened ? 0 : row === opened ? ROOM : 2 * ROOM);
  return { neurons: (layer: number) => down(layer * 2 + 1), heads: (layer: number) => down(layer * 2) };
}

export function layout(graph: Graph, width: number, height: number, layers: number, was?: Map<string, number>): Layout {
  const depth = rows(graph, height, layers);
  const left = GUTTER;
  const span = Math.max(40, width - left - 8);
  const centre = left + span / 2;
  const top = graph.nodes.reduce((max, n) => (n.side === "focus" ? max : Math.max(max, n.flow)), 1e-9);

  // Each row is seated on its own.
  const byLayer = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) byLayer.set(rowOf(n), [...(byLayer.get(rowOf(n)) ?? []), n]);

  const x = new Map<string, number>();
  const neighbours = new Map<string, string[]>();
  for (const e of graph.edges) {
    neighbours.set(e.from, [...(neighbours.get(e.from) ?? []), e.to]);
    neighbours.set(e.to, [...(neighbours.get(e.to) ?? []), e.from]);
  }

  const seat = (list: GraphNode[]) => {
    const step = Math.max(MIN_STEP, Math.min(44, span / Math.max(1, list.length)));
    const hasFocus = list.some((n) => n.side === "focus");
    list.forEach((n, i) => x.set(n.key, centre + (i - (list.length - 1) / 2) * step));
    if (hasFocus) {
      const shift = centre - x.get(list.find((n) => n.side === "focus")!.key)!;
      list.forEach((n) => x.set(n.key, x.get(n.key)! + shift));
    }
  };

  // Strongest in the middle, the rest to either side.
  for (const list of byLayer.values()) {
    list.sort((a, b) => b.flow - a.flow);
    const fan: GraphNode[] = [];
    list.forEach((n, i) => (i % 2 ? fan.push(n) : fan.unshift(n)));
    list.splice(0, list.length, ...fan);
    seat(list);
  }

  if (was) {
    for (const list of byLayer.values()) {
      const guess = new Map(list.map((n) => {
        const around = (neighbours.get(n.key) ?? []).map((key) => was.get(key)).filter((v): v is number => v !== undefined);
        return [n.key, was.get(n.key) ?? (around.length ? around.reduce((a, b) => a + b, 0) / around.length : centre)] as const;
      }));
      list.sort((a, b) => guess.get(a.key)! - guess.get(b.key)!);
      seat(list);
    }
  }

  const order = [...byLayer.keys()].sort((a, b) => a - b);
  for (let sweep = 0; sweep < (was ? 0 : SWEEPS); sweep += 1) {
    for (const layer of sweep % 2 ? [...order].reverse() : order) {
      const list = byLayer.get(layer)!;
      const barycentre = (n: GraphNode) => {
        const around = (neighbours.get(n.key) ?? []).map((key) => x.get(key)).filter((v): v is number => v !== undefined);
        return around.length ? around.reduce((a, b) => a + b, 0) / around.length : x.get(n.key)!;
      };
      const wanted = new Map(list.map((n) => [n.key, barycentre(n)]));
      list.sort((a, b) => wanted.get(a.key)! - wanted.get(b.key)!);
      seat(list);
    }
  }

  const placed = new Map<string, Placed>();
  for (const n of graph.nodes) {
    const weight = n.side === "focus" ? 1 : Math.sqrt(n.flow / top);
    // Neurons are dots, because there are so many of them; heads are oblong. The unit itself is the largest of its kind.
    const w = n.kind === "head" ? (n.side === "focus" ? 40 : 10 + 22 * weight) : n.side === "focus" ? 18 : 5 + 8 * weight;
    const h = n.kind === "head" ? (n.side === "focus" ? 12 : 6) : w;
    const y = n.kind === "head" ? depth.heads(n.layer) : depth.neurons(n.layer);
    placed.set(n.key,{ ...n, x: Math.min(left + span - w / 2, Math.max(left + w / 2, x.get(n.key)!)), y, w, h });
  }

  return { nodes: [...placed.values()], height };
}

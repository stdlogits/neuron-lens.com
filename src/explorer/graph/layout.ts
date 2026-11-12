// Where a graph's nodes sit: depth down the page, a band per layer, and across it whatever crosses
// the fewest links (a few sweeps of the barycentre rule; the unit stays on the centre line). While the
// walk is still growing the graph, `was` holds where everything already is: each row keeps its order and
// a new node joins beside what it connects to, so only the finished graph is seated from scratch. The
// rail spreads each row across its width; the navigator (`open`) seats each node as far from the next as
// its mark or the title under it needs, at its own size, with the unit at x = 0.
import type { Graph, GraphNode } from "./trace";

export interface Placed extends GraphNode { x: number; y: number; w: number; h: number }
export interface Layout {
  nodes: Placed[];
  height: number;
  /** How far the marks and their titles reach, left and right. */
  bounds: [number, number];
}
/** Where a title sits beside its mark. */
export type Spot = "below" | "above" | "right" | "left";
/** The navigator's spacing: how far across from its centre a node needs, its mark or its title, whichever is wider; and the room between two. */
export interface Open { reach: (node: GraphNode, w: number) => number; gap: number }

const SWEEPS = 4;
export const GUTTER = 28;
const MIN_STEP = 12;
// How much further the unit at the centre, with its ring, reaches toward the next row than a row's own marks do.
const ROOM = 9;

// A layer is two rows: its heads, which write into its stream, then its neurons.
const rowOf = (n: GraphNode) => n.layer * 2 + (n.kind === "head" ? 0 : 1);

/** How far down the page a layer's rows sit: every row the same distance from the next, except that the unit at the centre opens its own by ROOM on each side, so what is next to it stands as clear as any row does. */
export function rows(graph: Graph, height: number, layers: number, crop?: Crop) {
  const focus = graph.nodes.find((n) => n.side === "focus");
  const opened = focus ? rowOf(focus) : Infinity;
  const pitch = (height - 2 * ROOM) / (2 * layers);
  const down = (row: number) => (row + 0.5) * pitch + (row < opened ? 0 : row === opened ? ROOM : 2 * ROOM);
  // A crop shows only its rows: the first sits `pad` below the top.
  const shift = crop ? down(crop.first) - crop.pad : 0;
  return { neurons: (layer: number) => down(layer * 2 + 1) - shift, heads: (layer: number) => down(layer * 2) - shift, row: (row: number) => down(row) - shift };
}

/** The rows the rail shows: from the graph's first row to its last, `pad` clear above and below. */
export interface Crop { first: number; last: number; pad: number }
/** The first and last rows a graph's nodes sit in, or null for none. */
export function spanOf(graph: Graph): [number, number] | null {
  if (!graph.nodes.length) return null;
  let first = Infinity;
  let last = -Infinity;
  for (const n of graph.nodes) { first = Math.min(first, rowOf(n)); last = Math.max(last, rowOf(n)); }
  return [first, last];
}

/** A node's mark: neurons are dots, because there are so many of them; heads are oblong. The unit itself is the largest of its kind. */
function mark(n: GraphNode, top: number) {
  const weight = n.side === "focus" ? 1 : Math.sqrt(n.flow / top);
  const w = n.kind === "head" ? (n.side === "focus" ? 40 : 10 + 22 * weight) : n.side === "focus" ? 18 : 5 + 8 * weight;
  const h = n.kind === "head" ? (n.side === "focus" ? 12 : 6) : w;
  return { w, h };
}

export function layout(graph: Graph, width: number, height: number, layers: number, was?: Map<string, number>, open?: Open, crop?: Crop): Layout {
  const depth = rows(graph, height, layers, crop);
  const left = GUTTER;
  const span = Math.max(40, width - left - 8);
  const centre = open ? 0 : left + span / 2;
  const top = graph.nodes.reduce((max, n) => (n.side === "focus" ? max : Math.max(max, n.flow)), 1e-9);
  const marks = new Map(graph.nodes.map((n) => [n.key, mark(n, top)]));
  const half = (n: GraphNode) => { const { w } = marks.get(n.key)!; return open ? Math.max(w / 2, open.reach(n, w)) : w / 2; };

  // Each row is seated on its own.
  const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => { const list = map.get(key); if (list) list.push(value); else map.set(key, [value]); };
  const byLayer = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) push(byLayer, rowOf(n), n);

  const x = new Map<string, number>();
  const neighbours = new Map<string, string[]>();
  for (const e of graph.edges) {
    push(neighbours, e.from, e.to);
    push(neighbours, e.to, e.from);
  }

  const seat = (list: GraphNode[]) => {
    const step = Math.max(MIN_STEP, Math.min(44, span / Math.max(1, list.length)));
    const hasFocus = list.some((n) => n.side === "focus");
    if (open) {
      // Each as far from the last as the two need, the row centred on the unit's line.
      let at = 0;
      const across = list.map((n, i) => (i === 0 ? 0 : (at += half(list[i - 1]) + half(n) + open.gap)));
      list.forEach((n, i) => x.set(n.key, centre + across[i] - at / 2));
    } else list.forEach((n, i) => x.set(n.key, centre + (i - (list.length - 1) / 2) * step));
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
  let bounds: [number, number] = [Infinity, -Infinity];
  for (const n of graph.nodes) {
    const { w, h } = marks.get(n.key)!;
    const y = n.kind === "head" ? depth.heads(n.layer) : depth.neurons(n.layer);
    const across = open ? x.get(n.key)! : Math.min(left + span - w / 2, Math.max(left + w / 2, x.get(n.key)!));
    bounds = [Math.min(bounds[0], across - half(n)), Math.max(bounds[1], across + half(n))];
    placed.set(n.key, { ...n, x: across, y, w, h });
  }

  return { nodes: [...placed.values()], height, bounds };
}

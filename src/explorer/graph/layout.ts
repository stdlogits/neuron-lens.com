// Where a graph's nodes sit: depth down the page, a band per layer, and across it whatever crosses
// the fewest links (a few sweeps of the barycentre rule; the unit stays on the centre line).
import type { Graph, GraphNode } from "./trace";

export interface Placed extends GraphNode { x: number; y: number; w: number; h: number }
export interface Layout { nodes: Placed[]; paths: Map<string, string>; height: number }

const SWEEPS = 4;
export const GUTTER = 28;
const MIN_STEP = 12;

export function layout(graph: Graph, width: number, height: number, layers: number): Layout {
  const band = height / layers;
  const left = GUTTER;
  const span = Math.max(40, width - left - 8);
  const centre = left + span / 2;
  const top = graph.nodes.reduce((max, n) => (n.side === "focus" ? max : Math.max(max, n.flow)), 1e-9);

  const byLayer = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) byLayer.set(n.layer, [...(byLayer.get(n.layer) ?? []), n]);

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

  const order = [...byLayer.keys()].sort((a, b) => a - b);
  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
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
    const w = n.side === "focus" ? 40 : n.kind === "head" ? 6 + 6 * weight : 6 + 26 * weight;
    const h = n.side === "focus" ? 12 : n.kind === "head" ? w : 6;
    // A head writes into its own layer's stream, so it sits just above that layer's neurons.
    const y = (n.layer + (n.kind === "head" && n.side !== "focus" ? 0.2 : 0.62)) * band;
    placed.set(n.key, { ...n, x: Math.min(left + span - w / 2, Math.max(left + w / 2, x.get(n.key)!)), y, w, h });
  }

  const paths = new Map<string, string>();
  for (const e of graph.edges) {
    const a = placed.get(e.from);
    const b = placed.get(e.to);
    if (!a || !b) continue;
    const y1 = a.y + a.h / 2;
    const y2 = b.y - b.h / 2;
    const bend = Math.max(10, (y2 - y1) * 0.5);
    paths.set(e.key, `M${a.x.toFixed(1)} ${y1.toFixed(1)}C${a.x.toFixed(1)} ${(y1 + bend).toFixed(1)} ${b.x.toFixed(1)} ${(y2 - bend).toFixed(1)} ${b.x.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return { nodes: [...placed.values()], paths, height };
}

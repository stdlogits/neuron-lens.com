// Where a graph's nodes sit: depth down the page, a row for each layer's heads and another for its
// neurons, and across it near what they connect to. Every node first hangs from the neighbour nearer
// the unit that carries the most of its flow (`families`), and the branches pack side by side, each
// node straight over the strongest of what hangs from it. From there a few sweeps reorder each row by
// where its nodes' links go, weighted by flow, and seat each node as near that as its row's order and
// spacing allow, so what is strongly linked stands together and few heavy links cross. The unit stays
// on the centre line, and everything is drawn a little toward it. While the walk is still growing the graph, `was` holds where everything already
// is: each row keeps its order and only settles, and the finished graph is seated afresh.
import type { Graph, GraphNode } from "./trace";

export interface Placed extends GraphNode { x: number; y: number; w: number; h: number }
export interface Layout {
  nodes: Placed[];
  height: number;
  width: number;
  /** How far the marks and their labels reach, left and right. */
  bounds: [number, number];
}
/** What a node hangs from, and how many links that is from the unit. */
export interface Family { parent: string | null; depth: number }

/** How a graph is set out: in the rail, spread to fill a width; in the navigator, at a fixed scale with room for labels. */
export interface Setting {
  /** The least room between two marks side by side in a row. */
  gap?: number;
  /** How far a node reaches to either side of its centre, beyond its mark: its label, in the navigator. */
  reach?: (node: GraphNode, w: number) => [number, number];
  /** Spread or squeeze the graph to fill the width, about its centre (the rail), or leave it at its own size with the unit at x = 0 (the navigator). */
  fit?: boolean;
}

export const GUTTER = 28;
// How much further the unit at the centre, with its ring, reaches toward the next row than a row's own marks do.
const ROOM = 9;
/** Two branches that share no row still stand this far apart. */
const APART = 12;
/** How far a graph with room to spare may spread out across the width. */
const SPREAD = 2;
/** How many times the branches are reordered toward where their links go. */
const BRANCH_SWEEPS = 3;
/** How many times each row is reordered and reseated by where its links go. */
const SWEEPS = 8;
/** How strongly every node is drawn to the centre line, against where its links pull it. */
const GRAVITY = 0.2;

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

/** Each node's parent: of its links toward the unit, the one carrying the most flow. Links run from what the model computes earlier to what it computes later, so following parents always reaches the unit. */
export function families(graph: Graph): Map<string, Family> {
  const out = new Map<string, Family>();
  const focus = graph.nodes.find((n) => n.side === "focus");
  if (!focus) return out;
  const side = new Map(graph.nodes.map((n) => [n.key, n.side]));
  const best = new Map<string, { parent: string; flow: number }>();
  for (const e of graph.edges) {
    const from = side.get(e.from);
    const to = side.get(e.to);
    // What feeds the unit hangs from what it feeds; what the unit feeds hangs from what feeds it.
    const [child, parent] = from === "up" && (to === "up" || to === "focus") ? [e.from, e.to]
      : to === "down" && (from === "down" || from === "focus") ? [e.to, e.from] : [null, null];
    if (!child || !parent) continue;
    const held = best.get(child);
    if (!held || e.flow > held.flow) best.set(child, { parent, flow: e.flow });
  }
  out.set(focus.key, { parent: null, depth: 0 });
  const depth = (key: string): number => {
    const known = out.get(key);
    if (known) return known.depth;
    const parent = best.get(key)?.parent ?? focus.key;
    const family = { parent, depth: depth(parent) + 1 };
    out.set(key, family);
    return family.depth;
  };
  for (const n of graph.nodes) depth(n.key);
  return out;
}

/** A node's mark: neurons are dots, because there are so many of them; heads are oblong. The unit itself is the largest of its kind. */
function mark(n: GraphNode, top: number) {
  const weight = n.side === "focus" ? 1 : Math.sqrt(n.flow / top);
  const w = n.kind === "head" ? (n.side === "focus" ? 40 : 10 + 22 * weight) : n.side === "focus" ? 18 : 5 + 8 * weight;
  const h = n.kind === "head" ? (n.side === "focus" ? 12 : 6) : w;
  return { w, h };
}

/** Strongest in the middle, the rest to either side. */
function fan(list: GraphNode[]) {
  const sorted = [...list].sort((a, b) => b.flow - a.flow);
  const out: GraphNode[] = [];
  sorted.forEach((n, i) => (i % 2 ? out.push(n) : out.unshift(n)));
  return out;
}

type Outline = Map<number, [number, number]>;

export function layout(graph: Graph, width: number, height: number, layers: number, was?: Map<string, number>, setting: Setting = {}): Layout {
  const { gap = 8, reach, fit = true } = setting;
  const depth = rows(graph, height, layers);
  const left = GUTTER;
  const span = Math.max(40, width - left - 8);
  const centre = fit ? left + span / 2 : 0;
  const focus = graph.nodes.find((n) => n.side === "focus");
  if (!focus) return { nodes: [], height, width, bounds: [0, 0] };
  const top = graph.nodes.reduce((max, n) => (n.side === "focus" ? max : Math.max(max, n.flow)), 1e-9);

  const marks = new Map(graph.nodes.map((n) => [n.key, mark(n, top)]));
  const extent = (n: GraphNode): [number, number] => {
    const { w } = marks.get(n.key)!;
    const [l, r] = reach ? reach(n, w) : [0, 0];
    return [-(w / 2 + l), w / 2 + r];
  };

  const family = families(graph);
  const kids = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) {
    const parent = family.get(n.key)?.parent;
    if (parent) kids.set(parent, [...(kids.get(parent) ?? []), n]);
  }
  // The order a node's branches stand in: strongest in the middle at first, then, a few times over,
  // each branch toward where the links leaving it go.
  let pull: Map<string, number> | null = null;
  const arrange = (list: GraphNode[]) => (pull ? [...list].sort((a, b) => pull!.get(a.key)! - pull!.get(b.key)!) : fan(list));

  // Each branch's outline: how far it reaches to either side of its root, row by row.
  const offset = new Map<string, number>();
  const pack = (children: GraphNode[], own: Outline) => {
    if (!children.length) return;
    const outlines = children.map(outline);
    const at: number[] = [];
    const held: Outline = new Map();
    children.forEach((_, i) => {
      let x = i === 0 ? 0 : at[i - 1] + APART;
      for (const [row, [lo]] of outlines[i]) {
        const there = held.get(row);
        if (there) x = Math.max(x, there[1] + gap - lo);
      }
      at.push(x);
      for (const [row, [lo, hi]] of outlines[i]) {
        const there = held.get(row);
        held.set(row, there ? [Math.min(there[0], x + lo), Math.max(there[1], x + hi)] : [x + lo, x + hi]);
      }
    });
    // The node stands over its strongest branch.
    const strongest = children.reduce((best, n, i) => (n.flow > children[best].flow ? i : best), 0);
    const anchor = at[strongest];
    children.forEach((n, i) => offset.set(n.key, at[i] - anchor));
    for (const [row, [lo, hi]] of held) {
      const there = own.get(row);
      own.set(row, there ? [Math.min(there[0], lo - anchor), Math.max(there[1], hi - anchor)] : [lo - anchor, hi - anchor]);
    }
  };
  function outline(n: GraphNode): Outline {
    const own: Outline = new Map([[rowOf(n), extent(n)]]);
    pack(arrange(kids.get(n.key) ?? []), own);
    return own;
  }
  // The unit's two sides are packed apart, each centred under or over it.
  const around = kids.get(focus.key) ?? [];
  const x = new Map<string, number>();
  const place = (n: GraphNode) => {
    for (const child of kids.get(n.key) ?? []) {
      x.set(child.key, x.get(n.key)! + (offset.get(child.key) ?? 0));
      place(child);
    }
  };
  const seat = () => {
    const whole: Outline = new Map([[rowOf(focus), extent(focus)]]);
    for (const side of ["up", "down"] as const) pack(arrange(around.filter((n) => n.side === side)), whole);
    x.set(focus.key, 0);
    place(focus);
  };

  // Which branch each node is in: a run of the walk down the families, so a branch is an interval.
  const enter = new Map<string, number>();
  const leave = new Map<string, number>();
  let clock = 0;
  const walk = (n: GraphNode) => {
    enter.set(n.key, clock++);
    for (const child of kids.get(n.key) ?? []) walk(child);
    leave.set(n.key, clock - 1);
  };
  walk(focus);
  const within = (key: string, root: string) => enter.get(key)! >= enter.get(root)! && enter.get(key)! <= leave.get(root)!;

  if (!was) seat();
  for (let sweep = 0; sweep < (was ? 0 : BRANCH_SWEEPS); sweep += 1) {
    // Each branch is drawn toward the flow-weighted middle of what its links leave it for.
    const next = new Map<string, number>();
    for (const n of graph.nodes) {
      if (n === focus) continue;
      let sum = 0;
      let weight = 0;
      for (const e of graph.edges) {
        const a = within(e.from, n.key);
        if (a === within(e.to, n.key)) continue;
        const out = x.get(a ? e.to : e.from);
        if (out === undefined) continue;
        sum += e.flow * out;
        weight += e.flow;
      }
      next.set(n.key, weight > 0 ? sum / weight : x.get(n.key)!);
    }
    pull = next;
    seat();
  }

  // Then row by row: each node toward the flow-weighted middle of everything it links to.
  const byRow = new Map<number, GraphNode[]>();
  for (const n of graph.nodes) byRow.set(rowOf(n), [...(byRow.get(rowOf(n)) ?? []), n]);
  const links = new Map<string, { key: string; weight: number }[]>();
  for (const e of graph.edges) {
    const weight = Math.sqrt(Math.max(e.flow, 1e-6));
    links.set(e.from, [...(links.get(e.from) ?? []), { key: e.to, weight }]);
    links.set(e.to, [...(links.get(e.to) ?? []), { key: e.from, weight }]);
  }
  // Where a node's links pull it, and where it is seated: a little nearer the centre line, so a
  // closely knit cluster doesn't drift off to one side.
  const middle = (n: GraphNode) => (n === focus ? 0 : (1 - GRAVITY) * linked(n));
  const linked = (n: GraphNode) => {
    let sum = 0;
    let weight = 0;
    for (const link of links.get(n.key) ?? []) {
      const at = x.get(link.key);
      if (at !== undefined) { sum += link.weight * at; weight += link.weight; }
    }
    return weight > 0 ? sum / weight : x.get(n.key) ?? 0;
  };
  if (was) {
    // Still growing: what is there stays where it is, and what is new starts beside what it links to.
    for (const n of graph.nodes) { const at = was.get(n.key); if (at !== undefined) x.set(n.key, at - centre); }
    x.set(focus.key, 0);
    for (const n of graph.nodes) if (!x.has(n.key)) x.set(n.key, middle(n));
  }
  const settleRow = (list: GraphNode[]) => {
    const pinned = list.indexOf(focus);
    const targets = list.map(middle);
    const weights = list.map((n) => (links.get(n.key) ?? []).reduce((sum, link) => sum + link.weight, 0) || 1e-3);
    const apart = list.slice(1).map((n, i) => extent(list[i])[1] - extent(n)[0] + gap);
    settle(targets, weights, apart, pinned).forEach((at, i) => x.set(list[i].key, at));
  };
  const order = [...byRow.keys()].sort((a, b) => a - b);
  for (const list of byRow.values()) list.sort((a, b) => x.get(a.key)! - x.get(b.key)!);
  for (let sweep = 0; sweep < (was ? 2 : SWEEPS); sweep += 1) {
    for (const row of sweep % 2 ? [...order].reverse() : order) {
      const list = byRow.get(row)!;
      if (!was) {
        const wanted = new Map(list.map((n) => [n.key, n === focus ? 0 : linked(n)]));
        list.sort((a, b) => wanted.get(a.key)! - wanted.get(b.key)!);
      }
      settleRow(list);
    }
  }

  // Fill the width: squeeze a graph too wide for it, and spread one with room to spare, about the unit.
  let lo = 0;
  let hi = 0;
  for (const n of graph.nodes) {
    const [l, r] = extent(n);
    lo = Math.min(lo, x.get(n.key)! + l);
    hi = Math.max(hi, x.get(n.key)! + r);
  }
  const half = Math.max(1, -lo, hi);
  const scale = fit ? Math.min(SPREAD, (span / 2 - 4) / half) : 1;

  const placed: Placed[] = graph.nodes.map((n) => {
    const { w, h } = marks.get(n.key)!;
    const y = n.kind === "head" ? depth.heads(n.layer) : depth.neurons(n.layer);
    const across = centre + x.get(n.key)! * scale;
    return { ...n, x: fit ? Math.min(left + span - w / 2, Math.max(left + w / 2, across)) : across, y, w, h };
  });
  return { nodes: placed, height, width, bounds: [centre + lo * scale, centre + hi * scale] };
}

/** A row's places, in its order and each at least `apart` from the last, as near their targets as the weights ask: a weighted isotonic fit on each target less the running spacing. A pinned node does not move. */
function settle(targets: number[], weights: number[], apart: number[], pinned: number) {
  const shift = [0];
  for (let i = 1; i < targets.length; i += 1) shift.push(shift[i - 1] + apart[i - 1]);
  const blocks: { at: number; weight: number; size: number }[] = [];
  targets.forEach((target, i) => {
    blocks.push({ at: target - shift[i], weight: i === pinned ? 1e9 : weights[i], size: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].at > blocks[blocks.length - 1].at) {
      const b = blocks.pop()!;
      const a = blocks.pop()!;
      blocks.push({ at: (a.at * a.weight + b.at * b.weight) / (a.weight + b.weight), weight: a.weight + b.weight, size: a.size + b.size });
    }
  });
  const out: number[] = [];
  for (const block of blocks) for (let k = 0; k < block.size; k += 1) out.push(block.at + shift[out.length]);
  return out;
}

// A unit's directed graph: what feeds it and what it feeds, followed along its connections for as far
// as they stay strong. The connections only run from what the model computes earlier to what it computes
// later, so walking in that order from the unit outward settles each one's flow (the sum over every path
// of the product of its links) before it is followed. What a link is worth, and how far the walk reaches,
// come from the mode and the reach.
import { headKey, headOf, loadHeadWire, loadPoleWire, poleId, poleOf, type Link, type Relation, type Through, type Wire } from "../../lib/data";
import type { ModelInfo } from "../../lib/models";

/** On a neuron, `context`, `weights` or `with`; on a head, `context` is its value, beside its `query`, its `key` and `with`. */
export type Mode = "context" | "weights" | "with" | "query" | "key";
export type Side = "up" | "down";
export type Reach = "near" | "far" | "all";

export interface GraphNode {
  key: string;
  kind: "neuron" | "head";
  id: number;
  layer: number;
  index: number;
  pole: 1 | -1 | 0;
  side: Side | "focus";
  /** How much of the unit reaches it, 0–1. */
  flow: number;
  /** How much of that goes on through it: what reaches a head through its query or key sets where it looks, not what it writes. */
  onward: number;
  wire?: Wire;
}
export interface GraphEdge {
  key: string;
  /** Upstream end first, whichever side of the unit it is on. */
  from: string;
  to: string;
  /** The link as stored: a signed push or share. */
  value: number;
  flow: number;
}
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[]; settled: boolean }

const REACH: Record<Reach, { floor: number; expand: number; show: number }> = {
  near: { floor: 0.01, expand: 48, show: 28 },
  far: { floor: 0.003, expand: 140, show: 64 },
  all: { floor: 0.0008, expand: 360, show: 140 },
};

const FOLLOW: Record<"context" | "weights", Record<Side, Relation[]>> = {
  context: { up: ["driven", "heads"], down: ["drives", "drivesHeads"] },
  weights: { up: ["in"], down: ["out"] },
};

/** Its place in the order the model computes things: a layer's attention, then its MLP. */
const place = (n: { layer: number; kind: "neuron" | "head" }) => n.layer * 2 + (n.kind === "neuron" ? 1 : 0);

/** A head's inputs in words, for a tip: a share of `what it writes`, or of `where it looks`. */
export const headInput = (who: string, through: Through) => (through === 0 ? `what ${who} writes` : `where ${who} looks through its ${through === 1 ? "query" : "key"}`);

export const nodeKey = (kind: "neuron" | "head", id: number) => `${kind[0]}${id}`;

interface Walk { model: ModelInfo; flows: Map<string, GraphNode>; edges: Map<string, GraphEdge>; update: () => void; live: () => boolean }

function node(walk: Walk, kind: "neuron" | "head", id: number, side: Side): GraphNode {
  const key = nodeKey(kind, id);
  let found = walk.flows.get(key);
  if (!found) {
    if (kind === "head") {
      const { layer, head } = headOf(walk.model.heads, id);
      found = { key, kind, id, layer, index: head, pole: 0, side, flow: 0, onward: 0 };
    } else {
      const { layer, neuron, pole } = poleOf(walk.model.mlp, id);
      found = { key, kind, id, layer, index: neuron, pole, side, flow: 0, onward: 0 };
    }
    walk.flows.set(key, found);
  }
  return found;
}

const wireOf = (walk: Walk, target: GraphNode) => (target.kind === "head" ? loadHeadWire(walk.model.id, target.id) : loadPoleWire(walk.model.id, target.id));

/** Every link followed from a node, as its kind and the link. The unit's own query or key stands in for its value upstream. */
function follow(wire: Wire, relations: Relation[], input?: "query" | "key"): { kind: "neuron" | "head"; link: Link }[] {
  return relations.flatMap((relation) => {
    const list = input && (relation === "driven" || relation === "heads") ? wire[input]![relation] : wire.links[relation];
    return list.map((link) => ({ kind: relation === "heads" || relation === "drivesHeads" ? ("head" as const) : ("neuron" as const), link }));
  });
}

async function walkSide(walk: Walk, focus: GraphNode, side: Side, mode: Exclude<Mode, "with">, reach: Reach) {
  const { floor, expand } = REACH[reach];
  const relations = FOLLOW[mode === "weights" ? "weights" : "context"][side];
  const share = mode !== "weights";
  const input = mode === "query" || mode === "key" ? mode : undefined;
  let budget = expand;
  const start = place(focus);
  const stops = side === "up" ? [...Array(start + 1).keys()].reverse() : [...Array(walk.model.layers * 2 - start).keys()].map((i) => i + start);
  const done = new Set<string>([focus.key]);

  // Follow a node's links, adding what goes on through it to each one's flow. Only a head's value is in the same
  // currency as an activation, so a path up through a head goes by its value, and a path down into a head's query or key ends there.
  const spread = (n: GraphNode, wire: Wire) => {
    n.wire = wire;
    const links = follow(wire, relations, n === focus ? input : undefined);
    // Shares are the fraction of a unit's activation already; a push is only ranked within its pole.
    const total = share ? 1 : links.reduce((sum, { link }) => sum + Math.abs(link[1]), 0) || 1;
    for (const { kind, link: [id, value, through] } of links) {
      const other = node(walk, kind, id, side);
      if (other === n) continue;
      const flow = n.onward * Math.min(1, Math.abs(value) / total);
      other.flow += flow;
      if (!through) other.onward += flow;
      const [from, to] = side === "up" ? [other.key, n.key] : [n.key, other.key];
      const key = `${from}>${to}`;
      const held = walk.edges.get(key);
      // One pair can meet through several of a head's inputs: the strongest speaks for them.
      if (!held || Math.abs(value) > Math.abs(held.value)) walk.edges.set(key, { key, from, to, value, flow: Math.max(flow, held?.flow ?? 0) });
    }
  };

  spread(focus, focus.wire!);
  walk.update();
  for (const stop of stops) {
    if (!walk.live() || budget <= 0) return;
    const ready = [...walk.flows.values()]
      .filter((n) => place(n) === stop && n.side === side && !done.has(n.key) && n.onward >= floor)
      .sort((a, b) => b.onward - a.onward)
      .slice(0, budget);
    if (!ready.length) continue;
    budget -= ready.length;
    const wires = await Promise.all(ready.map(async (n) => {
      try { return await wireOf(walk, n); } catch { return null; }
    }));
    if (!walk.live()) return;
    ready.forEach((n, i) => {
      done.add(n.key);
      if (wires[i]) spread(n, wires[i]);
    });
    walk.update();
  }
}

/** The node of a unit in a model: a neuron's pole, or a head. */
export function focusOf(model: ModelInfo, unit: "neurons" | "heads", layer: number, index: number, pole: number): GraphNode {
  if (unit === "heads") {
    const id = headKey(model.heads, layer, index);
    return { key: nodeKey("head", id), kind: "head", id, layer, index, pole: 0, side: "focus", flow: 1, onward: 1 };
  }
  const id = poleId(model.mlp, layer, index, pole);
  return { key: nodeKey("neuron", id), kind: "neuron", id, layer, index, pole: pole < 0 ? -1 : 1, side: "focus", flow: 1, onward: 1 };
}

/** Walk the graph around a unit, calling back as it grows. Stop by making `live` false. */
export async function trace(model: ModelInfo, start: GraphNode, mode: Mode, reach: Reach, publish: (graph: Graph) => void, live: () => boolean) {
  const focus = { ...start, flow: 1, onward: 1 };
  const walk: Walk = { model, flows: new Map([[focus.key, focus]]), edges: new Map(), live, update: () => publish(view(walk, focus, reach, false)) };
  const wire = await wireOf(walk, focus).catch(() => null);
  if (!live() || !wire) return;
  focus.wire = wire;
  if (mode === "with") {
    for (const [id, value] of wire.links.with) {
      const other = node(walk, "neuron", id, "up");
      other.flow = value;
      walk.edges.set(`${other.key}>${focus.key}`, { key: `${other.key}>${focus.key}`, from: other.key, to: focus.key, value, flow: value });
    }
  } else {
    await Promise.all((["up", "down"] as Side[]).map((side) => walkSide(walk, focus, side, mode, reach)));
  }
  if (!live()) return;
  // Everything shown gets its title, strongest first.
  const shown = view(walk, focus, reach, false).nodes.map((n) => walk.flows.get(n.key)!).filter((n) => !n.wire);
  await Promise.all(shown.map(async (n) => { try { n.wire = await wireOf(walk, n); } catch { /* its id still shows */ } }));
  if (live()) publish(view(walk, focus, reach, true));
}

/** The strongest nodes on each side, and the links among them. */
function view(walk: Walk, focus: GraphNode, reach: Reach, settled: boolean): Graph {
  const { show } = REACH[reach];
  const chosen = new Set([focus.key]);
  for (const side of ["up", "down"] as Side[]) {
    const ranked = [...walk.flows.values()].filter((n) => n.side === side && n.flow > 0).sort((a, b) => b.flow - a.flow).slice(0, show);
    for (const n of ranked) chosen.add(n.key);
  }
  return {
    nodes: [...walk.flows.values()].filter((n) => chosen.has(n.key)).map((n) => ({ ...n })),
    edges: [...walk.edges.values()].filter((e) => chosen.has(e.from) && chosen.has(e.to)),
    settled,
  };
}

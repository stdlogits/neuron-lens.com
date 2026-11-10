// How the graph moves, all on one clock, so a link can never part from its nodes.
//
// Arriving is a few overlapping beats. The unit swells into place. What it connects to buds out of it a
// ring at a time, strongest first, each link growing with the node at its end. The links that make it
// a graph rather than a tree draw themselves in behind them. The finished graph untangles. Then one
// pulse runs down through the layers: into the unit, and on out of it. Data sets the pace when it is
// slow; when it is quick, the rings still open one after another.
//
// Every value is a target plus offsets that shrink away on Ledger's curve. A new target only adds an
// offset, so a walk that keeps growing, a click on a neighbour or a change of view takes over from
// wherever things are, without a hitch. Nothing waits for any of it: every node is a link from the start.
import { FAST, GLIDE, IN, OUT, ease, reducedMotion } from "@stdlogits/ledger";
import type { Layout, Placed } from "./layout";
import type { Graph, GraphEdge } from "./trace";

export interface Seated extends Placed {
  /** Links from the unit, by the shortest way. */
  hop: number;
}
export interface Shown { nodes: Seated[]; edges: GraphEdge[] }

const HOP = 48;
/** However deep the graph, its rings open within this long. */
const CASCADE = 340;
const SIBLING = 8;
const MOST_SIBLINGS = 10;
const FLIGHT = IN;
const WEAVE = 180;
/** Each of the pulse's two beats: down to the unit, then on from it. */
const BEAT = 280;
/** How near the pulse (px) a node starts to swell. */
const BUMP = 30;
const SPARKS = 48;
const SPARK_LENGTH = 26;
/** How long (ms) to wait for a frame before drawing without one. */
const STARVED = 250;

/** A value that glides to each new target, adding to whatever motion is already under way. */
class Tween {
  private offsets: { by: number; start: number; span: number }[] = [];
  constructor(public target: number) {}
  get live() { return this.offsets.length > 0; }
  /** Glide to a value, from `start`, over `span` ms. */
  go(value: number, start: number, span: number) {
    const by = this.target - value;
    this.target = value;
    if (span > 0 && by !== 0) this.offsets.push({ by, start, span });
  }
  /** Begin `by` away from the target. */
  from(by: number, start: number, span: number) {
    if (span > 0 && by !== 0) this.offsets.push({ by, start, span });
  }
  jump(value: number) {
    this.target = value;
    this.offsets.length = 0;
  }
  /** Glide from wherever it is now, dropping anything still due to start later. */
  leave(value: number, now: number, span: number) {
    this.jump(this.at(now));
    this.go(value, now, span);
  }
  at(now: number) {
    let value = this.target;
    let kept = 0;
    for (const offset of this.offsets) {
      const t = (now - offset.start) / offset.span;
      if (t >= 1) continue;
      value += offset.by * (t <= 0 ? 1 : 1 - ease(t));
      this.offsets[kept++] = offset;
    }
    this.offsets.length = kept;
    return value;
  }
}

interface Seat {
  node: Seated;
  x: Tween; y: Tween; w: Tween; h: Tween; shown: Tween;
  /** When it starts to appear. */
  born: number;
  /** The neighbour nearer the unit: what it buds from and returns to. */
  parent: string | null;
  leaving: boolean;
  el: HTMLElement | null;
  /** This frame's place. */
  ax: number; ay: number; aw: number; ah: number;
  painted: { transform: string; width: string; height: string; opacity: string };
}

interface Strand {
  edge: GraphEdge;
  shown: Tween;
  /** How much of it is drawn, 0–1, upstream end first. */
  drawn: Tween;
  leaving: boolean;
  el: SVGPathElement | null;
  y1: number; y2: number;
  painted: { d: string; opacity: string; dash: string };
}

interface Spark { strand: Strand; el: SVGPathElement; dash: number; painted: string }
interface Sweep { start: number; top: number; focus: number; bottom: number; sparks: Spark[] | null }

/** Each node's way back to the unit: its nearest neighbour, the strongest of them if several are as near. */
function spanning(graph: Graph, focus: string | null) {
  const links = new Map<string, { other: string; flow: number }[]>();
  const add = (a: string, b: string, flow: number) => links.set(a, [...(links.get(a) ?? []), { other: b, flow }]);
  for (const edge of graph.edges) {
    add(edge.from, edge.to, edge.flow);
    add(edge.to, edge.from, edge.flow);
  }
  const found = new Map<string, { hop: number; parent: string | null; flow: number }>();
  if (focus === null) return found;
  found.set(focus, { hop: 0, parent: null, flow: Infinity });
  let ring = [focus];
  for (let hop = 1; ring.length; hop += 1) {
    const next = new Set<string>();
    for (const key of ring) {
      for (const { other, flow } of links.get(key) ?? []) {
        const held = found.get(other);
        if (held && held.hop < hop) continue;
        if (!held || flow > held.flow) found.set(other, { hop, parent: key, flow });
        next.add(other);
      }
    }
    ring = [...next];
  }
  return found;
}

const unit = (value: number) => Math.max(0, Math.min(1, value));

export class Stage {
  private seats = new Map<string, Seat>();
  private strands = new Map<string, Strand>();
  private frame = 0;
  private fallback = 0;
  /** When the last bud lands, and the last link finishes drawing. */
  private landing = 0;
  private woven = 0;
  private grew = false;
  private sweep: Sweep | null = null;

  /** `changed`: what is shown has lost something that finished leaving. `layer`: where the pulse is drawn. */
  constructor(private changed: () => void, private layer: () => SVGGElement | undefined) {}

  shown(): Shown {
    return { nodes: [...this.seats.values()].map((seat) => seat.node), edges: [...this.strands.values()].map((strand) => strand.edge) };
  }

  /** Where each node is going, for a graph still growing to keep its order. */
  targets() {
    const places = new Map<string, number>();
    for (const seat of this.seats.values()) if (!seat.leaving) places.set(seat.node.key, seat.x.target);
    return places;
  }

  /** Take a new graph: what stays glides, what is new arrives, what is gone leaves. `snap` jumps there (a resize). */
  update(graph: Graph, placed: Layout, snap: boolean): Shown {
    const now = performance.now();
    const calm = reducedMotion();
    const instant = snap || (typeof document !== "undefined" && document.hidden);
    this.endSweep();

    const focus = graph.nodes.find((n) => n.side === "focus")?.key ?? null;
    const tree = spanning(graph, focus);
    const want = new Map(placed.nodes.map((node) => [node.key, node]));
    const seated = (node: Placed): Seated => ({ ...node, hop: tree.get(node.key)?.hop ?? 1 });

    // Gone first: each withdraws into what it budded from.
    let leaves = false;
    for (const seat of [...this.seats.values()]) {
      if (want.has(seat.node.key) || seat.leaving) continue;
      if (instant) { this.seats.delete(seat.node.key); leaves = true; continue; }
      leaves = true;
      seat.leaving = true;
      const home = seat.parent ? want.get(seat.parent) : undefined;
      if (home && !calm) { seat.x.go(home.x, now, OUT); seat.y.go(home.y, now, OUT); }
      if (!calm) { seat.w.go(seat.w.target * 0.4, now, OUT); seat.h.go(seat.h.target * 0.4, now, OUT); }
      seat.shown.leave(0, now, calm ? FAST : OUT);
    }

    // What stays moves. A finished graph waits for the rings to land before it untangles.
    const moveAt = graph.settled ? Math.max(now, this.landing - FLIGHT * 0.4) : now;
    const fresh: Placed[] = [];
    for (const node of placed.nodes) {
      const seat = this.seats.get(node.key);
      if (!seat) { fresh.push(node); continue; }
      seat.node = seated(node);
      seat.parent = tree.get(node.key)?.parent ?? seat.parent;
      if (seat.leaving) { seat.leaving = false; seat.shown.go(1, now, FAST); }
      if (instant || calm) {
        seat.x.jump(node.x); seat.y.jump(node.y); seat.w.jump(node.w); seat.h.jump(node.h);
      } else {
        seat.x.go(node.x, moveAt, GLIDE); seat.y.go(node.y, moveAt, GLIDE);
        seat.w.go(node.w, moveAt, GLIDE); seat.h.go(node.h, moveAt, GLIDE);
      }
    }

    // What is new buds from its parent, ring by ring, strongest first.
    fresh.sort((a, b) => (tree.get(a.key)?.hop ?? 1) - (tree.get(b.key)?.hop ?? 1) || b.flow - a.flow);
    const deepest = Math.max(1, ...fresh.map((node) => tree.get(node.key)?.hop ?? 1));
    const step = Math.min(HOP, CASCADE / deepest);
    const start = leaves && !instant && !calm ? now + OUT / 2 : now;
    const siblings = new Map<string, number>();
    const freshKeys = new Set<string>();
    for (const node of fresh) {
      const parent = tree.get(node.key)?.parent ?? (node.key === focus ? null : focus);
      const from = parent ? this.seats.get(parent) : undefined;
      const rank = siblings.get(parent ?? "") ?? 0;
      siblings.set(parent ?? "", rank + 1);
      const born = instant || calm ? now : Math.max(start, (from?.born ?? start - step) + step) + Math.min(rank, MOST_SIBLINGS) * SIBLING;
      const seat: Seat = {
        node: seated(node),
        x: new Tween(node.x), y: new Tween(node.y), w: new Tween(node.w), h: new Tween(node.h), shown: new Tween(1),
        born, parent, leaving: false, el: null,
        ax: node.x, ay: node.y, aw: node.w, ah: node.h,
        painted: { transform: "", width: "", height: "", opacity: "" },
      };
      if (calm && !instant) seat.shown.from(-1, now, FAST);
      else if (!instant) {
        seat.shown.from(-1, born, FLIGHT * 0.5);
        seat.w.from(-0.7 * node.w, born, FLIGHT);
        seat.h.from(-0.7 * node.h, born, FLIGHT);
        if (from) { seat.x.from(from.x.target - node.x, born, FLIGHT); seat.y.from(from.y.target - node.y, born, FLIGHT); }
      }
      this.seats.set(node.key, seat);
      freshKeys.add(node.key);
      this.landing = Math.max(this.landing, born + FLIGHT);
    }
    if (fresh.length) this.grew = true;

    // Links. One that leads to a new node grows with it; the rest draw in once both ends are there.
    const wanted = new Set(graph.edges.map((edge) => edge.key));
    for (const [key, strand] of [...this.strands]) {
      if (wanted.has(key) || strand.leaving) continue;
      if (instant) { this.strands.delete(key); continue; }
      strand.leaving = true;
      strand.shown.leave(0, now, calm ? FAST : OUT);
    }
    const crossing: GraphEdge[] = [];
    for (const edge of graph.edges) {
      const held = this.strands.get(edge.key);
      if (held) {
        held.edge = edge;
        if (held.leaving) { held.leaving = false; held.shown.go(1, now, FAST); }
        continue;
      }
      const a = this.seats.get(edge.from);
      const b = this.seats.get(edge.to);
      if (!a || !b) continue;
      const child = freshKeys.has(edge.from) && a.parent === edge.to ? a : freshKeys.has(edge.to) && b.parent === edge.from ? b : null;
      if (!child) { crossing.push(edge); continue; }
      const strand = this.strand(edge);
      if (!instant && !calm) strand.shown.from(-1, child.born, FLIGHT * 0.5);
      else if (!instant) strand.shown.from(-1, now, FAST);
      this.strands.set(edge.key, strand);
    }
    crossing.sort((p, q) => q.flow - p.flow).forEach((edge, rank) => {
      const strand = this.strand(edge);
      if (calm && !instant) strand.shown.from(-1, now, FAST);
      else if (!instant) {
        const a = this.seats.get(edge.from)!;
        const b = this.seats.get(edge.to)!;
        const born = Math.max(now, a.born + FLIGHT * 0.7, b.born + FLIGHT * 0.7) + Math.min(rank, 16) * SIBLING;
        strand.shown.from(-1, born, FAST);
        if (edge.value >= 0) strand.drawn.from(-1, born, WEAVE);
        this.woven = Math.max(this.woven, born + WEAVE);
      }
      this.strands.set(edge.key, strand);
    });

    // When it has all landed: the pulse. Down from the top to the unit, and on out of it.
    if (graph.settled && this.grew && !calm && !instant) {
      this.grew = false;
      const ys = placed.nodes.map((node) => node.y);
      const mid = focus ? want.get(focus)?.y : undefined;
      if (mid !== undefined && ys.length > 1) this.sweep = { start: Math.max(moveAt + GLIDE * 0.5, this.woven - 80), top: Math.min(...ys) - 4, focus: mid, bottom: Math.max(...ys) + 24, sparks: null };
    }

    this.paint(now);
    this.run();
    return this.shown();
  }

  private strand(edge: GraphEdge): Strand {
    return { edge, shown: new Tween(1), drawn: new Tween(1), leaving: false, el: null, y1: 0, y2: 0, painted: { d: "", opacity: "", dash: "" } };
  }

  /** An action's body for a node. */
  attachNode(el: HTMLElement, key: string) {
    const seat = this.seats.get(key);
    if (seat) {
      seat.el = el;
      seat.painted = { transform: "", width: "", height: "", opacity: "" };
      this.paintSeat(seat, performance.now(), null);
    }
    return { destroy: () => { if (seat?.el === el) seat.el = null; } };
  }

  /** An action's body for a link. */
  attachEdge(el: SVGPathElement, key: string) {
    const strand = this.strands.get(key);
    if (strand) {
      strand.el = el;
      strand.painted = { d: "", opacity: "", dash: "" };
      this.paintStrand(strand, performance.now());
    }
    return { destroy: () => { if (strand?.el === el) strand.el = null; } };
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.fallback);
    this.frame = 0;
    this.endSweep();
  }

  private run() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(this.tick);
    // A page given no frames (a pane out of view, say) must still end up drawn.
    this.fallback = window.setTimeout(this.starved, STARVED);
  }

  private starved = () => {
    cancelAnimationFrame(this.frame);
    this.tick(performance.now());
  };

  private tick = (now: number) => {
    this.frame = 0;
    clearTimeout(this.fallback);
    this.paint(now);
    let gone = false;
    let moving = this.sweep !== null;
    for (const [key, seat] of this.seats) {
      if (seat.leaving && !seat.shown.live) { this.seats.delete(key); gone = true; }
      else if (seat.x.live || seat.y.live || seat.w.live || seat.h.live || seat.shown.live) moving = true;
    }
    for (const [key, strand] of this.strands) {
      if (strand.leaving && (!strand.shown.live || !this.seats.has(strand.edge.from) || !this.seats.has(strand.edge.to))) { this.strands.delete(key); gone = true; }
      else if (strand.shown.live || strand.drawn.live) moving = true;
    }
    if (gone) this.changed();
    if (moving) this.run();
  };

  private paint(now: number) {
    const front = this.frontAt(now);
    for (const seat of this.seats.values()) this.paintSeat(seat, now, front);
    for (const strand of this.strands.values()) this.paintStrand(strand, now);
    if (front !== null) this.paintSparks(front);
  }

  private paintSeat(seat: Seat, now: number, front: number | null) {
    seat.ax = seat.x.at(now);
    seat.ay = seat.y.at(now);
    seat.aw = Math.max(0, seat.w.at(now));
    seat.ah = Math.max(0, seat.h.at(now));
    const opacity = unit(seat.shown.at(now)).toFixed(2);
    const { el, painted } = seat;
    if (!el) return;
    const near = front === null ? 0 : Math.max(0, 1 - Math.abs(front - seat.ay) / BUMP);
    const transform = `translate(${(seat.ax - seat.aw / 2).toFixed(1)}px, ${(seat.ay - seat.ah / 2).toFixed(1)}px)${near > 0 ? ` scale(${(1 + 0.6 * near * near).toFixed(3)})` : ""}`;
    if (transform !== painted.transform) el.style.transform = painted.transform = transform;
    const width = `${seat.aw.toFixed(1)}px`;
    if (width !== painted.width) el.style.width = painted.width = width;
    const height = `${seat.ah.toFixed(1)}px`;
    if (height !== painted.height) el.style.height = painted.height = height;
    if (opacity !== painted.opacity) el.style.opacity = painted.opacity = opacity;
  }

  private paintStrand(strand: Strand, now: number) {
    const a = this.seats.get(strand.edge.from);
    const b = this.seats.get(strand.edge.to);
    if (!a || !b) return;
    const y1 = a.ay + a.ah / 2;
    const y2 = b.ay - b.ah / 2;
    strand.y1 = y1;
    strand.y2 = y2;
    const bend = Math.max(10, (y2 - y1) * 0.5);
    const d = `M${a.ax.toFixed(1)} ${y1.toFixed(1)}C${a.ax.toFixed(1)} ${(y1 + bend).toFixed(1)} ${b.ax.toFixed(1)} ${(y2 - bend).toFixed(1)} ${b.ax.toFixed(1)} ${y2.toFixed(1)}`;
    const opacity = unit(strand.shown.at(now)).toFixed(2);
    const drawn = unit(strand.drawn.at(now));
    const dash = drawn < 1 ? `${drawn.toFixed(3)} 1` : "";
    const { el, painted } = strand;
    if (d !== painted.d) { painted.d = d; el?.setAttribute("d", d); }
    if (!el) return;
    if (opacity !== painted.opacity) el.style.strokeOpacity = painted.opacity = opacity;
    if (dash !== painted.dash) el.style.strokeDasharray = painted.dash = dash;
  }

  /** How far down the page the pulse has come: on Ledger's curve to the unit, then again on from it. */
  private frontAt(now: number): number | null {
    const sweep = this.sweep;
    if (!sweep) return null;
    let t = now - sweep.start;
    if (t < 0) return null;
    const first = sweep.focus - sweep.top > 8 ? BEAT : 0;
    const second = sweep.bottom - sweep.focus > 32 ? BEAT : 0;
    if (t >= first + second) { this.endSweep(); return null; }
    if (!sweep.sparks) sweep.sparks = this.lightSparks();
    if (t < first) return sweep.top + (sweep.focus - sweep.top) * ease(t / first);
    t -= first;
    return sweep.focus + (sweep.bottom - sweep.focus) * ease(t / second);
  }

  /** The strongest links that push for their target carry the pulse. */
  private lightSparks(): Spark[] {
    const layer = this.layer();
    if (!layer) return [];
    const strongest = [...this.strands.values()]
      .filter((strand) => !strand.leaving && strand.edge.value >= 0 && strand.el)
      .sort((p, q) => q.edge.flow - p.edge.flow)
      .slice(0, SPARKS);
    return strongest.map((strand) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const dash = Math.min(0.5, SPARK_LENGTH / Math.max(1, strand.y2 - strand.y1));
      el.setAttribute("pathLength", "1");
      el.setAttribute("d", strand.painted.d);
      el.style.stroke = strand.el!.style.stroke;
      el.style.strokeWidth = `${parseFloat(strand.el!.style.strokeWidth || "1") + 0.6}px`;
      el.style.strokeDasharray = `${dash.toFixed(4)} 2`;
      el.style.opacity = "0";
      layer.append(el);
      return { strand, el, dash, painted: "" };
    });
  }

  private paintSparks(front: number) {
    for (const spark of this.sweep?.sparks ?? []) {
      const { y1, y2 } = spark.strand;
      const head = (front - y1) / Math.max(1, y2 - y1);
      const on = head > 0 && head - spark.dash < 1;
      const painted = on ? (spark.dash - head).toFixed(4) : "off";
      if (painted === spark.painted) continue;
      spark.painted = painted;
      spark.el.style.opacity = on ? "0.9" : "0";
      if (on) spark.el.style.strokeDashoffset = painted;
    }
  }

  private endSweep() {
    if (!this.sweep) return;
    for (const spark of this.sweep.sparks ?? []) spark.el.remove();
    this.sweep = null;
    // Each node lets go of the swell the pulse gave it.
    const now = performance.now();
    for (const seat of this.seats.values()) this.paintSeat(seat, now, null);
  }
}

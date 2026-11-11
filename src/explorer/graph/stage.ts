// How the graph moves, all on one clock, so a link can never part from its nodes.
//
// Arriving is a few overlapping beats. The unit swells into place. What it connects to buds out of it a
// ring at a time, strongest first, each link growing with the node at its end. The links that make it
// a graph rather than a tree draw themselves in behind them. The finished graph untangles. Data sets
// the pace when it is slow; when it is quick, the rings still open one after another.
//
// Every value is a target plus offsets that shrink away on Ledger's curve. A new target only adds an
// offset, so a walk that keeps growing, a click on a neighbour or a change of view takes over from
// wherever things are, without a hitch. Nothing waits for any of it: every node is a link from the start.
//
// A frame touches as little of the page as it can. A node's box is set to the size it is going to and
// only moved; its mark grows inside it by a transform, so no frame lays the page out again. The links are
// strokes on one canvas (ink.ts), which this restyles on the same clock: their weight and colour glide,
// and lighting what connects a unit fades them, as their CSS transitions did when they were elements.
// In the navigator each title is text alone: the canvas paints the frosted glass behind it (ink.ts), in
// step with the title's fade in and out and its dimming, so moving the view blurs nothing again.
import { FAST, GLIDE, IN, OUT, ease, reducedMotion } from "@stdlogits/ledger";
import type { Frost, Ink, Mark, Stroke } from "./ink";
import type { Layout, Placed, Spot } from "./layout";
import type { Graph, GraphEdge } from "./trace";

export interface Seated extends Placed {
  /** Links from the unit, by the shortest way. */
  hop: number;
}
export interface Shown { nodes: Seated[]; edges: GraphEdge[] }
/** How a link should look: its colour (one the canvas takes), weight and opacity, and whether it pushes against. */
export interface Look { color: string; width: number; alpha: number; against: boolean }

const HOP = 48;
/** However deep the graph, its rings open within this long. */
const CASCADE = 340;
const SIBLING = 8;
const MOST_SIBLINGS = 10;
const FLIGHT = IN;
const WEAVE = 180;
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
  /** The mark inside it, which grows and shrinks by a transform within the box. */
  mark: HTMLElement | null;
  /** This frame's place, and how much of it shows. */
  ax: number; ay: number; aw: number; ah: number; alpha: number;
  painted: { transform: string; width: string; height: string; opacity: string; scale: string };
  /** Whether it has to be painted again: it moved this frame, or was given a new place or look. */
  stale: boolean;
}

interface Strand {
  edge: GraphEdge;
  shown: Tween;
  /** How much of it is drawn, 0–1, upstream end first. */
  drawn: Tween;
  leaving: boolean;
  /** Its look, gliding: weight, opacity, and from the colour it had to the one it has. */
  width: Tween;
  alpha: Tween;
  blend: Tween;
  styled: boolean;
  /** This frame's stroke, for the canvas. */
  stroke: Stroke;
  stale: boolean;
}

/** A title beside a mark (the navigator's), whose glass the canvas paints. */
interface Title {
  key: string;
  spot: Spot;
  /** Its box before the zoom's counter-scale, in CSS pixels. */
  w: number; h: number;
  /** Fading in or out, as its transitions do; dimmed with its mark while another unit is lit. */
  shown: Tween;
  dim: Tween;
  leaving: boolean;
  frost: Frost;
}

/** Each node's way back to the unit: its nearest neighbour, the strongest of them if several are as near. */
function spanning(graph: Graph, focus: string | null) {
  const links = new Map<string, { other: string; flow: number }[]>();
  const add = (a: string, b: string, flow: number) => { const list = links.get(a); if (list) list.push({ other: b, flow }); else links.set(a, [{ other: b, flow }]); };
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
/** How far a title (and its mark) fades while another unit is lit: Graph.svelte's .dim. */
const DIM = 0.25;
/** Which seats moved in the frame being painted. */
const moved = new Map<object, boolean>();

/** Whether a node shows the same as before: what its mark, link and tip are drawn from. Its place is the stage's. */
const same = (a: Seated, b: Seated) => a.wire === b.wire && a.flow === b.flow && a.onward === b.onward && a.side === b.side && a.hop === b.hop && a.layer === b.layer && a.index === b.index && a.kind === b.kind && a.pole === b.pole;

export class Stage {
  private seats = new Map<string, Seat>();
  private strands = new Map<string, Strand>();
  private frame = 0;
  private fallback = 0;
  /** When the last bud lands. */
  private landing = 0;
  private ink: Ink | null = null;
  private look: ((edge: GraphEdge) => Look) | null = null;
  private titles = new Set<Title>();
  private dimmed: (key: string) => boolean = () => false;
  private tint: (seat: Seated) => string = () => "";
  private sizes: ResizeObserver | null = null;
  /** How much the titles are scaled against the marks (Graph.svelte's labelScale). */
  private titleScale = 1;
  private sized = new Map<Element, Title>();

  /** `changed`: what is shown has lost something that finished leaving. */
  constructor(private changed: () => void) {}

  /** The canvas the links are drawn on, how each should look, which titles are dimmed, and each mark's colour (for the glass to blur). */
  draw(ink: Ink | null, look: (edge: GraphEdge) => Look, dimmed: (key: string) => boolean = () => false, tint: (seat: Seated) => string = () => "") {
    this.ink = ink;
    this.look = look;
    this.dimmed = dimmed;
    this.tint = tint;
    this.restyle(false);
  }

  /** An action's body for a title: the canvas paints its glass while it is shown. */
  attachTitle(el: HTMLElement, [key, spot]: [string, Spot]) {
    const now = performance.now();
    const calm = reducedMotion();
    const title: Title = {
      key, spot, w: el.offsetWidth, h: el.offsetHeight,
      shown: new Tween(1), dim: new Tween(this.dimmed(key) ? DIM : 1), leaving: false,
      frost: { x: 0, y: 0, w: 0, h: 0, r: 0, alpha: 0 },
    };
    title.shown.from(-1, now, calm ? FAST : IN);
    this.titles.add(title);
    this.sizes ??= new ResizeObserver((entries) => {
      for (const entry of entries) {
        const held = this.sized.get(entry.target);
        const box = entry.borderBoxSize?.[0];
        if (!held || !box) continue;
        held.w = box.inlineSize;
        held.h = box.blockSize;
      }
      this.later();
    });
    this.sized.set(el, title);
    this.sizes.observe(el);
    this.run();
    return {
      update: ([, next]: [string, Spot]) => { if (next !== title.spot) { title.spot = next; this.later(); } },
      destroy: () => {
        this.sizes?.unobserve(el);
        this.sized.delete(el);
        title.leaving = true;
        // As the title's own fade out: gone at once under reduced motion.
        if (calm) title.shown.jump(0);
        else title.shown.leave(0, performance.now(), OUT);
        this.run();
      },
    };
  }

  /** Each link takes its look again (a unit lit, the graph's strongest link changed, a theme): weight and colour glide, opacity fades. */
  restyle(animate = true) {
    const now = performance.now();
    const calm = reducedMotion();
    for (const strand of this.strands.values()) if (!strand.leaving) this.style(strand, now, animate && !calm ? GLIDE : 0, animate ? (calm ? FAST : IN) : 0);
    for (const title of this.titles) {
      const target = this.dimmed(title.key) ? DIM : 1;
      if (animate) title.dim.go(target, now, calm ? FAST : IN);
      else title.dim.jump(target);
    }
    this.paint(now);
    this.run();
  }

  /** The titles' scale against the marks changed: their glass follows. */
  scaleTitles(scale: number) {
    if (scale === this.titleScale) return;
    this.titleScale = scale;
    this.later();
  }

  /** Redraw once, on the next frame, however many titles changed side or size before it. */
  private later() {
    this.run();
  }

  /** Redraw as things stand: the canvas was resized, or its view moved. */
  redraw() {
    this.paintLinks();
  }

  private style(strand: Strand, now: number, glide: number, fade: number) {
    if (!this.look) return;
    strand.stale = true;
    const look = this.look(strand.edge);
    const { stroke } = strand;
    stroke.against = look.against;
    if (!strand.styled) {
      strand.styled = true;
      strand.width.jump(look.width);
      strand.alpha.jump(look.alpha);
      stroke.color = look.color;
      return;
    }
    if (glide > 0) strand.width.go(look.width, now, glide);
    else strand.width.jump(look.width);
    if (fade > 0) strand.alpha.go(look.alpha, now, fade);
    else strand.alpha.jump(look.alpha);
    if (look.color !== stroke.color) {
      if (glide > 0) {
        stroke.was = stroke.color;
        strand.blend.jump(1);
        strand.blend.from(-1, now, glide);
      } else stroke.was = null;
      stroke.color = look.color;
    }
  }

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
      seat.stale = true;
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
      // The same object while it shows the same, so the page leaves its mark alone.
      const next = seated(node);
      if (!same(seat.node, next)) seat.node = next;
      seat.stale = true;
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
        born, parent, leaving: false, el: null, mark: null,
        ax: node.x, ay: node.y, aw: node.w, ah: node.h, alpha: 0,
        painted: { transform: "", width: "", height: "", opacity: "", scale: "" },
        stale: true,
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

    // Links. One that leads to a new node grows with it; the rest draw in once both ends are there.
    const wanted = new Set(graph.edges.map((edge) => edge.key));
    for (const [key, strand] of [...this.strands]) {
      if (wanted.has(key) || strand.leaving) continue;
      if (instant) { this.strands.delete(key); continue; }
      strand.leaving = true;
      strand.stale = true;
      strand.shown.leave(0, now, calm ? FAST : OUT);
    }
    const crossing: GraphEdge[] = [];
    const restyle = !instant && !calm ? GLIDE : 0;
    for (const edge of graph.edges) {
      const held = this.strands.get(edge.key);
      if (held) {
        held.edge = edge;
        this.style(held, now, restyle, instant ? 0 : calm ? FAST : IN);
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
      }
      this.strands.set(edge.key, strand);
    });

    this.paint(now);
    this.run();
    return this.shown();
  }

  private strand(edge: GraphEdge): Strand {
    const strand: Strand = {
      edge, shown: new Tween(1), drawn: new Tween(1), leaving: false,
      width: new Tween(0), alpha: new Tween(0), blend: new Tween(1), styled: false,
      stroke: { x1: 0, y1: 0, x2: 0, y2: 0, bend: 0, width: 0, alpha: 0, color: "", was: null, blend: 1, against: false, drawn: 1 },
      stale: true,
    };
    this.style(strand, 0, 0, 0);
    return strand;
  }

  /** An action's body for a node: the link, with its mark as its first child. */
  attachNode(el: HTMLElement, key: string) {
    const seat = this.seats.get(key);
    if (seat) {
      seat.el = el;
      seat.mark = el.firstElementChild as HTMLElement | null;
      seat.painted = { transform: "", width: "", height: "", opacity: "", scale: "" };
      seat.stale = true;
      this.paintSeat(seat, performance.now());
    }
    return { destroy: () => { if (seat?.el === el) { seat.el = null; seat.mark = null; } } };
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    clearTimeout(this.fallback);
    this.frame = 0;
    this.sizes?.disconnect();
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
    let moving = false;
    for (const [key, seat] of this.seats) {
      if (seat.leaving && !seat.shown.live) { this.seats.delete(key); gone = true; }
      else if (seat.x.live || seat.y.live || seat.w.live || seat.h.live || seat.shown.live) moving = true;
    }
    for (const [key, strand] of this.strands) {
      if (strand.leaving && (!strand.shown.live || !this.seats.has(strand.edge.from) || !this.seats.has(strand.edge.to))) { this.strands.delete(key); gone = true; }
      else if (strand.shown.live || strand.drawn.live || strand.width.live || strand.alpha.live || strand.blend.live) moving = true;
    }
    for (const title of this.titles) {
      // Its fades run out here too: one whose mark has gone isn't painted, and would otherwise keep every frame coming.
      title.shown.at(now);
      title.dim.at(now);
      if (title.leaving && !title.shown.live) this.titles.delete(title);
      else if (title.shown.live || title.dim.live) moving = true;
    }
    if (gone) this.changed();
    if (moving) this.run();
  };

  /** Paint this frame: only what moves, or was given a new place or look; the canvas is drawn whole. */
  private paint(now: number) {
    for (const seat of this.seats.values()) {
      const moving = seat.x.live || seat.y.live || seat.w.live || seat.h.live || seat.shown.live;
      const painting = moving || seat.stale;
      if (painting) this.paintSeat(seat, now);
      seat.stale = moving;
      moved.set(seat, painting);
    }
    for (const strand of this.strands.values()) {
      const a = this.seats.get(strand.edge.from);
      const b = this.seats.get(strand.edge.to);
      const moving = strand.shown.live || strand.drawn.live || strand.width.live || strand.alpha.live || strand.blend.live;
      if (moving || strand.stale || (a && moved.get(a)) || (b && moved.get(b))) this.paintStrand(strand, now);
      strand.stale = moving;
    }
    moved.clear();
    this.paintLinks();
  }

  private paintLinks() {
    const { ink } = this;
    if (!ink) return;
    if (!this.titles.size) { ink.draw(this.strokes()); return; }
    ink.draw(this.strokes(), this.frosts(performance.now(), this.titleScale, ink.chip()), this.marks());
  }

  private *strokes() {
    for (const strand of this.strands.values()) yield strand.stroke;
  }

  /** Where each title's glass is this frame, in the graph's coordinates: by its mark, at the side Graph.svelte's
   * .label puts it, scaled against the marks as the title is (s), as visible as the title. */
  private *frosts(now: number, s: number, chip: number) {
    for (const title of this.titles) {
      const seat = this.seats.get(title.key);
      const { frost } = title;
      if (!seat) { frost.alpha = 0; continue; }
      const gap = 3 * s;
      const w = title.w * s;
      const h = title.h * s;
      const bw = seat.w.target;
      const bh = seat.h.target;
      if (title.spot === "below" || title.spot === "above") {
        frost.x = seat.ax - w / 2;
        frost.y = title.spot === "below" ? seat.ay + bh / 2 + gap : seat.ay - bh / 2 - gap - h;
      } else {
        frost.x = title.spot === "right" ? seat.ax + bw / 2 + gap : seat.ax - bw / 2 - gap - w;
        frost.y = seat.ay - h / 2;
      }
      frost.w = w;
      frost.h = h;
      frost.r = chip * s;
      frost.alpha = seat.alpha * unit(title.shown.at(now)) * unit(title.dim.at(now));
      yield frost;
    }
  }

  /** The marks, as the glass sees them behind it. */
  private *marks(): Generator<Mark> {
    for (const seat of this.seats.values()) {
      if (seat.alpha <= 0) continue;
      yield { x: seat.ax, y: seat.ay, w: seat.aw, h: seat.ah, alpha: seat.alpha * (this.dimmed(seat.node.key) ? DIM : 1), color: this.tint(seat.node) };
    }
  }

  private paintSeat(seat: Seat, now: number) {
    seat.ax = seat.x.at(now);
    seat.ay = seat.y.at(now);
    seat.aw = Math.max(0, seat.w.at(now));
    seat.ah = Math.max(0, seat.h.at(now));
    seat.alpha = unit(seat.shown.at(now));
    const opacity = seat.alpha.toFixed(2);
    const { el, mark, painted } = seat;
    if (!el) return;
    // The box is the size the mark is going to, so it changes only with a new layout; the mark fills it at this frame's size.
    const bw = seat.w.target;
    const bh = seat.h.target;
    const width = `${bw.toFixed(1)}px`;
    if (width !== painted.width) el.style.width = painted.width = width;
    const height = `${bh.toFixed(1)}px`;
    if (height !== painted.height) el.style.height = painted.height = height;
    const transform = `translate(${(seat.ax - bw / 2).toFixed(1)}px, ${(seat.ay - bh / 2).toFixed(1)}px)`;
    if (transform !== painted.transform) el.style.transform = painted.transform = transform;
    if (opacity !== painted.opacity) el.style.opacity = painted.opacity = opacity;
    if (mark) {
      const sx = bw > 0 ? seat.aw / bw : 1;
      const sy = bh > 0 ? seat.ah / bh : 1;
      const scale = Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002 ? "" : `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      if (scale !== painted.scale) mark.style.transform = painted.scale = scale;
    }
  }

  private paintStrand(strand: Strand, now: number) {
    const a = this.seats.get(strand.edge.from);
    const b = this.seats.get(strand.edge.to);
    if (!a || !b) return;
    const { stroke } = strand;
    stroke.x1 = a.ax;
    stroke.y1 = a.ay + a.ah / 2;
    stroke.x2 = b.ax;
    stroke.y2 = b.ay - b.ah / 2;
    stroke.bend = Math.max(10, (stroke.y2 - stroke.y1) * 0.5);
    stroke.width = Math.max(0, strand.width.at(now));
    stroke.alpha = unit(strand.shown.at(now)) * unit(strand.alpha.at(now));
    stroke.blend = unit(strand.blend.at(now));
    if (stroke.blend >= 1) stroke.was = null;
    // Only a link that pushes for is drawn in; one that pushes against is dashed throughout.
    stroke.drawn = stroke.against ? 1 : unit(strand.drawn.at(now));
  }
}

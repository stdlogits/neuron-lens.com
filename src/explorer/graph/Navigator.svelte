<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { FOREIGN, GLIDE, Icon, IconButton, LabelText, MorphText, Segmented, Tabs, ease, expand, hideTip, reducedMotion } from "@stdlogits/ledger";
  import Card, { type Picked } from "./Card.svelte";
  import { find } from "./find";
  import { useLens } from "../lens.svelte";
  import { ensureTerms, translation } from "../../lib/translate.svelte";
  import Graph from "./Graph.svelte";
  import { OVERSCAN, type View } from "./ink";
  import { rows, type Layout, type Open, type Placed, type Spot } from "./layout";
  import type { Graph as GraphData, GraphNode, Mode, Reach } from "./trace";
  import { bandOf, type ModelInfo } from "../../lib/models";
  import { headId, loadSearch, neuronId, type SearchFile } from "../../lib/data";

  // The unit's connections, full screen: the same graph and motion as the rail's, opening at HOME times
  // its size, moved like a map. Titles stay one size on screen at any zoom, each where it touches no mark
  // and no other title: the unit's first, then the strongest, under its mark if it can, else over it or
  // beside it. Rows are spaced so most fit at HOME; zooming in makes room for the rest. Drag (or scroll, or the
  // arrow keys) to move, pinch (or ⌘/ctrl and scroll, or + and −, or a double tap) to zoom; a unit's mark (or its
  // title) opens it here, re-centring the graph on it, and a tap on it opens its card first. Its address is the
  // unit's with ?graph, so Back and links work, and Escape closes it.
  // The view moves once a frame, however many events ask it to. The marks and the links (drawn on a canvas of the
  // view's size, under the view, so they stay sharp) are laid out at a base view, and a pan moves only the layer
  // that holds both, by a translation the compositor applies alone: nothing is painted or layered again until the
  // pan runs past what the canvas drew around the screen, or the zoom changes, which lay them out at the view anew.
  let { graph, model, mode, modes, onmode, reach, reaches, onreach, hovered, point, href, name, title, close }: {
    graph: GraphData;
    model: ModelInfo;
    mode: Mode;
    modes: { value: Mode; label: string; hint: string }[];
    onmode: (mode: Mode) => void;
    reach: Reach;
    reaches: { value: Reach; label: string; hint: string }[];
    onreach: (reach: Reach) => void;
    hovered: string | null;
    point: (key: string | null) => void;
    href: (kind: "neuron" | "head", layer: number, index: number) => string;
    name: string;
    title: string;
    close: () => void;
  } = $props();

  /** The widest a title sets before it wraps (Graph.svelte's .label), and its line's height. */
  const LABEL = 150;
  const LINE = 16;

  // How each title sets: as wide as its longest line, on as many lines as it wraps to. A run of
  // CJK may break between any two characters, as the browser breaks it; a word longer than a line breaks
  // inside itself (the label's overflow-wrap).
  let pen: CanvasRenderingContext2D | null = null;
  const set = new Map<string, { width: number; lines: number }>();
  const PIECE = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]|[^\s\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]+|\s+/g;
  function setting(text: string) {
    let found = set.get(text);
    if (found) return found;
    pen ??= document.createElement("canvas").getContext("2d");
    const face = getComputedStyle(document.documentElement).getPropertyValue("--text") || "sans-serif";
    if (pen) pen.font = `600 12px ${face}`;
    const width = (piece: string) => (pen ? pen.measureText(piece).width : piece.length * 7);
    let lines = 1;
    let line = 0;
    let widest = 0;
    for (const piece of text.match(PIECE) ?? []) {
      const w = width(piece);
      if (/^\s+$/.test(piece)) { if (line > 0) line += w; continue; }
      if (line > 0 && line + w > LABEL) { widest = Math.max(widest, line); lines += 1; line = 0; }
      if (w > LABEL) { lines += Math.ceil(w / LABEL) - 1; line = w % LABEL; widest = LABEL; continue; }
      line += w;
    }
    found = { width: Math.min(LABEL, Math.max(widest, line)), lines };
    set.set(text, found);
    return found;
  }
  const nameOf = (n: GraphNode) => (n.kind === "head" ? headId(n.layer, n.index) : `${neuronId(n.layer, n.index)} ${n.pole > 0 ? "+" : "−"}`);
  const titleOf = (n: GraphNode) => n.wire?.title || nameOf(n);
  /** The zoom it opens at: the marks larger than in the rail, the titles at their own size. */
  const HOME = 1.5;
  /** A title's box on screen, padding and backing included (Graph.svelte's .label): as wide as its text on one line, the whole LABEL once it wraps. */
  const box = (n: GraphNode) => { const { width, lines } = setting(titleOf(n)); return { w: (lines > 1 ? LABEL : width) + 10, h: lines * LINE + 2 }; };
  /** Room across for each title at HOME; rows far enough apart for a two-line title under each mark at HOME. */
  const open: Open = { gap: 8 / HOME, reach: (n) => box(n).w / 2 / HOME };
  const pitch = 13 + (3 + 2 * LINE + 2 + 6) / HOME;
  const height = $derived(2 * model.layers * pitch + 18);
  const depth = $derived(rows(graph, height, model.layers));

  // Where each title goes at this zoom: the unit's first, then by flow, the first side of its mark where it
  // overlaps no other mark and no title already placed. Without room it waits to be zoomed into, and its tip still names it.
  let placed = $state.raw<Placed[]>([]);
  type Box = [number, number, number, number];
  const meets = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const spots = $derived.by(() => {
    const s = 1 / labelK;
    // Boxes in a grid of cells about a title's height on screen, so each test meets only its neighbours.
    const cell = 48 * s;
    const grid = new Map<number, [Box, number][]>();
    const cells = (b: Box) => {
      const out: number[] = [];
      for (let x = Math.floor(b[0] / cell); x <= Math.floor(b[2] / cell); x += 1) for (let y = Math.floor(b[1] / cell); y <= Math.floor(b[3] / cell); y += 1) out.push(x * 65536 + y);
      return out;
    };
    const add = (b: Box, owner: number) => {
      for (const key of cells(b)) { const there = grid.get(key); if (there) there.push([b, owner]); else grid.set(key, [[b, owner]]); }
    };
    const free = (b: Box, owner: number) => cells(b).every((key) => (grid.get(key) ?? []).every(([other, who]) => who === owner || !meets(other, b)));
    // While searching, what fell away gives up its room: a found unit's title may lie over a faded mark.
    placed.forEach((n, i) => { if (!found || found.has(n.key) || n.side === "focus") add([n.x - n.w / 2 - 1, n.y - n.h / 2 - 1, n.x + n.w / 2 + 1, n.y + n.h / 2 + 1], i); });
    const out = new Map<string, Spot>();
    const order = placed.map((n, i) => i).filter((i) => !found || found.has(placed[i].key) || placed[i].side === "focus").sort((a, b) => (placed[a].side === "focus" ? -1 : placed[b].side === "focus" ? 1 : placed[b].flow - placed[a].flow));
    for (const i of order) {
      const n = placed[i];
      const size = box(n);
      const w = size.w * s;
      const h = size.h * s;
      const g = 3 * s;
      const sides: [Spot, Box][] = [
        ["below", [n.x - w / 2, n.y + n.h / 2 + g, n.x + w / 2, n.y + n.h / 2 + g + h]],
        ["above", [n.x - w / 2, n.y - n.h / 2 - g - h, n.x + w / 2, n.y - n.h / 2 - g]],
        ["right", [n.x + n.w / 2 + g, n.y - h / 2, n.x + n.w / 2 + g + w, n.y + h / 2]],
        ["left", [n.x - n.w / 2 - g - w, n.y - h / 2, n.x - n.w / 2 - g, n.y + h / 2]],
      ];
      const found = sides.find(([, at]) => free(at, i));
      if (!found) continue;
      out.set(n.key, found[0]);
      add(found[1], -1);
    }
    return out;
  });

  // The view: the graph's x and y at full size map to x · k + tx, y · k + ty on screen. k, tx and ty are
  // where it is going; `shown` is where it is this frame. A re-centring or a step of the zoom buttons
  // glides there; a drag, a pinch or a scroll follows the hand, and a drag let go of while moving coasts on.
  // It is held over the graph, whatever shape the graph has taken (wide where the unit is, narrow far from it,
  // and growing as the walk goes on): some mark always stays within ROOM of the middle of what the bar and the
  // axis leave of the screen. A drag or a scroll past that gives like a rubber band and springs back when let
  // go; a zoom never goes further out than the whole graph.
  let view = $state<HTMLDivElement>();
  let k = HOME;
  let tx = 0;
  let ty = 0;
  let shown = $state.raw<View>({ k: HOME, tx: 0, ty: 0 });
  /** Where the marks and links were last laid out: `shown`, less a pan since. */
  let base = $state.raw<View>({ k: HOME, tx: 0, ty: 0 });
  /** The zoom the titles are placed for: a glide's end at once, a pinch or a scroll once it rests (placing them
   * anew mid-pinch cost a slow machine half its frames). Between, they keep their places, one size on screen. */
  let labelK = $state(HOME);
  /** A glide under way: from where, about which point on screen, since when and for how long. */
  let glide: { from: View; px: number; py: number; start: number; span: number } | null = null;
  /** A drag let go of while moving: its speed (px per ms), slowing. */
  let fling: { vx: number; vy: number; last: number } | null = null;
  let frame = 0;
  let resting = 0;
  /** Any move of the view under way (a pan or a zoom): marks sliding under a still pointer don't light up, show
   * their tips or take hover, which would restyle the whole graph each time one passed; they do again once it rests. */
  let moving = $state(false);
  /** A pinch or a ⌘/ctrl-scroll under way. */
  let zooming = false;
  let still = 0;
  function stir(zoom = false) {
    if (!moving) {
      moving = true;
      // A tip left where its mark was would point at nothing.
      hideTip();
    }
    if (zoom) zooming = true;
    clearTimeout(still);
    still = window.setTimeout(rest, 160);
  }
  /** At rest again: the titles placed for this zoom, the view back within the graph if it was pulled past it,
   * and the light out unless the pointer is still on a mark, which then lights it again. */
  function rest() {
    moving = false;
    if (zooming) { zooming = false; labelK = shown.k; }
    if (!pointers.size && !fling) settle();
    point(null);
  }
  /** One size on screen at any zoom, in step with the marks. */
  const labelScale = $derived(1 / base.k);
  /** While the view moves, what is lit stays lit: marks passing under the pointer neither light nor put out. */
  const pointHere = (key: string | null) => { if (!moving) point(key); };

  let viewWidth = $state(0);
  let viewHeight = $state(0);
  let barHeight = $state(0);
  let bar = $state<HTMLElement>();
  /** The axis down the left (.axis). */
  const AXIS = 64;
  /** What the bar and the axis leave of the screen. */
  function area() {
    const width = viewWidth || view?.clientWidth || 0;
    const height = viewHeight || view?.clientHeight || 0;
    const top = Math.min(height / 2, barHeight || bar?.offsetHeight || 0);
    const left = Math.min(width / 2, AXIS);
    return { x0: left, y0: top, x1: width, y1: height, cx: (left + width) / 2, cy: (top + height) / 2 };
  }
  /** How far the marks reach (across, with their titles at HOME), in the graph's own units; null before it is laid out. */
  let extent: { x0: number; y0: number; x1: number; y1: number } | null = null;
  const MIN = 0.05;
  const MAX = 3;
  /** The furthest out: the whole graph and some room around it, and never further out than HOME needs. */
  function lowest() {
    if (!extent) return MIN;
    const a = area();
    const fit = Math.min((a.x1 - a.x0) / Math.max(1, extent.x1 - extent.x0), (a.y1 - a.y0) / Math.max(1, extent.y1 - extent.y0));
    return Math.max(MIN, Math.min(HOME, fit) * 0.8);
  }
  const clampK = (value: number) => Math.min(MAX, Math.max(Math.min(lowest(), MAX), value));
  /** How far a view is from the graph: from the middle of the screen to the nearest mark, in units of the room
   * a mark may be from it (ROOM of what the bar and the axis leave, across and down), with which way it lies. */
  const ROOM = 0.35;
  function away(to: View): { d: number; dx: number; dy: number } | null {
    if (!placed.length) return null;
    const a = area();
    const rx = Math.max(1, (a.x1 - a.x0) * ROOM);
    const ry = Math.max(1, (a.y1 - a.y0) * ROOM);
    let best = Infinity;
    let bx = 0;
    let by = 0;
    for (const n of placed) {
      const dx = (a.cx - (n.x * to.k + to.tx)) / rx;
      const dy = (a.cy - (n.y * to.k + to.ty)) / ry;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; bx = dx; by = dy; }
    }
    return { d: Math.sqrt(best), dx: bx, dy: by };
  }
  /** A view held over the graph: moved straight toward its nearest mark until that mark is in reach. */
  function bounded(to: View): View {
    const off = away(to);
    if (!off || off.d <= 1) return to;
    const a = area();
    const f = 1 - 1 / off.d;
    return { k: to.k, tx: to.tx + off.dx * (a.x1 - a.x0) * ROOM * f, ty: to.ty + off.dy * (a.y1 - a.y0) * ROOM * f };
  }
  /** How far past its range a view is, in pixels. */
  function over(to: View) {
    const off = away(to);
    if (!off || off.d <= 1) return 0;
    const a = area();
    return (off.d - 1) * Math.min(a.x1 - a.x0, a.y1 - a.y0) * ROOM;
  }
  /** The furthest past the range a drag (or, less, a scroll) can pull the view, giving more stiffly the further it goes. */
  const BAND = 120;
  const WHEEL_BAND = 48;
  /** Move the view by dx, dy with the hand: past the range it gives, never more than `band` (with reduced motion, not at all). */
  function nudge(dx: number, dy: number, band = BAND) {
    moved = true;
    const next = { k, tx: tx + dx, ty: ty + dy };
    const was = over({ k, tx, ty });
    let to = next;
    if (reducedMotion()) to = bounded(next);
    else if (over(next) > was) {
      const f = Math.max(0, 1 - was / band) ** 2;
      to = { k, tx: tx + dx * f, ty: ty + dy * f };
      // However many events push it (a trackpad's coast sends hundreds), it stops at the band.
      if (over(to) > band) {
        const held = bounded(to);
        const pull = over(to);
        to = { k, tx: held.tx + (to.tx - held.tx) * (band / pull), ty: held.ty + (to.ty - held.ty) * (band / pull) };
      }
    }
    tx = to.tx;
    ty = to.ty;
  }
  /** Back within the range, gliding, if it was pulled past it. */
  function settle() {
    const to = bounded({ k, tx, ty });
    if (Math.abs(to.tx - tx) > 0.5 || Math.abs(to.ty - ty) > 0.5) go(to, true);
  }

  function at(now: number): View {
    if (!glide) return { k, tx, ty };
    const t = Math.min(1, (now - glide.start) / glide.span);
    if (t >= 1) { glide = null; return { k, tx, ty }; }
    const e = ease(t);
    const { from, px, py } = glide;
    // The zoom changes by the same ratio each moment; the point under (px, py) moves straight to where it ends.
    const z = from.k * Math.pow(k / from.k, e);
    const gx = (px - from.tx) / from.k + ((px - tx) / k - (px - from.tx) / from.k) * e;
    const gy = (py - from.ty) / from.k + ((py - ty) / k - (py - from.ty) / from.k) * e;
    return { k: z, tx: px - gx * z, ty: py - gy * z };
  }
  /** A glide's length: GLIDE for a step, up to twice that to cross the screen or zoom far. */
  function span(from: View, to: View, px: number, py: number) {
    const a = area();
    const far = Math.hypot((px - from.tx) / from.k - (px - to.tx) / to.k, (py - from.ty) / from.k - (py - to.ty) / to.k) * Math.min(from.k, to.k) / Math.max(1, Math.hypot(a.x1 - a.x0, a.y1 - a.y0));
    return GLIDE * Math.min(2, 1 + 0.75 * far + 0.5 * Math.abs(Math.log(to.k / from.k)));
  }
  /** Go to a view: gliding, or on the next frame; `now` shows it at once (the first centring, before anything is drawn). */
  function go(to: View, animate: boolean, now = false) {
    const time = performance.now();
    const from = at(time);
    fling = null;
    if (to.k !== k) labelK = to.k;
    k = to.k;
    tx = to.tx;
    ty = to.ty;
    if (now) {
      glide = null;
      cancelAnimationFrame(frame);
      frame = 0;
      shown = base = { k, tx, ty };
      labelK = k;
      return;
    }
    if (animate && !reducedMotion() && (from.k !== k || from.tx !== tx || from.ty !== ty)) {
      // About the one point a zoom leaves where it is, if it is on screen; else the middle of the screen, which moves straight.
      const a = area();
      let px = a.cx;
      let py = a.cy;
      if (Math.abs(k - from.k) > 1e-6) {
        const fx = from.k * ((from.tx - tx) / (k - from.k)) + from.tx;
        const fy = from.k * ((from.ty - ty) / (k - from.k)) + from.ty;
        if (fx >= 0 && fx <= a.x1 && fy >= 0 && fy <= a.y1) { px = fx; py = fy; }
      }
      glide = { from, px, py, start: time, span: span(from, to, px, py) };
    } else glide = null;
    schedule();
  }
  /** Stop any glide or coast where it is, for the hand to take over. */
  function grab() {
    if (glide) {
      const here = at(performance.now());
      k = here.k;
      tx = here.tx;
      ty = here.ty;
      glide = null;
    }
    fling = null;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(step); };
  /** A coast slows over about a third of a second; past the range it stops within a few frames, then springs back. */
  function coast(now: number) {
    const f = fling!;
    const dt = Math.min(32, now - f.last);
    f.last = now;
    const slow = Math.exp(-dt / (over({ k, tx, ty }) > 0 ? 40 : 325));
    f.vx *= slow;
    f.vy *= slow;
    tx += f.vx * dt;
    ty += f.vy * dt;
    stir();
    if (Math.hypot(f.vx, f.vy) < 0.02) { fling = null; settle(); }
  }
  function step(now: number) {
    frame = 0;
    if (fling) coast(now);
    const next = at(now);
    if (next.k !== shown.k || next.tx !== shown.tx || next.ty !== shown.ty) {
      if (next.k !== shown.k && !glide) {
        clearTimeout(resting);
        resting = window.setTimeout(() => (labelK = shown.k), 100);
      }
      shown = next;
      // A zoom or a glide lays everything out at the view; a pan only once it nears the edge of what was drawn.
      if (next.k !== base.k || glide || Math.abs(next.tx - base.tx) > OVERSCAN * 0.75 || Math.abs(next.ty - base.ty) > OVERSCAN * 0.75) base = next;
    }
    if (glide || fling) schedule();
  }
  let links = $state<HTMLCanvasElement>();
  const surface = $derived(links && viewWidth > 0 ? { canvas: links, width: viewWidth, height: viewHeight, view: base } : null);
  let centred: string | null = null;
  /** Where the unit sat when last centred on, and whether the view has been moved since. */
  let centredAt = 0;
  let moved = false;

  /** The unit in the middle of the screen, at zoom z. */
  function centre(animate = true, now = false, z = k) {
    const focus = graph.nodes.find((n) => n.side === "focus");
    if (!view || !focus) return;
    const a = area();
    moved = false;
    centredAt = focus.kind === "head" ? depth.heads(focus.layer) : depth.neurons(focus.layer);
    go({ k: z, tx: a.cx, ty: a.y0 + (a.y1 - a.y0) * 0.45 - centredAt * z }, animate, now);
  }
  // A new unit at the centre: glide to it (the first, jump). Rows that open up as titles arrive keep it there,
  // unless the view was moved; a graph that has changed shape under a moved view takes it back within it.
  function laid(layout: Layout) {
    placed = layout.nodes;
    if (layout.nodes.length) {
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const n of layout.nodes) { y0 = Math.min(y0, n.y - n.h / 2); y1 = Math.max(y1, n.y + n.h / 2); }
      extent = { x0: layout.bounds[0], y0, x1: layout.bounds[1], y1 };
    }
    const focus = layout.nodes.find((n) => n.side === "focus");
    if (!view || !focus) return;
    if (focus.key !== centred) { picked = null; centre(centred !== null); centred = focus.key; }
    else if (!moved && focus.y !== centredAt) centre();
    else if (!pointers.size && !fling && !moving) {
      if (k < lowest() - 1e-6) zoomBy(lowest() / k);
      else settle();
    }
  }

  /** Zoom to `to` about a point on screen, with the hand. */
  function zoomAt(to: number, px: number, py: number) {
    const next = clampK(to);
    moved = true;
    tx = px - ((px - tx) * next) / k;
    ty = py - ((py - ty) * next) / k;
    k = next;
    const held = bounded({ k, tx, ty });
    tx = held.tx;
    ty = held.ty;
  }
  /** A step of the zoom, gliding, about a point on screen (the middle of it unless given). */
  function zoomBy(by: number, x?: number, y?: number) {
    const a = area();
    const px = x ?? a.cx;
    const py = y ?? a.cy;
    const next = clampK(k * by);
    moved = true;
    go(bounded({ k: next, tx: px - ((px - tx) * next) / k, ty: py - ((py - ty) * next) / k }), true);
  }
  const home = () => centre(true, false, HOME);

  /** A wheel's travel in pixels, whichever unit it counts in. */
  const pixels = (event: WheelEvent, by: number) => by * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area().y1 : 1);
  /** Safari's trackpad pinch, read from its gesture events rather than from the wheel. */
  let gesturing = false;
  let gestureK = 1;
  // Anywhere on the screen, the bar and a tip over the graph too: the page itself never scrolls or zooms here.
  function wheel(event: WheelEvent) {
    event.preventDefault();
    if (!view || gesturing) return;
    grab();
    if (event.ctrlKey || event.metaKey) {
      const box = view.getBoundingClientRect();
      zoomAt(k * Math.exp(-pixels(event, event.deltaY) * 0.01), event.clientX - box.left, event.clientY - box.top);
      stir(true);
    } else {
      nudge(-pixels(event, event.deltaX), -pixels(event, event.deltaY), WHEEL_BAND);
      stir();
    }
    schedule();
  }
  type Gesture = Event & { scale: number; clientX?: number; clientY?: number };
  function gestureStart(event: Event) {
    event.preventDefault();
    gesturing = true;
    grab();
    gestureK = k;
  }
  function gestureChange(event: Event) {
    event.preventDefault();
    // A touch screen's pinch comes as pointers (below).
    if (!view || pointers.size >= 2) return;
    const gesture = event as Gesture;
    const box = view.getBoundingClientRect();
    const a = area();
    zoomAt(gestureK * gesture.scale, gesture.clientX !== undefined ? gesture.clientX - box.left : a.cx, gesture.clientY !== undefined ? gesture.clientY - box.top : a.cy);
    stir(true);
    schedule();
  }
  function gestureEnd(event: Event) {
    event.preventDefault();
    gesturing = false;
  }

  // Dragging with one pointer moves the graph; two pinch. A drag is no click. Let go of while moving, it coasts.
  const pointers = new Map<number, { x: number; y: number }>();
  let travelled = 0;
  /** The view's last few places in a drag, for its speed when let go. */
  let trail: { t: number; tx: number; ty: number }[] = [];
  /** The last tap on the graph outside any unit: a second one soon after, close by, zooms in there. */
  let tapped: { t: number; x: number; y: number } | null = null;
  function down(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    grab();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    trail = [];
    if (pointers.size === 1) travelled = 0;
  }
  function move(event: PointerEvent) {
    const was = pointers.get(event.pointerId);
    if (!was || !view) return;
    const now = { x: event.clientX, y: event.clientY };
    if (pointers.size === 1) {
      travelled += Math.abs(now.x - was.x) + Math.abs(now.y - was.y);
      if (travelled > 4) {
        if (!view.hasPointerCapture(event.pointerId)) view.setPointerCapture(event.pointerId);
        nudge(now.x - was.x, now.y - was.y);
        trail.push({ t: event.timeStamp, tx, ty });
        if (trail.length > 8) trail.shift();
        stir();
        schedule();
      }
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)![1];
      const box = view.getBoundingClientRect();
      const before = Math.hypot(was.x - other.x, was.y - other.y) || 1;
      const after = Math.hypot(now.x - other.x, now.y - other.y) || 1;
      travelled += 10;
      tx += (now.x - was.x) / 2;
      ty += (now.y - was.y) / 2;
      zoomAt(k * (after / before), (now.x + other.x) / 2 - box.left, (now.y + other.y) / 2 - box.top);
      stir(true);
      schedule();
    }
    pointers.set(event.pointerId, now);
  }
  function up(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    const alone = pointers.size === 1;
    pointers.delete(event.pointerId);
    trail = alone ? trail : [];
    if (pointers.size) return;
    const target = event.target as Element | null;
    if (alone && travelled <= 4 && event.type === "pointerup" && view && !target?.closest(".node")) {
      // A double tap (or click) outside any unit zooms in there.
      const box = view.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (tapped && event.timeStamp - tapped.t < 320 && Math.hypot(x - tapped.x, y - tapped.y) < 32) { tapped = null; zoomBy(2, x, y); return; }
      tapped = { t: event.timeStamp, x, y };
    }
    // Let go of while moving: coast on from the speed of the last tenth of a second.
    const recent = trail.filter((p) => event.timeStamp - p.t < 100);
    if (alone && travelled > 4 && event.type === "pointerup" && recent.length >= 2 && !reducedMotion()) {
      const first = recent[0];
      const last = recent.at(-1)!;
      const dt = Math.max(8, last.t - first.t);
      const vx = (last.tx - first.tx) / dt;
      const vy = (last.ty - first.ty) / dt;
      if (event.timeStamp - last.t < 50 && Math.hypot(vx, vy) > 0.3) {
        fling = { vx, vy, last: performance.now() };
        schedule();
        return;
      }
    }
    settle();
  }
  function click(event: MouseEvent) {
    if (travelled > 4) { event.preventDefault(); event.stopPropagation(); }
  }

  /** How far an arrow key moves the view (shift: four times as far). */
  const ARROW = 96;
  const ARROWS: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  function key(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if ((event.target as Element | null)?.closest?.("input, textarea, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return;
    const arrow = ARROWS[event.key];
    if (arrow) {
      event.preventDefault();
      const by = ARROW * (event.shiftKey ? 4 : 1);
      moved = true;
      go(bounded({ k, tx: tx + arrow[0] * by, ty: ty + arrow[1] * by }), true);
    }
    else if (event.key === "+" || event.key === "=") zoomBy(1.25);
    else if (event.key === "-" || event.key === "_") zoomBy(1 / 1.25);
    else if (event.key === "0") home();
  }

  // A unit tapped: its card, and what connects it lit, until it is put away.
  let picked = $state.raw<Picked | null>(null);
  $effect(() => {
    const nodes = graph.nodes;
    untrack(() => { if (picked && !nodes.some((n) => n.key === picked!.key)) picked = null; });
  });

  // Find: a unit by its ID, or the units whose labels hold a word. What it finds stays and rings; the
  // rest falls away; the view glides to take in all of it; Enter (or the arrows) steps from one to the next.
  const lens = useLens();
  let searching = $state(false);
  let query = $state("");
  /** The query once typing pauses. */
  let asked = $state("");
  let typing = 0;
  let file = $state.raw<SearchFile | null>(null);
  let fileFor = "";
  let field = $state<HTMLInputElement>();
  function warm() {
    const id = model.id;
    if (fileFor === id) return;
    fileFor = id;
    loadSearch(id).then((loaded) => { if (fileFor === id) file = loaded; }, () => { if (fileFor === id) fileFor = ""; });
  }
  async function openSearch() {
    warm();
    searching = true;
    await tick();
    field?.focus();
    field?.select();
  }
  function closeSearch() {
    clearTimeout(typing);
    searching = false;
    query = asked = "";
    stepped = -1;
  }
  function typed() {
    clearTimeout(typing);
    typing = window.setTimeout(() => (asked = query), query.trim() ? 160 : 0);
  }
  $effect(() => { if (FOREIGN.test(asked)) void ensureTerms(); });
  const found = $derived(searching && asked.trim() ? find(asked, graph.nodes, { model, index: lens.index, heads: lens.heads, file: file && fileFor === model.id ? file : null, terms: translation.terms }) : null);
  /** What it found, top to bottom and left to right, for stepping through. */
  const hits = $derived.by(() => {
    if (!found) return [];
    return placed.filter((n) => found.has(n.key)).sort((a, b) => a.y - b.y || a.x - b.x);
  });
  /** Which of them Enter last stepped to (-1: none yet); it is lit as if pointed at. */
  let stepped = $state(-1);
  const current = $derived(stepped >= 0 && stepped < hits.length ? hits[stepped].key : null);
  /** Each search rings again; the units wait by how far they are from the middle of the screen. */
  let round = $state(0);
  let wave = $state.raw<Map<string, number> | null>(null);
  let framedFor = "";
  $effect(() => {
    const text = asked.trim();
    const hit = hits;
    untrack(() => {
      if (!text) { wave = null; framedFor = ""; return; }
      if (text === framedFor) return;
      if (!hit.length && !found) return;
      framedFor = text;
      stepped = -1;
      round += 1;
      const a = area();
      const v = shown;
      wave = new Map(placed.map((n) => [n.key, Math.round(Math.min(260, Math.hypot(n.x * v.k + v.tx - a.cx, n.y * v.k + v.ty - a.cy) / 3))]));
      if (hit.length) take(hit);
    });
  });
  /** The view taking in these units, gliding: as close as fits them, never closer than now or HOME. */
  function take(nodes: Placed[]) {
    const a = area();
    const pad = Math.min(48, (a.x1 - a.x0) / 12);
    // Titles keep one size on screen, so how far they reach in the graph depends on the zoom: fit, then fit again at it.
    const span = (z: number) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of nodes) {
        const size = box(n);
        const w = size.w / z;
        const h = size.h / z;
        const g = 3 / z;
        // Where its title is now, or under it.
        const spot = spots.get(n.key) ?? "below";
        const left = spot === "left" ? n.w / 2 + g + w : spot === "right" ? n.w / 2 : Math.max(n.w / 2, w / 2);
        const right = spot === "right" ? n.w / 2 + g + w : spot === "left" ? n.w / 2 : Math.max(n.w / 2, w / 2);
        const up = spot === "above" ? n.h / 2 + g + h : spot === "below" ? n.h / 2 : Math.max(n.h / 2, h / 2);
        const down = spot === "below" ? n.h / 2 + g + h : spot === "above" ? n.h / 2 : Math.max(n.h / 2, h / 2);
        x0 = Math.min(x0, n.x - left); x1 = Math.max(x1, n.x + right);
        y0 = Math.min(y0, n.y - up); y1 = Math.max(y1, n.y + down);
      }
      return { x0, y0, x1, y1 };
    };
    const fit = (b: { x0: number; y0: number; x1: number; y1: number }) => clampK(Math.min((a.x1 - a.x0 - 2 * pad) / Math.max(1, b.x1 - b.x0), (a.y1 - a.y0 - 2 * pad) / Math.max(1, b.y1 - b.y0), Math.max(k, HOME)));
    let z = fit(span(Math.max(k, HOME)));
    z = fit(span(z));
    const b = span(z);
    moved = true;
    go(bounded({ k: z, tx: a.cx - ((b.x0 + b.x1) / 2) * z, ty: a.cy - ((b.y0 + b.y1) / 2) * z }), true);
  }
  function stepTo(by: number) {
    if (!hits.length) return;
    stepped = stepped < 0 ? (by > 0 ? 0 : hits.length - 1) : (stepped + by + hits.length) % hits.length;
    take([hits[stepped]]);
  }
  function searchKey(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      // Typed and not yet asked: ask now.
      if (query !== asked) { clearTimeout(typing); asked = query; return; }
      stepTo(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query) { query = asked = ""; stepped = -1; } else closeSearch();
    }
  }
  const count = $derived(!asked.trim() ? "" : !found ? "" : found.size === 0 ? "None here" : stepped >= 0 ? `${stepped + 1} of ${found.size}` : `${found.size} found`);

  // The page's own "/" search sits under this: here "/" and ⌘/ctrl-F find in the graph instead.
  function findKey(event: KeyboardEvent) {
    const typingElsewhere = (event.target as Element | null)?.closest?.("input, textarea, [contenteditable]");
    if ((event.key === "/" && !typingElsewhere && !event.metaKey && !event.ctrlKey && !event.altKey) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f")) {
      event.preventDefault();
      event.stopPropagation();
      void openSearch();
    }
  }

  // Fit to what the screen shows: a pinch-zoomed page or a phone's keyboard leaves less than the window,
  // and the bar must stay whole in it.
  let shownBox = $state.raw<{ left: number; top: number; width: number; height: number } | null>(null);

  let dialog = $state<HTMLElement>();
  onMount(() => {
    const viewport = window.visualViewport;
    const fit = () => { if (viewport) shownBox = { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }; };
    fit();
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    window.addEventListener("keydown", findKey, { capture: true });
    window.addEventListener("wheel", wheel, { passive: false, capture: true });
    for (const [name, handler] of [["gesturestart", gestureStart], ["gesturechange", gestureChange], ["gestureend", gestureEnd]] as const) document.addEventListener(name, handler, { passive: false });
    if (centred === null && graph.nodes.some((n) => n.side === "focus")) {
      centre(false, true);
      centred = graph.nodes.find((n) => n.side === "focus")!.key;
    }
    const page = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog?.focus();
    return () => {
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      window.removeEventListener("keydown", findKey, { capture: true });
      clearTimeout(typing);
      window.removeEventListener("wheel", wheel, { capture: true });
      for (const [name, handler] of [["gesturestart", gestureStart], ["gesturechange", gestureChange], ["gestureend", gestureEnd]] as const) document.removeEventListener(name, handler);
      document.documentElement.style.overflow = page;
      cancelAnimationFrame(frame);
      clearTimeout(resting);
      clearTimeout(still);
    };
  });

  // Layer numbers down the left, every layer once there's room for each, and each band's name where it starts.
  const every = $derived(2 * pitch * shown.k >= 18 ? 1 : 2 * pitch * shown.k >= 7 ? 5 : 10);
  const ticks = $derived(Array.from({ length: model.layers }, (_, layer) => layer).filter((layer) => layer % every === 0));
</script>

<svelte:window onkeydown={key} />

<div class="navigator" role="dialog" aria-modal="true" aria-label={`Connections of ${name}`} tabindex="-1" bind:this={dialog}
  style:left={shownBox ? `${shownBox.left}px` : undefined} style:top={shownBox ? `${shownBox.top}px` : undefined}
  style:width={shownBox ? `${shownBox.width}px` : undefined} style:height={shownBox ? `${shownBox.height}px` : undefined}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="view" class:moving bind:this={view} bind:clientWidth={viewWidth} bind:clientHeight={viewHeight} onpointerdowncapture={down} onpointermove={move} onpointerup={up} onpointercancel={up} onclickcapture={click}>
    <div class="pan" style:transform={`translate(${shown.tx - base.tx}px, ${shown.ty - base.ty}px)`}>
      <canvas class="links" bind:this={links} aria-hidden="true"></canvas>
      <div class="canvas" style:transform={`translate(${base.tx}px, ${base.ty}px) scale(${base.k})`}>
        <Graph {graph} {model} {mode} {href} hovered={picked?.key ?? current ?? hovered} point={pointHere} {height} {open} labels={spots} {labelScale} axis={false} onlaid={laid} onpick={(next) => (picked = next)} {found} {wave} {round} {surface} />
      </div>
    </div>
    <div class="axis" aria-hidden="true">
      <!-- A pan moves the whole rule at once; only a zoom spaces it again. -->
      <div class="rule" style:transform={`translateY(${shown.ty}px)`}>
        {#each model.bands as band (band.key)}
          <span class="band" style:top={`${depth.heads(band.first) * shown.k}px`} style:height={`${(depth.neurons(band.last) - depth.heads(band.first)) * shown.k}px`}><b>{band.short}</b></span>
        {/each}
        {#each ticks as layer (layer)}<span class="tick" style:top={`${depth.neurons(layer) * shown.k}px`}>{layer}</span>{/each}
      </div>
    </div>
  </div>

  <header class="bar" class:searching bind:this={bar} bind:clientHeight={barHeight}>
    <div class="top">
      <div class="who">
        <span class="name meta">{name}</span>
        {#if title}<span class="title"><LabelText text={title} /></span>{/if}
      </div>
      <div class="tools">
        {#if modes.length > 1}<Segmented options={modes} value={mode} onchange={onmode} label="Which connections" />{/if}
        <div class="reach" class:off={mode === "with"} inert={mode === "with"}><Tabs options={reaches} value={reach} onchange={(value: string) => onreach(value as Reach)} label="How far" /></div>
        <div class="zoom">
          <span class="step"><IconButton icon="minus" label="Zoom out" onclick={() => zoomBy(1 / 1.25)} /></span>
          <IconButton icon="focus" label={`Back to ${name}`} onclick={home} />
          <span class="step"><IconButton icon="plus" label="Zoom in" onclick={() => zoomBy(1.25)} /></span>
          <IconButton icon="search" label="Find in the graph" pressed={searching} onclick={() => (searching ? closeSearch() : openSearch())} />
        </div>
      </div>
      <span class="close"><IconButton icon="close" label="Close" onclick={close} /></span>
    </div>
    {#if searching}
      <div class="find" role="search" transition:expand>
        <label class="field">
          <span class="glass" aria-hidden="true"><Icon name="search" size={18} /></span>
          <input
            bind:this={field}
            bind:value={query}
            oninput={typed}
            onkeydown={searchKey}
            onfocus={warm}
            type="search"
            placeholder="A unit, or a word in its labels"
            aria-label="Find in the graph"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
          />
          <span class="count meta" aria-live="polite"><MorphText text={count} /></span>
        </label>
        <div class="steps">
          <IconButton icon="up" label="Previous found" disabled={!hits.length} onclick={() => stepTo(-1)} />
          <IconButton icon="down" label="Next found" disabled={!hits.length} onclick={() => stepTo(1)} />
          <IconButton icon="close" label="Stop finding" onclick={closeSearch} />
        </div>
      </div>
    {/if}
  </header>
  {#if picked}<Card {picked} close={() => (picked = null)} />{/if}
  <p class="credit meta"><span class="where">Neuron Lens · {model.name} · </span>Labels by Claude Haiku 5.5</p>
</div>

<style>
  /* Nothing here scrolls or zooms the page, by touch either: a pinch on the bar is no zoom of the page. */
  .navigator { position: fixed; inset: 0; z-index: 20; overflow: hidden; background: var(--paper); outline: none; touch-action: none; overscroll-behavior: contain; }
  .view { position: absolute; inset: 0; overflow: hidden; cursor: grab; touch-action: none; overscroll-behavior: contain; }
  .view:active { cursor: grabbing; }
  /* What moves every frame of a pan has a layer of its own and moves by a translation alone (the marks and links together,
     the axis's rule), so moving it is the compositor's work and never makes the hundreds of marks and titles be painted or
     layered again. The layer is never scaled, so it is never drawn from a stale picture: a zoom scales what is inside it. */
  .pan { position: absolute; inset: 0; will-change: transform; }
  .links { position: absolute; top: 0; left: 0; pointer-events: none; }
  .canvas { position: absolute; top: 0; left: 0; width: 100%; transform-origin: 0 0; }
  .axis { position: absolute; top: 0; bottom: 0; left: 0; width: 64px; overflow: hidden; background: color-mix(in oklch, var(--paper) 92%, transparent); pointer-events: none; }
  .rule { position: absolute; inset: 0; will-change: transform; }
  /* Off on the one layer, inherited by every mark, rather than set on each. */
  .moving .pan { pointer-events: none; }
  .band { position: absolute; left: 0; width: 6px; border-radius: 0 3px 3px 0; background: var(--wash); }
  .band b { position: absolute; top: 0; left: 12px; color: var(--ink3); font: var(--type-head); white-space: nowrap; writing-mode: vertical-rl; }
  .tick {
    position: absolute;
    left: 34px;
    width: 22px;
    color: var(--ink3);
    font: var(--type-meta);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    text-align: end;
    translate: 0 -50%;
  }
  .bar {
    position: absolute;
    touch-action: pan-x;
    top: 0;
    left: 0;
    right: 0;
    display: grid;
    gap: var(--s2);
    padding: var(--s3) var(--s4);
    background: color-mix(in oklch, var(--paper) 92%, transparent);
  }
  /* One row where it fits: who, the tools, close. Narrower, close stays at the top right beside the name and the
     tools take a row of their own under it. */
  .top { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; grid-template-areas: "who tools close"; align-items: center; gap: var(--s2) var(--s4); }
  .who { grid-area: who; display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s3); min-width: 0; }
  .name { color: var(--ink2); }
  .title { font: var(--type-label); }
  .tools { grid-area: tools; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--s2) var(--s4); min-width: 0; }
  .close { grid-area: close; }
  .zoom { display: flex; gap: var(--s1); }
  .reach { transition: opacity var(--fast) var(--ease); }
  .reach.off { opacity: 0; }
  @media (max-width: 1180px) {
    .top { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "who close" "tools tools"; }
    .tools { justify-content: space-between; }
  }
  .find { display: flex; align-items: center; gap: var(--s2); min-width: 0; }
  .field {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: var(--s2);
    min-width: 0;
    max-width: 560px;
    height: 40px;
    padding: 0 var(--s3);
    border-radius: var(--r-pill);
    background: var(--wash);
    cursor: text;
  }
  .glass { display: grid; color: var(--ink3); }
  /* 16 px, so a phone doesn't zoom the page to it on focus. */
  .field input { flex: 1 1 auto; min-width: 0; height: 100%; padding: 0; border: 0; outline: none; background: none; color: var(--ink); font: var(--type-body); }
  .field input::placeholder { color: var(--ink3); }
  .field input::-webkit-search-cancel-button, .field input::-webkit-search-decoration { appearance: none; }
  .field:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
  .count { flex: none; color: var(--ink2); font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .steps { display: flex; gap: var(--s1); flex: none; }
  .credit { position: absolute; right: var(--s4); bottom: var(--s3); padding: 1px 5px; border-radius: var(--r-chip); background: color-mix(in oklch, var(--paper) 84%, transparent); font-weight: 400; pointer-events: none; }
  /* A phone pinches: the zoom's steps go, Back and Find stay. Finding, the search takes the tools' row, and the
     credit keeps only the labeller's. */
  @media (max-width: 600px) {
    .step { display: none; }
    .bar { padding: var(--s2) var(--s3); }
    .tools { gap: var(--s2) var(--s3); }
    .searching .tools { display: none; }
    .searching .top { grid-template-areas: "who close"; }
    .where { display: none; }
  }
</style>

// The graph's links, drawn on one canvas rather than as an SVG path each. A graph shows up to ~1,400 of
// them, and every frame of its motion moves all of them: as elements, each frame restyled, laid out and
// repainted every one, which held a slow machine to a few frames a second. On a canvas a frame is one
// pass of strokes. The stage (stage.ts) owns where each link is and how it looks at any moment; this only
// draws them, in the page's own colours, at the device's resolution, under the view it is given (the
// navigator's pan and zoom; the rail's is fixed).

/** How one link looks this frame: its ends and bend, and its stroke. */
export interface Stroke {
  x1: number; y1: number; x2: number; y2: number; bend: number;
  width: number;
  /** 0–1, how much of it is shown. */
  alpha: number;
  color: string;
  /** The colour it is leaving, and how far it has gone from it (0–1). */
  was: string | null;
  blend: number;
  against: boolean;
  /** 0–1, how much of it is drawn, upstream end first. */
  drawn: number;
}

/** How far past the screen the navigator's canvas draws, in CSS pixels: a pan within it moves what is drawn, and only past it draws again. */
export const OVERSCAN = 256;

/** The view: graph coordinates x, y land at x · k + tx, y · k + ty on the canvas, in CSS pixels. */
export interface View { k: number; tx: number; ty: number }
/** A title's glass: its box and corner radius in graph coordinates, and how visible the title is (0–1). */
export interface Frost { x: number; y: number; w: number; h: number; r: number; alpha: number }
/** A mark, centred at x, y, as the glass sees it behind a title. */
export interface Mark { x: number; y: number; w: number; h: number; alpha: number; color: string }

/** The glass: Ledger's tip, `paper` at 72% over what is behind it, blurred 20 px and saturated 1.6. A browser
 * blurs a backdrop within the element's own box, so what is behind a title fades to a haze of its own colours
 * there. The same here: what is behind each title, saturated, averaged down to a sample about every SAMPLE px
 * across its box and smoothed back up over it, taken from a copy at a quarter of the canvas's resolution. */
const GLASS = 0.72;
const SATURATE = 1.6;
const SAMPLE = 16;
const QUARTER = 0.25;
/** The haze canvas's width: wide enough for every title's cell in a few rows, and for the GPU to keep it. */
const ATLAS = 1024;

/** About how long a link is, for drawing part of it. */
function length(s: Stroke) {
  let total = 0;
  let px = s.x1;
  let py = s.y1;
  for (let i = 1; i <= 8; i += 1) {
    const t = i / 8;
    const u = 1 - t;
    // The cubic from (x1, y1) through (x1, y1 + bend) and (x2, y2 − bend) to (x2, y2).
    const x = u * u * u * s.x1 + 3 * u * u * t * s.x1 + 3 * u * t * t * s.x2 + t * t * t * s.x2;
    const y = u * u * u * s.y1 + 3 * u * u * t * (s.y1 + s.bend) + 3 * u * t * t * (s.y2 - s.bend) + t * t * t * s.y2;
    total += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return total;
}

export class Ink {
  private ctx: CanvasRenderingContext2D | null;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private view: View = { k: 1, tx: 0, ty: 0 };
  /** A colour, as the page resolves it (canvas takes no custom properties), for as long as the theme holds. */
  private colors = new Map<string, string>();
  private probe: HTMLElement;
  private watch: MutationObserver;
  private dark: MediaQueryList | null;
  private changed: () => void;

  /** `restyle`: the page's colours changed (a theme switch), so whatever was resolved must be again. `pad`:
   * how far past its box on each side it draws, so a pan can move what is drawn rather than draw it again. */
  constructor(private canvas: HTMLCanvasElement, private restyle: () => void, private pad = 0) {
    this.ctx = canvas.getContext("2d");
    // Outside the markup Svelte keeps, under the root that holds the colour tokens.
    this.probe = document.createElement("span");
    this.probe.style.display = "none";
    this.probe.setAttribute("aria-hidden", "true");
    document.body.append(this.probe);
    this.changed = () => { this.colors.clear(); this.restyle(); };
    this.watch = new MutationObserver(this.changed);
    this.watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    this.dark = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    this.dark?.addEventListener("change", this.changed);
  }

  destroy() {
    this.watch.disconnect();
    this.dark?.removeEventListener("change", this.changed);
    this.probe.remove();
  }

  /** Ledger's chip radius, in CSS pixels. */
  chip() {
    return parseFloat(this.color("var(--r-chip)", "--r-chip")) || 6;
  }

  /** A CSS colour (custom properties, color-mix and all) as one the canvas can take. */
  color(css: string, property?: string): string {
    let found = this.colors.get(css);
    if (found === undefined) {
      if (property) found = getComputedStyle(this.probe).getPropertyValue(property).trim();
      else {
        this.probe.style.color = "";
        this.probe.style.color = css;
        found = getComputedStyle(this.probe).color || "#888";
      }
      this.colors.set(css, found);
    }
    return found;
  }

  /** Its size on the page in CSS pixels; the backing store follows the device's pixel ratio. */
  resize(width: number, height: number) {
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    if (width === this.width && height === this.height && ratio === this.ratio) return false;
    this.width = width;
    this.height = height;
    this.ratio = ratio;
    const { pad, canvas } = this;
    canvas.width = Math.max(1, Math.round((width + 2 * pad) * ratio));
    canvas.height = Math.max(1, Math.round((height + 2 * pad) * ratio));
    canvas.style.width = `${width + 2 * pad}px`;
    canvas.style.height = `${height + 2 * pad}px`;
    if (pad) { canvas.style.left = `${-pad}px`; canvas.style.top = `${-pad}px`; }
    return true;
  }

  setView(view: View) {
    this.view = view;
  }

  draw(strokes: Iterable<Stroke>, frosts?: Iterable<Frost>, marks?: Iterable<Mark>) {
    const { ctx, view, ratio, pad } = this;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(ratio * view.k, 0, 0, ratio * view.k, ratio * (view.tx + pad), ratio * (view.ty + pad));
    ctx.lineCap = "round";
    // What part of the graph is on the canvas, so a link wholly off it costs nothing (the navigator, zoomed in).
    const left = -(view.tx + pad) / view.k - 8;
    const top = -(view.ty + pad) / view.k - 8;
    const right = left + (this.width + 2 * pad) / view.k + 16;
    const bottom = top + (this.height + 2 * pad) / view.k + 16;
    /** The dash set on the context: none, the dashes of a link that pushes against, or a part drawn. */
    let dash: "" | "against" | "part" = "";
    for (const s of strokes) {
      if (s.alpha <= 0.002 || s.width <= 0) continue;
      if (Math.max(s.x1, s.x2) < left || Math.min(s.x1, s.x2) > right || Math.max(s.y1, s.y2) < top || Math.min(s.y1, s.y2) > bottom) continue;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.bezierCurveTo(s.x1, s.y1 + s.bend, s.x2, s.y2 - s.bend, s.x2, s.y2);
      ctx.lineWidth = s.width;
      if (s.against) { if (dash !== "against") { ctx.setLineDash([3, 3]); dash = "against"; } }
      else if (s.drawn < 1) { const long = length(s); ctx.setLineDash([long * s.drawn, long + 1]); dash = "part"; }
      else if (dash) { ctx.setLineDash([]); dash = ""; }
      // A colour on its way to another is the two laid over each other, the old fading as the new comes up.
      if (s.was && s.blend < 1) {
        ctx.globalAlpha = s.alpha * (1 - s.blend);
        ctx.strokeStyle = s.was;
        ctx.stroke();
        ctx.globalAlpha = s.alpha * s.blend;
      } else ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.color;
      ctx.stroke();
    }
    if (dash) ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (frosts) this.frost(frosts, marks ?? []);
  }

  // The offscreen canvases the glass is made in: what is behind it, small; that saturated; every title's haze,
  // packed side by side on one canvas large enough that the browser keeps it on the GPU, so making the glass never
  // reads a canvas back from the GPU (a small one is kept in memory, and each title's haze then cost a round trip).
  private behind: HTMLCanvasElement | null = null;
  private vivid: HTMLCanvasElement | null = null;
  private haze: HTMLCanvasElement | null = null;
  private clear = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-transparency: reduce)") : null;

  /** Each title's glass, over the links and under its words: what is behind it as a haze, then paper over that.
   * Where transparency is turned down the paper is solid, as the tip's is. */
  private frost(frosts: Iterable<Frost>, marks: Iterable<Mark>) {
    const { ctx, canvas, view, ratio, pad } = this;
    if (!ctx) return;
    const shown = [...frosts].filter((f) => f.alpha > 0.002);
    if (!shown.length) return;
    const paper = this.color("var(--paper)");
    const toView = () => ctx.setTransform(ratio * view.k, 0, 0, ratio * view.k, ratio * (view.tx + pad), ratio * (view.ty + pad));
    const source = this.clear?.matches ? null : this.backdrop(marks);

    // Where each title's box is on the canvas, in device pixels, and its cell of the haze: a sample about every
    // SAMPLE px across it, with a sample's border of what is just outside, so smoothing it up stays within the cell.
    interface Cell { f: Frost; x: number; y: number; w: number; h: number; nx: number; ny: number; cx: number; cy: number }
    const cells: Cell[] = [];
    let cx = 0;
    let cy = 0;
    let row = 0;
    for (const f of shown) {
      const x = Math.max(0, Math.floor(ratio * (f.x * view.k + view.tx + pad)));
      const y = Math.max(0, Math.floor(ratio * (f.y * view.k + view.ty + pad)));
      const w = Math.min(canvas.width - x, Math.ceil(ratio * f.w * view.k));
      const h = Math.min(canvas.height - y, Math.ceil(ratio * f.h * view.k));
      const nx = Math.max(1, Math.round(w / ratio / SAMPLE));
      const ny = Math.max(1, Math.round(h / ratio / SAMPLE));
      if (cx + nx + 2 > ATLAS) { cx = 0; cy += row; row = 0; }
      cells.push({ f, x, y, w, h, nx, ny, cx: cx + 1, cy: cy + 1 });
      cx += nx + 2;
      row = Math.max(row, ny + 2);
    }
    let atlas: CanvasRenderingContext2D | null = null;
    if (source) {
      this.haze ??= document.createElement("canvas");
      const height = Math.max(ATLAS / 2, cy + row);
      if (this.haze.width !== ATLAS || this.haze.height < height) { this.haze.width = ATLAS; this.haze.height = height; }
      atlas = this.haze.getContext("2d");
      if (atlas) {
        atlas.setTransform(1, 0, 0, 1, 0, 0);
        atlas.clearRect(0, 0, ATLAS, cy + row);
        atlas.imageSmoothingQuality = "high";
        for (const c of cells) {
          if (c.w <= 0 || c.h <= 0) continue;
          const sx = c.w / c.nx;
          const sy = c.h / c.ny;
          atlas.drawImage(source, (c.x - sx) * QUARTER, (c.y - sy) * QUARTER, (c.w + 2 * sx) * QUARTER, (c.h + 2 * sy) * QUARTER, c.cx - 1, c.cy - 1, c.nx + 2, c.ny + 2);
        }
      }
    }

    ctx.imageSmoothingQuality = "high";
    for (const c of cells) {
      toView();
      ctx.beginPath();
      ctx.roundRect(c.f.x, c.f.y, c.f.w, c.f.h, c.f.r);
      if (atlas && c.w > 0 && c.h > 0) {
        // The haze in place of what was sharp behind it: cleared, then laid, as visible as the title.
        ctx.save();
        ctx.clip();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = c.f.alpha;
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(this.haze!, c.cx, c.cy, c.nx, c.ny, c.x, c.y, c.w, c.h);
        ctx.restore();
        toView();
      }
      ctx.globalAlpha = c.f.alpha * (atlas ? GLASS : 1);
      ctx.fillStyle = paper;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** What is behind the glass, a quarter the size and saturated: the links as drawn, and the marks. */
  private backdrop(marks: Iterable<Mark>): HTMLCanvasElement | null {
    const { canvas, view, ratio, pad } = this;
    const width = Math.max(1, Math.ceil(canvas.width * QUARTER));
    const height = Math.max(1, Math.ceil(canvas.height * QUARTER));
    this.behind ??= document.createElement("canvas");
    this.vivid ??= document.createElement("canvas");
    const behind = this.behind.getContext("2d");
    const vivid = this.vivid.getContext("2d");
    if (!behind || !vivid) return null;
    for (const c of [this.behind, this.vivid]) if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
    behind.setTransform(1, 0, 0, 1, 0, 0);
    behind.clearRect(0, 0, width, height);
    behind.imageSmoothingQuality = "high";
    behind.drawImage(canvas, 0, 0, width, height);
    const scale = ratio * view.k * QUARTER;
    behind.setTransform(scale, 0, 0, scale, ratio * (view.tx + pad) * QUARTER, ratio * (view.ty + pad) * QUARTER);
    for (const m of marks) {
      if (!m.color) continue;
      behind.globalAlpha = m.alpha;
      behind.fillStyle = this.color(m.color);
      behind.beginPath();
      behind.roundRect(m.x - m.w / 2, m.y - m.h / 2, m.w, m.h, Math.min(m.w, m.h) / 2);
      behind.fill();
    }
    behind.globalAlpha = 1;
    // Saturated where the canvas can filter; as it is where it can't (Safari before 18).
    if (!("filter" in vivid)) return this.behind;
    vivid.setTransform(1, 0, 0, 1, 0, 0);
    vivid.clearRect(0, 0, width, height);
    vivid.filter = `saturate(${SATURATE})`;
    vivid.drawImage(this.behind, 0, 0);
    vivid.filter = "none";
    return this.vivid;
  }
}

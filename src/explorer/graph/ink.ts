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

/** The view: graph coordinates x, y land at x · k + tx, y · k + ty on the canvas, in CSS pixels. */
export interface View { k: number; tx: number; ty: number }

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
  /** The view last drawn under, which a pan slides the drawing from until it runs past the overscan. */
  private drawn: View | null = null;
  /** A colour, as the page resolves it (canvas takes no custom properties), for as long as the theme holds. */
  private colors = new Map<string, string>();
  private probe: HTMLElement;
  private watch: MutationObserver;
  private dark: MediaQueryList | null;
  private changed: () => void;

  /** `restyle`: the page's colours changed (a theme switch), so whatever was resolved must be again. `pad`:
   * how far past its box on each side it draws, so a pan can slide the drawing rather than draw it again. */
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

  /** A CSS colour (custom properties, color-mix and all) as one the canvas can take. */
  color(css: string): string {
    let found = this.colors.get(css);
    if (found === undefined) {
      this.probe.style.color = "";
      this.probe.style.color = css;
      found = getComputedStyle(this.probe).color || "#888";
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
    this.drawn = null;
    return true;
  }

  setView(view: View) {
    this.view = view;
  }

  /** Move to a view by sliding what is drawn, if the view only panned and not past the overscan: true if that did. */
  slide(view: View) {
    this.view = view;
    const { drawn, pad } = this;
    if (!drawn || !pad || drawn.k !== view.k) return false;
    const dx = view.tx - drawn.tx;
    const dy = view.ty - drawn.ty;
    if (Math.abs(dx) > pad || Math.abs(dy) > pad) return false;
    this.canvas.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : "";
    return true;
  }

  draw(strokes: Iterable<Stroke>) {
    const { ctx, view, ratio, pad } = this;
    if (!ctx) return;
    this.drawn = view;
    if (this.canvas.style.transform) this.canvas.style.transform = "";
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
  }
}

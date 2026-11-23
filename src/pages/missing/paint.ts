// The missing page's canvases: a canvas kept at its laid-out size on the device's pixels, and CSS colours (custom
// properties, color-mix and all) resolved to RGB, resolved again when the theme changes.

/** Calls draw() whenever the canvas's size, or the theme, changes; `sized` hears the new size first. */
export function surface(canvas: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, sized?: (w: number, h: number) => void) {
  const ctx = canvas.getContext("2d")!;
  const at = { w: 0, h: 0, ratio: 1 };
  const paint = () => {
    if (!at.w) return;
    ctx.setTransform(at.ratio, 0, 0, at.ratio, 0, 0);
    ctx.clearRect(0, 0, at.w, at.h);
    draw(ctx, at.w, at.h);
  };
  const size = () => {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (!box.width || (Math.abs(box.width - at.w) < 0.5 && Math.abs(box.height - at.h) < 0.5 && ratio === at.ratio)) return;
    Object.assign(at, { w: box.width, h: box.height, ratio });
    canvas.width = Math.round(at.w * ratio);
    canvas.height = Math.round(at.h * ratio);
    sized?.(at.w, at.h);
    paint();
  };
  const watch = new ResizeObserver(size);
  watch.observe(canvas);
  size();
  return { at, paint, destroy: () => watch.disconnect() };
}

/** Colours as the page resolves them, for a canvas; `changed` runs when the theme changes them. */
export function palette(changed: () => void) {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.setAttribute("aria-hidden", "true");
  document.body.append(probe);
  const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const held = new Map<string, [number, number, number]>();
  const restyle = () => { held.clear(); changed(); };
  const watch = new MutationObserver(restyle);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  const dark = matchMedia("(prefers-color-scheme: dark)");
  dark.addEventListener("change", restyle);
  /** A colour as [r, g, b]: whatever the browser computes it to, painted on a pixel and read back. */
  function rgb(css: string): [number, number, number] {
    let found = held.get(css);
    if (!found) {
      probe.style.color = "";
      probe.style.color = css;
      pixel.clearRect(0, 0, 1, 1);
      pixel.fillStyle = "#000";
      pixel.fillStyle = getComputedStyle(probe).color;
      pixel.fillRect(0, 0, 1, 1);
      const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data;
      found = [r, g, b];
      held.set(css, found);
    }
    return found;
  }
  return {
    rgb,
    css: (value: string, alpha = 1) => { const [r, g, b] = rgb(value); return `rgb(${r} ${g} ${b} / ${alpha})`; },
    destroy() { watch.disconnect(); dark.removeEventListener("change", restyle); probe.remove(); },
  };
}

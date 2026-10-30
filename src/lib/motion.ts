// The site's motion, in one place. One curve, cubic-bezier(.2, 0, 0, 1), for everything. Hover and
// press take 120 ms; a selection glides to its new place in 240 ms; content leaves in 120 ms and
// arrives in 200 ms with a 6 px rise; lists reveal 24 ms apart, 160 ms at most. Nothing loops.
import type { TransitionConfig } from "svelte/transition";

export const FAST = 120;
export const GLIDE = 240;
export const OUT = 120;
export const IN = 200;

/** CSS cubic-bezier(x1, y1, x2, y2) as an easing function, for Svelte transitions. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const x = (t: number) => ((ax * t + bx) * t + cx) * t;
  const y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (progress: number) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let t = progress;
    for (let i = 0; i < 6; i += 1) {
      const slope = dx(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= (x(t) - progress) / slope;
    }
    // Newton can stray where the curve is flat: settle by bisection.
    if (!(t >= 0 && t <= 1) || Math.abs(x(t) - progress) > 1e-4) {
      let lo = 0, hi = 1;
      t = progress;
      for (let i = 0; i < 24; i += 1) {
        if (x(t) < progress) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return y(t);
  };
}

export const ease = bezier(0.2, 0, 0, 1);

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The delay for the i-th item of a list that reveals in sequence. */
export const stagger = (i: number) => Math.min(i * 24, 160);

/** Arriving: fade in and rise 6 px (or fall, with a negative y). */
export function rise(_node: Element, { delay = 0, duration = IN, y = 6 }: { delay?: number; duration?: number; y?: number } = {}): TransitionConfig {
  if (reducedMotion()) return { duration: FAST, css: (t) => `opacity: ${t}` };
  return { delay, duration, easing: ease, css: (t, u) => `opacity: ${t}; transform: translateY(${u * y}px)` };
}

/** Leaving: a quick fade. */
export function fadeOut(_node: Element, { duration = OUT }: { duration?: number } = {}): TransitionConfig {
  return { duration: reducedMotion() ? 0 : duration, easing: ease, css: (t) => `opacity: ${t}` };
}

/** Opening or closing in place: height and opacity together. */
export function expand(node: Element, { duration = GLIDE }: { duration?: number } = {}): TransitionConfig {
  const height = (node as HTMLElement).offsetHeight;
  if (reducedMotion()) return { duration: FAST, css: (t) => `opacity: ${t}` };
  return { duration, easing: ease, css: (t) => `overflow: hidden; height: ${t * height}px; opacity: ${t}` };
}

/**
 * A selection that glides. Put it on a container whose selected child carries aria-pressed,
 * aria-selected or aria-current="true" (or matches `selector`); a thumb (span.glide-thumb, styled by
 * the container) slides under that child whenever the selection or the layout changes. The first
 * placement doesn't animate, so the thumb never flies in from the corner.
 */
export function glide(node: HTMLElement, selector = "[aria-pressed='true'], [aria-selected='true'], [aria-current='true'], [aria-current='page']") {
  const thumb = document.createElement("span");
  thumb.className = "glide-thumb";
  thumb.setAttribute("aria-hidden", "true");
  node.classList.add("glide-host");
  node.prepend(thumb);
  let placed = false;
  let frame = 0;

  function place() {
    frame = 0;
    const target = [...node.querySelectorAll<HTMLElement>(selector)].find((element) => element !== thumb && element.isConnected && !element.closest("[inert]"));
    if (!target || target.offsetParent === null) {
      thumb.style.opacity = "0";
      placed = false;
      return;
    }
    const box = target.getBoundingClientRect();
    const origin = node.getBoundingClientRect();
    const x = box.left - origin.left - node.clientLeft + node.scrollLeft;
    const y = box.top - origin.top - node.clientTop + node.scrollTop;
    const instant = !placed || reducedMotion();
    if (instant) thumb.style.transition = "none";
    thumb.style.width = `${box.width}px`;
    thumb.style.height = `${box.height}px`;
    thumb.style.transform = `translate(${x}px, ${y}px)`;
    thumb.style.opacity = "1";
    if (instant) {
      void thumb.offsetWidth;
      thumb.style.transition = "";
    }
    placed = true;
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(place); };

  const mutations = new MutationObserver(queue);
  mutations.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected", "aria-current", "class"] });
  const resize = new ResizeObserver(queue);
  resize.observe(node);
  void document.fonts?.ready.then(queue);
  place();

  return {
    update(next?: string) { if (next) selector = next; queue(); },
    destroy() {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      thumb.remove();
      node.classList.remove("glide-host");
    },
  };
}

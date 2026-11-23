// The unit and its connections side by side (Explorer.svelte's panes, from 736 px of explorer): each column scrolls on
// its own, as a mail app's list and message do, and the page around them scrolls as any page. A scroll that starts over
// a column while the columns are only partly on screen moves the page first, until they fill it; only then does it
// scroll within the column, and a column at its end hands the scroll back to the page. The page also settles onto the
// columns when a scroll ends near them (CSS scroll snapping, for touch, where a scroll can't be redirected), and onto
// its foot near the end, so the footer stays in reach.

/** Whether the panes stand side by side, each column scrolling on its own. */
export const split = (panes: Element | null = document.getElementById("layer")) => panes?.classList.contains("split") ?? false;

/** The column, side by side, that scrolls on its own: the unit's or the connections'; null when the page scrolls them. */
export function scroller(column: HTMLElement | null): HTMLElement | null {
  return column && split(column.parentElement) ? column : null;
}

/** Brings the panes to the top of the screen, where they fill it. */
export function align(panes: HTMLElement, smooth: boolean) {
  const margin = parseFloat(getComputedStyle(panes).scrollMarginTop) || 0;
  const top = panes.getBoundingClientRect().top - margin;
  if (Math.abs(top) > 1) window.scrollTo({ top: window.scrollY + top, behavior: smooth ? "smooth" : "auto" });
}

export function panes(node: HTMLElement) {
  // Side by side is decided by the explorer's width (a container query): read it from where the two columns stand.
  const mark = () => {
    const [a, b] = [...node.children] as HTMLElement[];
    const beside = !!a && !!b && Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) < 1 && a.offsetLeft !== b.offsetLeft;
    node.classList.toggle("split", beside);
  };
  const resized = new ResizeObserver(mark);
  resized.observe(node);
  mark();

  // A wheel or trackpad scroll over a column while the panes are not at the top: move the page to them first.
  const wheel = (event: WheelEvent) => {
    if (!split(node) || event.ctrlKey || !event.deltaY) return;
    const margin = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
    const off = node.getBoundingClientRect().top - margin;
    const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if ((dy > 0 && off > 0.5) || (dy < 0 && off < -0.5)) {
      event.preventDefault();
      window.scrollBy({ top: dy > 0 ? Math.min(dy, off) : Math.max(dy, off), behavior: "auto" });
    }
  };
  node.addEventListener("wheel", wheel, { passive: false });
  return {
    destroy() {
      resized.disconnect();
      node.removeEventListener("wheel", wheel);
    },
  };
}

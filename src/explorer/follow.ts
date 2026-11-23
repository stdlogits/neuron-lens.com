// A column beside a taller one keeps in view as the page scrolls, so the space beside the taller one is never blank:
// it scrolls with the page until its bottom reaches the screen's foot and stays there, and scrolling back up it moves
// with the page again until its top reaches the screen's head, where it stays, so its top is back after a short
// scroll however tall it is. One CSS variable, --follow, is the `top` of the column's `position: sticky` (set where
// the column stands beside the other); this sets it once a frame from how far the page has moved.

export function follow(node: HTMLElement, gap = 24) {
  let top = gap;
  let last = window.scrollY;
  let edge = node.getBoundingClientRect().top;
  let frame = 0;

  const update = () => {
    frame = 0;
    const y = window.scrollY;
    const moved = y - last;
    last = y;
    // Stacked under the other column (the full width of the row), it doesn't follow.
    const parent = node.parentElement;
    if (!parent || node.offsetWidth >= parent.clientWidth - 1) {
      node.style.removeProperty("--follow");
      top = gap;
      edge = node.getBoundingClientRect().top;
      return;
    }
    // As far up as it may go: its bottom at the screen's foot (or its top at the head, if it fits on the screen).
    const highest = Math.min(gap, window.innerHeight - node.offsetHeight - gap);
    top = Math.max(highest, Math.min(gap, edge - moved));
    node.style.setProperty("--follow", `${top}px`);
    edge = node.getBoundingClientRect().top;
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
  const resized = new ResizeObserver(queue);
  resized.observe(node);
  if (node.parentElement) resized.observe(node.parentElement);
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
  queue();
  return {
    destroy() {
      cancelAnimationFrame(frame);
      resized.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      node.style.removeProperty("--follow");
    },
  };
}

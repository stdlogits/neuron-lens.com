/** Keeps a box as tall as its one child, gliding, so what sits under it slides rather than jumps when the child's content changes. */
export function fit(node: HTMLElement) {
  const child = node.firstElementChild as HTMLElement;
  let placed = false;
  const observer = new ResizeObserver(() => {
    if (!placed) node.style.transition = "none";
    node.style.height = `${child.offsetHeight}px`;
    if (!placed) {
      void node.offsetHeight;
      node.style.transition = "";
      placed = true;
    }
  });
  observer.observe(child);
  return { destroy: () => observer.disconnect() };
}

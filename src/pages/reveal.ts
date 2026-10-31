// Motion and loading for the reading pages. `reveal` lets a block's children rise into place in
// sequence (24 ms apart, 160 ms at most) when the block first comes into view: at once for what is on
// screen when the page arrives, later for what is scrolled to. `near` calls back once a block is
// within a screen or so of the viewport, so a specimen fetches its data only when it will be seen.
import { reducedMotion } from "@stdlogits/ledger";

export function reveal(node: HTMLElement) {
  if (reducedMotion() || typeof IntersectionObserver !== "function") return;
  [...node.children].forEach((child, i) => (child as HTMLElement).style.setProperty("--i", String(i)));
  node.classList.add("rv-wait");
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    node.classList.replace("rv-wait", "rv-in");
    observer.disconnect();
  }, { rootMargin: "0px 0px -6% 0px" });
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
}

export function near(node: HTMLElement, callback: () => void) {
  if (typeof IntersectionObserver !== "function") { callback(); return; }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    callback();
  }, { rootMargin: "800px 0px" });
  observer.observe(node);
  return { destroy: () => observer.disconnect() };
}

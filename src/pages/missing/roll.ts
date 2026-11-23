// A number a ride counts through: plain while it runs, then rolling into place where it lands, each digit that changes
// sliding up and out as the new one rises in on Ledger's curve (out 120 ms, in 200 ms, 24 ms apart), as an odometer
// turns. The action owns its element's text and starts the roll in the same frame as the change, so the new number
// never shows for a frame before it rolls (Ledger's MorphText paints a change on the next frame, and a change made in
// the ride's own animation frame would show first). Between rides a change rolls too, unless changes come faster than
// a roll, as while scrubbing, when they stay plain.
import { IN, OUT, reducedMotion, stagger } from "@stdlogits/ledger";

export type RollMode = "plain" | "auto" | "land";

// Ledger's curve as the Web Animations API takes it, a string: Ledger exports it only as a function (`ease`).
const CURVE = "cubic-bezier(0.2, 0, 0, 1)";

export function roll(node: HTMLElement, options: { text: string; mode: RollMode }) {
  let shown = options.text;
  let last = 0;
  let timer = 0;
  node.textContent = shown;

  function set({ text, mode }: { text: string; mode: RollMode }) {
    if (text === shown) return;
    const from = shown;
    const now = performance.now();
    const fast = now - last < IN;
    shown = text;
    last = now;
    clearTimeout(timer);
    if (mode === "plain" || (mode === "auto" && fast) || reducedMotion() || document.hidden) {
      node.textContent = text;
      return;
    }
    // Digit by digit where the two have the same length (tabular figures keep each in its place), else as a whole.
    const pairs: [string, string][] = from.length === text.length ? [...text].map((c, i) => [from[i], c]) : [[from, text]];
    node.textContent = "";
    let k = 0;
    for (const [was, now] of pairs) {
      if (was === now) { node.append(now); continue; }
      const cell = document.createElement("span");
      cell.className = "ms-roll";
      const away = document.createElement("span");
      away.textContent = was;
      away.setAttribute("aria-hidden", "true");
      const into = document.createElement("span");
      into.textContent = now;
      cell.append(away, into);
      node.append(cell);
      const delay = stagger(k);
      away.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-0.32em)" }], { duration: OUT, delay, easing: CURVE, fill: "both" });
      into.animate([{ opacity: 0, transform: "translateY(0.32em)" }, { opacity: 1, transform: "none" }], { duration: IN, delay, easing: CURVE, fill: "backwards" });
      k += 1;
    }
    // Once still, plain text again.
    timer = window.setTimeout(() => { node.textContent = shown; }, IN + stagger(k) + 40);
  }

  return { update: set, destroy: () => clearTimeout(timer) };
}

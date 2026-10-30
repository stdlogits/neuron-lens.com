// A plain fade in, for what appears in place without moving (a tag joining a line, the crossfade
// between sides). lib/motion.ts has the rest; this belongs there if another part needs it.
import type { TransitionConfig } from "svelte/transition";
import { FAST, IN, ease, reducedMotion } from "../../lib/motion";

export function fadeIn(_node: Element, { delay = 0, duration = IN }: { delay?: number; duration?: number } = {}): TransitionConfig {
  return { delay, duration: reducedMotion() ? FAST : duration, easing: ease, css: (t) => `opacity: ${t}` };
}

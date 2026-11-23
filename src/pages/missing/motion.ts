// The missing page's motion, on the animation-frame clock: a tween, a sequence of held steps, and the ride along an
// axis that the layer, neuron and head pages make. One clock moves everything a ride shows, so nothing it moves has a
// transition of its own to fall behind on. Reduced motion lands each at once.
import { ease, reducedMotion } from "@stdlogits/ledger";

/** step(t) every frame for ms, t from 0 to 1; done() at the end. Returns its stop. */
export function tween(ms: number, step: (t: number) => void, done?: () => void): () => void {
  if (reducedMotion()) ms = 0;
  const start = performance.now();
  let frame = 0;
  let live = true;
  const tick = (now: number) => {
    if (!live) return;
    const t = ms ? Math.min(1, (now - start) / ms) : 1;
    step(t);
    if (t < 1) frame = requestAnimationFrame(tick);
    else { live = false; done?.(); }
  };
  frame = requestAnimationFrame(tick);
  return () => { live = false; cancelAnimationFrame(frame); };
}

/** Shows each step for its hold, then lands. Returns its stop. */
export function sequence<T>(steps: [T, number][], show: (step: T, i: number) => void, land?: () => void): () => void {
  let timer = 0;
  let at = -1;
  const next = () => {
    at += 1;
    if (at >= steps.length) { timer = 0; land?.(); return; }
    show(steps[at][0], at);
    timer = window.setTimeout(next, steps[at][1]);
  };
  next();
  return () => clearTimeout(timer);
}

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** A ride along an axis, as a camera moves: from 0 to `edge` (the last thing the model has) easing in and out over t1,
 * a hold there, then on to `end` (what the address asked for) on Ledger's curve over t2. step(p, left) runs every frame
 * with the position and the milliseconds left; done() once it lands. Returns its stop. */
export function ride({ edge, end, t1, hold, t2, step, done }: {
  edge: number;
  end: number;
  t1: number;
  hold: number;
  t2: number;
  step: (p: number, left: number) => void;
  done: () => void;
}): () => void {
  if (reducedMotion()) { step(end, 0); done(); return () => {}; }
  const total = t1 + hold + t2;
  const start = performance.now();
  let frame = 0;
  let live = true;
  const tick = (now: number) => {
    if (!live) return;
    const e = now - start;
    if (e >= total) { live = false; step(end, 0); done(); return; }
    step(e < t1 ? edge * inOut(e / t1) : e < t1 + hold ? edge : edge + (end - edge) * ease((e - t1 - hold) / t2), total - e);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => { live = false; cancelAnimationFrame(frame); };
}

/** Ledger's MorphText keeps a number plain while it changes faster than its morph and morphs the next change after it
 * has been still for one morph's length; a ride holds its number this long before it lands, so the landing morphs. */
export const STILL = 260;

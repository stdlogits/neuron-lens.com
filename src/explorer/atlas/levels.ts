// How the atlas shades and places its units. A unit's opacity is how sure the labeller was of it, on one
// scale for every model and mode, so a neuron keeps its shade from Easiest to All and a model the labeller
// was less sure of draws fainter. The score is the one the builder ranks units by (its labels' confidences,
// the surest first), read as the confidence all of a unit's labels would have to share to reach it, and
// stretched over the range that runs in for its kind. The Easiest neurons were picked for confidence, so they
// draw near full. No test of a read enters a score. All mode draws every neuron of a layer as a cell of its
// column, in neuron order.

/** The faintest a unit draws: one with no confidence, or one a filter or a search leaves out. */
export const FAINT = 0.1;
/** The faintest a unit a filter keeps draws, clear of what it leaves out. */
export const KEPT = 0.3;
/** A column's height in bars in All mode: as many as the easiest list, so both modes stand the same. */
export const ALL_ROWS = 40;

export type Kind = "neuron" | "head";
/** A score with every label sure: a pole counts its surer label and a third of the other, a neuron its surer
 *  pole and a quarter of the other (`neuron_score` in the builder); a head its surest label and a ninth of all three. */
const SURE: Record<Kind, number> = { neuron: 5 / 3, head: 4 / 3 };
/** The shared confidence each kind draws over, faint to full (the labeller is less sure of heads). */
const RANGE: Record<Kind, [number, number]> = { neuron: [0.2, 0.85], head: [0.15, 0.65] };

/** How strongly a unit with this score draws: 0 (faint) to 1 (full). */
export function strength(kind: Kind, score: number): number {
  const [lo, hi] = RANGE[kind];
  return Math.min(1, Math.max(0, (score / SURE[kind] - lo) / (hi - lo)));
}

/** Each All-mode confidence byte's strength. The builder writes a neuron's score as 255 · (score / top)^0.8
 *  (`scores.json`), top being the model's highest score, which is its easiest neuron's. */
export function byteStrengths(top: number): Float32Array {
  const out = new Float32Array(256);
  if (top > 0) for (let b = 1; b < 256; b += 1) out[b] = strength("neuron", top * (b / 255) ** 1.25);
  return out;
}

/** A layer of n neurons laid out in a box w × h: g cells a row, r rows, each cw × ch. */
export interface Field { g: number; r: number; cw: number; ch: number }
export function field(n: number, w: number, h: number): Field {
  const side = Math.sqrt((w * h) / Math.max(1, n));
  const g = Math.max(1, Math.floor(w / side));
  const r = Math.ceil(n / g);
  return { g, r, cw: w / g, ch: h / r };
}

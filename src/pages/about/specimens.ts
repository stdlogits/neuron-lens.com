// The real units the About page draws, each chosen because it shows one thing plainly.
import type { ModelId } from "../../lib/models";

/** Qwen3-8B L8·n344: owls on one side, rot and rust on the other, at the layer where both lenses read best. */
export const OWL = { model: "qwen3-8b" as ModelId, layer: 8, n: 344 };
/** Gemma 4 12B L33·n12225: the word Apple, and apples in doodles and speech. */
export const APPLE = { model: "gemma-4-12b" as ModelId, layer: 33, n: 12225 };
/** Gemma 4 12B L35·h14: an induction head, the strongest in the set. */
export const INDUCTION = { model: "gemma-4-12b" as ModelId, layer: 35, h: 14 };
/** Qwen3-8B L20·h17: copies "she" forward and pushes against "he" (and the reverse). */
export const SHE = { model: "qwen3-8b" as ModelId, layer: 20, h: 17 };
/** The README's Qwen3-8B gallery: one pole each, read three ways. */
export const GALLERY: { layer: number; n: number; pole: 1 | -1; note?: string }[] = [
  { layer: 1, n: 11672, pole: -1 },
  { layer: 8, n: 344, pole: 1 },
  { layer: 8, n: 1931, pole: 1 },
  { layer: 28, n: 8868, pole: -1 },
  { layer: 30, n: 1034, pole: 1 },
  { layer: 35, n: 9510, pole: 1, note: "None: it sets the output's temperature" },
];

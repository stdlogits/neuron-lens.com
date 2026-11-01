// The real units the About page draws, each chosen because it shows one thing plainly.
import type { ModelId } from "../../lib/models";

/** Qwen3-8B L8·n344: owls on one side, rot and rust on the other, at the layer where both lenses read best. */
export const OWL = { model: "qwen3-8b" as ModelId, layer: 8, n: 344 };
/** Gemma 4 12B L33·n12225: the word Apple, and apples in doodles and speech. */
export const APPLE = { model: "gemma-4-12b" as ModelId, layer: 33, n: 12225 };
/** Gemma 4 12B L35·h14: an induction head, the strongest in the set. */
export const INDUCTION = { model: "gemma-4-12b" as ModelId, layer: 35, h: 14 };
/** Gemma 4 12B L27·h4: at a word for a group ("both", "respectively", "three religions"), it looks back at the
 * members just listed, and writes "each" and "respectively". `firings` are the top firings that show it, by
 * place in the catalog's list: "两位" looking at 余, "The dorms" at Jane, "three religions … as" at Islam. */
export const GROUPS = { model: "gemma-4-12b" as ModelId, layer: 27, h: 4, firings: [1, 2, 4] };
/** Qwen3-8B L31·h0: copies British spellings (realised, colour, organised), one of the clearest heads through the lenses. */
export const BRITISH = { model: "qwen3-8b" as ModelId, layer: 31, h: 0 };

// The models the explorer covers: their shape, and what the neuron-lens findings say to trust at
// each depth (Qwen3-8B: findings §6, §7, §11, §12; Gemma 4 12B: §13-§16). The builder writes each
// layer's band key into index.json; the words for each band live here.

export type ModelId = "qwen3-8b" | "gemma-4-12b";
export type Modality = "image" | "audio";

export interface BandInfo {
  key: string;
  first: number;
  last: number;
  name: string;
  /** One word, under the atlas. */
  short: string;
  summary: string;
  reading: string;
}

export interface ModelInfo {
  id: ModelId;
  name: string;
  layers: number;
  mlp: number;
  heads: number;
  bands: BandInfo[];
  /** By depth: (last layer, the heading over a neuron's output read). */
  writeVerbs: [number, string][];
  /** The head tests' statistic: a false-discovery q, or (with too few heads a layer for one) an uncorrected p. */
  headTest: "q" | "p";
  /** Every sixth layer of Gemma 4 attends globally; the others within a window. */
  globalLayers: number[];
  media: Modality[];
  examples: string[];
  start: { neurons: number; heads: number };
  /** The two labels a head's card in the layer strip shows: the ones that held up when checked blind. */
  headCard: ["fires" | "attends" | "writes", "fires" | "attends" | "writes"];
}

export const MODELS: Record<ModelId, ModelInfo> = {
  "qwen3-8b": {
    id: "qwen3-8b",
    name: "Qwen3-8B",
    layers: 36,
    mlp: 12288,
    heads: 32,
    bands: [
      {
        key: "embed", first: 0, last: 0, name: "Token layer", short: "Token",
        summary: "Neurons here mostly respond to one literal input token.",
        reading: "The input-token read (in·S) names the firing token for 85% of poles. Writes are weak this early.",
      },
      {
        key: "early", first: 1, last: 7, name: "Early layers", short: "Early",
        summary: "Neurons respond to input tokens a few positions back, and often write back what they detect.",
        reading: "Trust the input-token reads (in·S). From about L4, the write read (out·R) predicts what pushing the neuron does.",
      },
      {
        key: "crossover", first: 8, last: 8, name: "Crossover", short: "Cross",
        summary: "The layer where the input-token reads and the concept reads both carry signal.",
        reading: "Both lenses read both sides here, and agree most. Tokens they share are the strongest evidence.",
      },
      {
        key: "concept", first: 9, last: 12, name: "Concept layers", short: "Concept",
        summary: "Neurons respond to concepts more than to literal tokens.",
        reading: "The concept read (in·R) takes over from in·S, which has gone to noise. out·R predicts steering, rarely the next word.",
      },
      {
        key: "middle", first: 13, last: 20, name: "Middle layers", short: "Middle",
        summary: "Neurons here respond to context more than to any one token: the strongest single-token swap reaches about 9% of a typical firing.",
        reading: "Read in·R and in·S's distinctive list, with the examples and exact drivers beside them. out·R predicts what pushing the neuron does.",
      },
      {
        key: "predict", first: 21, last: 31, name: "Prediction layers", short: "Predict",
        summary: "Neurons fire just before a predictable word, and many write that word.",
        reading: "in·R is often the word about to come next. From about L23 the write read names the next word.",
      },
      {
        key: "suppress", first: 32, last: 35, name: "Suppression layers", short: "Suppress",
        summary: "Many neurons push down the word the model is about to say, to calibrate it.",
        reading: "Read both sides' writes: a side whose top tokens are the next word holds it back.",
      },
    ],
    writeVerbs: [[3, "Writes (weak this early)"], [20, "When pushed, it promotes"], [31, "It predicts the next word"], [35, "It predicts or holds back the next word"]],
    headTest: "q",
    globalLayers: [],
    media: [],
    examples: ["owl", "Bible", "she", "money", "圣经", "L20h17"],
    start: { neurons: 8, heads: 20 },
    headCard: ["attends", "writes"],
  },
  "gemma-4-12b": {
    id: "gemma-4-12b",
    name: "Gemma 4 12B",
    layers: 48,
    mlp: 15360,
    heads: 16,
    bands: [
      {
        key: "token", first: 0, last: 4, name: "Token layers", short: "Token",
        summary: "Neurons here mostly respond to one literal input token.",
        reading: "The input-token read (in·S) names the firing token for 40–95% of poles here. Writes are too weak to read this early.",
      },
      {
        key: "early", first: 5, last: 13, name: "Early layers", short: "Early",
        summary: "Neurons respond to tokens a few positions back. The input-token read fades by L9, then returns at L10–L13, where many neurons write back what they detect.",
        reading: "Trust in·S at L10–L13, and the write's footprint (out·S) at L11–L13. From L11 the write read (out·R) predicts what pushing the neuron does.",
      },
      {
        key: "middle", first: 14, last: 32, name: "Middle layers", short: "Middle",
        summary: "Neurons here respond to context, and many to images: image concepts meet their names in text at these depths.",
        reading: "Read the examples and the words that set it off in real text first: the concept read (in·R) fails on this model. out·R still predicts what pushing the neuron does, though rarely the next word.",
      },
      {
        key: "late", first: 33, last: 47, name: "Late layers", short: "Late",
        summary: "Many neurons write the word the model is about to say.",
        reading: "out·R names the next word for 22–36% of poles at L33–L40, fewer after. Input reads are weak here: trust the examples.",
      },
    ],
    writeVerbs: [[10, "Writes (weak this early)"], [32, "When pushed, it promotes"], [47, "It predicts the next word"]],
    headTest: "p",
    globalLayers: [5, 11, 17, 23, 29, 35, 41, 47],
    media: ["image", "audio"],
    examples: ["panda", "mosque", "Arabic", "rain", "熊猫", "L28h6"],
    start: { neurons: 23, heads: 28 },
    headCard: ["fires", "attends"],
  },
};

export const MODEL_ORDER: ModelId[] = ["qwen3-8b", "gemma-4-12b"];
export const DEFAULT_MODEL: ModelId = "qwen3-8b";
export const isModelId = (value: string | null): value is ModelId => value !== null && value in MODELS;

export const bandOf = (model: ModelInfo, layer: number): BandInfo => model.bands.find((band) => layer <= band.last) ?? model.bands[model.bands.length - 1];
const byDepth = (steps: [number, string][], layer: number) => (steps.find(([last]) => layer <= last) ?? steps[steps.length - 1])[1];
/** How to phrase a neuron's output side at this depth: steering early, prediction late. */
export const writeVerb = (model: ModelInfo, layer: number) => byDepth(model.writeVerbs, layer);
export const bandRange = (band: BandInfo) => (band.first === band.last ? `L${band.first}` : `L${band.first}–${band.last}`);

/** A layer's share of the deep end of the ramp, 0–100. */
export const depthShare = (model: ModelInfo, layer: number) => Math.round(100 - (layer / (model.layers - 1)) * 100);
/** Layer colour on the violet → cyan depth ramp: the site's one accent. */
export const depthColor = (model: ModelInfo, layer: number) => `color-mix(in oklch, var(--deep) ${depthShare(model, layer)}%, var(--late))`;

export const MODALITY_NAMES: Record<Modality, { noun: string; plural: string; title: string }> = {
  image: { noun: "image", plural: "images", title: "In images" },
  audio: { noun: "sound", plural: "sounds", title: "In sound" },
};

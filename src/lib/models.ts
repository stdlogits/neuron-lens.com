// The models the explorer covers: their shape, and their depth bands. Every model has the same three,
// set by which lens works on each side of its neurons (scripts/neurons/bands.py, from the neuron-lens
// findings §3, §7 and §13): early layers read through the S-lens on both sides, middle layers still
// read what drives a neuron through the S-lens but its write through the R-lens, and late layers read
// both through the R-lens. The builder's profile holds the same layers and lights each read by them;
// the words for each band live here.

export type ModelId = "qwen3-8b" | "gemma-4-12b";
export type Modality = "image" | "audio";

/** A read, and what it shows: the About page's line for one side of a neuron in a band. */
export type BandRead = [read: string, shows: string];

export interface BandInfo {
  key: "early" | "middle" | "late";
  first: number;
  last: number;
  name: string;
  /** One word, under the atlas. */
  short: string;
  summary: string;
  reading: string;
  /** Which read to use for what drives a neuron, and for what it writes. */
  drives: BandRead;
  writes: BandRead;
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
        key: "early", first: 0, last: 3, name: "Early layers", short: "Early",
        summary: "Neurons respond to the input token, and write back what they detect.",
        reading: "The S-lens works on both sides: in·S names the firing token for 22–73% of the poles that fire, and out·S what the neuron writes back for 18–35%.",
        drives: ["S-lens", "the literal token"], writes: ["S-lens", "what it detects, written back"],
      },
      {
        key: "middle", first: 4, last: 8, name: "Middle layers", short: "Middle",
        summary: "Neurons still respond to the input token, but what they write already moves the output.",
        reading: "in·S names the firing token for 16–28% of poles, while out·R predicts what pushing the neuron does (median r 0.45–0.50).",
        drives: ["S-lens", "the literal token"], writes: ["R-lens", "what steering does"],
      },
      {
        key: "late", first: 9, last: 35, name: "Late layers", short: "Late",
        summary: "Both what drives a neuron and what it writes read as output words.",
        reading: "The R-lens works on both sides: in·R names what drives a neuron for 5–42% of poles, and out·R predicts what pushing it does (median r 0.57–1.00). From L23 out·R also names the next word, for 10–31% of poles; from L32 some neurons hold it back.",
        drives: ["R-lens", "and the exact drivers"], writes: ["R-lens", "what steering does; the next word from L23"],
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
        key: "early", first: 0, last: 10, name: "Early layers", short: "Early",
        summary: "Neurons respond to the input token. What they write is too small to read yet.",
        reading: "in·S names the firing token for 5–85% of poles: most at L0–L1, fading by L9 and back at L10. Neither lens predicts what a push of natural size does (median r under 0.1).",
        drives: ["S-lens", "the literal token, fading by L9"], writes: ["Nothing", "too weak to read"],
      },
      {
        key: "middle", first: 11, last: 13, name: "Middle layers", short: "Middle",
        summary: "Neurons still respond to the input token, but what they write already moves the output.",
        reading: "in·S names the firing token for 27–42% of poles and out·S what they write back for 11–20%, while out·R predicts what pushing a neuron does (median r 0.39–0.55).",
        drives: ["S-lens", "the literal token"], writes: ["R-lens", "what steering does"],
      },
      {
        key: "late", first: 14, last: 47, name: "Late layers", short: "Late",
        summary: "What a neuron writes reads as output words; what drives it reads as no single token.",
        reading: "out·R predicts what pushing a neuron does (median r 0.43–1.00), and names the next word for 21–32% of poles at L33–L40. No weight read of the input works here: in·S has faded, and this model's in·R fails. Read the firings.",
        drives: ["Firings", "the input reads fail here"], writes: ["R-lens", "what steering does; the next word at L33–40"],
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

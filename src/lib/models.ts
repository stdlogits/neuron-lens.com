// The models the explorer covers: their shape, and their depth bands. Every model has the same three (the
// smaller Qwen3 models no early one: their writes read through the R-lens from L0),
// set by which lens works on each side of its neurons (scripts/neurons/bands.py, from the neuron-lens
// findings §3, §7 and §13): early layers read through the S-lens on both sides, middle layers still
// read what drives a neuron through the S-lens but its write through the R-lens, and late layers read
// both through the R-lens. The builder's profile holds the same layers and lights each read by them;
// the words for each band live here: written out for Qwen3-8B and Gemma 4 12B, and for the other Qwen3
// sizes made from their numbers in ladder.json (bands.py --ladder, which also says whether one is labelled). The explorer lists the
// models with a build on R2 (catalog.json).
import catalog from "./catalog.json" with { type: "json" };
import ladder from "./ladder.json" with { type: "json" };

export type ModelId = string;
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
  /** The picker's rows: the family, then its size and whether it is the base model. */
  family: "Qwen3" | "Gemma 4";
  size: string;
  base: boolean;
  /** Its Hugging Face id. */
  hub: string;
  /** Labelled by Claude Haiku (or, for a base model, shown with its post-trained model's labels); an unlabelled
   * model lists every neuron (no Easiest) and searches heads and addresses. */
  labelled: boolean;
  /** A base model shown with its post-trained model's labels, ratings, easiest and search (lib/data.ts), its
   * own evidence otherwise: the two are close enough that the labels hold (a9's call). */
  labelsFrom?: ModelId;
  layers: number;
  mlp: number;
  heads: number;
  bands: BandInfo[];
  /** By depth: (last layer, the heading over a neuron's output read). */
  writeVerbs: [number, string][];
  /** Every sixth layer of Gemma 4 attends globally; the others within a window. */
  globalLayers: number[];
  media: Modality[];
  examples: string[];
  start: { neurons: number; heads: number };
  /** The two labels a head's card in the layer strip shows: the ones that held up when checked blind. */
  headCard: ["fires" | "attends" | "writes", "fires" | "attends" | "writes"];
  /** The model this one was pruned from (neuron-lens findings §20), with the same layers and heads, and each neuron
   * traced to a parent there (lib/data.ts loadLineage); a base pairs with the parent's base. */
  prunedFrom?: ModelId;
  /** The model pruned from this one: each of its neurons traced to a child there, or cut. */
  prunedInto?: ModelId;
}

export const MODELS: Record<ModelId, ModelInfo> = {
  "qwen3-8b": {
    id: "qwen3-8b",
    name: "Qwen3-8B",
    family: "Qwen3", size: "8B", base: false, hub: "Qwen/Qwen3-8B", labelled: true,
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
    globalLayers: [],
    media: [],
    examples: ["owl", "Bible", "she", "money", "圣经", "L20h17"],
    start: { neurons: 8, heads: 20 },
    headCard: ["attends", "writes"],
  },
  "gemma-4-12b": {
    id: "gemma-4-12b",
    name: "Gemma 4 12B",
    family: "Gemma 4", size: "12B", base: false, hub: "google/gemma-4-12B", labelled: true,
    layers: 48,
    mlp: 15360,
    heads: 16,
    bands: [
      {
        key: "early", first: 0, last: 10, name: "Early layers", short: "Early",
        summary: "Neurons respond to the input token. What they write is too small to read yet.",
        reading: "in·S names the firing token for 5–86% of poles: most at L0–L1, fading by L9 and back at L10. Neither lens predicts what a push of natural size does (median r under 0.1).",
        drives: ["S-lens", "the literal token, fading by L9"], writes: ["Nothing", "too weak to read"],
      },
      {
        key: "middle", first: 11, last: 12, name: "Middle layers", short: "Middle",
        summary: "Neurons still respond to the input token, but what they write already moves the output.",
        reading: "in·S names the firing token for 29–44% of poles and out·S what they write back for 18–24%, while out·R predicts what pushing a neuron does (median r 0.39–0.40).",
        drives: ["S-lens", "the literal token"], writes: ["R-lens", "what steering does"],
      },
      {
        key: "late", first: 13, last: 47, name: "Late layers", short: "Late",
        summary: "Both what drives a neuron and what it writes read as output words.",
        reading: "The R-lens works on both sides: in·R names what drives a neuron for 11–54% of poles, and out·R predicts what pushing it does (median r 0.43–1.00). out·R also names the next word for 21–32% of poles at L33–L40.",
        drives: ["R-lens", "and the exact drivers"], writes: ["R-lens", "what steering does; the next word at L33–40"],
      },
    ],
    writeVerbs: [[10, "Writes (weak this early)"], [32, "When pushed, it promotes"], [47, "It predicts the next word"]],
    globalLayers: [5, 11, 17, 23, 29, 35, 41, 47],
    media: ["image", "audio"],
    examples: ["panda", "mosque", "Arabic", "rain", "熊猫", "L28h6"],
    start: { neurons: 23, heads: 28 },
    headCard: ["fires", "attends"],
  },
};

/** A Qwen3 size's profile in ladder.json, from its numbers (bands.py --ladder). */
interface LadderBand { key: BandInfo["key"]; first: number; last: number; write_r: number[]; read_s: number[]; read_r: number[]; write_s: number[] }
interface Ladder { name: string; hub: string; size: string; base: boolean; labelled: boolean; layers: number; mlp: number; heads: number; bands: LadderBand[]; late: number; self: number }

const share = ([a, b]: number[]) => `${Math.round(a * 100)}–${Math.round(b * 100)}%`;
const corr = ([a, b]: number[]) => `${a.toFixed(2)}–${b.toFixed(2)}`;
const LADDER_BANDS: Record<BandInfo["key"], (b: LadderBand) => Omit<BandInfo, "key" | "first" | "last">> = {
  early: (b) => ({
    name: "Early layers", short: "Early",
    summary: "Neurons respond to the input token, and write back what they detect.",
    reading: `The S-lens works on both sides: in·S names the firing token for ${share(b.read_s)} of the poles that fire, and out·S what the neuron writes back for ${share(b.write_s)}.`,
    drives: ["S-lens", "the literal token"], writes: ["S-lens", "what it detects, written back"],
  }),
  middle: (b) => ({
    name: "Middle layers", short: "Middle",
    summary: "Neurons still respond to the input token, but what they write already moves the output.",
    reading: `in·S names the firing token for ${share(b.read_s)} of poles, while out·R predicts what pushing the neuron does (median r ${corr(b.write_r)}).`,
    drives: ["S-lens", "the literal token"], writes: ["R-lens", "what steering does"],
  }),
  late: (b) => ({
    name: "Late layers", short: "Late",
    summary: "Both what drives a neuron and what it writes read as output words.",
    reading: `The R-lens works on both sides: in·R names what drives a neuron for ${share(b.read_r)} of poles, and out·R predicts what pushing it does (median r ${corr(b.write_r)}).`,
    drives: ["R-lens", "and the exact drivers"], writes: ["R-lens", "what steering does"],
  }),
};

function fromLadder(id: ModelId, m: Ladder): ModelInfo {
  const bands = m.bands.filter((b) => b.last >= b.first).map((b) => ({ key: b.key, first: b.first, last: b.last, ...LADDER_BANDS[b.key](b) }));
  const early = bands.find((b) => b.key === "early");
  const at = (share: number) => Math.round(share * (m.layers - 1));
  return {
    id, name: m.name, family: "Qwen3", size: m.size, base: m.base, hub: m.hub, labelled: m.labelled,
    layers: m.layers, mlp: m.mlp, heads: m.heads, bands,
    writeVerbs: [...(early ? [[early.last, "Writes (weak this early)"] as [number, string]] : []), [m.late - 1, "When pushed, it promotes"], [m.layers - 1, "It predicts the next word"]],
    globalLayers: [], media: [], examples: [],
    start: { neurons: at(8 / 35), heads: at(20 / 35) },
    headCard: ["attends", "writes"],
  };
}
for (const [id, m] of Object.entries(ladder as Record<string, Ladder>)) MODELS[id] ??= fromLadder(id, m);
for (const model of Object.values(MODELS)) {
  const post = model.base ? MODELS[model.id.replace(/-base$/, "")] : undefined;
  if (!model.labelled && post?.labelled && post.id in catalog.builds) Object.assign(model, { labelled: true, labelsFrom: post.id });
}

/** The pruned pairs (neuron-lens findings §20; scripts/neurons/lineage.py): the pruned model, then its parent. */
const PRUNED: [ModelId, ModelId][] = [["qwen3-4b", "qwen3-8b"], ["qwen3-0.6b", "qwen3-1.7b"]];
for (const [child, parent] of PRUNED) {
  for (const suffix of ["", "-base"]) {
    const [c, p] = [MODELS[child + suffix], MODELS[parent + suffix]];
    if (c && p) Object.assign(c, { prunedFrom: p.id }) && Object.assign(p, { prunedInto: c.id });
  }
}
/** The lineage file a model's neurons are traced in: its post-trained model's, since post-training keeps the indices. */
export const lineageFile = (model: ModelId) => model.replace(/-base$/, "");
/** Whether a neuron of one model traces to the other's: a pruned model and its parent, either way, post-trained or base. */
export const traced = (a: ModelId, b: ModelId) => {
  const [x, y] = [lineageFile(a), lineageFile(b)];
  return PRUNED.some(([child, parent]) => (x === child && y === parent) || (x === parent && y === child));
};

const FAMILIES: ModelInfo["family"][] = ["Qwen3", "Gemma 4"];
const sizeOf = (model: ModelInfo) => parseFloat(model.size);
/** The models with a build up, by family, then base after post-trained, then size. */
export const MODEL_ORDER: ModelId[] = Object.keys(catalog.builds).filter((id) => id in MODELS).sort((a, b) => {
  const [x, y] = [MODELS[a], MODELS[b]];
  return FAMILIES.indexOf(x.family) - FAMILIES.indexOf(y.family) || Number(x.base) - Number(y.base) || sizeOf(x) - sizeOf(y);
});
export const DEFAULT_MODEL: ModelId = "qwen3-8b";
/** The models listed, in words: "Qwen3-8B and Gemma 4 12B", or with more Qwen3 sizes up, "Qwen3 from 0.6B to 14B,
 * post-trained and base, and Gemma 4 12B". */
export const COVERAGE = (() => {
  const listed = MODEL_ORDER.map((id) => MODELS[id]);
  const qwen = listed.filter((model) => model.family === "Qwen3");
  if (qwen.length < 2) return new Intl.ListFormat("en").format(listed.map((model) => model.name));
  const sizes = qwen.map(sizeOf);
  const range = (n: number) => qwen.find((model) => sizeOf(model) === n)!.size;
  const both = qwen.some((model) => model.base) && qwen.some((model) => !model.base);
  const rest = listed.filter((model) => model.family !== "Qwen3").map((model) => model.name);
  return `Qwen3 from ${range(Math.min(...sizes))} to ${range(Math.max(...sizes))}${both ? ", post-trained and base," : ""}${rest.length ? ` and ${rest.join(" and ")}` : ""}`;
})();

export const isModelId = (value: string | null): value is ModelId => value !== null && MODEL_ORDER.includes(value);

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

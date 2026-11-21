// The models the explorer covers: their shape, and their depth bands. Every model's bands are neuron-lens's (its
// reading plans, arch.PLANS; findings §8), which scripts/neurons/bands.py copies into depth.json with the numbers each
// band's words cite: sensory layers, whose label cards read what drives a neuron through the S-lens (the literal token);
// association layers, through the R-lens, which there often names a concept associated with what it fires on; workspace
// layers; and motor layers, from where what a neuron writes often reads as the next word. A model's plan cuts all of
// them or skips one (Gemma 4 has no sensory band, Qwen3-1.7B no workspace band). The builder lights each read by the same
// plan. The other Qwen3 sizes' shapes are in ladder.json (bands.py, which also says whether one is labelled). The
// explorer lists the models with a build on R2 (catalog.json).
import catalog from "./catalog.json" with { type: "json" };
import depth from "./depth.json" with { type: "json" };
import ladder from "./ladder.json" with { type: "json" };

export type ModelId = string;
export type Modality = "image" | "audio";

/** A read, and what it shows: the About page's line for one side of a neuron in a band. */
export type BandRead = [read: string, shows: string];

export interface BandInfo {
  key: "sensory" | "association" | "workspace" | "motor";
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

/** A band in depth.json: its layers, and the spans of the numbers its words cite (bands.py). */
interface DepthBand { key: BandInfo["key"]; first: number; last: number; read_s: number[]; read_r: number[]; next_r: number[]; write_r: number[] }

const share = ([a, b]: number[]) => `${Math.max(0, Math.round(a * 100))}–${Math.max(0, Math.round(b * 100))}%`;
const corr = ([a, b]: number[]) => `${a.toFixed(2)}–${b.toFixed(2)}`;
/** What each band's label cards read, in words, with its numbers: in·S names the firing token, in·R an exact driver,
 * out·R the next token, each for a share of the poles that fire, net of chance; and how closely out·R predicts what
 * pushing a neuron does (median r). */
const BAND_WORDS: Record<BandInfo["key"], (b: DepthBand) => Omit<BandInfo, "key" | "first" | "last">> = {
  sensory: (b) => ({
    name: "Sensory layers", short: "Sensory",
    summary: "Neurons respond to the literal input token.",
    reading: `in·S names the firing token for ${share(b.read_s)} of the poles that fire, and out·R predicts what pushing a neuron does (median r ${corr(b.write_r)}).`,
    drives: ["S-lens", "the literal token"], writes: ["R-lens", "what steering does"],
  }),
  association: (b) => ({
    name: "Association layers", short: "Association",
    summary: "What drives a neuron reads as a concept near the tokens it fires on, more than as those tokens.",
    reading: `in·R often names an associated concept, a style or a script rather than what a neuron fires on: it names an exact driver for ${share(b.read_r)} of the poles that fire, where in·S names the firing token for ${share(b.read_s)}. out·R predicts what pushing a neuron does (median r ${corr(b.write_r)}).`,
    drives: ["R-lens", "an associated concept"], writes: ["R-lens", "what steering does"],
  }),
  workspace: (b) => ({
    name: "Workspace layers", short: "Workspace",
    summary: "What drives a neuron and what it writes both read as concepts.",
    reading: `The R-lens reads both sides: in·R names an exact driver for ${share(b.read_r)} of the poles that fire, and out·R predicts what pushing a neuron does (median r ${corr(b.write_r)}).`,
    drives: ["R-lens", "and the exact drivers"], writes: ["R-lens", "what steering does"],
  }),
  motor: (b) => ({
    name: "Motor layers", short: "Motor",
    summary: "What a neuron writes often reads as the next word.",
    reading: `out·R names the next word for ${share(b.next_r)} of the poles that fire and predicts what pushing a neuron does (median r ${corr(b.write_r)}); in·R names an exact driver for ${share(b.read_r)}.`,
    drives: ["R-lens", "and the exact drivers"], writes: ["R-lens", "the next word"],
  }),
};
const DEPTH = depth as Record<ModelId, { bands: DepthBand[] }>;
/** A model's bands, from neuron-lens's reading plan, in words. */
const bandsOf = (id: ModelId): BandInfo[] => DEPTH[id].bands.map((b) => ({ key: b.key, first: b.first, last: b.last, ...BAND_WORDS[b.key](b) }));

export const MODELS: Record<ModelId, ModelInfo> = {
  "qwen3-8b": {
    id: "qwen3-8b",
    name: "Qwen3-8B",
    family: "Qwen3", size: "8B", base: false, hub: "Qwen/Qwen3-8B", labelled: true,
    layers: 36,
    mlp: 12288,
    heads: 32,
    bands: bandsOf("qwen3-8b"),
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
    bands: bandsOf("gemma-4-12b"),
    globalLayers: [5, 11, 17, 23, 29, 35, 41, 47],
    media: ["image", "audio"],
    examples: ["panda", "mosque", "Arabic", "rain", "熊猫", "L28h6"],
    start: { neurons: 23, heads: 28 },
    headCard: ["fires", "attends"],
  },
};

/** A Qwen3 size's profile in ladder.json (bands.py). */
interface Ladder { name: string; hub: string; size: string; base: boolean; labelled: boolean; layers: number; mlp: number; heads: number; self: number }

function fromLadder(id: ModelId, m: Ladder): ModelInfo {
  const at = (share: number) => Math.round(share * (m.layers - 1));
  return {
    id, name: m.name, family: "Qwen3", size: m.size, base: m.base, hub: m.hub, labelled: m.labelled,
    layers: m.layers, mlp: m.mlp, heads: m.heads, bands: bandsOf(id),
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
export const bandRange = (band: BandInfo) => (band.first === band.last ? `L${band.first}` : `L${band.first}–${band.last}`);

/** A layer's share of the deep end of the ramp, 0–100. */
export const depthShare = (model: ModelInfo, layer: number) => Math.round(100 - (layer / (model.layers - 1)) * 100);
/** Layer colour on the violet → cyan depth ramp: the site's one accent. */
export const depthColor = (model: ModelInfo, layer: number) => `color-mix(in oklch, var(--deep) ${depthShare(model, layer)}%, var(--late))`;

export const MODALITY_NAMES: Record<Modality, { noun: string; plural: string; title: string }> = {
  image: { noun: "image", plural: "images", title: "In images" },
  audio: { noun: "sound", plural: "sounds", title: "In sound" },
};

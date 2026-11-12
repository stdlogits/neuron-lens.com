// The catalog the explorer reads, prebuilt by scripts/neurons/build-neuron-catalog.py from the
// neuron-lens catalogs. The dev server serves the local copy (catalog/<model>) at /data/<model>; the
// site reads each model's build from R2 at the data origin, under the build's own name in catalog.json
// (scripts/catalog/upload.sh writes it). A build's files never change, so a page reads one build
// throughout, and a new one starts with the deploy that names it.

import type { ContextLine } from "@stdlogits/ledger";
import catalog from "./catalog.json";
import type { ModelId, ModelInfo, Modality } from "./models";

/** Where a model's catalog files are. `VITE_CATALOG=live npm run dev` reads the live builds on R2 instead of a local copy. */
const local = import.meta.env.DEV && import.meta.env.VITE_CATALOG !== "live";
export const dataBase = (model: ModelId) => (local ? `/data/${model}` : `${catalog.origin}/${model}/${catalog.builds[model]}`);

export type Unit = "neurons" | "heads";
export type Trust = "primary" | "trusted" | "weak";
export type NeuronColumn =
  | "read_S" | "read_S_z" | "read_R" | "read_R_z"
  | "write_S" | "write_S_z" | "write_R" | "write_R_z";
export type HeadColumn =
  | "ov_R" | "ov_R_z" | "ov_R_neg" | "ov_R_neg_z" | "ov_S" | "ov_S_z" | "ov_S_neg" | "ov_S_neg_z"
  | "qk_S" | "qk_S_z" | "qk_S_neg" | "qk_S_neg_z" | "qk_self_S" | "qk_self_S_z" | "qk_self_R" | "qk_self_R_z";
/** What a pole adds beyond what it reads: the write's reads with its gate and up rows removed (findings §18). */
export type OrthColumn = "write_orth_R" | "write_orth_R_z" | "write_orth_S" | "write_orth_S_z";
/** What the stream holds at a pole's firings: entering its MLP, written by its layer, and the model's next word. */
export type StreamColumn =
  | "before_R" | "before_R_z" | "before_S" | "before_S_z"
  | "mlp_R" | "mlp_R_z" | "mlp_S" | "mlp_S_z"
  | "pred" | "pred_z";
export type ReadColumn = NeuronColumn | HeadColumn | OrthColumn | StreamColumn;

/** [token, variants merged into it, flags: 1 another lens names it too, 2 confirmed by measurement]. */
export type LensToken = [string, number, number];
export interface ReadInfo {
  col: ReadColumn;
  trust: Trust;
}
export interface LensRead extends ReadInfo {
  /** Mean top-8 score as a percentile of the layer's poles (of all heads, for heads). */
  pct: number;
  tokens: LensToken[];
}

export interface NeuronLabel { fires: string; fc: number; writes: string; wc: number; note: string }
export interface Pole {
  pole: 1 | -1;
  reads: LensRead[];
  /** Variant keys two lens families name. */
  shared: string[];
  /** Variant keys a lens names and the pole's drivers or peaks confirm. */
  measured: string[];
  label: NeuronLabel;
  /** Typical and largest firing, the share of tokens it fires on (overall, then web, Chinese, code, chat), and the share of firings past position 0. */
  act: { top: number; max: number; rate: number; slices: [number, number, number, number]; pos: number };
  peaks: [string, number][];
  /** The tokens that come right after its top firings, and how many times. */
  next: [string, number][];
  /** Top firings: the text with the token marked ⟦ ⟧, then its English and language when translated. */
  contexts: ContextLine[];
  drivers: [string, number][];
  /** Its write with what it reads removed. */
  orth: LensRead[];
  /** The stream at its firings; absent where the model has no `firings` table yet. */
  stream?: LensRead[];
  /** How much its write amplifies what it reads, how much it adds off it, and over how many firings. */
  flow?: [number | null, number | null, number];
  /** The cosine of its write with the gate and up sides of what it reads. */
  cos: [number | null, number | null];
  silent: boolean;
  detector: "token" | "next" | null;
  shape?: { kurtPct: number; skew: number; kind: "predicts" | "suppresses" | null };
  score: number;
  /** Gemma 4: what the pole responds to in images and sound. */
  media?: Partial<Record<Modality, PoleMedia>>;
}
/** Optimised read (findings §14): a patch or 40 ms frame that raises the pole, and its held-out gain over the base activation. */
export interface Optimised { gain: number | null; lens: number | null; base: number | null; png?: string; wave?: string }
export interface PoleMedia {
  /** The label whose documents it fires on most, its z over all documents, and its held-out AUROC. */
  label: string;
  z: number | null;
  auroc: number | null;
  /** Past the shuffled-label null and in the top 5 of both halves of the documents. */
  reliable: boolean;
  labels: string[];
  /** Top documents: [document, mean activation]. */
  top: [number, number][];
  /** The media R-lens read of its write: what it makes the model say in image or audio contexts. */
  write: LensToken[];
  writeZ: LensToken[];
  /** The label's rank on the text side (findings §15): its words fire it, the text S-lens reads it, the text R-lens writes it. */
  ranks: [number | null, number | null, number | null] | null;
  opt?: Optimised;
}
export interface NeuronDetail { n: number; poles: [Pole, Pole] }

export interface HeadLabel { fires: string; fc: number; attends: string; ac: number; writes: string; wc: number; note: string }
export interface HeadDetail {
  h: number;
  kv: number;
  label: HeadLabel;
  /** Attention to position 0, the previous token and itself; induction and duplicate-token scores on repeated text. */
  pattern: [number, number, number, number, number];
  roles: number;
  act: { top: number; max: number; rate: number; slices: [number, number, number, number] };
  /** Copying scores of its OV map; its QK diagonal's median with the query through the S-lens and (from L1) the R-lens; how well QK·S ranks what it attends to in real text, and what OV·R copies. */
  copy: { ovR: number | null; ovS: number | null; selfS: number | null; selfR: number | null; qkOv: number | null; qkCtx: number | null };
  reads: LensRead[];
  /** What its firings write in context (the R-lens read of its actual output, layer-contrastive). */
  outRz: LensToken[];
  /** As the query: tokens that make its output largest. */
  drivers: [string, number][];
  /** As the key: tokens it attends to most. */
  keys: [string, number][];
  peaks: [string, number][];
  sources: [string, number][];
  /** Top firings: the text with the token marked ⟦ ⟧ and the attended token ⟪ ⟫, then its English and language when translated. */
  contexts: ContextLine[];
  /** Share of top firings on one query token, and on one attended token. */
  modes: [number, number];
  score: number;
  /** Gemma 4: the head in image and audio contexts (findings §16). */
  media?: Record<Modality, HeadMedia>;
}
/** Reading the media against an even spread; attention within it and to its neighbours; zeroing it, the z of what it costs the right label; the right class's mean percentile in its output, and that score's q. */
export interface HeadMedia { read: number | null; within: number | null; nbr: number | null; content: number | null; write: number | null; writeQ: number | null }

/** [layer, neuron, title of the + pole, title of the − pole, score, flags, each title's confidence 0–100]. */
export type IndexRow = [number, number, string, string, number, number, number, number];
export const FLAG_DETECTOR = 1;
export const FLAG_PREDICTS = 2;
export const FLAG_SUPPRESSES = 4;
/** The + (or −) title is the pole's writes label rather than its fires label. */
export const FLAG_PLUS_WRITES = 8;
export const FLAG_MINUS_WRITES = 16;
/** A pole with a reliable image or sound label, or one that holds a concept across text and media. */
export const FLAG_IMAGE = 32;
export const FLAG_AUDIO = 64;
export const FLAG_CROSSMODAL = 128;

/** [layer, head, kv head, fires, attends, writes, their confidences 0–100, roles, score, pattern]. */
export type HeadRow = [number, number, number, string, string, string, number, number, number, number, number, HeadDetail["pattern"]];

export interface LayerMeta {
  layer: number;
  band: string;
  missing?: boolean;
  global?: boolean;
  count?: number;
  /** Shares of its poles, and `conf` the labeller's mean confidence in their title labels. */
  stats?: { silent: number; detector: number; conf: number; image?: number; audio?: number };
  /** The reads every neuron of the layer lists, in order. */
  reads?: ReadInfo[];
  orth?: ReadInfo[];
  stream?: ReadInfo[];
}

export interface CatalogIndex {
  model: string;
  id: ModelId;
  docBlock: number;
  labelled: boolean;
  media: Modality[];
  layers: number;
  neuronsPerLayer: number;
  headsPerLayer: number;
  /** Bytes in a pole's record of a graph.bin file, and in a head's. */
  wire: number;
  headWire: number;
  /** Connections each record keeps per relation. */
  connections: number;
  layerMeta: LayerMeta[];
  /** The easiest neurons to read: the ones the labeller was surest of. */
  neurons: IndexRow[];
}

/** Word -> [ref, side, weight]: side 0/1 is a curated neuron's + or − pole (ref indexes CatalogIndex.neurons), 2 a head (ref = layer × heads + head). */
export interface SearchFile { forms: Record<string, [number, 0 | 1 | 2, number][]>; display: Record<string, string> }
/** Token or quoted term -> [English, romanization, ISO 639-1 language]. */
export type Terms = Record<string, [string, string, string]>;
/** An image or sound: its collection, labels, caption, link; a translated caption ([English, language]); and,
 * when this site can show it, where scripts/neurons/media.py packed it ([pack, offset, length]). */
export interface MediaDoc { s: string; l: string[]; c: string; u: string; en?: [string, string]; h?: [number, number, number] }
/** Per modality and collection: the name, licence and credit of each one whose images or sounds are shown. */
export type MediaCredits = Record<Modality, Record<string, { name: string; license: string; credit: string }>>;

// ---------- loading

const cache = new Map<string, Promise<unknown>>();

function memo<T>(key: string, make: () => Promise<T>): Promise<T> {
  let pending = cache.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = make();
    // A failed request can be retried later instead of failing forever.
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

const load = <T>(model: ModelId, name: string) => memo(`${model}/${name}`, () => fetch(`${dataBase(model)}/${name}`).then((response) => {
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  return response.json() as Promise<T>;
}));

const pad = (value: number, width = 2) => String(value).padStart(width, "0");

type RawToken = number | [number, number, number];
type RawRead = [number, RawToken[]];
type RawPairs = [number, number][];
type RawMedia = Omit<PoleMedia, "write" | "writeZ"> & { write: RawToken[]; writeZ: RawToken[] };
type RawPole = Omit<Pole, "reads" | "orth" | "stream" | "drivers" | "media"> & { reads: RawRead[]; orth: RawRead[]; stream?: RawRead[]; drivers: RawPairs; media?: Partial<Record<Modality, RawMedia>> };
type RawHead = Omit<HeadDetail, "reads" | "drivers" | "keys" | "outRz"> & { reads: RawRead[]; drivers: RawPairs; keys: RawPairs; outRz: RawToken[] };

// Details name tokens by id; vocab.json decodes every id once.
const loadVocab = (model: ModelId) => load<string[]>(model, "vocab.json");
const tokensOf = (raw: RawToken[], vocab: string[]): LensToken[] =>
  raw.map((t) => (typeof t === "number" ? [vocab[t] ?? "", 1, 0] : [vocab[t[0]] ?? "", t[1], t[2]]));
const readsOf = (header: ReadInfo[], raw: RawRead[], vocab: string[]): LensRead[] =>
  header.map((info, i) => ({ ...info, pct: raw[i]?.[0] ?? 0, tokens: tokensOf(raw[i]?.[1] ?? [], vocab) }));
const pairsOf = (raw: RawPairs, vocab: string[]): [string, number][] => raw.map(([t, value]) => [vocab[t] ?? "", value]);
function mediaOf(raw: RawPole["media"], vocab: string[]): Pole["media"] {
  if (!raw) return undefined;
  const out: Partial<Record<Modality, PoleMedia>> = {};
  for (const [modality, m] of Object.entries(raw) as [Modality, RawMedia][]) out[modality] = { ...m, write: tokensOf(m.write, vocab), writeZ: tokensOf(m.writeZ, vocab) };
  return out;
}

export const loadIndex = (model: ModelId) => load<CatalogIndex>(model, "index.json");
export const loadSearch = (model: ModelId) => load<SearchFile>(model, "search.json");
export const loadTerms = (model: ModelId) => load<Terms>(model, "terms.json");
/** Every neuron of a layer: [neuron, title +, title −, score, flags, confidence +, confidence −]. */
export const loadLayerIndex = (model: ModelId, layer: number) => memo(`${model}/rows:${layer}`, async () => {
  const file = await load<{ layer: number; neurons: [number, string, string, number, number, number, number][] }>(model, `neurons/L${pad(layer)}/index.json`);
  return file.neurons.map((row): IndexRow => [layer, ...row]);
});
/** Per layer, a base64 string of one byte per neuron: its readability, 0–255. */
export const loadScores = (model: ModelId) => memo(`${model}/scores`, async () => (await load<{ layers: string[] }>(model, "scores.json")).layers.map(decodeScores));
export const loadHeadIndex = (model: ModelId) => memo(`${model}/heads`, async () => (await load<{ heads: HeadRow[] }>(model, "heads/index.json")).heads);

// ---------- ranges: every unit's record is read out of a larger file

// At most MAX_RANGES at once. A read asked for ahead of need (`later`, named by its memo key: the graph's
// walk fetching what it will probably want next) takes a slot only while RESERVE stay free for reads needed
// now and nothing needed now is waiting, and moves up the moment something needs it (`promote`), so looking
// ahead never holds up a read that matters now.
const MAX_RANGES = 16;
const RESERVE = 4;
let active = 0;
const waiting: (() => void)[] = [];
const later = new Map<string, () => void>();

function promote(key: string) {
  const go = later.get(key);
  if (!go) return;
  later.delete(key);
  if (active < MAX_RANGES) { active += 1; go(); }
  else waiting.push(go);
}

async function range(url: string, offset: number, length: number, ahead?: string): Promise<ArrayBuffer> {
  const room = ahead === undefined ? MAX_RANGES : MAX_RANGES - RESERVE;
  if (active >= room || (ahead !== undefined && waiting.length)) await new Promise<void>((go) => (ahead === undefined ? waiting.push(go) : later.set(ahead, go)));
  else active += 1;
  try {
    const response = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    const buffer = await response.arrayBuffer();
    return response.status === 206 ? buffer : buffer.slice(offset, offset + length);
  } finally {
    // Hand the slot straight on: to a read needed now, else to one asked for ahead while the reserve holds.
    const now = waiting.shift();
    const first = now ? undefined : later.entries().next().value;
    if (now) now();
    else if (first && active <= MAX_RANGES - RESERVE) { later.delete(first[0]); first[1](); }
    else active -= 1;
  }
}

const inflated = (bytes: ArrayBuffer) => new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"))).text();

// ---------- connections: a fixed-width record per pole (graph.bin, see WIRE in the builder)

export type Relation = "in" | "out" | "driven" | "drives" | "heads" | "with" | "drivesHeads";
const POLE_RELATIONS = ["in", "out", "driven", "drives", "heads", "with", "drivesHeads"] as const;
const HEAD_RELATIONS = ["driven", "heads", "qDriven", "qHeads", "kDriven", "kHeads", "drives", "drivesHeads", "with"] as const;
/** The input a link reaches a head through: 0 its value, 1 its query, 2 its key. */
export type Through = 0 | 1 | 2;
/** One connection: the other unit's id and its value (a push, a share, or the share of firings in common); into a head, the input it arrives through. */
export type Link = [id: number, value: number, through?: Through];
/** The share of a unit's input from neurons, heads and the embedding. */
export type Mix = [number, number, number];
/** A head's query or key: what drives it there, as `driven`, `heads` and `mix` say for its value. */
export interface HeadInput { driven: Link[]; heads: Link[]; mix: Mix }
export interface Wire {
  /** The unit's clearest label, shortened, and its confidence 0–100. */
  title: string;
  conf: number;
  /** The title is what it writes, not what it fires on. */
  writes: boolean;
  silent: boolean;
  /** The share of its activation (a head's: of what it writes) from neurons, heads and the embedding. */
  mix: Mix;
  links: Record<Relation, Link[]>;
  /** Where its neuron's detail is: a units pack, an offset and a length. */
  detail: [number, number, number];
  /** A head's other inputs. */
  query?: HeadInput;
  key?: HeadInput;
}

const NO_LINK = 0xffffffff;
const TITLE_START = 18;
const TITLE_BYTES = 110;
const LINKS_START = 128;
const ENTRY_BYTES = 6;
const THROUGH_SHIFT = 28;

/** A half-precision float, which DataView can't read everywhere yet. */
function half(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 31;
  const fraction = bits & 1023;
  if (exponent === 0) return sign * fraction * 2 ** -24;
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
}

const utf8 = new TextDecoder();

function wireOf(buffer: ArrayBuffer, perRelation: number, relations: readonly string[]): Wire {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let end = TITLE_START;
  while (end < TITLE_START + TITLE_BYTES && bytes[end] !== 0) end += 1;
  const lists = new Map(relations.map((relation, r) => {
    const list: Link[] = [];
    for (let i = 0; i < perRelation; i += 1) {
      const at = LINKS_START + (r * perRelation + i) * ENTRY_BYTES;
      const id = view.getUint32(at, true);
      if (id === NO_LINK) break;
      const value = half(view.getUint16(at + 4, true));
      list.push(relation === "drivesHeads" ? [id % 2 ** THROUGH_SHIFT, value, (id >>> THROUGH_SHIFT) as Through] : [id, value]);
    }
    return [relation, list] as const;
  }));
  const list = (relation: string) => lists.get(relation) ?? [];
  const mixAt = (at: number): Mix => [half(view.getUint16(at, true)), half(view.getUint16(at + 2, true)), half(view.getUint16(at + 4, true))];
  const links = Object.fromEntries(POLE_RELATIONS.map((relation) => [relation, list(relation)])) as Record<Relation, Link[]>;
  const inputs = LINKS_START + relations.length * perRelation * ENTRY_BYTES;
  return {
    title: utf8.decode(bytes.subarray(TITLE_START, end)),
    conf: bytes[0],
    writes: (bytes[1] & 1) !== 0,
    silent: (bytes[1] & 2) !== 0,
    mix: mixAt(12),
    links,
    detail: [bytes[2], view.getUint32(4, true), view.getUint32(8, true)],
    ...(lists.has("qDriven") ? {
      query: { driven: list("qDriven"), heads: list("qHeads"), mix: mixAt(inputs) },
      key: { driven: list("kDriven"), heads: list("kHeads"), mix: mixAt(inputs + 6) },
    } : {}),
  };
}

/** A pole's id across the model, as its links name it. */
export const poleId = (mlp: number, layer: number, neuron: number, pole: number) => layer * 2 * mlp + neuron + (pole < 0 ? mlp : 0);
export const poleOf = (mlp: number, id: number) => {
  const inLayer = id % (2 * mlp);
  return { layer: Math.floor(id / (2 * mlp)), neuron: inLayer % mlp, pole: inLayer >= mlp ? (-1 as const) : (1 as const) };
};
export const headKey = (heads: number, layer: number, head: number) => layer * heads + head;
export const headOf = (heads: number, id: number) => ({ layer: Math.floor(id / heads), head: id % heads });

/** A pole's record: its title, where its detail is, and its connections. `ahead`: not needed yet, so it waits for what is. */
export function loadPoleWire(model: ModelId, id: number, ahead = false) {
  const key = `${model}/wire:${id}`;
  if (!ahead) promote(key);
  return memo(key, async () => {
    const { wire, neuronsPerLayer: mlp, connections } = await loadIndex(model);
    const { layer, neuron, pole } = poleOf(mlp, id);
    return wireOf(await range(`${dataBase(model)}/neurons/L${pad(layer)}/graph.bin`, (neuron + (pole < 0 ? mlp : 0)) * wire, wire, ahead ? key : undefined), connections, POLE_RELATIONS);
  });
}
export function loadHeadWire(model: ModelId, id: number, ahead = false) {
  const key = `${model}/head-wire:${id}`;
  if (!ahead) promote(key);
  return memo(key, async () => {
    const { headWire, connections } = await loadIndex(model);
    return wireOf(await range(`${dataBase(model)}/heads/graph.bin`, id * headWire, headWire, ahead ? key : undefined), connections, HEAD_RELATIONS);
  });
}

/** One neuron's detail, from where its record says it is. */
export const loadNeuron = (model: ModelId, layer: number, neuron: number): Promise<NeuronDetail | null> => memo(`${model}/neuron:${layer}:${neuron}`, async () => {
  const index = await loadIndex(model);
  const [wire, vocab] = await Promise.all([loadPoleWire(model, poleId(index.neuronsPerLayer, layer, neuron, 1)), loadVocab(model)]);
  const [pack, offset, length] = wire.detail;
  if (!length) return null;
  const raw = JSON.parse(await inflated(await range(`${dataBase(model)}/neurons/L${pad(layer)}/units-${pad(pack)}.bin`, offset, length))) as { n: number; poles: [RawPole, RawPole] };
  const { reads = [], orth = [], stream = [] } = index.layerMeta[layer];
  return {
    n: raw.n,
    poles: raw.poles.map((pole) => ({
      ...pole,
      reads: readsOf(reads, pole.reads, vocab),
      orth: readsOf(orth, pole.orth, vocab),
      stream: pole.stream ? readsOf(stream, pole.stream, vocab) : undefined,
      drivers: pairsOf(pole.drivers, vocab),
      media: mediaOf(pole.media, vocab),
    })) as [Pole, Pole],
  };
});
export const loadHeadLayer = (model: ModelId, layer: number) => memo(`${model}/heads:${layer}`, async () => {
  const [file, vocab] = await Promise.all([load<{ layer: number; reads: ReadInfo[]; heads: RawHead[] }>(model, `heads/L${pad(layer)}.json`), loadVocab(model)]);
  return file.heads.map((head): HeadDetail => ({
    ...head,
    reads: readsOf(file.reads, head.reads, vocab),
    outRz: tokensOf(head.outRz, vocab),
    drivers: pairsOf(head.drivers, vocab),
    keys: pairsOf(head.keys, vocab),
  }));
});
/** An image or sound by number, from its block of the media document files. */
export async function loadMediaDoc(model: ModelId, modality: Modality, doc: number, block: number): Promise<MediaDoc | null> {
  const file = await load<{ first: number; docs: MediaDoc[] }>(model, `media/${modality}/d${pad(Math.floor(doc / block), 3)}.json`);
  return file.docs[doc - file.first] ?? null;
}
export const loadMediaCredits = (model: ModelId) => load<MediaCredits>(model, "media/credits.json");

// Shown images and sounds live end to end in pack files, one fetched by an HTTP range. A server that
// ignores the range sends the whole pack, which is then sliced; the last few such packs are kept.
//
// Each image or sound becomes a blob: URL, shared by everyone showing it. Whoever calls mediaUrl holds
// it until they call releaseMedia with the same place; once nobody holds it, it waits among the most
// recently used for a while (going back to a unit is instant) and is revoked when pushed out.
const KEEP_IDLE = 48;
const KEEP_PACKS = 2;
const wholePacks = new Map<string, Promise<ArrayBuffer>>();
interface Held { url: Promise<string>; holders: number; failed: boolean }
const mediaUrls = new Map<string, Held>();
const mediaKey = (model: ModelId, modality: Modality, [pack, offset]: [number, number, number]) => `${model}/${modality}/${pack}#${offset}`;

function wholePack(url: string, response: Response): Promise<ArrayBuffer> {
  const buffer = response.arrayBuffer();
  wholePacks.set(url, buffer);
  while (wholePacks.size > KEEP_PACKS) wholePacks.delete(wholePacks.keys().next().value!);
  buffer.catch(() => wholePacks.delete(url));
  return buffer;
}

export function mediaUrl(model: ModelId, modality: Modality, where: [number, number, number]): Promise<string> {
  const key = mediaKey(model, modality, where);
  let held = mediaUrls.get(key);
  if (held && !held.failed) {
    // Most recently used last, so eviction walks from the front.
    mediaUrls.delete(key);
    mediaUrls.set(key, held);
  } else {
    const [pack, offset, length] = where;
    const url = `${dataBase(model)}/media/${modality}/p${pad(pack, 3)}.bin`;
    const type = modality === "image" ? "image/webp" : "audio/mpeg";
    const made = (async () => {
      let whole = wholePacks.get(url);
      if (!whole) {
        const response = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        if (response.status === 206) return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
        whole = wholePack(url, response);
      }
      return URL.createObjectURL(new Blob([(await whole).slice(offset, offset + length)], { type }));
    })();
    // A failed one stays listed until asked for again, then is fetched afresh under the same entry:
    // whoever held the failure still holds it, so their release can't free someone else's copy.
    const entry: Held = held ?? { url: made, holders: 0, failed: false };
    entry.url = made;
    entry.failed = false;
    made.catch(() => { if (entry.url === made) entry.failed = true; });
    mediaUrls.delete(key);
    mediaUrls.set(key, entry);
    held = entry;
  }
  held.holders += 1;
  return held.url;
}

/** Let go of an image or sound from mediaUrl. Unheld ones past the most recent few are revoked. */
export function releaseMedia(model: ModelId, modality: Modality, where: [number, number, number]) {
  const held = mediaUrls.get(mediaKey(model, modality, where));
  if (held) held.holders = Math.max(0, held.holders - 1);
  let idle = 0;
  for (const entry of mediaUrls.values()) if (entry.holders === 0) idle += 1;
  for (const [key, entry] of mediaUrls) {
    if (idle <= KEEP_IDLE) break;
    if (entry.holders > 0) continue;
    mediaUrls.delete(key);
    idle -= 1;
    entry.url.then((url) => URL.revokeObjectURL(url), () => undefined);
  }
}

function decodeScores(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

// ---------- lenses

export interface LensInfo { short: string; name: string; side: "input" | "output"; describe: string }

export const LENSES: Record<ReadColumn, LensInfo> = {
  read_S: { short: "in·S", name: "Words that trigger it", side: "input", describe: "Input tokens, here or a few positions back, whose presence drives the neuron (the S-lens on its read direction)." },
  read_S_z: { short: "in·S z", name: "Distinctive words that trigger it", side: "input", describe: "The same, scored against the layer's other neurons so that common tokens drop out." },
  read_R: { short: "in·R", name: "Ideas that trigger it", side: "input", describe: "What the model is getting ready to say when this neuron is driven: the concept it responds to (the R-lens on its read direction)." },
  read_R_z: { short: "in·R z", name: "Distinctive ideas that trigger it", side: "input", describe: "The same, scored against the layer's other neurons so that common tokens drop out." },
  write_S: { short: "out·S", name: "Words it acts like", side: "output", describe: "Its push looks to later layers as if these input tokens were present." },
  write_S_z: { short: "out·S z", name: "Distinctive words it acts like", side: "output", describe: "The same, scored against the layer's other neurons." },
  write_R: { short: "out·R", name: "Pushes the model to say", side: "output", describe: "What its push makes the model say (the R-lens on its write)." },
  write_R_z: { short: "out·R z", name: "Distinctive words it pushes the model to say", side: "output", describe: "What's specific to this neuron's push, with tokens every neuron promotes removed." },
  write_orth_R: { short: "orth·R", name: "Adds beyond what it reads", side: "output", describe: "What its push makes the model say once everything it reads is removed from it." },
  write_orth_R_z: { short: "orth·R z", name: "Distinctively adds beyond what it reads", side: "output", describe: "The same, scored against the layer's other neurons." },
  write_orth_S: { short: "orth·S", name: "Footprints it adds beyond what it reads", side: "output", describe: "The input tokens its push imitates once everything it reads is removed from it." },
  write_orth_S_z: { short: "orth·S z", name: "Distinctive footprints it adds", side: "output", describe: "The same, scored against the layer's other neurons." },
  before_R: { short: "before·R", name: "Ideas in the stream", side: "input", describe: "The residual entering its MLP where it fires, averaged over its top firings: what the model is getting ready to say there." },
  before_R_z: { short: "before·R z", name: "Distinctive ideas in the stream", side: "input", describe: "The same, scored against what the layer's other poles see where they fire." },
  before_S: { short: "before·S", name: "Words that put them there", side: "input", describe: "The input tokens that the residual entering its MLP looks like, where it fires." },
  before_S_z: { short: "before·S z", name: "Distinctive words that put them there", side: "input", describe: "The same, scored against what the layer's other poles see where they fire." },
  mlp_R: { short: "mlp·R", name: "Its layer writes", side: "output", describe: "What the whole MLP layer writes where this pole fires: this pole and the neurons firing with it." },
  mlp_R_z: { short: "mlp·R z", name: "Its layer distinctively writes", side: "output", describe: "The same, scored against what the layer writes where its other poles fire." },
  mlp_S: { short: "mlp·S", name: "Footprints its layer writes", side: "output", describe: "The input tokens the layer's output imitates where this pole fires." },
  mlp_S_z: { short: "mlp·S z", name: "Distinctive footprints its layer writes", side: "output", describe: "The same, scored against what the layer writes where its other poles fire." },
  pred: { short: "pred", name: "The model says next", side: "output", describe: "The model's own mean logit where it fires." },
  pred_z: { short: "pred z", name: "The model distinctively says next", side: "output", describe: "The same, scored against what the model says where the layer's other poles fire." },
  ov_R: { short: "OV·R", name: "Copies", side: "output", describe: "Reading a token, what the head makes the model say: each token's place in its own column of the OV map." },
  ov_R_z: { short: "OV·R z", name: "Distinctively copies", side: "output", describe: "The same, scored against the layer's other heads." },
  ov_R_neg: { short: "OV·R −", name: "Suppresses", side: "output", describe: "Reading a token, what the head pushes the model away from saying." },
  ov_R_neg_z: { short: "OV·R − z", name: "Distinctively suppresses", side: "output", describe: "The same, scored against the layer's other heads." },
  ov_S: { short: "OV·S", name: "Copies the footprint of", side: "output", describe: "Reading a token, the head's write looks to later layers as if that token were there." },
  ov_S_z: { short: "OV·S z", name: "Distinctively copies the footprint of", side: "output", describe: "The same, scored against the layer's other heads." },
  ov_S_neg: { short: "OV·S −", name: "Erases the footprint of", side: "output", describe: "Reading a token, the head's write removes that token's footprint." },
  ov_S_neg_z: { short: "OV·S − z", name: "Distinctively erases", side: "output", describe: "The same, scored against the layer's other heads." },
  qk_S: { short: "QK·S", name: "Attends to", side: "input", describe: "Key tokens its average query favours, whatever the query." },
  qk_S_z: { short: "QK·S z", name: "Distinctively attends to", side: "input", describe: "The same, scored against the layer's other heads." },
  qk_S_neg: { short: "QK·S −", name: "Avoids", side: "input", describe: "Key tokens its average query looks away from." },
  qk_S_neg_z: { short: "QK·S − z", name: "Distinctively avoids", side: "input", describe: "The same, scored against the layer's other heads." },
  qk_self_S: { short: "QK self·S", name: "Seeks itself", side: "input", describe: "Tokens that, held at the query, favour an earlier copy of themselves: what duplicate-token heads do." },
  qk_self_S_z: { short: "QK self·S z", name: "Distinctively seeks itself", side: "input", describe: "The same, scored against the layer's other heads." },
  qk_self_R: { short: "QK self·R", name: "Seeks what it's about to say", side: "input", describe: "Tokens that, when the query is about to say them, favour an earlier copy of themselves: how a copy suppressor finds what to hold back (an R-lens query against S-lens keys)." },
  qk_self_R_z: { short: "QK self·R z", name: "Distinctively seeks what it's about to say", side: "input", describe: "The same, scored against the layer's other heads." },
};

// ---------- heads

export const ROLE_INDUCTION = 1;
export const ROLE_DUPLICATE = 2;
export const ROLE_PREVIOUS = 4;
export const ROLE_SELF = 8;
export const ROLE_SINK = 16;
export const ROLE_CARRIES = 32;
export const ROLE_NAMES = 64;

export interface RoleInfo { bit: number; name: string; short: string; describe: string }

/** In order of precedence. */
export const ROLES: RoleInfo[] = [
  { bit: ROLE_INDUCTION, name: "Induction head", short: "Induction", describe: "Continues repeated text: after A B … A, it attends to B and predicts it (score past 0.3)." },
  { bit: ROLE_DUPLICATE, name: "Duplicate-token head", short: "Duplicate", describe: "Attends to earlier copies of the current token (score past 0.3). It copies little, likely marking that the token was seen." },
  { bit: ROLE_PREVIOUS, name: "Previous-token head", short: "Previous", describe: "Attends mostly to the token just before (past 0.5)." },
  { bit: ROLE_SELF, name: "Self-attending head", short: "Self", describe: "Attends mostly to its own position (past 0.5)." },
  { bit: ROLE_SINK, name: "Sink head", short: "Sink", describe: "Puts over 90% of its attention on the first position, a resting place: it acts where it leaves the sink." },
  { bit: ROLE_CARRIES, name: "Carries the image", short: "Carries image", describe: "Zeroing it makes the model worse at telling an image's label from another's (z past 3 over 64 images)." },
  { bit: ROLE_NAMES, name: "Names the image", short: "Names image", describe: "Its output, after an image, promotes that image's class over the others (q < 0.05)." },
];

export const rolesOf = (bits: number) => ROLES.filter((role) => (bits & role.bit) !== 0);
export const primaryRole = (bits: number) => ROLES.find((role) => (bits & role.bit) !== 0) ?? null;
export const PATTERN_NAMES = ["Sink", "Previous", "Self", "Induction", "Duplicate"] as const;
/** The thresholds the catalog names a pattern at. */
export const PATTERN_THRESHOLDS = [0.9, 0.5, 0.5, 0.3, 0.3] as const;

// ---------- ids

export const neuronId = (layer: number, neuron: number) => `L${layer}·n${neuron}`;
export const headId = (layer: number, head: number) => `L${layer}·h${head}`;

export type UnitRef = { unit: "neurons"; layer: number; index: number } | { unit: "heads"; layer: number; index: number };

/** "L8 344", "l8/n344", "8.344", "L8·n344" -> a neuron; "L20h17", "L20 h17", "20.h17" -> a head. */
export function parseRef(query: string, model: ModelInfo): UnitRef | null {
  let text = query.trim();
  // A unit's address pasted whole (this site's, or any path ending /L8/n344 or /L8/h3).
  const path = text.match(/\/L(\d{1,2})\/([nh]\d{1,5})(?:[?#].*)?$/i);
  if (path) text = `L${path[1]} ${path[2]}`;
  const head = text.match(/^l?\s*(\d{1,2})\s*[\s./·:,_-]?\s*h\s*(\d{1,2})$/i);
  if (head) {
    const layer = Number(head[1]);
    const index = Number(head[2]);
    return layer < model.layers && index < model.heads ? { unit: "heads", layer, index } : null;
  }
  // "L8 344", "L8·n344", and "L8n344" (with the n, no separator is needed).
  const neuron = text.match(/^l?\s*(\d{1,2})\s*(?:[\s./·:,_-]\s*n?|n)\s*(\d{1,5})$/i);
  if (!neuron) return null;
  const layer = Number(neuron[1]);
  const index = Number(neuron[2]);
  return layer < model.layers && index < model.mlp ? { unit: "neurons", layer, index } : null;
}

// ---------- tokens and text

/** A token worth showing as a word: not a byte piece, whitespace or bare punctuation. */
export const wordy = (token: string) => !token.startsWith("\u0001") && /[\p{L}\p{N}]/u.test(token);

/** The first few tokens of a list for a summary: words first, or the raw tokens when a unit reads only punctuation. */
export function headline<T extends [string, ...unknown[]]>(list: T[], count = 5): T[] {
  const words = list.filter(([token]) => wordy(token));
  return (words.length ? words : list.filter(([token]) => !token.startsWith("\u0001"))).slice(0, count);
}

export function percent(value: number | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "–";
  const pct = value * 100;
  if (pct === 0) return "0%";
  if (pct < 0.001) return "<0.001%";
  // Firing rates are often hundredths of a percent: keep two significant figures there.
  if (pct < 1) return `${Number(pct.toPrecision(2))}%`;
  return `${pct.toFixed(digits)}%`;
}

/** A count with thousands separators. */
export const formatCount = (value: number) => value.toLocaleString("en-US");

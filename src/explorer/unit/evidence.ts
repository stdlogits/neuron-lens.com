// What a unit's view shows, chosen from its detail: the reads on each side of it, the tokens its
// lists agree on, its tests and figures, and their wording. The About page draws the same.
import { formatValue, stem } from "@stdlogits/ledger";
import {
  FLAG_AUDIO, FLAG_DETECTOR, FLAG_IMAGE, FLAG_PREDICTS, FLAG_SUPPRESSES, LENSES, percent,
  type HeadDetail, type LensRead, type NeuronSide, type Pole, type ReadColumn,
} from "../../lib/data";

/** A figure: its name over its value. Off figures (a test that fails) draw in the softest ink. */
export interface Fact { k: string; v: string; tip?: string; off?: boolean; lang?: string }
/** A family's test: its value as shown ("q 0.005"), whether it fails, and what it tests. */
export interface Test { v: string; off: boolean; tip: string }

/** A side's reads (input under Fires on or Attends to, output under Writes), in the order its depth trusts them. */
export const sideReads = (reads: LensRead[], side: "input" | "output") => reads.filter((read) => LENSES[read.col].side === side);

/** The tip on every "From its weights". */
export const WEIGHTS = "What each lens reads from its weights, in the order this depth trusts them";

/** The tip on a unit's Weights basket. */
export const WEIGHTS_BASKET = "What the lenses read from its weights alone, with no text run through the model";

/** The tips on a head's "How it attends" and "Copying". */
export const ATTENDING = "How its weights choose where to look, and how well that matches what it does";
export const COPYING = "How much it copies, read from its weights and tested at its top firings";

/** The tip on "Beyond what it reads". */
export const ORTH = "What its write says with everything it reads taken out: what it adds of its own";

/** Its write against what it reads, from its weights. */
export const weightFacts = (pole: Pole): Fact[] => {
  const [gate, up] = pole.cos;
  return [
    ...(gate === null ? [] : [{ k: "Toward its gate", v: signed(gate), tip: "The cosine of its write with the gate side of what it reads" }]),
    ...(up === null ? [] : [{ k: "Toward its up side", v: signed(up), tip: "The cosine of its write with the up side of what it reads" }]),
  ];
};

/** Its write against what it reads, at its firings. */
export const streamFacts = (pole: Pole): Fact[] => {
  const [parallel, orthogonal] = pole.flow ?? [null, null];
  return [
    ...(parallel === null ? [] : [{ k: parallel >= 0 ? "Amplifies what it reads" : "Suppresses what it reads", v: `×${Math.abs(parallel).toFixed(2)}`, tip: "Its write along what it reads, as a multiple of that part of the stream, mean over its firings" }]),
    ...(orthogonal === null ? [] : [{ k: "Adds off it", v: `×${orthogonal.toFixed(2)}`, tip: "How much it writes off that direction, on the same scale" }]),
  ];
};

/** A read's family: the read and its distinctive (z) version share one, and one test. */
export const family = (col: ReadColumn) => col.replace(/_z$/, "");

/** Stems named by two or more lists: those tokens get flag 1 (two reads agree). */
export function agreement(lists: string[][]): Set<string> {
  const seen = new Map<string, number>();
  for (const list of lists) for (const key of new Set(list.map(stem))) seen.set(key, (seen.get(key) ?? 0) + 1);
  return new Set([...seen].filter(([key, n]) => n > 1 && key !== "").map(([key]) => key));
}

/** The stems two of a head's lists name: two read families, or a read and what it does in real text. */
export function headAgreement(head: HeadDetail): Set<string> {
  const families = new Map<string, string[]>();
  for (const read of head.reads) if (read.trust !== "weak") families.set(family(read.col), [...(families.get(family(read.col)) ?? []), ...read.tokens.map(([token]) => token)]);
  const measured = [[...head.drivers, ...head.peaks], [...head.keys, ...head.sources], head.outRz].map((list) => list.map(([token]) => token));
  return agreement([...families.values(), ...measured]);
}

/** "94th" */
const ordinal = new Intl.PluralRules("en", { type: "ordinal" });
const SUFFIX: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
export const nth = (n: number) => `${n}${SUFFIX[ordinal.select(n)] ?? "th"}`;

/** The tags beside a neuron's band, from its index flags (known before its detail loads). */
export function neuronTags(flags: number): { label: string; tip: string }[] {
  const tags: { label: string; tip: string }[] = [];
  if (flags & FLAG_IMAGE) tags.push({ label: "Images", tip: "A side fires reliably on one kind of image" });
  if (flags & FLAG_AUDIO) tags.push({ label: "Sound", tip: "A side fires reliably on one kind of sound" });
  if (flags & FLAG_PREDICTS) tags.push({ label: "Predicts", tip: "Fires just before a word it then pushes the model to say" });
  if (flags & FLAG_SUPPRESSES) tags.push({ label: "Suppresses", tip: "Holds back the word the model is about to say" });
  if (flags & FLAG_DETECTOR) tags.push({ label: "Fires on one token", tip: "Most of its top firings land on one token" });
  return tags;
}

/** A q- or p-value, short. */
export const stat = (value: number) => (value < 0.001 ? "< 0.001" : value.toFixed(3));

/** A signed score, two decimals. */
export const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;

// ---------- figures and tests

const SLICES = ["Web", "Chinese", "Code", "Chat"];
/** How often it fires, overall and in each slice of the text; `share` says what is counted ("it fires on"). */
export const oftenFacts = (act: { rate: number; slices: number[] }, share: string): Fact[] => [
  { k: "All text", v: percent(act.rate), tip: `Share of tokens ${share}` },
  ...act.slices.map((rate, i) => ({ k: SLICES[i], v: percent(rate), tip: `Share of tokens ${share} in ${SLICES[i].toLowerCase()} text` })),
];

export const neuronStrength = (pole: Pole): Fact[] => [
  { k: "Typical peak", v: formatValue(pole.act.top), tip: "Its typical value at its top firings" },
  { k: "Top", v: formatValue(pole.act.max), tip: "The largest value seen" },
  { k: "Past the first token", v: percent(pole.act.pos), tip: "Share of its top firings after the first position, where many units fire regardless" },
];

const MISS = "A narrow target: a miss doesn't make the read wrong.";

/** What each side of a neuron's weights, read through each lens, is tested on (findings §7). */
const TARGETS: Record<NeuronSide, string> = {
  read_S: "names the tokens its top firings land on",
  read_R: "names its exact drivers",
  write_S: "names the tokens its top firings land on",
  write_R: "promotes the tokens after its top firings",
};
export const neuronTests = (pole: Pole): Record<string, Test> => (pole.silent ? {} : Object.fromEntries((Object.keys(TARGETS) as NeuronSide[]).map((side) => {
  const q = pole.legible[side];
  return [side, { v: `q ${stat(q)}`, off: !(q <= 0.05), tip: `Whether ${LENSES[side].short} ${TARGETS[side]}. It does under 0.05. ${MISS}` }];
})));

export const headStrength = (head: HeadDetail): Fact[] => [
  { k: "Typical output", v: formatValue(head.act.top), tip: "The typical size of its output at its top firings" },
  { k: "Top", v: formatValue(head.act.max), tip: "The largest output seen" },
];

export const headAttending = (head: HeadDetail, groupSize: number): Fact[] => [
  { k: "Seeks its own token", v: signed(head.copy.self), tip: "QK self: how much a token, as the query, favours an earlier copy of itself" },
  { k: "Looks where its weights say", v: signed(head.copy.qkCtx), tip: "How well its attention read (QK·S) ranks tokens by the attention they get in real text" },
  { k: "Attends to what it copies", v: signed(head.copy.qkOv), tip: "How well its attention read (QK·S) ranks tokens as its copy read (OV·R) does" },
  { k: "Key-value head", v: String(head.kv), tip: groupSize > 1 ? `Shared with ${groupSize - 1} other query ${groupSize - 1 === 1 ? "head" : "heads"} of this layer` : "Its own" },
  ...(groupSize > 1 ? [{ k: "Shared by", v: `${groupSize} heads`, tip: "Query heads that read the same keys and values" }] : []),
];

/** A head's test at its own top firings. Gemma 4's are uncorrected p-values (`test` "p"): with 16 heads a layer, no false-discovery test has the power. */
const headTest = (value: number, what: string, test: "q" | "p"): Test => ({
  v: `${test} ${stat(value)}`,
  off: !(value <= 0.05),
  tip: `${what}. It does under 0.05${test === "p" ? ", uncorrected: with 16 heads a layer, no false-discovery test has the power" : ""}. ${MISS}`,
});

export const headTests = (head: HeadDetail, test: "q" | "p"): Record<string, Test> => ({
  ov_R: headTest(head.legible.ov_R, "Whether OV·R predicts the token after the one it attends to", test),
  ov_S: headTest(head.legible.ov_S, "Whether OV·S predicts its top firings", test),
  qk_S: headTest(head.legible.qk_S, "Whether QK·S predicts the tokens it attends to", test),
});

export const headCopying = (head: HeadDetail, test: "q" | "p"): Fact[] => [
  { k: "Copies what it reads", v: signed(head.copy.ovR), tip: "OV·R: how high each token ranks in its own column of the OV map" },
  { k: "Copies its footprint", v: signed(head.copy.ovS), tip: "OV·S: the same, read through the input embedding" },
  { k: "Copies what it attends to", ...headTest(head.legible.ov_copy, "Whether, at its top firings, it promotes the token it attends to", test) },
];

/** A read's name in a tip: its lens's short name and meaning. */
export const readTip = (read: LensRead) => `${LENSES[read.col].short}. ${LENSES[read.col].describe}`;

/** One read of each family: the normal one, or the distinctive one (scored against the layer) when
 * asked. A normal read that is nothing but tokens every unit shares gives way to its distinctive one. */
export function oneOfEach(reads: LensRead[], distinctive: boolean): LensRead[] {
  const families = new Map<string, LensRead[]>();
  for (const read of reads) families.set(family(read.col), [...(families.get(family(read.col)) ?? []), read]);
  return [...families.values()].map((members) => {
    const normal = members.find((read) => !read.col.endsWith("_z"));
    const distinct = members.find((read) => read.col.endsWith("_z"));
    return (distinctive ? distinct ?? normal : normal?.tokens.length ? normal : distinct ?? normal)!;
  });
}

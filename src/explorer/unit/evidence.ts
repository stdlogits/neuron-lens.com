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

/** A read's family: the read and its z twin share one, and one test. */
export const family = (col: ReadColumn) => col.replace(/_z$/, "");

/** Stems named by two or more lists: those tokens get flag 1 (two reads agree). */
export function agreement(lists: string[][]): Set<string> {
  const seen = new Map<string, number>();
  for (const list of lists) for (const key of new Set(list.map(stem))) seen.set(key, (seen.get(key) ?? 0) + 1);
  return new Set([...seen].filter(([key, n]) => n > 1 && key !== "").map(([key]) => key));
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

/** Each side of a neuron's weights, read through each lens, tested against the pole's own top firings. */
const SIDES: NeuronSide[] = ["read_S", "read_R", "write_S", "write_R"];
export const neuronTests = (pole: Pole): Record<string, Test> => (pole.silent ? {} : Object.fromEntries(SIDES.map((side) => {
  const q = pole.legible[side];
  return [side, { v: `q ${stat(q)}`, off: !(q <= 0.05), tip: `Whether ${LENSES[side].short} predicts this side's own top firings. It holds under 0.05.` }];
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
  tip: `${what}. It holds under 0.05${test === "p" ? ", uncorrected: with 16 heads a layer, no false-discovery test has the power" : ""}.`,
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
export function readTip(read: LensRead, reads: LensRead[]): string {
  const info = LENSES[read.col];
  if (!read.twin) return `${info.short}. ${info.describe}`;
  const first = reads.find((other) => other !== read && family(other.col) === family(read.col));
  return `${info.short}. ${info.describe} Only what ${first ? LENSES[first.col].short : "the read above"} doesn't already list.`;
}

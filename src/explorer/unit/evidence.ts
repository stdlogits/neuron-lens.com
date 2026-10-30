// What a unit's view shows, chosen from its detail: the reads its depth trusts, the tokens two of the
// shown lists agree on, and the wording of its figures.
import {
  FLAG_AUDIO, FLAG_DETECTOR, FLAG_IMAGE, FLAG_PREDICTS, FLAG_SUPPRESSES, LENSES, stem,
  type HeadDetail, type LensRead, type LensToken, type ReadColumn,
} from "../../lib/data";

/** How many tokens a list shows before More evidence. */
export const SHOWN = 10;

/** The read a pole's depth trusts most on one side (every layer names a primary read for each). */
export const primaryRead = (reads: LensRead[], side: "input" | "output") =>
  reads.find((read) => read.trust === "primary" && LENSES[read.col].side === side)
  ?? reads.find((read) => read.trust === "trusted" && LENSES[read.col].side === side);

/** A head's write: its primary OV read (OV·R at every depth so far) and the same family's negative read. */
export function headWrites(head: HeadDetail): { copies?: LensRead; pushes?: LensRead } {
  const copies = head.reads.find((read) => read.trust === "primary" && read.col.startsWith("ov_") && !read.col.includes("neg") && !read.twin)
    ?? head.reads.find((read) => read.col === "ov_R");
  const family = (copies?.col ?? "ov_R").replace(/_z$/, "");
  const pushes = head.reads.find((read) => read.col === (`${family}_neg` as ReadColumn));
  return { copies, pushes };
}

/** Stems named by two or more of the lists shown together: those tokens get flag 1 (two reads agree). */
export function agreement(lists: string[][]): Set<string> {
  const seen = new Map<string, number>();
  for (const list of lists) for (const key of new Set(list.map(stem))) seen.set(key, (seen.get(key) ?? 0) + 1);
  return new Set([...seen].filter(([key, n]) => n > 1 && key !== "").map(([key]) => key));
}

/** A read's tokens with the agreement flag added. */
export const flagged = (tokens: LensToken[], agree: Set<string>): LensToken[] =>
  tokens.map(([token, count, flags]) => [token, count, agree.has(stem(token)) ? flags | 1 : flags]);

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

/** Read names for More evidence: the plain name, its lens's short name and meaning in a tip. */
export function readTip(read: LensRead, reads: LensRead[]): string {
  const info = LENSES[read.col];
  if (!read.twin) return `${info.short}. ${info.describe}`;
  const family = read.col.replace(/_z$/, "");
  const first = reads.find((other) => other !== read && other.col.replace(/_z$/, "") === family);
  return `${info.short}. ${info.describe} Only what ${first ? LENSES[first.col].short : "the read above"} doesn't already list.`;
}


// What a unit's view shows, chosen from its detail: the reads on each side of it, the tokens its
// lists agree on, and the wording of its figures.
import { stem } from "@stdlogits/ledger";
import {
  FLAG_AUDIO, FLAG_DETECTOR, FLAG_IMAGE, FLAG_PREDICTS, FLAG_SUPPRESSES, LENSES,
  type LensRead, type ReadColumn,
} from "../../lib/data";

/** A side's reads (input under Fires on or Attends to, output under Writes), in the order its depth trusts them. */
export const sideReads = (reads: LensRead[], side: "input" | "output") => reads.filter((read) => LENSES[read.col].side === side);

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

/** A read's name in a tip: its lens's short name and meaning. */
export function readTip(read: LensRead, reads: LensRead[]): string {
  const info = LENSES[read.col];
  if (!read.twin) return `${info.short}. ${info.describe}`;
  const first = reads.find((other) => other !== read && family(other.col) === family(read.col));
  return `${info.short}. ${info.describe} Only what ${first ? LENSES[first.col].short : "the read above"} doesn't already list.`;
}

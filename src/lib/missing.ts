// Why an address has no page, as the router reads it (parse, router.svelte.ts), so the missing page can show what is
// wrong with it: a page the router can't read, a model the site doesn't have, or a layer, neuron or head past the
// model's shape. The router decides each kind where it rejects the address; only the model's is a judgement, made here.
import { MODEL_ORDER, type ModelId } from "./models";

export type Missing =
  | { kind: "page"; parts: string[] }
  /** The first part names no model the site has; `typed` is empty for a bare layer (/L8/n344). */
  | { kind: "model"; typed: string; rest: string[] }
  | { kind: "layer"; model: ModelId; asked: number; rest: string[] }
  | { kind: "neuron"; model: ModelId; layer: number; asked: number }
  | { kind: "head"; model: ModelId; layer: number; asked: number };

/** How many single-letter edits (a swap of two neighbours counting as one) turn a into b. */
export function edits(a: string, b: string): number {
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      let value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1);
      row.push(value);
    }
    before = previous;
    previous = row;
  }
  return previous[b.length];
}

export const PAGES = ["about", "credits"];
const FAMILY = /^(qwen|gemma|llama|mistral|mixtral|phi|gpt|olmo|deepseek|claude|falcon|pythia)/i;

/** An address whose first part is no model the site has: read as a model when that part looks like one (close to
 * one, a family's name, a size) or what follows it is a layer, and otherwise as a page. */
export function unknownFirst(parts: string[]): Missing {
  const [first, second] = parts;
  const bare = /^L\d+$/i.test(first);
  const typed = bare ? "" : first;
  const rest = bare ? parts : parts.slice(1);
  const lower = typed.toLowerCase();
  const near = Math.min(...MODEL_ORDER.map((id) => edits(lower, id)));
  const looks = bare || /^(L\d+|heads)$/i.test(second ?? "") || near <= 3 || FAMILY.test(typed) || /\d(\.\d+)?b$/i.test(typed);
  return looks && rest.length <= 2 && !PAGES.includes(lower) ? { kind: "model", typed, rest } : { kind: "page", parts };
}

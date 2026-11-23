// The ways back from a missing page: the place an address points at, clipped to a model's shape (as switching models
// keeps the place); one digit too many dropped; and, for an address the router can't read, the nearest real one.
import { parse } from "../../lib/router.svelte";
import { MODEL_ORDER, MODELS, isModelId, type ModelInfo } from "../../lib/models";
import { PAGES, edits } from "../../lib/missing";

export interface Place { path: string; label: string }

/** The same layer and unit in this model, clipped to its shape; as much of the place as the address names. */
export function clip(model: ModelInfo, rest: string[]): Place {
  if (rest[0] === "heads") return { path: `/${model.id}/heads`, label: `${model.name}’s heads` };
  const L = rest[0]?.match(/^L(\d+)$/i);
  if (!L) return { path: `/${model.id}`, label: model.name };
  const layer = Math.min(Number(L[1]), model.layers - 1);
  if (rest[1] === "heads") return { path: `/${model.id}/L${layer}/heads`, label: `the heads of L${layer}` };
  const unit = rest[1]?.match(/^([nh])(\d+)$/i);
  if (!unit) return { path: `/${model.id}/L${layer}`, label: `layer ${layer}` };
  const kind = unit[1].toLowerCase();
  const index = Math.min(Number(unit[2]), (kind === "h" ? model.heads : model.mlp) - 1);
  return { path: `/${model.id}/L${layer}/${kind}${index}`, label: `L${layer}·${kind}${index}` };
}

/** One typed digit too many: a doubled digit first, then the last, then any other; the first that fits the width. */
export function dropDigit(asked: number, width: number): number | null {
  const s = String(asked);
  const tries: string[] = [];
  for (let i = 1; i < s.length; i += 1) if (s[i] === s[i - 1]) tries.push(s.slice(0, i) + s.slice(i + 1));
  tries.push(s.slice(0, -1));
  for (let i = 0; i < s.length - 1; i += 1) tries.push(s.slice(0, i) + s.slice(i + 1));
  const fit = tries.find((t) => t && !/^0\d/.test(t) && Number(t) < width);
  return fit === undefined ? null : Number(fit);
}

const has = (parts: string[]) => parse(`/${parts.map(encodeURIComponent).join("/")}`).page !== "missing";

/** A real address as a link reads it. */
function named(parts: string[]): string {
  const [first, second, third] = parts;
  if (parts.length === 1 && PAGES.includes(first)) return first[0].toUpperCase() + first.slice(1);
  const model = isModelId(first) ? MODELS[first] : null;
  if (!model) return `/${parts.join("/")}`;
  if (second === undefined) return model.name;
  if (second === "heads") return `${model.name}’s heads`;
  if (third === undefined) return `layer ${second.slice(1)} of ${model.name}`;
  return third === "heads" ? `the heads of ${second}` : `${second}·${third}`;
}

/** The nearest real address when the fix is small: the right case, no leading zeros, a page or model a typo or two
 * away, a part too many dropped, or else the model's own page; null when nothing is close. */
export function repair(parts: string[]): Place | null {
  if (!parts.length) return null;
  const fix = (p: string[]) => {
    const [first, second, third] = p;
    const lower = first.toLowerCase();
    const page = PAGES.find((name) => edits(lower, name) <= 2);
    const model = isModelId(lower) ? lower : MODEL_ORDER.find((id) => edits(lower, id) <= 1);
    const out = [page && !model ? page : model ?? first];
    if (second !== undefined) out.push(second.replace(/^l0*(\d)/i, "L$1"));
    if (third !== undefined) out.push(third.replace(/^([nh])0*(\d)/i, (_, k: string, d: string) => k.toLowerCase() + d));
    return out;
  };
  const found = [fix(parts), fix(parts.slice(0, 3)), fix(parts.slice(0, 2)), fix(parts.slice(0, 1))].find((p) => has(p) && p.join("/") !== parts.join("/"));
  return found ? { path: `/${found.join("/")}`, label: named(found) } : null;
}

// The search's matching, kept apart from its view. Words are matched against the search file's
// forms (stemmed words from the curated neurons' poles and every head, lib/data.ts SearchFile); an ID
// such as "L33 12225" or "L28h6" resolves to its unit directly. A query in another script is also
// looked up in its English, so 熊猫 finds what panda finds.
import { FOREIGN, stem } from "@stdlogits/ledger";
import { matchKey, type Matches } from "../lens.svelte";
import { parseRef, type CatalogIndex, type HeadRow, type SearchFile, type Terms, type Unit } from "../../lib/data";
import type { ModelInfo } from "../../lib/models";

export interface Result {
  unit: Unit;
  layer: number;
  index: number;
  /** 0 the + pole, 1 the − pole, 2 a head. */
  side: 0 | 1 | 2;
  /** The matching pole's or head's label; empty when the unit isn't labelled here. */
  title: string;
  /** The form that matched, as written; empty for an ID. */
  matched: string;
  score: number;
}

export interface Found { results: Result[]; matches: Matches; byId: boolean }

const NONE: Found = { results: [], matches: { neurons: new Set(), heads: new Set() }, byId: false };

/** A head's clearest label among the two this model's checks trust (the card's). */
export function headTitle(row: HeadRow, model: ModelInfo): string {
  const labels = { fires: [row[3], row[6]], attends: [row[4], row[7]], writes: [row[5], row[8]] } as const;
  const [a, b] = model.headCard.map((kind) => labels[kind]);
  return (b[1] > a[1] ? b : a)[0];
}

function matchesOf(list: Result[]): Matches {
  const keys: Matches = { neurons: new Set(), heads: new Set() };
  for (const r of list) keys[r.unit].add(matchKey(r.layer, r.index));
  return keys;
}

/** Resolves an ID, or null when the query isn't one. */
export function findId(query: string, model: ModelInfo, index: CatalogIndex, heads: HeadRow[] | null): Found | null {
  const ref = parseRef(query, model);
  if (!ref) return null;
  let found: Result;
  if (ref.unit === "heads") {
    const row = heads?.find((r) => r[0] === ref.layer && r[1] === ref.index);
    found = { unit: "heads", layer: ref.layer, index: ref.index, side: 2, title: row ? headTitle(row, model) : "", matched: "", score: 1 };
  } else {
    // Any neuron opens: one outside the easiest opens with every neuron of its layer listed.
    const row = index.neurons.find((r) => r[0] === ref.layer && r[1] === ref.index);
    found = { unit: "neurons", layer: ref.layer, index: ref.index, side: 0, title: row?.[2] ?? "", matched: "", score: 1 };
  }
  return { results: [found], matches: matchesOf([found]), byId: true };
}

/** Scores every form against one query word (or phrase), adding into `scores`. */
function score(data: SearchFile, text: string, weight: number, scores: Map<number, { score: number; matched: string }>) {
  const key = stem(text);
  const lower = text.toLowerCase();
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(lower);
  // Keyed by unit: curated neuron poles as ref * 2 + side, heads as 1e6 + layer * heads + head.
  for (const [form, refs] of Object.entries(data.forms)) {
    let factor = 0;
    if (form === key || form === lower) factor = 3;
    else if (key.length >= 2 && form.startsWith(key)) factor = 1.4;
    else if (key.length >= 3 && form.includes(key)) factor = 0.7;
    else if (cjk && form.includes(lower)) factor = 1.2;
    if (!factor) continue;
    for (const [ref, side, w] of refs) {
      const id = side === 2 ? 1e6 + ref : ref * 2 + side;
      const value = w * factor * weight;
      const previous = scores.get(id);
      if (!previous) scores.set(id, { score: value, matched: data.display[form] ?? form });
      else {
        previous.score += value * 0.35;
        if (value > previous.score) previous.matched = data.display[form] ?? form;
      }
    }
  }
}

/** Every unit matching a word, best first. */
export function findWords(query: string, model: ModelInfo, index: CatalogIndex, heads: HeadRow[] | null, data: SearchFile, terms: Terms | null): Found {
  const text = query.trim();
  if (!text) return NONE;
  const scores = new Map<number, { score: number; matched: string }>();
  score(data, text, 1, scores);
  // A word in another script: its English too, a little behind the word itself.
  const english = FOREIGN.test(text) ? terms?.[text]?.[0] : undefined;
  if (english && english.toLowerCase() !== text.toLowerCase()) score(data, english, 0.8, scores);

  const headRow = new Map((heads ?? []).map((row) => [row[0] * model.heads + row[1], row]));
  const all: Result[] = [];
  const seen = new Set<string>();
  for (const [id, hit] of [...scores.entries()].sort((a, b) => b[1].score - a[1].score)) {
    let r: Result;
    if (id >= 1e6) {
      const ref = id - 1e6;
      const row = headRow.get(ref);
      r = { unit: "heads", layer: Math.floor(ref / model.heads), index: ref % model.heads, side: 2, title: row ? headTitle(row, model) : "", matched: hit.matched, score: hit.score };
    } else {
      const row = index.neurons[id >> 1];
      if (!row) continue;
      const side = (id & 1) as 0 | 1;
      r = { unit: "neurons", layer: row[0], index: row[1], side, title: side === 0 ? row[2] : row[3], matched: hit.matched, score: hit.score };
    }
    const k = `${r.unit}:${r.layer}:${r.index}`;
    if (seen.has(k)) continue;
    seen.add(k);
    all.push(r);
  }
  return { results: all, matches: matchesOf(all), byId: false };
}

// The search's matching, kept apart from its view. Words are matched against the search file's
// forms (stemmed words from the curated neurons' poles and every head, lib/data.ts SearchFile); an ID
// such as "L33 12225", "L28h6" or a unit's pasted address resolves to its unit directly, and "L8" or
// "layer 8" to its layer. A query in another script is also looked up in its English, so 熊猫 finds
// what panda finds. Each word of a query counts: units that match every word come first, and one whose
// title holds the whole phrase rises. A word with nothing close among the forms is matched within a
// typo or two of one, marked ≈, and a query that finds nothing offers the nearest word it could mean.
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
  /** Matched only within a typo of what was typed. */
  fuzzy?: boolean;
  /** Its title holds the whole query. */
  titled?: boolean;
}

export interface Found {
  results: Result[];
  matches: Matches;
  byId: boolean;
  /** The words to mark in the results' titles: the query's, their stems, and the forms they matched. */
  terms: string[];
  /** Nothing matched as typed: the nearest word it might mean. */
  suggestion?: string;
  /** "L8" or "layer 8": the layer it names. */
  layer?: number;
  /** A query of several words that no unit matches all of: what is shown matches some. */
  partial?: boolean;
}

const NONE: Found = { results: [], matches: { neurons: new Set(), heads: new Set() }, byId: false, terms: [] };

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
  return { results: [found], matches: matchesOf([found]), byId: true, terms: [] };
}

/** "L8", "layer 8": a layer, or null. */
export function findLayer(query: string, model: ModelInfo): number | null {
  const m = query.trim().match(/^(?:l|layer)\s*(\d{1,2})$/i);
  if (!m) return null;
  const layer = Number(m[1]);
  return layer < model.layers ? layer : null;
}

/** Accents off and lower case, for comparing words and titles. */
export const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** Words that say nothing alone in a query of several. */
const STOP = new Set(["a", "an", "and", "at", "by", "for", "in", "is", "of", "on", "or", "the", "to", "with"]);

/** How many single-letter edits (a swap of two neighbours counting as one) turn a into b, or more than `most`. */
function edits(a: string, b: string, most: number): number {
  if (Math.abs(a.length - b.length) > most) return most + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2] + 1);
      row.push(value);
      least = Math.min(least, value);
    }
    if (least > most) return most + 1;
    before = previous;
    previous = row;
  }
  return previous[b.length];
}
/** How many typos a word may hold: none under four letters, one to six, two from seven. */
const slack = (word: string) => (word.length < 4 ? 0 : word.length < 7 ? 1 : 2);

type Hit = { score: number; matched: string; fuzzy: boolean };

/** Scores every form against one query word (or phrase), into `scores`; returns the nearest form when none was close. */
function score(data: SearchFile, text: string, weight: number, scores: Map<number, Hit>): string | undefined {
  const key = stem(text);
  const lower = text.toLowerCase();
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(lower);
  const add = (refs: [number, 0 | 1 | 2, number][], value: number, form: string, fuzzy: boolean) => {
    // Keyed by unit: curated neuron poles as ref * 2 + side, heads as 1e6 + layer * heads + head.
    for (const [ref, side, w] of refs) {
      const id = side === 2 ? 1e6 + ref : ref * 2 + side;
      const v = w * value;
      const previous = scores.get(id);
      if (!previous) scores.set(id, { score: v, matched: data.display[form] ?? form, fuzzy });
      else {
        if (v > previous.score) { previous.matched = data.display[form] ?? form; previous.fuzzy = previous.fuzzy && fuzzy; }
        previous.score += v * 0.35;
      }
    }
  };
  let close = false;
  for (const [form, refs] of Object.entries(data.forms)) {
    let factor = 0;
    if (form === key || form === lower) factor = 3;
    else if (key.length >= 2 && form.startsWith(key)) factor = 1.4;
    // Inside a longer word only from four letters: "owl" isn't looked for inside "acknowledgement".
    else if (key.length >= 4 && form.includes(key)) factor = 0.7;
    else if (cjk && form.includes(lower)) factor = 1.2;
    if (!factor) continue;
    if (factor >= 1.4) close = true;
    add(refs, factor * weight, form, false);
  }
  if (close || cjk) return undefined;
  // Nothing begins as typed: what lies within a typo or two, and the nearest form, for "did you mean".
  const most = slack(key);
  let nearest: { form: string; d: number; weight: number } | undefined;
  for (const [form, refs] of Object.entries(data.forms)) {
    if (form.length < 3) continue;
    const d = edits(key, form, Math.max(most, 2));
    if (d > Math.max(most, 2)) continue;
    const mass = refs.reduce((sum, [, , w]) => sum + w, 0);
    if (!nearest || d < nearest.d || (d === nearest.d && mass > nearest.weight)) nearest = { form, d, weight: mass };
    if (d <= most) add(refs, (d === 1 ? 1 : 0.45) * weight, form, true);
  }
  return nearest ? data.display[nearest.form] ?? nearest.form : undefined;
}

/** Every unit matching a query's words, best first. */
export function findWords(query: string, model: ModelInfo, index: CatalogIndex, heads: HeadRow[] | null, data: SearchFile, terms: Terms | null): Found {
  const text = query.trim();
  if (!text) return NONE;
  const quoted = /^["“].+["”]$/.test(text);
  const phrase = quoted ? text.slice(1, -1).trim() : text;
  // A run of CJK is one word; elsewhere, each word on its own, without the little ones when there are others.
  let words = /\s/.test(phrase) ? phrase.split(/\s+/).filter(Boolean) : [phrase];
  if (words.length > 1) { const kept = words.filter((w) => !STOP.has(w.toLowerCase())); if (kept.length) words = kept; }

  const perWord: Map<number, Hit>[] = [];
  const suggestions: (string | undefined)[] = [];
  for (const word of words) {
    const scores = new Map<number, Hit>();
    suggestions.push(score(data, word, 1, scores));
    // A word in another script: its English too, a little behind the word itself.
    const english = FOREIGN.test(word) ? terms?.[word]?.[0] : undefined;
    if (english && english.toLowerCase() !== word.toLowerCase()) score(data, english, 0.8, scores);
    perWord.push(scores);
  }

  // Each unit's best per word: every word matched counts in full, a unit missing some falls behind.
  const combined = new Map<number, { score: number; matched: string[]; fuzzy: boolean; count: number }>();
  for (const scores of perWord) {
    for (const [id, hit] of scores) {
      const held = combined.get(id);
      if (!held) combined.set(id, { score: hit.score, matched: [hit.matched], fuzzy: hit.fuzzy, count: 1 });
      else { held.score += hit.score; held.matched.push(hit.matched); held.fuzzy = held.fuzzy || hit.fuzzy; held.count += 1; }
    }
  }

  const headRow = new Map((heads ?? []).map((row) => [row[0] * model.heads + row[1], row]));
  const whole = fold(phrase);
  const all: { r: Result; count: number }[] = [];
  const seen = new Set<string>();
  for (const [id, hit] of combined) {
    let r: Result;
    if (id >= 1e6) {
      const ref = id - 1e6;
      const row = headRow.get(ref);
      r = { unit: "heads", layer: Math.floor(ref / model.heads), index: ref % model.heads, side: 2, title: row ? headTitle(row, model) : "", matched: "", score: 0 };
    } else {
      const row = index.neurons[id >> 1];
      if (!row) continue;
      const side = (id & 1) as 0 | 1;
      r = { unit: "neurons", layer: row[0], index: row[1], side, title: side === 0 ? row[2] : row[3], matched: "", score: 0 };
    }
    const title = fold(r.title);
    const titled = whole.length >= 3 && title.includes(whole);
    if (quoted && !titled) continue;
    // A unit whose own title says what matched (rather than its other side's, or another of a head's labels) rises.
    const said = titled || hit.matched.some((m) => m.length >= 3 && title.includes(fold(m)));
    r.score = hit.score * (titled ? 1.6 : said ? 1.3 : 1) * (hit.fuzzy ? 0.8 : 1);
    r.matched = [...new Set(hit.matched)].join(" · ");
    r.fuzzy = hit.fuzzy;
    r.titled = titled;
    all.push({ r, count: hit.count });
  }
  // Units matching every word come first, whatever the score of one matching fewer.
  all.sort((a, b) => b.count - a.count || b.r.score - a.r.score);
  const results: Result[] = [];
  for (const { r } of all) {
    const k = `${r.unit}:${r.layer}:${r.index}`;
    if (seen.has(k)) continue;
    seen.add(k);
    results.push(r);
  }

  // What to mark in the titles: each word, its stem, and what it matched within a typo.
  const marks = new Set<string>();
  for (const word of words) {
    marks.add(word.toLowerCase());
    const key = stem(word);
    if (key.length >= 3) marks.add(key);
  }
  for (const r of results.slice(0, 60)) if (r.fuzzy) for (const m of r.matched.split(" · ")) if (m.length >= 3) marks.add(m.toLowerCase());
  const exact = results.some((r) => !r.fuzzy);
  const fixes = suggestions.map((word, i) => (word && fold(word) !== fold(words[i]) ? word : undefined));
  const suggestion = !exact && fixes.some(Boolean) ? words.map((word, i) => fixes[i] ?? word).join(" ") : undefined;
  const partial = words.length > 1 && all.length > 0 && all[0].count < words.length;
  return { results, matches: matchesOf(results), byId: false, terms: [...marks].sort((a, b) => b.length - a.length), suggestion, partial };
}

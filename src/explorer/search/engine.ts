// The search's matching, kept apart from its view. Words are matched against the word index's forms
// (lib/data.ts Words: every pole's label words, and every word of the easiest neurons' poles and of every
// head), and each matched form's units are read best first from its postings, the head of a long list only; an ID
// such as "L33 12225", "L28h6" or a unit's pasted address resolves to its unit directly, and "L8" or
// "layer 8" to its layer. A query in another script is also looked up in its English, so 熊猫 finds
// what panda finds. Each word of a query counts: units that match every word come first, and one whose
// title holds the whole phrase rises. A word with nothing close among the forms is matched within a
// typo or two of one, marked ≈, and a query that finds nothing offers the nearest word it could mean.
import { FOREIGN, stem } from "@stdlogits/ledger";
import { matchKey, type Matches } from "../lens.svelte";
import { POSTING, loadPostings, parseRef, poleOf, type CatalogIndex, type HeadRow, type Terms, type Unit, type Words } from "../../lib/data";
import type { ModelInfo } from "../../lib/models";

export interface Result {
  unit: Unit;
  layer: number;
  index: number;
  /** 0 the + pole, 1 the − pole, 2 a head. */
  side: 0 | 1 | 2;
  /** The matching pole's or head's label; empty when the unit isn't labelled, or (for a neuron outside the
   * easiest) not read yet: its record has it (loadPoleWire). */
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
  /** Some word has more units than were read: there are more results than these. */
  more?: boolean;
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
  // Another model's pasted address opens there on Enter; its unit isn't this model's to list.
  if (!ref || ref.model) return null;
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

/** A form a query word reaches: how close (3 the word itself, 1.4 a longer word it starts, 0.7 one it is inside,
 * 1.2 a run of CJK holding it, 1 or 0.45 within a typo or two) and at what weight (an English stand-in's is less). */
interface Reach { form: number; factor: number; fuzzy: boolean }
/** How many forms a word reads, and how many of a form's units: all of a word as typed, the head of the rest. */
const FORMS = 32;
const EXACT = 2048;
const NEAR = 256;

/** The forms one query word (or phrase) reaches, and, when none begins as typed, the nearest form for "did you mean". */
function reach(words: Words, text: string): { reached: Reach[]; nearest?: string } {
  const key = stem(text);
  const lower = text.toLowerCase();
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(lower);
  const reached: Reach[] = [];
  let close = false;
  words.forms.forEach((form, i) => {
    let factor = 0;
    if (form === key || form === lower) factor = 3;
    else if (key.length >= 2 && form.startsWith(key)) factor = 1.4;
    // Inside a longer word only from four letters: "owl" isn't looked for inside "acknowledgement".
    else if (key.length >= 4 && form.includes(key)) factor = 0.7;
    else if (cjk && form.includes(lower)) factor = 1.2;
    if (!factor) return;
    if (factor >= 1.4) close = true;
    reached.push({ form: i, factor, fuzzy: false });
  });
  let nearest: { form: number; d: number; mass: number } | undefined;
  if (!close && !cjk) {
    // Nothing begins as typed: what lies within a typo or two, and the nearest form, for "did you mean".
    const most = slack(key);
    words.forms.forEach((form, i) => {
      if (form.length < 3) return;
      const d = edits(key, form, Math.max(most, 2));
      if (d > Math.max(most, 2)) return;
      const mass = words.counts[i];
      if (!nearest || d < nearest.d || (d === nearest.d && mass > nearest.mass)) nearest = { form: i, d, mass };
      if (d <= most) reached.push({ form: i, factor: d === 1 ? 1 : 0.45, fuzzy: true });
    });
  }
  // The closest forms, the most used first among equals: a short prefix reaches thousands.
  reached.sort((a, b) => b.factor - a.factor || words.counts[b.form] - words.counts[a.form]);
  return { reached: reached.slice(0, FORMS), nearest: nearest ? words.shown[nearest.form] : undefined };
}

type Hit = { score: number; matched: string; fuzzy: boolean; said: boolean };

/** Every unit matching a query's words, best first. */
export async function findWords(query: string, model: ModelInfo, index: CatalogIndex, heads: HeadRow[] | null, words: Words, terms: Terms | null): Promise<Found> {
  // A pasted paragraph is searched by its first few words: each word scans the index, and more would hold up the page.
  const text = query.trim().slice(0, 200);
  if (!text) return NONE;
  const quoted = /^["“].+["”]$/.test(text);
  const phrase = quoted ? text.slice(1, -1).trim() : text;
  // A run of CJK is one word; elsewhere, each word on its own, without the little ones when there are others.
  let asked = /\s/.test(phrase) ? phrase.split(/\s+/).filter(Boolean) : [phrase];
  if (asked.length > 1) { const kept = asked.filter((w) => !STOP.has(w.toLowerCase())); if (kept.length) asked = kept; }
  asked = asked.slice(0, 8);

  // Each word's forms (and a word in another script, its English's, a little behind the word itself).
  const plans = asked.map((word) => {
    const own = reach(words, word);
    const english = FOREIGN.test(word) ? terms?.[word]?.[0] : undefined;
    const also = english && english.toLowerCase() !== word.toLowerCase() ? reach(words, english).reached.map((r) => ({ ...r, factor: r.factor * 0.8 })) : [];
    return { reached: [...own.reached, ...also], nearest: own.nearest };
  });
  const wanted = new Map<number, number>();
  for (const plan of plans) for (const r of plan.reached) wanted.set(r.form, Math.max(wanted.get(r.form) ?? 0, r.factor >= 3 ? EXACT : NEAR));
  const postings = await loadPostings(words, wanted);
  const more = [...postings].some(([form, list]) => list.length < words.counts[form]);

  // Keyed by unit: a pole by its id, a head by HEAD + layer × heads + head.
  const HEAD = 2 ** 23;
  const perWord = plans.map((plan) => {
    const scores = new Map<number, Hit>();
    for (const { form, factor, fuzzy } of plan.reached) {
      const shown = words.shown[form];
      for (const p of postings.get(form) ?? []) {
        const id = p & POSTING.head ? HEAD + (p & POSTING.id) : p & POSTING.id;
        const v = (p >>> POSTING.weightShift) * factor;
        const said = (p & POSTING.said) !== 0;
        const previous = scores.get(id);
        if (!previous) scores.set(id, { score: v, matched: shown, fuzzy, said });
        else {
          if (v > previous.score) { previous.matched = shown; previous.fuzzy = previous.fuzzy && fuzzy; }
          previous.said ||= said;
          previous.score += v * 0.35;
        }
      }
    }
    return scores;
  });

  // Each unit's best per word: every word matched counts in full, a unit missing some falls behind.
  const combined = new Map<number, { score: number; matched: string[]; fuzzy: boolean; count: number; said: number }>();
  for (const scores of perWord) {
    for (const [id, hit] of scores) {
      const held = combined.get(id);
      if (!held) combined.set(id, { score: hit.score, matched: [hit.matched], fuzzy: hit.fuzzy, count: 1, said: Number(hit.said) });
      else { held.score += hit.score; held.matched.push(hit.matched); held.fuzzy = held.fuzzy || hit.fuzzy; held.count += 1; held.said += Number(hit.said); }
    }
  }

  const headRow = new Map((heads ?? []).map((row) => [row[0] * model.heads + row[1], row]));
  const easiest = new Map(index.neurons.map((row) => [`${row[0]}:${row[1]}`, row]));
  const whole = fold(phrase);
  const all: { r: Result; count: number }[] = [];
  const seen = new Set<string>();
  for (const [id, hit] of combined) {
    let r: Result;
    let titled: boolean, said: boolean;
    if (id >= HEAD) {
      const ref = id - HEAD;
      const row = headRow.get(ref);
      r = { unit: "heads", layer: Math.floor(ref / model.heads), index: ref % model.heads, side: 2, title: row ? headTitle(row, model) : "", matched: "", score: 0 };
      const title = fold(r.title);
      titled = whole.length >= 3 && title.includes(whole);
      // A head whose own title says what matched (rather than another of its labels) rises.
      said = titled || hit.matched.some((m) => m.length >= 3 && title.includes(fold(m)));
    } else {
      const { layer, neuron, pole } = poleOf(model.mlp, id);
      const side = pole < 0 ? 1 : 0;
      const row = easiest.get(`${layer}:${neuron}`);
      r = { unit: "neurons", layer, index: neuron, side, title: row ? (side === 0 ? row[2] : row[3]) : "", matched: "", score: 0 };
      // A pole whose title holds the words (the builder marks each word in it), rather than its other side's, rises.
      titled = whole.length >= 3 && hit.said === asked.length;
      said = hit.said > 0;
    }
    if (quoted && !titled) continue;
    r.score = hit.score * (titled ? 1.6 : said ? 1.3 : 1) * (hit.fuzzy ? 0.8 : 1);
    r.matched = [...new Set(hit.matched)].join(" · ");
    r.fuzzy = hit.fuzzy;
    r.titled = titled;
    all.push({ r, count: hit.count });
  }
  // Units matching every word come first, whatever the score of one matching fewer; among equals, a word's
  // units come as its postings put them, the surest labelled first.
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
  for (const word of asked) {
    marks.add(word.toLowerCase());
    const key = stem(word);
    if (key.length >= 3) marks.add(key);
  }
  for (const r of results.slice(0, 60)) if (r.fuzzy) for (const m of r.matched.split(" · ")) if (m.length >= 3) marks.add(m.toLowerCase());
  const exact = results.some((r) => !r.fuzzy);
  const fixes = plans.map((plan, i) => (plan.nearest && fold(plan.nearest) !== fold(asked[i]) ? plan.nearest : undefined));
  const suggestion = !exact && fixes.some(Boolean) ? asked.map((word, i) => fixes[i] ?? word).join(" ") : undefined;
  const partial = asked.length > 1 && all.length > 0 && all[0].count < asked.length;
  return { results, matches: matchesOf(results), byId: false, terms: [...marks].sort((a, b) => b.length - a.length), suggestion, partial, more };
}

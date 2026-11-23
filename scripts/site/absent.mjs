#!/usr/bin/env node
// Picks the missing page's 404 neurons (src/pages/missing/Absent.svelte): 404 of Qwen3-8B's neurons whose own label
// names an absence (not found, missing, nonexistent, vanished, null, empty, lacking), found as the site's search finds
// them, through the word index of the build src/lib/catalog.json names, and read from their graph records. The words
// most about a missing page go first (notfound, http404, nonexistent…), then the broader ones (missing, absent,
// vanish…) a dozen at a time each, until there are 404; a label that holds such a word without being about absence
// (C's void, "gone" as grammar, a shape that is hollow) is passed over. Writes src/pages/missing/absent.json, each
// neuron as [layer, neuron, side (0 the + side, 1 the −), label], by layer. Rerun it when Qwen3-8B's build changes.
//
//   node scripts/site/absent.mjs

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "../../..");
const catalog = JSON.parse(await readFile(join(root, "src/lib/catalog.json"), "utf8"));
const MODEL = "qwen3-8b", MLP = 12288, WIRE = 800, COUNT = 404;
const build = catalog.builds[MODEL];
const manifest = await (await fetch(`${catalog.origin}/${MODEL}/${build}.json`)).json();
const url = (path) => `${catalog.origin}/o/${manifest[path]}`;
const pad = (n) => String(n).padStart(2, "0");
async function range(path, offset, length) {
  const response = await fetch(url(path), { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
  if (response.status !== 206) throw new Error(`${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// The word index as src/lib/data.ts reads it (loadWords): every word front-coded, its postings packed by range.
const file = await (await fetch(url("search/words.json"))).json();
const lines = file.forms.split("\n"), forms = new Array(lines.length);
let before = "";
lines.forEach((line, k) => { before = forms[k] = before.slice(0, line.charCodeAt(0) - 48) + line.slice(1); });
const pack = new Uint16Array(forms.length), offset = new Float64Array(forms.length);
for (let p = 0; p < file.packs.length; p += 1) {
  let at = 0;
  for (let k = file.packs[p]; k < (file.packs[p + 1] ?? forms.length); k += 1) { pack[k] = p; offset[k] = at; at += 4 * file.counts[k]; }
}
/** A word's first n postings: the poles whose title holds it (POSTING in data.ts), best first. */
async function postings(word, n) {
  const k = forms.indexOf(word);
  if (k < 0) return [];
  const m = Math.min(n, file.counts[k]), bytes = await range(`search/p${pad(pack[k])}.bin`, offset[k], 4 * m);
  return [...new Uint32Array(bytes.buffer, 0, m)].filter((v) => !(v & (1 << 22)) && v & (1 << 23)).map((v) => v & ((1 << 22) - 1));
}
/** A pole's title from its graph record (WIRE in the builder: the title at bytes 18 to 128). */
const titles = new Map();
async function pole(id) {
  if (!titles.has(id)) {
    const layer = Math.floor(id / (2 * MLP)), slot = id % (2 * MLP);
    const bytes = await range(`neurons/L${pad(layer)}/graph.bin`, slot * WIRE, WIRE);
    let end = 18;
    while (end < 128 && bytes[end]) end += 1;
    titles.set(id, { layer, neuron: slot % MLP, side: slot >= MLP ? 1 : 0, title: new TextDecoder().decode(bytes.subarray(18, end)) });
  }
  return titles.get(id);
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const ABOUT = /not[- ]?found|notfound|no ?such|nosuch|404|missing|absen[ct]|non-?exist|not exist|vanish|disappear|nothing|nowhere|\bnone\b|\bnull\b|\bnil\b|\bnan\b|\bempt|vacan|devoid|\black\b|lacking|不存在|找不到|缺失|缺席|消失|失踪|没有|空白/i;
const NOT = /participle|C and C\+\+|C-family|C\/C\+\+|C language|static void|data types|keywords|access modifiers|hypothes|nilpotent|unfounded|linked-list|Opening braces|Go language|Go nil|ether,|hedges|values and dismissing|intensifiers|dark poetic|regret|metaphor|stomach|indefinite pronouns|'any' and 'anything'|everything, anything|'otherwise'|software crashes|'except\/other|'again' after|nostalg|already, no longer|hollow|covenant|'just' before|'abs'|unnoticed|fictional|probability and negation|caution and denial|numeric ranges|absurd|type annotations|declarations|signatures|return type|Lisp|Go channel|cons operators|predicate method|superglobal|strangers|sudden change|to do with|unrelated|conditions and circumstances|homelessness|color and hex|'dis-' prefix|'already'|barely|parentheses|'avoid'|keyword-argument|contrastive|alternatives\/disjunction|'or' in|all, any, always|falling short|apostrophes/i;
const CORE = ["http404", "get_object_or_404", "or_404", "resolver404", "notfound", "not-found", "notfounderror", "nosuch", "nosuchelementexception", "missing-pag", "missing-or-deleted-content", "missing-content", "missing-fil", "missing-item", "not-exist", "nonexistent", "nonexistenc", "nothingnes"];
const REST = ["miss", "absent", "absenc", "vanish", "disappear", "noth", "vacant", "nil", "empty", "null", "none", "lack"];

const lists = new Map();
for (const word of [...CORE, ...REST]) lists.set(word, await postings(word, 700));
const chosen = new Map();
async function take(ids) {
  for (const p of await pool(ids, 12, pole)) {
    const key = p.layer * MLP + p.neuron;
    if (chosen.size < COUNT && !chosen.has(key) && p.title && ABOUT.test(p.title) && !NOT.test(p.title)) chosen.set(key, p);
  }
}
for (const word of CORE) await take(lists.get(word));
for (let from = 0; chosen.size < COUNT && from < 700; from += 12) for (const word of REST) if (chosen.size < COUNT) await take(lists.get(word).slice(from, from + 12));
if (chosen.size < COUNT) throw new Error(`only ${chosen.size} neurons found`);

const rows = [...chosen.values()].sort((a, b) => a.layer - b.layer || a.neuron - b.neuron).map((p) => [p.layer, p.neuron, p.side, p.title]);
if (!rows.some(([layer, neuron]) => layer === 18 && neuron === 3025)) throw new Error("L18·n3025, the not-found neuron the page names first, is not among them");
const out = join(root, "src/pages/missing/absent.json");
// A label can quote U+FFFD (a byte token): written as an escape it reads the same and the file stays clean text.
await writeFile(out, `[\n${rows.map((row) => JSON.stringify(row).replaceAll("\ufffd", "\\ufffd")).join(",\n")}\n]\n`);
console.log(`${rows.length} neurons over ${new Set(rows.map((row) => row[0])).size} layers, from build ${build}, into ${out}`);

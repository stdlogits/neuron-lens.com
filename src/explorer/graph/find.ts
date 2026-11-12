// What a search in the full-screen graph finds among the units it shows: a unit by its ID (L8·n344, n344,
// L8 for a whole layer, h3, L8h3), or by its words: in its title, or among the words the search file holds
// for it (what the curated neurons' poles and the heads fire on and are labelled with, search/engine.ts),
// so a word finds a unit whose title says it otherwise. A word in another script also looks for its English.
import { FOREIGN, stem } from "@stdlogits/ledger";
import { findWords } from "../search/engine";
import { matchKey } from "../lens.svelte";
import { parseRef, type CatalogIndex, type HeadRow, type SearchFile, type Terms } from "../../lib/data";
import type { ModelInfo } from "../../lib/models";
import type { GraphNode } from "./trace";

export interface Sources { model: ModelInfo; index: CatalogIndex | null; heads: HeadRow[] | null; file: SearchFile | null; terms: Terms | null }

const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** An ID, or part of one: a layer, a kind and an index, any of which may be left open. */
function idOf(text: string, model: ModelInfo): { layer?: number; kind?: "neuron" | "head"; index?: number } | null {
  const ref = parseRef(text, model);
  if (ref) return { layer: ref.layer, kind: ref.unit === "heads" ? "head" : "neuron", index: ref.index };
  const bare = text.toLowerCase().replace(/[\s·.:,_/+\-−]/g, "");
  const parts = bare.match(/^(?:l(\d{1,2}))?(?:([nh])(\d{1,5}))?$/);
  if (!parts || (!parts[1] && !parts[2])) return null;
  return {
    layer: parts[1] === undefined ? undefined : Number(parts[1]),
    kind: parts[2] === undefined ? undefined : parts[2] === "h" ? "head" : "neuron",
    index: parts[3] === undefined ? undefined : Number(parts[3]),
  };
}

/** The keys of the units a query finds among these, or null for no query. */
export function find(query: string, nodes: GraphNode[], from: Sources): Set<string> | null {
  const text = query.trim();
  if (!text) return null;
  const found = new Set<string>();
  const id = idOf(text, from.model);
  if (id) {
    for (const n of nodes) {
      if ((id.layer === undefined || n.layer === id.layer) && (id.kind === undefined || n.kind === id.kind) && (id.index === undefined || n.index === id.index)) found.add(n.key);
    }
    return found;
  }
  const words = fold(text).split(/\s+/).filter(Boolean);
  const stems = words.map((word) => fold(stem(word)));
  const index = from.index?.id === from.model.id ? from.index : null;
  const fires = from.file && index ? findWords(text, from.model, index, from.heads, from.file, FOREIGN.test(text) ? from.terms : null).matches : null;
  for (const n of nodes) {
    const title = fold(n.wire?.title ?? "");
    const titled = words.every((word, i) => title.includes(word) || (stems[i].length >= 3 && title.includes(stems[i])));
    if (titled || (fires && (n.kind === "head" ? fires.heads : fires.neurons).has(matchKey(n.layer, n.index)))) found.add(n.key);
  }
  return found;
}

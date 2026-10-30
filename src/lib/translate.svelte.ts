// English for text in other languages, machine-translated by Claude Haiku 5.5 when the data is built
// (scripts/neurons/translate.py). Tokens and quoted terms come from terms.json, loaded on first need;
// whole contexts carry their translation in the detail files.
import { loadTerms, type Terms } from "./data";
import { DEFAULT_MODEL, type ModelId } from "./models";

const KEY = "neuron-lens.english";

export const translation = $state<{ on: boolean; terms: Terms | null; failed: boolean; ready: ModelId[] }>({ on: false, terms: null, failed: false, ready: [] });

// Each model has its own terms file. A term means the same whichever model's run translated it, so
// every file loaded is merged into one: a page showing both models' tokens (About) reads them all.
let model: ModelId = DEFAULT_MODEL;
const pending = new Map<ModelId, Promise<void>>();
export function ensureTerms(which: ModelId = model): Promise<void> {
  let loading = pending.get(which);
  if (!loading) {
    loading = loadTerms(which)
      .then((terms) => {
        translation.terms = { ...terms, ...translation.terms };
        translation.ready = [...translation.ready, which];
        translation.failed = false;
      })
      .catch(() => { pending.delete(which); translation.failed = true; });
    pending.set(which, loading);
  }
  return loading;
}

/** Whether the model's own terms (the explorer's current one, by default) have arrived. */
export const termsReady = (which: ModelId = model) => translation.ready.includes(which);

export function setTermsModel(next: ModelId) {
  model = next;
  if (translation.on) void ensureTerms();
}

/** The switch remembers its state per viewer; the page works the same without storage. */
export function setTranslate(on: boolean) {
  translation.on = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* storage blocked */ }
  if (on) void ensureTerms();
}

export function restoreTranslate() {
  try { if (localStorage.getItem(KEY) === "1") setTranslate(true); } catch { /* storage blocked */ }
}

/** Letters outside the Latin script: worth a lookup even before the terms have loaded. */
export const FOREIGN = /[^\P{L}\p{Script=Latin}]/u;
/** Runs of such letters (with their combining marks) inside running text, such as a label's quoted examples. */
export const FOREIGN_RUN = /(?:[^\P{L}\p{Script=Latin}]\p{M}*)+/gu;

export const termFor = (text: string) => translation.terms?.[text.trim()];

/** Whether a token or term may have a translation: non-Latin letters, or a known entry once loaded. */
export const maybeForeign = (text: string) => FOREIGN.test(text) || termFor(text) !== undefined;

/** The English to show inline in place of a term, short enough for a chip. */
export function inlineEnglish(text: string): string {
  if (!translation.on) return "";
  const entry = termFor(text);
  if (!entry?.[0]) return "";
  const english = entry[0];
  return english.length > 28 ? `${english.slice(0, 27)}…` : english;
}

let names: Intl.DisplayNames | null = null;
export function languageName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "language" });
    return (code && names.of(code)) || code;
  } catch {
    return code;
  }
}

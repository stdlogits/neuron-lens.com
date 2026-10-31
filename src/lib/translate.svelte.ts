// English for text in other languages, machine-translated by Claude Haiku 5.5 when the data is built
// (scripts/neurons/translate.py). Tokens and quoted terms come from terms.json, loaded on first need;
// whole contexts carry their translation in the detail files. Ledger draws the English (Token,
// LabelText, Context, the tip); `translator` gives it these, installed in main.ts before the app mounts.
import { FOREIGN, languageName, type Translator } from "@stdlogits/ledger";
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

export const termFor = (text: string) => translation.terms?.[text.trim()];

export const translator: Translator = {
  get on() { return translation.on; },
  /** Non-Latin letters, or a known entry once loaded. */
  maybe: (text) => FOREIGN.test(text) || termFor(text) !== undefined,
  /** Short enough for a chip. */
  inline(text) {
    if (!translation.on) return "";
    const entry = termFor(text);
    if (!entry?.[0]) return "";
    const english = entry[0];
    return english.length > 28 ? `${english.slice(0, 27)}…` : english;
  },
  tip(term, refresh, mayLoad) {
    if (!termsReady() && mayLoad) void ensureTerms().then(refresh);
    const entry = termFor(term);
    if (!entry) return { title: term, sub: termsReady() || (translation.failed && !mayLoad) ? "No translation" : "Translating…" };
    return { title: term, lang: entry[2], roman: entry[1] || undefined, body: entry[0], sub: languageName(entry[2]) };
  },
};

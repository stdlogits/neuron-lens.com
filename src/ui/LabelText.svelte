<script lang="ts">
  import MorphText from "./MorphText.svelte";
  import { FOREIGN_RUN, inlineEnglish } from "../lib/translate.svelte";

  // Prose such as one of Haiku's labels, whose quoted examples may be in another language. Those runs
  // are terms: hovering or focusing one shows its English, and with English on they morph into it.
  // Labels already inside a link or button keep plain spans; standalone ones can focus each term.
  let { text, fallback = "Unclear", interactive = false }: { text: string; fallback?: string; interactive?: boolean } = $props();

  // Punctuation hugging a term stays on its line: a button is an atomic inline even when styled
  // inline, so without this a comma after a focusable term can wrap onto a line of its own.
  const OPEN = /[(\[{«「『《“‘"']+$/u;
  const CLOSE = /^[)\]}»」』》”’"'.,;:!?、。，；：！？…]+/u;
  // A term Haiku already glossed, as in "也 (also)", keeps its own script: the gloss is the translation.
  const GLOSS = /^\s*\(/u;

  const parts = $derived.by(() => {
    const source = text || fallback;
    const out: { text: string; term: boolean; lead?: string; tail?: string; glossed?: boolean }[] = [];
    let last = 0;
    for (const match of source.matchAll(FOREIGN_RUN)) {
      const at = match.index ?? 0;
      const before = source.slice(last, at);
      const lead = before.match(OPEN)?.[0] ?? "";
      if (before.length > lead.length) out.push({ text: before.slice(0, before.length - lead.length), term: false });
      const end = at + match[0].length;
      const tail = source.slice(end).match(CLOSE)?.[0] ?? "";
      out.push({ text: match[0], term: true, lead, tail, glossed: !tail && GLOSS.test(source.slice(end)) });
      last = end + tail.length;
    }
    if (last < source.length) out.push({ text: source.slice(last), term: false });
    return out;
  });
</script>

<span class="label-text">{#each parts as part, i (i)}{#if part.term}{@const english = part.glossed ? "" : inlineEnglish(part.text)}<span class="glue">{part.lead}<svelte:element this={interactive ? "button" : "span"} type={interactive ? "button" : undefined} class="term" class:en={english !== ""} data-term={part.text} lang={english ? "en" : undefined}><MorphText text={english || part.text} numbers={false} />{#if english}<span class="sr-only">{` (translated from ${part.text})`}</span>{/if}</svelte:element>{part.tail}</span>{:else}{part.text}{/if}{/each}</span>

<style>
  .label-text { overflow-wrap: anywhere; }
  .label-text :global(.morph-text) { display: inline; }
  .glue { white-space: nowrap; }
  .term {
    display: inline;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: inherit;
    white-space: normal;
    text-decoration: underline dotted color-mix(in srgb, currentColor 40%, transparent);
    text-underline-offset: 0.2em;
    cursor: help;
  }
  .en { font-style: italic; text-decoration: none; }
</style>

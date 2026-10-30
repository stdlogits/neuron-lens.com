<script lang="ts">
  import MorphText from "./MorphText.svelte";
  import { formatValue, stem, tokenParts } from "../lib/data";
  import { inlineEnglish, maybeForeign } from "../lib/translate.svelte";

  // One token: a wash chip in the text face. A faint dot marks a word start; ×n counts the variants
  // merged into it; a value is what it measured. A token two reads agree on is tinted. With English
  // on, a token from another language morphs into its English and turns italic. Hovering one lights
  // up its variants across the unit (lib/tips.ts), and a foreign token's tip gives its meaning.
  let { token, count = 1, times, flags = 0, value, i = 0 }: {
    token: string;
    /** Variants merged into this token (release, released, Release…). */
    count?: number;
    /** How many times it occurs (among a unit's top firings, say): shown as ×n like variants. */
    times?: number;
    /** 1: another read names it too. 2: it measurably drives or peaks the unit. */
    flags?: number;
    value?: number;
    /** Its place in its list, for the reveal (24 ms apart, 160 ms at most). */
    i?: number;
  } = $props();

  const parts = $derived(tokenParts(token));
  const agree = $derived((flags & 1) !== 0);
  const term = $derived(!parts.byte && !parts.empty && maybeForeign(token) ? token.trim() : undefined);
  const english = $derived(term ? inlineEnglish(term) : "");
  const shown = $derived(english || (parts.empty ? "∅" : parts.text));
  const described = $derived([
    parts.lead ? "word start" : "",
    parts.byte ? "byte piece" : "",
    count > 1 ? `${count} variants` : "",
    times !== undefined ? `${times} times` : "",
    agree ? "two reads agree" : "",
    english ? `translated from ${term}` : "",
  ].filter(Boolean).join(", "));
</script>

<!-- Tokens from other languages are buttons, so a keyboard can reach their translation. -->
<svelte:element
  this={term ? "button" : "span"}
  type={term ? "button" : undefined}
  class="tok rise"
  class:byte={parts.byte}
  class:agree
  class:en={english !== ""}
  style:--i={i}
  data-stem={stem(token)}
  data-term={term}
  lang={english ? "en" : undefined}
><span class="ws" aria-hidden="true">{parts.lead ? "·" : ""}</span>{#if term}<MorphText text={shown} numbers={false} />{:else}{shown}{/if}{#if described}<span class="sr-only">{` (${described})`}</span>{/if}{#if count > 1 || times !== undefined}<span class="n" aria-hidden="true">×{times ?? count}</span>{/if}{#if value !== undefined}<span class="n">{formatValue(value)}</span>{/if}</svelte:element>

<style>
  .tok {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    max-width: 100%;
    margin: 0;
    padding: 2px var(--s2);
    border: 0;
    border-radius: var(--r-chip);
    background: var(--wash);
    color: var(--ink);
    font: var(--type-small);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    text-align: start;
    transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease);
  }
  button.tok { cursor: help; }
  .ws { margin-right: 1px; color: var(--ink3); }
  .ws:empty { display: none; }
  .n { margin-left: 6px; color: var(--ink3); font: var(--type-meta); font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .byte { background: transparent; color: var(--ink3); }
  .agree { background: color-mix(in oklch, var(--tint) 14%, var(--paper)); }
  .en { font-style: italic; }
  @media (hover: hover) { .tok:hover { background: var(--wash2); } .agree:hover { background: color-mix(in oklch, var(--tint) 22%, var(--paper)); } }
  /* Its variants across the unit, while one is hovered. */
  :global(.tok.linked) { background: color-mix(in oklch, var(--tint) 26%, var(--paper)); }
  @media (forced-colors: active) { .tok { border: 1px solid CanvasText; } :global(.tok.linked) { outline: 2px solid Highlight; } }
</style>

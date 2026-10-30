<script lang="ts">
  import { segments, type Context } from "../lib/data";
  import { languageName, translation } from "../lib/translate.svelte";

  // One top firing, on a wash: ⟦ ⟧ marks the token where the unit fired (tinted), ⟪ ⟫ the token an
  // attention head read from (a fainter tint). With English on, a translated context shows its
  // English in italic, its language beside it; the language's tip shows the original.
  let { context, clip = true, i = 0 }: { context: Context; clip?: boolean; i?: number } = $props();

  const english = $derived(translation.on && context[1] ? context[1] : "");
  // Gemma 4's documents open with <bos>: a firing near the start shows that as a quiet mark.
  const BOS = "<bos>";
  const atStart = $derived(context[0].startsWith(BOS));
  const parts = $derived.by(() => {
    const shown = english || context[0];
    const list = segments(shown.startsWith(BOS) ? shown.slice(BOS.length) : shown).map((part) => ({ ...part }));
    if (!clip || list.length < 2) return list;
    const first = list[0];
    const last = list[list.length - 1];
    if (first.mark === null && first.text.length > 72) first.text = `…${first.text.slice(-72)}`;
    if (last.mark === null && last.text.length > 48) last.text = `${last.text.slice(0, 48)}…`;
    return list;
  });
</script>

<p class="ctx rise" class:en={english !== ""} style:--i={i}>{#if atStart}<span class="start" data-tip="The start of the document">⇤</span>{/if}{#each parts as part, j (j)}{#if part.mark}<mark class={part.mark}>{part.text || "␣"}</mark>{:else}{part.text}{/if}{/each}{#if english}<button type="button" class="lang" data-original={context[0]} data-lang={context[2]}>{languageName(context[2] ?? "")}<span class="sr-only">. Original: {context[0]}</span></button>{/if}</p>

<style>
  .ctx {
    margin: 0;
    padding: var(--s3) var(--s4);
    border-radius: var(--r-box);
    background: var(--wash);
    color: var(--ink2);
    font: var(--type-small);
    line-height: 24px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .en { font-style: italic; }
  /* The highlight grows with a shadow, not padding, so the token stays joined to its word. */
  mark { border-radius: 4px; color: var(--ink); }
  mark.hit { background: color-mix(in oklch, var(--tint) 22%, transparent); box-shadow: 0 0 0 2px color-mix(in oklch, var(--tint) 22%, transparent); }
  mark.src { background: color-mix(in oklch, var(--tint) 9%, transparent); box-shadow: 0 0 0 2px color-mix(in oklch, var(--tint) 9%, transparent); }
  .start { margin-right: 6px; color: var(--ink3); cursor: help; }
  .lang {
    margin: 0 0 0 var(--s2);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink3);
    font: var(--type-meta);
    font-weight: 400;
    font-style: normal;
    white-space: nowrap;
    cursor: help;
    transition: color var(--fast) var(--ease);
  }
  @media (hover: hover) { .lang:hover { color: var(--ink); } }
  @media (forced-colors: active) { mark { outline: 2px solid Highlight; } }
</style>

<script lang="ts" module>
  /** One token of a group: a read's token (with its variants and flags), a measured one (with its value) or a counted one. */
  export interface Item { token: string; count?: number; times?: number; flags?: number; value?: number }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { Meter, MorphText, Token } from "@stdlogits/ledger";

  // A titled part of a column: a run of tokens (what the unit fires on in real text, say), or what
  // it holds instead (figures, the reads of its weights), with a share as a meter beside the title.
  let { title, morph = false, tip, items = [], share, empty = "Nothing distinctive", children }: {
    title: string;
    /** The title changes in place, so it morphs. */
    morph?: boolean;
    /** What the group is, for the title's tip. */
    tip?: string;
    items?: Item[];
    /** A share (0–1) and what it is, as a meter beside the title. */
    share?: { value: number; label: string };
    empty?: string;
    children?: Snippet;
  } = $props();
</script>

<div class="group">
  <div class="gh">
    <h3 class="head" data-tip={tip}>{#if morph}<MorphText text={title} numbers={false} />{:else}{title}{/if}</h3>
    {#if share}<Meter value={share.value} label={share.label} />{/if}
  </div>
  {#if children}
    {@render children()}
  {:else if items.length}
    <div class="toks">{#each items as item, i (i)}<Token token={item.token} count={item.count} times={item.times} flags={item.flags} value={item.value} {i} />{/each}</div>
  {:else}
    <p class="meta">{empty}</p>
  {/if}
</div>

<style>
  .group { display: grid; gap: var(--s2); align-content: start; min-width: 0; }
  .gh { display: flex; align-items: center; gap: var(--s2); min-height: 16px; }
  h3[data-tip] { cursor: help; }
  .meta { font-weight: 400; }
</style>

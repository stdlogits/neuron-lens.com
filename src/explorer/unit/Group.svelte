<script lang="ts" module>
  /** One token of a group: a read's token (with its variants and flags) or a measured one (with its value). */
  export interface Item { token: string; count?: number; flags?: number; value?: number }
</script>

<script lang="ts">
  import { Meter, Token } from "@stdlogits/ledger";
  import { nth } from "./evidence";

  // A titled run of tokens: what the unit fires on in real text, or what a read of its weights names,
  // with the read's strength as a meter beside the title.
  let { title, tip, items, pct, scope = "the layer", empty = "Nothing distinctive" }: {
    title: string;
    /** What the group is, for the title's tip. */
    tip?: string;
    items: Item[];
    /** The read's percentile among its peers, 0–100. */
    pct?: number;
    scope?: string;
    empty?: string;
  } = $props();
</script>

<div class="group">
  <div class="gh">
    <h3 class="head" data-tip={tip}>{title}</h3>
    {#if pct !== undefined}<Meter value={pct / 100} label={`${nth(pct)} percentile of ${scope}`} />{/if}
  </div>
  {#if items.length}
    <div class="toks">{#each items as item, i (i)}<Token token={item.token} count={item.count} flags={item.flags} value={item.value} {i} />{/each}</div>
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

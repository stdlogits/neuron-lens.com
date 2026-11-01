<script lang="ts" module>
  /** A family's test: its value as shown ("q 0.005"), whether it fails, and what it tests. */
  export interface Test { v: string; off: boolean; tip: string }
</script>

<script lang="ts">
  import { Meter, Token, stem } from "@stdlogits/ledger";
  import { LENSES, type LensRead } from "../../lib/data";
  import { family, nth, readTip } from "./evidence";

  // One side's reads of the unit's weights, in the order its depth trusts them: each its plain name
  // (the lens and what it measures in a tip), its strength among its peers, its family's test where
  // one applies, and all its tokens. Reads weak at this depth, or whose test fails, are quieter and
  // weak ones come last. A token two lists agree on is tinted.
  let { reads, all, tests = {}, agree, scope = "the layer" }: {
    reads: LensRead[];
    /** Every read of the unit, to name a twin's family. */
    all: LensRead[];
    /** Tests by family. */
    tests?: Record<string, Test>;
    /** Stems the unit's lists agree on, beyond the flags the catalog gives. */
    agree?: Set<string>;
    scope?: string;
  } = $props();

  const ordered = $derived([...reads.filter((read) => read.trust !== "weak"), ...reads.filter((read) => read.trust === "weak")]);
  const lit = (token: string, flags: number) => ((flags & 3) !== 0 || agree?.has(stem(token)) ? 1 : 0);
</script>

<div class="reads">
  {#each ordered as read (read.col)}
    {@const test = tests[family(read.col)]}
    <div class="read" class:quiet={read.trust === "weak" || test?.off}>
      <div class="rh">
        <span class="name" data-tip={readTip(read, all) + (read.trust === "weak" ? " Weak at this depth." : "")}>{LENSES[read.col].name}</span>
        <Meter value={read.pct / 100} label={`${nth(read.pct)} percentile of ${scope}`} />
        {#if test && !read.twin}<span class="q" class:off={test.off} data-tip={test.tip}>{test.v}</span>{/if}
      </div>
      {#if read.tokens.length}
        <div class="toks">{#each read.tokens as [token, count, flags], i (i)}<Token {token} {count} flags={lit(token, flags)} {i} />{/each}</div>
      {:else}
        <p class="meta empty">{read.twin ? "Nothing beyond the read above" : "Only tokens every unit shares"}</p>
      {/if}
    </div>
  {/each}
</div>

<style>
  .reads { display: grid; gap: var(--s5); min-width: 0; }
  .read { display: grid; gap: var(--s2); min-width: 0; }
  .rh { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--s2); }
  .name { color: var(--ink2); font: var(--type-meta); cursor: help; }
  .quiet .name { color: var(--ink3); }
  .q { color: var(--ink2); font: var(--type-meta); font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; cursor: help; }
  .q.off { color: var(--ink3); }
  .empty { font-weight: 400; }
</style>

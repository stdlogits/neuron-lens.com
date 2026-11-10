<script lang="ts">
  import { Meter, MorphText, Swap, Token, stem } from "@stdlogits/ledger";
  import { LENSES, type LensRead } from "../../lib/data";
  import { family, nth, readTip, type Test } from "./evidence";
  import { fit } from "./fit";

  // One side's reads of the unit's weights, in the order its depth trusts them: each its plain name
  // (the lens and what it measures in a tip), its strength among its peers, its family's test where
  // one applies, and all its tokens. Reads weak at this depth, or whose test fails, are quieter and
  // weak ones come last. A token two lists agree on is tinted. Flipping Distinctive keeps each read's
  // place: its name morphs and its tokens give way to the others, while what sits under them slides.
  let { reads, tests = {}, agree, scope = "the layer", skipEmpty = false }: {
    reads: LensRead[];
    /** Tests by family. */
    tests?: Record<string, Test>;
    /** Stems the unit's lists agree on, beyond the flags the catalog gives. */
    agree?: Set<string>;
    scope?: string;
    /** Leave out a read with nothing to list, rather than saying so. */
    skipEmpty?: boolean;
  } = $props();

  const kept = $derived(skipEmpty ? reads.filter((read) => read.tokens.length) : reads);
  const ordered = $derived([...kept.filter((read) => read.trust !== "weak"), ...kept.filter((read) => read.trust === "weak")]);
  const lit = (token: string, flags: number) => ((flags & 3) !== 0 || agree?.has(stem(token)) ? 1 : 0);
</script>

<div class="reads">
  {#each ordered as read (family(read.col))}
    {@const test = tests[family(read.col)]}
    <div class="read" class:quiet={read.trust === "weak" || test?.off}>
      <div class="rh">
        <span class="name" data-tip={readTip(read) + (read.trust === "weak" ? " Weak at this depth." : "")}><MorphText text={LENSES[read.col].name} numbers={false} /></span>
        <Meter value={read.pct / 100} label={`${nth(read.pct)} percentile of ${scope}`} />
        {#if test}<span class="q" class:off={test.off} data-tip={test.tip}>{test.v}</span>{/if}
      </div>
      <div use:fit>
        <div>
          <Swap key={read.col}>
            {#if read.tokens.length}
              <div class="toks">{#each read.tokens as [token, count, flags], i (i)}<Token {token} {count} flags={lit(token, flags)} {i} />{/each}</div>
            {:else}
              <p class="meta empty">Only tokens every unit shares</p>
            {/if}
          </Swap>
        </div>
      </div>
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

<script lang="ts">
  import { Meter, Token } from "@stdlogits/ledger";
  import { LENSES, type LensRead } from "../../lib/data";
  import { nth, readTip } from "./evidence";

  // Every read not shown above, compact: its plain name (the lens and what it measures in a tip),
  // its strength among its peers, and all its tokens. Reads weak at this depth come last, quieter.
  let { reads, all, scope = "the layer" }: { reads: LensRead[]; all: LensRead[]; scope?: string } = $props();

  const ordered = $derived([...reads.filter((read) => read.trust !== "weak"), ...reads.filter((read) => read.trust === "weak")]);
</script>

<div class="reads">
  {#each ordered as read (read.col)}
    <div class="read" class:weak={read.trust === "weak"}>
      <div class="rh">
        <span class="name" data-tip={readTip(read, all) + (read.trust === "weak" ? " Weak at this depth." : "")}>{LENSES[read.col].name}</span>
        <Meter value={read.pct / 100} label={`${nth(read.pct)} percentile of ${scope}`} />
      </div>
      {#if read.tokens.length}
        <div class="toks">{#each read.tokens as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</div>
      {:else}
        <p class="meta empty">{read.twin ? "Nothing beyond the read above" : "Only tokens every unit shares"}</p>
      {/if}
    </div>
  {/each}
</div>

<style>
  .reads { display: grid; gap: var(--s5); min-width: 0; }
  .read { display: grid; gap: var(--s2); min-width: 0; }
  .rh { display: flex; align-items: center; gap: var(--s2); }
  .name { color: var(--ink2); font: var(--type-meta); cursor: help; }
  .weak .name { color: var(--ink3); }
  .empty { font-weight: 400; }
</style>

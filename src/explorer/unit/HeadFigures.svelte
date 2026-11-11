<script lang="ts">
  import Facts from "./Facts.svelte";
  import Group from "./Group.svelte";
  import Pattern from "./Pattern.svelte";
  import type { HeadDetail } from "../../lib/data";
  import { ATTENDING, COPYING, headAttending, headCopying, headStrength, oftenFacts } from "./evidence";

  // A head's figures in one row: how often and how hard it fires, where it looks, how it attends and
  // how much it copies. The About page draws them all; a head's Firings basket stops at where it
  // looks (`weights` false), and its Weights basket has the other two under their columns.
  let { head, groupSize, weights = true }: { head: HeadDetail; groupSize: number; weights?: boolean } = $props();
</script>

<div class="figures">
  <Group title="How often" tip="Share of tokens where it is active, in all text and in each kind"><Facts facts={oftenFacts(head.act, "where it is active")} /></Group>
  <Group title="How hard" tip="How large its output gets"><Facts facts={headStrength(head)} /></Group>
  <div class="pattern"><Group title="Pattern" tip="How closely its attention follows each known pattern"><Pattern pattern={head.pattern} /></Group></div>
  {#if weights}
    <Group title="How it attends" tip={ATTENDING}><Facts facts={headAttending(head, groupSize)} /></Group>
    <Group title="Copying" tip={COPYING}><Facts facts={headCopying(head)} /></Group>
  {/if}
</div>

<style>
  .figures { display: flex; flex-wrap: wrap; align-items: start; gap: var(--s5) var(--s7); min-width: 0; }
  .pattern { flex: 0 1 240px; min-width: 200px; }
</style>

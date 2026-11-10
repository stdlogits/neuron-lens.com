<script lang="ts">
  import Facts from "./Facts.svelte";
  import Group from "./Group.svelte";
  import Reads from "./Reads.svelte";
  import type { LensRead, Pole } from "../../lib/data";
  import { reading } from "../../lib/reading.svelte";
  import { oneOfEach, sideReads, streamFacts } from "./evidence";

  // What the stream holds where a side fires, averaged over its top firings, under the same two
  // columns as its weights: what reaches it, then what its layer writes, what leaves the layer and
  // what the model says next. Each list reads the residual itself, so none of it reached the labeller.
  let { pole, reads }: { pole: Pole; reads: LensRead[] } = $props();
  const shown = $derived(oneOfEach(reads, reading.distinctive));
  const inputs = $derived(sideReads(shown, "input"));
  const outputs = $derived(sideReads(shown, "output"));
  const facts = $derived(streamFacts(pole));
  const firings = $derived(pole.flow?.[2] ?? 0);
</script>

<div class="ev">
  <span aria-hidden="true"></span>
  <div class="col">
    <h4 class="col-head head">What reaches it</h4>
    <Group title="Where it fires" tip={`The residual entering its MLP, averaged over ${firings} top firings`}><Reads reads={inputs} skipEmpty /></Group>
  </div>
  <div class="col">
    <h4 class="col-head head">What leaves it</h4>
    <Group title="Where it fires" tip={`Its layer's output and what follows it, averaged over ${firings} top firings`}><Reads reads={outputs} skipEmpty /></Group>
    {#if facts.length}<Group title="Against what it reads" tip="At its firings: how much of what it reads it scales, and how much it adds off it"><Facts {facts} /></Group>{/if}
  </div>
</div>

<style>
  .ev { display: grid; grid-template-columns: 32px repeat(2, minmax(0, 1fr)); column-gap: var(--s5); row-gap: var(--s6); min-width: 0; }
  .col { display: grid; gap: var(--s5); align-content: start; min-width: 0; }
  .col-head { display: none; }
  @container unit (max-width: 600px) {
    .ev { grid-template-columns: minmax(0, 1fr); }
    .ev > span { display: none; }
    .col-head { display: block; color: var(--ink); }
  }
</style>

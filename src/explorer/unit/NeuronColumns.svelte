<script lang="ts">
  import Group from "./Group.svelte";
  import Reads from "./Reads.svelte";
  import RealText from "./RealText.svelte";
  import Facts from "./Facts.svelte";
  import type { Pole } from "../../lib/data";
  import { reading } from "../../lib/reading.svelte";
  import { ORTH, WEIGHTS, neuronTests, oneOfEach, sideReads, weightFacts } from "./evidence";

  // A neuron side's evidence under its two columns: under Fires on every read of what it reads,
  // under Writes every read of what it writes and of what it adds beyond that. Each read carries its
  // test. The About page draws it as is, naming its columns and, with `measured`, what it fires on in real text.
  let { pole, named = false, measured = true }: { pole: Pole; named?: boolean; measured?: boolean } = $props();

  const reads = $derived(oneOfEach(pole.reads, reading.distinctive));
  const orth = $derived(oneOfEach(pole.orth, reading.distinctive));
  const inputs = $derived(sideReads(reads, "input"));
  const outputs = $derived(sideReads(reads, "output"));
  const tests = $derived(neuronTests(pole));
  const facts = $derived(weightFacts(pole));
</script>

<div class="ev" class:named>
  <span aria-hidden="true"></span>
  <div class="col">
    <h3 class="col-head head">Fires on</h3>
    {#if inputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={inputs} {tests} /></Group>{/if}
    {#if measured}<RealText {pole} next={false} />{/if}
  </div>
  <div class="col">
    <h3 class="col-head head">Writes</h3>
    {#if outputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={outputs} {tests} /></Group>{/if}
    {#if !measured && orth.length}<Group title="Beyond what it reads" tip={ORTH}><Reads reads={orth} /></Group>{/if}
    {#if !measured && facts.length}<Group title="Against what it reads"><Facts {facts} /></Group>{/if}
  </div>
</div>

<style>
  .ev { display: grid; grid-template-columns: 32px repeat(2, minmax(0, 1fr)); column-gap: var(--s5); row-gap: var(--s6); min-width: 0; }
  .col { display: grid; gap: var(--s5); align-content: start; min-width: 0; }
  .col-head { display: none; }
  /* Without the faces table above (on the About page), the columns name themselves and need no gutter for its signs. */
  .named { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .named > span { display: none; }
  .named .col-head { display: block; color: var(--ink); }
  @container unit (max-width: 600px) {
    .ev { grid-template-columns: minmax(0, 1fr); }
    .ev > span { display: none; }
    .col-head { display: block; color: var(--ink); }
    .col { gap: var(--s4); }
  }
</style>

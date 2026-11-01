<script lang="ts">
  import { stem } from "@stdlogits/ledger";
  import Group from "./Group.svelte";
  import Reads from "./Reads.svelte";
  import type { Pole } from "../../lib/data";
  import { WEIGHTS, neuronTests, sideReads } from "./evidence";

  // A neuron side's evidence under its two columns: under Fires on every read of what it reads, then
  // what it fires on in real text and where its top firings peak; under Writes every read of what it
  // writes. Each read carries its test. The About page draws it as is, naming its columns.
  let { pole, named = false }: { pole: Pole; named?: boolean } = $props();

  // A measured token is tinted when a read names it too (the catalog's measured keys); the reads carry their own flags.
  const measured = $derived(new Set(pole.measured));
  const drivers = $derived(pole.drivers.map(([token, value]) => ({ token, value, flags: measured.has(stem(token)) ? 1 : 0 })));
  const peaks = $derived(pole.peaks.map(([token, times]) => ({ token, times, flags: measured.has(stem(token)) ? 1 : 0 })));
  const inputs = $derived(sideReads(pole.reads, "input"));
  const outputs = $derived(sideReads(pole.reads, "output"));
  const tests = $derived(neuronTests(pole));
</script>

<div class="ev" class:named>
  <span aria-hidden="true"></span>
  <div class="col">
    <h3 class="col-head head">Fires on</h3>
    {#if inputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={inputs} all={pole.reads} {tests} /></Group>{/if}
    <Group title="In real text" tip="Tokens that most make it fire, measured in real documents" items={drivers} />
    {#if peaks.length}<Group title="Peaks on" tip="The tokens its top firings land on, and how many of them" items={peaks} />{/if}
  </div>
  <div class="col">
    <h3 class="col-head head">Writes</h3>
    {#if outputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={outputs} all={pole.reads} {tests} /></Group>{/if}
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

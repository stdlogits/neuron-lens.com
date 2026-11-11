<script lang="ts">
  import { stem } from "@stdlogits/ledger";
  import Facts from "./Facts.svelte";
  import Group from "./Group.svelte";
  import HeadRealText from "./HeadRealText.svelte";
  import Reads from "./Reads.svelte";
  import type { HeadDetail } from "../../lib/data";
  import { reading } from "../../lib/reading.svelte";
  import { ATTENDING, COPYING, WEIGHTS, headAgreement, headAttending, headCopying, oneOfEach, sideReads } from "./evidence";

  // A head's evidence under its columns: under Attends to every read of where it looks, under Writes
  // every read of what it copies. With `measured` (the About page, naming them)
  // a Fires on column joins them and each opens with what it does in real text. Without it (the Weights
  // basket) the two columns close on how it attends and copies, and name themselves, since they no
  // longer line up with the three of the faces table.
  let { head, named = false, measured = true, groupSize = 1 }: { head: HeadDetail; named?: boolean; measured?: boolean; groupSize?: number } = $props();

  const agree = $derived(headAgreement(head));
  const lit = (token: string) => (agree.has(stem(token)) ? 1 : 0);
  const shown = $derived(oneOfEach(head.reads, reading.distinctive));
  const inputs = $derived(sideReads(shown, "input"));
  const outputs = $derived(sideReads(shown, "output"));
</script>

<div class="ev" class:named class:weights={!measured}>
  <span aria-hidden="true"></span>
  {#if measured}
    <div class="col">
      <h3 class="col-head head">Fires on</h3>
      <HeadRealText {head} input="query" />
    </div>
  {/if}
  <div class="col">
    <h3 class="col-head head">Attends to</h3>
    {#if measured}<HeadRealText {head} input="key" />{/if}
    {#if inputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={inputs} {agree} scope="all heads" /></Group>{/if}
    {#if !measured}<Group title="How it attends" tip={ATTENDING}><Facts facts={headAttending(head, groupSize)} /></Group>{/if}
  </div>
  <div class="col">
    <h3 class="col-head head">Writes</h3>
    {#if measured && head.outRz.length}
      <Group title="In real text" tip="What its output at its top firings pushes the model to say, against the layer's other heads (R-lens, z)"
        items={head.outRz.map(([token, count]) => ({ token, count, flags: lit(token) }))} />
    {/if}
    {#if outputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={outputs} {agree} scope="all heads" /></Group>{/if}
    {#if !measured}<Group title="Copying" tip={COPYING}><Facts facts={headCopying(head)} /></Group>{/if}
  </div>
</div>

<style>
  .ev { display: grid; grid-template-columns: 32px repeat(3, minmax(0, 1fr)); column-gap: var(--s5); row-gap: var(--s6); min-width: 0; }
  .col { display: grid; gap: var(--s5); align-content: start; min-width: 0; }
  .col-head { display: none; }
  .weights { grid-template-columns: 32px repeat(2, minmax(0, 1fr)); }
  .weights .col-head { display: block; color: var(--ink); }
  /* Without the faces table above (on the About page), the columns name themselves and need no gutter for its signs. */
  .named { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .named > span { display: none; }
  .named .col-head { display: block; color: var(--ink); }
  @container unit (max-width: 600px) {
    .ev { grid-template-columns: minmax(0, 1fr); }
    .ev > span { display: none; }
    .col-head { display: block; color: var(--ink); }
    .col { gap: var(--s4); }
  }
</style>

<script lang="ts">
  import { stem } from "@stdlogits/ledger";
  import Group from "./Group.svelte";
  import Reads from "./Reads.svelte";
  import { percent, type HeadDetail } from "../../lib/data";
  import type { ModelInfo } from "../../lib/models";
  import { WEIGHTS, agreement, family, headTests, sideReads } from "./evidence";

  // A head's evidence under its three columns, each opening with what it does in real text: the
  // query tokens that drive it and its peaks; the key tokens it attends to, what it looked at and
  // every read of where it looks; what its output says, and every read of what it copies. Each read
  // carries its test. The About page draws it as is, naming its columns.
  let { head, model, named = false }: { head: HeadDetail; model: ModelInfo; named?: boolean } = $props();

  // Two lists agree on a token when two read families, or a read and what it does in real text, name it.
  const agree = $derived.by(() => {
    const families = new Map<string, string[]>();
    for (const read of head.reads) if (read.trust !== "weak") families.set(family(read.col), [...(families.get(family(read.col)) ?? []), ...read.tokens.map(([token]) => token)]);
    const measured = [[...head.drivers, ...head.peaks], [...head.keys, ...head.sources], head.outRz].map((list) => list.map(([token]) => token));
    return agreement([...families.values(), ...measured]);
  });
  const lit = (token: string) => (agree.has(stem(token)) ? 1 : 0);
  const measured = (list: [string, number][]) => list.map(([token, value]) => ({ token, value, flags: lit(token) }));
  const counted = (list: [string, number][]) => list.map(([token, times]) => ({ token, times, flags: lit(token) }));
  const inputs = $derived(sideReads(head.reads, "input"));
  const outputs = $derived(sideReads(head.reads, "output"));
  const tests = $derived(headTests(head, model.headTest));
</script>

<div class="ev" class:named>
  <span aria-hidden="true"></span>
  <div class="col">
    <h3 class="col-head head">Fires on</h3>
    <Group title="In real text" tip="As the query: tokens that make its output largest in real documents" items={measured(head.drivers)} />
    {#if head.peaks.length}
      <Group title="Peaks on" tip="The query tokens of its top firings, and how many of them" items={counted(head.peaks)}
        share={{ value: head.modes[0], label: `${percent(head.modes[0])} of its top firings on one query token` }} />
    {/if}
  </div>
  <div class="col">
    <h3 class="col-head head">Attends to</h3>
    <Group title="In real text" tip="As the key: tokens it attends to most in real documents" items={measured(head.keys)} />
    {#if head.sources.length}
      <Group title="Looked at" tip="The tokens it attended to at its top firings, and how many of them" items={counted(head.sources)}
        share={{ value: head.modes[1], label: `${percent(head.modes[1])} of its top firings look at one token` }} />
    {/if}
    {#if inputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={inputs} all={head.reads} {tests} {agree} scope="all heads" /></Group>{/if}
  </div>
  <div class="col">
    <h3 class="col-head head">Writes</h3>
    {#if head.outRz.length}
      <Group title="In real text" tip="What its output at its top firings pushes the model to say, against the layer's other heads (R-lens, z)"
        items={head.outRz.map(([token, count]) => ({ token, count, flags: lit(token) }))} />
    {/if}
    {#if outputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={outputs} all={head.reads} {tests} {agree} scope="all heads" /></Group>{/if}
  </div>
</div>

<style>
  .ev { display: grid; grid-template-columns: 32px repeat(3, minmax(0, 1fr)); column-gap: var(--s5); row-gap: var(--s6); min-width: 0; }
  .col { display: grid; gap: var(--s5); align-content: start; min-width: 0; }
  .col-head { display: none; }
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

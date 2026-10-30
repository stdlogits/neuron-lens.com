<script lang="ts">
  import Context from "../../ui/Context.svelte";
  import Expander from "../../ui/Expander.svelte";
  import HeadMedia from "../media/HeadMedia.svelte";
  import Faces from "./Faces.svelte";
  import Group from "./Group.svelte";
  import HeadMore from "./HeadMore.svelte";
  import Pattern from "./Pattern.svelte";
  import { LENSES, stem, type HeadDetail } from "../../lib/data";
  import type { ModelInfo } from "../../lib/models";
  import { moreEvidence } from "./more.svelte";
  import { SHOWN, agreement, flagged, headWrites } from "./evidence";

  // An attention head, in the neuron's shape: one row of labels (what it fires on, what it attends
  // to, what it writes), its firings with the token it looked at, and the evidence under each column.
  let { head, model, labelled, groupSize }: { head: HeadDetail; model: ModelInfo; labelled: boolean; groupSize: number } = $props();

  const writes = $derived(headWrites(head));
  const drivers = $derived(head.drivers.slice(0, SHOWN));
  const keys = $derived(head.keys.slice(0, SHOWN));
  const copies = $derived(writes.copies?.tokens.slice(0, SHOWN) ?? []);
  const pushes = $derived(writes.pushes?.tokens.slice(0, SHOWN) ?? []);
  const agree = $derived(agreement([drivers, keys, copies, pushes].map((list) => list.map(([token]) => token))));
  const measured = (list: [string, number][]) => list.map(([token, value]) => ({ token, value, flags: agree.has(stem(token)) ? 1 : 0 }));
  const read = (tokens: typeof copies) => flagged(tokens, agree).map(([token, count, flags]) => ({ token, count, flags }));
  const nameOf = (col: keyof typeof LENSES) => `${LENSES[col].name} (${LENSES[col].short})`;

  const rows = $derived([{
    sign: "",
    name: "Labels",
    cells: [
      { label: head.label.fires, confidence: head.label.fc },
      { label: head.label.attends, confidence: head.label.ac },
      { label: head.label.writes, confidence: head.label.wc },
    ],
  }]);
</script>

<div class="unit" data-link-scope>
  <Faces columns={["Fires on", "Attends to", "Writes"]} {rows} {labelled} />

  <section class="fires">
    <div class="fh">
      <h3 class="head">Where it fires</h3>
      <span class="meta key hit">fired here</span>
      <span class="meta key src">looked at</span>
    </div>
    {#each head.contexts.slice(0, 3) as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
  </section>

  <div class="ev">
    <span aria-hidden="true"></span>
    <div class="col">
      <h3 class="col-head head">Fires on</h3>
      <Group title="In real text" tip="As the query: tokens that make its output largest in real documents" items={measured(drivers)} />
    </div>
    <div class="col">
      <h3 class="col-head head">Attends to</h3>
      <Group title="In real text" tip="As the key: tokens it attends to most in real documents" items={measured(keys)} />
      <div class="group">
        <h3 class="head">Pattern</h3>
        <Pattern pattern={head.pattern} />
      </div>
    </div>
    <div class="col">
      <h3 class="col-head head">Writes</h3>
      {#if writes.copies}<Group title="From its weights" tip={nameOf(writes.copies.col)} items={read(copies)} pct={writes.copies.pct} scope="all heads" />{/if}
      {#if writes.pushes}<Group title="Pushes away from" tip={nameOf(writes.pushes.col)} items={read(pushes)} pct={writes.pushes.pct} scope="all heads" />{/if}
    </div>
  </div>

  <HeadMedia {head} />

  <Expander label="More evidence" openLabel="Less evidence" bind:open={moreEvidence.open}>
    <HeadMore {head} {model} {groupSize} shown={[writes.copies?.col, writes.pushes?.col]} />
  </Expander>
</div>

<style>
  .unit { display: grid; gap: var(--s6); min-width: 0; }
  .fires { display: grid; gap: var(--s3); min-width: 0; }
  .fh { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s4); }
  .key { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; }
  .key::before { content: ""; width: 12px; height: 8px; border-radius: 2px; background: color-mix(in oklch, var(--tint) 22%, transparent); }
  .key.src::before { background: color-mix(in oklch, var(--tint) 9%, transparent); }
  .none { font-weight: 400; }
  .ev { display: grid; grid-template-columns: 32px repeat(3, minmax(0, 1fr)); column-gap: var(--s5); row-gap: var(--s6); min-width: 0; }
  .col { display: grid; gap: var(--s5); align-content: start; min-width: 0; }
  .group { display: grid; gap: var(--s2); }
  .col-head { display: none; }
  @container unit (max-width: 600px) {
    .ev { grid-template-columns: minmax(0, 1fr); }
    .ev > span { display: none; }
    .col-head { display: block; color: var(--ink); }
    .col { gap: var(--s4); }
  }
</style>

<script lang="ts">
  import { Context, formatValue, stem } from "@stdlogits/ledger";
  import HeadMedia from "../media/HeadMedia.svelte";
  import Faces from "./Faces.svelte";
  import Facts, { type Fact } from "./Facts.svelte";
  import Group from "./Group.svelte";
  import Pattern from "./Pattern.svelte";
  import Reads, { type Test } from "./Reads.svelte";
  import { percent, type HeadDetail } from "../../lib/data";
  import type { ModelInfo } from "../../lib/models";
  import { agreement, family, sideReads, signed, stat } from "./evidence";

  // An attention head, in the neuron's shape: one row of labels (what it fires on, what it attends
  // to, what it writes), its firings with the token it looked at, and all of its evidence under each
  // column: what it does in real text first, then its figures, then every read of its weights on
  // that side with its test.
  let { head, model, labelled, groupSize }: { head: HeadDetail; model: ModelInfo; labelled: boolean; groupSize: number } = $props();

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

  const SLICES = ["Web", "Chinese", "Code", "Chat"];
  const often = $derived<Fact[]>([
    { k: "All text", v: percent(head.act.rate), tip: "Share of tokens where it is active" },
    ...head.act.slices.map((rate, i) => ({ k: SLICES[i], v: percent(rate), tip: `Share of tokens where it is active in ${SLICES[i].toLowerCase()} text` })),
  ]);
  const strength = $derived<Fact[]>([
    { k: "Typical output", v: formatValue(head.act.top), tip: "The typical size of its output at its top firings" },
    { k: "Top", v: formatValue(head.act.max), tip: "The largest output seen" },
  ]);
  const attending = $derived<Fact[]>([
    { k: "Seeks its own token", v: signed(head.copy.self), tip: "QK self: how much a token, as the query, favours an earlier copy of itself" },
    { k: "Looks where its weights say", v: signed(head.copy.qkCtx), tip: "How well its attention read (QK·S) ranks tokens by the attention they get in real text" },
    { k: "Attends to what it copies", v: signed(head.copy.qkOv), tip: "How well its attention read (QK·S) ranks tokens as its copy read (OV·R) does" },
    { k: "Key-value head", v: String(head.kv), tip: groupSize > 1 ? `Shared with ${groupSize - 1} other query ${groupSize - 1 === 1 ? "head" : "heads"} of this layer` : "Its own" },
    ...(groupSize > 1 ? [{ k: "Shared by", v: `${groupSize} heads`, tip: "Query heads that read the same keys and values" }] : []),
  ]);

  // Its tests at its own top firings: Gemma 4's are uncorrected p-values, since with 16 heads a layer
  // no false-discovery test has the power.
  const test = $derived(model.headTest);
  const tested = (value: number, what: string): Test => ({
    v: `${test} ${stat(value)}`,
    off: !(value <= 0.05),
    tip: `${what}. It holds under 0.05${test === "p" ? ", uncorrected: with 16 heads a layer, no false-discovery test has the power" : ""}.`,
  });
  const tests = $derived<Record<string, Test>>({
    ov_R: tested(head.legible.ov_R, "Whether OV·R predicts the token after the one it attends to"),
    ov_S: tested(head.legible.ov_S, "Whether OV·S predicts its top firings"),
    qk_S: tested(head.legible.qk_S, "Whether QK·S predicts the tokens it attends to"),
  });
  const copying = $derived<Fact[]>([
    { k: "Copies what it reads", v: signed(head.copy.ovR), tip: "OV·R: how high each token ranks in its own column of the OV map" },
    { k: "Copies its footprint", v: signed(head.copy.ovS), tip: "OV·S: the same, read through the input embedding" },
    { k: "Copies what it attends to", ...tested(head.legible.ov_copy, "Whether, at its top firings, it promotes the token it attends to") },
  ]);
  const WEIGHTS = "What each lens reads from its weights, in the order this depth trusts them";

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
  <Faces columns={["Fires on", "Attends to", "Writes"]} {rows} {labelled} note={head.label.note} />

  <section class="fires">
    <div class="fh">
      <h3 class="head">Where it fires</h3>
      <span class="meta key hit">fired here</span>
      <span class="meta key src">looked at</span>
    </div>
    {#each head.contexts as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
  </section>

  <div class="ev">
    <span aria-hidden="true"></span>
    <div class="col">
      <h3 class="col-head head">Fires on</h3>
      <Group title="In real text" tip="As the query: tokens that make its output largest in real documents" items={measured(head.drivers)} />
      {#if head.peaks.length}
        <Group title="Peaks on" tip="The query tokens of its top firings, and how many of them" items={counted(head.peaks)}
          share={{ value: head.modes[0], label: `${percent(head.modes[0])} of its top firings on one query token` }} />
      {/if}
      <Group title="How often"><Facts facts={often} /></Group>
      <Group title="How hard"><Facts facts={strength} /></Group>
    </div>
    <div class="col">
      <h3 class="col-head head">Attends to</h3>
      <Group title="In real text" tip="As the key: tokens it attends to most in real documents" items={measured(head.keys)} />
      {#if head.sources.length}
        <Group title="Looked at" tip="The tokens it attended to at its top firings, and how many of them" items={counted(head.sources)}
          share={{ value: head.modes[1], label: `${percent(head.modes[1])} of its top firings look at one token` }} />
      {/if}
      <Group title="Pattern"><Pattern pattern={head.pattern} /></Group>
      <Group title="How it attends"><Facts facts={attending} /></Group>
      {#if inputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={inputs} all={head.reads} {tests} {agree} scope="all heads" /></Group>{/if}
    </div>
    <div class="col">
      <h3 class="col-head head">Writes</h3>
      {#if head.outRz.length}
        <Group title="In real text" tip="What its output at its top firings pushes the model to say, against the layer's other heads (R-lens, z)"
          items={head.outRz.map(([token, count]) => ({ token, count, flags: lit(token) }))} />
      {/if}
      <Group title="Copying" tip="How much it copies, read from its weights and tested at its top firings"><Facts facts={copying} /></Group>
      {#if outputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={outputs} all={head.reads} {tests} {agree} scope="all heads" /></Group>{/if}
    </div>
  </div>

  <HeadMedia {head} />
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
  .col-head { display: none; }
  @container unit (max-width: 600px) {
    .ev { grid-template-columns: minmax(0, 1fr); }
    .ev > span { display: none; }
    .col-head { display: block; color: var(--ink); }
    .col { gap: var(--s4); }
  }
</style>

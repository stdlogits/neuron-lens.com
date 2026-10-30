<script lang="ts">
  import Context from "../../ui/Context.svelte";
  import LabelText from "../../ui/LabelText.svelte";
  import Token from "../../ui/Token.svelte";
  import Facts, { type Fact } from "./Facts.svelte";
  import Reads from "./Reads.svelte";
  import Row from "./Row.svelte";
  import { formatValue, percent, type HeadDetail, type ReadColumn } from "../../lib/data";
  import type { ModelInfo } from "../../lib/models";
  import { signed, stat } from "./evidence";

  // The rest of a head, compact and quiet: the labeller's note, how often and how hard it fires, how
  // much it copies, which tests hold, its token habits and key-value group, what it read from and
  // wrote at its top firings, every other read, and the rest of its firings.
  let { head, model, groupSize, shown }: { head: HeadDetail; model: ModelInfo; groupSize: number; shown: (ReadColumn | undefined)[] } = $props();

  const SLICES = ["Web", "Chinese", "Code", "Chat"];
  const often = $derived<Fact[]>([
    { k: "All text", v: percent(head.act.rate), tip: "Share of tokens where it is active" },
    ...head.act.slices.map((rate, i) => ({ k: SLICES[i], v: percent(rate), tip: `Share of tokens where it is active in ${SLICES[i].toLowerCase()} text` })),
  ]);
  const strength = $derived<Fact[]>([
    { k: "Typical output", v: formatValue(head.act.top), tip: "The typical size of its output at its top firings" },
    { k: "Top", v: formatValue(head.act.max), tip: "The largest output seen" },
  ]);
  const copying = $derived<Fact[]>([
    { k: "Copies what it reads", v: signed(head.copy.ovR), tip: "OV·R: how high each token ranks in its own column of the OV map" },
    { k: "Copies its footprint", v: signed(head.copy.ovS), tip: "OV·S: the same, read through the input embedding" },
    { k: "Seeks its own token", v: signed(head.copy.self), tip: "QK self: how much a token, as the query, favours an earlier copy of itself" },
    { k: "Attends to what it copies", v: signed(head.copy.qkOv), tip: "How well its attention read (QK·S) ranks tokens as its copy read (OV·R) does" },
    { k: "Looks where its weights say", v: signed(head.copy.qkCtx), tip: "How well its attention read (QK·S) ranks tokens by the attention they get in real text" },
  ]);
  const test = $derived(model.headTest);
  const tests = $derived<Fact[]>([
    { k: "Writes the next token", v: head.legible.ov_R, tip: "OV·R predicts the token after the one it attends to" },
    { k: "Copies what it attends to", v: head.legible.ov_copy, tip: "At its top firings it promotes the token it attends to" },
    { k: "Footprint read holds", v: head.legible.ov_S, tip: "OV·S predicts its top firings" },
    { k: "Attention read holds", v: head.legible.qk_S, tip: "QK·S predicts the tokens it attends to" },
  ].map((fact) => ({ k: fact.k, v: `${test} ${stat(fact.v)}`, off: !(fact.v <= 0.05), tip: `${fact.tip}. It holds under 0.05${test === "p" ? ", uncorrected: with 16 heads a layer, no false-discovery test has the power" : ""}.` })));
  const habits = $derived<Fact[]>([
    { k: "On one query token", v: percent(head.modes[0]), tip: "Share of its top firings on the same query token" },
    { k: "On one attended token", v: percent(head.modes[1]), tip: "Share of its top firings that look at the same token" },
    { k: "Key-value head", v: String(head.kv), tip: groupSize > 1 ? `Shared with ${groupSize - 1} other query ${groupSize - 1 === 1 ? "head" : "heads"} of this layer` : "Its own" },
    ...(groupSize > 1 ? [{ k: "Shared by", v: `${groupSize} heads`, tip: "Query heads that read the same keys and values" }] : []),
  ]);
  const others = $derived(head.reads.filter((read) => !shown.includes(read.col)));
</script>

<div class="more">
  {#if head.label.note}<Row title="Note"><p class="note"><LabelText text={head.label.note} interactive /></p></Row>{/if}
  <Row title="How often"><Facts facts={often} /></Row>
  <Row title="How hard"><Facts facts={strength} /></Row>
  <Row title="Copying" tip="How much it copies, read from its weights"><Facts facts={copying} /></Row>
  <Row title="Tests" tip="Whether each read predicts its own top firings"><Facts facts={tests} /></Row>
  <Row title="Habits"><Facts facts={habits} /></Row>
  {#if head.sources.length}
    <Row title="Looked at" tip="The tokens it attended to at its top firings, and how many of them">
      <div class="toks">{#each head.sources as [token, n], i (i)}<Token {token} times={n} {i} />{/each}</div>
    </Row>
  {/if}
  {#if head.outRz.length}
    <Row title="Writes in context" tip="What its output at its top firings pushes the model to say, against the layer's other heads (R-lens, z)">
      <div class="toks">{#each head.outRz as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</div>
    </Row>
  {/if}
  {#if head.peaks.length}
    <Row title="Peaks on" tip="The query tokens of its top firings, and how many of them">
      <div class="toks">{#each head.peaks as [token, n], i (i)}<Token {token} times={n} {i} />{/each}</div>
    </Row>
  {/if}
  {#if others.length}<Row title="Other reads" tip="What other lenses read from its weights, strongest at this depth first"><Reads reads={others} all={head.reads} scope="all heads" /></Row>{/if}
  {#if head.contexts.length > 3}
    <Row title="More firings">{#each head.contexts.slice(3) as context, i (i)}<Context {context} {i} />{/each}</Row>
  {/if}
</div>

<style>
  .more { display: grid; gap: var(--s5); min-width: 0; padding-bottom: var(--s2); }
  .note { color: var(--ink2); font: var(--type-small); text-wrap: pretty; }
</style>

<script lang="ts">
  import { Context, LabelText, Token, formatValue } from "@stdlogits/ledger";
  import Facts, { type Fact } from "./Facts.svelte";
  import Reads from "./Reads.svelte";
  import Row from "./Row.svelte";
  import { LENSES, percent, type NeuronSide, type Pole, type ReadColumn } from "../../lib/data";
  import { stat } from "./evidence";

  // The rest of one side, compact and quiet: the labeller's note, how often and how hard it fires,
  // which weight reads hold at its own top firings, where it peaks, every other read, and the rest
  // of its firings.
  let { pole, shown }: { pole: Pole; shown: (ReadColumn | undefined)[] } = $props();

  const SLICES = ["Web", "Chinese", "Code", "Chat"];
  const often = $derived<Fact[]>([
    { k: "All text", v: percent(pole.act.rate), tip: "Share of tokens it fires on" },
    ...pole.act.slices.map((rate, i) => ({ k: SLICES[i], v: percent(rate), tip: `Share of tokens it fires on in ${SLICES[i].toLowerCase()} text` })),
  ]);
  const strength = $derived<Fact[]>([
    { k: "Typical peak", v: formatValue(pole.act.top), tip: "Its typical value at its top firings" },
    { k: "Top", v: formatValue(pole.act.max), tip: "The largest value seen" },
    { k: "Past the first token", v: percent(pole.act.pos), tip: "Share of its top firings after the first position, where many units fire regardless" },
  ]);
  const SIDES: NeuronSide[] = ["read_S", "read_R", "write_S", "write_R"];
  const tests = $derived<Fact[]>(SIDES.map((side) => {
    const q = pole.legible[side];
    return { k: LENSES[side].name, v: `q ${stat(q)}`, off: !(q <= 0.05), tip: `${LENSES[side].short}: whether this read predicts its own top firings. It holds under 0.05.` };
  }));
  const others = $derived(pole.reads.filter((read) => !shown.includes(read.col)));
</script>

<div class="more">
  {#if pole.label.note}<Row title="Note"><p class="note"><LabelText text={pole.label.note} interactive /></p></Row>{/if}
  <Row title="How often"><Facts facts={often} /></Row>
  <Row title="How hard"><Facts facts={strength} /></Row>
  {#if !pole.silent}<Row title="Tests" tip="A weight read holds when it predicts the side's own top firings"><Facts facts={tests} /></Row>{/if}
  {#if pole.peaks.length}
    <Row title="Peaks on" tip="The tokens its top firings land on, and how many of them">
      <div class="toks">{#each pole.peaks as [token, n], i (i)}<Token {token} times={n} {i} />{/each}</div>
    </Row>
  {/if}
  {#if others.length}<Row title="Other reads" tip="What other lenses read from its weights, strongest at this depth first"><Reads reads={others} all={pole.reads} /></Row>{/if}
  {#if pole.contexts.length > 3}
    <Row title="More firings">{#each pole.contexts.slice(3) as context, i (i)}<Context {context} {i} />{/each}</Row>
  {/if}
</div>

<style>
  .more { display: grid; gap: var(--s5); min-width: 0; padding-bottom: var(--s2); }
  .note { color: var(--ink2); font: var(--type-small); text-wrap: pretty; }
</style>

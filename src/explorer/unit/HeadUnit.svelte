<script lang="ts">
  import { Context, stem } from "@stdlogits/ledger";
  import HeadMedia from "../media/HeadMedia.svelte";
  import Basket from "./Basket.svelte";
  import BasketBar from "./BasketBar.svelte";
  import Faces from "./Faces.svelte";
  import Group from "./Group.svelte";
  import HeadColumns from "./HeadColumns.svelte";
  import HeadFigures from "./HeadFigures.svelte";
  import HeadRealText from "./HeadRealText.svelte";
  import RealTextGrid from "./RealTextGrid.svelte";
  import type { HeadDetail } from "../../lib/data";
  import type { ModelInfo } from "../../lib/models";
  import { WEIGHTS_BASKET, headAgreement } from "./evidence";

  // An attention head, in the neuron's shape: one row of labels (what it fires on, what it attends
  // to, what it writes), then its evidence in the same three baskets. Firings: where it fires and what
  // it looks at there, how it handles images and sound, how often and how hard. Weights: what the
  // lenses read of its QK and OV maps. Stream: what its output says where it fires.
  let { head, model, labelled, groupSize }: { head: HeadDetail; model: ModelInfo; labelled: boolean; groupSize: number } = $props();

  const rows = $derived([{
    sign: "",
    name: "Labels",
    cells: [
      { label: head.label.fires, confidence: head.label.fc },
      { label: head.label.attends, confidence: head.label.ac },
      { label: head.label.writes, confidence: head.label.wc },
    ],
  }]);
  const agree = $derived(headAgreement(head));
  const written = $derived(head.outRz.map(([token, count]) => ({ token, count, flags: agree.has(stem(token)) ? 1 : 0 })));

  const FIRINGS = "What it does in real text: where it fires, what it looks at there, and how often and how hard";
  const STREAM = "What its own output holds where it fires. None of this reached the labeller.";
  const baskets = $derived([
    { value: "firings", label: "Firings", hint: FIRINGS },
    { value: "weights", label: "Weights", hint: WEIGHTS_BASKET },
    ...(written.length ? [{ value: "stream", label: "Stream", hint: STREAM }] : []),
  ]);
</script>

<div class="unit" data-link-scope>
  <Faces columns={["Fires on", "Attends to", "Writes"]} {rows} {labelled} note={head.label.note} />
  <BasketBar {baskets} />

  <div class="stack">
    <Basket id="firings" title="Firings" tip={FIRINGS}>
      <HeadMedia {head} />
      <div class="fires">
        <div class="keys">
          <span class="meta key hit" data-tip="The token where its output was largest">fired here</span>
          <span class="meta key src" data-tip="The token it attended to most from there">looked at</span>
        </div>
        {#each head.contexts as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
      </div>
      <RealTextGrid><HeadRealText {head} /></RealTextGrid>
      <HeadFigures {head} {model} {groupSize} weights={false} />
    </Basket>

    <Basket id="weights" title="Weights" tip={WEIGHTS_BASKET}>
      <HeadColumns {head} {model} {groupSize} measured={false} />
    </Basket>

    {#if written.length}
      <Basket id="stream" title="Stream" tip={STREAM}>
        <Group title="Pushes the model to say" tip="What its output at its top firings pushes the model to say, against the layer's other heads (R-lens, z)" items={written} />
      </Basket>
    {/if}
  </div>
</div>

<style>
  .unit { display: grid; gap: var(--s4); min-width: 0; }
  .stack { display: grid; gap: var(--s7); min-width: 0; }
  .fires { display: grid; gap: var(--s3); min-width: 0; }
  .keys { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s4); }
  .key { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; cursor: help; }
  .key::before { content: ""; width: 12px; height: 8px; border-radius: 2px; background: color-mix(in oklch, var(--tint) 22%, transparent); }
  .key.src::before { background: color-mix(in oklch, var(--tint) 9%, transparent); }
  .none { font-weight: 400; }
</style>

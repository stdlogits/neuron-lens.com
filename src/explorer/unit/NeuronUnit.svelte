<script lang="ts">
  import { Context, Swap } from "@stdlogits/ledger";
  import NeuronMedia from "../media/NeuronMedia.svelte";
  import Basket from "./Basket.svelte";
  import BasketBar from "./BasketBar.svelte";
  import Faces from "./Faces.svelte";
  import Facts from "./Facts.svelte";
  import Group from "./Group.svelte";
  import NeuronColumns from "./NeuronColumns.svelte";
  import RealText from "./RealText.svelte";
  import RealTextGrid from "./RealTextGrid.svelte";
  import Stream from "./Stream.svelte";
  import { useLens } from "../lens.svelte";
  import type { NeuronDetail } from "../../lib/data";
  import { WEIGHTS_BASKET, neuronStrength, oftenFacts } from "./evidence";

  // A neuron: its two sides as the rows of the faces table, then the chosen side's evidence in three
  // baskets. Firings: where and how it fires. Weights: what the lenses read of its wiring. Stream:
  // what the residual holds where it fires. The side is the lens's, so the graph beside it follows;
  // while the next unit loads and this one is still on screen, it keeps the side it has.
  let { detail, layer, labelled }: { detail: NeuronDetail; layer: number; labelled: boolean } = $props();
  const lens = useLens();
  let held: 0 | 1 = 0;
  const side = $derived.by<0 | 1>(() => {
    if (lens.neuronDetail === detail) held = lens.side;
    return held;
  });
  const pole = $derived(detail.poles[side]);

  const rows = $derived(detail.poles.map((p) => ({
    sign: p.pole > 0 ? "+" : "−",
    name: p.pole > 0 ? "Positive side" : "Negative side",
    tip: `Where its activation is ${p.pole > 0 ? "positive" : "negative"}, and what it writes then. Its two sides are read apart.`,
    cells: [
      { label: p.label.fires, confidence: p.label.fc },
      { label: p.label.writes, confidence: p.label.wc },
    ],
  })));
  const panel = $props.id();
  const FIRINGS = "What it does in real text: where this side fires, what the model says next there, and how often and how hard";
  const STREAM = "What the residual stream holds where this side fires, before and after its layer. None of this reached the labeller.";
  const baskets = $derived([
    { value: "firings", label: "Firings", hint: FIRINGS },
    { value: "weights", label: "Weights", hint: WEIGHTS_BASKET },
    ...(pole.stream ? [{ value: "stream", label: "Stream", hint: STREAM }] : []),
  ]);
</script>

<div class="unit" data-link-scope>
  <Faces columns={["Fires on", "Writes"]} {rows} bind:selected={() => side, (next) => lens.setSide(next as 0 | 1)} {labelled} note={pole.label.note} {panel} />
  <BasketBar {baskets} />

  <div class="side" id={panel} role="tabpanel" aria-label={rows[side].name}>
    <Swap key={side}>
      <div class="stack">
        <Basket id="firings" title="Firings" tip={FIRINGS}>
          <NeuronMedia {pole} {layer} neuron={detail.n} />
          <div class="fires">
            {#each pole.contexts as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
          </div>
          <RealTextGrid><RealText {pole} /></RealTextGrid>
          <div class="figures">
            <Group title="How often" tip="Share of tokens it fires on, in all text and in each kind"><Facts facts={oftenFacts(pole.act, "it fires on")} /></Group>
            <Group title="How hard" tip="How large its activation gets"><Facts facts={neuronStrength(pole)} /></Group>
          </div>
        </Basket>

        <Basket id="weights" title="Weights" tip={WEIGHTS_BASKET}>
          <NeuronColumns {pole} measured={false} />
        </Basket>

        {#if pole.stream}
          <Basket id="stream" title="Stream" tip={STREAM}>
            <Stream {pole} reads={pole.stream} />
          </Basket>
        {/if}
      </div>
    </Swap>
  </div>
</div>

<style>
  .unit { display: grid; gap: var(--s4); min-width: 0; }
  .stack { display: grid; gap: var(--s7); min-width: 0; }
  .fires { display: grid; gap: var(--s3); min-width: 0; }
  .none { font-weight: 400; }
  .figures { display: flex; flex-wrap: wrap; align-items: start; gap: var(--s5) var(--s7); min-width: 0; }
</style>

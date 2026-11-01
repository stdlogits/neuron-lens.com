<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import { Meter, Segmented, Swap, Token } from "@stdlogits/ledger";
  import NeuronColumns from "../../explorer/unit/NeuronColumns.svelte";
  import HeadColumns from "../../explorer/unit/HeadColumns.svelte";
  import { loadHeadLayer, loadNeuron, type HeadDetail, type Pole } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { GROUPS, OWL } from "./specimens";

  // The evidence under a unit's labels, as the explorer draws it: the owl side's two columns or the
  // groups head's three, chosen by a switch, under a key to the marks they carry.
  const qwen = MODELS[OWL.model];
  const gemma = MODELS[GROUPS.model];
  let pole = $state<Pole | null>(null);
  let head = $state<HeadDetail | null>(null);
  let failed = $state(false);
  let shown = $state<"neuron" | "head">("neuron");
  const choices = [{ value: "neuron" as const, label: "A neuron" }, { value: "head" as const, label: "A head" }];

  function load() {
    loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => { pole = d?.poles.find((p) => p.pole === 1) ?? null; failed ||= !pole; }, () => (failed = true));
    loadHeadLayer(GROUPS.model, GROUPS.layer).then((list) => { head = list.find((h) => h.h === GROUPS.h) ?? null; failed ||= !head; }, () => (failed = true));
  }
</script>

<Part id="evidence" title="Evidence" onnear={load}>
  {#snippet caption()}
    <p>There are two sources of evidence for a unit's meaning.</p> 
    <p><b>Its weights</b>: what the lenses directly read from the unit's weights, finding the tokens it fires on to or pushes toward.</p>
    <p><b>Its firings</b>: what happens to the unit when the model runs, finding the tokens that empirically made it fire the hardest.</p>
    <p>Neither method is infallible, but when they agree, it's pretty compelling evidence for the unit's purpose.</p>
  {/snippet}
  <div class="spec">
    <dl class="marks" style:--tint={depthColor(qwen, OWL.layer)}>
      <div><dt><Meter value={0.8} label="A read's strength" /></dt><dd>how strong a read is, against the rest of its layer</dd></div>
      <div><dt><span class="q">q 0.005</span></dt><dd>its test: under 0.05, the read predicts where the unit fires</dd></div>
      <div><dt><span class="q off">q 0.72</span></dt><dd>a failed test: the read goes quiet</dd></div>
      <div><dt><Token token="owl" flags={1} /></dt><dd>two lists agree on this token</dd></div>
      <div><dt><Token token=" owl" count={2} /></dt><dd>· starts a word; ×2 merges its variants</dd></div>
      <div><dt><Token token=" owl" value={11} /></dt><dd>how hard it makes the unit fire</dd></div>
    </dl>
    <div class="pick"><Segmented options={choices} value={shown} onchange={(value) => (shown = value)} label="Which unit" /></div>
    <Swap key={`${shown}:${pole !== null && head !== null}`}>
      {#if shown === "neuron" && pole}
        <div class="pg-unit" data-link-scope style:--tint={depthColor(qwen, OWL.layer)}>
          <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
          <NeuronColumns {pole} named />
        </div>
      {:else if shown === "head" && head}
        <div class="pg-unit" data-link-scope style:--tint={depthColor(gemma, GROUPS.layer)}>
          <UnitLink model={GROUPS.model} layer={GROUPS.layer} head={GROUPS.h} />
          <HeadColumns {head} model={gemma} named />
        </div>
      {:else}
        <div>{#if failed}<p class="meta">This specimen didn't load.</p>{:else}<span class="ghost"></span>{/if}</div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; justify-items: stretch; gap: var(--s5); min-width: 0; }
  .pick { justify-self: start; }
  .marks { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--s3) var(--s5); margin: 0; padding: var(--s4) var(--s5); border-radius: var(--r-row); background: var(--wash); }
  .marks > div { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: var(--s3); }
  .marks dt { display: flex; align-items: center; }
  .marks dd { margin: 0; color: var(--ink2); font: var(--type-small); }
  .marks :global(.tok) { background: var(--paper); }
  .marks :global(.tok.agree) { background: color-mix(in oklch, var(--tint) 14%, var(--paper)); }
  .q { color: var(--ink2); font: var(--type-meta); font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .q.off { color: var(--ink3); }
  .ghost { display: block; height: 320px; border-radius: var(--r-row); background: var(--wash); }
</style>

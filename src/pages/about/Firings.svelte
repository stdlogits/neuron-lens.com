<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import { Context, Swap, type ContextLine } from "@stdlogits/ledger";
  import { loadHeadLayer, loadNeuron, type Pole } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { GROUPS, OWL } from "./specimens";

  // Where a unit fires, as the explorer draws it: the owl side's top firings with the token it fired
  // on marked, and the groups head's, which also mark the token it looked back at.
  const qwen = MODELS[OWL.model];
  const gemma = MODELS[GROUPS.model];
  let pole = $state<Pole | null>(null);
  let headContexts = $state<ContextLine[] | null>(null);
  let failed = $state(false);

  function load() {
    loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => { pole = d?.poles.find((p) => p.pole === 1) ?? null; failed ||= !pole; }, () => (failed = true));
    loadHeadLayer(GROUPS.model, GROUPS.layer).then((list) => {
      const head = list.find((h) => h.h === GROUPS.h);
      headContexts = head ? GROUPS.firings.map((i) => head.contexts[i]).filter(Boolean) : null;
      failed ||= !headContexts?.length;
    }, () => (failed = true));
  }
</script>

<Part id="firings" title="Where it fires" onnear={load}>
  {#snippet caption()}
    <p>The most direct pieces of evidence are the passages where a unit fires the hardest out of 15 million tokens of data. The token where it fired is highlighted, as are where the heads attended to.</p>
  {/snippet}
  <div class="spec">
    <Swap key={pole !== null && headContexts !== null}>
      {#if pole && headContexts}
        <div class="units">
          <div class="unit" style:--tint={depthColor(qwen, OWL.layer)}>
            <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
            <div class="fires">{#each pole.contexts.slice(0, 3) as context, i (i)}<Context {context} {i} />{/each}</div>
          </div>
          <div class="unit" style:--tint={depthColor(gemma, GROUPS.layer)}>
            <UnitLink model={GROUPS.model} layer={GROUPS.layer} head={GROUPS.h} />
            <p class="key meta"><span class="sw hit"></span>fired here<span class="sw src"></span>looked at</p>
            <div class="fires">{#each headContexts as context, i (i)}<Context {context} {i} />{/each}</div>
          </div>
        </div>
      {:else}
        <div class="units">{#if failed}<p class="meta">These specimens didn't load.</p>{:else}<span class="ghost"></span><span class="ghost"></span>{/if}</div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; min-width: 0; }
  .units { display: grid; gap: var(--s7); min-width: 0; }
  .unit { display: grid; gap: var(--s3); min-width: 0; }
  .fires { display: grid; gap: var(--s3); min-width: 0; }
  .key { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); font-weight: 400; }
  .sw { width: 12px; height: 8px; border-radius: 2px; }
  .sw.hit { background: color-mix(in oklch, var(--tint) 22%, transparent); }
  .sw.src { margin-left: var(--s3); background: color-mix(in oklch, var(--tint) 9%, transparent); }
  .ghost { height: 200px; border-radius: var(--r-row); background: var(--wash); }
</style>

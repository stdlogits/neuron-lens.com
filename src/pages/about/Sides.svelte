<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import Swap from "../../ui/Swap.svelte";
  import Context from "../../ui/Context.svelte";
  import LabelText from "../../ui/LabelText.svelte";
  import { loadNeuron, type NeuronDetail } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { OWL } from "./specimens";

  // A neuron's two sides, + and −, each with what it fires on and what it writes, and one place it fired.
  let detail = $state<NeuronDetail | null>(null);
  let failed = $state(false);
  const load = () => loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => (detail = d), () => (failed = true));

  const sides = $derived(detail ? [...detail.poles].sort((a, b) => b.pole - a.pole) : []);
  const confidence = (value: number) => `${Math.round(value * 100)}%`;
</script>

<Part id="sides" title="Two sides" onnear={load} tint={depthColor(MODELS[OWL.model], OWL.layer)}>
  {#snippet caption()}
    <p>A neuron can fire either way, so it has two sides. Each is labelled for what it fires on and what it writes.</p>
    <p class="meta">Labels by Claude Haiku 5.5</p>
  {/snippet}
  <div class="spec">
    <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
    <Swap key={detail !== null}>
      {#if detail}
        <div class="faces">
          <span></span><span class="head">Fires on</span><span class="head">Writes</span>
          {#each sides as side, i (side.pole)}
            <div class="face">
              <span class="sign" aria-label={side.pole > 0 ? "Plus side" : "Minus side"}>{side.pole > 0 ? "+" : "−"}</span>
              <p class="lab" class:faint={side.label.fc < 0.25}>
                <LabelText text={side.label.fires} interactive />
                <span class="meta" data-tip="How sure the labeller was">{confidence(side.label.fc)}</span>
              </p>
              <p class="lab" class:faint={side.label.wc < 0.25}>
                <LabelText text={side.label.writes} interactive />
                <span class="meta" data-tip="How sure the labeller was">{confidence(side.label.wc)}</span>
              </p>
              <div class="where">{#if side.contexts[0]}<Context context={side.contexts[0]} i={i + 1} />{/if}</div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="faces waiting" aria-busy="true">
          {#if failed}<p class="meta">This specimen didn't load.</p>{:else}<span class="ghost"></span><span class="ghost"></span>{/if}
        </div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s4); min-width: 0; }
  .faces { display: grid; grid-template-columns: 32px repeat(2, minmax(0, 1fr)); gap: var(--s2) var(--s5); }
  .faces > .head { padding-bottom: var(--s1); }
  .face { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; row-gap: var(--s3); padding: var(--s4) 0 var(--s3); }
  .sign { justify-self: center; font: 600 20px/28px var(--display); }
  .lab { display: grid; gap: var(--s1); align-content: start; font: var(--type-lead); }
  .lab.faint { color: var(--ink3); }
  .where { grid-column: 2 / -1; min-width: 0; }
  .waiting { grid-template-columns: minmax(0, 1fr); }
  .ghost { height: 120px; border-radius: var(--r-row); background: var(--wash); }
  @media (max-width: 600px) {
    .faces { grid-template-columns: 24px minmax(0, 1fr); column-gap: var(--s3); }
    .faces > .head { display: none; }
    .lab { grid-column: 2; font: var(--type-label); }
    .lab:nth-of-type(2)::before { content: "Writes"; color: var(--ink3); font: var(--type-head); }
    .lab:nth-of-type(1)::before { content: "Fires on"; color: var(--ink3); font: var(--type-head); }
    .sign { grid-row: 1; }
  }
</style>

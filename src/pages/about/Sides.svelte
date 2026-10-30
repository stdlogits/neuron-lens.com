<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import Swap from "../../ui/Swap.svelte";
  import Context from "../../ui/Context.svelte";
  import LabelText from "../../ui/LabelText.svelte";
  import Token from "../../ui/Token.svelte";
  import { headline, loadNeuron, type NeuronDetail, type Pole } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { OWL } from "./specimens";

  // Halves by poles: the columns are a neuron's two halves (what makes it fire, what its write does),
  // the rows its two poles. Each cell is the labeller's reading; under it, that half's own evidence:
  // a real firing for the input side, the R-lens read of the write for the write side. The last row
  // says how each half is known, by running the model or by a lens on the weights.
  let detail = $state<NeuronDetail | null>(null);
  let failed = $state(false);
  const load = () => loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => (detail = d), () => (failed = true));

  const sides = $derived(detail ? [...detail.poles].sort((a, b) => b.pole - a.pole) : []);
  const confidence = (value: number) => `${Math.round(value * 100)}%`;
  const writeRead = (pole: Pole) => headline(pole.reads.find((r) => r.col === "write_R")?.tokens ?? [], 4);
</script>

<Part id="halves" title="Two halves" onnear={load} tint={depthColor(MODELS[OWL.model], OWL.layer)}>
  {#snippet caption()}
    <p>Two poles, each with two halves.</p>
  {/snippet}
  <div class="spec">
    <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
    <Swap key={detail !== null}>
      {#if detail}
        <div class="faces" data-link-scope>
          <span></span>
          <p class="half"><span class="name">Input side</span><span class="meta">what makes it fire</span></p>
          <p class="half"><span class="name">Write side</span><span class="meta">what its write does</span></p>
          {#each sides as side, i (side.pole)}
            <div class="face">
              <span class="sign" aria-label={side.pole > 0 ? "Plus pole" : "Minus pole"}>{side.pole > 0 ? "+" : "−"}</span>
              <p class="lab" class:faint={side.label.fc < 0.25} data-side="Fires on">
                <LabelText text={side.label.fires} interactive />
                <span class="meta" data-tip="How sure the labeller was">{confidence(side.label.fc)}</span>
              </p>
              <p class="lab" class:faint={side.label.wc < 0.25} data-side="Writes">
                <LabelText text={side.label.writes} interactive />
                <span class="meta" data-tip="How sure the labeller was">{confidence(side.label.wc)}</span>
              </p>
              <div class="ev">{#if side.contexts[0]}<Context context={side.contexts[0]} i={i + 1} />{/if}</div>
              <div class="ev toks">{#each writeRead(side) as [token, count, flags], k (k)}<Token {token} {count} {flags} i={k} />{/each}</div>
            </div>
          {/each}
          <div class="how">
            <span></span>
            <dl><dt>Run the model</dt><dd>where it fires</dd><dt>Read the weights</dt><dd>a lens on what it reads</dd></dl>
            <dl><dt>Run the model</dt><dd>steer with its write</dd><dt>Read the weights</dt><dd>a lens on what it writes</dd></dl>
          </div>
        </div>
        <p class="credit meta">Labels by Claude Haiku 5.5</p>
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
  .half { display: grid; gap: 2px; padding-bottom: var(--s1); }
  .half .name { font: var(--type-label); }
  .face { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; row-gap: var(--s3); padding: var(--s4) 0 var(--s3); }
  .sign { justify-self: center; font: 600 20px/28px var(--display); }
  .lab { display: grid; gap: var(--s1); align-content: start; font: var(--type-lead); }
  .lab.faint { color: var(--ink3); }
  .ev { grid-column: auto; min-width: 0; align-content: start; }
  .ev:nth-of-type(1) { grid-column: 2; }
  .how { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; padding-top: var(--s3); }
  dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--s1) var(--s3); color: var(--ink2); font: var(--type-small); }
  dt { color: var(--ink3); font: var(--type-meta); line-height: 20px; }
  .credit { margin-top: var(--s2); }
  .waiting { grid-template-columns: minmax(0, 1fr); }
  .ghost { height: 120px; border-radius: var(--r-row); background: var(--wash); }
  @media (max-width: 600px) {
    .faces { grid-template-columns: 24px minmax(0, 1fr); column-gap: var(--s3); }
    .half, .how > span { display: none; }
    .lab, .ev, .ev:nth-of-type(1) { grid-column: 2; }
    .lab::before { content: attr(data-side); color: var(--ink3); font: var(--type-head); }
    .lab { font: var(--type-label); }
    .sign, .lab:nth-of-type(1) { grid-row: 1; }
    .ev:nth-of-type(1) { grid-row: 2; }
    .lab:nth-of-type(2) { grid-row: 3; padding-top: var(--s2); }
    .ev:nth-of-type(2) { grid-row: 4; }
    .how dl { grid-column: 1 / -1; }
    .how dl + dl { margin-top: var(--s3); }
    .how dl:first-of-type::before { content: "Input side"; grid-column: 1 / -1; color: var(--ink); font: var(--type-label); }
    .how dl:last-of-type::before { content: "Write side"; grid-column: 1 / -1; color: var(--ink); font: var(--type-label); }
  }
</style>

<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import { Context, LabelText, Swap, Switch, Token } from "@stdlogits/ledger";
  import { headline, loadNeuron, type Pole } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { setTranslate, translation } from "../../lib/translate.svelte";
  import { OWL } from "./specimens";

  // Other languages, live: the owl neuron's other side reads rot and rust in Chinese as much as in
  // English. The switch is the explorer's own, so what is chosen here carries over.
  let pole = $state<Pole | null>(null);
  let failed = $state(false);
  const load = () => loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => { pole = d?.poles.find((p) => p.pole === -1) ?? null; failed = !pole; }, () => (failed = true));

  const context = $derived(pole?.contexts.find((c) => c[1]) ?? null);
  const tokens = $derived(pole ? headline(pole.reads.find((r) => r.col === "write_R" && !r.twin)?.tokens ?? [], 8) : []);
</script>

<Part id="languages" title="Other languages" onnear={load} tint={depthColor(MODELS[OWL.model], OWL.layer)}>
  {#snippet caption()}
    <p>A lot of the text is in Chinese, and many units fire on the same idea in several languages: for example, the owl neuron's negative side reads rot and rust in Chinese just as much as it does in English. We had Claude Haiku 5.5 translate all of the tokens, labels and examples.</p>
  {/snippet}
  <div class="spec">
    <div class="top">
      <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
      <Switch checked={translation.on} onchange={setTranslate} label="English" />
    </div>
    <Swap key={pole !== null}>
      {#if pole}
        <div class="body" data-link-scope>
          <p class="title"><span class="head">Writes</span><span class="sign" aria-label="Minus side">−</span><LabelText text={pole.label.writes} interactive /></p>
          {#if context}<Context {context} />{/if}
          <div class="toks">{#each tokens as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</div>
        </div>
      {:else}
        <div class="body">{#if failed}<p class="meta">This specimen didn't load.</p>{:else}<span class="ghost"></span>{/if}</div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s4); min-width: 0; }
  .top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s3) var(--s5); }
  .body { display: grid; gap: var(--s4); min-width: 0; }
  .title { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: var(--s1) var(--s3); font: var(--type-lead); }
  .title .head { grid-column: 2; }
  .sign { font: 600 20px/28px var(--display); text-align: center; }
  .ghost { height: 160px; border-radius: var(--r-row); background: var(--wash); }
</style>

<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import Swap from "../../ui/Swap.svelte";
  import Token from "../../ui/Token.svelte";
  import Meter from "../../ui/Meter.svelte";
  import { headline, loadNeuron, type NeuronDetail, type ReadColumn } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { OWL } from "./specimens";

  // The same side read two ways: the tokens that set it off in real text, beside what its weights
  // say through each lens. A token both name is tinted; hovering one lights its variants everywhere.
  let detail = $state<NeuronDetail | null>(null);
  let failed = $state(false);
  const load = () => loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => (detail = d), () => (failed = true));

  const side = $derived(detail?.poles.find((pole) => pole.pole === 1) ?? null);
  const read = (col: ReadColumn) => side?.reads.find((r) => r.col === col && !r.twin) ?? null;
  const lenses = $derived([
    { name: "S-lens", says: "tokens it responds to", read: read("read_S") },
    { name: "R-lens", says: "what it makes the model say", read: read("write_R") },
  ]);
</script>

<Part id="evidence" title="Two kinds of evidence" onnear={load} tint={depthColor(MODELS[OWL.model], OWL.layer)}>
  {#snippet caption()}
    <p>In real text: where it fires across 15 million tokens. From its weights: what two lenses read straight off the neuron, with no text at all.</p>
    <p class="key meta"><span class="chip">owl</span> two reads agree on it</p>
  {/snippet}
  <div class="spec">
    <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
    <Swap key={side !== null}>
      {#if side}
        <div class="ways" data-link-scope>
          <div class="way">
            <h3 class="head">In real text</h3>
            <p class="says">Tokens that set it off most</p>
            <div class="toks">{#each side.drivers.slice(0, 8) as [token, value], i (i)}<Token {token} {value} {i} />{/each}</div>
          </div>
          <div class="way">
            <h3 class="head">From its weights</h3>
            {#each lenses as lens (lens.name)}
              {#if lens.read}
                <div class="lens">
                  <p class="says"><b>{lens.name}</b> {lens.says}<Meter value={lens.read.pct / 100} label={`Stronger than ${lens.read.pct}% of this layer's sides`} /></p>
                  <div class="toks">{#each headline(lens.read.tokens, 8) as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {:else}
        <div class="ways">{#if failed}<p class="meta">This specimen didn't load.</p>{:else}<span class="ghost"></span><span class="ghost"></span>{/if}</div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s4); min-width: 0; }
  .ways { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s6) var(--s7); padding-top: var(--s2); }
  .way { display: grid; align-content: start; gap: var(--s3); min-width: 0; }
  .lens { display: grid; gap: var(--s3); }
  .lens + .lens { margin-top: var(--s3); }
  .says { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s1) var(--s2); color: var(--ink2); font: var(--type-small); }
  .says b { color: var(--ink); font-weight: 500; }
  .key { display: flex; align-items: center; gap: var(--s2); }
  .chip { padding: 2px var(--s2); border-radius: var(--r-chip); background: color-mix(in oklch, var(--tint) 14%, var(--paper)); color: var(--ink); font: var(--type-small); }
  .ghost { height: 160px; border-radius: var(--r-row); background: var(--wash); }
  @media (max-width: 600px) { .ways { grid-template-columns: minmax(0, 1fr); } }
</style>

<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import { Swap } from "@stdlogits/ledger";
  import Faces from "../../explorer/unit/Faces.svelte";
  import { neuronTags } from "../../explorer/unit/evidence";
  import { describeRole, loadHeadIndex, loadHeadLayer, loadLayerIndex, loadNeuron, rolesOf, type HeadDetail, type NeuronDetail } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { GROUPS, OWL } from "./specimens";

  // The top of a unit, as the explorer draws it: its ID, depth and tags, then its labels with the
  // labeller's note. The owl neuron's two sides are tabs, as there; the groups head has one row of three.
  const qwen = MODELS[OWL.model];
  const gemma = MODELS[GROUPS.model];
  let neuron = $state<NeuronDetail | null>(null);
  let head = $state<HeadDetail | null>(null);
  let neuronTagList = $state<{ label: string; tip: string }[]>([]);
  let headTagList = $state<{ label: string; tip: string }[]>([]);
  let failed = $state(false);
  let side = $state(0);

  function load() {
    loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => { neuron = d; failed ||= !d; }, () => (failed = true));
    loadHeadLayer(GROUPS.model, GROUPS.layer).then((list) => { head = list.find((h) => h.h === GROUPS.h) ?? null; failed ||= !head; }, () => (failed = true));
    loadLayerIndex(OWL.model, OWL.layer).then((rows) => { neuronTagList = neuronTags(rows.find((r) => r[1] === OWL.n)?.[5] ?? 0); }, () => undefined);
    loadHeadIndex(GROUPS.model).then((rows) => {
      const row = rows.find((r) => r[0] === GROUPS.layer && r[1] === GROUPS.h);
      headTagList = row ? rolesOf(row[9]).map((role) => ({ label: role.short, tip: describeRole(role, gemma) })) : [];
    }, () => undefined);
  }

  const neuronRows = $derived(neuron ? neuron.poles.map((p) => ({
    sign: p.pole > 0 ? "+" : "−",
    name: p.pole > 0 ? "Positive side" : "Negative side",
    cells: [{ label: p.label.fires, confidence: p.label.fc }, { label: p.label.writes, confidence: p.label.wc }],
  })) : []);
  const headRows = $derived(head ? [{
    sign: "",
    name: "Labels",
    cells: [{ label: head.label.fires, confidence: head.label.fc }, { label: head.label.attends, confidence: head.label.ac }, { label: head.label.writes, confidence: head.label.wc }],
  }] : []);
</script>

<Part id="labels" title="Labels" onnear={load}>
  {#snippet caption()}
    <p>Every unit is labeled with a plain description of what makes it fire, what it writes back, and for heads, what it attends to: which earlier tokens it points at.</p>
    <p>The labels were written by Claude Haiku 5.5 after it was presented with all of the evidence shown in the explorer; the percentage is its certainty.</p>
    <p>A neuron can fire in two different directions, and each side can have a separate meaning. This neuron fires on owls in one direction and on rot in the other.</p>
  {/snippet}
  <div class="spec">
    <Swap key={neuron !== null && head !== null}>
      {#if neuron && head}
        <div class="units">
          <div class="pg-unit" data-link-scope style:--tint={depthColor(qwen, OWL.layer)}>
            <div class="top">
              <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
              {#if neuronTagList.length}<p class="meta tags">{#each neuronTagList as tag (tag.label)}<span class="tag" data-tip={tag.tip}><span class="dot" aria-hidden="true">·</span>{tag.label}</span>{/each}</p>{/if}
            </div>
            <Faces columns={["Fires on", "Writes"]} rows={neuronRows} bind:selected={side} note={neuron.poles[side].label.note} />
          </div>
          <div class="pg-unit" data-link-scope style:--tint={depthColor(gemma, GROUPS.layer)}>
            <div class="top">
              <UnitLink model={GROUPS.model} layer={GROUPS.layer} head={GROUPS.h} />
              {#if headTagList.length}<p class="meta tags">{#each headTagList as tag (tag.label)}<span class="tag" data-tip={tag.tip}><span class="dot" aria-hidden="true">·</span>{tag.label}</span>{/each}</p>{/if}
            </div>
            <Faces columns={["Fires on", "Attends to", "Writes"]} rows={headRows} note={head.label.note} />
          </div>
        </div>
      {:else}
        <div class="units">{#if failed}<p class="meta">These specimens didn't load.</p>{:else}<span class="ghost"></span><span class="ghost short"></span>{/if}</div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; min-width: 0; }
  .units { display: grid; gap: var(--s7); min-width: 0; }
  .top { display: grid; gap: var(--s1); }
  .tags { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--s2); }
  .tag { display: inline-flex; gap: var(--s2); cursor: help; }
  .dot { color: var(--ink3); }
  /* The band sits in the link above, so the first tag needs no dot before it. */
  .tag:first-child .dot { display: none; }
  .ghost { height: 240px; border-radius: var(--r-row); background: var(--wash); }
  .ghost.short { height: 160px; }
</style>

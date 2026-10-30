<script lang="ts">
  import Icon from "../../ui/Icon.svelte";
  import { MODELS, bandOf, type ModelId } from "../../lib/models";
  import { headId, neuronId } from "../../lib/data";

  // A specimen's name, which opens it in the explorer: its ID in the display face, then the model
  // and the depth it sits at.
  let { model, layer, neuron, head }: { model: ModelId; layer: number; neuron?: number; head?: number } = $props();

  const info = $derived(MODELS[model]);
  const id = $derived(head !== undefined ? headId(layer, head) : neuronId(layer, neuron ?? 0));
  const href = $derived(`/${model}/L${layer}/${head !== undefined ? `h${head}` : `n${neuron}`}`);
</script>

<a class="unit" {href}>
  <span class="id">{id}</span>
  <span class="where">{info.name} · {bandOf(info, layer).name}</span>
  <span class="go" aria-hidden="true"><Icon name="right" size={14} /></span>
</a>

<style>
  .unit {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-self: start;
    gap: var(--s1) var(--s3);
    color: var(--ink);
  }
  .id { font: 600 20px/28px var(--display); letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
  .where { color: var(--ink3); font: var(--type-meta); transition: color var(--fast) var(--ease); }
  .go { display: inline-grid; align-self: center; color: var(--ink3); transition: color var(--fast) var(--ease), translate var(--fast) var(--ease); }
  @media (hover: hover) {
    .unit:hover .where, .unit:hover .go { color: var(--ink); }
    .unit:hover .go { translate: 2px 0; }
  }
</style>

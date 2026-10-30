<script lang="ts">
  import type { Pole } from "../../lib/data";

  // Stub: replaced by the media lane. What one side of a neuron responds to in images and sound.
  let { pole, layer, neuron }: { pole: Pole; layer: number; neuron: number } = $props();
</script>

{#if pole.media}<div class="stub">NeuronMedia L{layer} n{neuron} {Object.keys(pole.media).join(", ")}</div>{/if}

<style>
  .stub { padding: var(--s4); border-radius: var(--r-box); background: var(--wash); color: var(--ink3); font: var(--type-small); }
</style>

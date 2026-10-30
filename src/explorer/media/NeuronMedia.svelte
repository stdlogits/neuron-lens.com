<script lang="ts">
  import ModalityMedia from "./ModalityMedia.svelte";
  import { useLens } from "../lens.svelte";
  import type { Pole } from "../../lib/data";
  import type { Modality } from "../../lib/models";

  // What one side of a Gemma 4 neuron responds to in images and in sound. Nothing for a side (or a
  // model) without media.
  // layer and neuron name the unit for whoever places this; the side's media carries all it needs.
  let { pole }: { pole: Pole; layer: number; neuron: number } = $props();
  const lens = useLens();

  const ORDER: Modality[] = ["image", "audio"];
  const present = $derived(ORDER.filter((modality) => pole.media?.[modality]));
</script>

{#if present.length}
  <div class="media">
    {#each present as modality (modality)}
      <ModalityMedia model={lens.modelId} {modality} media={pole.media![modality]!} />
    {/each}
  </div>
{/if}

<style>
  .media { display: grid; gap: var(--s6); min-width: 0; }
</style>

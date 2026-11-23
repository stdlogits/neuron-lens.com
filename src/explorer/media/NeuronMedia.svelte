<script lang="ts">
  import ModalityMedia from "./ModalityMedia.svelte";
  import type { Pole } from "../../lib/data";
  import type { Modality, ModelId } from "../../lib/models";

  // What one side of a Gemma 4 neuron responds to in images and in sound. Nothing for a side (or a
  // model) without media.
  // `model` is the one the side was read from (not the explorer's, which may already be another while this one stays).
  let { pole, model }: { pole: Pole; model: ModelId } = $props();

  const ORDER: Modality[] = ["image", "audio"];
  const present = $derived(ORDER.filter((modality) => pole.media?.[modality]));
</script>

{#if present.length}
  <div class="media">
    {#each present as modality (modality)}
      <ModalityMedia {model} {modality} media={pole.media![modality]!} />
    {/each}
  </div>
{/if}

<style>
  .media { display: grid; gap: var(--s6); min-width: 0; }
</style>

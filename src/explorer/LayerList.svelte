<script lang="ts">
  import { useLens } from "./lens.svelte";

  // Stub: replaced by its lane.
  const lens = useLens();
</script>

<div class="stub">LayerList · {lens.model.name} · L{lens.layer} · {lens.selectedId}</div>

<style>
  .stub { padding: var(--s4); border-radius: var(--r-box); background: var(--wash); color: var(--ink3); font: var(--type-small); }
</style>

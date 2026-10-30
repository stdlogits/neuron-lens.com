<script lang="ts">
  import type { HeadDetail } from "../../lib/data";

  // Stub: replaced by the media lane. A head in image and audio contexts.
  let { head }: { head: HeadDetail } = $props();
</script>

{#if head.media}<div class="stub">HeadMedia h{head.h}</div>{/if}

<style>
  .stub { padding: var(--s4); border-radius: var(--r-box); background: var(--wash); color: var(--ink3); font: var(--type-small); }
</style>

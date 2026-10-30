<script lang="ts">
  import type { Snippet } from "svelte";
  import { fadeOut, rise } from "../lib/motion";

  // Content that changes as a whole (one unit for the next): the old view fades out in 120 ms while
  // the new one rises into the same place in 200 ms. Pass direction -1 to have it fall in instead,
  // as when stepping back.
  let { key, direction = 1, children }: { key: unknown; direction?: 1 | -1; children: Snippet } = $props();
</script>

<div class="swap">
  {#key key}
    <div class="slot" in:rise={{ y: 6 * direction }} out:fadeOut>{@render children()}</div>
  {/key}
</div>

<style>
  .swap { display: grid; min-width: 0; }
  .slot { grid-area: 1 / 1; min-width: 0; }
</style>

<script lang="ts">
  import type { Snippet } from "svelte";

  // One entry of More evidence: a quiet head on the left (its meaning in a tip), the figures or
  // tokens on the right. On a narrow pane the head sits above.
  let { title, tip, children }: { title: string; tip?: string; children: Snippet } = $props();
</script>

<div class="row">
  <h4 class="head" data-tip={tip}>{title}</h4>
  <div class="body">{@render children()}</div>
</div>

<style>
  .row { display: grid; grid-template-columns: 136px minmax(0, 1fr); gap: var(--s2) var(--s5); align-items: start; min-width: 0; }
  h4 { padding-top: 2px; }
  h4[data-tip] { cursor: help; }
  .body { display: grid; gap: var(--s2); min-width: 0; }
  @container unit (max-width: 600px) {
    .row { grid-template-columns: minmax(0, 1fr); }
  }
</style>

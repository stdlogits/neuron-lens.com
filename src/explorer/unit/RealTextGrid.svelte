<script lang="ts">
  import type { Snippet } from "svelte";

  // A unit's real-text lists, two by two. They fill it column by column, so across the top is what
  // drives it beside what follows or what it attends to, and across the bottom where its top firings
  // land beside what the model says or what it looked at. One column on a narrow view.
  let { children }: { children: Snippet } = $props();
</script>

<div class="grid">{@render children()}</div>

<style>
  .grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(2, auto); grid-auto-columns: minmax(0, 1fr); gap: var(--s5) var(--s7); min-width: 0; }
  @container unit (max-width: 600px) {
    .grid { grid-auto-flow: row; grid-template-rows: none; }
  }
</style>

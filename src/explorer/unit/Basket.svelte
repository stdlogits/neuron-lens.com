<script lang="ts">
  import type { Snippet } from "svelte";

  // One of a unit's baskets under its title, where BasketBar finds it by its id.
  let { id, title, tip, children }: { id: string; title: string; tip: string; children: Snippet } = $props();
</script>

<section {id} class="basket">
  <h3 class="title" data-tip={tip}>{title}</h3>
  {@render children()}
</section>

<style>
  .basket { display: grid; gap: var(--s4); min-width: 0; scroll-margin-top: var(--s8); }
  .title { width: fit-content; cursor: help; font: var(--type-lead); font-family: var(--display); font-weight: 600; letter-spacing: -0.01em; }
</style>

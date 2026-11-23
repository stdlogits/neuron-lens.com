<script lang="ts">
  import type { Fact } from "./evidence";

  // A row of figures, each a quiet name over a tabular value, with no rules between them.
  let { facts }: { facts: Fact[] } = $props();
</script>

<dl class="facts">
  {#each facts as fact (fact.k)}
    <div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex --><dt data-tip={fact.tip} tabindex={fact.tip ? 0 : undefined}>{fact.k}</dt>
      <dd>{fact.v}</dd>
    </div>
  {/each}
</dl>

<style>
  .facts { display: flex; flex-wrap: wrap; gap: var(--s3) var(--s5); min-width: 0; }
  .facts > div { display: grid; gap: 2px; align-content: start; }
  dt { color: var(--ink3); font: var(--type-meta); font-weight: 400; }
  dt[data-tip] { cursor: help; }
  dd { margin: 0; color: var(--ink); font: var(--type-control); font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>

<script lang="ts" module>
  /** A figure: its name over its value. Off figures (a test that fails) draw in the softest ink. */
  export interface Fact { k: string; v: string; tip?: string; off?: boolean; lang?: string }
</script>

<script lang="ts">
  // A row of figures, each a quiet name over a tabular value, with no rules between them.
  let { facts }: { facts: Fact[] } = $props();
</script>

<dl class="facts">
  {#each facts as fact (fact.k)}
    <div class:off={fact.off}>
      <dt data-tip={fact.tip}>{fact.k}</dt>
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
  .off dd { color: var(--ink3); font-weight: 400; }
</style>

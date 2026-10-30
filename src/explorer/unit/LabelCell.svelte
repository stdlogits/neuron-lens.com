<script lang="ts">
  import LabelText from "../../ui/LabelText.svelte";

  // One label of the faces table over its confidence. Under a quarter, the label fades to the
  // softest ink. On a narrow pane, where the columns stack, the cell names its column.
  let { label, confidence, column, interactive = false }: { label: string; confidence: number; column: string; interactive?: boolean } = $props();

  const pct = $derived(Math.round(confidence * 100));
</script>

<span class="lab" class:low={confidence < 0.25}>
  <span class="col head">{column}<span class="sr-only">: </span></span>
  <span class="t"><LabelText text={label} {interactive} /></span>
  <span class="c meta">{pct}%<span class="sr-only"> confident</span></span>
</span>

<style>
  .lab { position: relative; display: grid; align-content: start; gap: var(--s1); min-width: 0; padding-right: var(--s4); text-align: start; }
  .t { color: var(--ink); font: var(--type-label); text-wrap: pretty; transition: color var(--fast) var(--ease); }
  .low .t { color: var(--ink3); }
  /* Wide, the table's column heads name the column: the cell's own name is for screen readers. */
  .col { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @container unit (max-width: 600px) {
    .col { position: static; width: auto; height: auto; overflow: visible; clip-path: none; }
    .lab { padding-right: 0; }
  }
</style>

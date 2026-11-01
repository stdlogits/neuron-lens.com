<script lang="ts">
  import Facts from "./Facts.svelte";
  import Group from "./Group.svelte";
  import Pattern from "./Pattern.svelte";
  import type { HeadDetail } from "../../lib/data";
  import type { ModelInfo } from "../../lib/models";
  import { headAttending, headCopying, headStrength, oftenFacts } from "./evidence";

  // A head's figures in one row: how often and how hard it fires, where it looks, how it attends and
  // how much it copies. The About page draws it as is.
  let { head, model, groupSize }: { head: HeadDetail; model: ModelInfo; groupSize: number } = $props();
</script>

<div class="figures">
  <Group title="How often"><Facts facts={oftenFacts(head.act, "where it is active")} /></Group>
  <Group title="How hard"><Facts facts={headStrength(head)} /></Group>
  <div class="pattern"><Group title="Pattern"><Pattern pattern={head.pattern} /></Group></div>
  <Group title="How it attends"><Facts facts={headAttending(head, groupSize)} /></Group>
  <Group title="Copying" tip="How much it copies, read from its weights and tested at its top firings"><Facts facts={headCopying(head, model.headTest)} /></Group>
</div>

<style>
  .figures { display: flex; flex-wrap: wrap; align-items: start; gap: var(--s5) var(--s7); min-width: 0; }
  .pattern { flex: 0 1 240px; min-width: 200px; }
</style>

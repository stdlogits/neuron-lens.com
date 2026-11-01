<script lang="ts">
  import { Context } from "@stdlogits/ledger";
  import HeadMedia from "../media/HeadMedia.svelte";
  import Faces from "./Faces.svelte";
  import HeadColumns from "./HeadColumns.svelte";
  import HeadFigures from "./HeadFigures.svelte";
  import type { HeadDetail } from "../../lib/data";
  import type { ModelInfo } from "../../lib/models";

  // An attention head, in the neuron's shape: one row of labels (what it fires on, what it attends
  // to, what it writes), how it handles images and sound, its firings with the token it looked at,
  // its three columns (what it does in real text, then every read of its weights with its test), and
  // last its figures.
  let { head, model, labelled, groupSize }: { head: HeadDetail; model: ModelInfo; labelled: boolean; groupSize: number } = $props();

  const rows = $derived([{
    sign: "",
    name: "Labels",
    cells: [
      { label: head.label.fires, confidence: head.label.fc },
      { label: head.label.attends, confidence: head.label.ac },
      { label: head.label.writes, confidence: head.label.wc },
    ],
  }]);
</script>

<div class="unit" data-link-scope>
  <Faces columns={["Fires on", "Attends to", "Writes"]} {rows} {labelled} note={head.label.note} />

  <HeadMedia {head} />

  <section class="fires">
    <div class="fh">
      <h3 class="head">Where it fires</h3>
      <span class="meta key hit">fired here</span>
      <span class="meta key src">looked at</span>
    </div>
    {#each head.contexts as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
  </section>

  <HeadColumns {head} {model} />

  <HeadFigures {head} {model} {groupSize} />
</div>

<style>
  .unit { display: grid; gap: var(--s6); min-width: 0; }
  .fires { display: grid; gap: var(--s3); min-width: 0; }
  .fh { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s4); }
  .key { display: inline-flex; align-items: center; gap: 6px; font-weight: 400; }
  .key::before { content: ""; width: 12px; height: 8px; border-radius: 2px; background: color-mix(in oklch, var(--tint) 22%, transparent); }
  .key.src::before { background: color-mix(in oklch, var(--tint) 9%, transparent); }
  .none { font-weight: 400; }
</style>

<script lang="ts">
  import { untrack } from "svelte";
  import { Context, Swap } from "@stdlogits/ledger";
  import NeuronMedia from "../media/NeuronMedia.svelte";
  import Faces from "./Faces.svelte";
  import Facts from "./Facts.svelte";
  import Group from "./Group.svelte";
  import NeuronColumns from "./NeuronColumns.svelte";
  import type { NeuronDetail } from "../../lib/data";
  import { neuronStrength, oftenFacts } from "./evidence";

  // A neuron: its two sides as the rows of the faces table (what each fires on, what it writes), then
  // all of the chosen side's evidence: its images and sounds, its firings, its two columns (every read
  // of its weights with its test, and what it fires on in real text), and how often and how hard it
  // fires. Switching sides crossfades everything below the table.
  let { detail, layer, labelled }: { detail: NeuronDetail; layer: number; labelled: boolean } = $props();

  // Open on the clearer side. The view is made anew for each neuron, so its first value is enough.
  const clearer = (poles: NeuronDetail["poles"]): 0 | 1 => (poles[1].score > poles[0].score && !poles[1].silent ? 1 : 0);
  let side = $state(clearer(untrack(() => detail.poles)));
  const pole = $derived(detail.poles[side]);

  const rows = $derived(detail.poles.map((p) => ({
    sign: p.pole > 0 ? "+" : "−",
    name: p.pole > 0 ? "Positive side" : "Negative side",
    cells: [
      { label: p.label.fires, confidence: p.label.fc },
      { label: p.label.writes, confidence: p.label.wc },
    ],
  })));
  const panel = $props.id();
</script>

<div class="unit" data-link-scope>
  <Faces columns={["Fires on", "Writes"]} {rows} bind:selected={side} {labelled} note={pole.label.note} {panel} />

  <div class="side" id={panel} role="tabpanel" aria-label={rows[side].name}>
    <Swap key={side}>
      <div class="stack">
        <NeuronMedia {pole} {layer} neuron={detail.n} />

        <section class="fires">
          <h3 class="head">Where it fires</h3>
          {#each pole.contexts as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
        </section>

        <NeuronColumns {pole} />

        <div class="figures">
          <Group title="How often"><Facts facts={oftenFacts(pole.act, "it fires on")} /></Group>
          <Group title="How hard"><Facts facts={neuronStrength(pole)} /></Group>
        </div>
      </div>
    </Swap>
  </div>
</div>

<style>
  .unit { display: grid; gap: var(--s6); min-width: 0; }
  .stack { display: grid; gap: var(--s6); min-width: 0; }
  .fires { display: grid; gap: var(--s3); min-width: 0; }
  .none { font-weight: 400; }
  .figures { display: flex; flex-wrap: wrap; align-items: start; gap: var(--s5) var(--s7); min-width: 0; }
</style>

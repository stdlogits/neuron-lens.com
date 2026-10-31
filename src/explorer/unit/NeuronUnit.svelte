<script lang="ts">
  import { untrack } from "svelte";
  import { Context, Expander, Swap, stem } from "@stdlogits/ledger";
  import NeuronMedia from "../media/NeuronMedia.svelte";
  import Faces from "./Faces.svelte";
  import Group from "./Group.svelte";
  import NeuronMore from "./NeuronMore.svelte";
  import { LENSES, type NeuronDetail } from "../../lib/data";
  import { moreEvidence } from "./more.svelte";
  import { SHOWN, agreement, flagged, primaryRead } from "./evidence";

  // A neuron: its two sides as the rows of the faces table (what each fires on, what it writes),
  // then the chosen side's firings and the evidence under each column, its images and sounds, and
  // the rest under More evidence. Switching sides crossfades everything below the table.
  let { detail, layer, labelled }: { detail: NeuronDetail; layer: number; labelled: boolean } = $props();

  // Open on the clearer side. The view is made anew for each neuron, so its first value is enough.
  const clearer = (poles: NeuronDetail["poles"]): 0 | 1 => (poles[1].score > poles[0].score && !poles[1].silent ? 1 : 0);
  let side = $state(clearer(untrack(() => detail.poles)));
  const pole = $derived(detail.poles[side]);

  const input = $derived(primaryRead(pole.reads, "input"));
  const output = $derived(primaryRead(pole.reads, "output"));
  const drivers = $derived(pole.drivers.slice(0, SHOWN));
  const inputTokens = $derived(input?.tokens.slice(0, SHOWN) ?? []);
  const outputTokens = $derived(output?.tokens.slice(0, SHOWN) ?? []);
  const agree = $derived(agreement([drivers.map(([t]) => t), inputTokens.map(([t]) => t), outputTokens.map(([t]) => t)]));
  const measured = $derived(new Set(pole.measured));
  const driverItems = $derived(drivers.map(([token, value]) => ({ token, value, flags: agree.has(stem(token)) || measured.has(stem(token)) ? 1 : 0 })));
  const readItems = (tokens: typeof inputTokens) => flagged(tokens, agree).map(([token, count, flags]) => ({ token, count, flags }));

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
  <Faces columns={["Fires on", "Writes"]} {rows} bind:selected={side} {labelled} {panel} />

  <div class="side" id={panel} role="tabpanel" aria-label={rows[side].name}>
    <Swap key={side}>
      <div class="stack">
        <section class="fires">
          <h3 class="head">Where it fires</h3>
          {#each pole.contexts.slice(0, 3) as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
        </section>

        <div class="ev cols-2">
          <span aria-hidden="true"></span>
          <div class="col">
            <h3 class="col-head head">Fires on</h3>
            <Group title="In real text" tip="Tokens that most make it fire, measured in real documents" items={driverItems} />
            {#if input}<Group title="From its weights" tip={`${LENSES[input.col].name} (${LENSES[input.col].short})`} items={readItems(inputTokens)} pct={input.pct} />{/if}
          </div>
          <div class="col">
            <h3 class="col-head head">Writes</h3>
            {#if output}<Group title="From its weights" tip={`${LENSES[output.col].name} (${LENSES[output.col].short})`} items={readItems(outputTokens)} pct={output.pct} />{/if}
          </div>
        </div>

        <NeuronMedia {pole} {layer} neuron={detail.n} />
      </div>
    </Swap>
  </div>

  <Expander label="More evidence" openLabel="Less evidence" bind:open={moreEvidence.open}>
    <Swap key={side}><NeuronMore {pole} shown={[input?.col, output?.col]} /></Swap>
  </Expander>
</div>

<style>
  .unit { display: grid; gap: var(--s6); min-width: 0; }
  .stack { display: grid; gap: var(--s6); min-width: 0; }
  .fires { display: grid; gap: var(--s3); min-width: 0; }
  .none { font-weight: 400; }
  .ev { display: grid; grid-template-columns: 32px repeat(2, minmax(0, 1fr)); column-gap: var(--s5); row-gap: var(--s6); min-width: 0; }
  .col { display: grid; gap: var(--s5); align-content: start; min-width: 0; }
  .col-head { display: none; }
  @container unit (max-width: 600px) {
    .ev { grid-template-columns: minmax(0, 1fr); }
    .ev > span { display: none; }
    .col-head { display: block; color: var(--ink); }
    .col { gap: var(--s4); }
  }
</style>

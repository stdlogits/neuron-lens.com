<script lang="ts">
  import { untrack } from "svelte";
  import { Context, Swap, formatValue, stem } from "@stdlogits/ledger";
  import NeuronMedia from "../media/NeuronMedia.svelte";
  import Faces from "./Faces.svelte";
  import Facts, { type Fact } from "./Facts.svelte";
  import Group from "./Group.svelte";
  import Reads, { type Test } from "./Reads.svelte";
  import { LENSES, percent, type NeuronDetail, type NeuronSide } from "../../lib/data";
  import { sideReads, stat } from "./evidence";

  // A neuron: its two sides as the rows of the faces table (what each fires on, what it writes), then
  // all of the chosen side's evidence: its firings, how often and how hard it fires, and under each
  // column every read of its weights on that side with its test (then, under Fires on, what it fires
  // on in real text); then its images and sounds. Switching sides crossfades everything below the table.
  let { detail, layer, labelled }: { detail: NeuronDetail; layer: number; labelled: boolean } = $props();

  // Open on the clearer side. The view is made anew for each neuron, so its first value is enough.
  const clearer = (poles: NeuronDetail["poles"]): 0 | 1 => (poles[1].score > poles[0].score && !poles[1].silent ? 1 : 0);
  let side = $state(clearer(untrack(() => detail.poles)));
  const pole = $derived(detail.poles[side]);

  // A measured token is tinted when a read names it too (the catalog's measured keys); the reads carry their own flags.
  const measured = $derived(new Set(pole.measured));
  const drivers = $derived(pole.drivers.map(([token, value]) => ({ token, value, flags: measured.has(stem(token)) ? 1 : 0 })));
  const peaks = $derived(pole.peaks.map(([token, times]) => ({ token, times, flags: measured.has(stem(token)) ? 1 : 0 })));
  const inputs = $derived(sideReads(pole.reads, "input"));
  const outputs = $derived(sideReads(pole.reads, "output"));

  const SLICES = ["Web", "Chinese", "Code", "Chat"];
  const often = $derived<Fact[]>([
    { k: "All text", v: percent(pole.act.rate), tip: "Share of tokens it fires on" },
    ...pole.act.slices.map((rate, i) => ({ k: SLICES[i], v: percent(rate), tip: `Share of tokens it fires on in ${SLICES[i].toLowerCase()} text` })),
  ]);
  const strength = $derived<Fact[]>([
    { k: "Typical peak", v: formatValue(pole.act.top), tip: "Its typical value at its top firings" },
    { k: "Top", v: formatValue(pole.act.max), tip: "The largest value seen" },
    { k: "Past the first token", v: percent(pole.act.pos), tip: "Share of its top firings after the first position, where many units fire regardless" },
  ]);
  // Each side of the neuron's weights, read through each lens, is tested against the pole's own top firings.
  const SIDES: NeuronSide[] = ["read_S", "read_R", "write_S", "write_R"];
  const tests = $derived<Record<string, Test>>(pole.silent ? {} : Object.fromEntries(SIDES.map((s) => {
    const q = pole.legible[s];
    return [s, { v: `q ${stat(q)}`, off: !(q <= 0.05), tip: `Whether ${LENSES[s].short} predicts this side's own top firings. It holds under 0.05.` }];
  })));
  const WEIGHTS = "What each lens reads from its weights, in the order this depth trusts them";

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
        <section class="fires">
          <h3 class="head">Where it fires</h3>
          {#each pole.contexts as context, i (i)}<Context {context} {i} />{:else}<p class="meta none">No firings recorded</p>{/each}
        </section>

        <div class="figures">
          <Group title="How often"><Facts facts={often} /></Group>
          <Group title="How hard"><Facts facts={strength} /></Group>
        </div>

        <div class="ev">
          <span aria-hidden="true"></span>
          <div class="col">
            <h3 class="col-head head">Fires on</h3>
            {#if inputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={inputs} all={pole.reads} {tests} /></Group>{/if}
            <Group title="In real text" tip="Tokens that most make it fire, measured in real documents" items={drivers} />
            {#if peaks.length}<Group title="Peaks on" tip="The tokens its top firings land on, and how many of them" items={peaks} />{/if}
          </div>
          <div class="col">
            <h3 class="col-head head">Writes</h3>
            {#if outputs.length}<Group title="From its weights" tip={WEIGHTS}><Reads reads={outputs} all={pole.reads} {tests} /></Group>{/if}
          </div>
        </div>

        <NeuronMedia {pole} {layer} neuron={detail.n} />
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

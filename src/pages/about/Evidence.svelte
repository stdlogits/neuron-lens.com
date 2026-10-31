<script lang="ts">
  import Part from "../Part.svelte";
  import { Context, Token } from "@stdlogits/ledger";
  import { headline, loadNeuron, neuronId, type Pole } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { GALLERY } from "./specimens";

  // Three ways to read a pole, side by side for a handful of real ones: where it fires in real text,
  // the exact tokens that drive it, and what its weights say it writes. A row is a pole; its name
  // opens it in the explorer.
  const model = MODELS["qwen3-8b"];
  let poles = $state<(Pole | null)[]>(GALLERY.map(() => null));
  let failed = $state(false);
  function load() {
    GALLERY.forEach((row, i) => {
      loadNeuron(model.id, row.layer, row.n).then((detail) => { poles[i] = detail?.poles.find((p) => p.pole === row.pole) ?? null; }, () => (failed = true));
    });
  }
  const writes = (pole: Pole) => headline(pole.reads.find((r) => r.col === "write_R")?.tokens ?? [], 4);
  const COLUMNS = [
    { name: "Where it fires", how: "15M tokens of web, Chinese, Python and chat" },
    { name: "Exact drivers", how: "each common token, swapped into 8 documents" },
    { name: "What it writes", how: "the R-lens, from the weights alone" },
  ];
</script>

<Part id="reads" title="Three ways to read" onnear={load}>
  {#snippet caption()}
    <p>Real text, exact drivers, and the weights.</p>
  {/snippet}
  <div class="spec">
    <div class="table" data-link-scope>
      <span></span>
      {#each COLUMNS as column (column.name)}<p class="col"><span class="name">{column.name}</span><span class="meta">{column.how}</span></p>{/each}
      {#each GALLERY as row, i (`${row.layer}:${row.n}`)}
        {@const pole = poles[i]}
        <div class="row" style:--tint={depthColor(model, row.layer)}>
          <a class="id" href="/{model.id}/L{row.layer}/n{row.n}" data-tip={pole?.label.fires} data-tip-title={`${neuronId(row.layer, row.n)} ${row.pole > 0 ? "+" : "−"}`}>{neuronId(row.layer, row.n)}<span class="sign">{row.pole > 0 ? "+" : "−"}</span></a>
          {#if pole}
            <div class="cell" data-col={COLUMNS[0].name}>{#if pole.contexts[0]}<Context context={pole.contexts[0]} />{/if}</div>
            <div class="cell toks" data-col={COLUMNS[1].name}>{#each pole.drivers.slice(0, 3) as [token, value], k (k)}<Token {token} {value} i={k} />{/each}</div>
            <div class="cell toks" data-col={COLUMNS[2].name}>
              {#if row.note}<span class="note">{row.note}</span>{:else}{#each writes(pole) as [token, count, flags], k (k)}<Token {token} {count} {flags} i={k} />{/each}{/if}
            </div>
          {:else}
            <span class="ghost"></span><span class="ghost"></span><span class="ghost"></span>
          {/if}
        </div>
      {/each}
    </div>
    {#if failed}<p class="meta">Some of these didn't load.</p>{/if}
    <p class="meta">From <a class="prose-link" href="https://huggingface.co/datasets/stdlogits/neuron-lens" rel="external noreferrer">the catalog</a>, every pole and head of both models.</p>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s4); min-width: 0; }
  .table { display: grid; grid-template-columns: 120px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); gap: var(--s2) var(--s5); }
  .col { display: grid; align-content: start; gap: 2px; padding-bottom: var(--s2); }
  .col .name { font: var(--type-label); }
  .row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: start; padding: var(--s3) 0; }
  .id { display: inline-flex; align-items: baseline; gap: var(--s2); padding-top: var(--s3); font: 600 16px/24px var(--display); font-variant-numeric: tabular-nums; transition: color var(--fast) var(--ease); }
  .sign { color: var(--ink3); }
  @media (hover: hover) { .id:hover { color: var(--ink2); } }
  .cell { min-width: 0; }
  .cell.toks { padding-top: var(--s2); }
  .note { color: var(--ink2); font: var(--type-small); }
  .ghost { height: 48px; border-radius: var(--r-box); background: var(--wash); }
  @media (max-width: 760px) {
    .table { grid-template-columns: minmax(0, 1fr); }
    .table > span:first-child, .col { display: none; }
    .row { row-gap: var(--s2); padding: var(--s4) 0; }
    .id { padding-top: 0; }
    .cell.toks { padding-top: 0; }
    .cell::before { content: attr(data-col); display: block; width: 100%; margin-bottom: var(--s1); color: var(--ink3); font: var(--type-meta); }
  }
</style>

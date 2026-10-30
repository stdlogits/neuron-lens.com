<script lang="ts">
  import Part from "../Part.svelte";
  import { MODELS, MODEL_ORDER, depthColor } from "../../lib/models";

  // The blind checks of the labels, drawn as pairs of bars: each label beside what it has to beat
  // (another unit's label, or chance). The numbers come from each model's labelChecks sentence; a
  // sentence they can't be read from is shown as written.
  interface Pair { value: number; against: number; shown: string; againstShown: string }
  interface Check { count: string | null; fires: Pair | null; writes: Pair | null; rest: string; text: string }

  function parse(text: string): Check {
    const count = text.match(/on (\d+) (poles|heads)/);
    const auroc = text.match(/AUROC (\d*\.\d+) \(another [^:]+: (\d*\.\d+)\)/);
    const judge = text.match(/(\d+)% of the time \(chance (\d+)%\)/);
    const rest = judge ? text.slice((judge.index ?? 0) + judge[0].length).replace(/^\.\s*/, "") : "";
    return {
      count: count ? `${count[1]} ${count[2] === "poles" ? "sides" : "heads"}` : null,
      fires: auroc ? { value: Number(auroc[1]), against: Number(auroc[2]), shown: auroc[1], againstShown: auroc[2] } : null,
      writes: judge ? { value: Number(judge[1]) / 100, against: Number(judge[2]) / 100, shown: `${judge[1]}%`, againstShown: `${judge[2]}%` } : null,
      rest,
      text,
    };
  }

  const groups = MODEL_ORDER.map((id) => ({
    model: MODELS[id],
    rows: (["neurons", "heads"] as const).map((unit) => ({ unit: unit === "neurons" ? "Neurons" : "Heads", against: unit === "neurons" ? "another side's label" : "another head's label", check: parse(MODELS[id].labelChecks[unit]) })),
  }));
</script>

<Part id="checks" title="How far to trust the labels" tint={depthColor(MODELS["qwen3-8b"], 8)}>
  {#snippet caption()}
    <p>Labels were checked blind. A firing label should pick out its own unit's firings better than another's label does; a judge should pick the write label out of four from what the unit does.</p>
  {/snippet}
  <div class="ledger">
    <div class="cols" aria-hidden="true">
      <span></span>
      <p><span class="head">Fires on</span><span class="key"><span class="sw own"></span>its label<span class="sw"></span>another's label</span><span class="unit meta">AUROC on held-out firings</span></p>
      <p><span class="head">Writes</span><span class="key"><span class="sw own"></span>its label<span class="sw"></span>chance</span><span class="unit meta">Picked out of four by a judge</span></p>
    </div>
    {#each groups as group (group.model.id)}
      <div class="group">
        <h3 class="model">{group.model.name}</h3>
        {#each group.rows as row (row.unit)}
          <div class="row">
            <p class="what">{row.unit}{#if row.check.count}<span class="meta">{row.check.count}</span>{/if}</p>
            {#if row.check.fires || row.check.writes}
              {#each [{ pair: row.check.fires, name: "Fires on", against: row.against }, { pair: row.check.writes, name: "Writes", against: "chance" }] as cell (cell.name)}
                <div class="cell" role="group" aria-label={cell.name}>
                  <span class="sr-only">{cell.name}:</span>
                  {#if cell.pair}
                    <p class="bar own"><span class="track"><i style:transform="scaleX({cell.pair.value})"></i></span><span class="num">{cell.pair.shown}</span><span class="sr-only">its label;</span></p>
                    <p class="bar"><span class="track"><i style:transform="scaleX({cell.pair.against})"></i></span><span class="num">{cell.pair.againstShown}</span><span class="sr-only">{cell.against}</span></p>
                  {/if}
                </div>
              {/each}
              {#if row.check.rest}<p class="rest">{row.check.rest}</p>{/if}
            {:else}
              <p class="rest none">{row.check.text}</p>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</Part>

<style>
  .ledger { display: grid; grid-template-columns: 140px repeat(2, minmax(0, 1fr)); column-gap: var(--s6); row-gap: var(--s6); min-width: 0; }
  .cols, .group, .row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; }
  .cols p { display: grid; justify-items: start; gap: var(--s1); }
  .key { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s1) var(--s2); color: var(--ink2); font: var(--type-small); }
  .sw { width: 12px; height: 8px; border-radius: 4px; background: color-mix(in oklch, var(--ink3) 45%, transparent); }
  .sw:not(:first-child) { margin-left: var(--s2); }
  .sw.own { background: var(--tint); }
  .group { row-gap: var(--s4); }
  .model { grid-column: 1 / -1; font: var(--type-label); }
  .row { row-gap: var(--s2); align-items: start; }
  .what { display: grid; gap: 2px; color: var(--ink2); font: var(--type-small); }
  .cell { display: grid; gap: var(--s2); min-width: 0; }
  .bar { display: grid; grid-template-columns: minmax(0, 1fr) 40px; align-items: center; column-gap: var(--s3); color: var(--ink3); font: var(--type-small); }
  .bar.own { color: var(--ink); font-weight: 500; }
  .track { position: relative; height: 8px; border-radius: 4px; background: var(--wash); overflow: hidden; }
  .track i { position: absolute; inset: 0; border-radius: 4px; background: color-mix(in oklch, var(--ink3) 45%, transparent); transform-origin: left; }
  .own .track i { background: var(--tint); }
  .num { text-align: end; font-variant-numeric: tabular-nums; }
  .rest { grid-column: 2 / -1; color: var(--ink2); font: var(--type-small); }
  .none { color: var(--ink3); }
  :global(.rv-in) .track i { animation: fill var(--glide) var(--ease) backwards; animation-delay: 80ms; }
  @keyframes fill { from { transform: scaleX(0); } }
  @media (max-width: 600px) {
    .ledger { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s4); }
    .what, .model { grid-column: 1 / -1; }
    .rest { grid-column: 1 / -1; }
    .cols > span:first-child { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { :global(.rv-in) .track i { animation: none; } }
</style>

<script lang="ts">
  import Swap from "../ui/Swap.svelte";
  import UnitBar from "./unit/UnitBar.svelte";
  import NeuronUnit from "./unit/NeuronUnit.svelte";
  import HeadUnit from "./unit/HeadUnit.svelte";
  import Pending from "./unit/Pending.svelte";
  import { useLens } from "./lens.svelte";

  // The chosen neuron or head. Its header stays put (the ID morphs); below it one unit gives way to
  // the next: stepping down the list it rises into place, stepping up it falls. A slow load shows
  // still washes after 150 ms; a failed one offers to try again.
  const lens = useLens();

  const detail = $derived(lens.unit === "heads" ? lens.headDetail : lens.neuronDetail);
  const phase = $derived(detail ? "ready" : lens.detailFailed ? "failed" : "pending");
  const unitKey = $derived(`${lens.modelId}/${lens.unit}/${lens.layer}/${lens.selected}`);
  const key = $derived(phase === "ready" ? unitKey : phase);
  const labelled = $derived(lens.index?.labelled ?? true);

  // Which way the new unit moves in: by its place in the list against the last one's, within a list.
  let last = { unit: "", list: "", position: -1, direction: 1 as 1 | -1 };
  const direction = $derived.by<1 | -1>(() => {
    const unit = unitKey;
    const list = `${lens.modelId}/${lens.unit}/${lens.layer}/${lens.all}`;
    const position = lens.position;
    const total = lens.order.length;
    if (unit === last.unit) return last.direction;
    let delta = list === last.list && position >= 0 && last.position >= 0 ? position - last.position : 1;
    // Wrapping from the end to the start (or back) still moves the way the step went.
    if (total > 2 && Math.abs(delta) === total - 1) delta = -delta;
    last = { unit, list, position, direction: delta < 0 ? -1 : 1 };
    return last.direction;
  });
</script>

<article class="view" id="unit" aria-labelledby="unit-title">
  <UnitBar />
  <Swap {key} {direction}>
    {#if phase === "failed"}
      <div class="failed" role="alert">
        <p>This one didn't load.</p>
        <button type="button" class="retry" onclick={() => lens.retry()}>Try again</button>
      </div>
    {:else if lens.unit === "heads" && lens.headDetail}
      <HeadUnit head={lens.headDetail} model={lens.model} {labelled} groupSize={lens.groupSize} />
    {:else if lens.unit === "neurons" && lens.neuronDetail}
      <NeuronUnit detail={lens.neuronDetail} layer={lens.layer} {labelled} />
    {:else}
      <Pending columns={lens.unit === "heads" ? 3 : 2} />
    {/if}
  </Swap>
</article>

<style>
  .view {
    container: unit / inline-size;
    flex: 999 1 640px;
    display: grid;
    align-content: start;
    gap: var(--s6);
    min-width: 0;
    scroll-margin-top: var(--s5);
  }
  @media (max-width: 720px) { .view { flex-basis: 100%; } }
  .failed { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s4); padding: var(--s5) 0; color: var(--ink2); font: var(--type-body); }
  .retry {
    height: 36px;
    padding: 0 var(--s4);
    border: 0;
    border-radius: var(--r-pill);
    background: var(--wash);
    color: var(--ink);
    font: var(--type-control);
    cursor: pointer;
    transition: background-color var(--fast) var(--ease), scale var(--fast) var(--ease);
  }
  .retry:active { scale: 0.97; }
  @media (hover: hover) { .retry:hover { background: var(--wash2); } }
</style>

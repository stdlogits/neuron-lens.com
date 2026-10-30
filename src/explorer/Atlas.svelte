<script lang="ts">
  import { untrack } from "svelte";
  import Scale from "./atlas/Scale.svelte";
  import { matchKey, useLens } from "./lens.svelte";
  import { SHADES, rankLayers, shadeScale, sliceOf, sliceRange, type Ranked } from "./atlas/levels";
  import { IN, ease, fadeOut, glide } from "../lib/motion";
  import { hideTip, showTip, type TipContent } from "../lib/tips";
  import { headId, loadLayerIndex, neuronId, type HeadRow, type IndexRow } from "../lib/data";
  import { depthColor } from "../lib/models";

  // The map of every layer: a column a layer, a short bar a unit, the most readable at the top, each
  // shaded by how readable it is. Neurons (the easiest 40 a layer, or in All mode the whole layer in
  // 40 slices) and heads share one look. Click a bar to open its unit, a column to open its layer;
  // press and drag to scrub through layers. As a slider: ←/→ layer, ↑/↓ unit, Enter opens.
  const lens = useLens();

  // The plot's top and bottom padding (--s2) and the gap between bars, in px, for pointing.
  const PAD = 8;
  const GAP = 2;

  // ---------- what the bars stand for

  /** A bar: its unit (null for one of All mode's slices) and its opacity. */
  interface Bar { unit: number | null; o: number }

  const layers = $derived(Array.from({ length: lens.model.layers }, (_, L) => L));
  const last = $derived(lens.model.layers - 1);
  const indexReady = $derived(lens.index?.id === lens.modelId);
  const headsReady = $derived(lens.heads?.length === lens.model.layers * lens.model.heads);
  const ranked = $derived<Ranked[] | null>(lens.scores?.length === lens.model.layers ? rankLayers(lens.scores) : null);
  // All mode shows the easiest neurons until every layer's scores are in, then crossfades.
  const mode = $derived<"heads" | "all" | "easiest">(lens.unit === "heads" ? "heads" : lens.all && ranked ? "all" : "easiest");
  const ready = $derived(mode === "heads" ? headsReady : mode === "all" || indexReady);

  function byLayer<T extends IndexRow | HeadRow>(rows: T[], score: number): T[][] {
    const out: T[][] = layers.map(() => []);
    for (const row of rows) out[row[0]]?.push(row);
    for (const column of out) column.sort((a, b) => (b[score] as number) - (a[score] as number));
    return out;
  }
  // Sorted as the layer list sorts them, so a bar's place matches the list's.
  const neuronColumns = $derived(byLayer(indexReady ? lens.index!.neurons : [], 4));
  const headColumns = $derived(byLayer(headsReady ? lens.heads! : [], 10));
  const neuronShade = $derived(shadeScale(indexReady ? lens.index!.neurons.map((row) => row[4]) : []));
  const headShade = $derived(shadeScale(headsReady ? lens.heads!.map((row) => row[10]) : []));

  // A filter or a search narrows the map: what is left keeps its place, everything else fades.
  const matches = $derived(lens.unit === "heads" ? lens.matches.heads : lens.matches.neurons);
  const filtering = $derived(!!(lens.unit === "heads" ? lens.activeFilter.heads : lens.activeFilter.neurons));
  function opacity(shade: number, passes: boolean, matched: boolean) {
    // Search hits stand out at full strength; with only a filter, what passes keeps its order of
    // shades but never sinks to the faintest, which is left to what doesn't.
    if (matches.size) return passes && matched ? 1 : SHADES[0];
    if (filtering) return passes ? SHADES[3 + Math.round((shade * 6) / 9)] : SHADES[0];
    return SHADES[shade];
  }

  // All mode names a neuron from its layer's full index, loaded the first time it's wanted.
  let known = $state.raw<Record<number, IndexRow[]>>({});
  const asked = new Set<string>();
  const keep = (layer: number, rows: IndexRow[]) => {
    const byNeuron: IndexRow[] = [];
    for (const row of rows) byNeuron[row[1]] = row;
    known = { ...known, [layer]: byNeuron };
  };
  function peek(layer: number) {
    const model = lens.modelId;
    if (known[layer] || asked.has(`${model}:${layer}`)) return;
    asked.add(`${model}:${layer}`);
    loadLayerIndex(model, layer).then((rows) => {
      if (lens.modelId !== model) return;
      keep(layer, rows);
      if (pointed?.layer === layer) point(pointed.layer, pointed.slot, pointed.along, true);
    }, () => asked.delete(`${model}:${layer}`));
  }
  $effect(() => {
    void lens.modelId;
    untrack(() => { known = {}; asked.clear(); });
  });
  // The current layer's rows, which the list loads in All mode anyway.
  $effect(() => {
    const rows = lens.layerRows;
    if (rows?.model === lens.modelId && !untrack(() => known[rows.layer])) untrack(() => keep(rows.layer, rows.rows));
  });

  /** A layer as All mode's slices: lit where a search hit ranks; with a filter, by the share that passes where the layer's rows are in. */
  function slices(layer: Ranked, L: number, hits: IndexRow[]): Bar[] {
    const n = layer.order.length;
    const lit = new Set(hits.filter((row) => lens.passesNeuron(row)).map((row) => sliceOf(layer.rank[row[1]], n)));
    const rows = filtering ? known[L] : undefined;
    return Array.from(layer.shades, (shade, s) => {
      let o = SHADES[shade];
      if (matches.size) o = lit.has(s) ? 1 : SHADES[0];
      else if (rows) {
        const [from, to] = sliceRange(s, n);
        let pass = 0;
        for (let r = from; r < to; r += 1) if (rows[layer.order[r]] && lens.passesNeuron(rows[layer.order[r]])) pass += 1;
        o = SHADES[0] + (o - SHADES[0]) * Math.sqrt(pass / Math.max(1, to - from));
      }
      return { unit: null, o };
    });
  }

  const columns = $derived.by<Bar[][]>(() => {
    if (!ready) return layers.map(() => []);
    if (mode === "heads") return headColumns.map((column) => column.map((row) => ({ unit: row[1], o: opacity(headShade(row[10]), lens.passesHead(row), matches.has(matchKey(row[0], row[1]))) })));
    if (mode === "easiest") return neuronColumns.map((column) => column.map((row) => ({ unit: row[1], o: opacity(neuronShade(row[4]), lens.passesNeuron(row), matches.has(matchKey(row[0], row[1]))) })));
    const hits: IndexRow[][] = layers.map(() => []);
    if (matches.size) for (const row of lens.index?.neurons ?? []) if (matches.has(matchKey(row[0], row[1]))) hits[row[0]].push(row);
    return ranked!.map((layer, L) => slices(layer, L, hits[L]));
  });
  const rows = $derived(Math.max(1, ...columns.map((column) => column.length)));

  /** The selected unit's bar in the current column. */
  const selected = $derived.by(() => {
    const unit = lens.selected;
    if (unit === null || !ready) return -1;
    if (mode === "all") return unit < ranked![lens.layer].rank.length ? sliceOf(ranked![lens.layer].rank[unit], ranked![lens.layer].rank.length) : -1;
    return (mode === "heads" ? headColumns : neuronColumns)[lens.layer]?.findIndex((row) => row[1] === unit) ?? -1;
  });

  // ---------- geometry

  let width = $state(0);
  // Phone widths: shorter, thinner bars so the whole map stays in view without scrolling sideways.
  const narrow = $derived(width > 0 && width / lens.model.layers < 14);
  const bar = $derived(narrow ? 2 : 3);
  const pitch = $derived(bar + GAP);
  const height = $derived(PAD * 2 + rows * pitch - GAP);

  // ---------- motion: the first plot of a model arrives column by column; later ones crossfade

  let arrived: string | null = null;
  const plot = $derived.by(() => {
    const arrive = ready && arrived !== lens.modelId;
    if (arrive) arrived = lens.modelId;
    return { key: `${lens.modelId}:${mode}:${ready}`, arrive };
  });
  function plotIn(_node: Element, arrive: boolean) {
    return arrive ? { duration: 0 } : { duration: IN, easing: ease, css: (t: number) => `opacity: ${t}` };
  }

  // ---------- pointing

  let host = $state<HTMLDivElement>();
  let area = $state<HTMLDivElement>();
  /** The column under a mouse, washed. */
  let hover = $state<number | null>(null);
  let pointed: { layer: number; slot: number; along: number; unit: number } | null = null;
  /** The pointed bar, lifted to full strength so the tip's subject is plain. */
  let lit = $state<{ layer: number; slot: number } | null>(null);
  let press = $state<{ from: number; moved: boolean } | null>(null);
  // A run of layer changes (one drag, or keys while focused) adds one history entry, then replaces it.
  let pushed = false;

  function goLayer(L: number) {
    if (L === lens.layer && lens.route.index === null && lens.route.layer !== null) return;
    lens.setLayer(L, !pushed);
    pushed = true;
  }

  function spot(event: PointerEvent) {
    const box = area!.getBoundingClientRect();
    const column = box.width / lens.model.layers;
    const L = Math.max(0, Math.min(last, Math.floor((event.clientX - box.left) / column)));
    const y = event.clientY - box.top - PAD + GAP / 2;
    const i = Math.floor(y / pitch);
    const slot = y >= 0 && event.clientY < box.bottom && i < columns[L].length ? i : null;
    // Along the bar: All mode walks the ranks of its slice from left to right.
    const along = Math.max(0, Math.min(0.999, (event.clientX - box.left - L * column - column * 0.19) / (column * 0.62)));
    return { L, slot, along };
  }

  function unitAt(L: number, slot: number, along: number): number | null {
    const bar = columns[L]?.[slot];
    if (!bar) return null;
    if (bar.unit !== null || mode !== "all") return bar.unit;
    const layer = ranked![L];
    const [from, to] = sliceRange(slot, layer.order.length);
    return layer.order[from + Math.floor(along * (to - from))];
  }

  function content(L: number, slot: number, unit: number): TipContent {
    if (mode === "heads") {
      const row = headColumns[L][slot];
      return { title: headId(L, unit), body: row?.[3], sub: row?.[4] };
    }
    const row = mode === "all" ? known[L]?.[unit] : neuronColumns[L][slot];
    if (!row && mode === "all") peek(L);
    return { title: neuronId(L, unit), body: row?.[2], sub: row?.[3] };
  }

  /** Name the unit under the pointer in the tip, which glides from bar to bar. */
  function point(L: number, slot: number | null, along: number, refresh = false) {
    const unit = slot === null ? null : unitAt(L, slot, along);
    if (slot === null || unit === null) { unpoint(); return; }
    if (!refresh && pointed?.unit === unit && pointed.layer === L && pointed.slot === slot) return;
    pointed = { layer: L, slot, along, unit };
    if (lit?.layer !== L || lit.slot !== slot) lit = { layer: L, slot };
    const box = area!.getBoundingClientRect();
    const column = box.width / lens.model.layers;
    const wide = L === lens.layer && slot === selected ? 0.86 : 0.62;
    const rect = new DOMRect(box.left + L * column + (column * (1 - wide)) / 2, box.top + PAD + slot * pitch, column * wide, bar);
    showTip(rect, content(L, slot, unit));
  }
  function unpoint() {
    if (!pointed) return;
    pointed = null;
    lit = null;
    hideTip();
  }

  function down(event: PointerEvent) {
    if (event.button !== 0) return;
    pushed = false;
    press = { from: spot(event).L, moved: false };
    if (event.pointerType !== "touch") host!.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    const at = spot(event);
    if (press && (press.moved || at.L !== press.from)) {
      press.moved = true;
      unpoint();
      goLayer(at.L);
    }
    if (event.pointerType === "touch") return;
    hover = at.L;
    if (!press?.moved) point(at.L, at.slot, at.along);
  }
  function up(event: PointerEvent) {
    if (!press) return;
    const { moved } = press;
    press = null;
    if (moved) return;
    // A tap picks a layer: bars are too fine to aim at with a finger.
    const at = spot(event);
    const unit = event.pointerType === "touch" || at.slot === null ? null : unitAt(at.L, at.slot, at.along);
    if (unit !== null) lens.open(lens.unit, at.L, unit);
    else goLayer(at.L);
  }
  function leave() {
    if (press) return;
    hover = null;
    unpoint();
  }

  $effect(() => {
    const scrolled = () => unpoint();
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => window.removeEventListener("scroll", scrolled);
  });

  // ---------- keys

  function key(event: KeyboardEvent) {
    const L = lens.layer;
    const to: Record<string, number> = { ArrowRight: L + 1, ArrowLeft: L - 1, PageUp: L + 5, PageDown: L - 5, Home: 0, End: last };
    if (event.key in to) goLayer(Math.max(0, Math.min(last, to[event.key])));
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") lens.step(event.key === "ArrowUp" ? -1 : 1);
    else if (event.key === "Enter" && lens.selected !== null) lens.open(lens.unit, L, lens.selected);
    else return;
    event.preventDefault();
    unpoint();
  }

  const valueText = $derived(`Layer ${lens.layer}, ${lens.band.name}${lens.selected === null ? "" : `, ${lens.unit === "heads" ? "head" : "neuron"} ${lens.selected}`}`);
</script>

<div
  class="atlas"
  class:narrow
  class:scrubbing={press?.moved}
  role="slider"
  tabindex="0"
  aria-label="Layer"
  aria-valuemin={0}
  aria-valuemax={last}
  aria-valuenow={lens.layer}
  aria-valuetext={valueText}
  bind:this={host}
  bind:clientWidth={width}
  style:--count={lens.model.layers}
  style:--bar="{bar}px"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={() => { press = null; leave(); }}
  onpointerleave={leave}
  onkeydown={key}
  onfocus={() => (pushed = false)}
>
  <div class="plot" bind:this={area} use:glide style:height="{height}px">
    {#each layers as L (L)}
      <span class="col" class:hot={hover === L} aria-current={L === lens.layer ? "true" : undefined}></span>
    {/each}
    {#key plot.key}
      <div class="bars" class:arrive={plot.arrive} in:plotIn={plot.arrive} out:fadeOut>
        {#each columns as column, L}
          <div class="stack" style:--c={depthColor(lens.model, L)} style:--L={L}>
            {#each column as item, i}
              <i class:sel={L === lens.layer && i === selected} class:lit={lit?.layer === L && lit.slot === i} style:--o={item.o}></i>
            {/each}
          </div>
        {/each}
      </div>
    {/key}
  </div>
  <Scale model={lens.model} layer={lens.layer} {hover} {width} dots={lens.unit === "heads"} />
</div>

<style>
  .atlas {
    display: grid;
    gap: var(--s1);
    min-width: 0;
    border-radius: var(--r-col);
    cursor: pointer;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .atlas:focus-visible { outline-offset: var(--s1); }
  .scrubbing { cursor: ew-resize; }

  .plot {
    --glide-bg: var(--wash);
    --glide-radius: var(--r-col);
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    overflow: clip;
    transition: height var(--glide) var(--ease);
  }
  /* The current column's wash spans the plot as its height glides, rather than chasing it. */
  .plot :global(.glide-thumb) { bottom: 0; height: auto !important; }
  .col { border-radius: var(--r-col); transition: background-color var(--fast) var(--ease); }
  .col.hot:not([aria-current]) { background: var(--wash); }

  .bars {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    pointer-events: none;
  }
  .stack {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 2px;
    padding: var(--s2) 0;
  }
  /* 3 × 2 px bars (2 px on phones) and radius 2: finer than the space and radius scales go. */
  .stack i {
    display: block;
    width: 62%;
    height: var(--bar);
    border-radius: 2px;
    background: var(--c);
    opacity: var(--o);
    transition: width var(--glide) var(--ease), background-color var(--glide) var(--ease), opacity var(--glide) var(--ease);
  }
  .stack i.lit { opacity: 1; transition-duration: var(--fast); }
  .stack i.sel { width: 86%; background: var(--ink); opacity: 1; }
  .narrow .plot { --glide-radius: var(--s1); }
  .narrow .col { border-radius: var(--s1); }
  .narrow .stack i { width: 70%; border-radius: 1px; }
  .narrow .stack i.sel { width: 100%; }

  /* Arriving: each column's bars fade in and grow from the left, 16 ms after the one before. */
  .arrive .stack i {
    transform-origin: left center;
    animation: arrive var(--in) var(--ease) backwards;
    animation-delay: calc(var(--L) * 16ms);
  }
  @keyframes arrive {
    from { opacity: 0; transform: scaleX(0.2); }
  }

  @media (prefers-reduced-motion: reduce) {
    .arrive .stack i { animation: fade var(--fast) var(--ease) backwards; animation-delay: 0ms; }
    @keyframes fade { from { opacity: 0; } }
  }
  @media (forced-colors: active) {
    .stack i { background: CanvasText; }
    .stack i.sel { background: Highlight; }
  }
</style>

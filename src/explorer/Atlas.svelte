<script lang="ts">
  import { untrack } from "svelte";
  import Scale from "./atlas/Scale.svelte";
  import { matchKey, useLens } from "./lens.svelte";
  import { ALL_ROWS, SHADES, byteShades, field, shadeScale } from "./atlas/levels";
  import { IN, ease, fadeOut, glide, hideTip, showTip, type TipContent } from "@stdlogits/ledger";
  import { headId, loadLayerIndex, neuronId, type HeadRow, type IndexRow } from "../lib/data";
  import { depthColor } from "../lib/models";
  import { theme } from "../lib/theme";

  // The map of every layer: a column a layer, a short bar a unit, the most readable at the top, each
  // shaded by how readable it is. Neurons (the easiest 40 a layer) and heads share one look; All mode
  // draws every neuron of a layer instead, a cell each in neuron order, on a canvas. Click a bar to open its unit, a column to open its layer;
  // press and drag to scrub through layers. As a slider: ←/→ layer, ↑/↓ unit, Enter opens.
  const lens = useLens();

  // The plot's top and bottom padding (--s2) and the gap between bars, in px, for pointing.
  const PAD = 8;
  const GAP = 2;

  // ---------- what the bars stand for

  /** A bar: its unit and its opacity. */
  interface Bar { unit: number; o: number }

  const layers = $derived(Array.from({ length: lens.model.layers }, (_, L) => L));
  const last = $derived(lens.model.layers - 1);
  const indexReady = $derived(lens.index?.id === lens.modelId);
  const headsReady = $derived(lens.heads?.length === lens.model.layers * lens.model.heads);
  /** All mode: each readability byte's shade, once every layer's scores are in. */
  const byteShade = $derived<Uint8Array | null>(lens.scores?.length === lens.model.layers ? byteShades(lens.scores) : null);
  // All mode shows the easiest neurons until every layer's scores are in, then crossfades.
  const mode = $derived<"heads" | "all" | "easiest">(lens.unit === "heads" ? "heads" : lens.all && byteShade ? "all" : "easiest");
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
      if (pointed?.layer === layer) point(pointed.layer, pointed.slot, pointed.along, pointed.x, pointed.y, true);
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

  const columns = $derived.by<Bar[][]>(() => {
    if (!ready) return layers.map(() => []);
    if (mode === "heads") return headColumns.map((column) => column.map((row) => ({ unit: row[1], o: opacity(headShade(row[10]), lens.passesHead(row), matches.has(matchKey(row[0], row[1]))) })));
    if (mode === "easiest") return neuronColumns.map((column) => column.map((row) => ({ unit: row[1], o: opacity(neuronShade(row[4]), lens.passesNeuron(row), matches.has(matchKey(row[0], row[1]))) })));
    return layers.map(() => []);
  });
  const rows = $derived(mode === "all" ? ALL_ROWS : Math.max(1, ...columns.map((column) => column.length)));

  /** The selected unit's bar in the current column. */
  const selected = $derived.by(() => {
    const unit = lens.selected;
    if (unit === null || !ready || mode === "all") return -1;
    return (mode === "heads" ? headColumns : neuronColumns)[lens.layer]?.findIndex((row) => row[1] === unit) ?? -1;
  });

  // ---------- geometry

  let width = $state(0);
  // Phone widths: shorter, thinner bars so the whole map stays in view without scrolling sideways.
  const narrow = $derived(width > 0 && width / lens.model.layers < 14);
  const bar = $derived(narrow ? 2 : 3);
  const pitch = $derived(bar + GAP);
  const height = $derived(PAD * 2 + rows * pitch - GAP);

  // ---------- All mode: every neuron a cell, in neuron order, across the bars' width of its column

  const share = $derived(narrow ? 0.7 : 0.62);
  const grid = $derived(field(lens.model.mlp, (width / lens.model.layers) * share, height - PAD * 2));
  const left = (L: number) => (L + (1 - share) / 2) * (width / lens.model.layers);
  /** A neuron's cell, in px from the plot's corner. */
  const cell = (L: number, i: number) => ({ x: left(L) + (i % grid.g) * grid.cw, y: PAD + Math.floor(i / grid.g) * grid.ch });
  /** The neuron whose cell holds a point of the plot, if any. */
  function neuronAt(L: number, x: number, y: number): number | null {
    const cx = Math.floor((x - left(L)) / grid.cw);
    const cy = Math.floor((y - PAD) / grid.ch);
    if (cx < 0 || cx >= grid.g || cy < 0) return null;
    const i = cy * grid.g + cx;
    return i < lens.model.mlp ? i : null;
  }

  let canvas = $state<HTMLCanvasElement>();
  let probe = $state<HTMLSpanElement>();
  let swatch: CanvasRenderingContext2D | null = null;
  /** A depth colour as RGB, read through the page's own CSS (it mixes theme colours in oklch). */
  function rgb(css: string): [number, number, number] {
    probe!.style.color = css;
    swatch ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!swatch) return [128, 128, 128];
    swatch.clearRect(0, 0, 1, 1);
    swatch.fillStyle = "#808080";
    swatch.fillStyle = getComputedStyle(probe!).color;
    swatch.fillRect(0, 0, 1, 1);
    const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  }

  // Each neuron's opacity, as the bars': lit by a search, narrowed by a filter where its layer's rows
  // are in (the current layer and any pointed at); a cell takes the brightest neuron that falls in it.
  $effect(() => {
    if (mode !== "all" || !canvas || !probe || !byteShade || !lens.scores || width === 0) return;
    void theme.mode;
    const scale = window.devicePixelRatio || 1;
    const W = Math.round(width * scale);
    const H = Math.round(height * scale);
    canvas.width = W;
    canvas.height = H;
    const hits = new Map<number, Set<number>>();
    for (const key of matches) {
      const [L, i] = key.split(":").map(Number);
      if (!hits.has(L)) hits.set(L, new Set());
      hits.get(L)!.add(i);
    }
    const image = new ImageData(W, H);
    const px = image.data;
    const { g, cw, ch } = grid;
    for (const L of layers) {
      const bytes = lens.scores[L];
      const [r, gr, b] = rgb(depthColor(lens.model, L));
      const lit = hits.get(L);
      const rows = filtering ? known[L] : undefined;
      const x0 = left(L);
      for (let i = 0; i < bytes.length; i += 1) {
        const row = rows?.[i];
        const a = Math.round(255 * opacity(byteShade[bytes[i]], row ? lens.passesNeuron(row) : true, lit?.has(i) ?? false));
        const cx = i % g;
        const cy = (i - cx) / g;
        const xa = Math.floor((x0 + cx * cw) * scale);
        const xb = Math.max(xa + 1, Math.floor((x0 + (cx + 1) * cw) * scale));
        const ya = Math.floor((PAD + cy * ch) * scale);
        const yb = Math.max(ya + 1, Math.floor((PAD + (cy + 1) * ch) * scale));
        for (let y = ya; y < yb && y < H; y += 1) {
          for (let x = xa; x < xb && x < W; x += 1) {
            const at = (y * W + x) * 4;
            if (px[at + 3] >= a) continue;
            px[at] = r;
            px[at + 1] = gr;
            px[at + 2] = b;
            px[at + 3] = a;
          }
        }
      }
    }
    canvas.getContext("2d")?.putImageData(image, 0, 0);
  });

  /** All mode: the selected neuron's row, marked by an ink bar as wide as a selected bar. */
  const pin = $derived.by(() => {
    if (mode !== "all" || lens.selected === null || lens.selected >= lens.model.mlp || width === 0) return null;
    const column = width / lens.model.layers;
    const { y } = cell(lens.layer, lens.selected);
    const wide = narrow ? 1 : 0.86;
    return { x: (lens.layer + (1 - wide) / 2) * column, y: y + grid.ch / 2 - bar / 2, w: column * wide };
  });

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
  let pointed: { layer: number; slot: number; along: number; x: number; y: number; unit: number } | null = null;
  /** The pointed bar, lifted to full strength so the tip's subject is plain. */
  let lit = $state<{ layer: number; slot: number } | null>(null);
  /** All mode: the pointed neuron's cell. */
  let spotted = $state<{ x: number; y: number } | null>(null);
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
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const i = Math.floor((y - PAD + GAP / 2) / pitch);
    const slot = y - PAD + GAP / 2 >= 0 && event.clientY < box.bottom && i < columns[L].length ? i : null;
    const along = Math.max(0, Math.min(0.999, (x - L * column - column * 0.19) / (column * 0.62)));
    return { L, slot, along, x, y };
  }

  function unitAt(L: number, slot: number | null, x: number, y: number): number | null {
    if (mode === "all") return y < height ? neuronAt(L, x, y) : null;
    return slot === null ? null : columns[L]?.[slot]?.unit ?? null;
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

  /** Name the unit under the pointer in the tip, which glides from bar to bar (or cell to cell). */
  function point(L: number, slot: number | null, along: number, x: number, y: number, refresh = false) {
    const unit = unitAt(L, slot, x, y);
    if (unit === null) { unpoint(); return; }
    if (!refresh && pointed?.unit === unit && pointed.layer === L) return;
    pointed = { layer: L, slot: slot ?? -1, along, x, y, unit };
    const box = area!.getBoundingClientRect();
    const column = box.width / lens.model.layers;
    let rect: DOMRect;
    if (mode === "all") {
      const at = cell(L, unit);
      spotted = { x: at.x + grid.cw / 2, y: at.y + grid.ch / 2 };
      rect = new DOMRect(box.left + spotted.x - 3, box.top + spotted.y - 3, 6, 6);
    } else {
      if (lit?.layer !== L || lit.slot !== slot) lit = { layer: L, slot: slot! };
      const wide = L === lens.layer && slot === selected ? 0.86 : 0.62;
      rect = new DOMRect(box.left + L * column + (column * (1 - wide)) / 2, box.top + PAD + slot! * pitch, column * wide, bar);
    }
    showTip(rect, content(L, slot ?? -1, unit));
  }
  function unpoint() {
    if (!pointed) return;
    pointed = null;
    lit = null;
    spotted = null;
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
    if (!press?.moved) point(at.L, at.slot, at.along, at.x, at.y);
  }
  function up(event: PointerEvent) {
    if (!press) return;
    const { moved } = press;
    press = null;
    if (moved) return;
    // A tap picks a layer: bars are too fine to aim at with a finger.
    const at = spot(event);
    const unit = event.pointerType === "touch" ? null : unitAt(at.L, at.slot, at.x, at.y);
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
        {#if mode === "all"}
          <canvas class="field" bind:this={canvas} style:width="{width}px" style:height="{height}px" aria-hidden="true"></canvas>
        {:else}
          {#each columns as column, L}
            <div class="stack" style:--c={depthColor(lens.model, L)} style:--L={L}>
              {#each column as item, i}
                <i class:sel={L === lens.layer && i === selected} class:lit={lit?.layer === L && lit.slot === i} style:--o={item.o}></i>
              {/each}
            </div>
          {/each}
        {/if}
      </div>
    {/key}
    {#if pin}<span class="pin" style:width="{pin.w}px" style:transform="translate({pin.x}px, {pin.y}px)"></span>{/if}
    {#if spotted && mode === "all"}<span class="spot" style:transform="translate({spotted.x}px, {spotted.y}px)"></span>{/if}
    <span class="probe" bind:this={probe} aria-hidden="true"></span>
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

  /* All mode: every neuron a cell. The field arrives as a wipe across the layers. */
  .field { position: absolute; left: 0; top: 0; }
  .arrive .field { animation: wipe calc(var(--count) * 16ms + var(--in)) var(--ease) backwards; }
  @keyframes wipe { from { clip-path: inset(0 100% 0 0); } }
  /* The selected neuron's row: an ink bar like a selected bar, gliding as the selection moves. */
  .pin {
    position: absolute;
    left: 0;
    top: 0;
    height: var(--bar);
    border-radius: 2px;
    background: var(--ink);
    pointer-events: none;
    transition: transform var(--glide) var(--ease), width var(--glide) var(--ease);
  }
  /* The pointed neuron: a small ink dot over its cell. */
  .spot {
    position: absolute;
    left: -3px;
    top: -3px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink);
    pointer-events: none;
    transition: transform var(--fast) var(--ease);
  }
  .probe { position: absolute; width: 0; height: 0; overflow: hidden; }

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
    .arrive .stack i, .arrive .field { animation: fade var(--fast) var(--ease) backwards; animation-delay: 0ms; }
    @keyframes fade { from { opacity: 0; } }
  }
  @media (forced-colors: active) {
    .stack i { background: CanvasText; }
    .stack i.sel { background: Highlight; }
  }
</style>

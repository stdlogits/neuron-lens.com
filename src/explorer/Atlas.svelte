<script lang="ts">
  import { untrack } from "svelte";
  import Scale from "./atlas/Scale.svelte";
  import { matchKey, useLens, type Matches } from "./lens.svelte";
  import { ALL_ROWS, FAINT, KEPT, byteStrengths, field, strength } from "./atlas/levels";
  import { GLIDE, IN, ease, fadeOut, glide, hideTip, showTip, type TipContent } from "@stdlogits/ledger";
  import { headId, loadLayerIndex, neuronId, type HeadRow, type IndexRow } from "../lib/data";
  import { depthColor, type ModelId, type ModelInfo } from "../lib/models";
  import { theme } from "../lib/theme";

  // The map of every layer: a column a layer, a short bar a unit, the labeller's surest at the top, each
  // as strong as the labeller was sure of it (`atlas/levels.ts`). Neurons (the easiest 40 a layer) and heads share one look; All mode
  // draws every neuron of a layer instead, a cell each in neuron order, on a canvas. Click a bar to open its unit, a column to open its layer;
  // press and drag to scrub through layers. As a slider: ←/→ layer, ↑/↓ unit, Enter opens.
  const lens = useLens();

  // The plot's top and bottom padding (--s2) and the gap between bars, in px, for pointing.
  const PAD = 8;
  const GAP = 2;

  // ---------- what the bars stand for

  type Mode = "heads" | "all" | "easiest";
  /** A bar: its unit, its opacity and its labels (for the tip). */
  interface Bar { unit: number; o: number; body?: string; sub?: string }
  /** What the plot draws: one model's units in one mode, and the place it marks (the selected unit's slot in its column). */
  interface View { modelId: ModelId; model: ModelInfo; mode: Mode; ready: boolean; columns: Bar[][]; rows: number; layer: number; unit: number | null; slot: number }

  const last = $derived(lens.model.layers - 1);
  const indexReady = $derived(lens.index?.id === lens.modelId);
  const headsReady = $derived(lens.heads?.length === lens.model.layers * lens.model.heads);
  /** All mode: each confidence byte's strength, once every layer's scores and the model's top score are in. */
  const byteStrength = $derived<Float32Array | null>(lens.scores?.length === lens.model.layers && indexReady ? byteStrengths(lens.index!.neurons.reduce((top, row) => Math.max(top, row[4]), 0)) : null);
  /** The mode asked for, whether its units are in, and whether they failed (so there is nothing to wait for). */
  // (All mode waits for the layer's rows too, which place its selected neuron.)
  const want = $derived<Mode>(lens.unit === "heads" ? "heads" : lens.all ? "all" : "easiest");
  const wanted = $derived(want === "heads" ? headsReady : want === "all" ? byteStrength !== null && lens.selected !== null : indexReady);
  const failed = $derived(lens.failed || (want === "heads" ? lens.failures.includes(lens.headIndexKey) : want === "all" && lens.failures.some((key) => key === lens.scoresKey || key === lens.rowsKey)));
  // All mode shows the easiest neurons until every layer's scores are in, then crossfades.
  const mode = $derived<Mode>(want === "all" && !byteStrength ? "easiest" : want);
  const ready = $derived(mode === "heads" ? headsReady : mode === "all" || indexReady);

  function byLayer<T extends IndexRow | HeadRow>(rows: T[], score: number): T[][] {
    const out: T[][] = Array.from({ length: lens.model.layers }, () => []);
    for (const row of rows) out[row[0]]?.push(row);
    for (const column of out) column.sort((a, b) => (b[score] as number) - (a[score] as number));
    return out;
  }
  // Sorted as the layer list sorts them, so a bar's place matches the list's.
  const neuronColumns = $derived(byLayer(indexReady ? lens.index!.neurons : [], 4));
  const headColumns = $derived(byLayer(headsReady ? lens.heads! : [], 10));

  // A filter or a search narrows the map: what is left keeps its place, everything else fades.
  const matches = $derived(lens.unit === "heads" ? lens.matches.heads : lens.matches.neurons);
  const filtering = $derived(!!(lens.unit === "heads" ? lens.activeFilter.heads : lens.activeFilter.neurons));
  function opacity(s: number, passes: boolean, matched: boolean) {
    // Search hits stand out at full strength; with only a filter, what passes keeps its strength
    // but never sinks near the faintest, which is left to what doesn't.
    if (matches.size) return passes && matched ? 1 : FAINT;
    if (filtering) return passes ? KEPT + (1 - KEPT) * s : FAINT;
    return FAINT + (1 - FAINT) * s;
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

  /** What there is to draw now, from what has loaded. */
  const fresh = $derived.by<View>(() => {
    let columns: Bar[][] = [];
    if (ready && mode === "heads") columns = headColumns.map((column) => column.map((row) => ({ unit: row[1], o: opacity(strength("head", row[10]), lens.passesHead(row), matches.has(matchKey(row[0], row[1]))), body: row[3], sub: row[4] })));
    else if (ready && mode === "easiest") columns = neuronColumns.map((column) => column.map((row) => ({ unit: row[1], o: opacity(strength("neuron", row[4]), lens.passesNeuron(row), matches.has(matchKey(row[0], row[1]))), body: row[2], sub: row[3] })));
    const unit = lens.selected;
    const slot = unit === null || mode === "all" ? -1 : columns[lens.layer]?.findIndex((item) => item.unit === unit) ?? -1;
    const rows = mode === "all" ? ALL_ROWS : Math.max(1, ...columns.map((column) => column.length));
    return { modelId: lens.modelId, model: lens.model, mode, ready, columns, rows, layer: lens.layer, unit, slot };
  });

  // Another model, or another mode, keeps the plot as it is until its units are in, so the bars move from
  // the old into the new rather than emptying between them. (A mode that draws the same model's units the same
  // way doesn't wait: All mode shows the easiest neurons while its scores load.)
  let kept: View | null = null;
  const view = $derived.by<View>(() => {
    const next = fresh;
    const same = kept?.modelId === next.modelId && kept.mode === next.mode;
    if (kept && !wanted && !failed && !(same && next.ready)) return kept;
    if (next.ready) kept = next;
    return next;
  });
  const holding = $derived(view !== fresh);
  const layers = $derived(Array.from({ length: view.model.layers }, (_, L) => L));
  const count = $derived(view.model.layers);

  // ---------- geometry

  let width = $state(0);
  // Phone widths: shorter, thinner bars so the whole map stays in view without scrolling sideways.
  const narrow = $derived(width > 0 && width / count < 14);
  const bar = $derived(narrow ? 2 : 3);
  const pitch = $derived(bar + GAP);
  const height = $derived(PAD * 2 + view.rows * pitch - GAP);

  // ---------- All mode: every neuron a cell, in neuron order, across the bars' width of its column

  const share = $derived(narrow ? 0.7 : 0.62);
  const grid = $derived(field(view.model.mlp, (width / count) * share, height - PAD * 2));
  const left = (L: number) => (L + (1 - share) / 2) * (width / count);
  /** A neuron's cell, in px from the plot's corner. */
  const cell = (L: number, i: number) => ({ x: left(L) + (i % grid.g) * grid.cw, y: PAD + Math.floor(i / grid.g) * grid.ch });
  /** The neuron whose cell holds a point of the plot, if any. */
  function neuronAt(L: number, x: number, y: number): number | null {
    const cx = Math.floor((x - left(L)) / grid.cw);
    const cy = Math.floor((y - PAD) / grid.ch);
    if (cx < 0 || cx >= grid.g || cy < 0) return null;
    const i = cy * grid.g + cx;
    return i < view.model.mlp ? i : null;
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
    if (view.mode !== "all" || holding || !canvas || !probe || !byteStrength || !lens.scores || width === 0) return;
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
      const [r, gr, b] = rgb(depthColor(view.model, L));
      const lit = hits.get(L);
      const rows = filtering ? known[L] : undefined;
      const x0 = left(L);
      for (let i = 0; i < bytes.length; i += 1) {
        const row = rows?.[i];
        const a = Math.round(255 * opacity(byteStrength[bytes[i]], row ? lens.passesNeuron(row) : true, lit?.has(i) ?? false));
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

  // A search or a filter changing what is lit: the change spreads out across the layers from the best match's
  // layer (or the current one), 10 ms a layer, rather than every bar changing at once. Set before the page is,
  // so the bars' new strengths and their delays arrive together; a bar pointed at or looked at never waits.
  const SWEEP_MOST = 300;
  let sweeping = $state(false);
  let sweepTimer = 0;
  const any = (m: Matches) => m.neurons.size + m.heads.size > 0;
  let litBy = untrack(() => ({ matches: lens.matches, filter: lens.activeFilter.value }));
  $effect.pre(() => {
    const now = { matches: lens.matches, filter: lens.activeFilter.value };
    untrack(() => {
      const before = litBy;
      litBy = now;
      if (now.filter === before.filter && (now.matches === before.matches || (!any(now.matches) && !any(before.matches)))) return;
      sweeping = true;
      clearTimeout(sweepTimer);
      sweepTimer = window.setTimeout(() => (sweeping = false), GLIDE + SWEEP_MOST + 40);
    });
  });
  // Moving into another model's units, every bar moves at once, and a tip naming the last model's unit goes.
  let sweptIn = untrack(() => view.modelId);
  $effect.pre(() => {
    const model = view.modelId;
    if (model === sweptIn) return;
    sweptIn = model;
    untrack(() => { clearTimeout(sweepTimer); sweeping = false; unpoint(); });
  });
  $effect(() => () => clearTimeout(sweepTimer));
  const sweepFrom = $derived(lens.matches.from ?? lens.layer);
  const sweepOf = (L: number) => `${Math.min(SWEEP_MOST, Math.abs(L - sweepFrom) * 10)}ms`;

  // The search result being looked at: its bar lifted and its column washed, or in All mode a dot on its cell.
  const peeked = $derived.by(() => {
    const p = lens.peek;
    if (!p || p.unit !== lens.unit || !view.ready || holding) return null;
    if (view.mode === "all") {
      if (p.index >= view.model.mlp || width === 0) return { layer: p.layer, slot: -1, spot: null };
      const { x, y } = cell(p.layer, p.index);
      return { layer: p.layer, slot: -1, spot: { x: x + grid.cw / 2, y: y + grid.ch / 2 } };
    }
    const slot = view.columns[p.layer]?.findIndex((item) => item.unit === p.index) ?? -1;
    return { layer: p.layer, slot, spot: null };
  });

  /** All mode: the selected neuron's row, marked by an ink bar as wide as a selected bar. */
  const pin = $derived.by(() => {
    if (view.mode !== "all" || view.unit === null || view.unit >= view.model.mlp || width === 0) return null;
    const column = width / count;
    const { y } = cell(view.layer, view.unit);
    const wide = narrow ? 1 : 0.86;
    return { x: (view.layer + (1 - wide) / 2) * column, y: y + grid.ch / 2 - bar / 2, w: column * wide };
  });

  // ---------- motion: the page's first plot arrives column by column. After it, the bars move into another
  // model's or mode's (stacks and bars a new model adds come in from the right; those it lacks fade), and the
  // All field crossfades.

  let arrived = $state(false);
  const arriving = $derived(!arrived && (view.mode === "all" || view.columns.some((column) => column.length > 0)));
  $effect(() => {
    if (!arriving) return;
    const timer = setTimeout(() => (arrived = true), untrack(() => count) * 16 + IN + 100);
    return () => clearTimeout(timer);
  });
  const plotKey = $derived(view.mode === "all" ? `all:${view.modelId}` : "bars");
  // A plot's own first frame adds nothing (what it starts with is there at once); once drawn, it is settled.
  let settled = $state("");
  $effect(() => {
    const key = plotKey;
    const frame = requestAnimationFrame(() => (settled = key));
    return () => cancelAnimationFrame(frame);
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
    const column = box.width / count;
    const L = Math.max(0, Math.min(count - 1, Math.floor((event.clientX - box.left) / column)));
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const i = Math.floor((y - PAD + GAP / 2) / pitch);
    const slot = y - PAD + GAP / 2 >= 0 && event.clientY < box.bottom && i < (view.columns[L]?.length ?? 0) ? i : null;
    const along = Math.max(0, Math.min(0.999, (x - L * column - column * 0.19) / (column * 0.62)));
    return { L, slot, along, x, y };
  }

  /** The unit under a point; none while the plot still shows the last model's or mode's. */
  function unitAt(L: number, slot: number | null, x: number, y: number): number | null {
    if (holding) return null;
    if (view.mode === "all") return y < height ? neuronAt(L, x, y) : null;
    return slot === null ? null : view.columns[L]?.[slot]?.unit ?? null;
  }

  /** A unit's ID over its labels, in italic where they were written for the post-trained model. */
  function content(L: number, slot: number, unit: number): TipContent {
    const lent = view.model.labelsFrom ? "both" : undefined;
    if (view.mode === "all") {
      const row = known[L]?.[unit];
      if (!row) peek(L);
      return { title: neuronId(L, unit), body: row?.[2], sub: row?.[3], lent };
    }
    const item = view.columns[L]?.[slot];
    return { title: view.mode === "heads" ? headId(L, unit) : neuronId(L, unit), body: item?.body, sub: item?.sub, lent };
  }

  /** Name the unit under the pointer in the tip, which glides from bar to bar (or cell to cell). */
  function point(L: number, slot: number | null, along: number, x: number, y: number, refresh = false) {
    const unit = unitAt(L, slot, x, y);
    if (unit === null) { unpoint(); return; }
    if (!refresh && pointed?.unit === unit && pointed.layer === L) return;
    pointed = { layer: L, slot: slot ?? -1, along, x, y, unit };
    const box = area!.getBoundingClientRect();
    const column = box.width / count;
    let rect: DOMRect;
    if (view.mode === "all") {
      const at = cell(L, unit);
      spotted = { x: at.x + grid.cw / 2, y: at.y + grid.ch / 2 };
      rect = new DOMRect(box.left + spotted.x - 3, box.top + spotted.y - 3, 6, 6);
    } else {
      if (lit?.layer !== L || lit.slot !== slot) lit = { layer: L, slot: slot! };
      const wide = L === view.layer && slot === view.slot ? 0.86 : 0.62;
      rect = new DOMRect(box.left + L * column + (column * (1 - wide)) / 2, box.top + PAD + slot! * pitch, column * wide, bar);
    }
    // The first waits for the pointer to rest, as every tip does; once one shows, the rest follow the pointer at once.
    showTip(rect, content(L, slot ?? -1, unit), { wait: true });
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
    // A click or tap opens the unit under it; off the bars, the layer.
    const at = spot(event);
    const unit = unitAt(at.L, at.slot, at.x, at.y);
    if (unit !== null) lens.open(lens.unit, at.L, unit);
    else goLayer(Math.min(last, at.L));
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
  style:--count={count}
  style:--bar="{bar}px"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={() => { press = null; leave(); }}
  onpointerleave={leave}
  onkeydown={key}
  onfocus={() => (pushed = false)}
>
  <div class="plot" class:sweeping bind:this={area} use:glide style:height="{height}px">
    {#each layers as L (L)}
      <span class="col" class:hot={hover === L || peeked?.layer === L} aria-current={L === view.layer ? "true" : undefined}></span>
    {/each}
    {#key plotKey}
      <div class="bars" class:arrive={arriving} class:settled={settled === plotKey} in:plotIn={arriving} out:fadeOut>
        {#if view.mode === "all"}
          <canvas class="field" bind:this={canvas} style:width="{width}px" style:height="{height}px" aria-hidden="true"></canvas>
        {:else}
          {#each view.columns as column, L (L)}
            <div class="stack" style:--c={depthColor(view.model, L)} style:--L={L} style:--sweep={sweepOf(L)} out:fadeOut>
              {#each column as item, i (i)}
                <i class:sel={L === view.layer && i === view.slot} class:lit={lit?.layer === L && lit.slot === i} class:peek={peeked?.layer === L && peeked.slot === i} style:--o={item.o} out:fadeOut></i>
              {/each}
            </div>
          {/each}
        {/if}
      </div>
    {/key}
    {#if pin}<span class="pin" style:width="{pin.w}px" style:transform="translate({pin.x}px, {pin.y}px)"></span>{/if}
    {#if spotted && view.mode === "all"}<span class="spot" style:transform="translate({spotted.x}px, {spotted.y}px)"></span>{/if}
    {#if peeked?.spot && !spotted}<span class="spot" style:transform="translate({peeked.spot.x}px, {peeked.spot.y}px)"></span>{/if}
    <span class="probe" bind:this={probe} aria-hidden="true"></span>
  </div>
  <Scale model={view.model} layer={view.layer} {hover} {width} dots={view.mode === "heads"} />
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
    pointer-events: none;
  }
  /* Each stack sits at its layer's share of the width, so another model's count of layers moves the stacks
     rather than reflowing them. */
  .stack {
    position: absolute;
    top: 0;
    left: calc(var(--L) * 100% / var(--count));
    width: calc(100% / var(--count));
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 2px;
    padding: var(--s2) 0;
    transition: left var(--glide) var(--ease), width var(--glide) var(--ease);
  }
  /* What a new model adds once the plot is drawn: a layer comes in from the right edge, a bar fades in. */
  @starting-style {
    .settled:not(.arrive) .stack { left: 100%; }
    .settled:not(.arrive) .stack i { opacity: 0; }
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
  .sweeping .stack i { transition-delay: 0ms, 0ms, var(--sweep); }
  .sweeping .stack i:is(.lit, .peek, .sel) { transition-delay: 0ms; }
  .stack i.lit { opacity: 1; transition-duration: var(--fast); }
  /* A search result looked at: full strength and as wide as a selected bar, in its depth colour. */
  .stack i.peek { width: 86%; opacity: 1; transition-duration: var(--fast); }
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

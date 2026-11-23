<script lang="ts">
  import { tick, untrack } from "svelte";
  import Atlas from "./Atlas.svelte";
  import Connections from "./graph/Connections.svelte";
  import { Lens, provideLens } from "./lens.svelte";
  import { headId, neuronId, rolesOf } from "../lib/data";
  import { router } from "../lib/router.svelte";
  import { SITE_NAME } from "../lib/site";
  import { primaryTokens } from "./unit/evidence";

  // A unit as its link card, 1200 × 630 and nothing else on the page: its pill and the site's name, its label, what it
  // fires on and what it makes the model say, and the atlas with its layer lit and the unit pinned. scripts/site/unfurl.js
  // has a hosted browser open this page (a unit's address with ?card) and keeps the picture it takes, once the page
  // marks itself drawn (data-card="drawn"). A card is a dark surface, as Ledger's are, whatever the viewer's theme.
  //
  // With ?card=circuit it is the card Discord shows, whose own text already carries the unit's words: the unit's
  // connections as the explorer's rail draws and lists them (it is the rail, laid out for a card): the graph at true
  // depth with its layers, and beside it the strongest of Driven by, Drives and Siblings.
  const circuit = untrack(() => router.route.page === "explore" && router.route.card === "circuit");
  // The rail's graph is shown larger here than it is laid out, so its canvas is asked for more pixels and stays sharp.
  if (circuit) Object.defineProperty(window, "devicePixelRatio", { value: (window.devicePixelRatio || 1) * 1.3, configurable: true });
  const root = document.documentElement;
  root.dataset.theme = "dark";
  root.style.scrollbarGutter = "auto";      // the page's reserved scrollbar would take the card's right edge
  root.style.overflow = "hidden";
  const lens = new Lens();
  provideLens(lens);

  const HEIGHT = 104;      // the atlas's strip; the plot is squashed into it
  const FACES = ["600 56px 'Wix Madefor Display'", "400 25px 'Wix Madefor Text'", "500 20px 'Wix Madefor Text'"];

  const head = $derived(lens.unit === "heads");
  const pole = $derived(lens.neuronDetail?.poles[lens.side] ?? null);
  const row = $derived(lens.selectedNeuronRow);
  /** Everything the words need is in: the unit's detail and, for a neuron, its row (which holds its sides' titles). */
  const loaded = $derived(head ? lens.headDetail !== null : pole !== null && (circuit || row !== null || lens.failures.includes(lens.rowsKey)));
  const silent = $derived(!head && pole?.silent === true);

  /** A label without the examples it ends on ("… (PCB, 主板)", "…: 她, herself, she"): the card sets its tokens beneath. */
  function gist(label: string) {
    const plain = label.replace(/\s*\([^()]*\)\s*$/, "");
    const [, lead, tail] = plain.match(/^(.*\S):\s+([^:]*)$/) ?? [];
    return (lead?.includes(" ") && (tail.includes(",") || !tail.includes(" ")) ? lead : plain).trim() || label;
  }
  const title = $derived.by(() => {
    if (silent) return "Near-silent";
    if (!lens.model.labelled) return "";
    if (head) return gist(lens.headDetail?.label.writes || lens.headDetail?.label.attends || lens.headDetail?.label.fires || "");
    return gist(row?.[2 + lens.side as 2 | 3] || pole?.label.fires || pole?.label.writes || "");
  });
  const role = $derived(head && lens.headDetail ? rolesOf(lens.headDetail.roles)[0]?.name ?? "" : "");
  /** What it fires on: the tokens of its top firings; a near-silent neuron has none, so what its weights read. */
  const ins = $derived(head || !pole ? [] : distinct(silent ? primaryTokens(pole.reads, "read_") : pole.peaks.map(([token]) => token)));
  const outs = $derived(distinct(head ? primaryTokens(lens.headDetail?.reads ?? [], "ov_") : pole && !silent ? primaryTokens(pole.reads, "write_") : []));
  function distinct(tokens: string[]) {
    const seen = new Set<string>();
    return tokens.filter((token) => { const key = token.trim().toLowerCase(); return !seen.has(key) && seen.add(key); });
  }

  // The words are cut to their room once set: the label to two lines, a word at a time, and each row of tokens to its width.
  let words = $state<string | null>(null);
  let most = $state({ ins: 5, outs: 5 });
  let label = $state<HTMLElement>();
  let reads = $state<HTMLElement>();
  let long = $state(false);
  const shown = $derived(words ?? title);

  let card = $state<HTMLElement>();
  let strip = $state<HTMLElement>();
  let fx = $state<HTMLCanvasElement>();
  let squash = $state(1);
  let drawn = $state(false);
  // A card whose data didn't load, or that hasn't drawn in 6 s, says so, so the hosted browser stops waiting for it.
  let lost = $state(false);
  const deadline = performance.now() + 6000;
  const late = () => { if (performance.now() > deadline) throw new Error("The card didn't draw in time"); };
  const status = $derived(drawn ? "drawn" : lost || lens.failed || lens.failures.length ? "failed" : "drawing");
  // The circuit: how much larger than the rail lays it out the graph is shown, and how far down its place it sits.
  let scale = $state(1);
  let drop = $state(0);

  const numbers = $derived(Array.from({ length: lens.model.layers }, (_, L) => L).filter((L) => L === lens.layer || (L % 5 === 0 && Math.abs(L - lens.layer) > 1)));
  const at = (layers: number) => `${(layers / lens.model.layers) * 100}%`;

  const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));

  async function fit() {
    // The faces the card sets, and whichever of their ranges its words turn out to need.
    await Promise.all(FACES.map((face) => document.fonts.load(face)));
    void card!.offsetHeight;
    await document.fonts.ready;
    if (label) {
      // One line is as tall as its capitals (text-box trims the rest); each further line adds a line's height.
      const tall = () => label!.getBoundingClientRect().height;
      if (tall() > 64) { long = true; await tick(); }
      const style = getComputedStyle(label);
      const room = parseFloat(style.lineHeight) + parseFloat(style.fontSize);
      for (let kept = title.split(" "); tall() > room && kept.length > 1;) {
        kept.pop();
        words = `${kept.join(" ").replace(/[,;:(]+$/, "")}…`;
        await tick();
      }
    }
    for (let guard = 0; reads && guard < 12 && reads.scrollWidth > reads.clientWidth + 1; guard += 1) {
      const shownIns = Math.min(most.ins, ins.length), shownOuts = Math.min(most.outs, outs.length);
      if (Math.max(shownIns, shownOuts) <= 1) break;
      most = shownIns >= shownOuts ? { ins: shownIns - 1, outs: most.outs } : { ins: most.ins, outs: shownOuts - 1 };
      await tick();
    }
  }

  /** The atlas has its units in and this one placed: one plot, drawn, with the unit's mark. (Not past its arrival:
   *  a card's atlas doesn't arrive, it is there, so nothing waits out an animation no one sees.) */
  async function placed(): Promise<{ plot: HTMLElement; mark: Element }> {
    for (;;) {
      const plot = strip?.querySelector<HTMLElement>(".plot");
      const bars = plot?.querySelectorAll(".bars") ?? [];
      const mark = plot?.querySelector(".pin, .stack i.sel");
      if (plot && mark && bars.length === 1 && bars[0].matches(".settled")) return { plot, mark };
      late();
      await frame();
    }
  }

  /** Light over the atlas: the unit's layer glows, a little of it rises behind the words, and its mark shines. */
  function light(mark: Element) {
    const canvas = fx!, scale = window.devicePixelRatio || 1;
    canvas.width = 1200 * scale;
    canvas.height = 630 * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.globalCompositeOperation = "lighter";
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.fillStyle = getComputedStyle(canvas).color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    const tint = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
    const fill = (blur: number, style: string | CanvasGradient, x: number, y: number, w: number, h: number) => {
      ctx.save(); ctx.filter = `blur(${blur}px)`; ctx.fillStyle = style; ctx.fillRect(x, y, w, h); ctx.restore();
    };
    const box = strip!.getBoundingClientRect();
    const column = strip!.querySelector('.col[aria-current="true"]')!.getBoundingClientRect();
    const { left: x, width: w } = column, mid = x + w / 2;
    fill(16, tint(0.42), x - 4, box.top - 4, w + 8, box.height + 8);
    fill(5, tint(0.3), x + 2, box.top, w - 4, box.height);
    const rise = ctx.createLinearGradient(0, box.top, 0, box.top - 130);
    rise.addColorStop(0, tint(0.17));
    rise.addColorStop(1, tint(0));
    fill(14, rise, mid - w * 0.8, box.top - 130, w * 1.6, 130);
    const pin = mark.getBoundingClientRect(), y = pin.top + pin.height / 2;
    fill(8, tint(0.9), pin.left - 6, y - 5, pin.width + 12, 10);
    fill(3, "rgba(255,255,255,0.8)", pin.left - 1, y - 2.5, pin.width + 2, 5);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(pin.left - 1, y - 2, pin.width + 2, 4, 2);
    ctx.fill();
  }

  /** The rail's graph has reached every unit it will (Graph.svelte marks it) and they have come to rest where the
   *  stage puts them: where they were a frame ago, a few frames running. */
  async function settled(): Promise<HTMLElement> {
    let graph: HTMLElement | null = null;
    while (!(graph = card?.querySelector<HTMLElement>(".figure .graph[data-settled]") ?? null)) { late(); await frame(); }
    const marks = () => [...graph!.querySelectorAll(".node")].map((node) => { const at = node.getBoundingClientRect(); return `${at.x.toFixed(1)} ${at.y.toFixed(1)} ${at.width.toFixed(1)}`; }).join(",");
    for (let last = "", same = 0, tries = 0; same < 4 && tries < 240; tries += 1) {
      await frame();
      const now = marks();
      same = now === last ? same + 1 : 0;
      last = now;
    }
    return graph;
  }

  /** The circuit, laid out: the graph as large as its place allows, the lists cut to their room, the unit's own
   *  layer on the scale in ink, and a little light about the links. */
  async function wire() {
    await Promise.all(FACES.map((face) => document.fonts.load(face)));
    const graph = await settled(), figure = graph.parentElement!, key = figure.querySelector<HTMLElement>(".key");
    const room = figure.clientHeight - (key ? key.offsetHeight + 10 : 0);
    scale = Math.min(figure.clientWidth / graph.offsetWidth, room / graph.offsetHeight, 1.62);
    drop = (room - graph.offsetHeight * scale) / 2;
    await document.fonts.ready;
    await tick();
    // The rows shown: three of what drives it and of what it drives, two siblings; a title too long for its row
    // loses the examples it ends on, and the lists give up rows until they fit under its name: a sibling first,
    // then the longer of the other two.
    const lists = card!.querySelector<HTMLElement>(".lists")!;
    const rows = (side: Element) => [...side.querySelectorAll<HTMLElement>(".row")].filter((item) => item.offsetParent !== null);
    for (const text of lists.querySelectorAll<HTMLElement>(".title")) {
      const cut = (text.textContent ?? "").replace(/\s*[(:（].*$/u, "");
      if (text.scrollWidth > text.clientWidth && cut.length > 8) text.textContent = cut;
    }
    const sides = () => [...lists.querySelectorAll<HTMLElement>(".side")].filter((side) => rows(side).length);
    const need = () => sides().reduce((sum, side) => sum + side.getBoundingClientRect().height, 0) + 14 * (sides().length - 1) + 18;
    for (let guard = 0; guard < 8 && need() > lists.clientHeight + 1; guard += 1) {
      const siblings = sides().find((side) => side.querySelector(".head")?.textContent === "Siblings");
      const from = siblings && rows(siblings).length > 1 ? siblings : sides().filter((side) => side !== siblings).sort((a, b) => rows(b).length - rows(a).length)[0];
      const left = from ? rows(from) : [];
      if (left.length <= 1) break;
      left[left.length - 1].style.display = "none";
    }
    // Its own layer on the scale: the number in ink, at its row; a number that would sit against it gives way.
    const ticks = [...graph.querySelectorAll<HTMLElement>(".tick")], mark = graph.querySelector(".node.focus");
    if (ticks.length && mark) {
      const box = graph.getBoundingClientRect(), at = mark.getBoundingClientRect(), y = (at.top + at.height / 2 - box.top) / scale;
      const own = ticks.find((item) => item.textContent === String(lens.layer)) ?? (graph.appendChild(ticks.find((item) => !item.classList.contains("edge"))?.cloneNode(false) ?? ticks[0].cloneNode(false)) as HTMLElement);
      own.textContent = String(lens.layer);
      own.style.top = `${y}px`;
      own.style.color = "var(--ink)";
      own.style.fontWeight = "600";
      for (const item of ticks) if (item !== own && Math.abs(parseFloat(item.style.top) - y) < 15) item.style.visibility = "hidden";
    }
    await frame();
    const links = graph.querySelector<HTMLCanvasElement>("canvas.links");
    if (links && links.width && fx) {
      const ratio = window.devicePixelRatio || 1, at = links.getBoundingClientRect();
      fx.width = 1200 * ratio;
      fx.height = 630 * ratio;
      const ctx = fx.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.globalCompositeOperation = "lighter";
      for (const [blur, alpha] of [[10, 0.5], [4, 0.45]]) {
        ctx.filter = `blur(${blur}px) saturate(1.3)`;
        ctx.globalAlpha = alpha;
        ctx.drawImage(links, at.left, at.top, at.width, at.height);
      }
    }
  }

  $effect(() => { const timer = setTimeout(() => { if (!drawn) lost = true; }, 6500); return () => clearTimeout(timer); });

  let begun = false;
  $effect(() => {
    if (!loaded || begun) return;
    begun = true;
    if (circuit) {
      void (async () => {
        await tick();
        await wire();
        await frame();
        drawn = true;
      })().catch(() => (lost = true));
      return;
    }
    void (async () => {
      await tick();
      await fit();
      const { plot, mark } = await placed();
      squash = HEIGHT / plot.offsetHeight;
      await tick();
      await frame();
      light(mark);
      await frame();
      drawn = true;
    })().catch(() => (lost = true));
  });
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

{#snippet top()}
  <header class="top">
    <span class="term">
      <span class="alpha">{lens.model.name}</span>
      <span>L{lens.layer}<i>·</i>{head ? "h" : "n"}{lens.selected}</span>
      {#if !head && pole}<span class="sign">{lens.side ? "−" : "+"}</span>{/if}
    </span>
    <span class="wordmark">{SITE_NAME}</span>
  </header>
{/snippet}

{#if circuit}
<div class="card circuit" data-card={status} class:lost={status === "failed"} style:--tint={lens.tint} style:--k={scale} style:--drop="{drop}px" bind:this={card}>
  {@render top()}
  <h1 class="name" class:lent={!!lens.model.labelsFrom && !silent}>{loaded ? title : ""}</h1>
  <Connections />
  <canvas class="fx" bind:this={fx} aria-hidden="true"></canvas>
</div>
{:else}
<div class="card" data-card={status} class:lost={status === "failed"} style:--tint={lens.tint} bind:this={card}>
  {@render top()}

  <section class="unit" aria-label={lens.selected === null ? undefined : head ? headId(lens.layer, lens.selected) : neuronId(lens.layer, lens.selected)}>
    {#if loaded}
      {#if title}<h1 class="label" class:long class:lent={!!lens.model.labelsFrom && !silent} bind:this={label}>{shown}</h1>{/if}
      <div class="reads" class:big={!title} bind:this={reads}>
        {#if role}
          <span class="read"><span class="cap">Role</span><span class="group"><span class="tok marked">{role}</span></span></span>
        {/if}
        {#if ins.length}
          <span class="read">
            <span class="cap">{silent ? "Its weights read" : "Fires on"}</span>
            <span class="group">{#each ins.slice(0, most.ins) as token, i (i)}<span class="tok" class:marked={i === 0}>{token.trim() || "␣"}</span>{/each}</span>
          </span>
        {/if}
        {#if (ins.length || role) && outs.length}<span class="arrow">→</span>{/if}
        {#if outs.length}
          <span class="read">
            <span class="cap">{head ? "Writes" : "Makes the model say"}</span>
            <span class="group">{#each outs.slice(0, most.outs) as token, i (i)}<span class="tok" class:marked={i === 0}>{token.trim() || "␣"}</span>{/each}</span>
          </span>
        {/if}
      </div>
    {/if}
  </section>

  <footer class="where">
    <div class="strip" bind:this={strip} style:--squash={squash}><Atlas /></div>
    <div class="nums">{#each numbers as L (L)}<span class:on={L === lens.layer} style:left={at(L + 0.5)}>{L}</span>{/each}</div>
    <div class="bands">{#each lens.model.bands as band (band.key)}<span class:on={band === lens.band} style:left={at((band.first + band.last + 1) / 2)}>{band.short}</span>{/each}</div>
  </footer>
  <canvas class="fx" bind:this={fx} aria-hidden="true"></canvas>
</div>
{/if}

<style>
  /* The card's type is Ledger's card.css, as scripts/site/card.html has it, set here over the site's own tokens. */
  .card { position: fixed; left: 0; top: 0; z-index: 100; display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 46px 64px; overflow: hidden; background: var(--paper); color: var(--ink); font-family: var(--text); }
  .top { display: flex; align-items: center; justify-content: space-between; height: 52px; }
  .wordmark { font: 600 30px/1 var(--display); letter-spacing: -0.035em; }
  .term { display: inline-flex; align-items: center; gap: 12px; height: 52px; padding: 0 20px 0 7px; border-radius: 999px; background: var(--wash); font: 500 24px/1 var(--text); font-variant-numeric: tabular-nums; }
  .term i { font-style: normal; color: var(--ink3); }
  .alpha { display: grid; place-items: center; height: 38px; padding: 0 14px; border-radius: 999px; background: var(--wash2); font-weight: 600; }
  .sign { display: grid; place-items: center; width: 36px; height: 36px; margin: 0 -10px 0 2px; border-radius: 50%; font: 600 24px/1 var(--display); background: color-mix(in oklch, var(--tint) 46%, transparent); }

  .unit { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: space-evenly; align-items: flex-start; }
  .label { margin: 0; text-box: trim-both cap alphabetic; font: 600 56px/64px var(--display); letter-spacing: -0.032em; text-wrap: balance; }
  .label.long { font-size: 46px; line-height: 54px; }
  /* Written for the post-trained model and lent to this one: italic, which only the text face has. */
  .label.lent { font-family: var(--text); font-style: italic; }
  .reads { display: flex; align-items: flex-end; max-width: 100%; white-space: nowrap; }
  .read { display: grid; gap: 9px; min-width: 0; }
  .group { display: flex; gap: 10px; }
  .cap { font: 500 20px/22px var(--text); color: var(--ink3); }
  .tok { padding: 2px 13px; border-radius: 9px; background: var(--wash2); font: 400 25px/38px var(--text); }
  .tok.marked { background: color-mix(in oklch, var(--tint) 44%, transparent); }
  .arrow { margin: 0 22px; font: 400 26px/42px var(--text); color: var(--ink3); }
  .big .read { gap: 12px; }
  .big .group { gap: 14px; }
  .big .tok { padding: 2px 18px; border-radius: 12px; font-size: 36px; line-height: 54px; }
  .big .arrow { line-height: 58px; }

  /* The atlas as the explorer draws it, squashed into the strip, with the card's own numbers and bands beneath. */
  .strip { height: 104px; overflow: hidden; pointer-events: none; }
  .strip :global(.atlas) { display: block; }
  .strip :global(.atlas > :not(.plot)) { display: none; }
  .strip :global(.plot) { transform-origin: 0 0; transform: scaleY(var(--squash)); transition: none; }
  .strip :global(.arrive .stack i), .strip :global(.arrive .field) { animation: none !important; }
  .nums, .bands { position: relative; height: 22px; font: 500 17px/22px var(--text); color: var(--ink3); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nums { margin-top: 12px; }
  .bands { margin-top: 5px; }
  .nums span, .bands span { position: absolute; top: 0; transform: translateX(-50%); }
  .nums .on, .bands .on { color: var(--ink); font-weight: 600; }
  .fx { position: absolute; left: 0; top: 0; width: 1200px; height: 630px; color: var(--tint); mix-blend-mode: screen; pointer-events: none; }

  /* The circuit: the rail itself (graph/Connections.svelte), its figure in the left column and its lists under the
     unit's name in the right, at a card's sizes. Its tools and its mix are the explorer's and stay out. */
  .circuit { display: grid; grid-template-columns: 436px minmax(0, 1fr); grid-template-rows: 52px auto minmax(0, 1fr); column-gap: 44px; padding: 46px 64px 42px 44px; pointer-events: none; }
  .circuit .top { grid-column: 2; grid-row: 1; }
  .name { grid-column: 2; grid-row: 2; margin: 22px 0 0; font: 600 34px/42px var(--display); letter-spacing: -0.028em; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; text-wrap: balance; }
  .name.lent { font-family: var(--text); font-style: italic; }
  .circuit :global(*) { animation: none !important; transition: none !important; }
  .circuit :global(.rail) { display: contents; }
  .circuit :global(.rail > .figure) { grid-column: 1; grid-row: 1 / 4; position: relative; display: block; min-height: 0; }
  .circuit :global(.figure > .tools), .circuit :global(.figure > .mix) { display: none; }
  .circuit :global(.figure > .graph) { position: absolute; left: 0; top: var(--drop); width: 340px; transform-origin: 0 0; transform: scale(var(--k)); }
  .circuit :global(.figure > .key) { position: absolute; left: 24px; bottom: 0; flex-wrap: nowrap; gap: 16px; font: 500 15.5px/20px var(--text); color: var(--ink3); white-space: nowrap; }
  .circuit :global(.figure > .key li) { gap: 7px; }
  .circuit :global(.figure > .key .dot) { width: 10px; height: 10px; }
  .circuit :global(.figure > .key .line) { width: 20px; height: 2.5px; }
  .circuit :global(.rail > .lists) { grid-column: 2; grid-row: 3; display: flex; flex-direction: column; justify-content: flex-end; gap: 14px; min-height: 0; padding-top: 18px; }
  .circuit :global(.lists .side) { display: block; }
  .circuit :global(.lists .side:not(:has(.row))) { display: none; }
  .circuit :global(.lists .side .head) { margin: 0 0 4px; padding: 0; font: 500 18px/24px var(--text); color: var(--ink3); }
  .circuit :global(.lists .rows) { display: block; }
  .circuit :global(.lists .side .row) { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0 14px; height: 36px; padding: 0; border-radius: 0; background: none; }
  .circuit :global(.lists .side .row:nth-child(n + 4)), .circuit :global(.lists .side:nth-child(n + 3) .row:nth-child(n + 3)) { display: none; }
  .circuit :global(.lists .row .id) { grid-column: 1; grid-row: 1; gap: 10px; font: 500 20px/1 var(--text); color: var(--ink2); white-space: nowrap; }
  .circuit :global(.lists .row .swatch) { width: 14px; height: 8px; border-radius: 4px; }
  .circuit :global(.lists .row .title) { grid-column: 2; grid-row: 1; font: 400 21.5px/36px var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-wrap: nowrap; }
  .circuit :global(.lists .row .title *) { display: inline; white-space: nowrap; text-wrap: nowrap; }
  .circuit :global(.lists .row .value) { grid-column: 3; grid-row: 1; min-width: 96px; justify-content: flex-end; gap: 10px; font: 500 20px/1 var(--text); color: var(--ink2); }
  .circuit :global(.lists .row .meter) { width: 30px !important; height: 5px; border-radius: 3px; }
  /* A card that failed is blanked, so the photograph of it is too small to keep (unfurl.js keeps no card under 16 kB). */
  .lost { visibility: hidden; }
</style>

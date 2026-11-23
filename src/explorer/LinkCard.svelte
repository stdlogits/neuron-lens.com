<script lang="ts">
  import { tick } from "svelte";
  import Atlas from "./Atlas.svelte";
  import { Lens, provideLens } from "./lens.svelte";
  import { headId, neuronId, rolesOf } from "../lib/data";
  import { SITE_NAME } from "../lib/site";
  import { primaryTokens } from "./unit/evidence";

  // A unit as its link card, 1200 × 630 and nothing else on the page: its pill and the site's name, its label, what it
  // fires on and what it makes the model say, and the atlas with its layer lit and the unit pinned. scripts/site/unfurl.js
  // has a hosted browser open this page (a unit's address with ?card) and keeps the picture it takes, once the page
  // marks itself drawn (data-card="drawn"). A card is a dark surface, as Ledger's are, whatever the viewer's theme.
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
  const loaded = $derived(head ? lens.headDetail !== null : pole !== null && (row !== null || lens.failures.includes(lens.rowsKey)));
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

  /** The atlas has its units in and this one placed: one plot, past its arrival, with the unit's mark. */
  async function placed(): Promise<{ plot: HTMLElement; mark: Element }> {
    for (;;) {
      const plot = strip?.querySelector<HTMLElement>(".plot");
      const bars = plot?.querySelectorAll(".bars") ?? [];
      const mark = plot?.querySelector(".pin, .stack i.sel");
      if (plot && mark && bars.length === 1 && bars[0].matches(".settled:not(.arrive)")) return { plot, mark };
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

  let begun = false;
  $effect(() => {
    if (!loaded || begun) return;
    begun = true;
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
    })();
  });
</script>

<svelte:head><meta name="robots" content="noindex" /></svelte:head>

<div class="card" data-card={drawn ? "drawn" : "drawing"} style:--tint={lens.tint} bind:this={card}>
  <header class="top">
    <span class="term">
      <span class="alpha">{lens.model.name}</span>
      <span>L{lens.layer}<i>·</i>{head ? "h" : "n"}{lens.selected}</span>
      {#if !head && pole}<span class="sign">{lens.side ? "−" : "+"}</span>{/if}
    </span>
    <span class="wordmark">{SITE_NAME}</span>
  </header>

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
  .nums, .bands { position: relative; height: 22px; font: 500 17px/22px var(--text); color: var(--ink3); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nums { margin-top: 12px; }
  .bands { margin-top: 5px; }
  .nums span, .bands span { position: absolute; top: 0; transform: translateX(-50%); }
  .nums .on, .bands .on { color: var(--ink); font-weight: 600; }
  .fx { position: absolute; left: 0; top: 0; width: 1200px; height: 630px; color: var(--tint); mix-blend-mode: screen; pointer-events: none; }
</style>

<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import { Token } from "@stdlogits/ledger";
  import { headId, headline, loadHeadLayer, loadNeuron, neuronId, type LensToken } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { GROUPS, OWL } from "./specimens";

  // Two real units over five tokens, drawn in order of depth, each in its own depth's colour: an
  // illustration, since the neuron is Qwen3-8B's and the head Gemma 4 12B's. A stream rises from each
  // token. Low down the owl neuron is silent on four of them and fires on "owl", and what it writes
  // colours owl's stream from there up. Higher, the groups head at "both" looks back along ribbons as
  // wide as its attention (to "owl" and "hawk", the pair it groups) but never wider than a stream, each
  // shading from the stream it leaves into the head's colour, and what it writes colours both's stream.
  // Beneath, the two units under the explorer's column names: what each fires on and (the head) attends
  // to in the drawing, and what each writes, measured (the head) or read from its weights (the neuron).
  // Pointing at a part of either lights up its part of the drawing.
  const TOKENS = ["the", "owl", "and", "hawk", "both"];
  const FIRED = 1;
  const AT = 4;
  const LOOKED = [1, 3];
  // How the head at "both" shares its attention among the tokens before it: drawn, not measured.
  const LOOKS = [0.06, 0.42, 0.08, 0.44];

  const qwen = MODELS[OWL.model];
  const gemma = MODELS[GROUPS.model];
  const headTint = depthColor(gemma, GROUPS.layer);
  const neuronTint = depthColor(qwen, OWL.layer);

  let copies = $state<LensToken[]>([]);
  let writes = $state<LensToken[]>([]);
  function load() {
    loadHeadLayer(GROUPS.model, GROUPS.layer).then((heads) => {
      copies = headline(heads.find((h) => h.h === GROUPS.h)?.outRz ?? [], 5);
    }, () => undefined);
    loadNeuron(OWL.model, OWL.layer, OWL.n).then((detail) => {
      const side = detail?.poles.find((p) => p.pole === 1);
      writes = headline(side?.reads.find((r) => r.col === "write_R")?.tokens ?? [], 5);
    }, () => undefined);
  }

  // The drawing's geometry, in pixels of its own width.
  let width = $state(0);
  const g = $derived(layout(width));
  const round = (v: number) => Math.round(v * 10) / 10;

  function layout(width: number) {
    const wide = width >= 560;
    const gutter = wide ? 48 : 28;
    const col = Math.max(0, width - gutter) / TOKENS.length;
    const x = (i: number) => round(gutter + (i + 0.5) * col);
    const height = wide ? 288 : 224;
    const head = { x: x(AT), y: wide ? 72 : 56, w: wide ? 72 : 46, h: wide ? 40 : 28 };
    const neuron = { x: x(FIRED), y: height - (wide ? 52 : 40), w: wide ? 84 : 50, h: wide ? 32 : 24 };
    const from = neuron.y - (wide ? 48 : 36);
    const lane = wide ? 8 : 6;
    // The widest ribbon is as wide as a stream. They arrive stacked, farthest on top, and tuck under
    // the head's rounded end; each shades along the line from where it leaves to where it arrives.
    const widths = LOOKS.map((share) => Math.max(1.5, (share / Math.max(...LOOKS)) * lane));
    const end = head.x - head.w / 2 + head.h / 2;
    let top = head.y - widths.reduce((sum, w) => sum + w, 0) / 2;
    const ribbons = widths.map((w, i) => {
      const y = round(top + w / 2);
      top += w;
      return { i, d: ribbon(x(i), w, end, y, from), x1: x(i), y1: from, x2: round(end), y2: y };
    });
    return { wide, gutter, height, lane, bead: wide ? { w: 28, h: 16 } : { w: 18, h: 12 }, x, head, neuron, ribbons };
  }

  /** A ribbon w wide that leaves the lane at x upward from `from` and reaches (end, y) level: the band
   * between two quarter-ellipses about (end, from). */
  function ribbon(x: number, w: number, end: number, y: number, from: number) {
    const k = 0.5523;
    const [ao, bo, ai, bi] = [end - x + w / 2, from - y + w / 2, end - x - w / 2, from - y - w / 2];
    const p = (...v: number[]) => v.map(round).join(" ");
    return `M${p(end - ao, from)}C${p(end - ao, from - k * bo, end - k * ao, from - bo, end, from - bo)}`
      + `L${p(end, from - bi)}C${p(end - k * ai, from - bi, end - ai, from - k * bi, end - ai, from)}Z`;
  }

  // Pointing at a unit, or at one of its terms, quiets every part of the drawing but its own.
  type Focus = "head" | "qk" | "ov" | "neuron" | "reads" | "writes";
  // "fed" is owl's stream, which feeds the neuron. The silent neurons are parts of their streams.
  type Piece = "lane" | "fed" | "ribbon" | "head" | "copy" | "looked" | "at" | "neuron" | "write" | "fired";
  const SHOWS: Record<Focus, Piece[]> = {
    head: ["lane", "fed", "ribbon", "head", "copy", "looked", "at"],
    qk: ["lane", "fed", "ribbon", "head", "looked", "at"],
    ov: ["head", "copy", "looked", "at"],
    neuron: ["fed", "neuron", "write", "fired"],
    reads: ["fed", "neuron", "fired"],
    writes: ["neuron", "write"],
  };
  let focus = $state<Focus | null>(null);
  const quiet = (piece: Piece) => focus !== null && !SHOWS[focus].includes(piece);
  // A token chip is quiet when every part it plays is: "owl" is both fired on and looked at.
  function chipQuiet(i: number) {
    const parts: Piece[] = [...(LOOKED.includes(i) ? ["looked" as const] : []), ...(i === AT ? ["at" as const] : []), ...(i === FIRED ? ["fired" as const] : [])];
    return parts.length > 0 && parts.every(quiet);
  }

  const KINDS = [
    {
      kind: "head" as const,
      title: "Heads move information between tokens",
      tint: headTint,
      terms: [
        { focus: "qk" as const, term: "QK", says: "where it looks", mark: "ribbon" },
        { focus: "ov" as const, term: "OV", says: "what it copies from there", mark: "stream" },
      ],
    },
    {
      kind: "neuron" as const,
      title: "Neurons rework one token at a time",
      tint: neuronTint,
      terms: [
        { focus: "reads" as const, term: "Reads", says: "one direction: how hard it fires", mark: "dot" },
        { focus: "writes" as const, term: "Writes", says: "a fixed vector, times that", mark: "stream" },
      ],
    },
  ];
</script>

<Part id="units" title="Neurons and heads" onnear={load}>
  {#snippet caption()}
    <p>A language model reads text as tokens (words or pieces of words) and processes them by converting them to a stream of numbers that then go through a stack of layers: {qwen.layers} in {qwen.name} and {gemma.layers} in {gemma.name}. There are two kinds of processing units.</p>
    <p>An <b>attention head</b> moves information between tokens: it looks back at earlier ones and copies data forward.</p>
    <p>A <b>neuron</b> works on one token at a time: when the token's stream points a certain way, it fires and contributes its own direction.</p>
    <p>This is an illustration of both of them on five tokens. This is just an example: the neuron is from {qwen.name} and the head is from {gemma.name}.</p>
  {/snippet}
  <div class="spec">
    <figure
      class="layer"
      class:wide={g.wide}
      bind:clientWidth={width}
      style:--g="{g.gutter}px"
      style:--h="{g.height}px"
      style:--head={headTint}
      style:--neuron={neuronTint}
      aria-label="An illustration with two units from different models. The tokens the, owl, and, hawk, both. Low down a neuron fires on “owl” and writes into its stream; higher, a head at “both” looks back at “owl” and “hawk” and writes from there."
    >
      {#if width}
        <svg class="draw" width={width} height={g.height} aria-hidden="true">
          {#each TOKENS as _, i (i)}
            <rect class="lane" class:quiet={quiet(i === FIRED ? "fed" : "lane")} x={g.x(i) - g.lane / 2} y="0" width={g.lane} height={g.height} rx={g.lane / 2} style:--i={i} />
          {/each}
          <rect class="write" class:quiet={quiet("write")} x={g.neuron.x - g.lane / 2} y="0" width={g.lane} height={g.neuron.y} rx={g.lane / 2} />
          <rect class="copy" class:quiet={quiet("copy")} x={g.head.x - g.lane / 2} y="0" width={g.lane} height={g.head.y} rx={g.lane / 2} />
          {#each TOKENS as _, i (i)}
            {#if i !== FIRED}<rect class="bead" class:quiet={quiet("lane")} x={g.x(i) - g.bead.w / 2} y={g.neuron.y - g.bead.h / 2} width={g.bead.w} height={g.bead.h} rx={g.bead.h / 2} />{/if}
          {/each}
          <defs>
            {#each g.ribbons as ribbon (ribbon.i)}
              <linearGradient id="units-look-{ribbon.i}" gradientUnits="userSpaceOnUse" x1={ribbon.x1} y1={ribbon.y1} x2={ribbon.x2} y2={ribbon.y2}>
                <stop class="leaves" class:fired={ribbon.i === FIRED} class:quiet={quiet(ribbon.i === FIRED ? "write" : "lane")} offset="0" />
                <stop class="arrives" class:quiet={quiet("ribbon")} offset="1" />
              </linearGradient>
            {/each}
          </defs>
          {#each g.ribbons.toReversed() as ribbon, i (ribbon.i)}
            <path class="ribbon" d={ribbon.d} fill="url(#units-look-{ribbon.i})" style:--i={i} />
          {/each}
        </svg>
        <span class="depth" style:top="{g.head.y}px" data-tip="Layer {GROUPS.layer} of {gemma.name}">L{GROUPS.layer}</span>
        <span class="depth" style:top="{g.neuron.y}px" data-tip="Layer {OWL.layer} of {qwen.name}">L{OWL.layer}</span>
        <a
          class="node neuron"
          class:quiet={quiet("neuron")}
          href="/{OWL.model}/L{OWL.layer}/n{OWL.n}"
          tabindex="-1"
          style:left="{g.neuron.x}px"
          style:top="{g.neuron.y}px"
          style:width="{g.neuron.w}px"
          style:height="{g.neuron.h}px"
          data-tip-title={neuronId(OWL.layer, OWL.n)}
          data-tip="Fires on “owl”"
          onpointerenter={() => (focus = "neuron")}
          onpointerleave={() => (focus = null)}
        >neuron</a>
        <a
          class="node head"
          class:quiet={quiet("head")}
          href="/{GROUPS.model}/L{GROUPS.layer}/h{GROUPS.h}"
          tabindex="-1"
          style:left="{g.head.x}px"
          style:top="{g.head.y}px"
          style:width="{g.head.w}px"
          style:height="{g.head.h}px"
          data-tip-title={headId(GROUPS.layer, GROUPS.h)}
          data-tip="At “both”, looks back at the pair it groups"
          onpointerenter={() => (focus = "head")}
          onpointerleave={() => (focus = null)}
        >head</a>
      {/if}
      {#each TOKENS as token, i (i)}
        <span class="word" style:grid-column={i + 2}>
          <span
            class="chip"
            class:looked={LOOKED.includes(i)}
            class:at={i === AT}
            class:fired={i === FIRED}
            class:quiet={chipQuiet(i)}
          >{token}</span>
        </span>
      {/each}
    </figure>

    <div class="pair" data-link-scope>
      {#each KINDS as kind (kind.kind)}
        <div class="kind" style:--tint={kind.tint} role="group" aria-label={kind.kind === "head" ? "Heads" : "Neurons"} onpointerenter={() => (focus = kind.kind)} onpointerleave={() => (focus = null)}>
          <h3>{kind.title}</h3>
          <dl>
            {#each kind.terms as term (term.term)}
              <div class="term" role="presentation" onpointerenter={() => (focus = term.focus)} onpointerleave={() => (focus = kind.kind)}>
                <dt><i class="mark {term.mark}" aria-hidden="true"></i>{term.term}</dt>
                <dd>{term.says}</dd>
              </div>
            {/each}
          </dl>
          {#if kind.kind === "head"}
            <UnitLink model={GROUPS.model} layer={GROUPS.layer} head={GROUPS.h} />
            <p class="says"><span class="verb">Fires on</span><span class="toks"><Token token=" both" /></span></p>
            <p class="says"><span class="verb">Attends to</span><span class="toks"><Token token=" owl" /><Token token=" hawk" i={1} /></span></p>
            <p class="says"><span class="verb">Writes</span><span class="toks">{#each copies as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</span></p>
          {:else}
            <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
            <p class="says"><span class="verb">Fires on</span><span class="toks"><Token token=" owl" /></span></p>
            <p class="says"><span class="verb">Writes</span><span class="toks">{#each writes as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</span></p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s7); min-width: 0; }

  /* ---------- the drawing: a gutter for depth, then five streams over their tokens */
  .layer { position: relative; display: grid; grid-template-columns: var(--g) repeat(5, minmax(0, 1fr)); grid-template-rows: var(--h) auto; row-gap: var(--s2); margin: 0; }
  .draw { grid-column: 1 / -1; grid-row: 1; overflow: visible; }
  /* Each part's colour is --c. A ribbon starts in the colour its stream has there, lit or quiet (owl's
   * carries the neuron's write), so it rises out of the stream without a seam, and ends in the head's. */
  .lane, .bead, .leaves { --c: var(--wash2); }
  .write, .leaves.fired, .node.neuron { --c: var(--neuron); }
  .copy, .arrives, .node.head { --c: var(--head); }
  .draw rect { fill: var(--c); }
  stop { stop-color: var(--c); }
  .depth { position: absolute; left: 0; translate: 0 -50%; color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; cursor: help; }
  .node { position: absolute; display: grid; place-items: center; translate: -50% -50%; border-radius: var(--r-pill); color: var(--paper); font: var(--type-meta); }
  .wide .node { font: var(--type-control); }
  .node { background: var(--c); }
  .word { grid-row: 2; justify-self: center; min-width: 0; }
  .chip { display: inline-block; max-width: 100%; padding: 2px var(--s1); border-radius: var(--r-chip); background: var(--wash); font: var(--type-small); overflow-wrap: anywhere; }
  .wide .chip { padding: var(--s1) var(--s3); font: var(--type-label); }
  .chip.looked { background: color-mix(in oklch, var(--head) 9%, var(--paper)); }
  .chip.at { background: color-mix(in oklch, var(--head) 22%, var(--paper)); }
  .chip.fired { background: color-mix(in oklch, var(--neuron) 22%, var(--paper)); }

  /* A quiet part mixes its colour into the paper and stays solid, so nothing shows through it. In
   * oklab: oklch drops the hue of two near-greys (the dark washes), which then turns red. */
  .draw rect.quiet { fill: color-mix(in oklab, var(--c) 20%, var(--paper)); }
  stop.quiet { stop-color: color-mix(in oklab, var(--c) 20%, var(--paper)); }
  .node.quiet { background: color-mix(in oklab, var(--c) 20%, var(--paper)); }
  .chip.quiet { background: var(--wash); }
  .draw rect, .node, .chip { transition: fill var(--fast) var(--ease), background-color var(--fast) var(--ease); }
  stop { transition: stop-color var(--fast) var(--ease); }

  /* Arriving, once, from the tokens up: the streams grow, the neuron fires and writes, the head looks
   * back and copies. */
  :global(.rv-in) .lane { transform-box: fill-box; transform-origin: bottom; animation: grow var(--glide) var(--ease) backwards; animation-delay: calc(var(--i) * 16ms); }
  :global(.rv-in) .bead { animation: fade var(--in) var(--ease) 80ms backwards; }
  :global(.rv-in) .node.neuron { animation: swell var(--in) var(--ease) 120ms backwards; }
  :global(.rv-in) .write { transform-box: fill-box; transform-origin: bottom; animation: grow var(--glide) var(--ease) 160ms backwards; }
  :global(.rv-in) .ribbon { animation: fade var(--in) var(--ease) backwards; animation-delay: calc(200ms + var(--i) * 24ms); }
  :global(.rv-in) .node.head { animation: swell var(--in) var(--ease) 280ms backwards; }
  :global(.rv-in) .copy { transform-box: fill-box; transform-origin: bottom; animation: grow var(--glide) var(--ease) 320ms backwards; }
  @keyframes grow { from { transform: scaleY(0); } }
  @keyframes fade { from { opacity: 0; } }
  @keyframes swell { from { opacity: 0; scale: 0.6; } }
  @media (prefers-reduced-motion: reduce) { :global(.rv-in) :is(.lane, .bead, .node, .write, .ribbon, .copy) { animation: none; } }

  /* ---------- the two kinds of unit, each with its real specimen */
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s6) var(--s7); }
  .kind { display: grid; align-content: start; justify-items: start; gap: var(--s3); min-width: 0; }
  h3 { font: var(--type-label); }
  dl { display: grid; grid-template-columns: auto minmax(0, 1fr); width: 100%; margin-bottom: var(--s2); color: var(--ink2); font: var(--type-small); }
  .term { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; gap: var(--s3); padding: 2px 0; }
  dt { display: inline-flex; align-items: center; gap: var(--s2); color: var(--ink); font-weight: 500; }
  /* Each term's mark is its part of the drawing in miniature. */
  .mark { flex: none; display: block; width: 12px; height: 12px; }
  .mark.ribbon { height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--wash2), var(--tint)); }
  .mark.stream { width: 4px; margin: 0 4px; border-radius: 2px; background: var(--tint); }
  .mark.dot { width: 10px; height: 10px; margin: 1px; border-radius: 50%; background: var(--tint); }
  .says { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: baseline; gap: var(--s3); width: 100%; }
  .verb { color: var(--ink3); font: var(--type-meta); }
  @media (max-width: 760px) {
    .spec { gap: var(--s6); }
    .pair { grid-template-columns: minmax(0, 1fr); }
  }
</style>

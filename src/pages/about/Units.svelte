<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import Token from "../../ui/Token.svelte";
  import { headId, headline, loadHeadLayer, loadNeuron, neuronId, type LensToken } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { OWL, SHE } from "./specimens";

  // Two real units over five tokens, drawn in order of depth, each in its own depth's colour. A
  // stream rises from each token. At layer 8 the neuron is silent on four of them and fires on "owl",
  // and what it writes colours owl's stream from there up. At layer 20 the head at "and" looks back,
  // in ribbons as wide as its attention (mostly at "she"), and what it copies colours and's stream.
  // Beneath, the two units with what they copy and write; pointing at a part of either lights up its
  // part of the drawing.
  const TOKENS = ["she", "heard", "the", "owl", "and"];
  const FIRED = 3;
  const AT = 4;
  // How the head at "and" shares its attention among the tokens before it: drawn, not measured.
  const LOOKS = [0.6, 0.12, 0.08, 0.2];

  const qwen = MODELS["qwen3-8b"];
  const headTint = depthColor(qwen, SHE.layer);
  const neuronTint = depthColor(qwen, OWL.layer);

  let copies = $state<LensToken[]>([]);
  let writes = $state<LensToken[]>([]);
  function load() {
    loadHeadLayer(SHE.model, SHE.layer).then((heads) => {
      const head = heads.find((h) => h.h === SHE.h);
      copies = headline(head?.reads.find((r) => r.col === "ov_R")?.tokens ?? [], 5);
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
    const bundle = wide ? 24 : 16;
    // The ribbons arrive stacked, farthest on top, and tuck under the head's rounded end.
    const end = head.x - head.w / 2 + head.h / 2;
    let top = head.y - bundle / 2;
    const ribbons = LOOKS.map((share, i) => {
      const w = Math.max(1.5, share * bundle);
      const y = top + w / 2;
      top += w;
      return { main: i === 0, d: ribbon(x(i), w, end, y, from) };
    });
    return { wide, gutter, height, lane: wide ? 8 : 6, bead: wide ? { w: 28, h: 16 } : { w: 18, h: 12 }, x, head, neuron, ribbons };
  }

  /** A ribbon w wide that leaves the lane at x upward from `from` and reaches (end, y) level: the band
   * between two quarter-ellipses about (end, from), rooted in the lane by a half disc. */
  function ribbon(x: number, w: number, end: number, y: number, from: number) {
    const k = 0.5523;
    const [ao, bo, ai, bi] = [end - x + w / 2, from - y + w / 2, end - x - w / 2, from - y - w / 2];
    const p = (...v: number[]) => v.map(round).join(" ");
    return `M${p(end - ao, from)}C${p(end - ao, from - k * bo, end - k * ao, from - bo, end, from - bo)}`
      + `L${p(end, from - bi)}C${p(end - k * ai, from - bi, end - ai, from - k * bi, end - ai, from)}`
      + `A${p(w / 2, w / 2)} 0 0 1 ${p(end - ao, from)}Z`;
  }

  // Pointing at a unit, or at one of its terms, quiets every part of the drawing but its own.
  type Focus = "head" | "qk" | "ov" | "neuron" | "reads" | "writes";
  type Piece = "ribbon" | "main" | "head" | "copy" | "looked" | "at" | "neuron" | "bead" | "write" | "fired";
  const SHOWS: Record<Focus, Piece[]> = {
    head: ["ribbon", "main", "head", "copy", "looked", "at"],
    qk: ["ribbon", "main", "head", "looked", "at"],
    ov: ["main", "head", "copy", "looked", "at"],
    neuron: ["neuron", "bead", "write", "fired"],
    reads: ["neuron", "bead", "fired"],
    writes: ["neuron", "write"],
  };
  let focus = $state<Focus | null>(null);
  const quiet = (piece: Piece) => focus !== null && !SHOWS[focus].includes(piece);

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
    <p>Two units of {qwen.name} at work on five tokens.</p>
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
      aria-label="The tokens she, heard, the, owl, and. At layer 8 a neuron fires on “owl” and writes into its stream; at layer 20 a head at “and” looks back, mostly at “she”, and copies from there."
    >
      {#if width}
        <svg class="draw" width={width} height={g.height} aria-hidden="true">
          {#each TOKENS as _, i (i)}
            <rect class="lane" x={g.x(i) - g.lane / 2} y="0" width={g.lane} height={g.height} rx={g.lane / 2} style:--i={i} />
          {/each}
          <rect class="write" class:quiet={quiet("write")} x={g.neuron.x - g.lane / 2} y="0" width={g.lane} height={g.neuron.y} rx={g.lane / 2} />
          <rect class="copy" class:quiet={quiet("copy")} x={g.head.x - g.lane / 2} y="0" width={g.lane} height={g.head.y} rx={g.lane / 2} />
          {#each TOKENS as _, i (i)}
            {#if i !== FIRED}<rect class="bead" class:quiet={quiet("bead")} x={g.x(i) - g.bead.w / 2} y={g.neuron.y - g.bead.h / 2} width={g.bead.w} height={g.bead.h} rx={g.bead.h / 2} />{/if}
          {/each}
          {#each g.ribbons.toReversed() as ribbon, i (i)}
            <path class="ribbon" class:main={ribbon.main} class:quiet={quiet(ribbon.main ? "main" : "ribbon")} d={ribbon.d} style:--i={i} />
          {/each}
        </svg>
        <span class="depth" style:top="{g.head.y}px" data-tip="Layer {SHE.layer}">L{SHE.layer}</span>
        <span class="depth" style:top="{g.neuron.y}px" data-tip="Layer {OWL.layer}">L{OWL.layer}</span>
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
          href="/{SHE.model}/L{SHE.layer}/h{SHE.h}"
          tabindex="-1"
          style:left="{g.head.x}px"
          style:top="{g.head.y}px"
          style:width="{g.head.w}px"
          style:height="{g.head.h}px"
          data-tip-title={headId(SHE.layer, SHE.h)}
          data-tip="At “and”, looks back at “she” and copies her forward"
          onpointerenter={() => (focus = "head")}
          onpointerleave={() => (focus = null)}
        >head</a>
      {/if}
      {#each TOKENS as token, i (i)}
        <span class="word" style:grid-column={i + 2}>
          <span
            class="chip"
            class:looked={i === 0}
            class:at={i === AT}
            class:fired={i === FIRED}
            class:quiet={(i === 0 && quiet("looked")) || (i === AT && quiet("at")) || (i === FIRED && quiet("fired"))}
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
            <UnitLink model={SHE.model} layer={SHE.layer} head={SHE.h} />
            <p class="says"><span class="verb">copies</span><span class="toks">{#each copies as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</span></p>
            <p class="says"><span class="verb">pushes against</span><span class="toks"><Token token=" he" /><Token token=" himself" i={1} /></span></p>
          {:else}
            <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
            <p class="says"><span class="verb">+ fires on</span><span class="toks"><Token token=" owl" /></span></p>
            <p class="says"><span class="verb">writes</span><span class="toks">{#each writes as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</span></p>
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
  .lane { fill: var(--wash2); }
  .bead { fill: var(--wash2); }
  .write { fill: var(--neuron); }
  .copy { fill: var(--head); }
  .ribbon { fill: color-mix(in oklch, var(--head) 36%, var(--paper)); }
  .ribbon.main { fill: var(--head); }
  .depth { position: absolute; left: 0; translate: 0 -50%; color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; cursor: help; }
  .node { position: absolute; display: grid; place-items: center; translate: -50% -50%; border-radius: var(--r-pill); color: var(--paper); font: var(--type-meta); }
  .wide .node { font: var(--type-control); }
  .node.head { background: var(--head); }
  .node.neuron { background: var(--neuron); }
  .word { grid-row: 2; justify-self: center; min-width: 0; }
  .chip { display: inline-block; max-width: 100%; padding: 2px var(--s1); border-radius: var(--r-chip); background: var(--wash); font: var(--type-small); overflow-wrap: anywhere; }
  .wide .chip { padding: var(--s1) var(--s3); font: var(--type-label); }
  .chip.looked { background: color-mix(in oklch, var(--head) 9%, var(--paper)); }
  .chip.at { background: color-mix(in oklch, var(--head) 22%, var(--paper)); }
  .chip.fired { background: color-mix(in oklch, var(--neuron) 22%, var(--paper)); }

  .ribbon, .write, .copy, .bead, .node, .chip { transition: opacity var(--fast) var(--ease), background-color var(--fast) var(--ease); }
  .quiet { opacity: 0.2; }
  .chip.quiet { opacity: 1; background: var(--wash); }

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
  .mark.ribbon { height: 6px; border-radius: 3px 3px 0 0; background: var(--tint); }
  .mark.stream { width: 4px; margin: 0 4px; border-radius: 2px; background: var(--tint); }
  .mark.dot { width: 10px; height: 10px; margin: 1px; border-radius: 50%; background: var(--tint); }
  .says { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: baseline; gap: var(--s3); width: 100%; }
  .verb { color: var(--ink3); font: var(--type-meta); }
  @media (max-width: 760px) {
    .spec { gap: var(--s6); }
    .pair { grid-template-columns: minmax(0, 1fr); }
  }
</style>

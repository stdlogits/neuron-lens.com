<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import Token from "../../ui/Token.svelte";
  import { headline, loadHeadLayer, loadNeuron, type LensToken } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { OWL, SHE } from "./specimens";

  // One layer over five tokens, drawn: a stream rises from each token; in the heads' band a head at
  // "and" looks back (mostly at "she") and copies from there; in the neurons' band one neuron at "owl"
  // fires and writes. Beneath, the two real units it stands for, with what they copy and write.
  const TOKENS = ["she", "heard", "the", "owl", "and"];
  const LOOKED = 0;
  const FIRED = 3;

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
  const qwen = MODELS["qwen3-8b"];
  // Pointing at either unit below quiets the other one's part of the drawing.
  let focus = $state<"head" | "neuron" | null>(null);
</script>

<Part id="units" title="Neurons and heads" onnear={load} tint={depthColor(qwen, OWL.layer)}>
  {#snippet caption()}
    <p>One layer of {qwen.name}, over five tokens.</p>
  {/snippet}
  <div class="spec">
    <figure class="layer" data-focus={focus} aria-label="One layer over the tokens she, heard, the, owl, and: a head at “and” copies from “she”; a neuron at “owl” fires.">
      <span class="band" style:grid-row="1"></span>
      <span class="band" style:grid-row="2"></span>
      <span class="name meta" style:grid-row="1">Neurons</span>
      <span class="name meta" style:grid-row="2">Heads</span>
      {#each TOKENS as _, i (i)}<span class="stream" style:grid-column={i + 1}></span>{/each}
      {#each TOKENS as _, i (i)}
        <span class="slot" style:grid-column={i + 1}>
          <i class="dot" class:on={i === FIRED}>{#if i === FIRED}+{/if}</i>
          {#if i === FIRED}<span class="note meta">fires</span>{/if}
        </span>
      {/each}
      <svg class="arcs" viewBox="0 0 500 100" preserveAspectRatio="none" aria-hidden="true">
        {#each [0, 1, 2, 3] as i (i)}
          <path class:main={i === LOOKED} d="M{50 + 100 * i} 82 C {50 + 100 * i} {i === LOOKED ? 8 : 34}, 450 {i === LOOKED ? 8 : 34}, 450 52" vector-effect="non-scaling-stroke" />
        {/each}
      </svg>
      <span class="from" style:grid-column={LOOKED + 1}><i></i></span>
      <span class="head-at" style:grid-column={TOKENS.length}><b>head</b></span>
      {#each TOKENS as token, i (i)}
        <span class="word" style:grid-column={i + 1}><span class="chip" class:looked={i === LOOKED} class:fired={i === FIRED}>{token}</span></span>
      {/each}
    </figure>

    <div class="pair" data-link-scope>
      <div class="kind" role="group" aria-label="Heads" onpointerenter={() => (focus = "head")} onpointerleave={() => (focus = null)}>
        <h3>Heads move information between tokens</h3>
        <dl>
          <dt>QK</dt><dd>where it looks</dd>
          <dt>OV</dt><dd>what it copies from there</dd>
        </dl>
        <UnitLink model={SHE.model} layer={SHE.layer} head={SHE.h} />
        <p class="says"><span class="verb">copies</span><span class="toks">{#each copies as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</span></p>
        <p class="says"><span class="verb">pushes against</span><span class="toks"><Token token=" he" /><Token token=" himself" i={1} /></span></p>
      </div>
      <div class="kind" role="group" aria-label="Neurons" onpointerenter={() => (focus = "neuron")} onpointerleave={() => (focus = null)}>
        <h3>Neurons rework one token at a time</h3>
        <dl>
          <dt>Reads</dt><dd>one direction: how hard it fires</dd>
          <dt>Writes</dt><dd>a fixed vector, times that</dd>
        </dl>
        <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
        <p class="says"><span class="verb">+ fires on</span><span class="toks"><Token token=" owl" /></span></p>
        <p class="says"><span class="verb">writes</span><span class="toks">{#each writes as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</span></p>
      </div>
    </div>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s6); min-width: 0; }

  /* ---------- the drawing: five columns, two bands, a stream up each column */
  .layer { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-template-rows: 80px 112px auto; row-gap: var(--s2); margin: 0; }
  .band { grid-column: 1 / -1; border-radius: var(--r-box); background: var(--wash); }
  .name { grid-column: 1 / -1; align-self: start; justify-self: start; z-index: 1; padding: var(--s2) var(--s3); }
  .stream { grid-row: 1 / 4; justify-self: center; width: 4px; margin-bottom: 20px; border-radius: 2px; background: var(--wash2); }
  .slot { grid-row: 1; z-index: 1; display: grid; justify-items: center; align-content: center; gap: 2px; padding-top: var(--s3); }
  .dot { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--paper); color: var(--paper); font: 600 14px/1 var(--display); font-style: normal; }
  .dot.on { width: 32px; height: 32px; background: var(--tint); font-size: 16px; }
  .note { color: var(--ink); }
  .arcs { grid-row: 2; grid-column: 1 / -1; z-index: 1; width: 100%; height: 100%; overflow: visible; }
  .arcs path { fill: none; stroke: color-mix(in oklch, var(--tint) 40%, transparent); stroke-width: 1.5; stroke-linecap: round; }
  .arcs path.main { stroke: var(--tint); stroke-width: 3; }
  .from { grid-row: 2; z-index: 2; align-self: end; justify-self: center; margin-bottom: 10px; }
  .from i { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--tint); }
  .head-at { grid-row: 2; z-index: 2; align-self: end; justify-self: center; margin-bottom: var(--s4); }
  .head-at b { display: block; padding: 2px var(--s3); border-radius: var(--r-pill); background: var(--tint); color: var(--paper); font: var(--type-control); }
  .word { grid-row: 3; z-index: 1; justify-self: center; min-width: 0; }
  .chip { display: inline-block; max-width: 100%; padding: var(--s1) var(--s3); border-radius: var(--r-chip); background: var(--wash); font: var(--type-label); overflow-wrap: anywhere; }
  .chip.looked { background: color-mix(in oklch, var(--tint) 9%, var(--paper)); }
  .chip.fired { background: color-mix(in oklch, var(--tint) 22%, var(--paper)); }

  .slot, .arcs, .from, .head-at, .chip { transition: opacity var(--fast) var(--ease); }
  .layer[data-focus="head"] .slot, .layer[data-focus="head"] .chip:not(.looked) { opacity: 0.35; }
  .layer[data-focus="neuron"] :is(.arcs, .from, .head-at), .layer[data-focus="neuron"] .chip:not(.fired) { opacity: 0.35; }

  /* ---------- the two kinds of unit, each with its real specimen */
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s6) var(--s7); }
  .kind { display: grid; align-content: start; justify-items: start; gap: var(--s3); min-width: 0; }
  h3 { font: var(--type-label); }
  dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--s1) var(--s3); margin-bottom: var(--s2); color: var(--ink2); font: var(--type-small); }
  dt { color: var(--ink); font-weight: 500; }
  .says { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: baseline; gap: var(--s3); width: 100%; }
  .verb { color: var(--ink3); font: var(--type-meta); }
  @media (max-width: 760px) {
    .pair { grid-template-columns: minmax(0, 1fr); }
    .layer { grid-template-rows: 72px 96px auto; }
    .chip { padding: 2px var(--s1); font: var(--type-small); }
    .name { padding: var(--s1) var(--s2); }
  }
</style>

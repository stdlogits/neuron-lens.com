<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import { Icon, Token } from "@stdlogits/ledger";
  import { headline, loadNeuron, type NeuronColumn, type Pole } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { OWL } from "./specimens";

  // The lens family on the model's depth: a lens turns a direction inside the model into a ranking of
  // tokens, looking back to the input (K-lens, then the S-lens) or forward to the output (logit lens,
  // J-lens, then the R-lens). The R and S lenses are J and K under RelP's rules. Beneath, either lens
  // on either half of the owl neuron.
  const model = MODELS[OWL.model];
  const at = OWL.layer / (model.layers - 1);
  const LINKS = {
    logit: "https://www.lesswrong.com/posts/AcKRB8wDpdaN6v6ru/interpreting-gpt-the-logit-lens",
    J: "https://transformer-circuits.pub/2026/workspace/",
    R: "https://www.lesswrong.com/posts/nv8oedrnLXKRzNEL9/r-lens-making-j-lens-more-faithful-on-early-layers",
    K: "https://x.com/voooooogel/status/2084858861551526002",
    RelP: "https://arxiv.org/abs/2508.21258",
    lenses: "https://huggingface.co/stdlogits/rs-lenses",
  };
  const back = [
    { name: "K-lens", href: LINKS.K, tip: "Theia Vogel, 2026" },
    { name: "S-lens", tip: "The K-lens under RelP's rules, fitted for this catalog" },
  ];
  const forward = [
    { name: "logit lens", href: LINKS.logit, tip: "nostalgebraist, 2020" },
    { name: "J-lens", href: LINKS.J, tip: "Gurnee et al., 2026" },
    { name: "R-lens", href: LINKS.R, tip: "camilablank et al., 2026" },
  ];

  let pole = $state<Pole | null>(null);
  let failed = $state(false);
  const load = () => loadNeuron(OWL.model, OWL.layer, OWL.n).then((d) => { pole = d?.poles.find((p) => p.pole === 1) ?? null; failed = !pole; }, () => (failed = true));

  // Each half through each lens: the raw read, or its layer-contrastive twin when that is the one listed.
  const read = (cols: NeuronColumn[]) => headline(pole?.reads.find((r) => cols.includes(r.col as NeuronColumn) && !r.twin)?.tokens ?? [], 6);
  const grid = $derived(pole ? [
    { half: "What it reads", cells: [read(["read_S", "read_S_z"]), read(["read_R", "read_R_z"])] },
    { half: "What it writes", cells: [read(["write_S", "write_S_z"]), read(["write_R", "write_R_z"])] },
  ] : []);
</script>

<Part id="lenses" title="Lenses" onnear={load} tint={depthColor(model, OWL.layer)}>
  {#snippet caption()}
    <p>Reading a unit from its weights alone.</p>
  {/snippet}
  <div class="spec">
    <div class="fig" data-link-scope>
      <span class="corner meta">L8 of 36</span>
      <div class="track" style:--at={at}>
        <span class="end meta">Input</span>
        <span class="ramp" aria-hidden="true"><i class="here"></i></span>
        <span class="end meta">Output</span>
      </div>
      <span></span>
      <div class="way">
        <p class="family"><Icon name="left" size={14} />{#each back as lens, i (lens.name)}{#if i > 0}<span class="then" aria-hidden="true">→</span>{/if}{#if lens.href}<a class="prose-link" href={lens.href} rel="external noreferrer" data-tip={lens.tip}>{lens.name}</a>{:else}<b data-tip={lens.tip}>{lens.name}</b>{/if}{/each}</p>
        <p class="asks">which input tokens put it there</p>
      </div>
      <div class="way">
        <p class="family">{#each forward as lens, i (lens.name)}{#if i > 0}<span class="then" aria-hidden="true">→</span>{/if}<a class="prose-link" class:strong={lens.name === "R-lens"} href={lens.href} rel="external noreferrer" data-tip={lens.tip}>{lens.name}</a>{/each}<Icon name="right" size={14} /></p>
        <p class="asks">what it makes the model say</p>
      </div>
      {#if pole}
        {#each grid as row (row.half)}
          <p class="half">{row.half}</p>
          {#each row.cells as tokens, c (c)}
            <div class="toks cell"><span class="lens">{c === 0 ? "S-lens" : "R-lens"}</span>{#each tokens as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</div>
          {/each}
        {/each}
      {:else}
        <span></span><span class="ghost">{#if failed}<span class="meta">This specimen didn't load.</span>{/if}</span><span class="ghost"></span>
      {/if}
    </div>
    <div class="foot">
      <UnitLink model={OWL.model} layer={OWL.layer} neuron={OWL.n} />
      <p class="meta">R and S are J and K under <a class="prose-link" href={LINKS.RelP} rel="external noreferrer">RelP</a>'s rules; one estimator fits both. <a class="prose-link" href={LINKS.lenses} rel="external noreferrer">The lenses</a></p>
    </div>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s5); min-width: 0; }
  /* One grid: the depth track over both columns, the back and forward families over their columns,
     then either half of the neuron through either lens. */
  .fig { display: grid; grid-template-columns: 112px repeat(2, minmax(0, 1fr)); gap: var(--s4) var(--s5); align-items: start; }
  .corner { align-self: center; }
  .track { grid-column: 2 / -1; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--s3); }
  .ramp { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg in oklch, var(--deep), var(--late)); }
  .here { position: absolute; top: 50%; left: calc(var(--at) * 100%); width: 16px; height: 16px; border-radius: 50%; background: var(--ink); translate: -50% -50%; }
  .way { display: grid; align-content: start; gap: var(--s1); }
  .family { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s1) var(--s2); color: var(--ink2); font: var(--type-control); }
  .family b, .family .strong { color: var(--ink); font-weight: 600; }
  .family b { cursor: help; }
  .then { color: var(--ink3); }
  .asks { font: var(--type-label); }
  .half { padding-top: 2px; color: var(--ink3); font: var(--type-meta); }
  .lens { display: none; }
  .ghost { grid-column: span 1; height: 72px; border-radius: var(--r-box); background: var(--wash); }
  .foot { display: grid; justify-items: start; gap: var(--s2); }
  .foot p { max-width: 64ch; }
  @media (max-width: 760px) {
    .fig { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: var(--s4); }
    .corner { display: none; }
    .track { grid-column: 1 / -1; }
    .fig > span:empty:not(.ghost) { display: none; }
    .half { grid-column: 1 / -1; padding-top: var(--s2); color: var(--ink); font: var(--type-label); }
    .asks { font: var(--type-small); }
    .lens { display: block; width: 100%; color: var(--ink3); font: var(--type-meta); }
  }
</style>

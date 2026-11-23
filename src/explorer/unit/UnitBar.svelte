<script lang="ts">
  import { onDestroy } from "svelte";
  import { IconButton, MorphText, Switch, fadeIn } from "@stdlogits/ledger";
  import { useLens } from "../lens.svelte";
  import { formatCount, neuronId, rolesOf } from "../../lib/data";
  import { reading, setDistinctive } from "../../lib/reading.svelte";
  import { setTranslate, translation } from "../../lib/translate.svelte";
  import { bandRange } from "../../lib/models";
  import { flagsOf, neuronTags } from "./evidence";

  // The top of the unit: its ID over its depth and tags, then the tools: English, where it sits in
  // the list, previous and next, and a link to it. It stays in place while the unit below changes;
  // the ID morphs from one to the next.
  const lens = useLens();

  const noun = $derived(lens.unit === "heads" ? "head" : "neuron");
  const tags = $derived.by(() => {
    if (lens.unit === "heads") {
      const row = lens.selectedHeadRow;
      const roles = row ? rolesOf(row[9]).map((role) => ({ label: role.short, tip: role.describe })) : [];
      return lens.globalLayer ? [{ label: "Global attention", tip: "Sees the whole text; other layers see the last 1,024 tokens" }, ...roles] : roles;
    }
    // A base model's listed rows carry its post-trained model's flags (lib/data.ts): its tags, which are
    // measurements and not labels, come from its own detail.
    if (lens.model.labelsFrom) return lens.neuronDetail ? neuronTags(flagsOf(lens.neuronDetail)) : [];
    return lens.selectedNeuronRow ? neuronTags(lens.selectedNeuronRow[5]) : [];
  });
  // Across a pruning (neuron-lens findings §20): a pruned model's neuron names its parent, a parent's its child or
  // that it was cut. The match is shown as it stands, provisional or not (a9's call); the tip says how it is known.
  const lineage = $derived.by(() => {
    const place = lens.lineagePlace;
    if (!place) return null;
    const [child, parent] = place.role === "parent" ? [lens.model.name, place.model.name] : [place.model.name, lens.model.name];
    const pruned = `${child} was pruned from ${parent}.`;
    const sure = place.status === "identified";
    const id = place.neuron === null ? "" : neuronId(lens.layer, place.neuron);
    if (place.status === "cut") return { text: `Cut from ${place.model.name}`, tip: `${pruned} It didn't keep this neuron.` };
    if (place.status === "near-silent") {
      return place.role === "parent"
        ? { text: `From ${place.model.name}, near-silent`, tip: `${pruned} Its near-silent neurons match ${parent}'s as a group, not one by one.` }
        : { text: `Kept in ${place.model.name} or cut`, tip: `${pruned} It kept some of this layer's near-silent neurons and cut the rest; which ones isn't traced.` };
    }
    const how = sure ? "matched by their weights, and how the two fire or what they write agrees"
      : "matched by their weights alone; how the two fire and what they write don't confirm it yet";
    return place.role === "parent"
      ? { text: `${sure ? "From" : "Likely from"} ${place.model.name} `, id, href: place.href, go: [place.model.id, place.neuron] as const,
          tip: `${pruned} Its ${sure ? "" : "likeliest "}neuron there, ${how}.` }
      : { text: `${sure ? "Kept" : "Likely kept"} in ${place.model.name} as `, id, href: place.href, go: [place.model.id, place.neuron] as const,
          tip: `${pruned} This neuron's ${sure ? "" : "likeliest "}counterpart there, ${how}.` };
  });

  const prev = $derived(lens.stepTo(-1));
  const next = $derived(lens.stepTo(1));
  const where = $derived(lens.position >= 0 ? `${formatCount(lens.position + 1)} / ${formatCount(lens.order.length)}` : "");

  let copied = $state(false);
  let timer = 0;
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      clearTimeout(timer);
      timer = window.setTimeout(() => (copied = false), 1600);
    } catch { /* clipboard blocked: the address bar still has the link */ }
  }
  onDestroy(() => clearTimeout(timer));
</script>

<header class="bar">
  <div class="name">
    <h2 id="unit-title"><MorphText text={lens.selectedId ?? ""} /></h2>
    <p class="meta tags">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex --><span class="band" tabindex="0" data-tip={lens.band.summary} data-tip-title={bandRange(lens.band)}><MorphText text={lens.band.name} numbers={false} /></span>
      {#each tags as tag (tag.label)}<!-- svelte-ignore a11y_no_noninteractive_tabindex --><span class="tag" tabindex="0" data-tip={tag.tip} in:fadeIn><span class="dot" aria-hidden="true">·</span>{tag.label}</span>{/each}
      {#if lineage}<span class="tag lineage" data-tip={lineage.tip} in:fadeIn><span class="dot" aria-hidden="true">·</span>{lineage.text}{#if lineage.href && lineage.go}{@const [model, neuron] = lineage.go}<a href={lineage.href} onclick={() => neuron !== null && lens.carrySide(model, lens.layer, neuron)}>{lineage.id}</a>{/if}</span>{/if}
    </p>
  </div>
  <div class="tools">
    <Switch checked={reading.distinctive} onchange={setDistinctive} label="Distinctive" hint="Score each read against the layer's other units, so what they all share drops out" />
    <Switch checked={translation.on} onchange={setTranslate} label="English" hint="Show text in other languages in English" />
    <span class="gap" aria-hidden="true"></span>
    {#if where}<span class="meta where" data-tip="Its place in this list (j, k to step)"><span aria-hidden="true"><MorphText text={where} /></span><span class="sr-only">{lens.position + 1} of {lens.order.length}</span></span>{/if}
    <IconButton icon="up" label={`Previous ${noun}`} href={prev === null ? undefined : lens.unitHref(lens.unit, lens.layer, prev)} replace disabled={prev === null} />
    <IconButton icon="down" label={`Next ${noun}`} href={next === null ? undefined : lens.unitHref(lens.unit, lens.layer, next)} replace disabled={next === null} />
    <IconButton icon={copied ? "check" : "link"} label={copied ? "Link copied" : "Copy link"} onclick={copy} />
  </div>
</header>

<style>
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s4); min-width: 0; }
  .name { display: grid; gap: var(--s1); min-width: 0; }
  h2 { font: var(--type-heading); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .tags { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--s2); }
  .tag { display: inline-flex; gap: var(--s2); cursor: help; }
  .band, .where { cursor: help; }
  .dot { color: var(--ink3); }
  .lineage a { text-decoration: underline; text-decoration-color: var(--wash2); text-decoration-thickness: 2px; text-underline-offset: 4px; transition: color var(--fast) var(--ease), text-decoration-color var(--fast) var(--ease); }
  @media (hover: hover) { .lineage a:hover { color: var(--ink); text-decoration-color: var(--ink3); } }
  .tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }
  .gap { width: var(--s2); }
  .where { margin-right: var(--s1); }
</style>

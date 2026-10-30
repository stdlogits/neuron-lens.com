<script lang="ts">
  import { onDestroy } from "svelte";
  import MorphText from "../../ui/MorphText.svelte";
  import IconButton from "../../ui/IconButton.svelte";
  import Switch from "../../ui/Switch.svelte";
  import { useLens } from "../lens.svelte";
  import { describeRole, formatCount, rolesOf } from "../../lib/data";
  import { setTranslate, translation } from "../../lib/translate.svelte";
  import { fadeIn } from "../../lib/motion";
  import { neuronTags } from "./evidence";

  // The top of the unit: its ID over its depth and tags, then the tools: English, where it sits in
  // the list, previous and next, and a link to it. It stays in place while the unit below changes;
  // the ID morphs from one to the next.
  const lens = useLens();

  const noun = $derived(lens.unit === "heads" ? "head" : "neuron");
  const tags = $derived.by(() => {
    if (lens.unit === "heads") {
      const row = lens.selectedHeadRow;
      const roles = row ? rolesOf(row[9]).map((role) => ({ label: role.short, tip: describeRole(role, lens.model) })) : [];
      return lens.globalLayer ? [{ label: "Global attention", tip: "Attends over the whole text; the other layers look only at the last 1,024 tokens" }, ...roles] : roles;
    }
    return lens.selectedNeuronRow ? neuronTags(lens.selectedNeuronRow[5]) : [];
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
      <MorphText text={lens.band.name} numbers={false} />
      {#each tags as tag (tag.label)}<span class="tag" data-tip={tag.tip} in:fadeIn><span class="dot" aria-hidden="true">·</span>{tag.label}</span>{/each}
    </p>
  </div>
  <div class="tools">
    <Switch checked={translation.on} onchange={setTranslate} label="English" hint="Show text in other languages in English" />
    <span class="gap" aria-hidden="true"></span>
    {#if where}<span class="meta where"><span aria-hidden="true"><MorphText text={where} /></span><span class="sr-only">{lens.position + 1} of {lens.order.length}</span></span>{/if}
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
  .dot { color: var(--ink3); }
  .tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }
  .gap { width: var(--s2); }
  .where { margin-right: var(--s1); }
</style>

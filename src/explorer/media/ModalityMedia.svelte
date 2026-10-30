<script lang="ts">
  import Token from "../../ui/Token.svelte";
  import MediaTile from "./MediaTile.svelte";
  import OptTile from "./OptTile.svelte";
  import { loadIndex, loadMediaDoc, type MediaDoc, type PoleMedia } from "../../lib/data";
  import { sourceName } from "../../lib/media";
  import { MODALITY_NAMES, type Modality, type ModelId } from "../../lib/models";

  // What one side of a Gemma 4 neuron responds to in images or in sound (findings §14): the label it
  // fires on most, its top images or sounds (shown where their licence allows, linked otherwise), the
  // patch or frame optimised to drive it, and what it makes the model say after one.
  let { model, modality, media }: { model: ModelId; modality: Modality; media: PoleMedia } = $props();

  const names = $derived(MODALITY_NAMES[modality]);
  type Hosted = MediaDoc & { h: [number, number, number] };

  let docs = $state.raw<{ for: PoleMedia; list: (MediaDoc | null)[] } | null>(null);
  $effect(() => {
    const asked = media;
    const id = model;
    loadIndex(id)
      .then(({ docBlock }) => Promise.all(asked.top.map(([doc]) => loadMediaDoc(id, modality, doc, docBlock).catch(() => null))))
      .then((list) => { if (media === asked) docs = { for: asked, list }; }, () => { if (media === asked) docs = { for: asked, list: [] }; });
  });
  const list = $derived(docs?.for === media ? docs.list : null);

  // Those this site can show become tiles; the rest are named by label and collection, and linked.
  const shown = $derived((list ?? []).flatMap((doc, i) => (doc?.h ? [{ doc: doc as Hosted, value: media.top[i][1] }] : [])));
  const linked = $derived.by(() => {
    const sources = new Map<string, Map<string, { label: string; link: string; count: number }>>();
    for (const doc of list ?? []) {
      if (!doc || doc.h) continue;
      const label = doc.l[0] ?? "";
      if (!label) continue;
      let labels = sources.get(doc.s);
      if (!labels) sources.set(doc.s, (labels = new Map()));
      const group = labels.get(label);
      if (group) group.count += 1;
      else labels.set(label, { label, link: doc.u, count: 1 });
    }
    return [...sources.entries()].map(([source, labels]) => ({ source: sourceName(source), labels: [...labels.values()] }));
  });

  const auroc = $derived(media.auroc === null ? null : media.auroc.toFixed(2));
  const aurocTip = $derived(
    `How cleanly its firing picks out ${media.label} ${names.plural} from the rest, on ${names.plural} held out from choosing the label: 1 is perfect, 0.5 chance. `
    + (media.reliable
      ? `It holds against shuffled labels and on both halves of the ${names.plural}.`
      : `It doesn't hold against shuffled labels or across both halves of the ${names.plural}: a weak lead.`),
  );
  const writes = $derived(media.write.slice(0, 10));
  const joined = (count: number, i: number) => (i === 0 ? "" : i === count - 1 ? " and " : ", ");
</script>

<section class="modality" aria-label={names.title}>
  <div class="lead">
    <h3 class="head">{names.title}</h3>
    <span class="label" class:weak={!media.reliable}>{media.label}</span>
    {#if auroc !== null}<span class="meta" data-tip={aurocTip} data-tip-title={media.reliable ? undefined : "Not reliable"}>AUROC {auroc}</span>{/if}
  </div>

  <!-- Everything below the label waits for the documents, then arrives in one sequence. -->
  {#if list && (shown.length || media.opt)}
    <ol class="tiles" aria-label={`The ${names.plural} it fires on most`}>
      {#each shown as { doc, value }, i (doc.h.join(":"))}
        <li><MediaTile {model} {modality} {doc} {value} {i} /></li>
      {/each}
      {#if media.opt && (media.opt.png || media.opt.wave)}<li><OptTile {modality} opt={media.opt} i={shown.length} /></li>{/if}
    </ol>
  {/if}

  {#if linked.length}
    <p class="linked rise" style:--i={shown.length + 1}>
      {shown.length || media.opt ? "Also, by link:" : "By link:"}
      {#each linked as group, g (group.source)}{g ? "; " : ""}{#each group.labels as item, i (item.label)}{joined(group.labels.length, i)}{#if item.link}<a class="prose-link" href={item.link} target="_blank" rel="noopener noreferrer external">{item.label}</a>{:else}{item.label}{/if}{#if item.count > 1}<span class="count">{` ×${item.count}`}</span>{/if}{/each}{`, ${group.source}`}{/each}
    </p>
  {/if}

  {#if list && writes.length}
    <div class="group">
      <h3 class="head" data-tip={`What its push makes the model say after ${modality === "image" ? "an image" : "a sound"} (the R-lens fitted on ${names.plural}, read on its write).`}>After {modality === "image" ? "an image" : "a sound"}, it writes</h3>
      <div class="toks">{#each writes as [token, count, flags], i (`${token}:${i}`)}<Token {token} {count} {flags} {i} />{/each}</div>
    </div>
  {/if}
</section>

<style>
  .modality { container-type: inline-size; display: grid; gap: var(--s4); min-width: 0; }
  .lead { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s3); }
  .label { color: var(--ink); font: var(--type-lead); overflow-wrap: anywhere; }
  .label.weak { color: var(--ink3); }
  .meta { cursor: help; }
  .tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: var(--s3); margin: 0; padding: 0; list-style: none; }
  .tiles li { min-width: 0; }
  .linked { margin: 0; color: var(--ink3); font: var(--type-small); line-height: 24px; }
  .count { font-variant-numeric: tabular-nums; }
  .group { display: grid; gap: var(--s2); }
  .group .head { justify-self: start; cursor: help; }
  @container (max-width: 520px) { .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>

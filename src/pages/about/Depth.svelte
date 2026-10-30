<script lang="ts">
  import Part from "../Part.svelte";
  import Segmented from "../../ui/Segmented.svelte";
  import Tabs from "../../ui/Tabs.svelte";
  import Swap from "../../ui/Swap.svelte";
  import { glide } from "../../lib/motion";
  import { loadIndex, percent, type LayerMeta } from "../../lib/data";
  import { MODELS, MODEL_ORDER, bandOf, bandRange, depthColor, type ModelId } from "../../lib/models";

  // The depth ramp itself: one bar a layer, coloured by depth and as tall as the share of its neurons'
  // sides a weight-only read explains, grouped into the model's bands. Pointing at a layer (or
  // choosing a band below) slides the band's wash under it and says what reading there is like.
  // The bars are pointer shortcuts into the explorer; keyboards go by the band tabs and their link.
  let modelId = $state<ModelId>("qwen3-8b");
  const model = $derived(MODELS[modelId]);
  const models = MODEL_ORDER.map((id) => ({ value: id, label: MODELS[id].name }));

  const darkKey = (id: ModelId) => MODELS[id].bands.find((b) => b.dark)?.key ?? MODELS[id].bands[0].key;
  let chosen = $state<Record<ModelId, string>>({ "qwen3-8b": darkKey("qwen3-8b"), "gemma-4-12b": darkKey("gemma-4-12b") });
  const band = $derived(model.bands.find((b) => b.key === chosen[modelId]) ?? model.bands[0]);
  const choose = (key: string) => { chosen[modelId] = key; };

  let wanted = $state(false);
  let layers = $state<Partial<Record<ModelId, LayerMeta[]>>>({});
  let failed = $state(false);
  $effect(() => {
    const id = modelId;
    if (!wanted || layers[id]) return;
    loadIndex(id).then((index) => { layers[id] = index.layerMeta; }, () => { failed = true; });
  });

  // The dark band speaks through the model's caution: its first sentence leads, the rest follows.
  const caution = $derived.by(() => {
    const at = model.caution.indexOf(". ");
    return at < 0 ? [model.caution, ""] : [model.caution.slice(0, at + 1), model.caution.slice(at + 2)];
  });
  const tabs = $derived(model.bands.map((b) => ({ value: b.key, label: b.short, hint: `${b.name}, ${bandRange(b)}` })));
</script>

<Part id="depth" title="Depth" onnear={() => (wanted = true)}>
  {#snippet caption()}
    <p>What a neuron's weights give away changes with depth. Each bar is a layer, as tall as the share of its neurons a weight-only read explains.</p>
  {/snippet}
  <div class="spec">
    <Segmented options={models} value={modelId} onchange={(id) => (modelId = id)} label="Model" />
    <div class="figure">
      <Swap key={modelId}>
        {#if layers[modelId]}
          <div class="ramp" style:--n={model.layers} use:glide={".span.on"}>
            {#each model.bands as b (b.key)}<span class="span" class:on={b.key === band.key} style:grid-column="{b.first + 1} / {b.last + 2}"></span>{/each}
            {#each layers[modelId] ?? [] as meta (meta.layer)}
              {@const inBand = bandOf(model, meta.layer).key === band.key}
              {@const share = meta.stats?.legible ?? 0}
              <a
                class="col"
                class:in={inBand}
                href="/{modelId}/L{meta.layer}"
                tabindex="-1"
                style:grid-column={meta.layer + 1}
                style:--c={depthColor(model, meta.layer)}
                style:--h={share}
                style:--d="{meta.layer * 16}ms"
                aria-label="Layer {meta.layer}: {percent(share)} read from weights"
                data-tip-title="Layer {meta.layer}"
                data-tip="{percent(share)} of its neurons' sides pass a weight-only read"
                onpointerenter={() => choose(bandOf(model, meta.layer).key)}
              ><i></i></a>
            {/each}
          </div>
        {:else}
          <div class="ramp waiting">{#if failed}<p class="meta">The layers didn't load.</p>{/if}</div>
        {/if}
      </Swap>
      <p class="axis meta" aria-hidden="true"><span>Layer 0</span><span>{model.layers - 1}</span></p>
    </div>
    <Tabs options={tabs} value={band.key} onchange={choose} label="Depth" />
    <Swap key="{modelId}:{band.key}">
      <div class="band">
        <p class="name">{band.name}<span class="meta">{bandRange(band)}</span></p>
        <p class="lead">{band.dark ? caution[0] : band.summary}</p>
        <p class="reading">{band.dark ? caution[1] : band.reading}</p>
        <a class="prose-link open" href="/{modelId}/L{band.first}">Open layer {band.first}</a>
      </div>
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; justify-items: stretch; gap: var(--s5); min-width: 0; }
  .spec > :global(:first-child) { justify-self: start; }
  .figure { display: grid; gap: var(--s2); min-width: 0; }
  .ramp {
    --glide-bg: var(--wash);
    --glide-radius: var(--r-col);
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    height: 176px;
  }
  .waiting { border-radius: var(--r-box); background: var(--wash); place-items: center; }
  .span { grid-row: 1; pointer-events: none; }
  .col { grid-row: 1; display: flex; align-items: flex-end; justify-content: center; min-width: 0; padding: var(--s2) 0; border-radius: var(--r-col); }
  .col i {
    display: block;
    width: 62%;
    height: max(3px, calc(var(--h) * 100%));
    border-radius: 2px;
    background: var(--c);
    opacity: 0.4;
    transform-origin: bottom;
    transition: opacity var(--glide) var(--ease);
  }
  .col.in i { opacity: 1; }
  @media (hover: hover) { .col:hover i { opacity: 1; } }
  .col:focus-visible { outline-offset: -2px; }
  /* The bars grow in, 16 ms apart, as the ramp comes into view and whenever the model changes. */
  :global(.rv-in) .col i { animation: grow var(--glide) var(--ease) backwards; animation-delay: var(--d); }
  @keyframes grow { from { transform: scaleY(0); } }
  .axis { display: flex; justify-content: space-between; }
  .band { display: grid; justify-items: start; gap: var(--s2); max-width: 64ch; }
  .name { display: flex; align-items: baseline; gap: var(--s3); font: var(--type-label); }
  .lead { font: var(--type-lead); }
  .reading { color: var(--ink2); }
  .open { margin-top: var(--s2); font: var(--type-control); }
  @media (max-width: 600px) { .ramp { height: 128px; } .col i { width: 72%; } }
  @media (prefers-reduced-motion: reduce) { :global(.rv-in) .col i { animation: none; } }
</style>

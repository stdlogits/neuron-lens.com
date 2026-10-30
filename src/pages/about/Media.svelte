<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import Swap from "../../ui/Swap.svelte";
  import Token from "../../ui/Token.svelte";
  import Icon from "../../ui/Icon.svelte";
  import LabelText from "../../ui/LabelText.svelte";
  import { headline, loadIndex, loadMediaDoc, loadNeuron, mediaUrl, releaseMedia, type MediaDoc, type Pole } from "../../lib/data";
  import { MODELS, depthColor, type Modality } from "../../lib/models";
  import { playOnly, sourceName } from "../../lib/media";
  import { translation } from "../../lib/translate.svelte";
  import { APPLE } from "./specimens";

  // One neuron of Gemma 4 met three ways: the word Apple in text, apples in the images it fires on
  // most, and apples in the sounds. Images and sounds this site may show are drawn; the rest are
  // tiles that link to their collection.
  const model = MODELS[APPLE.model];
  interface Item { doc: number; info: MediaDoc; url: string | null }

  let pole = $state<Pole | null>(null);
  let images = $state<Item[]>([]);
  let sounds = $state<Item[]>([]);
  let failed = $state(false);

  // Every mediaUrl call holds its blob until released: each is noted here and let go on destroy.
  const held: [Modality, [number, number, number]][] = [];
  let gone = false;
  function hold(modality: Modality, where: [number, number, number]) {
    held.push([modality, where]);
    return mediaUrl(APPLE.model, modality, where);
  }

  async function load() {
    try {
      const [detail, index] = await Promise.all([loadNeuron(APPLE.model, APPLE.layer, APPLE.n), loadIndex(APPLE.model)]);
      const side = detail?.poles.find((p) => p.pole === 1) ?? null;
      if (!side) { failed = true; return; }
      const docs = (modality: Modality) => Promise.all((side.media?.[modality]?.top ?? []).map(async ([doc]): Promise<Item | null> => {
        const info = await loadMediaDoc(APPLE.model, modality, doc, index.docBlock).catch(() => null);
        return info ? { doc, info, url: null } : null;
      }));
      const [imageList, soundList] = await Promise.all([docs("image"), docs("audio")]);
      if (gone) return;
      pole = side;
      images = imageList.filter((item): item is Item => item !== null);
      sounds = soundList.filter((item): item is Item => item !== null && item.info.h !== undefined).slice(0, 3);
      // Shown images come out of their pack by range, one at a time as they arrive.
      for (const item of images) {
        if (!item.info.h) continue;
        void hold("image", item.info.h).then((url) => {
          const at = images.findIndex((i) => i.doc === item.doc);
          if (!gone && at >= 0) images[at] = { ...images[at], url };
        }, () => undefined);
      }
    } catch {
      failed = true;
    }
  }

  const image = $derived(pole?.media?.image ?? null);
  const label = (info: MediaDoc) => info.l[0] ?? sourceName(info.s);
  // Some transcripts are in capitals: set them in sentence case.
  const spoken = (info: MediaDoc) => {
    const text = translation.on && info.en ? info.en[0] : info.c;
    return text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text;
  };

  // One sound at a time. Each press takes a ticket; stopping or leaving voids it, so a clip whose
  // bytes arrive late never starts on its own.
  let playing = $state<number | null>(null);
  let stop: (() => void) | null = null;
  let ticket = 0;
  function halt() {
    ticket += 1;
    stop?.();
    stop = null;
    playing = null;
  }
  async function toggle(item: Item) {
    const again = playing === item.doc;
    halt();
    if (again || !item.info.h) return;
    const mine = ticket;
    playing = item.doc;
    try {
      const url = await hold("audio", item.info.h);
      if (mine !== ticket) return;
      stop = playOnly(url, () => { if (mine === ticket) { playing = null; stop = null; } });
    } catch {
      if (mine === ticket) playing = null;
    }
  }
  $effect(() => () => {
    gone = true;
    halt();
    for (const [modality, where] of held.splice(0)) releaseMedia(APPLE.model, modality, where);
  });
</script>

<Part id="media" title="Images and sound" onnear={load} tint={depthColor(model, APPLE.layer)}>
  {#snippet caption()}
    <p>{model.name} also reads 50,000 images and 47,000 sounds.</p>
  {/snippet}
  <div class="spec">
    <UnitLink model={APPLE.model} layer={APPLE.layer} neuron={APPLE.n} />
    <Swap key={pole !== null}>
      {#if pole}
        <div class="body">
          <p class="title"><span class="sign" aria-label="Plus side">+</span><LabelText text={pole.label.fires} interactive /></p>

          {#if image}
            <div class="block">
              <p class="line"><span class="head">In images</span>{#if image.reliable}<b>{image.label}</b>{#if image.auroc !== null}<span class="meta" data-tip="How well it tells this label's images from the rest, on images held out: 0.5 is chance, 1 perfect">AUROC {image.auroc.toFixed(2)}</span>{/if}{/if}</p>
              <ul class="tiles">
                {#each images as item, i (item.doc)}
                  <li class="rise" style:--i={i}>
                    {#if item.info.h}
                      <figure class="tile" data-tip-title={label(item.info)} data-tip={sourceName(item.info.s)}>
                        {#if item.url}<img src={item.url} alt={`${label(item.info)}, from ${sourceName(item.info.s)}`} />{/if}
                      </figure>
                    {:else}
                      <a class="tile linked" href={item.info.u} target="_blank" rel="external noreferrer" data-tip-title={label(item.info)} data-tip={`${sourceName(item.info.s)}: linked, not hosted`}>
                        <span class="name">{label(item.info)}</span>
                        <span class="from">{sourceName(item.info.s)}</span>
                      </a>
                    {/if}
                  </li>
                {/each}
              </ul>
              <p class="meta">Drawn ones are shown under their licences; the rest link out. <a class="prose-link" href="/credits">Credits</a></p>
            </div>
          {/if}

          {#if sounds.length}
            <div class="block">
              <p class="line"><span class="head">In sound</span></p>
              <ul class="sounds">
                {#each sounds as item, i (item.doc)}
                  <li class="sound rise" style:--i={i}>
                    <button type="button" class="play" aria-label={playing === item.doc ? "Stop" : `Play: ${spoken(item.info)}`} aria-pressed={playing === item.doc} onclick={() => toggle(item)}>
                      <Icon name={playing === item.doc ? "pause" : "play"} />
                    </button>
                    <span class="said">{spoken(item.info)}</span>
                    <span class="meta">{sourceName(item.info.s)}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if image?.write.length}
            <div class="block" data-link-scope>
              <p class="line"><span class="head">After an image, it makes the model say</span></p>
              <div class="toks">{#each headline(image.write, 8) as [token, count, flags], i (i)}<Token {token} {count} {flags} {i} />{/each}</div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="body">{#if failed}<p class="meta">This specimen didn't load.</p>{:else}<span class="ghost"></span>{/if}</div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s4); min-width: 0; }
  .body { display: grid; gap: var(--s6); min-width: 0; }
  .title { display: flex; gap: var(--s3); font: var(--type-lead); }
  .sign { flex: none; width: 24px; font: 600 20px/28px var(--display); text-align: center; }
  .block { display: grid; gap: var(--s3); min-width: 0; }
  .line { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s3); }
  .line b { font: var(--type-label); }
  .line .meta { cursor: help; }
  .tiles { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: var(--s2); }
  .tile { display: grid; aspect-ratio: 1; margin: 0; border-radius: var(--r-box); background: var(--wash); overflow: hidden; }
  .tile img { width: 100%; height: 100%; object-fit: cover; animation: arrive var(--in) var(--ease); }
  @keyframes arrive { from { opacity: 0; } }
  .linked { align-content: end; gap: 2px; padding: var(--s2); transition: background-color var(--fast) var(--ease); }
  .linked .name { color: var(--ink2); font: var(--type-meta); overflow-wrap: anywhere; }
  .linked .from { color: var(--ink3); font: var(--type-meta); font-weight: 400; }
  @media (hover: hover) { .linked:hover { background: var(--wash2); } }
  .sounds { display: grid; gap: var(--s2); }
  .sound { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: var(--s3); }
  .said { min-width: 0; color: var(--ink2); font: var(--type-small); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .play {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--r-pill);
    background: var(--wash);
    color: var(--ink2);
    cursor: pointer;
    transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease), scale var(--fast) var(--ease);
  }
  .play:active { scale: 0.94; }
  .play[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
  @media (hover: hover) { .play[aria-pressed="false"]:hover { background: var(--wash2); color: var(--ink); } }
  .ghost { height: 240px; border-radius: var(--r-row); background: var(--wash); }
  @media (max-width: 760px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  @media (prefers-reduced-motion: reduce) { .tile img { animation: none; } }
</style>

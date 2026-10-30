<script lang="ts">
  import Icon from "../../ui/Icon.svelte";
  import Swap from "../../ui/Swap.svelte";
  import { formatValue, mediaUrl, releaseMedia, type MediaDoc } from "../../lib/data";
  import { sourceName } from "../../lib/media";
  import type { Modality, ModelId } from "../../lib/models";
  import { languageName, translation } from "../../lib/translate.svelte";
  import { clipSeconds, play } from "./sound";

  // One image or sound a side fires on, as the model saw or heard it: a square of wash the picture
  // fades into, or a square holding its words (for speech) and a round play button. Below, its label
  // and collection.
  let { model, modality, doc, value, i = 0 }: { model: ModelId; modality: Modality; doc: MediaDoc & { h: [number, number, number] }; value: number; i?: number } = $props();

  let url = $state<string | null>(null);
  let loaded = $state(false);
  // Held while shown, so the page can let go of pictures and sounds nobody is looking at.
  $effect(() => {
    const where = doc.h;
    const [m, kind] = [model, modality];
    let live = true;
    url = null;
    loaded = false;
    mediaUrl(m, kind, where).then((u) => { if (live) url = u; }, () => undefined);
    return () => { live = false; releaseMedia(m, kind, where); };
  });

  const label = $derived(doc.l[0] ?? "");
  const source = $derived(sourceName(doc.s));
  // A caption, or the words spoken; translated ones follow the English switch.
  const english = $derived(translation.on && doc.en ? doc.en[0] : "");
  const words = $derived(english || doc.c);
  const wordsLang = $derived(english ? "en" : doc.en?.[1]);
  // The tip: its caption or words, else every label it carries.
  const tipBody = $derived(words || doc.l.join(", ") || source);
  const tipSub = $derived(`${source} · fires at ${formatValue(value)}${doc.en && !english ? ` · ${languageName(doc.en[1])}` : ""}`);

  // ---------- sound

  let playing = $state(false);
  /** Seconds of the clip, once playback has started; drives the fill. */
  let running = $state(0);
  let stop: (() => void) | null = null;
  function toggle() {
    if (!url) return;
    if (playing) { stop?.(); return; }
    playing = true;
    running = 0;
    stop = play(url, clipSeconds(url), (seconds) => (running = seconds), () => { playing = false; running = 0; stop = null; });
  }
  $effect(() => () => stop?.());
</script>

<figure class="tile rise" style:--i={i}>
  {#if modality === "image"}
    <span class="square" data-tip={tipBody} data-tip-title={label} data-tip-sub={tipSub}>
      {#if url}<img src={url} alt={[label, doc.c].filter(Boolean).join(": ")} class:loaded onload={() => (loaded = true)} />{/if}
    </span>
  {:else}
    <button
      type="button"
      class="square sound"
      aria-pressed={playing}
      aria-label={`${playing ? "Stop" : "Play"} ${label}, ${source}`}
      disabled={!url}
      data-tip={tipBody}
      data-tip-title={label}
      data-tip-sub={tipSub}
      onclick={toggle}
    >
      {#if words}<span class="words"><Swap key={words}><span class="clamp" class:en={english !== ""} lang={wordsLang}>{words}</span></Swap></span>{/if}
      <span class="controls">
        <span class="knob"><Icon name={playing ? "pause" : "play"} size={14} /></span>
        <span class="track" class:on={running > 0}><span class="fill" class:run={running > 0} style:--seconds={`${running}s`}></span></span>
      </span>
    </button>
  {/if}
  <figcaption><b>{label}</b><span>{source}</span></figcaption>
</figure>

<style>
  .tile { container-type: inline-size; display: grid; gap: var(--s2); min-width: 0; margin: 0; }
  .square { position: relative; display: block; width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: var(--r-box); background: var(--wash); }
  img { display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity var(--in) var(--ease); }
  img.loaded { opacity: 1; }

  .sound {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--s2);
    padding: var(--s3);
    border: 0;
    color: var(--ink);
    text-align: start;
    cursor: pointer;
    transition: background-color var(--fast) var(--ease), scale var(--fast) var(--ease);
  }
  .sound:active:not(:disabled) { scale: 0.97; }
  .sound:disabled { cursor: default; }
  @media (hover: hover) { .sound:not(:disabled):hover { background: var(--wash2); } }
  .words { flex: 1; min-height: 0; overflow: hidden; color: var(--ink2); font: var(--type-meta); font-weight: 400; }
  /* As many lines as fit above the button: the square's side less its padding and the button. */
  .clamp { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: anywhere; }
  @container (max-width: 95px) { .clamp { -webkit-line-clamp: 1; line-clamp: 1; } }
  @container (min-width: 112px) { .clamp { -webkit-line-clamp: 3; line-clamp: 3; } }
  @container (min-width: 128px) { .clamp { -webkit-line-clamp: 4; line-clamp: 4; } }
  .clamp.en { font-style: italic; }
  .controls { display: flex; align-items: center; gap: var(--s2); }
  .knob {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-pill);
    background: var(--paper);
    color: var(--ink);
    transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease);
  }
  .sound[aria-pressed="true"] .knob { background: var(--ink); color: var(--paper); }
  .sound:disabled .knob { color: var(--ink3); }
  .track { position: relative; flex: 1; height: 4px; overflow: hidden; border-radius: var(--r-pill); background: var(--wash2); opacity: 0; transition: opacity var(--fast) var(--ease); }
  .track.on { opacity: 1; }
  .fill { position: absolute; inset: 0; border-radius: inherit; background: var(--tint); transform: scaleX(0); transform-origin: left; }
  /* The clip's own time, so linear. */
  .fill.run { animation: progress var(--seconds) linear forwards; }
  @keyframes progress { to { transform: scaleX(1); } }

  figcaption { display: grid; min-width: 0; font: var(--type-meta); font-weight: 400; }
  figcaption b, figcaption span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  figcaption b { color: var(--ink); font-weight: 500; }
  figcaption span { color: var(--ink3); }
  @media (prefers-reduced-motion: reduce) { .fill.run { animation: none; transform: scaleX(1); opacity: 0.5; } }
</style>

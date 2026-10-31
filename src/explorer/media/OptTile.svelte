<script lang="ts">
  import { Icon, formatValue } from "@stdlogits/ledger";
  import type { Optimised } from "../../lib/data";
  import { MODALITY_NAMES, type Modality } from "../../lib/models";
  import { framePath, frameWav, play } from "./sound";

  // The patch or 40 ms frame optimised to drive the side (findings §14), as the model met it: the patch
  // in every slot of an image, the frame in every slot of a sound. Its caption says whether it still
  // works on images or sounds it wasn't optimised on.
  let { modality, opt, i = 0 }: { modality: Modality; opt: Optimised; i?: number } = $props();

  const names = $derived(MODALITY_NAMES[modality]);
  const holds = $derived(opt.gain !== null && opt.gain > 0);
  const signed = (v: number) => `${v >= 0 ? "+" : "−"}${formatValue(Math.abs(v))}`;
  const verdict = $derived(holds ? `${signed(opt.gain!)} on held-out ${names.plural}` : `Fails on held-out ${names.plural}`);
  const tip = $derived([
    modality === "image" ? "A patch optimised to drive this side, put in every slot of an image." : "A 40 ms sound optimised to drive this side, repeated for 2.56 s.",
    holds ? `On ${names.plural} it wasn't optimised on, it raises the side by ${formatValue(opt.gain!)}.` : `On ${names.plural} it wasn't optimised on, it doesn't raise the side.`,
    opt.lens !== null ? `The read it started from gives ${signed(opt.lens)}.` : "",
  ].filter(Boolean).join(" "));

  // ---------- the frame

  const path = $derived(opt.wave ? framePath(opt.wave) : "");
  let wav: { url: string; seconds: number } | null = null;
  let playing = $state(false);
  let running = $state(0);
  let stop: (() => void) | null = null;
  function toggle() {
    if (!opt.wave) return;
    if (playing) { stop?.(); return; }
    wav ??= frameWav(opt.wave);
    playing = true;
    running = 0;
    stop = play(wav.url, wav.seconds, (seconds) => (running = seconds), () => { playing = false; running = 0; stop = null; });
  }
  $effect(() => {
    void opt.wave;
    return () => { stop?.(); if (wav) URL.revokeObjectURL(wav.url); wav = null; };
  });
</script>

<figure class="tile rise" style:--i={i}>
  {#if opt.png}
    <span class="square patch" style:--png={`url("${opt.png}")`} role="img" aria-label="The patch optimised to drive this side, in every slot" data-tip={tip} data-tip-title="Optimised patch"></span>
  {:else if opt.wave}
    <button type="button" class="square sound" aria-pressed={playing} aria-label={`${playing ? "Stop" : "Play"} the sound optimised to drive this side`} data-tip={tip} data-tip-title="Optimised sound" onclick={toggle}>
      <svg class="wave" viewBox="0 0 160 40" preserveAspectRatio="none" aria-hidden="true"><path d={path} /></svg>
      <span class="controls">
        <span class="knob"><Icon name={playing ? "pause" : "play"} size={14} /></span>
        <span class="track" class:on={running > 0}><span class="fill" class:run={running > 0} style:--seconds={`${running}s`}></span></span>
      </span>
    </button>
  {/if}
  <figcaption><b>{opt.png ? "Optimised patch" : "Optimised sound"}</b><span>{verdict}</span></figcaption>
</figure>

<style>
  .tile { display: grid; gap: var(--s2); min-width: 0; margin: 0; }
  .square { position: relative; display: block; width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: var(--r-box); background: var(--wash); }
  .patch { background-image: var(--png); background-size: 25% 25%; image-rendering: pixelated; }

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
  .sound:active { scale: 0.97; }
  @media (hover: hover) { .sound:hover { background: var(--wash2); } }
  .wave { flex: 1; width: 100%; min-height: 0; }
  .wave path { fill: none; stroke: var(--ink3); stroke-width: 1.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
  .controls { display: flex; align-items: center; gap: var(--s2); }
  .knob { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-pill); background: var(--paper); color: var(--ink); transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease); }
  .sound[aria-pressed="true"] .knob { background: var(--ink); color: var(--paper); }
  .track { position: relative; flex: 1; height: 4px; overflow: hidden; border-radius: var(--r-pill); background: var(--wash2); opacity: 0; transition: opacity var(--fast) var(--ease); }
  .track.on { opacity: 1; }
  .fill { position: absolute; inset: 0; border-radius: inherit; background: var(--tint); transform: scaleX(0); transform-origin: left; }
  .fill.run { animation: progress var(--seconds) linear forwards; }
  @keyframes progress { to { transform: scaleX(1); } }

  figcaption { display: grid; min-width: 0; font: var(--type-meta); font-weight: 400; }
  figcaption b { overflow: hidden; color: var(--ink); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
  figcaption span { color: var(--ink3); }
  @media (prefers-reduced-motion: reduce) { .fill.run { animation: none; transform: scaleX(1); opacity: 0.5; } }
</style>

<script lang="ts">
  import { textMotion } from "../lib/textMotion";

  // Text that morphs letter by letter when it changes (Torph), for numbers and short swaps such as a
  // token turning into its English. The real text stays in the DOM; Torph only paints over it.
  let { text, numbers = true, duration = 200, identity }: {
    text: string | number;
    numbers?: boolean;
    duration?: number;
    identity?: string | number | null;
  } = $props();
</script>

<span class="morph-text" data-text={String(text)}><span class="morph-source">{text}</span><span class="morph-paint" aria-hidden="true" use:textMotion={{ text: String(text), numbers, duration, disabled: false, identity }}></span></span>

<style>
  .morph-text { position: relative; display: inline-block; vertical-align: baseline; min-width: 0; max-width: 100%; }
  .morph-source { min-width: 0; overflow-wrap: inherit; }
  .morph-paint { position: absolute; inset-inline-start: 0; top: 0; pointer-events: none; user-select: none; -webkit-user-select: none; visibility: hidden; max-width: 100%; overflow: clip; --torph-fade: 0.08em; }
  .morph-text:global([data-morph-active]) > .morph-source { color: transparent; }
  .morph-text:global([data-morph-active]) > .morph-paint { visibility: visible; }
  @media (prefers-reduced-motion: reduce), (forced-colors: active) {
    .morph-text:global([data-morph-active]) > .morph-source { color: inherit; }
    .morph-text:global([data-morph-active]) > .morph-paint { visibility: hidden; }
  }
</style>

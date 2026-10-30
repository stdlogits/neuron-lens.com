<script lang="ts">
  // A tiny tint bar for a share (0–1), such as a read's percentile among its layer. It fills from the
  // left when it first appears and slides when the value changes.
  let { value, label, width = 24 }: { value: number; label: string; width?: number } = $props();
</script>

<span class="meter" role="img" aria-label={label} data-tip={label} style:width="{width}px"><i style:transform="scaleX({Math.max(0, Math.min(1, value))})"></i></span>

<style>
  .meter { position: relative; display: inline-block; flex: none; height: 4px; border-radius: 2px; background: var(--wash2); overflow: hidden; cursor: help; }
  i { position: absolute; inset: 0; border-radius: 2px; background: var(--tint); transform-origin: left; transition: transform var(--glide) var(--ease); animation: fill var(--glide) var(--ease) backwards; }
  @keyframes fill { from { transform: scaleX(0); } }
  @media (prefers-reduced-motion: reduce) { i { animation: none; } }
</style>

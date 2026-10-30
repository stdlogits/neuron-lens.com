<script lang="ts" module>
  // The site's few icons: 24-unit strokes, round caps, drawn in the current colour.
  const PATHS = {
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z", "m20 20-3.5-3.5"],
    up: ["m6 15 6-6 6 6"],
    down: ["m6 9 6 6 6-6"],
    left: ["m15 6-6 6 6 6"],
    right: ["m9 6 6 6-6 6"],
    link: ["M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1", "M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"],
    check: ["m5 12.5 4.5 4.5L19 7.5"],
    close: ["M6 6l12 12", "M18 6 6 18"],
    external: ["M7 17 17 7", "M8 7h9v9"],
    sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M12 2.5v2", "M12 19.5v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2.5 12h2", "M19.5 12h2", "m4.9 19.1 1.4-1.4", "m17.7 6.3 1.4-1.4"],
    moon: ["M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"],
    play: ["M8 5.5v13l10.5-6.5Z"],
    pause: ["M8.5 5.5v13", "M15.5 5.5v13"],
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 16 }: { name: IconName; size?: number } = $props();
  const fill = $derived(name === "play");
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#each PATHS[name] as d (d)}<path {d} />{/each}
</svg>

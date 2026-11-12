<script module lang="ts">
  /** A unit tapped in the graph: what its tip would say, and where it leads. */
  export interface Picked { key: string; name: string; title: string; sub?: string; href: string; color: string }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { IconButton, LabelText, Swap, fadeOut, rise } from "@stdlogits/ledger";

  // A touch has no hover, so a tap on a unit in the graph opens this card, which says what its tip says,
  // rather than leaving at once. Its button goes there. A tap on the graph outside any unit, Escape or
  // its close button puts it away. The same frosted glass as the tip, low on the screen within a thumb's reach.
  let { picked, close, fixed = false }: {
    picked: Picked;
    close: () => void;
    /** Over the page (the rail's), rather than inside the full-screen graph. */
    fixed?: boolean;
  } = $props();

  let card = $state<HTMLElement>();
  onMount(() => {
    // A tap elsewhere: on another unit it opens that one's card instead; on anything else it puts this away.
    // In the full-screen graph a drag is no tap (its click is stopped before it gets here).
    const click = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || card?.contains(target) || target.closest(".graph .node")) return;
      close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("click", click);
    window.addEventListener("keydown", key, { capture: true });
    return () => {
      document.removeEventListener("click", click);
      window.removeEventListener("keydown", key, { capture: true });
    };
  });
</script>

<section class="card" class:fixed bind:this={card} aria-label={picked.name} in:rise out:fadeOut>
  <Swap key={picked.key}>
    <div class="body">
      <div class="head">
        <span class="name meta"><i class="swatch" style:background={picked.color}></i>{picked.name}</span>
        <IconButton icon="close" label="Close" onclick={close} />
      </div>
      {#if picked.title}<p class="title"><LabelText text={picked.title} /></p>{/if}
      {#if picked.sub}<p class="sub meta">{picked.sub}</p>{/if}
      <a class="go" href={picked.href}>Go to {picked.name}</a>
    </div>
  </Swap>
</section>

<style>
  .card {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(max(var(--s3), env(safe-area-inset-bottom)) + 28px);
    z-index: 2;
    width: min(420px, calc(100% - 2 * var(--s3)));
    margin-inline: auto;
    padding: var(--s3) var(--s3) var(--s3) var(--s4);
    border-radius: var(--r-box);
    background: color-mix(in oklch, var(--paper) 72%, transparent);
    -webkit-backdrop-filter: blur(20px) saturate(1.6);
    backdrop-filter: blur(20px) saturate(1.6);
    box-shadow: var(--float);
    color: var(--ink);
  }
  .card.fixed { position: fixed; bottom: max(var(--s3), env(safe-area-inset-bottom)); z-index: 15; }
  @media (prefers-reduced-transparency: reduce) { .card { background: var(--paper); } }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .card { background: var(--paper); } }
  .body { display: grid; gap: var(--s1); }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); }
  .name { display: inline-flex; align-items: center; gap: var(--s1); color: var(--ink2); font-variant-numeric: tabular-nums; }
  .swatch { width: 10px; height: 6px; border-radius: 2px; }
  .title { margin: 0; padding-right: var(--s3); font: var(--type-label); text-wrap: pretty; }
  .sub { margin: 0; padding-right: var(--s3); color: var(--ink2); font-weight: 400; }
  .go {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    height: 36px;
    margin-top: var(--s2);
    padding: 0 var(--s4);
    border-radius: var(--r-pill);
    background: var(--wash);
    color: var(--ink);
    font: var(--type-control);
    font-variant-numeric: tabular-nums;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--fast) var(--ease), scale var(--fast) var(--ease);
  }
  .go:active { scale: 0.97; }
  @media (hover: hover) { .go:hover { background: var(--wash2); } }
</style>

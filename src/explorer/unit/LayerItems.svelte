<script lang="ts" module>
  export interface ListItem {
    index: number;
    id: string;
    href: string;
    first: string;
    firstLow: boolean;
    second: string;
    secondLow: boolean;
    match: boolean;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import { LabelText, expand, glide, reducedMotion } from "@stdlogits/ledger";

  // One layer's units as a column of links, the chosen one on a wash that glides along the list.
  // About a dozen show; the rest open below in pages, with the opening motion. The chosen unit is
  // always listed, however far down it sits. Created once per list, so its items rise in sequence.
  let { items, selected, layer, first, page }: {
    items: ListItem[];
    selected: number | null;
    layer: number;
    /** How many show before the button. */
    first: number;
    /** How many each press opens (everything left, when Infinity). */
    page: number;
  } = $props();

  // Where each opened page ends, after the first. The button opens the next page; a unit chosen
  // just past the end (stepping with j) opens a few more. One chosen far down a long list (All mode,
  // from the atlas or a link) is listed on its own below the open pages instead of opening thousands.
  let ends = $state<number[]>([]);
  const position = $derived(selected === null ? -1 : items.findIndex((item) => item.index === selected));
  const shown = $derived(Math.min(items.length, Math.max(first, ends.at(-1) ?? 0)));
  $effect.pre(() => {
    if (position >= shown && position < shown + Math.min(page, 40)) ends = [...untrack(() => ends), Math.min(items.length, position + 4)];
  });
  const pinned = $derived(position >= shown ? items[position] : null);
  const left = $derived(items.length - shown - (pinned ? 1 : 0));
  const chunks = $derived([first, ...ends].map((end, c, all) => ({ start: c ? all[c - 1] : 0, end: Math.min(end, items.length) })).filter((chunk) => chunk.end > chunk.start));
  const more = () => (ends = [...ends, Math.min(items.length, shown + page)]);

  // On a phone the unit sits above the list: choosing one brings it back into view.
  function chose(event: MouseEvent) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!matchMedia("(max-width: 720px)").matches) return;
    requestAnimationFrame(() => document.getElementById("unit")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }));
  }
</script>

{#snippet row(item: ListItem, i: number)}
  <a class="item rise" style:--i={i} href={item.href} aria-current={item.index === selected ? "true" : undefined} onclick={chose}>
    <span class="id">{item.id}{#if item.match}<span class="match" aria-hidden="true"></span><span class="sr-only">, matches the search</span>{/if}</span>
    <span class="l1" class:low={item.firstLow}><LabelText text={item.first} /></span>
    {#if item.second}<span class="l2"><LabelText text={item.second} /></span>{/if}
  </a>
{/snippet}

<div class="list">
  <div class="items" use:glide>
    {#each chunks as chunk, c (chunk.start)}
      <div class="chunk" in:expand>
        {#each items.slice(chunk.start, chunk.end) as item, i (item.index)}{@render row(item, c === 0 ? i : 0)}{/each}
      </div>
    {/each}
    {#if pinned}
      <div class="chunk pinned">
        <span class="skip" aria-hidden="true">⋮</span>
        {#key pinned.index}{@render row(pinned, 0)}{/key}
      </div>
    {/if}
  </div>
  {#if left > 0}
    <button type="button" class="more" onclick={more}>{left.toLocaleString("en-US")} more in layer {layer}</button>
  {/if}
</div>

<style>
  .list { display: grid; gap: var(--s2); min-width: 0; }
  .items { --glide-bg: var(--wash2); --glide-radius: var(--r-box); display: grid; min-width: 0; }
  .chunk { display: grid; gap: 2px; min-width: 0; }
  .chunk + .chunk { padding-top: 2px; }
  .skip { padding: 0 var(--s4); color: var(--ink3); font: var(--type-small); line-height: 16px; }
  .item {
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: var(--s3) var(--s4);
    border-radius: var(--r-box);
    color: var(--ink);
    transition: background-color var(--fast) var(--ease);
  }
  .item:active { scale: 0.99; }
  @media (hover: hover) { .item:not([aria-current]):hover { background: var(--wash); } }
  .id { display: flex; align-items: center; gap: 6px; color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; transition: color var(--fast) var(--ease); }
  .item[aria-current] .id { color: var(--ink); }
  .match { width: 6px; height: 6px; border-radius: 50%; background: var(--tint); }
  .l1 {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font: var(--type-control);
    overflow-wrap: anywhere;
  }
  .l1.low { color: var(--ink3); }
  .l2 { overflow: hidden; color: var(--ink3); font: var(--type-small); white-space: nowrap; text-overflow: ellipsis; }
  /* A label's foreign terms wrap by default: on this one line they mustn't. */
  .l2 :global(.term) { white-space: nowrap; }
  .more {
    justify-self: start;
    height: 36px;
    padding: 0 var(--s4);
    border: 0;
    background: transparent;
    color: var(--ink2);
    font: var(--type-control);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: color var(--fast) var(--ease);
  }
  @media (hover: hover) { .more:hover { color: var(--ink); } }
  @media (forced-colors: active) { .item[aria-current] { outline: 2px solid Highlight; } }
</style>

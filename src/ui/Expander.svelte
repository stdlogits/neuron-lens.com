<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  // A text button that opens more beneath it: the body's height and opacity change together
  // (240 ms, grid rows 0fr → 1fr, so it can be reversed mid-way), and the chevron turns.
  let { label, openLabel, children, open = $bindable(false) }: {
    label: string;
    openLabel?: string;
    children: Snippet;
    open?: boolean;
  } = $props();
  const id = $props.id();
</script>

<div class="expander" class:open>
  <button type="button" class="toggle" aria-expanded={open} aria-controls={id} onclick={() => (open = !open)}>
    {open ? (openLabel ?? label) : label}<span class="chev"><Icon name="down" /></span>
  </button>
  <div class="body" {id} inert={!open}>
    <div class="inner">{@render children()}</div>
  </div>
</div>

<style>
  .expander { display: grid; min-width: 0; }
  .toggle {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: var(--s2);
    height: 36px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink2);
    font: var(--type-control);
    cursor: pointer;
    transition: color var(--fast) var(--ease);
  }
  @media (hover: hover) { .toggle:hover { color: var(--ink); } }
  .chev { display: grid; transition: rotate var(--glide) var(--ease); }
  .open .chev { rotate: 180deg; }
  .body { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows var(--glide) var(--ease), opacity var(--glide) var(--ease); }
  .open .body { grid-template-rows: 1fr; opacity: 1; }
  /* Positioned, so absolutely placed text inside (screen-reader copies) is clipped with the rest. */
  .inner { position: relative; min-height: 0; overflow: hidden; }
  .open .inner { overflow: visible; }
  .inner > :global(:first-child) { margin-top: var(--s4); }
</style>

<script lang="ts" generics="T extends string">
  import { glide } from "../lib/motion";

  // An exclusive choice between a few options: a pill of wash with an ink thumb that glides to the
  // chosen one (240 ms) while the labels trade colours.
  let { options, value, onchange, label, size = "md" }: {
    options: { value: T; label: string; hint?: string }[];
    value: T;
    onchange: (value: T) => void;
    label: string;
    size?: "md" | "lg";
  } = $props();
</script>

<div class="seg {size}" role="group" aria-label={label} use:glide>
  {#each options as option (option.value)}
    <button type="button" aria-pressed={option.value === value} data-tip={option.hint} onclick={() => onchange(option.value)}>{option.label}</button>
  {/each}
</div>

<style>
  .seg {
    --glide-bg: var(--ink);
    --glide-radius: var(--r-pill);
    display: inline-flex;
    padding: var(--s1);
    border-radius: var(--r-pill);
    background: var(--wash);
  }
  button {
    height: 32px;
    padding: 0 var(--s4);
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--ink2);
    font: var(--type-control);
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--glide) var(--ease), scale var(--fast) var(--ease);
  }
  .lg button { height: 36px; padding: 0 var(--s4); }
  button[aria-pressed="true"] { color: var(--paper); }
  button:active { scale: 0.97; }
  @media (hover: hover) {
    button[aria-pressed="false"]:hover { color: var(--ink); }
  }
  @media (forced-colors: active) {
    button[aria-pressed="true"] { outline: 2px solid Highlight; }
  }
</style>

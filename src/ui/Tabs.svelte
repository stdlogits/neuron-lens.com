<script lang="ts" generics="T extends string">
  // A quiet choice among many: text only, the chosen one in ink, the rest in the softest ink.
  let { options, value, onchange, label, scroll = false }: {
    options: { value: T; label: string; count?: string; hint?: string }[];
    value: T;
    onchange: (value: T) => void;
    label: string;
    /** On narrow screens, one row that scrolls sideways instead of wrapping. */
    scroll?: boolean;
  } = $props();
</script>

<div class="tabs" class:scroll role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button type="button" aria-pressed={option.value === value} data-tip={option.hint} onclick={() => onchange(option.value)}>{option.label}{#if option.count}<span class="count">{option.count}</span>{/if}</button>
  {/each}
</div>

<style>
  .tabs { display: flex; flex-wrap: wrap; gap: var(--s1) 20px; min-width: 0; }
  button {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    height: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink3);
    font: var(--type-control);
    line-height: 32px;
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--fast) var(--ease);
  }
  .count { font-variant-numeric: tabular-nums; }
  button[aria-pressed="true"] { color: var(--ink); }
  @media (hover: hover) { button:hover { color: var(--ink); } }
  @media (max-width: 720px) {
    .scroll { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent); padding-right: var(--s5); }
    .scroll::-webkit-scrollbar { display: none; }
  }
  @media (forced-colors: active) { button[aria-pressed="true"] { text-decoration: underline; } }
</style>

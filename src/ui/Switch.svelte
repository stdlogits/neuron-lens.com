<script lang="ts">
  // An on/off choice with its label: a small track whose knob slides across (240 ms) and fills in ink.
  let { checked, onchange, label, hint }: { checked: boolean; onchange: (on: boolean) => void; label: string; hint?: string } = $props();
</script>

<button type="button" class="switch" role="switch" aria-checked={checked} data-tip={hint} onclick={() => onchange(!checked)}>
  <span class="track" aria-hidden="true"></span>{label}
</button>

<style>
  .switch {
    display: inline-flex;
    align-items: center;
    gap: var(--s2);
    height: 36px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink2);
    font: var(--type-control);
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--fast) var(--ease);
  }
  .track {
    position: relative;
    width: 28px;
    height: 16px;
    border-radius: var(--r-pill);
    background: var(--wash2);
    transition: background-color var(--glide) var(--ease);
  }
  .track::after {
    content: "";
    position: absolute;
    left: 2px;
    top: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ink3);
    transition: transform var(--glide) var(--ease), background-color var(--glide) var(--ease);
  }
  .switch[aria-checked="true"] { color: var(--ink); }
  .switch[aria-checked="true"] .track { background: var(--ink); }
  .switch[aria-checked="true"] .track::after { transform: translateX(12px); background: var(--paper); }
  @media (hover: hover) { .switch:hover { color: var(--ink); } }
</style>

<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  // A round wash button holding one icon. With href it is a link (so it can be opened in a new tab).
  let { icon, label, onclick, href, replace = false, pressed, disabled = false }: {
    icon: IconName;
    label: string;
    onclick?: (event: MouseEvent) => void;
    href?: string;
    /** A link that replaces the history entry instead of adding one (stepping, for one). */
    replace?: boolean;
    pressed?: boolean;
    disabled?: boolean;
  } = $props();
</script>

{#if href}
  <a class="icon" {href} aria-label={label} data-tip={label} data-replace={replace || undefined} {onclick}><Icon name={icon} /></a>
{:else}
  <button type="button" class="icon" aria-label={label} data-tip={label} aria-pressed={pressed} {disabled} {onclick}><Icon name={icon} /></button>
{/if}

<style>
  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: var(--r-pill);
    background: var(--wash);
    color: var(--ink2);
    cursor: pointer;
    transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease), scale var(--fast) var(--ease);
  }
  .icon:active { scale: 0.94; }
  .icon:disabled { opacity: 0.4; cursor: default; }
  @media (hover: hover) { .icon:not(:disabled):hover { background: var(--wash2); color: var(--ink); } }
</style>

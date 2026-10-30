<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";
  import { fadeOut, swell } from "../lib/motion";

  // A round wash button holding one icon. With href it is a link (so it can be opened in a new tab).
  // A new icon (link turning to check) swells in over the old one.
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

{#snippet glyph()}
  <span class="glyphs">{#key icon}<span class="glyph" in:swell out:fadeOut><Icon name={icon} /></span>{/key}</span>
{/snippet}

{#if href}
  <a class="icon" {href} aria-label={label} data-tip={label} data-replace={replace || undefined} {onclick}>{@render glyph()}</a>
{:else}
  <button type="button" class="icon" aria-label={label} data-tip={label} aria-pressed={pressed} {disabled} {onclick}>{@render glyph()}</button>
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
  .glyphs { display: grid; }
  .glyph { grid-area: 1 / 1; display: grid; }
  .icon:disabled { opacity: 0.4; cursor: default; }
  @media (hover: hover) { .icon:not(:disabled):hover { background: var(--wash2); color: var(--ink); } }
</style>

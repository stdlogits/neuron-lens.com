<script lang="ts">
  import Icon from "./ui/Icon.svelte";
  import { nextTheme, setTheme, type Choice } from "./lib/theme.svelte";

  let { page }: { page: string } = $props();
  // The button shows, names and tips what it would pick next.
  const NEXT: Record<Choice, { icon: "sun" | "moon" | "auto"; label: string; tip: string }> = {
    light: { icon: "sun", label: "Use the light theme", tip: "Light" },
    dark: { icon: "moon", label: "Use the dark theme", tip: "Dark" },
    auto: { icon: "auto", label: "Follow the system's theme", tip: "Auto" },
  };
  const next = $derived(nextTheme());
</script>

<header>
  <a class="mark" href="/" aria-current={page === "explore" ? "page" : undefined}>Neuron Lens</a>
  <nav aria-label="Site">
    <a href="/about" aria-current={page === "about" ? "page" : undefined}>About</a>
    <a href="/credits" aria-current={page === "credits" ? "page" : undefined}>Credits</a>
    <button type="button" class="theme" onclick={() => setTheme(next)} aria-label={NEXT[next].label} data-tip={NEXT[next].tip}>
      {#each Object.values(NEXT) as option (option.icon)}<span class:on={option.icon === NEXT[next].icon}><Icon name={option.icon} /></span>{/each}
    </button>
  </nav>
</header>

<style>
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--s5); width: 100%; max-width: var(--page); margin: 0 auto; padding: var(--s5) var(--gutter); }
  .mark { color: var(--ink); font: 600 20px/28px var(--display); letter-spacing: -0.02em; white-space: nowrap; }
  nav { display: flex; align-items: center; gap: var(--s5); }
  nav a { display: inline-flex; align-items: center; gap: var(--s1); color: var(--ink3); font: var(--type-small); white-space: nowrap; transition: color var(--fast) var(--ease); }
  nav a[aria-current="page"] { color: var(--ink); }
  @media (hover: hover) { nav a:hover { color: var(--ink); } }
  .theme { position: relative; display: grid; place-items: center; width: 36px; height: 36px; margin-left: calc(var(--s2) * -1); padding: 0; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--ink3); cursor: pointer; transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease), scale var(--fast) var(--ease); }
  .theme:active { scale: 0.94; }
  @media (hover: hover) { .theme:hover { background: var(--wash); color: var(--ink); } }
  /* The icons trade places with a quarter turn. */
  .theme span { grid-area: 1 / 1; display: grid; opacity: 0; rotate: -90deg; scale: 0.6; transition: opacity var(--glide) var(--ease), rotate var(--glide) var(--ease), scale var(--glide) var(--ease); }
  .theme span.on { opacity: 1; rotate: 0deg; scale: 1; }
  @media (max-width: 520px) { nav { gap: var(--s4); } }
</style>

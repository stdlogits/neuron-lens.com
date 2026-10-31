<script lang="ts">
  import { ThemeButton } from "@stdlogits/ledger";
  import { theme } from "./lib/theme";

  let { page }: { page: string } = $props();
</script>

<header>
  <a class="mark" href="/" aria-current={page === "explore" ? "page" : undefined}>Neuron Lens</a>
  <nav aria-label="Site">
    <a href="/about" aria-current={page === "about" ? "page" : undefined}>About</a>
    <a href="/credits" aria-current={page === "credits" ? "page" : undefined}>Credits</a>
    <ThemeButton {theme} />
  </nav>
</header>

<style>
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--s5); width: 100%; max-width: var(--page); margin: 0 auto; padding: var(--s5) var(--gutter); }
  .mark { color: var(--ink); font: 600 20px/28px var(--display); letter-spacing: -0.02em; white-space: nowrap; }
  nav { display: flex; align-items: center; gap: var(--s5); }
  nav a { display: inline-flex; align-items: center; gap: var(--s1); color: var(--ink3); font: var(--type-small); white-space: nowrap; transition: color var(--fast) var(--ease); }
  nav a[aria-current="page"] { color: var(--ink); }
  @media (hover: hover) { nav a:hover { color: var(--ink); } }
  /* ThemeButton's 36 px wash pads its icon, so it sits a little closer than the links. */
  nav > :global(.theme) { margin-left: calc(var(--s2) * -1); }
  @media (max-width: 520px) { nav { gap: var(--s4); } }
</style>

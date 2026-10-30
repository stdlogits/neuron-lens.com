<script lang="ts">
  import { onMount } from "svelte";
  import SiteHeader from "./SiteHeader.svelte";
  import SiteFooter from "./SiteFooter.svelte";
  import Explorer from "./explorer/Explorer.svelte";
  import About from "./pages/About.svelte";
  import Credits from "./pages/Credits.svelte";
  import NotFound from "./pages/NotFound.svelte";
  import { router, startRouter } from "./lib/router.svelte";
  import { startTheme } from "./lib/theme.svelte";
  import { restoreTranslate } from "./lib/translate.svelte";
  import { tips } from "./lib/tips";

  let ready = $state(false);
  onMount(() => {
    const stopRouter = startRouter();
    const stopTheme = startTheme();
    restoreTranslate();
    ready = true;
    return () => { stopRouter(); stopTheme(); };
  });

  const page = $derived(router.route.page);
</script>

<a class="skip" href="#main">Skip to content</a>
<div class="site" use:tips>
  <SiteHeader {page} />
  <main id="main" tabindex="-1">
    {#if ready}
      {#if page === "explore"}
        <Explorer />
      {:else if page === "about"}
        <About />
      {:else if page === "credits"}
        <Credits />
      {:else}
        <NotFound />
      {/if}
    {/if}
  </main>
  <SiteFooter />
</div>

<style>
  .site { display: flex; flex-direction: column; min-height: 100svh; }
  main { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; width: 100%; max-width: var(--page); margin: 0 auto; padding: var(--s7) var(--gutter) var(--s9); }
  main:focus { outline: none; }
  .skip { position: fixed; left: var(--s2); top: var(--s2); z-index: 60; padding: var(--s2) var(--s4); border-radius: var(--r-pill); background: var(--ink); color: var(--paper); font: var(--type-control); transform: translateY(-200%); }
  .skip:focus { transform: none; }
  @media (max-width: 720px) { main { padding-top: var(--s5); } }
</style>

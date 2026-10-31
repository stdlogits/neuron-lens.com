<script lang="ts">
  import { onMount } from "svelte";
  import SiteHeader from "./SiteHeader.svelte";
  import SiteFooter from "./SiteFooter.svelte";
  import Explorer from "./explorer/Explorer.svelte";
  import About from "./pages/About.svelte";
  import Credits from "./pages/Credits.svelte";
  import NotFound from "./pages/NotFound.svelte";
  import { href, router, startRouter } from "./lib/router.svelte";
  import { ORIGIN } from "./lib/site";
  import { theme } from "./lib/theme";
  import { restoreTranslate } from "./lib/translate.svelte";
  import { tips } from "@stdlogits/ledger";

  let ready = $state(false);
  onMount(() => {
    const stopRouter = startRouter();
    const stopTheme = theme.start();
    restoreTranslate();
    ready = true;
    return () => { stopRouter(); stopTheme(); };
  });

  const page = $derived(router.route.page);
  // Every view's address, without the ?all that only changes how much of a layer it lists. The
  // missing page has none and asks not to be indexed (Pages answers it 200, as every path).
  const canonical = $derived(page === "missing" ? null : ORIGIN + href(router.route).split("?")[0]);
</script>

<svelte:head>
  {#if canonical}<link rel="canonical" href={canonical} />{:else}<meta name="robots" content="noindex" />{/if}
</svelte:head>

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

<script lang="ts">
  import { onMount } from "svelte";
  import SiteHeader from "./SiteHeader.svelte";
  import SiteFooter from "./SiteFooter.svelte";
  import Explorer from "./explorer/Explorer.svelte";
  import { href, router, startRouter } from "./lib/router.svelte";
  import { ORIGIN } from "./lib/site";
  import { theme } from "./lib/theme";
  import { restoreDistinctive } from "./lib/reading.svelte";
  import { restoreTranslate } from "./lib/translate.svelte";
  import { tips } from "@stdlogits/ledger";

  // About and Credits load when first shown, so the explorer's first visit doesn't carry them; once the page is idle
  // they are fetched anyway, so going to them later is instant.
  const about = () => import("./pages/About.svelte");
  const credits = () => import("./pages/Credits.svelte");

  let ready = $state(false);
  onMount(() => {
    const stopRouter = startRouter();
    const stopTheme = theme.start();
    restoreTranslate();
    restoreDistinctive();
    ready = true;
    const idle = window.requestIdleCallback ?? ((run: () => void) => setTimeout(run, 2000));
    idle(() => { void about().catch(() => {}); void credits().catch(() => {}); }, { timeout: 5000 });
    return () => { stopRouter(); stopTheme(); };
  });

  const page = $derived(router.route.page);
  // A unit's address with ?card is its link card and nothing else: no header, no footer (explorer/LinkCard.svelte).
  const card = $derived(router.route.page === "explore" && Boolean(router.route.card) && router.route.index !== null);
  // Every view's address, without the ?all that only changes how much of a layer it lists. The
  // missing page has none and asks not to be indexed (Pages answers it 200, as every path).
  const canonical = $derived(page === "missing" ? null : ORIGIN + href(router.route).split("?")[0]);
</script>

<svelte:head>
  {#if canonical}<link rel="canonical" href={canonical} />{:else}<meta name="robots" content="noindex" />{/if}
</svelte:head>

{#if card}
  {#await import("./explorer/LinkCard.svelte") then { default: LinkCard }}<LinkCard />{:catch}<p class="stale">This page has changed since it was opened. <a href={location.href}>Reload it</a>.</p>{/await}
{:else}
  <a class="skip" href="#main">Skip to content</a>
  <div class="site" use:tips>
    <SiteHeader {page} />
    <main id="main" tabindex="-1">
      {#if ready}
        {#if page === "explore"}
          <Explorer />
        {:else if page === "about"}
          {#await about()}<div class="hold"></div>{:then { default: About }}<About />{:catch}<p class="stale">This page has changed since it was opened. <a class="prose-link" href={location.href}>Reload it</a>.</p>{/await}
        {:else if page === "credits"}
          {#await credits()}<div class="hold"></div>{:then { default: Credits }}<Credits />{:catch}<p class="stale">This page has changed since it was opened. <a class="prose-link" href={location.href}>Reload it</a>.</p>{/await}
        {:else}
          <!-- Loaded only for an address with no page: its drawings and the 404 neurons stay out of every other page. -->
          <!-- A tab opened before a deploy asks for a chunk that has since gone: it says so rather than stay blank. -->
          {#await import("./pages/NotFound.svelte") then { default: NotFound }}<NotFound />{:catch}<p class="stale">This page has changed since it was opened. <a class="prose-link" href={location.href}>Reload it</a>.</p>{/await}
        {/if}
      {/if}
    </main>
    <SiteFooter />
  </div>
{/if}

<style>
  .site { display: flex; flex-direction: column; min-height: 100svh; }
  main { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; width: 100%; max-width: var(--page); margin: 0 auto; padding: var(--s7) var(--gutter) var(--s9); }
  main:focus { outline: none; }
  .skip { position: fixed; left: var(--s2); top: var(--s2); z-index: 60; padding: var(--s2) var(--s4); border-radius: var(--r-pill); background: var(--ink); color: var(--paper); font: var(--type-control); transform: translateY(-200%); }
  .skip:focus { transform: none; }
  @media (max-width: 720px) { main { padding-top: var(--s5); } }
  .stale { color: var(--ink2); font: var(--type-body); }
  /* While a page's script arrives, the footer stays below the screen rather than jump down once it's in. */
  .hold { min-height: 100svh; }
</style>

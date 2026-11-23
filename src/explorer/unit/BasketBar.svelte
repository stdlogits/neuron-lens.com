<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { Tabs, reducedMotion } from "@stdlogits/ledger";
  import { scroller } from "../panes";

  // The unit's baskets, always in reach as the page scrolls past them. The one in view is marked;
  // choosing one scrolls to it. Baskets are found by id on every look, because a change of side
  // replaces them. Where the unit's connections stand under it rather than beside it (a phone, a narrow
  // window: Explorer.svelte's panes), the bar ends with them, so they are a tap away too.
  let { baskets }: { baskets: { value: string; label: string; hint?: string }[] } = $props();
  let active = $state(untrack(() => baskets[0]?.value ?? ""));
  let under = $state(false);
  const CONNECTIONS = { value: "connections", label: "Connections", hint: "What it is wired to, driven by and fires with" };
  const shown = $derived(under ? [...baskets, CONNECTIONS] : baskets);

  onMount(() => {
    let frame = 0;
    const look = () => {
      frame = 0;
      const rail = document.getElementById("connections"), unit = document.getElementById("unit");
      under = !!rail && !!unit && rail.getBoundingClientRect().top >= unit.getBoundingClientRect().bottom - 1;
      // Read in the unit's own column where it scrolls on its own (side by side with its connections), else the page.
      // At the end the last basket is the one in view, even if it is too short to reach the top.
      const column = scroller(unit);
      const port = column ? column.getBoundingClientRect() : { top: 0, height: window.innerHeight };
      const atEnd = column ? column.scrollTop + column.clientHeight >= column.scrollHeight - 2 : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const seen = atEnd ? shown.at(-1) : shown.find((basket) => {
        const box = document.getElementById(basket.value)?.getBoundingClientRect();
        return box && box.bottom > port.top + 64 && box.top < port.top + port.height * 0.45;
      });
      if (seen) active = seen.value;
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(look); };
    // Captured, so the unit's own column scrolling is heard as well as the page.
    document.addEventListener("scroll", queue, { passive: true, capture: true });
    window.addEventListener("resize", queue, { passive: true });
    queue();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", queue, { capture: true });
      window.removeEventListener("resize", queue);
    };
  });

  function go(value: string) {
    active = value;
    document.getElementById(value)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }
</script>

<nav class="bar" aria-label="Baskets"><Tabs options={shown} value={active} onchange={go} label="Baskets" scroll /></nav>

<style>
  /* min-width 0: on a phone its one row of baskets scrolls within it, rather than widening the unit to fit. */
  .bar { position: sticky; top: 0; z-index: 2; min-width: 0; padding: var(--s2) 0; background: var(--paper); }
</style>

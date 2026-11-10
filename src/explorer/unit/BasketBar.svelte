<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { Tabs, reducedMotion } from "@stdlogits/ledger";

  // The unit's baskets, always in reach as the page scrolls past them. The one in view is marked;
  // choosing one scrolls to it. Baskets are found by id on every look, because a change of side
  // replaces them.
  let { baskets }: { baskets: { value: string; label: string; hint?: string }[] } = $props();
  let active = $state(untrack(() => baskets[0]?.value ?? ""));

  onMount(() => {
    let frame = 0;
    const look = () => {
      frame = 0;
      // At the page's end the last basket is the one in view, even if it is too short to reach the top.
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const seen = atEnd ? baskets.at(-1) : baskets.find((basket) => {
        const box = document.getElementById(basket.value)?.getBoundingClientRect();
        return box && box.bottom > 64 && box.top < window.innerHeight * 0.45;
      });
      if (seen) active = seen.value;
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(look); };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    queue();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  });

  function go(value: string) {
    active = value;
    document.getElementById(value)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }
</script>

<nav class="bar" aria-label="Baskets"><Tabs options={baskets} value={active} onchange={go} label="Baskets" /></nav>

<style>
  .bar { position: sticky; top: 0; z-index: 2; padding: var(--s2) 0; background: var(--paper); }
</style>

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { Tabs, reducedMotion } from "@stdlogits/ledger";

  // The unit's baskets, always in reach as the page scrolls past them. The one in view is marked;
  // choosing one scrolls to it.
  let { baskets }: { baskets: { value: string; label: string }[] } = $props();
  let active = $state(untrack(() => baskets[0]?.value ?? ""));

  onMount(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
      active = baskets.find((basket) => seen.get(basket.value))?.value ?? active;
    }, { rootMargin: "-64px 0px -55% 0px" });
    for (const basket of baskets) {
      const section = document.getElementById(basket.value);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
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

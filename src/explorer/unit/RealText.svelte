<script lang="ts">
  import { stem } from "@stdlogits/ledger";
  import Group from "./Group.svelte";
  import type { Pole } from "../../lib/data";

  // What a side fires on in real text: the tokens that most make it fire, where its top firings
  // land, and what comes next. A measured token is tinted when a read names it too.
  let { pole, next = true }: { pole: Pole; next?: boolean } = $props();

  const measured = $derived(new Set(pole.measured));
  const flag = (token: string) => (measured.has(stem(token)) ? 1 : 0);
  const drivers = $derived(pole.drivers.map(([token, value]) => ({ token, value, flags: flag(token) })));
  const peaks = $derived(pole.peaks.map(([token, times]) => ({ token, times, flags: flag(token) })));
  const after = $derived(pole.next.map(([token, times]) => ({ token, times, flags: flag(token) })));
</script>

<Group title="In real text" tip="Tokens that most make it fire, measured in real documents" items={drivers} />
{#if peaks.length}<Group title="Peaks on" tip="The tokens its top firings land on, and how many of them" items={peaks} />{/if}
{#if next && after.length}<Group title="Comes next" tip="The tokens right after its top firings, and how many of them" items={after} />{/if}

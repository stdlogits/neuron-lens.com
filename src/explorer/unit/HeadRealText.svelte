<script lang="ts">
  import { stem } from "@stdlogits/ledger";
  import Group from "./Group.svelte";
  import { percent, type HeadDetail } from "../../lib/data";
  import { headAgreement } from "./evidence";

  // What a head does in real text: as the query, the tokens that drive it and where its top firings
  // land; as the key, the tokens it attends to and what it looked at. A token is tinted when two of its
  // lists name it. With `input`, just that one, under a column of its own.
  let { head, input }: { head: HeadDetail; input?: "query" | "key" } = $props();

  const agree = $derived(headAgreement(head));
  const lit = (token: string) => (agree.has(stem(token)) ? 1 : 0);
  const measured = (list: [string, number][]) => list.map(([token, value]) => ({ token, value, flags: lit(token) }));
  const counted = (list: [string, number][]) => list.map(([token, times]) => ({ token, times, flags: lit(token) }));
</script>

{#if input !== "key"}
  <Group title="In real text" tip="Query tokens that make its output largest" items={measured(head.drivers)} />
  {#if head.peaks.length}
    <Group title="Peaks on" tip="Query tokens at its top firings" items={counted(head.peaks)}
      share={{ value: head.modes[0], label: `${percent(head.modes[0])} of its top firings on one query token` }} />
  {/if}
{/if}
{#if input !== "query"}
  <Group title={input ? "In real text" : "Attends to"} tip="Key tokens it looks at most" items={measured(head.keys)} />
  {#if head.sources.length}
    <Group title="Looked at" tip="What it looked at in its top firings" items={counted(head.sources)}
      share={{ value: head.modes[1], label: `${percent(head.modes[1])} of its top firings look at one token` }} />
  {/if}
{/if}

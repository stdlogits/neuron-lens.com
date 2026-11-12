<script lang="ts">
  import { Swap, Token, stem } from "@stdlogits/ledger";
  import Group from "./Group.svelte";
  import { LENSES, type Pole } from "../../lib/data";
  import { reading } from "../../lib/reading.svelte";
  import { family, nth, oneOfEach, readTip } from "./evidence";
  import { fit } from "./fit";

  // What a side fires on in real text: the tokens that most make it fire, where its top firings
  // land, what comes next, and beside that what the model says will. A measured token is tinted when
  // a read names it too.
  let { pole, next = true }: { pole: Pole; next?: boolean } = $props();

  const measured = $derived(new Set(pole.measured));
  const flag = (token: string) => (measured.has(stem(token)) ? 1 : 0);
  const drivers = $derived(pole.drivers.map(([token, value]) => ({ token, value, flags: flag(token) })));
  const peaks = $derived(pole.peaks.map(([token, times]) => ({ token, times, flags: flag(token) })));
  const after = $derived(pole.next.map(([token, times]) => ({ token, times, flags: flag(token) })));
  const says = $derived(next ? oneOfEach((pole.stream ?? []).filter((read) => family(read.col) === "pred"), reading.distinctive)[0] : undefined);
</script>

<Group title="In real text" tip="Tokens that make it fire most" items={drivers} />
{#if peaks.length}<Group title="Peaks on" tip="Where its top firings land" items={peaks} />{/if}
{#if next && after.length}<Group title="Comes next" tip="What comes right after its top firings" items={after} />{/if}
{#if says?.tokens.length}
  <Group title={LENSES[says.col].name} morph tip={readTip(says)} share={{ value: says.pct / 100, label: `${nth(says.pct)} percentile of the layer` }}>
    <div use:fit>
      <div>
        <Swap key={says.col}>
          <div class="toks">{#each says.tokens as [token, count, flags], i (i)}<Token {token} {count} flags={(flags & 3) !== 0 || flag(token) ? 1 : 0} {i} />{/each}</div>
        </Swap>
      </div>
    </div>
  </Group>
{/if}

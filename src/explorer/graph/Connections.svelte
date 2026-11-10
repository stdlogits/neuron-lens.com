<script lang="ts">
  import { onMount } from "svelte";
  import { LabelText, Meter, MorphText, Segmented, Swap, Tabs, expand, fadeIn } from "@stdlogits/ledger";
  import Graph from "./Graph.svelte";
  import { focusOf, nodeKey, trace, type Graph as GraphData, type Mode, type Reach } from "./trace";
  import { useLens } from "../lens.svelte";
  import { depthColor } from "../../lib/models";
  import { headId, headOf, neuronId, percent, poleOf, type Link, type Wire } from "../../lib/data";

  // The chosen unit among the others: its directed graph at true depth, then the strongest links on
  // each side in words. A choice between what feeds it in real text, what its weights wire it to,
  // and what fires with it, because those are three different lists.
  const lens = useLens();

  let mode = $state<Mode>("context");
  let reach = $state<Reach>("far");
  let hovered = $state<string | null>(null);
  let graph = $state.raw<GraphData | null>(null);

  const isHead = $derived(lens.unit === "heads");
  // The three full names don't fit beside a 16 px gutter on the narrowest phones.
  let tight = $state(false);
  onMount(() => {
    const query = matchMedia("(max-width: 360px)");
    const look = () => (tight = query.matches);
    look();
    query.addEventListener("change", look);
    return () => query.removeEventListener("change", look);
  });
  const modes = $derived<{ value: Mode; label: string; hint: string }[]>(isHead ? [{ value: "context", label: "In context", hint: "" }] : [
    { value: "context", label: tight ? "Context" : "In context", hint: "Measured at its top firings: which earlier units its activation comes from, and which later units it helps fire" },
    { value: "weights", label: tight ? "Weights" : "In the weights", hint: "Read from the weights alone, with no text: how far one firing moves each later neuron, directly" },
    { value: "with", label: "Fires with", hint: "The earlier neurons active at its top firings, most out of proportion to how often they fire at all" },
  ]);
  const shownMode = $derived<Mode>(isHead ? "context" : mode);
  const reaches: { value: Reach; label: string; hint: string }[] = [
    { value: "near", label: "Near", hint: "Only the units most of its flow passes through" },
    { value: "far", label: "Far", hint: "Followed until the flow falls to a third of a percent" },
    { value: "all", label: "All", hint: "Followed as far as the links stay strong enough to draw" },
  ];

  // Wait for a neuron's detail so its clearer side is known; heads have one side.
  const ready = $derived(lens.selected !== null && (isHead || lens.neuronDetail !== null));
  let latest: object | null = null;
  $effect(() => {
    if (!ready) return;
    const token = {};
    latest = token;
    const focus = focusOf(lens.model, lens.unit, lens.layer, lens.selected!, lens.side === 0 ? 1 : -1);
    void trace(lens.model, focus, shownMode, reach, (next) => { if (latest === token) graph = next; }, () => latest === token);
    return () => { if (latest === token) latest = null; };
  });

  const nodeOf = $derived(new Map((graph?.nodes ?? []).map((node) => [node.key, node])));
  const focusWire = $derived(graph?.nodes.find((node) => node.side === "focus")?.wire ?? null);

  interface Row { key: string; name: string; layer: number; href: string; value: number; title: string; low: boolean; mirrored: boolean }

  function row(kind: "neuron" | "head", [id, value]: Link, mirrored = false): Row {
    const key = nodeKey(kind, id);
    const wire: Wire | undefined = nodeOf.get(key)?.wire;
    if (kind === "head") {
      const { layer, head } = headOf(lens.model.heads, id);
      return { key, name: headId(layer, head), layer, href: lens.unitHref("heads", layer, head), value, title: wire?.title ?? "", low: (wire?.conf ?? 100) < 25, mirrored };
    }
    const { layer, neuron, pole } = poleOf(lens.model.mlp, id);
    return { key, name: `${neuronId(layer, neuron)} ${pole > 0 ? "+" : "−"}`, layer, href: lens.unitHref("neurons", layer, neuron), value, title: wire?.title ?? "", low: (wire?.conf ?? 100) < 25, mirrored };
  }

  /** A list's rows, each neuron once: its two sides are the same weight with the sign flipped. */
  function collapsed(list: Link[]): Row[] {
    const best = new Map<number, { link: Link; twins: number }>();
    for (const link of list) {
      const { layer, neuron } = poleOf(lens.model.mlp, link[0]);
      const at = layer * lens.model.mlp + neuron;
      const held = best.get(at);
      if (!held) best.set(at, { link, twins: 1 });
      else best.set(at, { link: Math.abs(link[1]) > Math.abs(held.link[1]) ? link : held.link, twins: held.twins + 1 });
    }
    return [...best.values()].map(({ link, twins }) => row("neuron", link, twins > 1));
  }

  const SHOWN = 8;
  const sides = $derived.by(() => {
    if (!focusWire) return [];
    const { links } = focusWire;
    const byStrength = (rows: Row[]) => rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, SHOWN);
    const drives = { title: "Drives", tip: "The later neurons that count it among their largest sources at their top firings", rows: byStrength(links.drives.map((link) => row("neuron", link))) };
    if (shownMode === "with") return [{ title: "Fires with", tip: "Earlier neurons active at its top firings, ranked by how far that beats their usual rate", rows: links.with.slice(0, SHOWN).map((link) => row("neuron", link)) }];
    if (shownMode === "weights") return [
      { title: "Wired from", tip: "The earlier neurons whose writes move it most, read from the weights", rows: byStrength(collapsed(links.in)) },
      { title: "Wired to", tip: "The later neurons its write moves most, read from the weights", rows: byStrength(collapsed(links.out)) },
    ];
    return isHead ? [drives] : [
      { title: "Driven by", tip: "The earlier neurons and heads that make up the most of its activation at its top firings", rows: byStrength([...links.driven.map((link) => row("neuron", link)), ...links.heads.map((link) => row("head", link))]) },
      drives,
    ];
  });
  /** One list giving way to the next: a new unit, or a new view of it. */
  const listKey = $derived(`${graph?.nodes.find((node) => node.side === "focus")?.key ?? ""}/${shownMode}`);

  const hrefFor = (kind: "neuron" | "head", layer: number, index: number) => lens.unitHref(kind === "head" ? "heads" : "neurons", layer, index);
  const shownValue = (value: number) => {
    if (shownMode === "with") return `${Math.round(value * 5)} of 5`;
    if (shownMode === "weights") return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
    return `${value >= 0 ? "+" : "−"}${percent(Math.abs(value))}`;
  };
  /** What a row's number is. */
  function valueTip(title: string, value: number): string {
    if (title === "Fires with") return `Active at ${Math.round(value * 5)} of its first 5 top firings`;
    if (title === "Wired from") return "How far one of that neuron's top firings moves this one's normalised input";
    if (title === "Wired to") return "How far one of this neuron's top firings moves that one's normalised input";
    const whose = title === "Driven by" ? "its" : "that neuron's";
    return value >= 0 ? `Makes up ${percent(value)} of ${whose} activation at its top firings` : `Takes ${percent(-value)} off ${whose} activation at its top firings`;
  }
  const top = (rows: Row[]) => Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  const mix = $derived(shownMode === "context" && !isHead && focusWire ? focusWire.mix : null);
  const showsHeads = $derived(graph?.nodes.some((node) => node.kind === "head") ?? false);
  const showsAgainst = $derived(graph?.edges.some((edge) => edge.value < 0) ?? false);
</script>

<aside class="rail" aria-label="Connections">
  <div class="tools">
    {#if modes.length > 1}<Segmented options={modes} value={shownMode} onchange={(value: Mode) => (mode = value)} label="Which connections" />{/if}
    <div class="reach" class:off={shownMode === "with"} inert={shownMode === "with"}><Tabs options={reaches} value={reach} onchange={(value: string) => (reach = value as Reach)} label="How far" /></div>
  </div>

  {#if mix}
    <div class="mix" data-tip="How much of its activation at its top firings comes from earlier neurons, from attention heads and from the token's embedding" transition:expand>
      <div class="bar" aria-hidden="true"><i style:flex-grow={Math.max(mix[0], 0)}></i><i class="two" style:flex-grow={Math.max(mix[1], 0)}></i></div>
      <p class="meta"><MorphText text={`Neurons ${percent(mix[0])} · heads ${percent(mix[1])} · embedding ${percent(Math.max(mix[2], 0))}`} /></p>
    </div>
  {/if}

  {#if graph}
    <Graph {graph} model={lens.model} mode={shownMode} href={hrefFor} bind:hovered />
    <ul class="key meta" aria-label="Key">
      <li data-tip="One side of a neuron. The larger it is, the more of the flow runs through it"><i class="dot"></i>Neuron</li>
      {#if showsHeads}<li data-tip="An attention head. It sits just above its layer's neurons, because it writes into their stream"><i class="bar"></i>Head</li>{/if}
      {#if shownMode !== "with"}
        <li data-tip="A link that raises what it leads to. The heavier it is, the more of the flow it carries"><i class="line"></i>Pushes for</li>
        {#if showsAgainst}<li data-tip="A link that lowers what it leads to"><i class="line against"></i>Pushes against</li>{/if}
      {/if}
    </ul>
  {:else}<div class="waiting" aria-hidden="true"></div>{/if}

  {#each sides as side (side.title)}
    <section class="side">
      <h3 class="head" data-tip={side.tip}>{side.title}</h3>
      <Swap key={listKey}>
        <div class="rows">
          {#each side.rows as item, i (item.key)}
            <a class="row rise" style:--i={i} class:on={hovered === item.key} href={item.href} onpointerenter={() => (hovered = item.key)} onpointerleave={() => (hovered = null)}>
              <span class="id"><i class="swatch" style:background={depthColor(lens.model, item.layer)}></i>{item.name}{#if item.mirrored}<span class="mirror" data-tip="Its other side pushes the opposite way">±</span>{/if}</span>
              <span class="value" data-tip={valueTip(side.title, item.value)}><Meter value={Math.abs(item.value) / top(side.rows)} label={valueTip(side.title, item.value)} />{shownValue(item.value)}</span>
              <span class="title" class:low={item.low}>{#key item.title}<span in:fadeIn>{#if item.title}<LabelText text={item.title} />{:else}&nbsp;{/if}</span>{/key}</span>
            </a>
          {:else}
            <p class="meta none">None</p>
          {/each}
        </div>
      </Swap>
    </section>
  {/each}
</aside>

<style>
  .rail { flex: 1 1 340px; max-width: 420px; display: grid; align-content: start; gap: var(--s5); min-width: 0; }
  @media (max-width: 720px) { .rail { max-width: none; } }
  .tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--s2) var(--s4); }
  .reach { transition: opacity var(--fast) var(--ease); }
  .reach.off { opacity: 0; }
  .mix { display: grid; gap: var(--s1); cursor: help; }
  .mix .bar { display: flex; gap: 2px; height: 6px; }
  .mix i { flex: 0 1 0; border-radius: 2px; background: var(--tint); transition: flex-grow var(--glide) var(--ease); }
  .mix i.two { background: color-mix(in oklch, var(--tint) 40%, transparent); }
  .mix .meta { font-weight: 400; }
  .waiting { height: 780px; }
  .key { display: flex; flex-wrap: wrap; gap: var(--s1) var(--s4); margin: 0; padding: 0; font-weight: 400; list-style: none; }
  .key li { display: inline-flex; align-items: center; gap: 6px; cursor: help; }
  .key i { flex: none; background: var(--tint); }
  .key .dot { width: 8px; height: 8px; border-radius: 50%; }
  .key .bar { width: 18px; height: 6px; border-radius: var(--r-pill); }
  .key .line { width: 18px; height: 2px; border-radius: 1px; }
  .key .against { background: repeating-linear-gradient(90deg, var(--ink3) 0 3px, transparent 3px 6px); }
  .side { display: grid; gap: 2px; }
  .side .head { padding: 0 var(--s3) var(--s1); cursor: help; }
  .rows { display: grid; gap: 2px; min-width: 0; }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 2px var(--s2);
    padding: var(--s2) var(--s3);
    border-radius: var(--r-box);
    color: var(--ink);
    text-decoration: none;
    transition: background-color var(--fast) var(--ease), scale var(--fast) var(--ease);
  }
  .row.on { background: var(--wash); }
  .row:active { scale: 0.99; }
  @media (hover: hover) { .row:hover { background: var(--wash); } }
  .id { display: inline-flex; align-items: center; gap: var(--s1); color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; }
  .swatch { width: 10px; height: 6px; border-radius: 2px; }
  .mirror { cursor: help; }
  .value { display: inline-flex; align-items: center; gap: var(--s2); color: var(--ink2); font: var(--type-meta); font-weight: 400; font-variant-numeric: tabular-nums; cursor: help; }
  .title { grid-column: 1 / -1; font: var(--type-small); text-wrap: pretty; }
  .low { color: var(--ink3); }
  .none { padding: 0 var(--s3); font-weight: 400; }
</style>

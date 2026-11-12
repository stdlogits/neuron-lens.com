<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import { IconButton, LabelText, Meter, MorphText, Segmented, Swap, Tabs, expand, fadeIn } from "@stdlogits/ledger";
  import Card, { type Picked } from "./Card.svelte";
  import Graph from "./Graph.svelte";
  import Navigator from "./Navigator.svelte";
  import { focusOf, headInput, nodeKey, trace, type Graph as GraphData, type Mode, type Reach, type Take } from "./trace";
  import { useLens } from "../lens.svelte";
  import { depthColor } from "../../lib/models";
  import { headId, headOf, neuronId, percent, poleOf, type Link, type Through, type Wire } from "../../lib/data";

  // The chosen unit among the others: its directed graph at true depth, then the strongest links on
  // each side in words. A choice between what feeds it in real text, what its weights wire it to,
  // and what fires with it, because those are three different lists.
  const lens = useLens();

  let mode = $state<Mode>("context");
  let reach = $state<Reach>("near");
  let hovered = $state<string | null>(null);
  // A unit lights what connects it once the pointer rests on it, so a pointer passing over the graph or
  // the list leaves the light as it was rather than flashing the whole graph. Moving from one unit to
  // the next crossfades the light between them, and it goes out a moment after the pointer leaves.
  let wait = 0;
  function point(key: string | null) {
    clearTimeout(wait);
    if (key !== hovered) wait = window.setTimeout(() => (hovered = key), key ? 120 : 90);
  }
  onDestroy(() => clearTimeout(wait));
  let graph = $state.raw<GraphData | null>(null);

  // A unit tapped in the rail's graph: its card over the page, and what connects it lit, until it is put away,
  // its unit leaves the graph, the graph is of another unit, or the graph is scrolled out of view.
  let picked = $state.raw<Picked | null>(null);
  const lit = $derived(picked?.key ?? hovered);
  let pickedFor = "";
  $effect(() => {
    const nodes = graph?.nodes ?? [];
    const focus = nodes.find((node) => node.side === "focus")?.key ?? "";
    untrack(() => {
      if (picked && (focus !== pickedFor || !nodes.some((node) => node.key === picked!.key))) picked = null;
    });
  });
  const pick = (next: Picked) => {
    picked = next;
    pickedFor = graph?.nodes.find((node) => node.side === "focus")?.key ?? "";
  };
  $effect(() => { if (lens.graphOpen) untrack(() => (picked = null)); });
  let figure = $state<HTMLElement>();
  $effect(() => {
    if (!picked || !figure) return;
    const seen = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) picked = null; });
    seen.observe(figure);
    return () => seen.disconnect();
  });

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
  const FIRES_WITH = { value: "with" as const, label: "Fires with", hint: "Earlier neurons active when it fires" };
  const modes = $derived<{ value: Mode; label: string; hint: string }[]>(isHead ? [
    { value: "context", label: "Value", hint: "Where what it copies comes from, and goes" },
    { value: "query", label: "Query", hint: "What sets where it looks, from its query" },
    { value: "key", label: "Key", hint: "What sets where it looks, from its keys" },
    FIRES_WITH,
  ] : [
    { value: "context", label: tight ? "Context" : "In context", hint: "What feeds it and what it feeds, in real text" },
    { value: "weights", label: tight ? "Weights" : "In the weights", hint: "Direct links, from the weights alone" },
    FIRES_WITH,
  ]);
  // A view one kind of unit doesn't have stays chosen for when the page is on the other kind again.
  const shownMode = $derived<Mode>(modes.some((option) => option.value === mode) ? mode : "context");
  const reaches: { value: Reach; label: string; hint: string }[] = [
    { value: "near", label: "Near", hint: "Only its strongest links" },
    { value: "far", label: "Far", hint: "Followed until the flow is faint" },
    { value: "all", label: "All", hint: "Every link strong enough to draw" },
  ];

  // Wait for a neuron's detail so its clearer side is known; heads have one side.
  const ready = $derived(lens.selected !== null && (isHead || lens.neuronDetail !== null));
  // The walk publishes the graph each time it reaches a layer, often several times a frame: it is taken as it
  // stands, laid out and drawn once a frame (or after 100 ms, for a page given no frames).
  let latest: object | null = null;
  $effect(() => {
    if (!ready) return;
    const token = {};
    latest = token;
    let queued: Take | null = null;
    let frame = 0;
    let timer = 0;
    const flush = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = timer = 0;
      if (latest === token && queued) graph = queued();
      queued = null;
    };
    const publish = (next: Take) => {
      if (latest !== token) return;
      queued = next;
      if (!frame) { frame = requestAnimationFrame(flush); timer = window.setTimeout(flush, 100); }
    };
    const focus = focusOf(lens.model, lens.unit, lens.layer, lens.selected!, lens.side === 0 ? 1 : -1);
    void trace(lens.model, focus, shownMode, reach, publish, () => latest === token);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      if (latest === token) latest = null;
    };
  });

  const nodeOf = $derived(new Map((graph?.nodes ?? []).map((node) => [node.key, node])));
  const focusWire = $derived(graph?.nodes.find((node) => node.side === "focus")?.wire ?? null);

  interface Row { key: string; kind: "neuron" | "head"; name: string; layer: number; href: string; value: number; title: string; low: boolean; mirrored: boolean; through: Through[] }

  function row(kind: "neuron" | "head", [id, value]: Link, mirrored = false): Row {
    const key = nodeKey(kind, id);
    const wire: Wire | undefined = nodeOf.get(key)?.wire;
    if (kind === "head") {
      const { layer, head } = headOf(lens.model.heads, id);
      return { key, kind, name: headId(layer, head), layer, href: lens.unitHref("heads", layer, head), value, title: wire?.title ?? "", low: (wire?.conf ?? 100) < 25, mirrored, through: [] };
    }
    const { layer, neuron, pole } = poleOf(lens.model.mlp, id);
    return { key, kind, name: `${neuronId(layer, neuron)} ${pole > 0 ? "+" : "−"}`, layer, href: lens.unitHref("neurons", layer, neuron), value, title: wire?.title ?? "", low: (wire?.conf ?? 100) < 25, mirrored, through: [] };
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

  /** The heads it drives, each once, by the strongest of the inputs it reaches it through. */
  function headTargets(list: Link[]): Row[] {
    const byHead = new Map<number, Row>();
    for (const link of list) {
      const held = byHead.get(link[0]);
      if (held) held.through.push(link[2]!);
      else byHead.set(link[0], { ...row("head", link), through: [link[2]!] });
    }
    return [...byHead.values()];
  }

  /** The input of a head this view is about: its value, unless it is on the query or the key. */
  const input = $derived<Through>(shownMode === "query" ? 1 : shownMode === "key" ? 2 : 0);
  const DRIVEN_TIPS = ["Earlier units that make up most of what it writes", "Earlier units that set where it looks, at its query", "Earlier units that set where it looks, at its keys"];
  const THROUGH = ["value", "query", "key"];

  const SHOWN = 8;
  const sides = $derived.by(() => {
    if (!focusWire) return [];
    const { links } = focusWire;
    const byStrength = (rows: Row[]) => rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, SHOWN);
    const drives = { title: "Drives", tip: "Later units it drives most", rows: byStrength([...links.drives.map((link) => row("neuron", link)), ...headTargets(links.drivesHeads)]) };
    if (shownMode === "with") return [{ title: "Fires with", tip: "Earlier neurons active when it fires, beyond their usual rate", rows: links.with.slice(0, SHOWN).map((link) => row("neuron", link)) }];
    if (shownMode === "weights") return [
      { title: "Wired from", tip: "Earlier neurons that move it most, by weight", rows: byStrength(collapsed(links.in)) },
      { title: "Wired to", tip: "Later neurons it moves most, by weight", rows: byStrength(collapsed(links.out)) },
    ];
    const from = shownMode === "query" || shownMode === "key" ? focusWire[shownMode]! : links;
    return [
      { title: "Driven by", tip: isHead ? DRIVEN_TIPS[input] : "Earlier units that make up most of its activation", rows: byStrength([...from.driven.map((link) => row("neuron", link)), ...from.heads.map((link) => row("head", link))]) },
      drives,
    ];
  });
  /** One list giving way to the next: a new unit, or a new view of it. */
  const listKey = $derived(`${graph?.nodes.find((node) => node.side === "focus")?.key ?? ""}/${shownMode}`);

  const hrefFor = (kind: "neuron" | "head", layer: number, index: number) => lens.unitHref(kind === "head" ? "heads" : "neurons", layer, index);
  // In the full-screen graph, a unit's mark opens it there.
  const graphHref = (kind: "neuron" | "head", layer: number, index: number) => lens.hrefFor({ unit: kind === "head" ? "heads" : "neurons", layer, index, all: kind === "neuron" && lens.all, graph: true });
  const focusNode = $derived(graph?.nodes.find((node) => node.side === "focus") ?? null);
  const focusName = $derived(focusNode ? (focusNode.kind === "head" ? headId(focusNode.layer, focusNode.index) : `${neuronId(focusNode.layer, focusNode.index)} ${focusNode.pole > 0 ? "+" : "−"}`) : "");
  const shownValue = (value: number) => {
    if (shownMode === "with") return `${Math.round(value * 5)} of 5`;
    if (shownMode === "weights") return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
    return `${value >= 0 ? "+" : "−"}${percent(Math.abs(value))}`;
  };
  /** What a row's number is. */
  function valueTip(title: string, { value, kind, through }: Row): string {
    if (title === "Fires with") return `Active at ${Math.round(value * 5)} of its first 5 top firings`;
    if (title === "Wired from") return "How far its firing moves this neuron";
    if (title === "Wired to") return "How far this neuron's firing moves it";
    const what = title === "Driven by"
      ? (isHead ? headInput("it", input) : "its activation")
      : (kind === "head" ? headInput("that head", through[0] ?? 0) : "that neuron's activation");
    return `${value >= 0 ? "" : "−"}${percent(Math.abs(value))} of ${what}`;
  }
  // A share can run past the whole, with another taking it back.
  const signedPercent = (value: number) => `${value < -0.005 ? "−" : ""}${percent(Math.abs(value) < 0.005 ? 0 : Math.abs(value))}`;
  const top = (rows: Row[]) => Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  const mix = $derived(!focusWire || shownMode === "weights" || shownMode === "with" ? null : shownMode === "context" ? focusWire.mix : focusWire[shownMode]!.mix);
  const mixTip = $derived(`Where ${isHead ? headInput("it", input) : "its activation"} comes from`);
  const showsHeads = $derived(graph?.nodes.some((node) => node.kind === "head") ?? false);
  const showsAgainst = $derived(graph?.edges.some((edge) => edge.value < 0) ?? false);
</script>

<aside class="rail" aria-label="Connections">
  <div class="figure" bind:this={figure}>
    <div class="tools">
      {#if modes.length > 1}<Segmented options={modes} value={shownMode} onchange={(value: Mode) => (mode = value)} label="Which connections" />{/if}
      <div class="reach" class:off={shownMode === "with"} inert={shownMode === "with"}><Tabs options={reaches} value={reach} onchange={(value: string) => (reach = value as Reach)} label="How far" /></div>
      <IconButton icon="expand" label="Full screen, with every title" onclick={() => lens.setGraph(true)} />
    </div>

    {#if mix}
      <div class="mix" data-tip={mixTip} transition:expand>
        <div class="bar" aria-hidden="true"><i style:flex-grow={Math.max(mix[0], 0)}></i><i class="two" style:flex-grow={Math.max(mix[1], 0)}></i></div>
        <p class="meta"><MorphText text={`Neurons ${signedPercent(mix[0])} · heads ${signedPercent(mix[1])} · embedding ${signedPercent(mix[2])}`} /></p>
      </div>
    {/if}

    {#if graph && lens.graphOpen}
      <Navigator {graph} model={lens.model} mode={shownMode} modes={modes} onmode={(value: Mode) => (mode = value)} {reach} {reaches} onreach={(value: Reach) => (reach = value)}
        {hovered} {point} href={graphHref} name={focusName} title={focusWire?.title ?? ""} close={() => lens.setGraph(false)} />
    {/if}
    {#if graph && !lens.graphOpen}
      <Graph {graph} model={lens.model} mode={shownMode} href={hrefFor} hovered={lit} {point} onpick={pick} />
      {#if picked}<Card {picked} close={() => (picked = null)} fixed />{/if}
      <ul class="key meta" aria-label="Key">
        <li data-tip="A neuron side; larger carries more"><i class="dot"></i>Neuron</li>
        {#if showsHeads}<li data-tip="An attention head, above its layer's neurons"><i class="bar"></i>Head</li>{/if}
        {#if shownMode !== "with"}
          <li data-tip="Raises what it leads to; heavier carries more"><i class="line"></i>Pushes for</li>
          {#if showsAgainst}<li data-tip="Lowers what it leads to"><i class="line against"></i>Pushes against</li>{/if}
        {/if}
      </ul>
    {:else}<div class="waiting" aria-hidden="true"></div>{/if}
  </div>

  <div class="lists">
    {#each sides as side (side.title)}
      <section class="side">
        <h3 class="head" data-tip={side.tip}>{side.title}</h3>
        <Swap key={listKey}>
          <div class="rows">
            {#each side.rows as item, i (item.key)}
              <a class="row rise" style:--i={i} class:on={lit === item.key} href={item.href} onpointerenter={() => point(item.key)} onpointerleave={() => point(null)}>
                <span class="id"><i class="swatch" style:background={depthColor(lens.model, item.layer)}></i>{item.name}{#if item.mirrored}<span class="mirror" data-tip="Its other side pushes the opposite way">±</span>{/if}{#if item.through.length}<span data-tip="The inputs of that head it reaches, strongest first">· {item.through.map((through) => THROUGH[through]).join(", ")}</span>{/if}</span>
                <span class="value" data-tip={valueTip(side.title, item)}><Meter value={Math.abs(item.value) / top(side.rows)} label={valueTip(side.title, item)} />{shownValue(item.value)}</span>
                <span class="title" class:low={item.low}>{#key item.title}<span in:fadeIn>{#if item.title}<LabelText text={item.title} />{:else}&nbsp;{/if}</span>{/key}</span>
              </a>
            {:else}
              <p class="meta none">None</p>
            {/each}
          </div>
        </Swap>
      </section>
    {/each}
  </div>
</aside>

<style>
  .rail { flex: 1 1 340px; max-width: 420px; display: grid; align-content: start; gap: var(--s5); min-width: 0; }
  .figure, .lists { display: grid; align-content: start; gap: var(--s5); min-width: 0; }
  /* Beside the unit (Explorer.svelte's panes: 340 + 48 + 640 px) it is a column. Narrower, the unit takes
     the whole width under it, so the rail takes a row of its own, and from 680 px its lists stand beside the
     graph rather than under it, where the column would otherwise leave half the row empty. */
  @container explorer (max-width: 1027.98px) { .rail { flex-basis: 100%; max-width: none; } }
  @container explorer (min-width: 680px) and (max-width: 1027.98px) {
    .rail { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s7); }
  }
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

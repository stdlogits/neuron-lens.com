<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { flip } from "svelte/animate";
  import { FOREIGN, GLIDE, Icon, LabelText, MorphText, ease, expand, fadeOut, glide, reducedMotion, swell } from "@stdlogits/ledger";
  import { useLens } from "./lens.svelte";
  import { findId, findLayer, findWords, type Found, type Result } from "./search/engine";
  import { headId, loadHeadLayer, loadLayerIndex, loadNeuron, loadSearch, neuronId, parseRef, type SearchFile } from "../lib/data";
  import { bandOf, depthColor } from "../lib/models";
  import { ensureTerms, termFor, translation } from "../lib/translate.svelte";

  // The search under the intro, as wide as the atlas under it: a word finds the curated neurons' poles and
  // the heads whose labels hold it, an ID (or a unit's pasted address) opens its unit, and "L8" its layer.
  // The results open below the field as part of the same wash box, and every match lights up on the atlas
  // and in the list (lens.matches) for as long as the query has them; the one looked at (arrowed to or
  // pointed at) is picked out on the atlas too (lens.peek). Each result carries its layer's depth colour and
  // where it sits in depth, and the query is marked in its title. A word with nothing close is matched
  // within a typo (≈), and a query that finds nothing offers what it might mean. Focus on an empty field
  // shows the recent searches. The search file (about 3 MB) loads on first hover or focus.
  // As the query changes, what stays glides to its new place, what goes fades, and what comes rises; a result
  // looked at for a moment starts loading its unit, so it opens with its evidence already there.
  const lens = useLens();
  const SHOWN = 10;
  const MOST = 50;
  const RECENT = 6;
  const RECENT_KEY = "neuron-lens:recent-searches";

  let query = $state("");
  /** The query as last run (typing settles for 70 ms first). */
  let asked = $state("");
  let open = $state(false);
  let active = $state(-1);
  let data = $state.raw<{ model: string; file: SearchFile } | null>(null);
  let loading = $state(false);
  let failed = $state(false);
  /** Focus arrived from the keyboard (Tab or /): the ring shows. */
  let keyboard = $state(false);
  let input: HTMLInputElement | undefined = $state();
  let root: HTMLElement | undefined = $state();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointerDown = false;
  /** How many results show, and which kind. */
  let limit = $state(SHOWN);
  let kind = $state<"all" | "neurons" | "heads">("all");
  let recent = $state<string[]>([]);

  const id = $props.id();
  const listId = `${id}-results`;
  const optionId = (i: number) => `${id}-option-${i}`;

  function warm() {
    if (data?.model === lens.modelId || loading) return;
    const model = lens.modelId;
    loading = true;
    failed = false;
    loadSearch(model).then(
      (file) => { if (lens.modelId === model) data = { model, file }; },
      () => { if (lens.modelId === model) failed = true; },
    ).finally(() => { if (lens.modelId === model) loading = false; });
  }

  // Another model: its own search file, and a fresh field.
  $effect(() => {
    void lens.modelId;
    untrack(() => {
      clearTimeout(timer);
      query = asked = "";
      open = false;
      loading = false;
      failed = false;
      if (data && data.model !== lens.modelId) data = null;
    });
  });

  const foreign = $derived(FOREIGN.test(asked));
  // A word in another script is also looked up in its English, which needs the terms.
  $effect(() => { if (foreign) void ensureTerms(); });

  /** Null while what the query needs is still loading. */
  const found = $derived.by<Found | null>(() => {
    const text = asked.trim();
    const index = lens.index?.id === lens.modelId ? lens.index : null;
    if (!text || !index) return null;
    const byId = findId(text, lens.model, index, lens.heads);
    if (byId) return byId;
    const layer = findLayer(text, lens.model);
    if (layer !== null) return { results: [], matches: { neurons: new Set(), heads: new Set() }, byId: false, terms: [], layer };
    if (data?.model !== lens.modelId) return null;
    return findWords(text, lens.model, index, lens.heads, data.file, foreign ? translation.terms : null);
  });
  const results = $derived(found?.results ?? []);
  const counts = $derived({ neurons: results.filter((r) => r.unit === "neurons").length, heads: results.filter((r) => r.unit === "heads").length });
  const kept = $derived(kind === "all" ? results : results.filter((r) => r.unit === kind));
  const settled = $derived(found !== null || failed);
  // A new query starts at the top, with every kind and the first ten.
  $effect(() => { void asked; untrack(() => { limit = SHOWN; kind = "all"; }); });

  /** What the list holds: the layer an "L8" names, the results, or with an empty field the recent searches. */
  type Row = { kind: "layer"; layer: number } | { kind: "unit"; r: Result } | { kind: "recent"; text: string };
  const rows = $derived.by<Row[]>(() => {
    if (!query.trim()) return recent.map((text) => ({ kind: "recent" as const, text }));
    const out: Row[] = [];
    if (found?.layer !== undefined) out.push({ kind: "layer", layer: found.layer });
    for (const r of kept.slice(0, limit)) out.push({ kind: "unit", r });
    return out;
  });

  // Every match lights up across the explorer while the query has any; none once it clears.
  $effect(() => {
    const matches = found?.matches ?? null;
    untrack(() => {
      active = rows.length && (matches || found?.layer !== undefined) ? 0 : -1;
      const empty = !lens.matches.neurons.size && !lens.matches.heads.size;
      if (!matches) { if (!empty) lens.matches = { neurons: new Set(), heads: new Set() }; return; }
      if (empty && !matches.neurons.size && !matches.heads.size) return;
      lens.matches = { ...matches, from: results[0]?.layer };
    });
  });

  const recentShown = $derived(open && !query.trim() && recent.length > 0);
  const waiting = $derived(asked.trim() !== "" && !settled && loading);
  const panel = $derived(recentShown || (open && query.trim() !== "" && asked.trim() !== "" && (settled || waiting)));
  // The result looked at, picked out on the atlas; nothing once the panel closes.
  $effect(() => {
    const row = panel && active >= 0 ? rows[active] : undefined;
    const next = row?.kind === "unit" ? { unit: row.r.unit, layer: row.r.layer, index: row.r.index } : row?.kind === "layer" ? { unit: lens.unit, layer: row.layer, index: -1 } : null;
    untrack(() => {
      const was = lens.peek;
      if (was?.unit === next?.unit && was?.layer === next?.layer && was?.index === next?.index) return;
      lens.peek = next;
    });
  });
  $effect(() => () => { lens.peek = null; });
  // A result looked at for a moment (not just passed over): its unit's detail and its layer's list, ahead of a choice.
  $effect(() => {
    const row = panel && active >= 0 ? rows[active] : undefined;
    if (row?.kind !== "unit") return;
    const { unit, layer, index } = row.r;
    const model = lens.modelId;
    const wait = setTimeout(() => {
      const quiet = () => {};
      if (unit === "heads") loadHeadLayer(model, layer).catch(quiet);
      else { loadNeuron(model, layer, index).catch(quiet); loadLayerIndex(model, layer).catch(quiet); }
    }, 180);
    return () => clearTimeout(wait);
  });
  /** The rows glide to a new order (instantly under reduced motion). */
  const move = (node: Element, places: { from: DOMRect; to: DOMRect }) => flip(node, places, { duration: reducedMotion() ? 0 : GLIDE, easing: ease });
  // The sliding wash under the chosen row is placed from where rows are as they start to glide: place it again once they land.
  $effect(() => {
    void rows;
    const node = list;
    if (!node) return;
    const settle = setTimeout(() => node.toggleAttribute("data-landed"), GLIDE + 20);
    return () => clearTimeout(settle);
  });

  const status = $derived(
    !asked.trim() || !settled ? ""
    : failed && !found ? "Search didn't load."
    : found?.layer !== undefined ? `Layer ${found.layer}.`
    : !results.length ? `No match for “${asked.trim()}”.${found?.suggestion ? ` Did you mean ${found.suggestion}?` : ""}`
    : results.length === 1 ? "1 match." : `${results.length} matches.`,
  );

  function changed() {
    open = true;
    clearTimeout(timer);
    if (!query.trim()) { asked = ""; return; }
    warm();
    timer = setTimeout(() => (asked = query), 70);
  }

  function clear() {
    clearTimeout(timer);
    query = asked = "";
    open = false;
    input?.focus();
  }

  function idOf(r: Result) { return r.unit === "heads" ? headId(r.layer, r.index) : neuronId(r.layer, r.index); }
  const hrefOf = (r: Result) => lens.unitHref(r.unit, r.layer, r.index);

  // ---------- recent searches: kept in this browser only, and gone without complaint where storage is off

  function readRecent(): string[] {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      return Array.isArray(stored) ? stored.filter((x): x is string => typeof x === "string").slice(0, RECENT) : [];
    } catch { return []; }
  }
  function writeRecent(list: string[]) {
    recent = list;
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage off: this visit only */ }
  }
  function remember(text: string) {
    const t = text.trim();
    if (!t) return;
    writeRecent([t, ...recent.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT));
  }
  function forget(text: string) {
    writeRecent(recent.filter((x) => x !== text));
    input?.focus();
  }
  onMount(() => { recent = readRecent(); });

  /** Bring the layer's panes into view if they aren't, aiming for where they'll be once the panel has closed. */
  function reveal() {
    const shrink = panelNode?.offsetHeight ?? 0;
    open = false;
    requestAnimationFrame(() => {
      const panes = document.getElementById("layer");
      if (!panes) return;
      const margin = parseFloat(getComputedStyle(panes).scrollMarginTop) || 0;
      const top = panes.getBoundingClientRect().top - shrink;
      if (top >= margin && top < window.innerHeight * 0.4) return;
      window.scrollTo({ top: window.scrollY + top - margin, behavior: reducedMotion() ? "auto" : "smooth" });
    });
  }
  /** Open a unit, then bring its layer's panes into view. */
  function choose(r: Result) {
    remember(query);
    lens.open(r.unit, r.layer, r.index);
    reveal();
  }
  function pick(row: Row, event?: MouseEvent) {
    if (row.kind === "recent") { run(row.text); return; }
    if (row.kind === "layer") { remember(query); lens.setLayer(row.layer); reveal(); return; }
    // ⌘/ctrl/shift-click: a new tab, the list left as it is.
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey)) { window.open(hrefOf(row.r), "_blank", "noopener"); return; }
    choose(row.r);
  }
  /** Search for this at once (a recent search, a suggestion, an example). */
  function run(text: string) {
    clearTimeout(timer);
    query = asked = text;
    open = true;
    warm();
    if (!matchMedia("(pointer: coarse)").matches) input?.focus({ preventScroll: true });
  }

  function key(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) { open = true; return; }
      if (rows.length) active = Math.min(rows.length - 1, active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length) active = Math.max(0, active - 1);
    } else if (event.key === "Home" && panel && rows.length && event.ctrlKey) {
      event.preventDefault();
      active = 0;
    } else if (event.key === "End" && panel && rows.length && event.ctrlKey) {
      event.preventDefault();
      active = rows.length - 1;
    } else if (event.key === "Enter") {
      // An ID opens at once, without waiting for the list.
      const ref = parseRef(query, lens.model);
      if (ref) { event.preventDefault(); choose({ ...ref, side: ref.unit === "heads" ? 2 : 0, title: "", matched: "", score: 1 }); return; }
      if (panel && rows[active]) {
        event.preventDefault();
        const row = rows[active];
        if ((event.metaKey || event.ctrlKey) && row.kind === "unit") window.open(hrefOf(row.r), "_blank", "noopener");
        else pick(row);
      }
    } else if (event.key === "Escape") {
      if (panel) { event.preventDefault(); open = false; }
      else if (query) { event.preventDefault(); clear(); }
    }
  }

  function tryExample(text: string) {
    const ref = parseRef(text, lens.model);
    if (ref) { clearTimeout(timer); query = asked = text; choose({ ...ref, side: ref.unit === "heads" ? 2 : 0, title: "", matched: "", score: 1 }); return; }
    run(text);
  }

  // "/" finds the search from anywhere, unless typing somewhere else.
  $effect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      event.preventDefault();
      keyboard = true;
      input?.focus();
      input?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  // A press anywhere else puts the results away (the query and the atlas's matches stay).
  $effect(() => {
    if (!panel) return;
    const away = (event: PointerEvent) => { if (root && !root.contains(event.target as Node)) open = false; };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  });

  // The panel follows its content's height as results come and go.
  let panelNode: HTMLElement | undefined = $state();
  function follow(node: HTMLElement) {
    const inner = node.firstElementChild as HTMLElement;
    let first = true;
    const size = () => {
      if (first) { node.style.transition = "none"; void node.offsetHeight; }
      node.style.height = `${inner.offsetHeight}px`;
      if (first) { void node.offsetHeight; node.style.transition = ""; first = false; }
    };
    const observer = new ResizeObserver(size);
    observer.observe(inner);
    size();
    return { destroy: () => observer.disconnect() };
  }

  // ---------- marking the query in the titles, with the browser's highlights: the titles stay LabelText, whose
  // foreign terms keep their tips, and nothing is wrapped. Where highlights aren't supported, nothing is marked.
  const HIGHLIGHT = "search-terms";
  let list: HTMLElement | undefined = $state();
  const pattern = $derived.by(() => {
    const terms = found?.terms ?? [];
    if (!terms.length) return null;
    const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // A word of three letters or more marks the whole word it begins (a stem marks "animals" from "anim");
    // a shorter one only where it stands alone.
    const long = terms.filter((t) => t.length >= 3).map(escape);
    const short = terms.filter((t) => t.length < 3).map(escape);
    const parts: string[] = [];
    if (long.length) parts.push(`(?:${long.join("|")})[\\p{L}\\p{N}]*`);
    if (short.length) parts.push(`(?<![\\p{L}\\p{N}])(?:${short.join("|")})(?![\\p{L}\\p{N}])`);
    try { return new RegExp(parts.join("|"), "giu"); } catch { return null; }
  });
  $effect(() => {
    const re = pattern;
    const node = list;
    void rows;
    if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
    const highlights = (CSS as unknown as { highlights: Map<string, unknown> }).highlights;
    const Made = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!re || !node || !Made) { highlights.delete(HIGHLIGHT); return; }
    let cancelled = false;
    // After the rows (and their LabelText) are in place.
    void tick().then(() => {
      if (cancelled) return;
      const ranges: Range[] = [];
      for (const title of node.querySelectorAll(".title")) {
        const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
        for (let text = walker.nextNode() as Text | null; text; text = walker.nextNode() as Text | null) {
          re.lastIndex = 0;
          for (const m of text.data.matchAll(re)) {
            if (!m[0]) continue;
            const range = document.createRange();
            range.setStart(text, m.index!);
            range.setEnd(text, m.index! + m[0].length);
            ranges.push(range);
          }
        }
      }
      highlights.set(HIGHLIGHT, new Made(...ranges));
    });
    return () => { cancelled = true; highlights.delete(HIGHLIGHT); };
  });

  const exampleLang = (text: string) => termFor(text)?.[2] || (FOREIGN.test(text) && /\p{Script=Han}/u.test(text) ? "zh" : undefined);
  const matchLang = (text: string) => (FOREIGN.test(text) ? termFor(text)?.[2] || undefined : undefined);
  const last = $derived(lens.model.layers - 1);
  /** The count in the field once the panel is put away, so the lit atlas still says what lit it. */
  const tally = $derived(!panel && asked.trim() && results.length ? (results.length === 1 ? "1 match" : `${results.length.toLocaleString("en-US")} matches`) : "");
  const nearOnly = $derived(results.length > 0 && results.every((r) => r.fuzzy));
</script>

<div class="search" role="search" bind:this={root} onpointerenter={warm}>
  <div class="box" class:keyboard class:open={panel}>
    <div class="field">
      <span class="glass"><Icon name="search" size={18} /></span>
      <input
        bind:this={input}
        bind:value={query}
        type="search"
        role="combobox"
        aria-label="Search neurons and heads"
        aria-autocomplete="list"
        aria-expanded={panel}
        aria-controls={listId}
        aria-activedescendant={panel && active >= 0 && rows[active] ? optionId(active) : undefined}
        placeholder="Search a word, an ID like L33 12225, or a layer like L8"
        autocomplete="off"
        spellcheck="false"
        enterkeyhint="search"
        oninput={changed}
        onpointerdown={() => { pointerDown = true; open = true; }}
        onfocus={() => { keyboard = keyboard || !pointerDown; pointerDown = false; open = true; warm(); }}
        onblur={() => (keyboard = false)}
        onkeydown={key}
      />
      <span class="end">
        {#if tally}<button type="button" class="tally meta" in:swell out:fadeOut onclick={() => { open = true; input?.focus(); }}><MorphText text={tally} /></button>{/if}
        {#if query}
          <button type="button" class="clear" aria-label="Clear the search" in:swell onclick={clear}><Icon name="close" size={16} /></button>
        {:else}
          <kbd aria-hidden="true" in:swell>/</kbd>
        {/if}
      </span>
    </div>
    {#if panel}
      <div class="panel" bind:this={panelNode} use:follow transition:expand>
        <div class="inner">
          {#if recentShown}
            <p class="head meta">Recent</p>
          {:else if counts.neurons && counts.heads && !found?.byId}
            <div class="kinds-wrap" transition:expand>
              <div class="kinds" role="group" aria-label="Show" use:glide>
                {#each [["all", "All", results.length], ["neurons", "Neurons", counts.neurons], ["heads", "Heads", counts.heads]] as const as [value, label, n] (value)}
                  <button type="button" class="kind" aria-pressed={kind === value} onmousedown={(event) => event.preventDefault()} onclick={() => { kind = value; limit = SHOWN; }}>{label} <span class="n"><MorphText text={n.toLocaleString("en-US")} /></span></button>
                {/each}
              </div>
            </div>
          {/if}
          {#if nearOnly && found?.suggestion}
            <p class="near" transition:expand>Close matches for “{asked.trim()}”. Did you mean <button type="button" class="prose-link" onmousedown={(event) => event.preventDefault()} onclick={() => run(found!.suggestion!)}>{found.suggestion}</button>?</p>
          {/if}
          {#if found?.partial && !nearOnly}
            <p class="near" transition:expand>Nothing matches every word of “{asked.trim()}”; these match some.</p>
          {/if}
          {#if waiting}
            <p class="none">Loading the search…</p>
          {:else if rows.length}
            <div class="list" role="listbox" id={listId} aria-label={recentShown ? "Recent searches" : "Matches"} bind:this={list} use:glide>
              {#each rows as row, i (row.kind === "unit" ? `${row.r.unit}:${row.r.layer}:${row.r.index}` : row.kind === "layer" ? `layer:${row.layer}` : `recent:${row.text}`)}
                <div
                  class="option rise"
                  animate:move
                  out:fadeOut
                  class:recent={row.kind === "recent"}
                  role="option"
                  id={optionId(i)}
                  aria-selected={i === active}
                  tabindex="-1"
                  style:--i={i % SHOWN}
                  style:--c={row.kind === "unit" ? depthColor(lens.model, row.r.layer) : row.kind === "layer" ? depthColor(lens.model, row.layer) : undefined}
                  onmousedown={(event) => event.preventDefault()}
                  onpointermove={() => (active = i)}
                  onclick={(event) => pick(row, event)}
                  onauxclick={(event) => { if (event.button === 1 && row.kind === "unit") window.open(hrefOf(row.r), "_blank", "noopener"); }}
                  onkeydown={(event) => { if (event.key === "Enter") pick(row); }}
                >
                  {#if row.kind === "recent"}
                    <span class="id"><Icon name="search" size={14} /></span>
                    <span class="title">{row.text}</span>
                    <button type="button" class="forget" aria-label={`Forget “${row.text}”`} onmousedown={(event) => event.preventDefault()} onclick={(event) => { event.stopPropagation(); forget(row.text); }}><Icon name="close" size={14} /></button>
                  {:else if row.kind === "layer"}
                    <span class="id"><i class="swatch"></i>L{row.layer}</span>
                    <span class="title">Layer {row.layer} <span class="dim">· {bandOf(lens.model, row.layer).name}</span></span>
                    <span class="match"></span>
                    <span class="depth" aria-hidden="true" style:--at={row.layer / Math.max(1, last)}><i></i></span>
                  {:else}
                    {@const r = row.r}
                    <span class="id"><i class="swatch"></i>{idOf(r)}{#if r.side !== 2}{" "}<span class="sign" aria-label={r.side === 0 ? "plus side" : "minus side"}>{r.side === 0 ? "+" : "−"}</span>{/if}</span>
                    <span class="title" class:dim={!r.title}>{#if r.title}<LabelText text={r.title} />{:else}Open{/if}</span>
                    <span class="match" class:fuzzy={r.fuzzy} lang={matchLang(r.matched)}>{#if r.matched}{r.fuzzy ? "≈ " : ""}{r.matched}{/if}</span>
                    <span class="depth" aria-hidden="true" style:--at={r.layer / Math.max(1, last)}><i></i></span>
                  {/if}
                </div>
              {/each}
            </div>
            {#if !recentShown && kept.length > rows.filter((row) => row.kind === "unit").length}
              <div class="foot">
                <span><MorphText text={`${Math.min(limit, kept.length)} of ${kept.length.toLocaleString("en-US")}`} /></span>
                {#if limit < MOST}<button type="button" class="more" onmousedown={(event) => event.preventDefault()} onclick={() => (limit = Math.min(MOST, limit + SHOWN))}>Show {Math.min(SHOWN, kept.length - limit)} more</button>{/if}
              </div>
            {/if}
          {:else}
            <p class="none">
              {#if failed && !found}Search didn't load. <button type="button" class="prose-link" onclick={() => { failed = false; warm(); }}>Try again</button>
              {:else if found?.suggestion}No match for “{asked.trim()}”. Did you mean <button type="button" class="prose-link" onmousedown={(event) => event.preventDefault()} onclick={() => run(found!.suggestion!)}>{found.suggestion}</button>?
              {:else}No match. Try another word, an ID like L33 12225, or a layer like L8.{/if}
            </p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  {#if lens.model.examples.length}
    <p class="try">
      <span>Try</span>
      {#each lens.model.examples as example, i (example)}
        {#if i}<span class="dot" aria-hidden="true">·</span>{/if}<button type="button" class="prose-link" lang={exampleLang(example)} onclick={() => tryExample(example)}>{example}</button>
      {/each}
    </p>
  {/if}
  <p class="sr-only" aria-live="polite">{status}</p>
</div>

<style>
  /* A container, so the results lay out by the width the search has (as wide as the atlas). */
  .search { container: search / inline-size; display: grid; gap: var(--s3); min-width: 0; }
  .box { min-width: 0; border-radius: var(--r-box); background: var(--wash); color: var(--ink3); }
  .box.keyboard:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
  /* The input spans the whole field, so a press anywhere on it lands in the text. */
  .field { position: relative; height: 48px; transition: color var(--fast) var(--ease); }
  .box:focus-within .field { color: var(--ink); }
  .glass { position: absolute; inset: 0 auto 0 var(--s4); display: grid; place-items: center; pointer-events: none; }
  .end { position: absolute; inset: 0 var(--s2) 0 auto; display: flex; align-items: center; gap: var(--s1); pointer-events: none; }
  .end > * { pointer-events: auto; }
  input {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0 160px 0 46px;
    border-radius: var(--r-box);
    border: 0;
    background: transparent;
    color: var(--ink);
    font: var(--type-body);
    text-overflow: ellipsis;
    outline: none;
    appearance: none;
  }
  input::placeholder { color: var(--ink3); opacity: 1; }
  input::-webkit-search-cancel-button, input::-webkit-search-decoration { appearance: none; }
  kbd { display: grid; place-items: center; min-width: 24px; height: 24px; margin-inline-end: var(--s2); pointer-events: none; padding: 0 var(--s2); border-radius: var(--r-chip); background: var(--paper); color: var(--ink3); font: var(--type-meta); }
  kbd { transition: opacity var(--fast) var(--ease); }
  .box:focus-within kbd { opacity: 0; }
  .tally { height: 28px; padding: 0 var(--s3); border: 0; border-radius: var(--r-pill); background: var(--paper); color: var(--ink2); font-weight: 500; font-variant-numeric: tabular-nums; cursor: pointer; transition: background-color var(--fast) var(--ease), scale var(--fast) var(--ease); }
  .tally:active { scale: 0.97; }
  .clear, .forget {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: var(--r-pill);
    background: transparent;
    color: var(--ink3);
    cursor: pointer;
    transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease), scale var(--fast) var(--ease);
  }
  .forget { width: 28px; height: 28px; margin-block: -6px; }
  .clear:active, .forget:active { scale: 0.94; }
  @media (hover: hover) { .clear:hover, .forget:hover { background: var(--wash2); color: var(--ink); } .tally:hover { color: var(--ink); } }

  .panel { overflow: hidden; transition: height var(--glide) var(--ease); }
  .inner { display: grid; gap: var(--s1); padding: 0 var(--s1) var(--s1); }
  .head { margin: 0; padding: var(--s1) var(--s3) 0; color: var(--ink3); font: var(--type-head); }
  .kinds-wrap { padding: 0 var(--s2); }
  /* The pressed chip's paper slides from one to the next (Ledger's glide), as a segmented control's does. */
  .kinds { --glide-bg: var(--paper); --glide-radius: var(--r-pill); display: flex; flex-wrap: wrap; gap: var(--s1); }
  .kind { height: 28px; padding: 0 var(--s3); border: 0; border-radius: var(--r-pill); background: transparent; color: var(--ink2); font: var(--type-meta); cursor: pointer; transition: background-color var(--fast) var(--ease), color var(--fast) var(--ease), scale var(--fast) var(--ease); }
  .kind .n { color: var(--ink3); font-variant-numeric: tabular-nums; font-weight: 400; }
  .kind[aria-pressed="true"] { color: var(--ink); }
  .kind:active { scale: 0.97; }
  @media (hover: hover) { .kind:hover { color: var(--ink); } }
  .near { margin: 0; padding: var(--s1) var(--s3); color: var(--ink2); font: var(--type-small); }
  .near button, .none button { padding: 0; border: 0; background: transparent; font: inherit; cursor: pointer; }
  .list { --glide-bg: var(--wash2); --glide-radius: var(--r-col); display: grid; }
  /* ID with its depth colour, the title with the query marked, what it matched, and where it sits in depth. */
  .option {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr) minmax(0, max-content) 56px;
    align-items: center;
    gap: var(--s4);
    padding: 10px var(--s3);
    border-radius: var(--r-col);
    color: var(--ink2);
    font: var(--type-small);
    cursor: pointer;
    transition: color var(--fast) var(--ease);
  }
  .option.recent { grid-template-columns: 1.5rem minmax(0, 1fr) auto; }
  .option[aria-selected="true"] { color: var(--ink); }
  .option:active { scale: 0.99; transition: scale var(--fast) var(--ease), color var(--fast) var(--ease); }
  .id { display: inline-flex; align-items: center; gap: var(--s2); color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; white-space: nowrap; transition: color var(--fast) var(--ease); }
  .option[aria-selected="true"] .id { color: var(--ink); }
  .swatch { flex: none; width: 10px; height: 6px; border-radius: 2px; background: var(--c); }
  .sign { color: var(--ink3); font-family: var(--display); font-weight: 600; }
  .title { min-width: 0; overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
  .title :global(.label-text) { overflow-wrap: normal; }
  .title :global(.term) { white-space: nowrap; }
  .title.dim, .dim { color: var(--ink3); font-weight: 400; }
  .match { max-width: 18ch; overflow: hidden; color: var(--ink3); font: var(--type-meta); font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
  .match.fuzzy { font-style: italic; }
  /* Depth: the model's layers as a track, this one's place on it in its colour. */
  .depth { position: relative; height: 4px; border-radius: 2px; background: var(--wash2); }
  .depth i { position: absolute; top: -1px; left: calc(var(--at) * (100% - 8px)); width: 8px; height: 6px; border-radius: 2px; background: var(--c); }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); padding: var(--s1) var(--s3) var(--s2); color: var(--ink3); font: var(--type-meta); font-weight: 400; }
  .more { height: 28px; padding: 0 var(--s3); border: 0; border-radius: var(--r-pill); background: var(--paper); color: var(--ink); font: var(--type-meta); cursor: pointer; transition: scale var(--fast) var(--ease), background-color var(--fast) var(--ease); }
  .more:active { scale: 0.97; }
  .none { margin: 0; padding: var(--s1) var(--s3) var(--s3); color: var(--ink3); font: var(--type-small); }
  /* The query in the titles: the tint's wash, as a selection is. */
  :global(::highlight(search-terms)) { background-color: color-mix(in oklch, var(--tint) 26%, transparent); color: var(--ink); }

  .try { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s2); margin: 0; color: var(--ink3); font: var(--type-small); }
  .try span:first-child { margin-inline-end: var(--s1); }
  .try button { padding: 0; border: 0; background: transparent; font: inherit; cursor: pointer; }
  .dot { color: var(--ink3); }

  /* Narrower: the depth track goes, then what matched; on a phone the title takes a line of its own, two at most. */
  @container search (max-width: 760px) {
    .option { grid-template-columns: 6.5rem minmax(0, 1fr) minmax(0, max-content); }
    .depth { display: none; }
  }
  @container search (max-width: 560px) {
    input { padding-right: 132px; }
    .option { grid-template-columns: minmax(0, 1fr) auto; gap: 2px var(--s3); padding-block: var(--s2); }
    .option.recent { grid-template-columns: 1.5rem minmax(0, 1fr) auto; }
    .option .title { grid-column: 1 / -1; grid-row: 2; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; white-space: normal; }
    .option.recent .title { grid-column: 2; grid-row: 1; display: block; }
    .match { justify-self: end; max-width: 14ch; }
  }
  @media (forced-colors: active) { .option[aria-selected="true"] { outline: 2px solid Highlight; } }
</style>

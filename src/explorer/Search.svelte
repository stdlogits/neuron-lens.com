<script lang="ts">
  import { untrack } from "svelte";
  import { FOREIGN, Icon, LabelText, expand, glide, reducedMotion } from "@stdlogits/ledger";
  import { useLens } from "./lens.svelte";
  import { findId, findWords, type Found, type Result } from "./search/engine";
  import { headId, loadSearch, neuronId, parseRef, type SearchFile } from "../lib/data";
  import { ensureTerms, termFor, translation } from "../lib/translate.svelte";

  // The search under the intro: a word finds the curated neurons' poles and the heads it names, an ID
  // opens its unit. The results open below the field as part of the same wash box, and every match
  // lights up on the atlas and in the list (lens.matches) for as long as the query has them. The
  // search file (about 3 MB) loads on first hover or focus.
  const lens = useLens();
  const SHOWN = 10;

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
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointerDown = false;

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
    if (data?.model !== lens.modelId) return null;
    return findWords(text, lens.model, index, lens.heads, data.file, foreign ? translation.terms : null);
  });
  const results = $derived(found?.results ?? []);
  const shown = $derived(results.slice(0, SHOWN));
  const settled = $derived(found !== null || failed);

  // Every match lights up across the explorer while the query has any; none once it clears.
  $effect(() => {
    const matches = found?.matches ?? null;
    untrack(() => {
      active = matches && results.length ? 0 : -1;
      const empty = !lens.matches.neurons.size && !lens.matches.heads.size;
      if (!matches) { if (!empty) lens.matches = { neurons: new Set(), heads: new Set() }; return; }
      if (empty && !matches.neurons.size && !matches.heads.size) return;
      lens.matches = matches;
    });
  });

  const panel = $derived(open && query.trim() !== "" && asked.trim() !== "" && settled);
  const status = $derived(
    !asked.trim() || !settled ? ""
    : failed && !found ? "Search didn't load."
    : !results.length ? `No match for “${asked.trim()}”.`
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

  /** Open a unit, then bring its layer's panes into view if they aren't. */
  function choose(r: Result) {
    // The panel closes as the page scrolls: aim for where the panes will be once it has.
    const shrink = panelNode?.offsetHeight ?? 0;
    open = false;
    lens.open(r.unit, r.layer, r.index);
    requestAnimationFrame(() => {
      const panes = document.getElementById("layer");
      if (!panes) return;
      const margin = parseFloat(getComputedStyle(panes).scrollMarginTop) || 0;
      const top = panes.getBoundingClientRect().top - shrink;
      if (top >= margin && top < window.innerHeight * 0.4) return;
      window.scrollTo({ top: window.scrollY + top - margin, behavior: reducedMotion() ? "auto" : "smooth" });
    });
  }

  function key(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) { open = true; return; }
      if (shown.length) active = Math.min(shown.length - 1, active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (shown.length) active = Math.max(0, active - 1);
    } else if (event.key === "Enter") {
      // An ID opens at once, without waiting for the list.
      const ref = parseRef(query, lens.model);
      if (ref) { event.preventDefault(); choose({ ...ref, side: ref.unit === "heads" ? 2 : 0, title: "", matched: "", score: 1 }); return; }
      if (panel && shown[active]) { event.preventDefault(); choose(shown[active]); }
    } else if (event.key === "Escape") {
      if (panel) { event.preventDefault(); open = false; }
      else if (query) { event.preventDefault(); clear(); }
    }
  }

  function tryExample(text: string) {
    clearTimeout(timer);
    query = asked = text;
    const ref = parseRef(text, lens.model);
    if (ref) { choose({ ...ref, side: ref.unit === "heads" ? 2 : 0, title: "", matched: "", score: 1 }); return; }
    open = true;
    warm();
    // On a phone, focusing would raise the keyboard over the results.
    if (!matchMedia("(pointer: coarse)").matches) input?.focus({ preventScroll: true });
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

  const exampleLang = (text: string) => termFor(text)?.[2] || (FOREIGN.test(text) && /\p{Script=Han}/u.test(text) ? "zh" : undefined);
  const matchLang = (text: string) => (FOREIGN.test(text) ? termFor(text)?.[2] || undefined : undefined);
</script>

<div class="search" role="search" onpointerenter={warm}>
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
        aria-activedescendant={panel && active >= 0 && shown[active] ? optionId(active) : undefined}
        placeholder="Search a word, or an ID like L33 12225"
        autocomplete="off"
        spellcheck="false"
        enterkeyhint="search"
        oninput={changed}
        onpointerdown={() => (pointerDown = true)}
        onfocus={() => { keyboard = keyboard || !pointerDown; pointerDown = false; open = true; warm(); }}
        onblur={() => (keyboard = false)}
        onkeydown={key}
      />
      <span class="end">
        {#if query}
          <button type="button" class="clear" aria-label="Clear the search" onclick={clear}><Icon name="close" size={16} /></button>
        {:else}
          <kbd aria-hidden="true">/</kbd>
        {/if}
      </span>
    </div>
    {#if panel}
      <div class="panel" bind:this={panelNode} use:follow transition:expand>
        <div class="inner">
          {#if shown.length}
            <div class="list" role="listbox" id={listId} aria-label="Matches" use:glide>
              {#each shown as r, i (`${r.unit}:${r.layer}:${r.index}`)}
                <div
                  class="option rise"
                  role="option"
                  id={optionId(i)}
                  aria-selected={i === active}
                  tabindex="-1"
                  style:--i={i}
                  onmousedown={(event) => event.preventDefault()}
                  onpointermove={() => (active = i)}
                  onclick={() => choose(r)}
                  onkeydown={(event) => { if (event.key === "Enter") choose(r); }}
                >
                  <span class="id">{idOf(r)}</span>
                  <span class="title" class:dim={!r.title}>
                    {#if r.side !== 2}<span class="sign" aria-label={r.side === 0 ? "plus side" : "minus side"}>{r.side === 0 ? "+" : "−"}</span>{/if}
                    {#if r.title}<LabelText text={r.title} />{:else}Open{/if}
                  </span>
                  {#if r.matched}<span class="match" lang={matchLang(r.matched)}>{r.matched}</span>{/if}
                </div>
              {/each}
            </div>
            {#if results.length > shown.length}<p class="foot">Top {shown.length} of {results.length.toLocaleString("en-US")}</p>{/if}
          {:else}
            <p class="none">
              {#if failed && !found}Search didn't load. <button type="button" class="prose-link" onclick={() => { failed = false; warm(); }}>Try again</button>
              {:else}No match. Try another word, or an ID like L33 12225.{/if}
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
  .search { display: grid; gap: var(--s3); min-width: 0; }
  .box { min-width: 0; border-radius: var(--r-box); background: var(--wash); color: var(--ink3); }
  .box.keyboard:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
  /* The input spans the whole field, so a press anywhere on it lands in the text. */
  .field { position: relative; height: 48px; transition: color var(--fast) var(--ease); }
  .box:focus-within .field { color: var(--ink); }
  .glass { position: absolute; inset: 0 auto 0 var(--s4); display: grid; place-items: center; pointer-events: none; }
  .end { position: absolute; inset: 0 var(--s2) 0 auto; display: grid; place-items: center; pointer-events: none; }
  .end > * { pointer-events: auto; }
  input {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0 48px 0 46px;
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
  .clear {
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
  .clear:active { scale: 0.97; }
  @media (hover: hover) { .clear:hover { background: var(--wash2); color: var(--ink); } }

  .panel { overflow: hidden; transition: height var(--glide) var(--ease); }
  .inner { padding: 0 var(--s1) var(--s1); }
  .list { --glide-bg: var(--wash2); --glide-radius: var(--r-col); display: grid; }
  .option {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr) auto;
    align-items: baseline;
    gap: var(--s3);
    padding: 10px var(--s3);
    border-radius: var(--r-col);
    color: var(--ink2);
    font: var(--type-small);
    cursor: pointer;
    transition: color var(--fast) var(--ease);
  }
  .option[aria-selected="true"] { color: var(--ink); }
  .id { color: var(--ink3); font: var(--type-meta); font-variant-numeric: tabular-nums; white-space: nowrap; transition: color var(--fast) var(--ease); }
  .option[aria-selected="true"] .id { color: var(--ink); }
  .title { min-width: 0; overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
  .title :global(.label-text) { overflow-wrap: normal; }
  .title :global(.term) { white-space: nowrap; }
  .title.dim { color: var(--ink3); font-weight: 400; }
  .sign { display: inline-block; width: 1.25ch; margin-inline-end: var(--s1); color: var(--ink3); font-family: var(--display); font-weight: 600; }
  .match { max-width: 12ch; overflow: hidden; color: var(--ink3); font: var(--type-meta); text-overflow: ellipsis; white-space: nowrap; }
  .foot, .none { margin: 0; padding: var(--s2) var(--s3) var(--s3); color: var(--ink3); font: var(--type-meta); }
  .none { font: var(--type-small); padding-block: var(--s1) var(--s3); }

  .try { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--s1) var(--s2); margin: 0; color: var(--ink3); font: var(--type-small); }
  .try span:first-child { margin-inline-end: var(--s1); }
  .try button { padding: 0; border: 0; background: transparent; font: inherit; cursor: pointer; }
  .dot { color: var(--ink3); }

  @media (max-width: 560px) {
    .option { grid-template-columns: minmax(0, 1fr); gap: 0; padding-block: var(--s2); }
    .title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; white-space: normal; }
    .match { display: none; }
  }
  @media (forced-colors: active) { .option[aria-selected="true"] { outline: 2px solid Highlight; } }
</style>

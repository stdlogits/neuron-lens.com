<script lang="ts" module>
  export interface FaceRow { sign: string; name: string; cells: { label: string; confidence: number }[] }
</script>

<script lang="ts">
  import { LabelText, Swap, glide } from "@stdlogits/ledger";
  import LabelCell from "./LabelCell.svelte";

  // The faces table: a sign column, then one column per label ("Fires on", "Writes"; heads add
  // "Attends to"). A neuron's two sides are tabs, the chosen one on a wash that glides between them;
  // a head's single row simply sits on the wash. Labels are Haiku's: its note on the chosen row
  // beneath, crossfading as the row changes, then the credit.
  let { columns, rows, selected = $bindable(0), labelled = true, note = "", panel }: {
    columns: string[];
    rows: FaceRow[];
    selected?: number;
    labelled?: boolean;
    /** The labeller's note on the chosen row. */
    note?: string;
    /** The tab panel the rows control, when they are tabs. */
    panel?: string;
  } = $props();

  const tabs = $derived(rows.length > 1);
  const id = $props.id();

  // Arrow keys move between the sides (the APG tabs pattern, selection following focus).
  function key(event: KeyboardEvent) {
    const last = rows.length - 1;
    const to = { ArrowDown: selected + 1, ArrowRight: selected + 1, ArrowUp: selected - 1, ArrowLeft: selected - 1, Home: 0, End: last }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    selected = (to + rows.length) % rows.length;
    document.getElementById(`${id}-${selected}`)?.focus();
  }
</script>

<div class="faces-wrap">
  <div class="faces" style:--cols={columns.length} role={tabs ? "tablist" : undefined} aria-label={tabs ? "Side" : undefined} aria-orientation={tabs ? "vertical" : undefined} use:glide>
    <span class="corner" aria-hidden="true"></span>
    {#each columns as column (column)}<span class="th head" aria-hidden="true">{column}</span>{/each}
    {#each rows as row, i (i)}
      {#if tabs}
        <button type="button" class="face tab" role="tab" id={`${id}-${i}`} aria-selected={selected === i} aria-controls={panel} tabindex={selected === i ? 0 : -1} onclick={() => (selected = i)} onkeydown={key}>
          <span class="sign" aria-hidden="true">{row.sign}</span><span class="sr-only">{row.name}. </span>
          {#each row.cells as cell, j (j)}<LabelCell label={cell.label} confidence={cell.confidence} column={columns[j]} />{/each}
        </button>
      {:else}
        <div class="face still">
          <span class="sign" aria-hidden="true">{row.sign}</span>
          {#each row.cells as cell, j (j)}<LabelCell label={cell.label} confidence={cell.confidence} column={columns[j]} interactive />{/each}
        </div>
      {/if}
    {/each}
  </div>
  {#if labelled}
    <div class="byline">
      <Swap key={note}>{#if note}<p class="note"><LabelText text={note} interactive /></p>{/if}</Swap>
      <p class="meta">Labels by Claude Haiku 5.5</p>
    </div>
  {/if}
</div>

<style>
  .faces-wrap { display: grid; gap: var(--s2); min-width: 0; }
  .faces {
    --glide-bg: var(--wash);
    --glide-radius: var(--r-row);
    display: grid;
    grid-template-columns: 32px repeat(var(--cols), minmax(0, 1fr));
    column-gap: var(--s5);
    min-width: 0;
  }
  .th { padding-bottom: var(--s1); }
  .face {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: subgrid;
    align-items: start;
    margin: 0;
    padding: var(--s4) 0;
    border: 0;
    border-radius: var(--r-row);
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: start;
    transition: background-color var(--fast) var(--ease);
  }
  .tab { cursor: pointer; }
  .tab:active { scale: 0.995; }
  @media (hover: hover) { .tab[aria-selected="false"]:hover { background: var(--wash); } }
  .still { background: var(--wash); }
  .sign { justify-self: center; font: var(--type-lead); font-family: var(--display); font-weight: 600; }
  .byline { display: grid; gap: var(--s1); padding-left: calc(32px + var(--s5)); }
  .byline > .meta { font-weight: 400; }
  .note { color: var(--ink2); font: var(--type-small); text-wrap: pretty; }
  @container unit (max-width: 600px) {
    .faces { grid-template-columns: 32px minmax(0, 1fr); column-gap: var(--s2); }
    .th { display: none; }
    .face { grid-template-columns: 32px minmax(0, 1fr); row-gap: var(--s4); padding-right: var(--s4); }
    .face > :global(.lab) { grid-column: 2; }
    .face > .sign { grid-row: 1; }
    .byline { padding-left: calc(32px + var(--s2)); }
  }
  @media (forced-colors: active) { .tab[aria-selected="true"] { outline: 2px solid Highlight; } }
</style>

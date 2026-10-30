<script lang="ts">
  import type { HeadDetail, HeadMedia } from "../../lib/data";
  import { MODALITY_NAMES, type Modality } from "../../lib/models";

  // A Gemma 4 head in image and sound contexts (findings §16), from 64 images and 64 sounds each
  // followed by its label: how much it reads the image or sound, whether zeroing it costs the model
  // the label, and whether what it writes names the label. Notable values stand in ink.
  let { head }: { head: HeadDetail } = $props();
  const uid = $props.id();

  const ROWS: { modality: Modality; name: string; tip?: string }[] = [
    { modality: "image", name: "Images" },
    { modality: "audio", name: "Sound", tip: "The model tells sounds apart far less well than images, so these scores say little." },
  ];
  const rows = $derived(ROWS.filter((row) => head.media?.[row.modality]));

  const fixed = (v: number | null, digits = 2) => (v === null ? "–" : v < 0 ? `−${Math.abs(v).toFixed(digits)}` : v.toFixed(digits));
  const qText = (q: number) => (q < 0.001 ? "q < 0.001" : `q ${Number(q.toPrecision(2))}`);

  interface Cell { text: string; on: boolean; tip?: string }
  function cells(modality: Modality, m: HeadMedia): Cell[] {
    const names = MODALITY_NAMES[modality];
    const within = m.within === null ? "" : ` Within the ${names.noun}, each slot gives ${fixed(m.within)} of its attention to the others${m.nbr === null ? "" : `, ${fixed(m.nbr)} to its neighbours`}.`;
    const names_ok = m.writeQ !== null && m.writeQ <= 0.05;
    return [
      { text: m.read === null ? "–" : `${fixed(m.read)}×`, on: (m.read ?? 0) > 1, tip: within.trim() || undefined },
      { text: m.content === null ? "–" : `z ${fixed(m.content, 1)}`, on: (m.content ?? 0) > 3 },
      { text: m.write === null ? "–" : names_ok ? `${fixed(m.write)}  ${qText(m.writeQ!)}` : fixed(m.write), on: names_ok },
    ];
  }

  const COLUMNS = [
    { name: "Reads it", tip: "Attention from the text after it to its slots, as a multiple of an even spread over everything before. Past 1×, it looks at the image or sound more than at the rest." },
    { name: "Carries it", tip: "Zeroing the head, how much worse the model tells the right label from another's, as a z over 64 examples. Past 3 is notable." },
    { name: "Names it", tip: "At the word after it, the right label's mean percentile among all labels in what the head writes (0.5 is chance), with its q over all heads. Notable at q ≤ 0.05." },
  ];
</script>

{#if rows.length}
  <section class="media" aria-labelledby={`${uid}-title`}>
    <h3 class="head" id={`${uid}-title`}>In images and sound</h3>
    <table>
      <thead>
        <tr><td></td>{#each COLUMNS as column (column.name)}<th scope="col" data-tip={column.tip}>{column.name}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each rows as row (row.modality)}
          <tr>
            <th scope="row" data-tip={row.tip}>{row.name}</th>
            {#each cells(row.modality, head.media![row.modality]) as cell, i (i)}
              <td class:on={cell.on} data-tip={cell.tip}>{cell.text}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

<style>
  .media { display: grid; gap: var(--s4); min-width: 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead td { width: 96px; }
  th, td { padding: var(--s1) 0; text-align: start; vertical-align: baseline; }
  :is(th, td):not(:first-child) { padding-inline-start: var(--s5); }
  thead th { color: var(--ink3); font: var(--type-meta); cursor: help; }
  tbody th { color: var(--ink2); font: var(--type-small); }
  tbody th[data-tip] { cursor: help; }
  td { color: var(--ink3); font: var(--type-small); font-variant-numeric: tabular-nums; white-space: pre-wrap; transition: color var(--fast) var(--ease); }
  td.on { color: var(--ink); font-weight: 500; }
  td[data-tip] { cursor: help; }
  @media (max-width: 480px) {
    thead td { width: 64px; }
    :is(th, td):not(:first-child) { padding-inline-start: var(--s3); }
  }
</style>

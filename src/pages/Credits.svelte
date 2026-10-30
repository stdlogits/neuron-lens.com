<script lang="ts">
  import "./pages.css";
  import { onMount } from "svelte";
  import { reveal } from "./reveal";
  import { loadMediaCredits, type MediaCredits } from "../lib/data";
  import { MODELS } from "../lib/models";

  // Who made Neuron Lens and what it stands on, as a ledger: each line a name, who or what it is,
  // and its licence. The image and sound collections come from the catalog's own credits file, so
  // the list stays with what is actually shown.
  interface Link { text: string; href?: string }
  interface Line { name: Link; detail: Link[]; licence?: Link }
  interface Group { id: string; title: string; lines: Line[]; note?: string }

  function ext(text: string, href: string | undefined = undefined): Link { return { text, href }; }

  /** A Creative Commons licence by its short name, linked to its deed; anything else as written. */
  function licence(name: string): Link {
    const cc = name.match(/^CC (BY(?:-[A-Z]{2})*) (\d\.\d)$/);
    if (cc) return ext(name, `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`);
    if (name === "CC0 1.0") return ext(name, "https://creativecommons.org/publicdomain/zero/1.0/");
    if (name === "MIT") return ext(name, "https://opensource.org/license/mit");
    return ext(name);
  }

  const people: Group = {
    id: "people",
    title: "Made by",
    lines: [
      { name: ext("a9lim"), detail: [ext("@_a9lim", "https://x.com/_a9lim"), ext("a9l.im", "https://a9l.im")] },
      { name: ext("treetown"), detail: [ext("@treetowntree", "https://x.com/treetowntree"), ext("logits.ml", "https://logits.ml")] },
      { name: ext("Claude"), detail: [ext("Anthropic", "https://www.anthropic.com")] },
    ],
    note: "Labels and translations by Claude Haiku 5.5.",
  };

  const models: Group = {
    id: "models",
    title: "Models studied",
    lines: [
      { name: ext(MODELS["qwen3-8b"].name, "https://huggingface.co/Qwen/Qwen3-8B"), detail: [ext("Qwen team, Alibaba Cloud")], licence: ext("Apache 2.0", "https://www.apache.org/licenses/LICENSE-2.0") },
      { name: ext(MODELS["gemma-4-12b"].name, "https://ai.google.dev/gemma"), detail: [ext("Google")], licence: ext("Gemma Terms of Use", "https://ai.google.dev/gemma/terms") },
    ],
    note: "Gemma is provided under and subject to the Gemma Terms of Use found at ai.google.dev/gemma/terms.",
  };

  const software: Group = {
    id: "software",
    title: "Software and type",
    lines: [
      { name: ext("Svelte", "https://svelte.dev"), detail: [ext("Svelte contributors")], licence: licence("MIT") },
      { name: ext("Vite", "https://vite.dev"), detail: [ext("Vite contributors")], licence: licence("MIT") },
      { name: ext("Torph", "https://torph.lochie.me"), detail: [ext("Lochie Axon, for text that morphs")], licence: licence("MIT") },
      { name: ext("Wix Madefor", "https://github.com/wix/wixmadefor"), detail: [ext("The Wix Madefor Project Authors")], licence: ext("SIL OFL 1.1", "https://openfontlicense.org") },
    ],
  };

  const site: Group = {
    id: "site",
    title: "This site",
    lines: [
      { name: ext("Source", "https://github.com/stdlogits/neuron-lens.com"), detail: [ext("stdlogits/neuron-lens.com", "https://github.com/stdlogits/neuron-lens.com")], licence: ext("AGPL-3.0", "https://www.gnu.org/licenses/agpl-3.0.html") },
      { name: ext("Drowse", "https://drowse.ai"), detail: [ext("Neuron Lens is part of Drowse")] },
    ],
  };

  let media = $state<MediaCredits | null>(null);
  let mediaFailed = $state(false);
  onMount(() => { loadMediaCredits("gemma-4-12b").then((credits) => (media = credits), () => (mediaFailed = true)); });

  const collections = (kind: "image" | "audio"): Line[] =>
    Object.values(media?.[kind] ?? {}).map((c) => ({ name: ext(c.name), detail: [ext(c.credit)], licence: licence(c.license) }));

  const groups = $derived<Group[]>([
    people,
    models,
    ...(media ? [
      { id: "images", title: "Images", lines: collections("image") },
      { id: "sounds", title: "Sounds", lines: collections("audio"), note: "Images and sounds from other collections are linked to their sources, never hosted here." },
    ] : []),
    software,
    site,
  ]);

  $effect(() => { document.title = "Credits · Neuron Lens"; });
</script>

{#snippet link(item: Link)}{#if item.href}<a href={item.href} rel="external noreferrer">{item.text}</a>{:else}{item.text}{/if}{/snippet}

<article class="pg">
  <header class="pg-hero" use:reveal>
    <h1>Credits</h1>
  </header>

  <div class="ledger">
    {#each groups as group (group.id)}
      <section class="group" aria-labelledby="credits-{group.id}" use:reveal>
        <h2 id="credits-{group.id}">{group.title}{#if group.id === "images" || group.id === "sounds"}<span class="count num">{group.lines.length}</span>{/if}</h2>
        <ul use:reveal>
          {#each group.lines as line (line.name.text)}
            <li>
              <span class="name">{@render link(line.name)}</span>
              <span class="detail">{#each line.detail as part, i (part.text)}{#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}{@render link(part)}{/each}</span>
              <span class="licence">{#if line.licence}{@render link(line.licence)}{/if}</span>
            </li>
          {/each}
        </ul>
        {#if group.note}<p class="note">{group.note}</p>{/if}
      </section>
    {/each}
    {#if mediaFailed}<p class="note missing">The list of image and sound collections didn't load. Reload to try again.</p>{/if}
  </div>
</article>

<style>
  .ledger {
    display: grid;
    grid-template-columns: minmax(0, 300px) minmax(0, 1fr) minmax(0, 1.4fr) auto;
    column-gap: var(--s7);
    row-gap: var(--s8);
    min-width: 0;
  }
  .group, ul, li { display: grid; grid-template-columns: subgrid; }
  .group { grid-column: 1 / -1; row-gap: var(--s3); align-items: start; }
  h2 { grid-column: 1; grid-row: 1 / span 3; display: flex; align-items: baseline; gap: var(--s2); font: var(--type-label); }
  .count { color: var(--ink3); font: var(--type-meta); }
  ul { grid-column: 2 / -1; row-gap: var(--s3); }
  li { grid-column: 1 / -1; align-items: baseline; column-gap: var(--s5); }
  .name { color: var(--ink); font: var(--type-body); }
  .detail { color: var(--ink2); font: var(--type-small); }
  .licence { color: var(--ink3); font: var(--type-small); text-align: end; white-space: nowrap; }
  .sep { margin: 0 var(--s2); color: var(--ink3); }
  .note { grid-column: 2 / -1; max-width: 64ch; margin-top: var(--s2); color: var(--ink3); font: var(--type-small); }
  .missing { grid-column: 1 / -1; }
  /* Links read as the text around them, underlined in the softest wash. */
  a { text-decoration: underline; text-decoration-color: var(--wash2); text-decoration-thickness: 2px; text-underline-offset: 4px; transition: color var(--fast) var(--ease), text-decoration-color var(--fast) var(--ease); }
  @media (hover: hover) { a:hover { color: var(--ink); text-decoration-color: var(--ink3); } }
  @media (max-width: 900px) {
    .ledger { grid-template-columns: minmax(0, 1fr) auto; row-gap: var(--s7); }
    h2 { grid-column: 1 / -1; grid-row: auto; margin-bottom: var(--s1); }
    ul { grid-column: 1 / -1; row-gap: var(--s4); }
    li { row-gap: 2px; }
    .name { grid-column: 1; grid-row: 1; }
    .licence { grid-column: 2; grid-row: 1; }
    .detail { grid-column: 1 / -1; grid-row: 2; }
    .note { grid-column: 1 / -1; }
  }
</style>

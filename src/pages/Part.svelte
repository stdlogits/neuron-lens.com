<script lang="ts">
  import type { Snippet } from "svelte";
  import { near, reveal } from "./reveal";

  // One part of a reading page: its title and a few words on the left, what it is about on the
  // right. Both rise into place as the part comes into view; `onnear` fires a little before that.
  let { id, title, caption, children, onnear, tint }: {
    id: string;
    /** The specimen's place on the depth ramp, so the caption's swatches match it. */
    tint?: string;
    title: string;
    caption?: Snippet;
    children: Snippet;
    onnear?: () => void;
  } = $props();
</script>

<section class="pg-part" aria-labelledby={id} style:--tint={tint} use:near={() => onnear?.()}>
  <div class="pg-cap" use:reveal>
    <h2 {id}>{title}</h2>
    {@render caption?.()}
  </div>
  <div class="pg-body" use:reveal>
    {@render children()}
  </div>
</section>

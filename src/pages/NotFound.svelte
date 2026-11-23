<script lang="ts">
  import "./pages.css";
  import "./missing/missing.css";
  import { router } from "../lib/router.svelte";
  import Absent from "./missing/Absent.svelte";
  import Models from "./missing/Models.svelte";
  import Layers from "./missing/Layers.svelte";
  import Neurons from "./missing/Neurons.svelte";
  import Heads from "./missing/Heads.svelte";

  // An address with no page shows what is wrong with it, as the router found it (lib/missing.ts): a page it can't read
  // gets the 404 neurons; a model the site doesn't have, the nearest models, ranked; a layer, neuron or head past the
  // model's shape, a ride along that axis into the part that isn't there. Each plays once and lands on the address.
  const why = $derived(router.route.page === "missing" ? router.route.why : { kind: "page" as const, parts: [] });

  $effect(() => { document.title = "Not found · Neuron Lens"; });
</script>

<article class="pg missing">
  {#key why}
    {#if why.kind === "model"}
      <Models typed={why.typed} rest={why.rest} />
    {:else if why.kind === "layer"}
      <Layers id={why.model} asked={why.asked} rest={why.rest} />
    {:else if why.kind === "neuron"}
      <Neurons id={why.model} layer={why.layer} asked={why.asked} />
    {:else if why.kind === "head"}
      <Heads id={why.model} layer={why.layer} asked={why.asked} />
    {:else}
      <Absent parts={why.parts} />
    {/if}
  {/key}
</article>

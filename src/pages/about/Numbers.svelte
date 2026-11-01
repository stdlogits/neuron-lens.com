<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import { Swap } from "@stdlogits/ledger";
  import HeadFigures from "../../explorer/unit/HeadFigures.svelte";
  import { ROLES, describeRole, loadHeadLayer, type HeadDetail } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { INDUCTION } from "./specimens";

  // The last of a unit, as the explorer draws it: the induction head's figures, then every role a head
  // can be named for, its own lit.
  const model = MODELS[INDUCTION.model];
  let head = $state<HeadDetail | null>(null);
  let groupSize = $state(1);
  let failed = $state(false);
  const load = () => loadHeadLayer(INDUCTION.model, INDUCTION.layer).then((list) => {
    head = list.find((h) => h.h === INDUCTION.h) ?? null;
    groupSize = head ? list.filter((h) => h.kv === head!.kv).length : 1;
    failed = !head;
  }, () => (failed = true));
</script>

<Part id="numbers" title="Numbers" onnear={load} tint={depthColor(model, INDUCTION.layer)}>
  {#snippet caption()}
    <p>Finally, its numbers: how often a unit fires, in each kind of text, along with how hard.</p>
  {/snippet}
  <div class="spec">
    <UnitLink model={INDUCTION.model} layer={INDUCTION.layer} head={INDUCTION.h} />
    <Swap key={head !== null}>
      {#if head}
        <div class="body">
          <div class="pg-unit"><HeadFigures {head} {model} {groupSize} /></div>
          <div class="roles">
            <h3 class="head">Roles</h3>
            <ul>
              {#each ROLES as role (role.bit)}
                {@const own = (head.roles & role.bit) !== 0}
                <li><button type="button" class="role" class:own data-tip-title={role.name} data-tip={describeRole(role, model)}>{role.short}{#if own}<span class="sr-only"> (this head)</span>{/if}</button></li>
              {/each}
            </ul>
          </div>
        </div>
      {:else}
        <div class="body">{#if failed}<p class="meta">This specimen didn't load.</p>{:else}<span class="ghost"></span>{/if}</div>
      {/if}
    </Swap>
  </div>
</Part>

<style>
  .spec { display: grid; gap: var(--s4); min-width: 0; }
  .body { display: grid; gap: var(--s6); min-width: 0; }
  .roles { display: grid; align-content: start; gap: var(--s3); min-width: 0; }
  ul { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); }
  .role { display: inline-block; margin: 0; padding: 0; border: 0; background: transparent; color: var(--ink3); font: var(--type-small); cursor: help; transition: color var(--fast) var(--ease); }
  .role.own { padding: 0 var(--s2); border-radius: var(--r-chip); background: color-mix(in oklch, var(--tint) 14%, var(--paper)); color: var(--ink); font-weight: 500; }
  @media (hover: hover) { .role:hover { color: var(--ink); } }
  .ghost { display: block; height: 200px; border-radius: var(--r-row); background: var(--wash); }
</style>

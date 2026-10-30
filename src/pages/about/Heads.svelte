<script lang="ts">
  import Part from "../Part.svelte";
  import UnitLink from "./UnitLink.svelte";
  import Swap from "../../ui/Swap.svelte";
  import Context from "../../ui/Context.svelte";
  import LabelText from "../../ui/LabelText.svelte";
  import { PATTERN_NAMES, PATTERN_THRESHOLDS, ROLES, describeRole, loadHeadLayer, type HeadDetail } from "../../lib/data";
  import { MODELS, depthColor } from "../../lib/models";
  import { INDUCTION } from "./specimens";

  // An attention head: its three labels, one firing with the token it looked at, where it looks on
  // repeated text, and the roles that names it (among all the roles a head can have).
  const model = MODELS[INDUCTION.model];
  let head = $state<HeadDetail | null>(null);
  let failed = $state(false);
  const load = () => loadHeadLayer(INDUCTION.model, INDUCTION.layer).then((list) => { head = list.find((h) => h.h === INDUCTION.h) ?? null; failed = !head; }, () => (failed = true));

  const labels = $derived(head ? [
    { head: "Fires on", text: head.label.fires, conf: head.label.fc },
    { head: "Attends to", text: head.label.attends, conf: head.label.ac },
    { head: "Writes", text: head.label.writes, conf: head.label.wc },
  ] : []);
  // The shortest untranslated firing that shows both where it fired and what it looked at.
  const context = $derived(head ? [...head.contexts].filter(([text, en]) => !en && text.includes("⟦") && text.includes("⟪")).sort((a, b) => a[0].length - b[0].length)[0] ?? head.contexts[0] : null);
  const pattern = $derived(head ? PATTERN_NAMES.map((name, i) => ({ name, value: head!.pattern[i], past: head!.pattern[i] >= PATTERN_THRESHOLDS[i], threshold: PATTERN_THRESHOLDS[i] })) : []);
  const confidence = (value: number) => `${Math.round(value * 100)}%`;
</script>

<Part id="heads" title="Heads" onnear={load} tint={depthColor(model, INDUCTION.layer)}>
  {#snippet caption()}
    <p>Where a head looks, and what it carries.</p>
  {/snippet}
  <div class="spec">
    <UnitLink model={INDUCTION.model} layer={INDUCTION.layer} head={INDUCTION.h} />
    <Swap key={head !== null}>
      {#if head}
        <div class="body">
          <div class="labels">
            {#each labels as label (label.head)}
              <div class="lab" class:faint={label.conf < 0.25}>
                <h3 class="head">{label.head}</h3>
                <p><LabelText text={label.text} interactive /></p>
                <p class="meta" data-tip="How sure the labeller was">{confidence(label.conf)}</p>
              </div>
            {/each}
          </div>

          {#if context}
            <div class="where">
              <p class="key meta"><span class="sw hit"></span>fired here<span class="sw src"></span>looked at</p>
              <Context {context} />
            </div>
          {/if}

          <div class="pair">
            <div class="pattern">
              <h3 class="head">Where it looks, on repeated text</h3>
              {#each pattern as row, i (row.name)}
                <p class="row" class:past={row.past} data-tip={`Named past ${row.threshold}`} data-tip-title={row.name}>
                  <span>{row.name}</span>
                  <span class="track"><i style:transform="scaleX({row.value})" style:--d="{i * 24}ms"></i></span>
                  <span class="num">{row.value.toFixed(2)}</span>
                </p>
              {/each}
            </div>
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
  .labels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s4) var(--s5); padding: var(--s5); border-radius: var(--r-row); background: var(--wash); }
  .lab { display: grid; align-content: start; gap: var(--s2); font: var(--type-label); }
  .lab.faint p:not(.meta) { color: var(--ink3); }
  .where { display: grid; gap: var(--s3); }
  .key { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2); }
  .sw { width: 12px; height: 8px; border-radius: 2px; }
  .sw.src { margin-left: var(--s3); background: color-mix(in oklch, var(--tint) 9%, transparent); }
  .sw.hit { background: color-mix(in oklch, var(--tint) 22%, transparent); }
  .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s6) var(--s7); }
  .pattern, .roles { display: grid; align-content: start; gap: var(--s3); min-width: 0; }
  .row { display: grid; grid-template-columns: 88px minmax(0, 1fr) 40px; align-items: center; gap: var(--s3); color: var(--ink3); font: var(--type-small); cursor: help; transition: color var(--fast) var(--ease); }
  .row.past { color: var(--ink); font-weight: 500; }
  .row .num { text-align: end; }
  .track { position: relative; height: 4px; border-radius: 2px; background: var(--wash2); overflow: hidden; }
  .track i { position: absolute; inset: 0; border-radius: 2px; background: color-mix(in oklch, var(--ink3) 50%, transparent); transform-origin: left; }
  .past .track i { background: var(--tint); }
  :global(.rv-in) .track i { animation: fill var(--glide) var(--ease) backwards; animation-delay: var(--d); }
  @keyframes fill { from { transform: scaleX(0); } }
  ul { display: flex; flex-wrap: wrap; gap: var(--s2) var(--s4); }
  .role { display: inline-block; margin: 0; padding: 0; border: 0; background: transparent; color: var(--ink3); font: var(--type-small); cursor: help; transition: color var(--fast) var(--ease); }
  .role.own { padding: 0 var(--s2); border-radius: var(--r-chip); background: color-mix(in oklch, var(--tint) 14%, var(--paper)); color: var(--ink); font-weight: 500; }
  @media (hover: hover) { .role:hover { color: var(--ink); } }
  .ghost { height: 240px; border-radius: var(--r-row); background: var(--wash); }
  @media (max-width: 760px) {
    .labels { grid-template-columns: minmax(0, 1fr); }
    .pair { grid-template-columns: minmax(0, 1fr); }
  }
  @media (prefers-reduced-motion: reduce) { :global(.rv-in) .track i { animation: none; } }
</style>

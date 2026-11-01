<script lang="ts">
  // While a unit loads: the faces table, five firings and two runs of tokens as plain washes. They
  // fade in only after 150 ms, so a quick load never shows them, and they hold still.
  let { columns = 2 }: { columns?: number } = $props();
</script>

<div class="pending" aria-hidden="true" style:--cols={columns}>
  <div class="faces"><i class="row"></i></div>
  <div class="ctx"><i class="h"></i><i class="c"></i><i class="c"></i><i class="c"></i><i class="c"></i><i class="c short"></i></div>
  <div class="ev">
    <span></span>
    {#each { length: columns } as _, i (i)}<div class="col"><i class="h"></i><i class="t"></i><i class="t short"></i></div>{/each}
  </div>
</div>
<p class="sr-only" role="status">Loading</p>

<style>
  .pending { display: grid; gap: var(--s6); min-width: 0; animation: appear var(--in) var(--ease) 150ms backwards; }
  i { display: block; border-radius: var(--r-box); background: var(--wash); }
  .faces .row { height: 152px; border-radius: var(--r-row); }
  .ctx { display: grid; gap: var(--s3); }
  .h { width: 96px; height: 16px; border-radius: var(--r-chip); }
  .c { height: 48px; }
  .c.short { width: 72%; }
  .ev { display: grid; grid-template-columns: 32px repeat(var(--cols), minmax(0, 1fr)); column-gap: var(--s5); }
  .col { display: grid; gap: var(--s2); align-content: start; }
  .t { height: 56px; border-radius: var(--r-chip); }
  .t.short { width: 60%; height: 24px; }
  @keyframes appear { from { opacity: 0; } }
  @container unit (max-width: 600px) {
    .ev { grid-template-columns: minmax(0, 1fr); row-gap: var(--s5); }
    .ev > span { display: none; }
  }
</style>

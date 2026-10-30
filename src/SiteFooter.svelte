<script lang="ts">
  const year = new Date().getFullYear();
</script>

<footer>
  <span>Neuron Lens, by a9lim and Claude</span>
  <nav aria-label="More">
    <a href="/about">About</a>
    <a href="/credits">Credits</a>
    <a href="https://github.com/stdlogits/neuron-lens.com" rel="external noreferrer">Source</a>
    <a href="https://drowse.ai" rel="external noreferrer">Drowse</a>
  </nav>
  <span class="year num">{year}</span>
</footer>

<style>
  footer { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s2) var(--s5); width: 100%; max-width: var(--page); margin: 0 auto; padding: var(--s6) var(--gutter) var(--s7); color: var(--ink3); font: var(--type-small); }
  nav { display: flex; flex-wrap: wrap; gap: var(--s4); }
  a { transition: color var(--fast) var(--ease); }
  @media (hover: hover) { a:hover { color: var(--ink); } }
  .year { margin-left: auto; }
</style>

// Applies a stored light or dark choice before first paint (src/lib/theme.svelte.ts owns it after).
try {
  var mode = localStorage.getItem("neuron-lens.theme");
  if (mode === "light" || mode === "dark") document.documentElement.dataset.theme = mode;
} catch (error) {}

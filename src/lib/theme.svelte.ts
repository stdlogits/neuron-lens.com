// Light or dark. The page follows the system until the viewer picks one; public/theme.js applies a
// stored pick before first paint. Switching cross-fades the whole page (a view transition).
const KEY = "neuron-lens.theme";

type Mode = "light" | "dark";
const system = (): Mode => (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const stored = (): Mode | null => {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
};

export const theme = $state<{ mode: Mode }>({ mode: "light" });

export function startTheme() {
  theme.mode = stored() ?? system();
  const media = matchMedia("(prefers-color-scheme: dark)");
  const follow = () => { if (!stored()) theme.mode = system(); };
  media.addEventListener("change", follow);
  return () => media.removeEventListener("change", follow);
}

export function toggleTheme() {
  const next: Mode = theme.mode === "dark" ? "light" : "dark";
  const set = () => {
    theme.mode = next;
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* storage blocked */ }
  };
  const root = document.documentElement;
  if (typeof document.startViewTransition !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return set();
  root.dataset.vt = "theme";
  document.startViewTransition(set).finished.finally(() => delete root.dataset.vt);
}

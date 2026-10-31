// Auto, light or dark. Auto follows the system and stores nothing; public/theme.js applies a stored
// light or dark before first paint. The button steps auto → the system's opposite → the system's own
// look → auto, so every step but the last changes what the page looks like. A change of look
// cross-fades the whole page (a view transition).
const KEY = "neuron-lens.theme";

type Mode = "light" | "dark";
export type Choice = Mode | "auto";
const dark = () => matchMedia("(prefers-color-scheme: dark)");
const system = (): Mode => (dark().matches ? "dark" : "light");
const stored = (): Mode | null => {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
};

/** `choice` is what the viewer picked, `system` the system's look, `mode` the look the page has. */
export const theme = $state<{ choice: Choice; system: Mode; mode: Mode }>({ choice: "auto", system: "light", mode: "light" });

export function startTheme() {
  theme.choice = stored() ?? "auto";
  theme.system = system();
  theme.mode = theme.choice === "auto" ? theme.system : theme.choice;
  const media = dark();
  const follow = () => {
    theme.system = system();
    if (theme.choice === "auto") theme.mode = theme.system;
  };
  media.addEventListener("change", follow);
  return () => media.removeEventListener("change", follow);
}

/** What the theme button would pick next. */
export function nextTheme(): Choice {
  if (theme.choice === "auto") return theme.system === "dark" ? "light" : "dark";
  return theme.choice === theme.system ? "auto" : theme.system;
}

export function setTheme(choice: Choice) {
  const mode = choice === "auto" ? theme.system : choice;
  const root = document.documentElement;
  const set = () => {
    theme.choice = choice;
    theme.mode = mode;
    if (choice === "auto") delete root.dataset.theme;
    else root.dataset.theme = choice;
    try {
      if (choice === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch { /* storage blocked */ }
  };
  if (mode === theme.mode || typeof document.startViewTransition !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) return set();
  root.dataset.vt = "theme";
  document.startViewTransition(set).finished.finally(() => delete root.dataset.vt);
}

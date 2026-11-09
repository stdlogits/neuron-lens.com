// Which version of each read to show: the normal one, or the distinctive one, scored against the
// layer's other units so that what they all share drops out.
const KEY = "neuron-lens.distinctive";

export const reading = $state({ distinctive: false });

/** The switch remembers its state per viewer; the page works the same without storage. */
export function setDistinctive(on: boolean) {
  reading.distinctive = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* storage blocked */ }
}

export function restoreDistinctive() {
  try { if (localStorage.getItem(KEY) === "1") reading.distinctive = true; } catch { /* storage blocked */ }
}

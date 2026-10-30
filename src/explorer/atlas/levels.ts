// How the atlas shades and places its units. A unit takes one of ten opacities by its rank among
// every unit of its kind in the model, ten equal shares, so each shade is used as often as the others
// and the map shows where in depth the readable units gather. All mode draws every neuron of a layer
// as a cell of its column, in neuron order.

/** The ten opacities, faintest to fullest. */
export const SHADES = [0.1, 0.16, 0.24, 0.32, 0.42, 0.52, 0.62, 0.74, 0.86, 1];
/** A column's height in bars in All mode: as many as the easiest list, so both modes stand the same. */
export const ALL_ROWS = 40;

/** A score's shade (0–9) by its rank among the scores given. */
export function shadeScale(scores: number[]): (score: number) => number {
  const sorted = Float64Array.from(scores).sort();
  return (score) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < score) lo = mid + 1; else hi = mid;
    }
    return sorted.length ? Math.min(9, Math.floor((lo / sorted.length) * 10)) : 0;
  };
}

/** Each readability byte's shade (0–9), by its rank among every neuron of the model. */
export function byteShades(scores: Uint8Array[]): Uint8Array {
  const counts = new Float64Array(256);
  let total = 0;
  for (const layer of scores) {
    for (let i = 0; i < layer.length; i += 1) counts[layer[i]] += 1;
    total += layer.length;
  }
  const shade = new Uint8Array(256);
  for (let v = 0, below = 0; v < 256; v += 1) {
    shade[v] = Math.min(9, Math.floor((below / Math.max(1, total)) * 10));
    below += counts[v];
  }
  return shade;
}

/** A layer of n neurons laid out in a box w × h: g cells a row, r rows, each cw × ch. */
export interface Field { g: number; r: number; cw: number; ch: number }
export function field(n: number, w: number, h: number): Field {
  const side = Math.sqrt((w * h) / Math.max(1, n));
  const g = Math.max(1, Math.floor(w / side));
  const r = Math.ceil(n / g);
  return { g, r, cw: w / g, ch: h / r };
}

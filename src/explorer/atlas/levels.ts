// How the atlas shades its bars. A bar takes one of ten opacities by its unit's rank among every unit
// of its kind in the model, ten equal shares, so each shade is used as often as the others and the
// map shows where in depth the readable units gather. All mode ranks a whole layer instead: each of a
// column's bars stands for a slice of the layer's neurons, most readable first.

/** The ten opacities, faintest to fullest. */
export const SHADES = [0.1, 0.16, 0.24, 0.32, 0.42, 0.52, 0.62, 0.74, 0.86, 1];
/** Bars a column holds in All mode: as many as the easiest list, so both modes stand the same height. */
export const SLICES = 40;

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

/** A layer's neurons ranked by readability. */
export interface Ranked {
  /** The neuron at each rank, most readable first (ties in neuron order). */
  order: Uint16Array;
  /** Each neuron's rank. */
  rank: Uint16Array;
  /** Each slice's shade (0–9), from its mean readability. */
  shades: Uint8Array;
}

/** The ranks [from, to) a slice covers, of a layer of n. */
export const sliceRange = (slice: number, n: number): [number, number] => [Math.floor((slice * n) / SLICES), Math.floor(((slice + 1) * n) / SLICES)];
/** The slice holding a rank: the last whose range starts at or before it. */
export const sliceOf = (rank: number, n: number) => Math.floor(((rank + 1) * SLICES + n - 1) / n) - 1;

/** Ranks every layer from its readability bytes (0–255, one per neuron). */
export function rankLayers(scores: Uint8Array[]): Ranked[] {
  // Shades share out every neuron of the model, as the easiest list's do its own.
  const counts = new Float64Array(256);
  let total = 0;
  for (const layer of scores) {
    for (let i = 0; i < layer.length; i += 1) counts[layer[i]] += 1;
    total += layer.length;
  }
  const shadeOf = new Uint8Array(256);
  for (let v = 0, below = 0; v < 256; v += 1) {
    shadeOf[v] = Math.min(9, Math.floor((below / total) * 10));
    below += counts[v];
  }
  return scores.map((layer) => {
    const n = layer.length;
    // A counting sort, highest byte first.
    const start = new Uint32Array(256);
    for (let i = 0; i < n; i += 1) start[layer[i]] += 1;
    for (let v = 255, at = 0; v >= 0; v -= 1) {
      const count = start[v];
      start[v] = at;
      at += count;
    }
    const order = new Uint16Array(n);
    const rank = new Uint16Array(n);
    for (let i = 0; i < n; i += 1) {
      const r = start[layer[i]]++;
      order[r] = i;
      rank[i] = r;
    }
    const shades = new Uint8Array(SLICES);
    for (let s = 0; s < SLICES; s += 1) {
      const [from, to] = sliceRange(s, n);
      let sum = 0;
      for (let r = from; r < to; r += 1) sum += layer[order[r]];
      shades[s] = shadeOf[Math.round(sum / Math.max(1, to - from))];
    }
    return { order, rank, shades };
  });
}

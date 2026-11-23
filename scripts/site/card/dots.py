"""A figure's render drawn as dots that flow (figures.py calls flow), the way the card shows it."""
import numpy as np
from scipy import ndimage

F = np.float32

# How the dots run, the same for every figure: strands from left to right (the way a signal passes through the layers),
# waving gently, the wave carried on from one figure to the next. `gap` is how far apart strands stand and `step` how far
# apart the dots along one, both in dot pitches: closer along than across, so a strand reads as a strand.
FLOW = dict(angle=0, amp=(9.0, 3.4), lam=(210.0, 83.0), period=104.0, gap=1.46, step=1.04)


def strands(spec, size, pitch, rng, shift=0.0):
    """Where a figure's dots stand: x, y, the way light travels there (a unit vector), how far along its strand each is,
    where that strand's front of light is, and the distance between fronts."""
    X, Y, DX, DY, S, HEAD = [], [], [], [], [], []
    th = np.radians(spec["angle"]); ct, st = np.cos(th), np.sin(th)
    (a1, a2), (l1, l2) = spec["amp"], spec["lam"]
    mid, span = size / 2, size * 0.76
    for c in np.arange(-span, span, pitch * spec.get("gap", 1.0)):
        ph = c / 61.0                                                                      # each strand a little out of step with the last
        u = np.arange(-span, span, 0.25)
        v = c + a1 * np.sin(2 * np.pi * (u + shift) / l1 + ph) + a2 * np.sin(2 * np.pi * (u + shift) / l2 + 2.3 * ph + 1.0)
        arc = np.concatenate([[0], np.cumsum(np.hypot(np.diff(u), np.diff(v)))])
        at = np.arange(rng.uniform(0, pitch), arc[-1], pitch * spec.get("step", 0.96))          # dots evenly along the strand
        u, v = np.interp(at, arc, u), np.interp(at, arc, v)
        X.append(mid + u * ct - v * st); Y.append(mid + u * st + v * ct)
        DX.append(np.full(len(u), ct)); DY.append(np.full(len(u), st))
        S.append(u + shift); HEAD.append(np.full(len(u), 0.42 * c + 16.0 * np.sin(c / 37.0) + rng.uniform(-3, 3)))   # the fronts lean, and bend
    period = spec["period"]
    cat = lambda v: np.concatenate(v).astype(F)
    return cat(X), cat(Y), cat(DX), cat(DY), cat(S), cat(HEAD), period


def flow(solid, tint, spec=FLOW, pitch=4.0, shift=0.0, seed=5, ss=3, pad=48):
    """A figure already drawn whole (RGBA, 0 to 1), drawn again as dots that flow, `pad` wider on every side. The dots
    stand along strands, and light travels along them in fronts, each a bright head with a tail fading behind it. The
    figure is reduced to a few tones of its layer's colour (`tint`), the size of a dot carrying its shading, and the
    dots give way along the lines within it, so its parts stand apart. Past its edge only the light shows, and only on
    along its own strand: streaks leaving, a few arriving. `shift` is where the figure stands across the card, so the
    wave runs on from one figure to the next."""
    size = solid.shape[0] + 2 * pad
    rgb = np.zeros((size, size, 3), F); alpha = np.zeros((size, size), F)
    rgb[pad:-pad, pad:-pad], alpha[pad:-pad, pad:-pad] = solid[..., :3], solid[..., 3]
    away, near = ndimage.distance_transform_edt(alpha < 0.5, return_indices=True)              # how far outside the figure, and its nearest point
    rng = np.random.default_rng(seed)
    T = np.asarray(tint, F) / 255
    grey = ndimage.gaussian_filter(rgb.mean(-1) * alpha, 0.9)
    edge = np.hypot(ndimage.sobel(grey, 0), ndimage.sobel(grey, 1))
    edge = ndimage.gaussian_filter(edge, 0.7) * (ndimage.minimum_filter(alpha, 5) > 0.5)        # the lines within the figure, not its outline
    edge = (edge / max(1e-6, float(np.percentile(edge[alpha > 0.5], 96)))).astype(F)
    light = rgb.mean(-1)
    lo, hi = (float(v) for v in np.percentile(light[alpha > 0.5], (10, 97)))                    # this figure's own dark and light
    spots, count = ndimage.label((light > 0.84) & (ndimage.minimum_filter(alpha, 9) > 0.5))
    spark = np.zeros(light.shape, bool)                                                        # a point of light in a dark eye
    if count:
        ids = np.arange(1, count + 1)
        area = ndimage.sum(np.ones_like(light), spots, ids)
        about = ndimage.grey_dilation(spots, size=9)
        ring = np.array([float(light[(about == i) & (spots == 0)].mean()) if ((about == i) & (spots == 0)).any() else 1.0 for i in ids])
        small = ids[(area < 90) & (ring < 0.30)]
        spark = ndimage.binary_dilation(np.isin(spots, small), iterations=1)
    x, y, dx, dy, along, head, period = strands(spec, size, pitch, rng, shift)
    ok = (x > 1) & (x < size - 2) & (y > 1) & (y < size - 2)
    x, y, dx, dy, along, head = (v[ok] for v in (x, y, dx, dy, along, head))
    xi, yi = x.astype(int), y.astype(int)
    a, d = alpha[yi, xi], away[yi, xi].astype(F)
    ny, nx = near[0][yi, xi], near[1][yi, xi]
    behind = np.mod(head - along, period)                                                      # how far behind the nearest front of light
    rise = lambda b, tail: np.maximum(np.exp(-b / tail), np.exp(-(period - b) / 7.0))               # a front comes on over a few dots, not as a seam
    pulse = rise(behind, period * 0.23) + 0.45 * rise(np.mod(head + period * 0.5 - along, period), period * 0.135)
    inside = a > 0.4
    c_in, c_out = rgb[yi, xi], rgb[ny, nx]
    lum = c_in.mean(-1)
    glint = spark[yi, xi]
    lum = np.where(glint, 1.0, np.clip((lum - lo) / max(1e-6, hi - lo), 0, 1) ** 0.78)        # its middle tones lifted, so spacing does not dim it
    tone = 0.3 * lum + 0.7 * np.round(lum * 4) / 4                                             # its light in a few steps, with a little of the true light left
    W3, K3 = np.ones(3, F), np.array([0.035, 0.04, 0.06], F)
    stops = np.stack([T * 0.56 + K3 * 0.44, T * 0.90, T * 0.90 + W3 * 0.10, T * 0.62 + W3 * 0.38, T * 0.28 + W3 * 0.72])   # deep, dim, the layer's colour, pale, paler: the colour leads
    f = np.clip(tone, 0, 1) * 4; i0 = np.minimum(f.astype(int), 3)
    c_in = stops[i0] * (1 - (f - i0))[:, None] + stops[i0 + 1] * (f - i0)[:, None]             # and its colour from the layer's colour alone
    c_in = np.where(glint[:, None], W3, c_in)
    seam = np.where(glint, 0.0, edge[yi, xi])                                                  # near a line within the figure, the dots give way
    jit = rng.uniform(0.82, 1.0, len(x)).astype(F)
    w_in = (0.80 + 0.62 * pulse) * jit
    ex, ey = x - nx, y - ny
    line = (ex * dx + ey * dy) / np.maximum(np.hypot(ex, ey), 1e-6)                            # is the figure straight behind it, or straight ahead?
    gate = (np.sin(along * 0.37 + head * 1.3 + x * 0.05 + y * 0.07) > -0.35)                   # not every strand carries on
    lit = np.clip((pulse - 0.30) / 0.45, 0, 1) * gate
    reach = np.where(line > 0.92, 4.0 + 70.0 * lit, np.where(line < -0.92, 3.0 + 20.0 * lit, 0.0)) * spec.get("trail", 1.0)
    w_out = np.clip(1 - d / np.maximum(reach, 1e-6), 0, 1) ** 1.1 * lit * jit * (reach > 0)
    w = np.where(inside, w_in, w_out)
    base = np.where(inside[:, None], c_in, c_out * 0.55 + T * 0.45)
    sat = base.mean(-1, keepdims=True); base = np.clip(sat + (base - sat) * 1.45, 0, 1)        # a little more colour, to make up for the dark between dots
    bright = base * (1.06 + 0.34 * w[:, None])                                                 # brighter where light passes: toward white, never toward another hue
    top = bright.max(-1, keepdims=True)
    over = np.clip(top - 1, 0, 1) * 0.55 + 0.30 * np.clip(pulse - 0.55, 0, 1)[:, None]
    col = bright / np.maximum(top, 1.0)
    col = np.clip(col + (1 - col) * np.clip(over, 0, 1), 0, 1)
    r = pitch * 0.5 * np.where(inside, (0.54 + 0.40 * tone ** 0.8) * (0.86 + 0.28 * np.clip(pulse, 0, 1)) * np.clip(1.3 - 1.0 * seam, 0, 1) * np.where(glint, 1.25, 1.0), 0.32 + 0.46 * w_out)
    keep = (w > 0.05) & ((inside & (seam < 0.72)) | (~inside & (d < reach)))
    X, Y, R = x[keep], y[keep], r[keep]
    C = col[keep] * np.clip(np.where(inside, 1.0, w_out * 1.6), 0, 1)[keep][:, None]
    n = size * ss
    acc = np.zeros((n, n, 3), F); wsum = np.zeros((n, n), F); cover = np.zeros((n, n), F)
    Xs, Ys, Rs = X * ss, Y * ss, R * ss
    k = int(np.ceil(Rs.max() + 1))
    x0, y0 = Xs.astype(int), Ys.astype(int)
    for oy in range(-k, k + 1):
        for ox in range(-k, k + 1):
            px, py = x0 + ox, y0 + oy
            okp = (px >= 0) & (px < n) & (py >= 0) & (py < n)
            m = np.clip(Rs - np.hypot(px + 0.5 - Xs, py + 0.5 - Ys) + 0.5, 0, 1) * okp
            hit = m > 0
            np.add.at(acc, (py[hit], px[hit]), C[hit] * m[hit, None])
            np.add.at(wsum, (py[hit], px[hit]), m[hit])
            np.maximum.at(cover, (py[hit], px[hit]), m[hit])
    img = acc / np.maximum(wsum, 1e-6)[..., None]
    cov = cover.reshape(size, ss, size, ss).mean((1, 3))
    out = (img * cover[..., None]).reshape(size, ss, size, ss, 3).mean((1, 3)) / np.maximum(cov, 1e-6)[..., None]
    return np.dstack([np.clip(out, 0, 1), cov])

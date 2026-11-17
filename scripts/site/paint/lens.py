"""Lens — the social card's painting: a lens held up to Qwen3-8B's night sky.

The ground is the mark's tile at card size and the lens is its figure, at the
mark's proportions (Ledger's DESIGN.md, "The marks and the cards"). The sky is
the atlas: a light for each of the model's easiest neurons, as bright as the
labeller was sure of it, over a dust of the other neurons it was surest of.
Out here the lights are out of focus. The lens sits on L8·n344, and through
it that one is sharp: a little owl, at night.

Where a light sits. Its column is its layer, and the layers are spread as a
lens over L8 would spread them: widest under it, narrower the further off, so
all 36 fit and the ramp runs its length; the columns close a little toward
the top and bottom, as meridians do. Inside its column, and up and down it, a
light is placed by its neuron number through one fixed scramble (neuron
numbers are arbitrary, so any one-to-one scramble is as true as another).

    python lens.py <catalog/qwen3-8b> [scale] [out.png]

scripts/site/render.mjs runs it and sets the type over it (card.html). Needs
numpy, scipy and Pillow, and Ledger's paint (node_modules, or LEDGER_PAINT).

Written by Claude, 2026-11-16.
"""
import base64
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.environ.get("LEDGER_PAINT") or os.path.join(HERE, "../../../node_modules/@stdlogits/ledger/src/paint"))
from brush import F, Canvas, arc, mix, offset, resample, spline, _normals, DAB, FILBERT, FLAT, LINE, LINER, SOFT  # noqa: E402
from dusk import W, H, PAPER, LIGHT, RAMP, GLOW, ramp, wash, disc, vignette  # noqa: E402

CATALOG = sys.argv[1]
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
OUT = sys.argv[3] if len(sys.argv) > 3 else "lens.png"
t0 = time.time()

# ------------------------------------------------------------ the plate ----
LAYERS, N = 36, 12288
HUB = (8, 344)                            # the unit the lens sits on
CX, CY = 800.0, 322.0                     # its column's centre; the plate's equator
X0, X1 = -50.0, 1245.0                    # where layer 0's and layer 35's columns end, on the equator
S = 96.0                                  # px per layer under the lens
TOP, BOT = -12.0, 642.0
BOW = 0.35                                # how far the columns close toward top and bottom (radians at the plate's edge)
SCRAMBLE = dict(a=3713, e=7632, b=7303, c=5585, f=4220, d=3763)      # height: (a·n + e·L + b) mod N; in the column: (c·n + f·L + d) mod N


def _solve(span, reach):
    """k with S·k·log(1 + reach/k) = span (as near as a lens that only narrows can come)."""
    lo, hi = 1e-3, 1e3
    for _ in range(80):
        k = (lo * hi) ** 0.5
        if S * k * np.log1p(reach / k) < span:
            lo = k
        else:
            hi = k
    return k


KL = _solve(CX - X0, HUB[0] + 0.5)
KR = _solve(X1 - CX, LAYERS - 0.5 - HUB[0])


def flat_x(l):
    """Layer coordinate (a column runs l-0.5 .. l+0.5) to x on the equator."""
    d = np.asarray(l, float) - HUB[0]
    k = np.where(d < 0, KL, KR)
    return CX + np.sign(d) * S * k * np.log1p(np.abs(d) / k)


def layer_at(x):
    d = (np.asarray(x, float) - CX) / S
    k = np.where(d < 0, KL, KR)
    return HUB[0] + np.sign(d) * k * np.expm1(np.abs(d) / k)


def bow(y):
    return np.cos(BOW * (np.asarray(y, float) - CY) / (H / 2))


def place(l, y):
    return CX + (flat_x(l) - CX) * bow(y), y


def unbow_x(x, y):
    return CX + (np.asarray(x, float) - CX) / bow(y)


def pos(L, n):
    yf = (SCRAMBLE["a"] * n + SCRAMBLE["e"] * L + SCRAMBLE["b"]) % N / N
    u = (SCRAMBLE["c"] * n + SCRAMBLE["f"] * L + SCRAMBLE["d"]) % N / N
    x, y = place(L - 0.5 + 0.12 + 0.76 * u, TOP + yf * (BOT - TOP))
    return float(x), float(y)


def depth(x, y=CY):
    return float(np.clip(layer_at(unbow_x(x, y)) / 35.0, 0, 1))


# ------------------------------------------------------------- the atlas ----
# The easiest neurons, as the explorer's atlas lists them (layer, neuron, how sure the labeller was of its + label,
# the pole the card shows), and a dust of the others it was surest of: each layer's top 4% in scores.json, about a
# fifth of them by a fixed hash.
index = json.load(open(os.path.join(CATALOG, "index.json"), encoding="utf-8"))
if (index["layers"], index["neuronsPerLayer"]) != (LAYERS, N):
    raise SystemExit(f"lens.py is drawn for {LAYERS} layers of {N} neurons")
STARS = [(row[0], row[1], row[index["columns"].index("confPlus")]) for row in index["neurons"]]
if HUB not in {(L, n) for L, n, _ in STARS}:
    raise SystemExit(f"L{HUB[0]} n{HUB[1]} is no longer among the layer's easiest neurons")
easy = {(L, n) for L, n, _ in STARS}
DUST = []
for L, packed in enumerate(json.load(open(os.path.join(CATALOG, "scores.json"), encoding="utf-8"))["layers"]):
    sure = np.frombuffer(base64.b64decode(packed), np.uint8)
    for n in np.nonzero(sure >= np.percentile(sure, 96))[0]:
        if (L, int(n)) not in easy and (int(n) * 2654435761 + L * 40503) % 100 < 22:
            DUST.append((L, int(n), int(sure[n])))

# -------------------------------------------------------------- the lens ----
LX, LY = pos(*HUB)                          # the lens sits on its neuron
LH, LW = 438.0, 263.0                       # the mark's lens: 20 tall, 12 wide
LR = ((LH / 2) ** 2 + (LW / 2) ** 2) / LW
T8 = 8 / 35.0
R8, G8 = ramp(RAMP, T8), ramp(GLOW, T8)


def lens_edge(grow=0.0, n=90):
    h, w = LH + 2 * grow, LW + 2 * grow
    r = ((h / 2) ** 2 + (w / 2) ** 2) / w
    a = np.arcsin(h / 2 / r)
    t = np.linspace(-a, a, n)
    right = np.stack([LX - (r - w / 2) + r * np.cos(t), LY + r * np.sin(t)], -1)
    left = np.stack([LX + (r - w / 2) - r * np.cos(t), LY - r * np.sin(t)], -1)
    return np.vstack([right, left]).astype(F)


def in_lens(x, y, grow=0.0):
    w = LW + 2 * grow
    r = LR + grow
    return (np.hypot(x - (LX - (r - w / 2)), y - LY) < r) and (np.hypot(x - (LX + (r - w / 2)), y - LY) < r)


def sky(x, y):
    t = depth(x, y)
    v = np.clip(y / H, 0, 1)
    c = mix(PAPER, ramp(RAMP, t), 0.21 + 0.40 * v ** 1.25)
    d = np.hypot((x - LX) / 1.2, y - LY)
    return c + ramp(RAMP, t) * 0.10 * np.exp(-(d / 300.0) ** 2)


cv = Canvas(W, H, SCALE, ground=tuple(sky(600, 315)), seed=344)
rng = cv.rng


def paint_sky():
    wash(cv, sky)
    ys = np.linspace(-20, H + 20, 40)                      # the columns' edges, barely
    for l in np.arange(-0.5, 36, 1.0):
        x, y = place(np.full_like(ys, l), ys)
        cv.stroke(np.stack([x, y], -1), 1.0, ramp(GLOW, np.clip(l / 35.0, 0, 1)), LINER, opacity=0.09, taper=(0.0, 0.0), tip=1.0)


# Where the type is set: lights there are hushed.
TYPE = [(40, 30, 600, 150), (40, 440, 760, 606)]


def hush(x, y):
    k = 1.0
    for x0, y0, x1, y1 in TYPE:
        dx = max(x0 - x, 0, x - x1)
        dy = max(y0 - y, 0, y - y1)
        k = min(k, np.clip(np.hypot(dx, dy) / 50.0, 0, 1))
    return 0.15 + 0.85 * k


def magnified(x, y):
    l = float(layer_at(unbow_x(x, y)))
    return float((flat_x(l + 0.5) - flat_x(l - 0.5)) / S)


def lights():
    """The atlas, out of focus: every neuron a soft disc."""
    for L, n, conf in DUST:
        x, y = pos(L, n)
        if not (-8 < x < W + 8 and -8 < y < H + 8) or in_lens(x, y, 6):
            continue
        g = magnified(x, y) ** 0.5
        disc(cv, (x, y), 1.6 + 1.8 * g, ramp(GLOW, L / 35.0), opacity=0.10 * hush(x, y), mode="screen", soft=0.5, thick=0, streak=0,
             jitter=0, chroma=0)
    confs = np.sort([s[2] for s in STARS])
    order = sorted(STARS, key=lambda s: s[2])
    for L, n, conf in order:
        x, y = pos(L, n)
        if not (-12 < x < W + 12 and -12 < y < H + 12) or in_lens(x, y, 10):
            continue
        m = (np.searchsorted(confs, conf, side="right") / len(confs)) ** 2.2 * (0.7 + 0.3 * rng.random())
        g = magnified(x, y) ** 0.5
        k = hush(x, y)
        tint = mix(ramp(GLOW, L / 35.0), LIGHT, 0.10 + 0.22 * m)
        r = (2.2 + 8.6 * m ** 1.25) * (0.45 + 0.55 * g)
        disc(cv, (x, y), r, tint, opacity=(0.10 + 0.36 * m) * k * (0.55 + 0.45 * g), mode="screen", soft=0.34, thick=0, streak=0.0,
             jitter=0, chroma=0)
        if m > 0.5 and k > 0.9:                           # the bright ones have a rim, as a lens gives them
            cv.stroke(arc(x, y, r * 0.93, 0, 360, n=28), max(0.8, r * 0.13), tint, LINE, opacity=0.16 * m, mode="screen")


def through_the_lens():
    edge = lens_edge()
    top = LY - LH / 2
    moon = np.array([LX + 22.0, LY - 44.0])
    MR = 94.0

    def night(x, y):
        v = np.clip((y - top) / LH, 0, 1)
        c = mix(mix(PAPER, R8, 0.50), mix(R8, G8, 0.42), v ** 1.5)
        d = np.hypot(x - moon[0], y - moon[1])
        return np.clip(c + G8 * 0.34 * np.exp(-(d / 150.0) ** 2), 0, 1)

    with cv.layer(G8, "screen", 0.20, blur=14):               # the glass lights the air about it
        cv.stroke(np.vstack([edge, edge[:1]]), 30, LIGHT, SOFT, opacity=1, taper=(0, 0), tip=1)
    with cv.frisket(edge):
        cv.fill(lens_edge(8), night, FILBERT, width=20, angle=-8, length=(60, 160), overlap=0.5, streak=0.02, jitter=0.012,
                frisket=False, dry=0)
        for _ in range(16):                                    # in focus: stars are points again
            x, y = LX + rng.uniform(-120, 120), top + rng.uniform(20, 300)
            if np.hypot(x - moon[0], y - moon[1]) < MR + 26 or not in_lens(x, y, -10):
                continue
            mag = rng.random() ** 2
            disc(cv, (x, y), 0.9 + 1.2 * mag, mix(LIGHT, G8, 0.2), soft=0.4, thick=0.3, opacity=0.6 + 0.4 * mag)
        # the moon
        cv.glow(moon, MR * 1.35, mix(G8, LIGHT, 0.4), 0.42)
        pale = mix(LIGHT, G8, 0.20) * 0.97
        disc(cv, moon, MR, pale, soft=0.03, thick=0.2, streak=0.0, jitter=0)
        with cv.frisket(arc(moon[0], moon[1], MR - 0.5, 0, 360, n=72)):
            cv.fill(arc(moon[0], moon[1], MR + 6, 0, 360, n=72), lambda x, y: pale * (0.97 + 0.03 * np.sin(x * 0.05 + y * 0.04)), FILBERT,
                    width=17, angle=24, length=(50, 130), overlap=0.55, streak=0.012, jitter=0.008, dry=0, frisket=False, opacity=0.8)
            for dx, dy, r in ((-22, -26, 17), (18, -8, 22), (-8, 24, 14), (34, 30, 10), (-40, 8, 9)):     # its seas
                disc(cv, moon + (dx, dy), r, mix(pale, G8, 0.5), opacity=0.30, soft=0.8, thick=0, streak=0.0)
        owl(moon, MR)
    # the rim: a bright line where the glass turns, brightest at the upper left
    cv.stroke(np.vstack([edge, edge[:1]]), 2.2, mix(LIGHT, G8, 0.25), LINER, opacity=0.62, taper=(0, 0), tip=1)
    n = len(edge) // 2
    cv.stroke(edge[n + 34:n + 82], 3.4, LIGHT, LINER, opacity=0.85, taper=(0.3, 0.3), tip=0.1)
    cv.stroke(edge[38:62], 2.4, LIGHT, LINER, opacity=0.4, taper=(0.3, 0.3), tip=0.1)


# Athene noctua, facing us: its outline from the crown round by its left (our right), about its feet, y up negative.
OUTLINE = [(0, -150), (17, -150), (32, -146), (42, -135), (46, -120), (44, -106), (41, -97), (47, -86), (54, -68), (57, -46),
           (55, -26), (48, -10), (40, 0), (32, 11), (24, 27), (15, 40), (3, 43), (-7, 38), (-12, 22), (-17, 7), (-28, 0), (-42, -10),
           (-51, -26), (-54, -46), (-51, -68), (-44, -86), (-38, -97), (-41, -106), (-44, -120), (-40, -135), (-30, -146), (-15, -150)]


def owl(moon, MR):
    """A little owl on a bare branch with the moon behind it: nearly a silhouette, its edges catching the light."""
    k = 1.17
    foot = np.array([LX - 6.0, LY + 118.0])
    tilt = np.deg2rad(-6.0)

    def at(x, y):
        if y < -98:                                           # the head tips a little
            dx, dy = x, y + 98
            x, y = dx * np.cos(tilt) - dy * np.sin(tilt), -98 + dx * np.sin(tilt) + dy * np.cos(tilt)
        return foot + k * np.array([x, y])

    dark = mix(PAPER, R8, 0.10)
    plume = mix(PAPER, R8, 0.30)
    lit = mix(G8, LIGHT, 0.5)
    by = foot[1]

    def backlit(p):
        return float(np.clip(1.25 - np.hypot(*(p - moon)) / (MR * 1.25), 0, 1))

    shape = resample(spline([at(*p) for p in OUTLINE], 3, closed=True), 3.0)
    nrm = _normals(shape)
    if np.sum(nrm * (shape - shape.mean(0))) < 0:
        nrm = -nrm
    # the bird
    for ang in (0, 60):                                       # a solid ground first, so no light shows through the plumage
        cv.fill(shape, dark, FLAT, width=12, angle=ang, length=(50, 140), overlap=0.55, streak=0.01, jitter=0.004, dry=0, gap=0.0, grain=0.0)
    cv.fill(shape, lambda x, y: mix(dark, plume, 0.08 + 0.14 * np.exp(-((x - foot[0]) / (28 * k)) ** 2)), FILBERT, width=9, angle=78,
            length=(18, 44), overlap=0.5, streak=0.02, chroma=0.004, jitter=0.008, dry=0)
    # soft at the edges, as feathers are: short strokes lying down along the outline; then the moon's light on the edges it is behind
    edge = [(shape[i], nrm[i]) for i in range(0, len(shape), 2)
            if not (shape[i][1] > by - 5 * k and abs(shape[i][0] - foot[0]) < 44 * k)]
    for p, n in edge:
        d = n * rng.uniform(0.8, 2.6) + np.array([rng.normal(0, 0.5), rng.uniform(1.4, 3.6)])
        cv.stroke([p - n * 2.0, p + d], rng.uniform(1.3, 2.0), dark, FILBERT, taper=(0.0, 0.8), tip=0.1, dry=0, opacity=0.9)
    for i in range(len(shape) - 2):                           # the rim shows where the sky, not the moon, is behind the edge
        p, n = shape[i], nrm[i]
        away = np.hypot(*(p - moon)) - MR
        if away < 1.5:
            continue
        toward = (moon - p) / np.hypot(*(moon - p))
        g = np.exp(-away / 46.0) * (0.35 + 0.65 * max(0.0, float(n @ toward)))
        if g < 0.12:
            continue
        cv.stroke([p + n * 0.5, shape[i + 1] + nrm[i + 1] * 0.5], 1.3, lit, LINER, opacity=min(0.85, 1.1 * g), taper=(0, 0), tip=1)
        if rng.random() < 0.55:
            d = n * rng.uniform(1.0, 2.6) + np.array([rng.normal(0, 0.5), rng.uniform(0.5, 2.0)])
            cv.stroke([p + n * 0.3, p + d], rng.uniform(0.8, 1.2), lit, LINER, taper=(0.0, 0.8), tip=0.1, opacity=min(0.75, g))
    # folded wings: darker, their feathers in rows, each row's edge just told apart
    with cv.frisket(shape):
        for sx in (-1, 1):
            for j in range(6):
                x0 = sx * (25 + j * 5.2)
                pts = spline([at(x0, -80 + j * 4), at(x0 + sx * 5, -44), at(x0 + sx * 1, -12 + j)], 4)
                cv.stroke(pts, 4.8, mix(PAPER, R8, 0.06), FILBERT, opacity=0.5, taper=(0.15, 0.4), tip=0.3, dry=0.1)
            for row in range(5):
                y = -74 + row * 14
                for j in range(3):
                    x = sx * (27 + j * 9 + (4 if row % 2 else 0))
                    cv.stroke(spline([at(x - 4, y), at(x - 2.5, y + 7), at(x + 0.5, y + 9), at(x + 3.5, y + 7), at(x + 4.5, y)], 2), 1.0,
                              mix(dark, plume, 0.8), LINER, opacity=0.36, taper=(0.2, 0.2), tip=0.3)
    # the breast: pale streaks, looser and fainter toward the belly
    with cv.frisket(shape):
        for _ in range(64):
            x = rng.normal(0, 13)
            y = rng.uniform(-88, -8)
            if abs(x) > 23 - 0.05 * (y + 88):
                continue
            ln = rng.uniform(5, 10)
            cv.stroke([at(x, y), at(x + rng.normal(0, 0.8), y + ln)], rng.uniform(1.6, 2.6), mix(plume, lit, 0.16), FILBERT,
                      opacity=rng.uniform(0.25, 0.5), taper=(0.2, 0.7), tip=0.2, dry=0.15)
        for _ in range(26):                                   # the spotted crown
            x, y = rng.uniform(-34, 34), rng.uniform(-147, -131)
            disc(cv, at(x, y), rng.uniform(0.9, 1.5), mix(plume, lit, 0.2), opacity=0.5, soft=0.5, thick=0.1)
    # the face: two shallow discs, the pale brows that make it stern, a small beak, and eyes that keep a little light
    for sx in (-1, 1):
        e = at(sx * 17.5, -121)
        disc(cv, e, 15.5 * k, mix(dark, plume, 0.42), soft=0.55, thick=0.1, opacity=0.75)
        for j in range(14):
            a = 2 * np.pi * (j + 0.5) / 14
            u = np.array([np.cos(a), np.sin(a)])
            cv.stroke([e + u * 8.5 * k, e + u * 14.5 * k], 1.0, mix(dark, plume, 0.85), LINER, opacity=0.35, taper=(0.1, 0.6), tip=0.2)
    for sx in (-1, 1):
        e = at(sx * 17.5, -121)
        disc(cv, e, 6.6 * k, mix(R8, G8, 0.62) * 0.80, soft=0.16, thick=0.3)
        disc(cv, e + (sx * -0.4, 0.3), 4.3 * k, PAPER, soft=0.18, thick=0.2)
        cv.stroke(arc(e[0], e[1], 6.6 * k, 0, 360, n=24), 1.1, mix(PAPER, R8, 0.04), LINER, opacity=0.8)
        disc(cv, e + (1.7 * k, -1.2 * k), 1.2, LIGHT, soft=0.35, thick=0.2, opacity=0.95)
        lid = spline([at(sx * 2, -126.5), at(sx * 14, -129.5), at(sx * 30, -127)], 3)                  # the brow comes down over the eye
        cv.stroke(lid, 5.2 * k, mix(dark, plume, 0.35), FILBERT, taper=(0.15, 0.4), tip=0.3, dry=0)
        cv.stroke(offset(lid, sx * -1.6 * k), 2.0 * k, mix(plume, lit, 0.30), FILBERT, taper=(0.2, 0.6), tip=0.15, opacity=0.6, dry=0.1)
    cv.stroke([at(0, -117), at(0.3, -106)], 4.4 * k, mix(plume, lit, 0.28), FILBERT, taper=(0.1, 0.75), tip=0.1, dry=0, opacity=0.9)
    # the branch, in front of its tail: bare, a little crooked, lit along the top
    wood = mix(PAPER, R8, 0.08)
    branch = spline([(LX - 176, by + 30), (LX - 118, by + 20), (LX - 60, by + 9), (foot[0], by + 6), (LX + 58, by + 6), (LX + 112, by - 6),
                     (LX + 176, by - 30)], 5)
    cv.stroke(branch, 13.5, wood, FILBERT, taper=(0.0, 0.55), tip=0.45, dry=0, streak=0.05, jitter=0.01)
    for pts, w in (([(LX + 62, by + 4), (LX + 84, by - 30), (LX + 122, by - 60)], 4.6), ([(LX + 86, by - 32), (LX + 78, by - 62)], 2.6),
                   ([(LX + 104, by - 46), (LX + 132, by - 52)], 2.0), ([(LX - 74, by + 12), (LX - 100, by - 14), (LX - 108, by - 40)], 3.6),
                   ([(LX - 96, by - 10), (LX - 122, by - 16)], 2.0), ([(LX - 122, by + 22), (LX - 138, by + 44)], 2.8)):
        cv.stroke(spline(pts, 4) if len(pts) > 2 else pts, w, wood, FILBERT, taper=(0.0, 0.75), tip=0.12, dry=0)
    disc(cv, (LX - 62, by + 11), 5.0, wood, soft=0.3, thick=0.4)                                           # a knot
    top = offset(branch, -5.2)
    cv.stroke(top[:len(top) * 2 // 5], 1.5, mix(wood, lit, 0.55), LINER, opacity=0.6, taper=(0.2, 0.3), tip=0.2)
    cv.stroke(top[len(top) * 11 // 20:], 1.4, mix(wood, lit, 0.55), LINER, opacity=0.55, taper=(0.3, 0.5), tip=0.2)
    # its toes over the branch
    for sx in (-1, 1):
        for j in (-1, 0, 1):
            p = at(sx * 13 + j * 4.2, -4)
            cv.stroke([p, p + (j * 1.1, 7.5 * k), p + (j * 1.6, 11.5 * k)], 2.9, mix(dark, plume, 0.75), FILBERT, taper=(0.1, 0.5), tip=0.3, dry=0)


paint_sky()
lights()
vignette(cv)
through_the_lens()
cv.save_card(OUT, relief=0.4, tooth=0.02)
print(f"{OUT}: {cv.count} strokes, {time.time() - t0:.0f}s; lens at {LX:.0f}, {LY:.0f}")

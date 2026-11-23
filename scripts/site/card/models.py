"""The card's six figures, each a small solid model: a function from points in space to how far each is from the figure's
surface (negative inside) and which of its parts is nearest. mesh.py turns one into a mesh, blend.py renders that in
Blender, and dots.py draws the render as dots (figures.py runs all three).

A figure stands in a box about 2 across, y up, z toward the eye. It is one colour, its layer's: its parts differ only in
how light or dark they are (the materials below), so the depth ramp stays the one hue. What is added to a figure comes
from its neuron's own label where it can, noted beside each.
"""
import numpy as np

F = np.float32
BODY, LIGHT, DARK, MID, GLOW, WHITE = range(6)


def length(v):
    return np.sqrt((v * v).sum(-1))


def sph(p, c, r):
    return length(p - np.asarray(c, F)) - r


def ell(p, c, r):
    q = p - np.asarray(c, F)
    r = np.asarray(r, F)
    k0 = length(q / r)
    k1 = length(q / (r * r))
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


def cap(p, a, b, r1, r2=None):
    a, b = np.asarray(a, F), np.asarray(b, F)
    r2 = r1 if r2 is None else r2
    pa, ba = p - a, b - a
    h = np.clip((pa @ ba) / float(ba @ ba), 0, 1)
    return length(pa - h[:, None] * ba) - (r1 + (r2 - r1) * h)


def tor(p, c, R, r, axis):
    q = p - np.asarray(c, F)
    i = "xyz".index(axis)
    j, k = [n for n in range(3) if n != i]
    return np.hypot(np.hypot(q[:, j], q[:, k]) - R, q[:, i]) - r


def rcyl(p, c, h, r, rnd):
    q = p - np.asarray(c, F)
    dx = np.hypot(q[:, 0], q[:, 2]) - (r - rnd)
    dy = np.abs(q[:, 1]) - (h - rnd)
    return np.minimum(np.maximum(dx, dy), 0) + np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) - rnd


def su(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def U(A, B, k=0.0):
    """Two parts joined, smoothly over k; each point keeps the material of the nearer."""
    (da, ma), (db, mb) = A, B
    return (su(da, db, k) if k > 0 else np.minimum(da, db)), np.where(da < db, ma, mb)


def rotz(p, deg, pivot=(0, 0, 0)):
    c, s = np.cos(np.radians(deg)), np.sin(np.radians(deg))
    q = p - np.asarray(pivot, F)
    return np.stack([c * q[:, 0] - s * q[:, 1], s * q[:, 0] + c * q[:, 1], q[:, 2]], -1).astype(F) + np.asarray(pivot, F)


# ---------------------------------------------------------------------------------------- the figures
# Each is drawn as a small character: a large head or one round body, eyes low and wide apart, short limbs. What is
# added to it comes from the neuron's own label (what it fires on, what it makes the model say), noted beside each.

def leaf(p, c, r=0.09, turn=0.0):
    """A small leaf lying at an angle."""
    q = rotz(p, turn, c)
    return ell(q, c, (r, r * 0.55, r * 0.22))


def chevron(p, c, w=0.05, r=0.014):
    """A small V, as a feather's edge."""
    x, y, z = c
    return np.minimum(cap(p, (x - w, y + w * 0.6, z), (x, y, z + 0.004), r), cap(p, (x + w, y + w * 0.6, z), (x, y, z + 0.004), r))


def owl(p):
    """L8 n344. Fires on 'owl'; writes 'owls, night, bedtime and cozy autumn scenes': a branch at night, two autumn leaves."""
    S = (ell(p, (0, -0.05, 0), (0.66, 0.74, 0.58)), BODY)                                      # one round body
    for k in (-1, 1):
        S = U(S, (cap(p, (k * 0.34, 0.50, 0.02), (k * 0.52, 0.80, -0.02), 0.12, 0.035), BODY), 0.10)   # ear tufts
        S = U(S, (ell(p, (k * 0.63, -0.14, 0.0), (0.13, 0.38, 0.30)), MID), 0.05)                      # wings held close
        for j, dz in enumerate((0.16, 0.04, -0.08)):
            S = U(S, (ell(p, (k * 0.61, -0.50 + 0.03 * j, dz), (0.07, 0.11, 0.07)), MID), 0.03)            # their feather tips
    S = U(S, (ell(p, (0, -0.40, 0.26), (0.36, 0.33, 0.30)), LIGHT), 0.05)                       # its pale belly
    for y, xs in ((-0.30, (-0.13, 0.0, 0.13)), (-0.46, (-0.07, 0.07))):
        for x in xs:
            z = 0.26 + 0.30 * np.sqrt(max(0.0, 1 - (x / 0.36) ** 2 - ((y + 0.40) / 0.33) ** 2))
            S = U(S, (chevron(p, (x, y, z + 0.006)), MID), 0.006)
    mask = su(ell(p, (-0.22, 0.14, 0.42), (0.30, 0.31, 0.16)), ell(p, (0.22, 0.14, 0.42), (0.30, 0.31, 0.16)), 0.04)
    S = U(S, (mask, WHITE), 0.03)                                                              # the face about its eyes
    for k in (-1, 1):
        S = U(S, (sph(p, (k * 0.22, 0.14, 0.50), 0.15), DARK), 0.004)
        S = U(S, (sph(p, (k * 0.22 + 0.056, 0.206, 0.622), 0.042), GLOW))
        S = U(S, (sph(p, (k * 0.22 - 0.05, 0.08, 0.63), 0.018), GLOW))
        S = U(S, (ell(p, (k * 0.47, -0.05, 0.40), (0.085, 0.055, 0.04)), LIGHT), 0.03)               # cheeks
        for j in (-1, 0, 1):
            S = U(S, (cap(p, (k * 0.2 + j * 0.065, -0.76, 0.24), (k * 0.2 + j * 0.08, -0.80, 0.42), 0.036), LIGHT))
    S = U(S, (cap(p, (0, 0.06, 0.60), (0, -0.05, 0.66), 0.06, 0.018), LIGHT), 0.01)             # a small bill
    S = U(S, (cap(p, (-1.02, -0.88, 0.22), (1.04, -0.82, 0.22), 0.085, 0.07), MID))             # the branch
    S = U(S, (cap(p, (-0.70, -0.87, 0.22), (-0.92, -0.70, 0.30), 0.04, 0.02), MID), 0.04)
    S = U(S, (cap(p, (0.72, -0.84, 0.22), (0.92, -0.64, 0.30), 0.035, 0.02), MID), 0.04)
    S = U(S, (leaf(p, (1.02, -0.58, 0.32), 0.10, 30), BODY), 0.01)
    S = U(S, (leaf(p, (0.86, -0.50, 0.30), 0.085, 115), BODY), 0.01)
    return S


def cat(p):
    """L30 n10935. Fires on 'cats and kittens'; writes 'cat, 猫, 喵, paw': a kitten with one paw raised."""
    S = (ell(p, (0, 0.24, 0.04), (0.58, 0.48, 0.47)), BODY)                                    # a large head
    S = U(S, (ell(p, (0, -0.52, 0), (0.38, 0.42, 0.35)), BODY), 0.10)
    S = U(S, (ell(p, (0, -0.48, 0.23), (0.21, 0.27, 0.16)), LIGHT), 0.07)                       # its chest
    for k in (-1, 1):
        S = U(S, (cap(p, (k * 0.30, 0.52, 0.02), (k * 0.45, 0.90, -0.02), 0.22, 0.05), BODY), 0.06)   # ears
        S = U(S, (cap(p, (k * 0.32, 0.58, 0.14), (k * 0.43, 0.82, 0.09), 0.11, 0.025), LIGHT), 0.02)
        S = U(S, (ell(p, (k * 0.19, 0.22, 0.435), (0.105, 0.125, 0.075)), DARK), 0.006)               # eyes, low and wide
        S = U(S, (sph(p, (k * 0.19 + 0.04, 0.275, 0.505), 0.032), GLOW))
        S = U(S, (sph(p, (k * 0.19 - 0.03, 0.17, 0.507), 0.015), GLOW))
        S = U(S, (sph(p, (k * 0.05, 0.055, 0.48), 0.06), LIGHT), 0.035)                               # muzzle
        S = U(S, (ell(p, (k * 0.28, -0.90, 0.16), (0.14, 0.08, 0.20)), BODY), 0.04)                   # hind feet
        S = U(S, (ell(p, (k * 0.28, -0.90, 0.32), (0.10, 0.06, 0.06)), LIGHT), 0.03)
    S = U(S, (ell(p, (0, 0.105, 0.525), (0.034, 0.024, 0.024)), DARK))                          # nose
    S = U(S, (ell(p, (-0.14, -0.86, 0.26), (0.105, 0.085, 0.14)), LIGHT), 0.04)                 # one paw down
    S = U(S, (cap(p, (0.28, -0.40, 0.20), (0.44, -0.02, 0.30), 0.10, 0.105), BODY), 0.06)       # and one raised
    S = U(S, (sph(p, (0.45, 0.05, 0.31), 0.125), LIGHT), 0.05)
    for dx, dy in ((-0.05, 0.05), (0.0, 0.078), (0.05, 0.05)):
        S = U(S, (sph(p, (0.45 + dx, 0.05 + dy, 0.42), 0.022), MID))                            # its pads
    S = U(S, (ell(p, (0.45, 0.02, 0.43), (0.042, 0.032, 0.02)), MID))
    S = U(S, (tor(p, (0, -0.17, 0.02), 0.30, 0.04, "y"), WHITE), 0.008)                         # a collar and its bell
    S = U(S, (sph(p, (0, -0.24, 0.335), 0.062), GLOW))
    a = np.linspace(0, 1, 14)
    tx, ty, tz = -0.24 - 0.46 * np.sin(a * np.pi * 0.8), -0.86 + 0.74 * a ** 1.25, -0.12 + 0.20 * a
    for i in range(len(a) - 1):                                                                 # its tail, curling up
        S = U(S, (cap(p, (tx[i], ty[i], tz[i]), (tx[i + 1], ty[i + 1], tz[i + 1]), 0.085 - 0.012 * a[i], 0.085 - 0.012 * a[i + 1]), BODY), 0.06)
    S = U(S, (sph(p, (tx[-1], ty[-1], tz[-1]), 0.082), LIGHT), 0.05)
    return S


def coffee(p):
    """L3 n10265. Fires on 'coffee and caffeine'; writes 'coffee, espresso, brew': a cup, its crema, two beans."""
    y, r = p[:, 1], np.hypot(p[:, 0], p[:, 2])
    S = (rcyl(p, (0, -0.74, 0), 0.04, 1.0, 0.035), BODY)                                        # the saucer
    S = U(S, (tor(p, (0, -0.70, 0), 0.93, 0.05, "y"), BODY), 0.06)
    t = np.clip((y + 0.66) / 0.96, 0.03, 1)
    ro = 0.40 + 0.25 * t ** 0.7                                                                # the cup widens as it rises
    cup = np.maximum(np.maximum(r - ro, np.abs(y + 0.18) - 0.48), -np.maximum(r - (ro - 0.07), -(y + 0.52)))
    cup = su(cup, tor(p, (0, 0.30, 0), 0.615, 0.036, "y"), 0.02)                               # its lip
    cup = su(cup, rcyl(p, (0, -0.66, 0), 0.035, 0.36, 0.02), 0.03)                             # its foot
    handle = np.maximum(tor(p, (0.80, -0.14, 0), 0.25, 0.07, "z"), (ro - 0.03) - r)
    S = U(S, (su(cup, handle, 0.05), LIGHT))
    S = U(S, (np.maximum(r - (ro - 0.06), np.abs(y - 0.20) - 0.02), DARK))                     # the coffee
    lobes = su(sph(p, (-0.088, 0.222, -0.055), 0.112), sph(p, (0.088, 0.222, -0.055), 0.112), 0.015)
    heart = np.maximum(su(lobes, cap(p, (0, 0.222, 0.0), (0, 0.222, 0.215), 0.105, 0.008), 0.035), np.abs(y - 0.222) - 0.012)
    S = U(S, (heart, WHITE))                                                                   # drawn in its crema
    S = U(S, (tor(p, (0, 0.214, 0), 0.50, 0.016, "y"), BODY))
    spoon = su(ell(p, (-0.66, -0.66, 0.52), (0.13, 0.035, 0.09)), cap(p, (-0.56, -0.66, 0.52), (-0.10, -0.67, 0.86), 0.022, 0.03), 0.03)
    S = U(S, (spoon, WHITE))
    for c, turn in (((0.52, -0.655, 0.70), 30), ((0.72, -0.655, 0.52), -40)):                   # two beans
        S = U(S, (np.maximum(ell(p, c, (0.105, 0.06, 0.075)), -cap(rotz(p, turn, c), (c[0] - 0.12, c[1] + 0.06, c[2]), (c[0] + 0.12, c[1] + 0.06, c[2]), 0.014)), MID))
    return S


def tree(p):
    """L12 n11885. Fires on 'tree, trees, bare trees, branches, dropping leaves'; writes '树, 树木': a tree shedding leaves."""
    S = (cap(p, (0.02, -0.98, 0), (-0.02, -0.10, 0), 0.16, 0.10), MID)
    S = U(S, (cap(p, (0, -0.36, 0), (0.34, 0.02, 0.10), 0.07, 0.05), MID), 0.06)               # two limbs
    S = U(S, (cap(p, (0, -0.48, 0), (-0.34, -0.06, 0.12), 0.07, 0.05), MID), 0.06)
    for a in (0.4, 2.2, 4.1, 5.3):                                                             # its roots
        S = U(S, (cap(p, (0, -0.94, 0), (0.30 * np.cos(a), -1.04, 0.26 * np.sin(a)), 0.085, 0.03), MID), 0.07)
    S = U(S, (cap(p, (0.06, -0.62, 0.04), (0.56, -0.46, 0.20), 0.05, 0.03), MID), 0.05)        # one branch bare
    S = U(S, (cap(p, (0.56, -0.46, 0.20), (0.74, -0.32, 0.24), 0.03, 0.012), MID), 0.02)
    S = U(S, (cap(p, (0.44, -0.49, 0.17), (0.60, -0.60, 0.26), 0.022, 0.01), MID), 0.02)
    rng = np.random.default_rng(11)
    d = None
    for c, rr in [((0.0, 0.42, 0.0), 0.50), ((-0.46, 0.14, 0.06), 0.34), ((0.46, 0.16, 0.04), 0.34), ((-0.20, 0.74, 0.04), 0.27), ((0.24, 0.72, 0.0), 0.28)]:
        d = sph(p, c, rr * 0.80) if d is None else su(d, sph(p, c, rr * 0.80), 0.05)           # the crown's masses, and on each
        for _ in range(int(26 * rr / 0.5)):                                                    # many small tufts of leaves
            v = rng.normal(size=3); v /= np.linalg.norm(v)
            d = su(d, sph(p, tuple(np.asarray(c) + v * rr * 0.86), float(rng.uniform(0.10, 0.16))), 0.035)
    S = U(S, (d, BODY), 0.02)
    for c, r, turn in [((0.90, -0.04, 0.30), 0.08, 30), ((-0.86, -0.28, 0.36), 0.075, -50), ((0.74, -0.66, 0.44), 0.08, 70), ((-0.60, -0.70, 0.50), 0.075, 15),
                       ((1.00, 0.40, 0.12), 0.065, -20), ((-1.00, 0.18, 0.20), 0.065, 60)]:
        S = U(S, (leaf(p, c, r, turn), BODY))                                                  # leaves coming down: the crown's own
    for c, turn in [((0.44, -1.03, 0.50), 20), ((-0.34, -1.03, 0.58), -35), ((0.10, -1.04, 0.70), 80), ((-0.66, -1.05, 0.34), 10), ((0.70, -1.05, 0.28), -60)]:
        S = U(S, (ell(rotz(p, turn, c), c, (0.085, 0.02, 0.05)), BODY))                        # and lying under it
    S = U(S, (ell(p, (0, -1.12, 0.05), (0.95, 0.08, 0.72)), MID), 0.02)                        # the ground
    return S


def bell(p):
    """L20 n11348. Fires on 'bells and ringing sounds (bell, rang, 铃, 响)': a bell mid-swing, tied with a bow."""
    q = rotz(p, -13, (0, 0.80, 0))                                                             # it swings from its crown
    y, r = q[:, 1], np.hypot(q[:, 0], q[:, 2])
    rs = 0.40 + 0.27 * np.clip((0.22 - y) / 0.72, 0, 1) ** 2.4                                 # the skirt flares
    solid = su(ell(q, (0, 0.20, 0), (0.40, 0.44, 0.40)), np.maximum(r - rs, np.abs(y + 0.14) - 0.36), 0.07)
    body = np.maximum(solid, -np.maximum(r - (rs - 0.055), y - 0.10))
    body = su(body, tor(q, (0, -0.50, 0), 0.655, 0.045, "y"), 0.03)
    body = su(body, tor(q, (0, 0.16, 0), 0.41, 0.022, "y"), 0.02)
    body = su(body, tor(q, (0, -0.30, 0), 0.50, 0.018, "y"), 0.02)
    S = (body, LIGHT)
    S = U(S, (su(tor(q, (0, 0.78, 0), 0.10, 0.04, "z"), rcyl(q, (0, 0.64, 0), 0.05, 0.09, 0.02), 0.03), LIGHT), 0.02)
    S = U(S, (cap(q, (0, 0.2, 0), (0, -0.52, 0), 0.028), MID))
    S = U(S, (sph(q, (0, -0.62, 0), 0.125), WHITE))                                            # the clapper
    for k in (-1, 1):                                                                          # a bow tied before its crown
        S = U(S, (ell(rotz(q, -k * 18, (0, 0.67, 0.14)), (k * 0.19, 0.67, 0.14), (0.165, 0.085, 0.05)), BODY), 0.012)
        S = U(S, (ell(rotz(q, -k * 18, (0, 0.67, 0.14)), (k * 0.19, 0.67, 0.165), (0.09, 0.035, 0.03)), MID), 0.01)   # the fold in each loop
        ends = [(k * 0.04, 0.62, 0.18), (k * 0.11, 0.54, 0.285), (k * 0.17, 0.44, 0.33), (k * 0.215, 0.35, 0.36)]    # its ends follow the dome, just clear of it
        for a, b in zip(ends[:-1], ends[1:]):
            S = U(S, (cap(q, a, b, 0.03, 0.03), BODY), 0.02)
        S = U(S, (sph(q, ends[-1], 0.036), BODY), 0.02)
    S = U(S, (sph(q, (0, 0.665, 0.165), 0.06), BODY), 0.015)                                   # the knot
    return S


def moon(p):
    """L24 n10369. Fires on 'moon and Mid-Autumn festival words (月亮, 中秋)'; writes 'moon, lunar phases and Mid-Autumn':
    the moon alone, as a crescent, one of its phases."""
    q0 = rotz(p, 18, (0, 0, 0))                                                                # its horns tipped back a little
    centre = np.asarray((-0.10, 0.0, 0.0), F)
    q = q0 - centre
    m = length(q) - 0.88
    n = q / np.maximum(length(q)[:, None], 1e-6)
    for c, rad, deep in [((-0.80, 0.30, 0.52), 0.20, 0.034), ((-0.86, -0.22, 0.46), 0.15, 0.028), ((-0.55, -0.62, 0.56), 0.17, 0.03),
                         ((-0.52, 0.70, 0.49), 0.13, 0.024), ((-0.97, 0.05, 0.24), 0.10, 0.02), ((-0.62, 0.02, 0.78), 0.09, 0.018), ((-0.30, -0.86, 0.41), 0.10, 0.02)]:
        c = np.asarray(c, F) / np.linalg.norm(c)
        a = length(n - c)
        m = m + 1.7 * deep * np.exp(-(a / rad) ** 2) - deep * 0.6 * np.exp(-(((a - rad) / (0.3 * rad)) ** 2))   # a bowl, and its rim
    cut = np.hypot(q0[:, 0] - 0.34, q0[:, 1] - 0.06) - 0.82                                    # the dark of the moon, taken out of it right through
    return -su(-m, cut, 0.045), np.full(len(p), GLOW)


# Each figure with how the eye is set for it: how far it is lifted (degrees) and how close it stands.
MODELS = {"coffee": (coffee, 26, 0.92), "owl": (owl, 4, 0.88), "tree": (tree, 8, 0.86), "bell": (bell, 4, 1.0), "moon": (moon, 2, 0.98), "cat": (cat, 5, 0.90)}


def normal(scene, p, e=0.0025):
    n = np.stack([scene(p + np.array(o, F) * e)[0] - scene(p - np.array(o, F) * e)[0] for o in ((1, 0, 0), (0, 1, 0), (0, 0, 1))], -1)
    return n / np.maximum(length(n)[:, None], 1e-6)

"""A figure's surface as a mesh, for Blender (figures.py calls mesh and write).

The model is the one in models.py. Its surface is found on a fine grid (only near the surface, which a coarse
pass finds first), and each vertex carries the colour of the part it belongs to, with what kind of part it is in alpha:
1 matte, 0.9 pale, 0.8 white and a little glossy, 0.5 dark and glossy (an eye), 0.25 lit from within (the moon), 0 light
itself (a glint). Axes are Blender's: z up, the eye down -y."""
import numpy as np
from scipy import ndimage
from skimage import measure

import models
from models import F


def field(scene, n):
    c = 64
    g = np.linspace(-1.8, 1.8, c).astype(F)
    X = np.stack(np.meshgrid(g, g, g, indexing="ij"), -1).reshape(-1, 3)
    coarse = scene(X)[0].reshape(c, c, c)
    near = np.argwhere(coarse < 0.07)
    lo, hi = g[near.min(0)] - 0.08, g[near.max(0)] + 0.08
    step = float((hi - lo).max() / n)
    axes = [np.arange(lo[i], hi[i] + step, step, dtype=F) for i in range(3)]
    shape = tuple(len(a) for a in axes)
    # the coarse field carried to the fine grid; only points near the surface are worked again
    idx = [(a - g[0]) / (g[1] - g[0]) for a in axes]
    grid = np.meshgrid(*idx, indexing="ij")
    vol = ndimage.map_coordinates(coarse, grid, order=1).astype(F)
    band = np.abs(vol) < 0.16
    I = np.argwhere(band)
    P = np.stack([axes[k][I[:, k]] for k in range(3)], -1)
    out = np.empty(len(P), F)
    for a in range(0, len(P), 1_200_000):
        out[a:a + 1_200_000] = scene(P[a:a + 1_200_000])[0]
    vol[band] = out
    return vol, lo, step


def _outward(verts, faces, scene):
    """Positive when a sample of faces look the way the field rises (outward)."""
    f = faces[:: max(1, len(faces) // 4000)]
    a, b, c = verts[f[:, 0]], verts[f[:, 1]], verts[f[:, 2]]
    n = np.cross(b - a, c - a)
    g = models.normal(scene, ((a + b + c) / 3).astype(F), 0.004)
    return float(np.sign((n * g).sum(-1)).sum())


def mesh(name, tint, n=300):
    scene = models.MODELS[name][0]
    vol, lo, step = field(scene, n)
    verts, faces, _, _ = measure.marching_cubes(vol, 0.0, spacing=(step, step, step))
    faces = faces[:, ::-1] if _outward(verts + lo, faces, scene) < 0 else faces                # faces turned to look outward
    verts = (verts + lo).astype(F)
    for _ in range(2):                                                                         # onto the surface itself
        verts = (verts - scene(verts)[0][:, None] * models.normal(scene, verts, 0.003)).astype(F)
    nrm = models.normal(scene, verts, 0.004)
    T, W, K = np.asarray(tint, F) / 255, np.ones(3, F), np.array([0.035, 0.04, 0.06], F)
    mix = lambda a, b, s: a * (1 - s) + b * s
    palette = np.stack([T * 0.94, mix(T, W, 0.58), mix(K, T, 0.10), mix(K, T, 0.60), mix(T, W, 0.84), mix(T, W, 0.92)])
    kinds = np.array([1.0, 0.9, 0.5, 1.0, 0.38 if name == "moon" else 0.0, 0.8], F)
    # where two parts meet, a vertex takes a little of each: its colour is read at several points about it on the surface
    t1 = np.cross(nrm, np.array([0.31, 0.74, 0.59], F)); t1 /= np.maximum(models.length(t1)[:, None], 1e-6)
    t2 = np.cross(nrm, t1)
    colour, kind = np.zeros((len(verts), 3), F), np.zeros(len(verts), F)
    offsets = [(0, 0)] + [(np.cos(a) * r, np.sin(a) * r) for r in (0.5, 1.0) for a in np.arange(6) * np.pi / 3 + r]
    for u, v in offsets:
        mat = scene((verts + (t1 * u + t2 * v) * step * 0.9).astype(F))[1]
        colour += palette[mat]; kind += kinds[mat]
    return verts, faces, nrm, colour / len(offsets), kind / len(offsets)


def write(path, verts, faces, nrm, colour, kind):
    to = lambda v: np.stack([v[:, 0], -v[:, 2], v[:, 1]], -1)                                 # y up, z to the eye -> z up, the eye down -y
    v, n = to(verts), to(nrm)
    rgba = np.clip(np.concatenate([colour, kind[:, None]], 1) * 255, 0, 255).astype(np.uint8)
    with open(path, "wb") as f:
        f.write(("ply\nformat binary_little_endian 1.0\nelement vertex %d\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\n"
                 "property uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar alpha\nelement face %d\nproperty list uchar int vertex_indices\nend_header\n" % (len(v), len(faces))).encode())
        rec = np.empty(len(v), dtype=[("p", "<f4", 3), ("n", "<f4", 3), ("c", "u1", 4)])
        rec["p"], rec["n"], rec["c"] = v, n, rgba
        f.write(rec.tobytes())
        fr = np.empty(len(faces), dtype=[("k", "u1"), ("i", "<i4", 3)])
        fr["k"], fr["i"] = 3, faces
        f.write(fr.tobytes())


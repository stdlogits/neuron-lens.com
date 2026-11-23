"""Draws the social card's figures into figures/, one for each neuron in card.json:

    python scripts/site/card/figures.py [figure ...]

Each is modelled (models.py), turned into a mesh (mesh.py), rendered in Blender's Cycles (blend.py), and that render
drawn as dots that flow (dots.py), in its layer's colour. scripts/site/render.mjs sets them on the card. Needs Python
with numpy, scipy, scikit-image and Pillow, and Blender (BLENDER, the app on a Mac, or `blender`); a figure takes about
a minute. Rerun it when a model, the dots or card.json's neurons change, then render.mjs.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

import dots
import mesh
import models

HERE = Path(__file__).resolve().parent
DEEP, LATE = "#a08bff", "#4fd8f5"       # Ledger's --deep and --late on dark paper (its tokens.css), which the card is on
STEP = 362.0                            # about the distance from one figure to the next on the card, in a figure's pixels


def oklch(colour):
    r, g, b = (int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    r, g, b = (v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in (r, g, b))
    l, m, s = (np.cbrt(v) for v in (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
                                   0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b))
    a, b2 = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, float(np.hypot(a, b2)), float(np.arctan2(b2, a))


def depth_colour(t):
    """The depth ramp at t, 0 the first layer and 1 the last: Ledger's two colours mixed in oklch, as the site mixes them."""
    (l0, c0, h0), (l1, c1, h1) = oklch(DEEP), oklch(LATE)
    L, C, H = l0 + (l1 - l0) * t, c0 + (c1 - c0) * t, h0 + (h1 - h0) * t
    a, b = C * np.cos(H), C * np.sin(H)
    l, m, s = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    return tuple(int(round(255 * min(1.0, max(0.0, 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)))) for v in rgb)


def blender():
    for path in (os.environ.get("BLENDER"), "/Applications/Blender.app/Contents/MacOS/Blender"):
        if path and Path(path).exists():
            return path
    return "blender"


if __name__ == "__main__":
    card = json.loads((HERE / "card.json").read_text(encoding="utf-8"))
    layers = json.loads((HERE / "../../../src/lib/depth.json").read_text(encoding="utf-8"))[card["model"]]["plan"]["layers"]
    asked = sys.argv[1:]
    with tempfile.TemporaryDirectory() as folder:
        for i, unit in enumerate(card["units"]):
            name = unit["figure"]
            if asked and name not in asked:
                continue
            tint = depth_colour(unit["layer"] / (layers - 1))
            _, lift, close = models.MODELS[name]
            ply, png = f"{folder}/{name}.ply", f"{folder}/{name}.png"
            mesh.write(ply, *mesh.mesh(name, tint, 400))
            subprocess.run([blender(), "-b", "--python", str(HERE / "blend.py"), "--", ply, png, str(lift), str(close), ",".join(map(str, tint)), "680", "128"],
                           check=True, stdout=subprocess.DEVNULL)
            whole = np.asarray(Image.open(png).convert("RGBA").resize((340, 340), Image.LANCZOS)).astype(np.float32) / 255
            Image.fromarray((dots.flow(whole, tint, shift=i * STEP) * 255).astype(np.uint8), "RGBA").save(HERE / "figures" / f"{name}.png")
            print(f"figures/{name}.png in rgb{tint}", flush=True)

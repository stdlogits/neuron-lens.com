"""A model's depth bands, by which lens works on each side of its neurons.

    python3 scripts/neurons/bands.py ~/Work/neuron-lens/data/summary <model>

Early layers are read through the S-lens on both sides: what drives a neuron and what it writes look
like input tokens. Middle layers still read through the S-lens, but write through the R-lens: what a
neuron writes already moves the output. Late layers are read through the R-lens on both sides. So two
edges set the bands, each measured on every layer by neuron-lens (findings §3, §7, §13):

- the R-lens starts working for writes at the first layer from which its read of a neuron's write
  predicts what steering the neuron does, at a median Pearson r of at least ``WRITE_R`` over the
  sampled poles, and stays there (``causal_lens_<model>.json``, steering at 1×);
- the S-lens stops working for reads after the last layer where its read of a pole's input names the
  token under its top firings for at least ``READ_S`` of the poles that fire, net of chance
  (``legible_<model>.json``), taken as a running median over three layers so one layer alone doesn't
  make a regime (Gemma 4's L33 reaches 16% between 9% and 7%).

It prints the bands for the builder's profile (``build-neuron-catalog.py``), with the numbers each
edge rests on, for ``src/lib/models.ts``'s words.
"""
import json
import sys
from pathlib import Path

WRITE_R = 0.35
READ_S = 0.15


def bands(summary: Path, model: str):
    legible = json.loads((summary / f"legible_{model}.json").read_text())["neurons"]["layers"]
    causal = json.loads((summary / f"causal_lens_{model}.json").read_text())["targets"]["steer 1x"]
    lens = next(k for k in causal if k not in ("logit", "J"))  # the R-lens, whatever the run named it
    steer = causal[lens]["r_med"]
    last = len(steer) - 1
    write = next(L for L in range(last + 1) if all(r >= WRITE_R for r in steer[L:]))
    read_s = [row["read_S_net"] / max(1e-9, 1 - row["silent"]) for row in sorted(legible, key=lambda row: row["layer"])]
    smooth = [sorted(read_s[max(0, L - 1):L + 2])[len(read_s[max(0, L - 1):L + 2]) // 2] for L in range(len(read_s))]
    read = max(L for L, share in enumerate(smooth) if share >= READ_S) + 1
    if write > read:
        sys.exit(f"{model}: writes turn to the R-lens (L{write}) after reads do (L{read}): no middle band by this rule")
    return {"early": (0, write - 1), "middle": (write, read - 1), "late": (read, last)}, steer, read_s


def main():
    summary, model = Path(sys.argv[1]).expanduser(), sys.argv[2]
    found, steer, read_s = bands(summary, model)
    print(f'"bands": [{", ".join(f"({last}, {key!r})" for key, (_, last) in found.items())}],'.replace("'", '"'))
    for key, (first, last) in found.items():
        layers = range(first, last + 1)
        print(f"  {key:6s} L{first}-{last}: write r {min(steer[L] for L in layers):.2f}-{max(steer[L] for L in layers):.2f}, "
              f"in·S names the firing token for {min(read_s[L] for L in layers):.0%}-{max(read_s[L] for L in layers):.0%} of firing poles")


if __name__ == "__main__":
    main()

"""A model's depth bands, by which lens works on each side of its neurons.

    python3 scripts/neurons/bands.py ~/Work/neuron-lens/data/summary <model>
    python3 scripts/neurons/bands.py ~/Work/neuron-lens/data/summary <model> --ladder src/lib/ladder.json

Early layers are read through the S-lens on both sides: what drives a neuron and what it writes look
like input tokens. Middle layers still read through the S-lens, but write through the R-lens: what a
neuron writes already moves the output. Late layers are read through the R-lens on both sides. So two
edges set the bands, each measured on every layer by neuron-lens (findings §3, §7, §13):

- the R-lens starts working for writes at the first layer from which its read of a neuron's write
  predicts what steering the neuron does, at a median Pearson r of at least ``WRITE_R`` over the
  sampled poles, and stays there (``causal_lens_<model>.json``, steering at 1×);
- the input side turns to the R-lens once, at the first layer where its read of a pole's input names the
  token under its top firings for at least as many of the poles that fire as the S-lens's does, net of chance
  (``reads_at_firings_<model>.json``), and does so on at least half of the layers from there to the last; each
  share a running median over three layers, so one layer alone doesn't make a regime. The bands stay in order
  (a9's call, 2026-11-15): Qwen3-0.6B-Base's S-lens reads its last six layers better again (0.21-0.26 against
  0.14-0.19), and its input side still reads through the R-lens there. This gives Qwen3-8B's L9 and Gemma 4's L13,
  where the rule before it (the last layer where the S-lens names the token for 15% of firing poles) gave L9 and
  L14: Gemma 4's profile below has L14 until its catalog is next built. The smaller Qwen3 models never fall below
  15%, since both lenses read their inputs at every depth.

It prints the bands for the builder's profile (``build-neuron-catalog.py``), with the numbers each
edge rests on, for ``src/lib/models.ts``'s words. With ``--ladder``, it writes the model's whole
profile into that file instead, for the models whose words are made from their numbers (the Qwen3
sizes beside Qwen3-8B): its geometry and whether it is labelled (neuron-lens's ``release_<model>.json``: labels
of both sides among its released configs), its bands
with each band's numbers, and the two depths no check of its own measures yet, which take Qwen3-8B's
at the same relative depth: the layer from which a write's shape is read (§5, the 8B's L21) and the
last layer whose QK diagonal reads the query through the S-lens (§11, the 8B's L20).
"""
import json
import sys
from pathlib import Path

WRITE_R = 0.35
LATE_8B, SELF_8B, LAYERS_8B = 21, 20, 36


def bands(summary: Path, model: str):
    at_firings = json.loads((summary / f"reads_at_firings_{model}.json").read_text())["neurons"]["layers"]
    causal = json.loads((summary / f"causal_lens_{model}.json").read_text())["targets"]["steer 1x"]
    lens = next(k for k in causal if k not in ("logit", "J"))  # the R-lens, whatever the run named it
    steer = causal[lens]["r_med"]
    last = len(steer) - 1
    write = next(L for L in range(last + 1) if all(r >= WRITE_R for r in steer[L:]))
    rows = sorted(at_firings, key=lambda row: row["layer"])
    share = lambda key: [row[key] / max(1e-9, 1 - row["silent"]) for row in rows]  # of the poles that fire
    read_s, read_r = share("read_S_net"), share("read_R_net")
    med3 = lambda x: [sorted(x[max(0, L - 1):L + 2])[len(x[max(0, L - 1):L + 2]) // 2] for L in range(len(x))]
    s, r = med3(read_s), med3(read_r)
    wins = [r[L] >= s[L] for L in range(last + 1)]
    read = next((L for L in range(last + 1) if wins[L] and 2 * sum(wins[L:]) >= last + 1 - L), last + 1)
    if write > read:
        sys.exit(f"{model}: writes turn to the R-lens (L{write}) after reads do (L{read}): no middle band by this rule")
    numbers = {"write_r": steer, "read_s": read_s, "read_r": read_r, "write_s": share("write_S_net")}
    return {"early": (0, write - 1), "middle": (write, read - 1), "late": (read, last)}, numbers


def span(values, first, last, digits):
    picked = values[first:last + 1]
    return [round(min(picked), digits), round(max(picked), digits)]


def ladder(summary: Path, model: str, found, numbers) -> dict:
    """The model's profile, for ``src/lib/ladder.json``."""
    facts = json.loads((summary / f"release_{model}.json").read_text())
    name, layers = facts["model"].split("/")[-1], facts["layers"]
    size = name.removeprefix("Qwen3-").removesuffix("-Base")
    return {
        "name": name, "hub": facts["model"], "family": "Qwen3", "size": size, "base": name.endswith("-Base"),
        "layers": layers, "mlp": facts["neurons"], "heads": facts["heads"],
        "labelled": {f"{model}-neurons-labels", f"{model}-heads-labels"} <= {c[0] for c in facts.get("configs", [])},
        "bands": [{"key": key, "first": first, "last": last,
                   **{k: span(v, first, last, 2) for k, v in numbers.items()}}
                  for key, (first, last) in found.items() if last >= first],  # a small model's writes read through the R-lens from L0
        "late": round(LATE_8B / LAYERS_8B * layers), "self": round(SELF_8B / (LAYERS_8B - 1) * (layers - 1)),
    }


def main():
    summary, model = Path(sys.argv[1]).expanduser(), sys.argv[2]
    found, numbers = bands(summary, model)
    if "--ladder" in sys.argv:
        path = Path(sys.argv[sys.argv.index("--ladder") + 1])
        every = json.loads(path.read_text()) if path.exists() else {}
        every[model] = ladder(summary, model, found, numbers)
        path.write_text(json.dumps(dict(sorted(every.items(), key=lambda kv: (kv[1]["base"], float(kv[1]["size"][:-1])))),
                                   indent=1, ensure_ascii=False) + "\n")
        print(f"{model} in {path}: {json.dumps(every[model]['bands'])}")
        return
    print(f'"bands": [{", ".join(f"({last}, {key!r})" for key, (_, last) in found.items())}],'.replace("'", '"'))
    for key, (first, last) in found.items():
        layers = range(first, last + 1)
        if not layers:
            continue
        print(f"  {key:6s} L{first}-{last}: write r {min(numbers['write_r'][L] for L in layers):.2f}-{max(numbers['write_r'][L] for L in layers):.2f}, "
              f"in·S names the firing token for {min(numbers['read_s'][L] for L in layers):.0%}-{max(numbers['read_s'][L] for L in layers):.0%} of firing poles")


if __name__ == "__main__":
    main()

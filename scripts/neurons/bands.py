"""Each model's depth bands and reading plan, for the catalog's build and the site's words for each band.

    python3 scripts/neurons/bands.py ~/Work/neuron-lens/data/summary [<model> ...]

The bands are neuron-lens's (its ``data/summary/depth.json``, from ``arch.PLANS``; findings §8). Each model's reading
plan says which read a label card shows at each depth, set by blind ratings of each read's coherence, and its edges cut
the depth into sensory layers (the input read is the S-lens's: the literal tokens), association layers (the R-lens's,
which often names a concept associated with what drives the neuron rather than the tokens it fires on), workspace
layers, and motor layers (from where a write often names the next word). A base model takes its post-trained model's
plan. The plan also says which read the site lights on each side: the input read the card shows, the R-lens write read
at every depth, and a head's OV read by its plan's head line (the builder's ``neuron_lit``, ``head_header``).

This writes ``src/lib/depth.json``: for every model with a build (``src/lib/catalog.json``), the ones in
``ladder.json`` and any named, its plan, its bands, and per band the spans of the numbers its words cite, from
neuron-lens's census and steering checks: the share of firing poles whose in·S, in·R or out·R names the firing or the
next token, net of chance (``reads_at_firings_<model>.json``), and the median r between out·R and what steering at 1×
does (``causal_lens_<model>.json``). It also rewrites the profiles in ``src/lib/ladder.json`` (the Qwen3 sizes beside
Qwen3-8B, with any named), whose words are made from their numbers: geometry and whether it is labelled
(``release_<model>.json``: labels of both sides among its released configs), and the one depth no check of its own
measures yet, which takes Qwen3-8B's at the same relative depth: the last layer whose QK diagonal reads the query
through the S-lens (§10, the 8B's L20).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEPTH, LADDER, CATALOG = ROOT / "src/lib/depth.json", ROOT / "src/lib/ladder.json", ROOT / "src/lib/catalog.json"
SELF_8B, LAYERS_8B = 20, 36
OWN_PROFILE = {"qwen3-8b", "gemma-4-12b"}  # profiles written out in the builder and models.ts


def numbers(summary: Path, model: str) -> dict:
    """Per layer: the census's shares of firing poles, and steering's median r."""
    rows = sorted(json.loads((summary / f"reads_at_firings_{model}.json").read_text())["neurons"]["layers"],
                  key=lambda row: row["layer"])
    causal = json.loads((summary / f"causal_lens_{model}.json").read_text())["targets"]["steer 1x"]
    lens = next(k for k in causal if k not in ("logit", "J"))  # the R-lens, whatever the run named it
    share = lambda key: [row[key] / max(1e-9, 1 - row["silent"]) for row in rows]  # of the poles that fire
    return {"read_s": share("read_S_net"), "read_r": share("read_R_net"), "next_r": share("write_R_net"),
            "write_r": causal[lens]["r_med"]}


def span(values, first, last, digits=2):
    picked = values[first:last + 1]
    return [round(min(picked), digits), round(max(picked), digits)]


def depth(summary: Path, model: str, plans: dict) -> dict:
    entry = plans[model.removesuffix("-base")]
    nums = numbers(summary, model)
    assert len(nums["write_r"]) == entry["plan"]["layers"], f"{model}: summaries and plan disagree on its layers"
    return {"plan": entry["plan"], "bands": [{"key": b["role"], "first": b["first"], "last": b["last"],
                                              **{k: span(v, b["first"], b["last"]) for k, v in nums.items()}}
                                             for b in entry["bands"]]}


def ladder(summary: Path, model: str, plan: dict) -> dict:
    """The model's profile, for ``src/lib/ladder.json``."""
    facts = json.loads((summary / f"release_{model}.json").read_text())
    name, layers = facts["model"].split("/")[-1], facts["layers"]
    assert layers == plan["layers"], f"{model}: release and plan disagree on its layers"
    return {
        "name": name, "hub": facts["model"], "family": "Qwen3", "size": name.removeprefix("Qwen3-").removesuffix("-Base"),
        "base": name.endswith("-Base"), "layers": layers, "mlp": facts["neurons"], "heads": facts["heads"],
        "labelled": {f"{model}-neurons-labels", f"{model}-heads-labels"} <= {c[0] for c in facts.get("configs", [])},
        "self": round(SELF_8B / (LAYERS_8B - 1) * (layers - 1)),
    }


def main():
    summary, named = Path(sys.argv[1]).expanduser(), sys.argv[2:]
    plans = json.loads((summary / "depth.json").read_text())
    old_ladder = json.loads(LADDER.read_text()) if LADDER.exists() else {}
    built = json.loads(CATALOG.read_text())["builds"]
    models = sorted({*built, *old_ladder, *named})
    out = {m: depth(summary, m, plans) for m in models}
    DEPTH.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    for m, d in out.items():
        print(f"{m}: " + ", ".join(f"{b['key']} L{b['first']}-{b['last']}" for b in d["bands"]))
    rungs = {m: ladder(summary, m, out[m]["plan"]) for m in sorted({*old_ladder, *named} - OWN_PROFILE)}
    LADDER.write_text(json.dumps(dict(sorted(rungs.items(), key=lambda kv: (kv[1]["base"], float(kv[1]["size"][:-1])))),
                                 indent=1, ensure_ascii=False) + "\n")
    print(f"{DEPTH.relative_to(ROOT)}: {len(out)} models; {LADDER.relative_to(ROOT)}: {len(rungs)}")


if __name__ == "__main__":
    main()

"""Each neuron's counterpart across a pruning, for the explorer: Qwen3-4B and Qwen3-0.6B are pruned from Qwen3-8B and
Qwen3-1.7B (neuron-lens findings §20), so a neuron of the smaller model has a parent and one of the larger a child.

    python3 scripts/neurons/lineage.py ~/Work/neuron-lens/data/catalog catalog/lineage

It reads the neuron-lens catalogs' ``lineage`` tables (``scripts/checks/lineage.py table``) of the four post-trained
models and writes ``<model>.bin`` for each, with ``index.json``. A file holds a record per neuron, layer by layer, of
``RECORD`` bytes: the other model's neuron (uint16 little-endian, ``NONE`` where there is none) and its status
(``STATUS``'s index, a byte), then a spare byte. The pruned models' records name a parent, their parents' a child. A
pole maps to the same pole, and a base model has its post-trained model's file, since post-training keeps the indices
(``src/lib/models.ts`` pairs them). ``scripts/catalog/upload.sh lineage`` puts the folder on R2 as a build of its own
and names it in ``src/lib/catalog.json``'s ``lineage``, so no model's build changes with it.
"""
import json
import sys
from pathlib import Path

import pyarrow.parquet as pq

PAIRS = {"qwen3-4b": "qwen3-8b", "qwen3-0.6b": "qwen3-1.7b"}  # pruned model: its parent
STATUS = ("", "identified", "supported", "provisional", "near-silent", "cut")
RECORD, NONE = 4, 0xFFFF


def records(folder: Path, side: str) -> tuple[bytes, dict, int, int]:
    """A model's file: each neuron's ``side`` (parent or child) and its status, with the status counts."""
    layers = sorted(folder.glob("L*.parquet"))
    out, counts, width = bytearray(), {}, 0
    for path in layers:
        t = pq.read_table(path, columns=[f"{side}_neuron", f"{side}_status", "pole"])
        plus = t.filter(t.column("pole").to_numpy() > 0)  # both poles of a neuron share its counterpart
        neurons, statuses = plus.column(f"{side}_neuron").to_pylist(), plus.column(f"{side}_status").to_pylist()
        width = width or len(neurons)
        assert len(neurons) == width, f"{path}: {len(neurons)} neurons, {width} before"
        for n, s in zip(neurons, statuses):
            out += (NONE if n < 0 else n).to_bytes(2, "little") + bytes([STATUS.index(s), 0])
            counts[s] = counts.get(s, 0) + 1
    return bytes(out), counts, len(layers), width


def main():
    catalog, out = Path(sys.argv[1]).expanduser(), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    index = {"record": RECORD, "none": NONE, "status": list(STATUS), "pairs": PAIRS, "models": {}}
    for child, parent in PAIRS.items():
        for model, side in ((child, "parent"), (parent, "child")):
            data, counts, layers, width = records(catalog / model / "neurons" / "lineage", side)
            (out / f"{model}.bin").write_bytes(data)
            index["models"][model] = {"side": side, "layers": layers, "mlp": width, "counts": counts}
            print(f"{model}: {layers} × {width:,} neurons, {len(data) / 1e6:.2f} MB; {side}: "
                  + ", ".join(f"{k} {v:,}" for k, v in counts.items()))
    (out / "index.json").write_text(json.dumps(index, indent=1) + "\n")


if __name__ == "__main__":
    main()

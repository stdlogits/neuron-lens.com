#!/usr/bin/env bash
# Upload a model's built catalog (catalog/<model>, from scripts/neurons) to R2, where the site reads it,
# and name the build in src/lib/catalog.json for the next deploy.
#
#   scripts/catalog/upload.sh qwen3-8b [gemma-4-12b …]
#   scripts/catalog/upload.sh --dry-run qwen3-8b      name the build and count what would go up
#   scripts/catalog/upload.sh lineage                 the pruned pairs' neuron links (scripts/neurons/lineage.py),
#                                                     named in catalog.json's lineage rather than its builds
#
# Every file is an object named by its contents, o/<the first 20 hex digits of its SHA-256><its extension>,
# and a build is a manifest from each of its files' paths to its object, <model>/<build>.json, the build
# being the first 12 hex digits of the manifest's own hash. Neither ever changes, so both are cached for
# good, and the site moves to a new build only with the deploy that names it: a graph record and the units
# pack it points into always come from the same build. A file a new build shares with any build sent
# before, its own model's or another's, is the same object and isn't sent again: objects already up are
# logged in catalog/.uploads/objects.log, so an interrupted upload picks up where it stopped. The manifest,
# which the explorer reads first, goes last. Older builds and the objects only they name stay in the
# bucket until deleted.
#
# The bucket, neuron-lens-data in a9's account, is served at https://data.neuron-lens.com (a custom domain
# on the zone), with the CORS rules in scripts/catalog/cors.json (`wrangler r2 bucket cors set
# neuron-lens-data --file scripts/catalog/cors.json`; any origin, so that every answer, and so every
# copy the edge caches, carries Access-Control-Allow-Origin) and scripts/catalog/robots.txt, which
# every run puts back. Wrangler signs in as scripts/wrangler.sh says; UPLOAD_JOBS sets how many files go at once (8).

set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=../wrangler.sh
source scripts/wrangler.sh

BUCKET=neuron-lens-data
CACHE="public, max-age=31536000, immutable"
JOBS=${UPLOAD_JOBS:-8}
SENT=catalog/.uploads/objects.log

dry_run=0
models=()
while (($#)); do
  case "$1" in
    --dry-run) dry_run=1 ;;
    -*) echo "upload: unknown option $1" >&2; exit 2 ;;
    *) models+=("$1") ;;
  esac
  shift
done
((${#models[@]})) || { echo "usage: scripts/catalog/upload.sh [--dry-run] <model>..." >&2; exit 2; }
[[ "$dry_run" == 1 ]] || require_account upload
origin=$(node -p 'require("./src/lib/catalog.json").origin')
mkdir -p catalog/.uploads
touch "$SENT"

# One object, its type from its name, cached for good; logged once it is up, so a rerun skips it. A put that
# fails (a slow link times one out) is tried twice more, a minute apart.
put() {
  local object=$1 file=$2 type=application/octet-stream out try
  [[ "$object" == *.json ]] && type="application/json; charset=utf-8"
  for try in 1 2 3; do
    if out=$(wrangler r2 object put "$BUCKET/$object" --file "$file" --content-type "$type" --cache-control "$CACHE" --remote 2>&1); then
      if [[ "$object" == o/* ]]; then echo "${object#o/}" >> "$SENT"; fi
      return 0
    fi
    [[ $try == 3 ]] || sleep 60
  done
  printf 'upload: %s (%s) failed three times (rerun to resume):\n%s\n' "$object" "$file" "$(tail -5 <<< "$out")" >&2
  return 1
}
export -f put
export BUCKET CACHE SENT

if [[ "$dry_run" == 0 ]]; then
  wrangler r2 object put "$BUCKET/robots.txt" --file scripts/catalog/robots.txt --content-type "text/plain; charset=utf-8" \
    --cache-control "public, max-age=14400" --remote > /dev/null
fi

for model in "${models[@]}"; do
  dir=catalog/$model
  [[ -f "$dir/index.json" ]] || { echo "upload: $dir is missing; build it first (AGENTS.md, The catalog)" >&2; exit 1; }
  echo "upload: hashing $model's build ($(du -sh "$dir" | cut -f1))"
  # path → object, as the manifest; and the objects not up yet, as "object<TAB>file", one per object.
  (cd "$dir" && find . -type f ! -name '.*' | sed 's#^\./##' | LC_ALL=C sort | tr '\n' '\0' | xargs -0 shasum -a 256) > "$WRANGLER_SCRATCH/sums"
  node -e '
    const fs = require("fs"), path = require("path"), [sums, sent, dir, manifestOut, leftOut] = process.argv.slice(1);
    const up = new Set(fs.readFileSync(sent, "utf8").split("\n").filter(Boolean));
    const manifest = {}, left = new Map();
    for (const line of fs.readFileSync(sums, "utf8").split("\n").filter(Boolean)) {
      const [hash, file] = [line.slice(0, 64), line.slice(66)];
      const object = hash.slice(0, 20) + path.extname(file);
      manifest[file] = object;
      if (!up.has(object) && !left.has(object)) left.set(object, path.join(dir, file));
    }
    fs.writeFileSync(manifestOut, JSON.stringify(manifest));
    fs.writeFileSync(leftOut, [...left].map(([o, f]) => `o/${o}\t${f}`).join("\n") + (left.size ? "\n" : ""));
  ' "$WRANGLER_SCRATCH/sums" "$SENT" "$dir" "$WRANGLER_SCRATCH/manifest.json" "$WRANGLER_SCRATCH/left"
  build=$(shasum -a 256 < "$WRANGLER_SCRATCH/manifest.json" | cut -c1-12)
  total=$(wc -l < "$WRANGLER_SCRATCH/sums" | tr -d ' ')
  left=$(wc -l < "$WRANGLER_SCRATCH/left" | tr -d ' ')
  bytes=$(cut -f2 "$WRANGLER_SCRATCH/left" | tr '\n' '\0' | xargs -0 stat -f %z 2>/dev/null | awk '{ s += $1 } END { printf "%.2f GB", s / 1e9 }')
  echo "upload: $model build $build: $total files, $left objects to send ($bytes); the rest are up already"
  [[ "$dry_run" == 1 ]] && continue

  tr '\t\n' '\0\0' < "$WRANGLER_SCRATCH/left" | xargs -0 -n 2 -P "$JOBS" bash -c 'put "$1" "$2"' _
  # The log says what was sent, not what is still there (old builds' objects may have been deleted since): every
  # object the manifest names must answer before the manifest goes up. One that doesn't leaves the log, to be sent
  # on the next run.
  node -p 'Object.values(require(process.argv[1])).filter((o, i, all) => all.indexOf(o) === i).join("\n")' "$WRANGLER_SCRATCH/manifest.json" \
    | xargs -P 16 -I{} sh -c 'code=$(curl -s -o /dev/null -I -w "%{http_code}" "$0/o/{}"); [ "$code" = 200 ] || echo "{}"' "$origin" > "$WRANGLER_SCRATCH/gone"
  if [[ -s "$WRANGLER_SCRATCH/gone" ]]; then
    grep -vxF -f "$WRANGLER_SCRATCH/gone" "$SENT" > "$WRANGLER_SCRATCH/sent" || true
    mv "$WRANGLER_SCRATCH/sent" "$SENT"
    echo "upload: $(wc -l < "$WRANGLER_SCRATCH/gone" | tr -d ' ') objects $model names aren't on R2 (deleted since they were sent); rerun to send them" >&2
    exit 1
  fi
  put "$model/$build.json" "$WRANGLER_SCRATCH/manifest.json"

  for path in "$model/$build.json" "o/$(node -p 'require(process.argv[1])["index.json"]' "$WRANGLER_SCRATCH/manifest.json")"; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$origin/$path")
    [[ "$code" == 200 ]] || { echo "upload: $origin/$path answers $code" >&2; exit 1; }
  done
  node -e 'const fs = require("fs"), p = "src/lib/catalog.json", c = JSON.parse(fs.readFileSync(p, "utf8"));
    if (process.argv[1] === "lineage") c.lineage = process.argv[2]; else c.builds[process.argv[1]] = process.argv[2];
    fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");' "$model" "$build"
  echo "upload: $model is up at $origin/$model/$build.json; src/lib/catalog.json names it: commit, push and deploy"
done

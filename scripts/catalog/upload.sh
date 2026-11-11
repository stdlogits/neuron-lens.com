#!/usr/bin/env bash
# Upload a model's built catalog (catalog/<model>, from scripts/neurons) to R2, where the site reads it,
# and name the build in src/lib/catalog.json for the next deploy.
#
#   scripts/catalog/upload.sh qwen3-8b [gemma-4-12b …]
#   scripts/catalog/upload.sh --dry-run qwen3-8b      name the build and count what would go up
#
# Each build goes under a prefix of its own, <model>/<build>/, where the build is the first 12 hex digits
# of a hash over every file's path and contents. A build's files never change, so they are cached for
# good, and the site moves to a new build only with the deploy that names it: a graph record and the
# units pack it points into always come from the same build. An interrupted upload picks up where it
# stopped (each file sent is logged in catalog/.uploads/<model>-<build>.log), and index.json, which the
# explorer reads first, goes last. Older builds stay in the bucket until deleted.
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

# One file of a build, its type from its name, cached for good; logged once it is up, so a rerun skips it.
put() {
  local rel=$1 type=application/octet-stream out
  [[ "$rel" == *.json ]] && type="application/json; charset=utf-8"
  if out=$(wrangler r2 object put "$BUCKET/$MODEL/$BUILD/$rel" --file "catalog/$MODEL/$rel" --content-type "$type" --cache-control "$CACHE" --remote 2>&1); then
    echo "$rel" >> "catalog/.uploads/$MODEL-$BUILD.log"
  else
    printf 'upload: %s/%s failed (rerun to resume):\n%s\n' "$MODEL" "$rel" "$(tail -5 <<< "$out")" >&2
    return 1
  fi
}
export -f put
export BUCKET CACHE

if [[ "$dry_run" == 0 ]]; then
  wrangler r2 object put "$BUCKET/robots.txt" --file scripts/catalog/robots.txt --content-type "text/plain; charset=utf-8" \
    --cache-control "public, max-age=14400" --remote > /dev/null
fi

for model in "${models[@]}"; do
  dir=catalog/$model
  [[ -f "$dir/index.json" ]] || { echo "upload: $dir is missing; build it first (AGENTS.md, The catalog)" >&2; exit 1; }
  echo "upload: naming $model's build (hashing $(du -sh "$dir" | cut -f1))"
  build=$(cd "$dir" && find . -type f ! -name '.*' -print0 | LC_ALL=C sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-12)
  mkdir -p catalog/.uploads
  log=catalog/.uploads/$model-$build.log
  touch "$log"
  (cd "$dir" && find . -type f ! -name '.*' | sed 's#^\./##' | LC_ALL=C sort) > "$WRANGLER_SCRATCH/all"
  grep -vxF -f "$log" "$WRANGLER_SCRATCH/all" > "$WRANGLER_SCRATCH/left" || true
  total=$(wc -l < "$WRANGLER_SCRATCH/all" | tr -d ' ')
  left=$(wc -l < "$WRANGLER_SCRATCH/left" | tr -d ' ')
  bytes=$( (cd "$dir" && tr '\n' '\0' < "$WRANGLER_SCRATCH/left" | xargs -0 stat -f %z 2>/dev/null) | awk '{ s += $1 } END { printf "%.2f GB", s / 1e9 }')
  echo "upload: $model build $build: $left of $total files to send, $bytes"
  [[ "$dry_run" == 1 ]] && continue

  export MODEL=$model BUILD=$build
  grep -vx index.json "$WRANGLER_SCRATCH/left" | tr '\n' '\0' | xargs -0 -n 1 -P "$JOBS" bash -c 'put "$1"' _
  if grep -qx index.json "$WRANGLER_SCRATCH/left"; then put index.json; fi

  code=$(curl -s -o /dev/null -w '%{http_code}' "$origin/$model/$build/index.json")
  [[ "$code" == 200 ]] || { echo "upload: $origin/$model/$build/index.json answers $code" >&2; exit 1; }
  node -e 'const fs = require("fs"), p = "src/lib/catalog.json", c = JSON.parse(fs.readFileSync(p, "utf8"));
    c.builds[process.argv[1]] = process.argv[2]; fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");' "$model" "$build"
  echo "upload: $model is up at $origin/$model/$build/; src/lib/catalog.json names it: commit, push and deploy"
done

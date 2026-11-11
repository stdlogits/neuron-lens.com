#!/usr/bin/env bash
# Deploy neuron-lens.com to Cloudflare Pages (project neuron-lens, production branch main): build from a
# clean, pushed HEAD, upload dist with Wrangler, then verify the live site against that build. The
# catalog isn't in the build: the site reads each model's build from R2, as src/lib/catalog.json names
# it, so upload a new catalog first (scripts/catalog/upload.sh) and commit what it names.
#
#   scripts/deploy.sh                        check, build, upload, verify https://neuron-lens.com
#   scripts/deploy.sh --dry-run              check and build only (an unpushed tree only warns)
#   scripts/deploy.sh --origin https://…     verify another origin (a pages.dev preview, say)
#
# The site lives in a9's own Cloudflare account, not the one that hosts drowse.ai. Before the first
# deploy, in that account: create the Pages project (`wrangler pages project create neuron-lens
# --production-branch main`, or Workers & Pages in the dashboard) and attach neuron-lens.com to it as a
# custom domain. The CSP allows Cloudflare Web Analytics' injected beacon (static.cloudflareinsights.com,
# reporting to cloudflareinsights.com); leave Rocket Loader and email obfuscation off, since they add
# inline scripts the CSP blocks. Wrangler's account and sign-in are scripts/wrangler.sh's.

set -euo pipefail
cd "$(dirname "$0")/.."

dry_run=0
origin=https://neuron-lens.com
while (($#)); do
  case "$1" in
    --dry-run) dry_run=1 ;;
    --origin) origin=${2:?--origin needs a URL}; shift ;;
    --origin=*) origin=${1#--origin=} ;;
    *) echo "deploy: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

# shellcheck source=wrangler.sh
source scripts/wrangler.sh
[[ "$dry_run" == 1 ]] || require_account deploy

# The upload records HEAD as its commit, so HEAD must be committed and on origin/main. A dry run
# only warns.
refuse() {
  if [[ "$dry_run" == 1 ]]; then echo "deploy (dry run): $1" >&2; else echo "deploy: $1" >&2; exit 1; fi
}
[[ -z "$(git status --porcelain)" ]] || refuse 'commit or stash your changes first; the deploy records HEAD'
if ! git fetch --quiet origin main || ! git merge-base --is-ancestor HEAD origin/main; then
  refuse 'push HEAD to origin/main first'
fi
rev=$(git rev-parse HEAD)

# Every build src/lib/catalog.json names must already be on R2, or the site would point at nothing.
data=$(node -p 'require("./src/lib/catalog.json").origin')
while read -r model build; do
  [[ -n "$build" ]] || { echo "deploy: src/lib/catalog.json names no build for $model; upload one (scripts/catalog/upload.sh $model)" >&2; exit 1; }
  code=$(curl -s -o /dev/null -w '%{http_code}' "$data/$model/$build/index.json")
  [[ "$code" == 200 ]] || { echo "deploy: $data/$model/$build/index.json answers $code; upload it (scripts/catalog/upload.sh $model)" >&2; exit 1; }
  cors=$(curl -s -o /dev/null -D - "$data/$model/$build/index.json" | tr -d '\r' | awk -F': ' 'tolower($1) == "access-control-allow-origin" { print $2 }')
  [[ "$cors" == "*" ]] || { echo "deploy: $data answers without Access-Control-Allow-Origin: *, so cached files would be refused; the bucket's CORS must allow any origin (scripts/catalog/cors.json; AGENTS.md, On R2)" >&2; exit 1; }
done < <(node -e 'for (const [model, build] of Object.entries(require("./src/lib/catalog.json").builds)) console.log(model, build)')

npm ci
npm run check
npm run build
[[ -f dist/index.html ]] || { echo 'deploy: the build made no dist/index.html' >&2; exit 1; }

# Cloudflare Pages takes at most 20,000 files (Free plan) and 25 MiB a file.
files=$(find dist -type f | wc -l | tr -d ' ')
if ((files >= 20000)); then
  echo "deploy: dist has $files files; Pages takes fewer than 20,000" >&2
  exit 1
fi
big=$(find dist -type f -size +26214400c)
if [[ -n "$big" ]]; then
  echo "deploy: these files are over Pages' 25 MiB limit:" >&2
  echo "$big" >&2
  exit 1
fi
echo "deploy: dist has $files files, $(du -sh dist | cut -f1), none over 25 MiB"

[[ "$dry_run" == 1 ]] && exit 0

echo "deploy: signing in with $WRANGLER_SIGNIN"
wrangler pages deploy dist --project-name neuron-lens --branch main \
  --commit-hash "$rev" --commit-message "$(git log -1 --format=%s)" --commit-dirty=false

node scripts/verify-deployment.mjs "$origin" --build dist

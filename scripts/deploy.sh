#!/usr/bin/env bash
# Deploy neuron-lens.com to Cloudflare Pages (project neuron-lens, production branch main): build from a
# clean, pushed HEAD with the catalog in public/data, upload dist with Wrangler, then verify the live
# site against that build.
#
#   scripts/deploy.sh                        check, build, upload, verify https://neuron-lens.com
#   scripts/deploy.sh --dry-run              check and build only (an unpushed tree only warns)
#   scripts/deploy.sh --origin https://…     verify another origin (a pages.dev preview, say)
#
# The site lives in a9's own Cloudflare account, not the one that hosts drowse.ai. Before the first
# deploy, in that account: create the Pages project (`wrangler pages project create neuron-lens
# --production-branch main`, or Workers & Pages in the dashboard) and attach neuron-lens.com to it as a
# custom domain. Leave the zone's Web Analytics injection, Rocket Loader and email obfuscation off:
# each puts an inline script in the HTML, which the CSP blocks.
#
# Credentials come only from the environment: CLOUDFLARE_API_TOKEN (Account > Cloudflare Pages >
# Edit) and CLOUDFLARE_ACCOUNT_ID. This machine's `wrangler login` belongs to the other account, so
# Wrangler runs here with an empty home and never sees it.

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

if [[ "$dry_run" == 0 ]]; then
  for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
    if [[ -z "${!name:-}" ]]; then
      echo "deploy: set $name (a9's account; see the top of this script)" >&2
      exit 1
    fi
  done
fi

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

# The catalog is gitignored and built separately (AGENTS.md, "The catalog"); an upload without it
# would take the explorer's data off the site.
for model in qwen3-8b gemma-4-12b; do
  if [[ ! -f "public/data/$model/index.json" ]]; then
    echo "deploy: public/data/$model is missing; build it first (AGENTS.md, The catalog)" >&2
    exit 1
  fi
done

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

# Wrangler with an empty home: no saved login, no other account to fall back to.
wrangler_home=$(mktemp -d)
trap 'rm -rf "$wrangler_home"' EXIT
env -u CLOUDFLARE_API_KEY -u CLOUDFLARE_EMAIL \
  HOME="$wrangler_home" XDG_CONFIG_HOME="$wrangler_home/config" WRANGLER_SEND_METRICS=false \
  ./node_modules/.bin/wrangler pages deploy dist --project-name neuron-lens --branch main \
  --commit-hash "$rev" --commit-message "$(git log -1 --format=%s)" --commit-dirty=false

node scripts/verify-deployment.mjs "$origin" --build dist

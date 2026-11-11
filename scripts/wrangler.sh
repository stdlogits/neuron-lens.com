# Sourced by scripts/deploy.sh and scripts/catalog/upload.sh: which Cloudflare account Wrangler acts on,
# and how it signs in. Defines `wrangler` (exported, so parallel uploads can call it) and `require_account`.
#
# Which account: CLOUDFLARE_ACCOUNT_ID, from the environment or from ~/.config/cloudflare/neuron-lens.env
# (outside the repo; NEURON_LENS_DEPLOY_ENV names another file). It is required, because the Cloudflare
# user this machine is logged in as also reaches the account that hosts drowse.ai: every Wrangler call
# here is pinned to that one ID. How to sign in: with CLOUDFLARE_API_TOKEN (Account > Cloudflare Pages >
# Edit, and Workers R2 Storage > Edit for the catalog) Wrangler runs on that token alone, with an empty
# home; without one it uses this machine's `wrangler login`. Either way it sees no other credential
# variable (it also honours CF_API_KEY/CF_EMAIL and prefers a global key to a token), and an empty .env in
# place of any in the repo.

config=${NEURON_LENS_DEPLOY_ENV:-$HOME/.config/cloudflare/neuron-lens.env}
if [[ -f "$config" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$config"
  set +a
fi

require_account() {
  [[ "${CLOUDFLARE_ACCOUNT_ID:-}" =~ ^[0-9a-f]{32}$ ]] && return
  echo "$1: set CLOUDFLARE_ACCOUNT_ID to a9's account (in $config or the environment; see scripts/wrangler.sh)" >&2
  exit 1
}

WRANGLER_SCRATCH=$(mktemp -d)
trap 'rm -rf "$WRANGLER_SCRATCH"' EXIT
: > "$WRANGLER_SCRATCH/empty.env"
WRANGLER_BIN="$PWD/node_modules/.bin/wrangler"
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then WRANGLER_SIGNIN=CLOUDFLARE_API_TOKEN; else WRANGLER_SIGNIN="this machine's wrangler login"; fi
export WRANGLER_SCRATCH WRANGLER_BIN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN

wrangler() {
  local auth=(HOME="$HOME")
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    auth=(HOME="$WRANGLER_SCRATCH" XDG_CONFIG_HOME="$WRANGLER_SCRATCH/config" CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN")
  fi
  env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" LANG="${LANG:-en_US.UTF-8}" WRANGLER_SEND_METRICS=false \
    CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" "${auth[@]}" "$WRANGLER_BIN" "$@" --env-file "$WRANGLER_SCRATCH/empty.env"
}
export -f wrangler

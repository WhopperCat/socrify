#!/bin/bash
set -e

# Required secrets — must be non-empty in the deploying environment.
# Pushing an empty secret silently bricks features (e.g. an empty
# SUPABASE_ANON_KEY makes /config.js serve "", which disables auth
# entirely on the client with a cryptic "Auth not configured" error).
REQUIRED_SECRETS=(
  ANTHROPIC_API_KEY
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_ANON_KEY
  IP_HASH_SALT
  STRIPE_SECRET_KEY
  STRIPE_PUBLISHABLE_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRO_PRICE_ID
)

missing=()
for name in "${REQUIRED_SECRETS[@]}"; do
  if [ -z "${!name}" ]; then
    missing+=("$name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "ERROR: refusing to deploy — these required env vars are empty or unset:" >&2
  for name in "${missing[@]}"; do
    echo "  - $name" >&2
  done
  echo "" >&2
  echo "Set them in your CI/CD secret store (or your local shell) and re-run." >&2
  exit 1
fi

# Deploy code first — wrangler secret put fails if there's an undeployed version pending.
npx wrangler deploy

# Now inject secrets from CI/CD environment variables as Worker runtime bindings.
for name in "${REQUIRED_SECRETS[@]}"; do
  printf '%s' "${!name}" | npx wrangler secret put "$name"
done

#!/bin/bash
set -e

# Deploy code first — wrangler secret put fails if there's an undeployed version pending.
npx wrangler deploy

# Now inject secrets from CI/CD environment variables as Worker runtime bindings.
echo "$ANTHROPIC_API_KEY"          | npx wrangler secret put ANTHROPIC_API_KEY
echo "$SUPABASE_URL"               | npx wrangler secret put SUPABASE_URL
echo "$SUPABASE_SERVICE_ROLE_KEY"  | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
echo "$IP_HASH_SALT"               | npx wrangler secret put IP_HASH_SALT

#!/bin/bash
set -e

# Push CI/CD env vars as Worker runtime secrets before each deploy.
# Without this, wrangler deploy uploads code only — secrets are never set.
echo "$ANTHROPIC_API_KEY"          | npx wrangler secret put ANTHROPIC_API_KEY
echo "$SUPABASE_URL"               | npx wrangler secret put SUPABASE_URL
echo "$SUPABASE_SERVICE_ROLE_KEY"  | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
echo "$IP_HASH_SALT"               | npx wrangler secret put IP_HASH_SALT

npx wrangler deploy

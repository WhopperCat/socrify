#!/bin/bash
# Shim for Cloudflare Workers Builds, which runs `bash deploy.sh` from the repo
# root. The real script lives in scripts/ after the repo reorg.
set -e
exec bash "$(dirname "$0")/scripts/deploy.sh" "$@"

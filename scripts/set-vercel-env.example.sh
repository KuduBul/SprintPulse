#!/bin/bash
#
# Seeds the linked Vercel project's PRODUCTION environment variables.
#
# This is the SANITISED template. It contains NO secrets. The real script
# (scripts/set-vercel-env.sh) is gitignored and must never be committed.
#
# Usage:
#   1. Copy this file:   cp scripts/set-vercel-env.example.sh scripts/set-vercel-env.sh
#   2. Provide the real values WITHOUT hardcoding them in the script. Either:
#        a) export them in your shell, or
#        b) put them in an untracked, gitignored env file and `source` it, e.g.
#             set -a; source .env.vercel.production.local; set +a
#   3. Run:              bash scripts/set-vercel-env.sh
#
# Required variables (read from the environment, not written here):
#   DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# Optional (have in-app defaults):
#   RETENTION_RESPONSES_DAYS, RETENTION_AUDIT_DAYS, POLL_INTERVAL_MS
#
# NOTE: ADMIN_SECRET is intentionally omitted — it is obsolete (replaced by
# Supabase Auth) and is no longer read by any application code.

set -euo pipefail

VERCEL="${VERCEL:-npx vercel}"

# Adds a single production env var, reading the VALUE from the environment.
# Fails loudly if the variable is unset, so we never push an empty secret.
add_env () {
  local NAME="$1"
  local VALUE="${!NAME:-}"
  if [ -z "$VALUE" ]; then
    echo "ERROR: environment variable '$NAME' is not set — refusing to push an empty value." >&2
    exit 1
  fi
  # Remove existing var (ignore failure if not present), then add.
  echo "y" | $VERCEL env rm "$NAME" production >/dev/null 2>&1 || true
  printf '%s' "$VALUE" | $VERCEL env add "$NAME" production >/dev/null 2>&1
  echo "set $NAME"
}

add_env DATABASE_URL
add_env DIRECT_URL
add_env SUPABASE_URL
add_env SUPABASE_SERVICE_ROLE_KEY
add_env NEXT_PUBLIC_SUPABASE_URL
add_env NEXT_PUBLIC_SUPABASE_ANON_KEY
add_env RETENTION_RESPONSES_DAYS
add_env RETENTION_AUDIT_DAYS
add_env POLL_INTERVAL_MS

echo "DONE"

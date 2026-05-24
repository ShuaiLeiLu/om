#!/usr/bin/env sh
set -eu

# Backward-compatible entrypoint.
# This script now delegates to deploy-prod.sh to support dual-container release.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/deploy-prod.sh" "$@"

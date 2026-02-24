#!/usr/bin/env bash
# One-time setup: create .env and dirs for Docker Compose on the host.
# Run this in the same directory as docker-compose.yml (e.g. ~/openclaw on the VPS).
# Usage: bash scripts/docker-env-setup.sh [base_dir]
# Example: bash scripts/docker-env-setup.sh /home/admin/openclaw-data

set -e
BASE="${1:-$HOME/openclaw-data}"
CONFIG_DIR="$BASE"
WORKSPACE_DIR="$BASE/workspace"

# Reject placeholder paths (e.g. /caminho/que/ja/usa/o/gateway from docs)
if [[ "$BASE" == *"/caminho/"* ]] || [[ "$BASE" == "/caminho"* ]]; then
  echo "Error: use a real path, not the placeholder. Example: $HOME/openclaw-data or /home/admin/openclaw-data"
  exit 1
fi

mkdir -p "$CONFIG_DIR" "$WORKSPACE_DIR"

if [ -f .env ] && grep -q OPENCLAW_CONFIG_DIR .env 2>/dev/null; then
  echo ".env already has OPENCLAW_CONFIG_DIR; skipping."
  exit 0
fi

cat >> .env << EOF

# Docker Compose volume paths (added by docker-env-setup.sh)
OPENCLAW_CONFIG_DIR=$CONFIG_DIR
OPENCLAW_WORKSPACE_DIR=$WORKSPACE_DIR
EOF
echo "Created dirs and appended to .env: OPENCLAW_CONFIG_DIR=$CONFIG_DIR, OPENCLAW_WORKSPACE_DIR=$WORKSPACE_DIR"

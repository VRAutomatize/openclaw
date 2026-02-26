#!/usr/bin/env bash
# Rebuild OpenClaw no VPS: pull, build image, recria o container gateway.
# Rodar na VPS (ex.: após ssh admin@vps) de dentro do repo:
#   cd ~/openclaw && ./scripts/vps-rebuild.sh
# Ou via SSH a partir da sua máquina:
#   ssh admin@vps 'cd ~/openclaw && git pull --rebase && ./scripts/vps-rebuild.sh'
set -euo pipefail

REPO_DIR="${OPENCLAW_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_DIR"

COMPOSE_FILES="-f docker-compose.yml"
GATEWAY_SERVICE="openclaw-gateway"
if [[ -f docker-compose.extra.yml ]]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.extra.yml"
fi
if [[ -n "${OPENCLAW_STATE_DIR:-}" && -n "${OPENCLAW_ENV_FILE:-}" && -f docker-compose.vps.yml ]]; then
  COMPOSE_FILES="-f docker-compose.vps.yml"
  GATEWAY_SERVICE="openclaw"
fi

echo "==> Build da imagem em $REPO_DIR"
docker build -t openclaw:local -t openclaw-vra:latest -f Dockerfile .

echo "==> Recriando container gateway ($GATEWAY_SERVICE)"
docker compose $COMPOSE_FILES up -d --force-recreate "$GATEWAY_SERVICE"

echo "==> Rebuild concluído. Verificar: docker compose $COMPOSE_FILES ps && docker compose $COMPOSE_FILES logs $GATEWAY_SERVICE --tail 30"

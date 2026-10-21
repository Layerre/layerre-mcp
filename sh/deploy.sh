#!/usr/bin/env bash
# Production deploy: build the image, replace the container, wait for it to be healthy.
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.yml)

[ -f .env ] || { echo "ERROR: .env missing (copy .env.example)"; exit 1; }

echo "==> Building"
"${COMPOSE[@]}" build

echo "==> Rolling layerre-mcp"
"${COMPOSE[@]}" up -d

echo "==> Waiting for health"
for _ in $(seq 1 30); do
  status=$(docker inspect --format '{{.State.Health.Status}}' layerre-mcp 2>/dev/null || echo starting)
  [ "$status" = "healthy" ] && { echo "    healthy"; "${COMPOSE[@]}" ps; exit 0; }
  [ "$status" = "unhealthy" ] && break
  sleep 2
done

echo "ERROR: layerre-mcp not healthy"
"${COMPOSE[@]}" logs --no-color --tail 40
exit 1

#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env is missing. Runtime secrets must remain local on the VPS."
  exit 1
fi

echo "[1/5] Fetching origin/main"
git fetch --prune origin main

echo "[2/5] Verifying local tracked files"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: tracked local changes detected."
  echo "This VPS is runtime-only. Resolve them before updating."
  git status --short
  exit 1
fi

echo "[3/5] Fast-forwarding main"
git checkout main
git merge --ff-only origin/main

echo "[4/5] Building and starting Supervisor"
docker compose up -d --build --remove-orphans

echo "[5/5] Health check"
attempt=0
until curl -fsS http://127.0.0.1:8090/health >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    echo "ERROR: Supervisor health check failed."
    docker logs --tail 60 stream-supervisor || true
    exit 1
  fi
  sleep 1
done

echo "OK: Stream Supervisor updated and healthy."
docker ps --filter name=stream-supervisor --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

CURRENT_REV="$(git rev-parse HEAD)"

if [ ! -f .env ]; then
  echo "ERROR: .env is missing. Runtime secrets must remain local on the VPS."
  exit 1
fi

echo "[1/7] Fetching origin/main"
git fetch --prune origin main

echo "[2/7] Verifying local tracked files"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: tracked local changes detected."
  echo "This VPS is runtime-only. Resolve them before updating."
  git status --short
  exit 1
fi

echo "[3/7] Fast-forwarding main"
git checkout main
git merge --ff-only origin/main

NEW_REV="$(git rev-parse HEAD)"
if [ "$NEW_REV" != "$CURRENT_REV" ] && [ "${STREAM_SUPERVISOR_UPDATE_REEXEC:-0}" != "1" ]; then
  echo "Updater changed with the new release. Restarting the updated script..."
  STREAM_SUPERVISOR_UPDATE_REEXEC=1 exec sh deployment/update.sh
fi

echo "[4/7] Detecting host network interface"
SYSTEM_NETWORK_INTERFACE="$(ip route show default | awk '/default/ {for (i=1;i<=NF;i++) if ($i=="dev") {print $(i+1); exit}}')"
if [ -z "$SYSTEM_NETWORK_INTERFACE" ]; then
  echo "ERROR: unable to detect default host network interface."
  exit 1
fi
if [ ! -r "/sys/class/net/$SYSTEM_NETWORK_INTERFACE/statistics/rx_bytes" ] || [ ! -r "/sys/class/net/$SYSTEM_NETWORK_INTERFACE/statistics/tx_bytes" ]; then
  echo "ERROR: network counters unavailable for $SYSTEM_NETWORK_INTERFACE."
  exit 1
fi
export SYSTEM_NETWORK_INTERFACE
echo "Host network interface: $SYSTEM_NETWORK_INTERFACE"

echo "[5/7] Preparing safe host metrics mount"
mkdir -p runtime/disk-probe

echo "[6/7] Building and starting Supervisor"
docker compose up -d --build --remove-orphans

echo "[7/7] Health check"
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
docker ps --filter name=stream-supervisor --format 'table {{.Names}}	{{.Status}}	{{.Ports}}'

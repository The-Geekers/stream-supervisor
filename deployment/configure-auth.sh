#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env is missing."
  exit 1
fi

restore_echo() {
  stty echo 2>/dev/null || true
}
trap restore_echo EXIT INT TERM

printf 'Admin username [admin]: '
IFS= read -r ADMIN_USER
ADMIN_USER="${ADMIN_USER:-admin}"

printf 'Admin password: '
stty -echo
IFS= read -r ADMIN_PASS
stty echo
printf '\n'

if [ -z "$ADMIN_PASS" ]; then
  echo "ERROR: admin password must not be empty."
  exit 1
fi

printf 'Technician username (leave empty to skip): '
IFS= read -r TECH_USER
TECH_PASS=""

if [ -n "$TECH_USER" ]; then
  printf 'Technician password: '
  stty -echo
  IFS= read -r TECH_PASS
  stty echo
  printf '\n'
  if [ -z "$TECH_PASS" ]; then
    echo "ERROR: technician password must not be empty."
    exit 1
  fi
fi

TMP=".env.auth.$$"
SEEN_ADMIN_USER=0
SEEN_ADMIN_PASS=0
SEEN_TECH_USER=0
SEEN_TECH_PASS=0

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    SUPERVISOR_USERNAME=*)
      printf 'SUPERVISOR_USERNAME=%s\n' "$ADMIN_USER" >> "$TMP"
      SEEN_ADMIN_USER=1
      ;;
    SUPERVISOR_PASSWORD=*)
      printf 'SUPERVISOR_PASSWORD=%s\n' "$ADMIN_PASS" >> "$TMP"
      SEEN_ADMIN_PASS=1
      ;;
    SUPERVISOR_TECH_USERNAME=*)
      printf 'SUPERVISOR_TECH_USERNAME=%s\n' "$TECH_USER" >> "$TMP"
      SEEN_TECH_USER=1
      ;;
    SUPERVISOR_TECH_PASSWORD=*)
      printf 'SUPERVISOR_TECH_PASSWORD=%s\n' "$TECH_PASS" >> "$TMP"
      SEEN_TECH_PASS=1
      ;;
    *)
      printf '%s\n' "$line" >> "$TMP"
      ;;
  esac
done < .env

[ "$SEEN_ADMIN_USER" -eq 1 ] || printf 'SUPERVISOR_USERNAME=%s\n' "$ADMIN_USER" >> "$TMP"
[ "$SEEN_ADMIN_PASS" -eq 1 ] || printf 'SUPERVISOR_PASSWORD=%s\n' "$ADMIN_PASS" >> "$TMP"
[ "$SEEN_TECH_USER" -eq 1 ] || printf 'SUPERVISOR_TECH_USERNAME=%s\n' "$TECH_USER" >> "$TMP"
[ "$SEEN_TECH_PASS" -eq 1 ] || printf 'SUPERVISOR_TECH_PASSWORD=%s\n' "$TECH_PASS" >> "$TMP"

chmod 600 "$TMP"
mv "$TMP" .env
unset ADMIN_PASS TECH_PASS
trap - EXIT INT TERM

docker compose up -d --force-recreate supervisor >/dev/null

attempt=0
until curl -fsS http://127.0.0.1:8090/health >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 20 ]; then
    echo "ERROR: Supervisor health check failed."
    exit 1
  fi
  sleep 1
done

echo "OK: Supervisor authentication configured."
echo "Reload the browser. Stream Supervisor will show its own secure sign-in screen."

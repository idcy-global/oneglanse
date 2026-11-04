#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../lib/env-file.sh
source "$ROOT/scripts/lib/env-file.sh"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
export ONEGLANSE_ENV_FILE="$TMP_DIR/.env"

cat > "$ONEGLANSE_ENV_FILE" <<'ENV'
APP_URL=http://old.example.test
POSTGRES_PASSWORD=postgres
REDIS_PASSWORD=redis
CLICKHOUSE_PASSWORD=clickhouse
BETTER_AUTH_SECRET=already-secure-secret
KEEP_ME=unchanged
ENV
chmod 644 "$ONEGLANSE_ENV_FILE"

set_env APP_URL 'https://geo.example.test/path?x=one&y=two|three'
grep -Fxq 'APP_URL=https://geo.example.test/path?x=one&y=two|three' "$ONEGLANSE_ENV_FILE"
grep -Fxq 'KEEP_ME=unchanged' "$ONEGLANSE_ENV_FILE"
[[ "$(stat -c '%a' "$ONEGLANSE_ENV_FILE")" == "600" ]]

ensure_secret POSTGRES_PASSWORD
ensure_secret REDIS_PASSWORD
ensure_secret CLICKHOUSE_PASSWORD
ensure_secret BETTER_AUTH_SECRET

for key in POSTGRES_PASSWORD REDIS_PASSWORD CLICKHOUSE_PASSWORD; do
  value="$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ONEGLANSE_ENV_FILE")"
  [[ "$value" =~ ^[a-f0-9]{64}$ ]]
done

grep -Fxq 'BETTER_AUTH_SECRET=already-secure-secret' "$ONEGLANSE_ENV_FILE"

# Existing strong secrets remain stable across repeat installer runs.
before="$(awk -F= '$1 == "POSTGRES_PASSWORD" { print $2; exit }' "$ONEGLANSE_ENV_FILE")"
ensure_secret POSTGRES_PASSWORD
after="$(awk -F= '$1 == "POSTGRES_PASSWORD" { print $2; exit }' "$ONEGLANSE_ENV_FILE")"
[[ "$before" == "$after" ]]

if set_env BAD_KEY $'not\nallowed'; then
  echo "newline value unexpectedly accepted" >&2
  exit 1
fi

echo "VPS_ENV_FILE_TEST=PASS"

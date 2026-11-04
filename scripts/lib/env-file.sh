#!/usr/bin/env bash
# Safe .env updates for the self-hosted installer.
# Callers may set ONEGLANSE_ENV_FILE for isolated tests; production defaults to .env.

oneglanse_env_file() {
  printf '%s\n' "${ONEGLANSE_ENV_FILE:-.env}"
}

set_env() {
  local key="$1"
  local value="$2"
  local file
  file="$(oneglanse_env_file)"

  [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || {
    echo "Invalid environment variable name: $key" >&2
    return 1
  }
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || {
    echo "Environment values must not contain newlines: $key" >&2
    return 1
  }

  if [[ ! -f "$file" ]]; then
    (umask 077; : > "$file") || return 1
  fi
  local tmp
  tmp="$(mktemp "${file}.tmp.XXXXXX")"
  if ! KEY="$key" VALUE="$value" awk '
    BEGIN {
      key = ENVIRON["KEY"]
      value = ENVIRON["VALUE"]
      found = 0
    }
    index($0, key "=") == 1 {
      if (!found) {
        print key "=" value
        found = 1
      }
      next
    }
    { print }
    END {
      if (!found) print key "=" value
    }
  ' "$file" > "$tmp"; then
    rm -f "$tmp"
    return 1
  fi

  chmod 600 "$tmp"
  mv "$tmp" "$file"
}

needs_secret() {
  local key="$1"
  local file current
  file="$(oneglanse_env_file)"
  current="$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); value = $0 } END { print value }' "$file" 2>/dev/null || true)"

  case "${current,,}" in
    ""|replace-me|changeme|postgres|redis|clickhouse|your-long-random-secret)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
  fi
}

ensure_secret() {
  local key="$1"
  if needs_secret "$key"; then
    set_env "$key" "$(generate_secret)"
  fi
}

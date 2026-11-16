#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/bin" "$tmp/releases/previous" "$tmp/archive-content"
printf 'old\n' > "$tmp/releases/previous/version.txt"
printf 'new\n' > "$tmp/archive-content/version.txt"
tar -czf "$tmp/release.tar.gz" -C "$tmp/archive-content" .
cat > "$tmp/agenda-agora.env" <<'ENV'
SUPABASE_SERVICE_ROLE_KEY=server-secret-sentinel
AGPAY_API_SECRET=payment-secret-sentinel
VITE_SUPABASE_URL=https://supabase.example.test
VITE_SUPABASE_PUBLISHABLE_KEY=public-key-sentinel
VITE_SPLIT_PANELS=false
ENV
printf '%s\n' "$tmp/releases/previous" > "$tmp/current.target"

cat > "$tmp/bin/sudo" <<'MOCK'
#!/usr/bin/env bash
if [[ "${1:-}" == "chown" ]]; then exit 0; fi
"$@"
MOCK
cat > "$tmp/bin/systemctl" <<'MOCK'
#!/usr/bin/env bash
case "${1:-}" in
  restart)
    [[ "${RESTART_RESULT:-pass}" == "pass" ]]
    exit
    ;;
  is-active|status) exit 0 ;;
  *) exit 64 ;;
esac
MOCK
cat > "$tmp/bin/readlink" <<'MOCK'
#!/usr/bin/env bash
cat "$1.target"
MOCK
cat > "$tmp/bin/ln" <<'MOCK'
#!/usr/bin/env bash
printf '%s\n' "$2" > "$3.target"
MOCK
cat > "$tmp/bin/rm" <<'MOCK'
#!/usr/bin/env bash
for path in "$@"; do
  [[ "$path" == -* ]] || rm -f "$path.target"
done
MOCK
cat > "$tmp/bin/curl" <<'MOCK'
#!/usr/bin/env bash
if [[ "${HEALTHCHECK_RESULT:-fail}" == "pass" ]]; then exit 0; fi
exit 22
MOCK
cat > "$tmp/bin/npm" <<'MOCK'
#!/usr/bin/env bash
env | sort > "$(dirname "$0")/npm-env-${1//[^a-zA-Z0-9_-]/_}"
exit 0
MOCK
cat > "$tmp/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$tmp/bin/"*

test_script="$tmp/deploy-release.sh"
sed \
  -e "s|/opt/agenda-agora/releases|$tmp/releases|g" \
  -e "s|/opt/agenda-agora/current|$tmp/current|g" \
  -e "s|/etc/agenda-agora.env|$tmp/agenda-agora.env|g" \
  "$repo_root/ops/vps/deploy-release.sh" > "$test_script"

set +e
PATH="$tmp/bin:$PATH" "$BASH" "$test_script" "$tmp/release.tar.gz" failed-release >/dev/null 2>&1
deploy_status=$?
set -e

if [[ "$deploy_status" -eq 0 ]]; then
  echo "Expected health-check failure to fail the deployment." >&2
  exit 1
fi
if [[ "$(cat "$tmp/current.target")" != "$tmp/releases/previous" ]]; then
  echo "Previous release was not restored after health-check failure." >&2
  exit 1
fi

printf '%s\n' "$tmp/releases/previous" > "$tmp/current.target"
set +e
PATH="$tmp/bin:$PATH" RESTART_RESULT=fail "$BASH" "$test_script" "$tmp/release.tar.gz" restart-failed >/dev/null 2>&1
deploy_status=$?
set -e
if [[ "$deploy_status" -eq 0 ]]; then
  echo "Expected service restart failure to fail the deployment." >&2
  exit 1
fi
if [[ "$(cat "$tmp/current.target")" != "$tmp/releases/previous" ]]; then
  echo "Previous release was not restored after service restart failure." >&2
  exit 1
fi

printf '%s\n' "$tmp/releases/previous" > "$tmp/current.target"
PATH="$tmp/bin:$PATH" HEALTHCHECK_RESULT=pass "$BASH" "$test_script" "$tmp/release.tar.gz" healthy-release >/dev/null
if [[ "$(cat "$tmp/current.target")" != "$tmp/releases/healthy-release" ]]; then
  echo "Healthy release was not left active." >&2
  exit 1
fi

for npm_env in "$tmp/bin/npm-env-ci" "$tmp/bin/npm-env-run"; do
  if grep -Eq 'SUPABASE_SERVICE_ROLE_KEY=|AGPAY_API_SECRET=' "$npm_env"; then
    echo "Runtime secrets were exposed to npm: $npm_env" >&2
    exit 1
  fi
  grep -Fxq 'VITE_SUPABASE_URL=https://supabase.example.test' "$npm_env"
  grep -Fxq 'VITE_SUPABASE_PUBLISHABLE_KEY=public-key-sentinel' "$npm_env"
  grep -Fxq 'VITE_SPLIT_PANELS=false' "$npm_env"
done

echo "deploy-release rollback and success paths passed"

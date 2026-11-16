#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Uso: deploy-release.sh <arquivo.tar.gz> <release-id>" >&2
  exit 64
fi

archive="$1"
release_id="$2"
release_root="/opt/agenda-agora/releases"
release_dir="${release_root}/${release_id}"
current_link="/opt/agenda-agora/current"

if [[ ! -f "$archive" || ! "$release_id" =~ ^[0-9A-Za-z._-]+$ ]]; then
  echo "Arquivo ou identificador de release inválido." >&2
  exit 65
fi

sudo mkdir -p "$release_dir"
sudo chown deploy:deploy "$release_dir"
tar -xzf "$archive" -C "$release_dir"

cd "$release_dir"
set -a
# shellcheck disable=SC1091
source /etc/agenda-agora.env
set +a

env -i \
  PATH="$PATH" \
  HOME="${HOME:-/home/deploy}" \
  VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}" \
  VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_PUBLISHABLE_KEY:-}}" \
  VITE_SPLIT_PANELS="${VITE_SPLIT_PANELS:-true}" \
  npm ci --include=dev
env -i \
  PATH="$PATH" \
  HOME="${HOME:-/home/deploy}" \
  VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-${SUPABASE_URL:-}}" \
  VITE_SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-${SUPABASE_PUBLISHABLE_KEY:-}}" \
  VITE_SPLIT_PANELS="${VITE_SPLIT_PANELS:-true}" \
  npm run build

previous_release="$(readlink "$current_link" 2>/dev/null || true)"
release_switched=0
rollback_release() {
  exit_status=$?
  trap - EXIT
  if [[ "$exit_status" -ne 0 && "$release_switched" -eq 1 ]]; then
    set +e
    if [[ -n "$previous_release" ]]; then
      sudo ln -sfn "$previous_release" "$current_link"
    else
      sudo rm -f "$current_link"
    fi
    rollback_status=$?
    if [[ "$rollback_status" -eq 0 ]]; then
      sudo systemctl restart agenda-agora
      if [[ "$?" -ne 0 ]]; then
        echo "Falha ao reiniciar o serviço após restaurar a release anterior." >&2
      else
        echo "Release anterior restaurada após falha no deploy." >&2
      fi
    else
      echo "Falha ao restaurar o link para a release anterior." >&2
    fi
  fi
  exit "$exit_status"
}
trap rollback_release EXIT

sudo ln -sfn "$release_dir" "$current_link"
release_switched=1
sudo systemctl restart agenda-agora

for _attempt in {1..15}; do
  if curl --fail --silent --output /dev/null http://127.0.0.1:3000/auth; then
    sudo systemctl is-active --quiet agenda-agora
    echo "Release ${release_id} ativa e saudável."
    release_switched=0
    exit 0
  fi
  sleep 1
done

echo "A aplicação não respondeu apó o deploy." >&2
sudo systemctl --no-pager --full status agenda-agora >&2
exit 1

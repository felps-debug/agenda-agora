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

npm ci --include=dev
npm run build

sudo ln -sfn "$release_dir" /opt/agenda-agora/current
sudo systemctl restart agenda-agora

for _attempt in {1..15}; do
  if curl --fail --silent --output /dev/null http://127.0.0.1:3000/auth; then
    sudo systemctl is-active --quiet agenda-agora
    echo "Release ${release_id} ativa e saudável."
    exit 0
  fi
  sleep 1
done

echo "A aplicação não respondeu apó o deploy." >&2
sudo systemctl --no-pager --full status agenda-agora >&2
exit 1

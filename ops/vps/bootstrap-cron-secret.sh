#!/bin/sh
set -eu

env_file=/etc/agenda-agora.env
temporary_file=$(mktemp)
secret=$(openssl rand -hex 32)

grep -v '^AGENDA_CRON_SECRET=' "$env_file" \
  | grep -v '^AGENDA_CRON_SECRET_PREVIOUS=' > "$temporary_file"
printf 'AGENDA_CRON_SECRET=%s\nAGENDA_CRON_SECRET_PREVIOUS=%s\n' \
  "$secret" "$secret" >> "$temporary_file"
install -o root -g root -m 0600 "$temporary_file" "$env_file"
rm -f "$temporary_file"
unset secret

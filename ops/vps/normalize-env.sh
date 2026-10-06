#!/bin/sh
set -eu

env_file=/etc/agenda-agora.env
temporary_file=$(mktemp)

tr -d '\r' < "$env_file" > "$temporary_file"
install -o root -g root -m 0600 "$temporary_file" "$env_file"
rm -f "$temporary_file"

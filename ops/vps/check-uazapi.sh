#!/bin/sh
set -eu

. /etc/agenda-agora.env

printf 'UAZAPI_ADMIN_HTTP='
/usr/bin/curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --max-time 15 \
  --header "admintoken: ${UAZAPI_ADMIN_TOKEN}" \
  --header 'Accept: application/json' \
  "${UAZAPI_BASE_URL%/}/instance/all"
printf '\n'

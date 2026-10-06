#!/bin/sh
set -eu

. /etc/agenda-agora.env

printf 'EGRESS_IP='
/usr/bin/curl -4fsS --max-time 10 https://api.ipify.org
printf '\nAGPAY_READ_HTTP='
if [ -n "${1:-}" ]; then
  /usr/bin/curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --max-time 15 \
    --header "Authorization: Bearer ${AGPAY_API_TOKEN}" \
    --header 'Accept: application/json' \
    "https://agpay.services/api/v1/transactions/${1}"
else
  printf 'SKIPPED'
fi
printf '\n'

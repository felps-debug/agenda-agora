#!/bin/sh
set -eu

. /etc/agenda-agora.env

case "${1:-}" in
  agpay-events)
    endpoint="agpay-events"
    ;;
  whatsapp-reminders)
    endpoint="whatsapp-reminders"
    ;;
  *)
    echo "unknown job" >&2
    exit 64
    ;;
esac

exec /usr/bin/curl --fail-with-body --silent --show-error --max-time 50 \
  --request POST \
  --header "Authorization: Bearer ${AGENDA_CRON_SECRET}" \
  --header "Content-Type: application/json" \
  --header "Origin: http://127.0.0.1:3000" \
  --data '{}' \
  "http://127.0.0.1:3000/api/public/hooks/${endpoint}"

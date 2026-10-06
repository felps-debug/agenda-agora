#!/bin/sh
# Diagnostico de saque AgPay, sem risco: nao cria nem movimenta dinheiro.
#
# O AgPay valida o IP do servidor ANTES de validar o corpo da requisicao. Por
# isso um POST com corpo vazio nunca chega a criar um saque: ele apenas
# responde 403 quando o IP nao esta autorizado e 400/422 quando o IP passa e o
# erro passa a ser de payload. Isso separa "IP nao liberado" de "payload/credencial".
set -eu

. /etc/agenda-agora.env

printf 'EGRESS_IP='
/usr/bin/curl -4fsS --max-time 10 https://api.ipify.org
printf '\n'

# Nao imprime o token: apenas confirma presenca e formato.
case "${AGPAY_API_TOKEN:-}" in
  '') printf 'AGPAY_TOKEN=AUSENTE\n'; exit 1 ;;
  nxp_*) printf 'AGPAY_TOKEN=presente\n' ;;
  *) printf 'AGPAY_TOKEN=presente (prefixo inesperado)\n' ;;
esac

printf 'AGPAY_READ_HTTP='
/usr/bin/curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --max-time 15 \
  --header "Authorization: Bearer ${AGPAY_API_TOKEN}" \
  --header 'Accept: application/json' \
  'https://agpay.services/api/v1/transactions?limit=1'
printf '\n'

printf 'AGPAY_CASHOUT_HTTP='
status=$(/usr/bin/curl --silent --show-error --output /tmp/agpay-cashout-body \
  --write-out '%{http_code}' \
  --max-time 20 \
  --request POST \
  --header "Authorization: Bearer ${AGPAY_API_TOKEN}" \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{}' \
  'https://agpay.services/api/v1/cashout/pix')
printf '%s\n' "$status"
printf 'AGPAY_CASHOUT_MSG='
/usr/bin/tr -d '\n' < /tmp/agpay-cashout-body
printf '\n'
rm -f /tmp/agpay-cashout-body

case "$status" in
  403)
    printf '\nDIAGNOSTICO=IP_NAO_AUTORIZADO\n'
    printf 'Cadastre o EGRESS_IP acima em Chaves de API da credencial, no modo Automatico.\n'
    ;;
  400 | 401 | 422)
    printf '\nDIAGNOSTICO=IP_OK_OUTRO_ERRO\n'
    printf 'O IP passou na whitelist. Veja AGPAY_READ_HTTP e a mensagem acima.\n'
    ;;
  *)
    printf '\nDIAGNOSTICO=INESPERADO\n'
    printf 'Status fora do esperado; confira a mensagem do provedor acima.\n'
    ;;
esac
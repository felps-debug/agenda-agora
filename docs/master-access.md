# Acesso Master

## Variáveis de segurança

Configure no ambiente protegido do servidor, sem registrar valores no Git:

- `MASTER_RETURN_PIN`: PIN para retornar do modo de impersonação.
- `MASTER_SECURITY_PIN`: PIN para as telas sensíveis do Master.
- `SDR_TOKEN_SECRET`: segredo HMAC para assinar sessões de SDR; use pelo menos 32 caracteres aleatórios.
- `ALLOWED_APP_ORIGINS`: origens exatas permitidas, separadas por vírgula.
- `WHATSAPP_WEBHOOK_SECRET`: segredo enviado no cabeçalho `X-Webhook-Secret`.
- `PUBLIC_APP_URL`: URL pública HTTPS usada na configuração de webhooks.

## Rotação dos PINs

1. Welison escolhe os novos PINs, diferentes dos valores antigos.
2. Cadastre `MASTER_RETURN_PIN` e `MASTER_SECURITY_PIN` na VPS.
3. Confirme em ambiente de teste que os novos PINs funcionam e que o Master consegue entrar.
4. Faça o deploy; os PINs antigos deixam de valer nesse release.
5. Se o Master perder o acesso, corrija o valor na variável de ambiente e reinicie o serviço. O código não armazena PIN para rollback.

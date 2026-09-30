# Runbook: troca das credenciais da plataforma AgPay

## Modelo de credenciais

A Agenda Agora usa uma única conta e um único token AgPay da plataforma para criar cobranças Pix. Os valores são recebidos integralmente pela plataforma; repasses aos estabelecimentos são feitos pelo fluxo de saques.

`AGPAY_API_TOKEN` também é a chave usada para validar a assinatura HMAC dos webhooks recebidos em `/api/public/agpay-webhook`. Ao rotacionar o token, coordene a atualização da chave de assinatura no AgPay para que chamadas da API e webhooks passem a usar a mesma chave.

## Variáveis a atualizar no Vercel

| Variável          | Uso                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `AGPAY_API_TOKEN` | Token único da plataforma usado no header Bearer das chamadas de API e como chave HMAC do webhook. |

`AGPAY_CLIENT_ID` **não é usado** pelo cliente HTTP (`agpay.server.ts`) — confirmado em 2026-09-29
contra a documentação real da API (`https://agpay.services/documentacao`), cujo exemplo de
autenticação só envia `Authorization: Bearer`. Um header `X-Client-ID` extra fazia a API retornar
401 "Credenciais de API inválidas ou expiradas" mesmo com token válido e IP liberado. A variável
pode continuar no `.env` sem uso, ou ser removida quando for conveniente.

Atualize os ambientes Vercel que serão usados (Production e, quando aplicável, Preview). Não solicite nem cadastre tokens AgPay de estabelecimentos.

## Passo a passo

1. Obtenha o novo `AGPAY_API_TOKEN` com o responsável pela conta de plataforma. Confirme com o AgPay a data de ativação e a troca da chave HMAC do webhook para o mesmo token.
2. No painel do AgPay, confirme que o webhook aponta para `https://<dominio-publico>/api/public/agpay-webhook` e que a assinatura `X-Webhook-Signature` será calculada com o novo token.
3. No Vercel, atualize `AGPAY_API_TOKEN` no ambiente aplicável. Não compartilhe o valor em tickets, logs ou mensagens.
4. Faça o redeploy desses ambientes para que as novas variáveis sejam carregadas.
5. **Smoke test de cobrança**: crie uma cobrança Pix de baixo valor em um estabelecimento de teste. Confirme que o QR/copia-e-cola foi gerado e que o valor foi recebido pela plataforma.
6. **Smoke test de webhook**: conclua o pagamento de teste e confirme que o webhook é aceito, que o evento aparece em `agpay_webhook_events` e que a reserva muda para paga/confirmada.
7. Monitore erros de API, eventos `failed`/pendentes em `agpay_webhook_events` e o cron `POST /api/public/hooks/agpay-events` após a troca.

## Saque com aprovação manual e saída por proxy

O modo padrão definido para a conta é **Manual (Aprovação pendente)**. O dono recebe o valor solicitado integralmente; a taxa do saque é absorvida pela plataforma. Uma solicitação fica em processamento até o webhook `withdrawal.completed` (ou uma falha explícita) atualizar o estado local. A conta precisa ter o KYC aprovado antes de validar chamadas reais de saque; isso depende dos documentos e da liberação do responsável pela conta.

Todas as chamadas à API podem sair por um retransmissor próprio quando `AGPAY_EGRESS_PROXY_URL` estiver definida. Configure também `AGPAY_EGRESS_PROXY_SECRET` no servidor e no retransmissor. O retransmissor deve aceitar somente o host `agpay.services`, exigir o segredo compartilhado, preservar o método e os headers enviados pelo servidor e devolver status, headers e corpo da resposta. Nunca registre tokens, chaves Pix ou payloads completos em logs.

## Pedido ao suporte sobre IP de saída (rascunho)

> Olá! Estamos configurando uma integração de API com a conta da plataforma. O cadastro da credencial exige um único IP fixo de saída, mas nosso ambiente atual usa endereços dinâmicos. Vocês podem liberar uma faixa de IPs de saída ou dispensar a whitelist para uma credencial no modo “Manual (Aprovação pendente)”? Se necessário, enviamos a captura do formulário que apresenta esse campo. A cobrança e os saques serão iniciados exclusivamente pelo nosso servidor.

O responsável deve anexar a captura do formulário ao enviar o pedido. Ainda não há IP fixo reservado nem pedido enviado; não gere as credenciais antes da resposta do suporte ou da configuração do retransmissor gratuito.

## Retransmissor gratuito, se a whitelist continuar obrigatória

1. Criar uma instância elegível ao Oracle Cloud Always Free e reservar um IPv4 público fixo. A Oracle pode exigir cartão para validar a conta; não selecionar recursos pagos.
2. Instalar um serviço pequeno de encaminhamento HTTPS nessa máquina. Aceitar conexões apenas do domínio do app, validar `AGPAY_EGRESS_PROXY_SECRET` em tempo constante e encaminhar apenas para `https://agpay.services/api/v1`.
3. Impedir encaminhamento para outros hosts, portas ou protocolos; limitar tamanho do corpo, aplicar timeout e não escrever headers/corpos sensíveis nos logs.
4. Cadastrar o IPv4 reservado no campo “IP do servidor” e gerar a credencial AgPay no modo “Manual (Aprovação pendente)”.
5. Definir `AGPAY_EGRESS_PROXY_URL` e `AGPAY_EGRESS_PROXY_SECRET` no ambiente do app e validar primeiro uma chamada de baixo risco. O responsável precisa fornecer acesso à conta Oracle e concluir a whitelist antes da ativação.

## Retorno à credencial anterior

Se o smoke test falhar, restaure no Vercel o `AGPAY_API_TOKEN` anterior, coordene com o AgPay a restauração da chave HMAC correspondente, e faça novo redeploy. Refaça os smoke tests de cobrança e webhook antes de encerrar a ocorrência.

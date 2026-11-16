# Runbook: troca das credenciais da plataforma AgPay

## Modelo de credenciais

A Agenda Agora usa uma única conta e um único token AgPay da plataforma para criar cobranças Pix. Os valores são recebidos integralmente pela plataforma; repasses aos estabelecimentos são feitos pelo fluxo de saques.

`AGPAY_API_TOKEN` também é a chave usada para validar a assinatura HMAC dos webhooks recebidos em `/api/public/agpay-webhook`. Ao rotacionar o token, coordene a atualização da chave de assinatura no AgPay para que chamadas da API e webhooks passem a usar a mesma chave.

## Variáveis do ambiente que atende o app

| Variável          | Uso                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `AGPAY_API_TOKEN` | Token único da plataforma usado no header Bearer das chamadas de API e como chave HMAC do webhook. |
| `AGPAY_CLIENT_ID` | Identificador da credencial enviado no header `X-Client-ID` quando fornecido pelo AgPay.          |

Os exemplos atuais da documentação AgPay usam `Authorization: Bearer <AGPAY_API_TOKEN>` e
`X-Client-ID: <AGPAY_CLIENT_ID>`. O adaptador envia o segundo header quando essa variável está
configurada. Em 15/11/2026, uma consulta GET somente leitura a `/transactions?limit=1` retornou
200 com a credencial local tanto com quanto sem `X-Client-ID`; isso não substitui a validação de
uma chamada POST em sandbox após uma rotação de credenciais. Uma observação histórica de 401 com
esse header não deve ser tratada como regra universal sem repetir a validação com a credencial
vigente.

A última verificação registrada (2026-11-15) encontrou a produção no serviço agenda-agora_app, em EasyPanel/Docker Swarm. Atualize as variáveis nesse serviço e faça o redeploy controlado. Se houver um preview Vercel ativo, atualize-o separadamente; não trate Vercel como produção sem confirmar o runtime. Não solicite nem cadastre tokens AgPay de estabelecimentos.

## Passo a passo

1. Obtenha o novo `AGPAY_API_TOKEN` com o responsável pela conta de plataforma. Confirme com o AgPay a data de ativação e a troca da chave HMAC do webhook para o mesmo token.
2. No painel do AgPay, confirme que o webhook aponta para `https://<dominio-publico>/api/public/agpay-webhook` e que a assinatura `X-Webhook-Signature` será calculada com o novo token.
3. No EasyPanel, atualize `AGPAY_API_TOKEN` e `AGPAY_CLIENT_ID` no serviço de produção após confirmar que o runtime continua sendo agenda-agora_app. Não compartilhe os valores em tickets, logs ou mensagens. Se houver preview Vercel ativo, atualize-o separadamente.
4. Faça o redeploy do serviço de produção no EasyPanel para carregar as novas variáveis. Repita separadamente apenas para previews ativos.
5. **Smoke test de cobrança**: crie uma cobrança Pix de baixo valor em um estabelecimento de teste. Confirme que o QR/copia-e-cola foi gerado e que o valor foi recebido pela plataforma.
6. **Smoke test de webhook**: conclua o pagamento de teste e confirme que o webhook é aceito, que o evento aparece em `agpay_webhook_events` e que a reserva muda para paga/confirmada.
7. Monitore erros de API, eventos `failed`/pendentes em `agpay_webhook_events` e o cron `POST /api/public/hooks/agpay-events` após a troca.

## Saque automático e saída por proxy

A credencial deve ser criada no modo **Automático**. É esse modo que permite ao AgPay processar o Pix sem aprovação manual. O dono recebe o valor solicitado integralmente; a taxa do saque é absorvida pela plataforma. Se a API já responder `completed`, o saldo local é concluído na mesma chamada; em `processing`, o webhook `withdrawal.completed` confirma o resultado. A conta precisa ter KYC aprovado e saques desbloqueados antes de validar chamadas reais.

Todas as chamadas à API podem sair por um retransmissor próprio quando `AGPAY_EGRESS_PROXY_URL` estiver definida. Configure também `AGPAY_EGRESS_PROXY_SECRET` no servidor e no retransmissor. O retransmissor deve aceitar somente o host `agpay.services`, exigir o segredo compartilhado, preservar o método e os headers enviados pelo servidor e devolver status, headers e corpo da resposta. Nunca registre tokens, chaves Pix ou payloads completos em logs.

## Pedido ao suporte sobre IP de saída (rascunho)

> Olá! Estamos integrando nosso sistema à API da conta da plataforma. O cadastro da credencial exige um único IP fixo de saída, mas nossa infraestrutura pode usar mais de um IP. Vocês podem aceitar uma faixa de IPs ou dispensar a whitelist de IP para essa credencial? Se a whitelist for obrigatória, podem informar o formato de faixa aceito e confirmar se a credencial pode operar em modo Automático? [Anexar ao envio uma captura do formulário que solicita o IP do servidor.] As cobranças e os saques serão iniciados exclusivamente pelo nosso servidor.

O IP fixo da VPS de produção documentado neste projeto é `179.236.231.178`; confirme no painel de infraestrutura antes de cadastrá-lo ou gerar uma credencial nova. Se o ambiente usar retransmissor, cadastre o IPv4 reservado desse retransmissor em vez do IP da VPS.

## Retransmissor gratuito, se a whitelist continuar obrigatória

1. Criar uma instância elegível ao Oracle Cloud Always Free e reservar um IPv4 público fixo. A Oracle pode exigir cartão para validar a conta; não selecionar recursos pagos.
2. Instalar um serviço pequeno de encaminhamento HTTPS nessa máquina. Aceitar conexões apenas do domínio do app, validar `AGPAY_EGRESS_PROXY_SECRET` em tempo constante e encaminhar apenas para `https://agpay.services/api/v1`.
3. Impedir encaminhamento para outros hosts, portas ou protocolos; limitar tamanho do corpo, aplicar timeout e não escrever headers/corpos sensíveis nos logs.
4. Cadastrar o IPv4 reservado no campo “IP do servidor” e gerar a credencial AgPay no modo “Automático”.
5. Definir `AGPAY_EGRESS_PROXY_URL` e `AGPAY_EGRESS_PROXY_SECRET` no ambiente do app e validar primeiro uma chamada de baixo risco. O responsável precisa fornecer acesso à conta Oracle e concluir a whitelist antes da ativação.

## Retorno à credencial anterior

Se o smoke test falhar, restaure no serviço de produção o `AGPAY_API_TOKEN` anterior, coordene com o AgPay a restauração da chave HMAC correspondente, e faça novo redeploy do serviço no EasyPanel. Se um preview Vercel também tiver sido alterado, restaure-o separadamente. Refaça os smoke tests de cobrança e webhook antes de encerrar a ocorrência.

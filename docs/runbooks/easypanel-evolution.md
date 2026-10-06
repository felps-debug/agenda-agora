# Migração da VPS para EasyPanel + Evolution API

Objetivo: parar de pagar uma instância de WhatsApp por estabelecimento (UazAPI) e rodar a
Evolution API na própria VPS, com o app e a Evolution no mesmo EasyPanel.

Nenhum passo abaixo foi executado pelo código. A VPS é operada manualmente.

## 0. Antes de derrubar qualquer coisa

- A VPS atual (`179.236.231.178`) está liberada no AgPay e roda os crons de eventos e lembretes.
  Derrubar sem preparar a volta deixa o painel, os pagamentos e os saques fora do ar.
- Se possível, suba o EasyPanel numa VPS nova e só então mude o DNS. Reinstalar na mesma máquina
  exige janela de manutenção.
- Guarde `/etc/agenda-agora.env` fora da VPS (gerenciador de senhas). Ele tem todos os segredos.
- Aplique no Supabase as migrations `20261005120000_withdrawal_platform_fee.sql` e
  `20261005121000_professional_photos_storage.sql` **antes** de publicar a versão nova.

## 1. EasyPanel e domínios

1. Instale o EasyPanel na VPS (docs oficiais) e abra as portas 80 e 443.
2. Crie um projeto `agenda-agora` com dois serviços: `app` (este repositório) e `evolution`.
3. Domínios do serviço `app`, todos na porta 3000, com HTTPS automático:
   `app.agendagora.company`, `painel.agendagora.company`, `admin.agendagora.company`.
4. Domínio do serviço `evolution`: por exemplo `evolution.agendagora.company`.

## 2. Evolution API

1. Crie o serviço `evolution` a partir da imagem `atendai/evolution-api:v2.x` (fixe uma versão,
   não use `latest`) com Postgres e Redis do EasyPanel (a v2 exige banco; use serviços novos,
   **não** o Supabase de produção).
2. Variáveis mínimas (nomes da Evolution v2; confira na documentação da versão escolhida):
   - `AUTHENTICATION_API_KEY`: chave global longa e aleatória. É o `EVOLUTION_API_KEY` do app.
   - `SERVER_URL`: a URL pública do serviço.
   - `DATABASE_ENABLED=true`, `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI`.
   - `CACHE_REDIS_ENABLED=true`, `CACHE_REDIS_URI`.
3. Persista o volume de instâncias, senão todos reconectam a cada reinício.
4. Teste: `GET https://evolution.agendagora.company/` responde e uma chamada com o header
   `apikey` errado dá 401.

## 3. Serviço `app` (Dockerfile da raiz)

Origem: este repositório (GitHub `felps-debug/agenda-agora`), build pelo `Dockerfile`.

Build args (públicos, entram no bundle):

| Arg | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publishable |
| `VITE_SPLIT_PANELS` | `true` |

Variáveis de ambiente (segredos, copie do `/etc/agenda-agora.env`, não do repositório):
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AGPAY_API_TOKEN`,
`AGPAY_CLIENT_ID`, `AGENDA_CRON_SECRET` e as demais que o app já usa hoje, mais as novas:

| Variável | Valor |
|---|---|
| `WHATSAPP_PROVIDER` | `evolution` (ausente = continua UazAPI) |
| `EVOLUTION_API_URL` | `https://evolution.agendagora.company` |
| `EVOLUTION_API_KEY` | o mesmo valor de `AUTHENTICATION_API_KEY` |

Healthcheck: `GET /auth` na porta 3000 (já no Dockerfile).

## 4. Crons (substituem os timers do systemd)

No serviço `app`, em Cron Jobs (aba Avançado; a posição varia com a versão do EasyPanel):

| Frequência | Comando |
|---|---|
| a cada minuto (`* * * * *`) | `curl --fail-with-body -s -m 50 -X POST -H "Authorization: Bearer $AGENDA_CRON_SECRET" -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3000" -d '{}' http://127.0.0.1:3000/api/public/hooks/agpay-events` |
| a cada hora (`0 * * * *`) | o mesmo comando, trocando o final por `/api/public/hooks/whatsapp-reminders` |

Equivalem a `ops/vps/agenda-cron.sh`. Se o EasyPanel não expandir `$AGENDA_CRON_SECRET` no
comando, envolva em `sh -c '...'`.

## 5. AgPay: IP de saída

O AgPay só aceita o IP liberado. Ao mudar de servidor o IP de saída muda.

1. Com o app já rodando no EasyPanel, confirme o IP de saída **de dentro do container**
   (ex.: `curl -s https://api.ipify.org` no terminal do serviço).
2. Libere esse IP no painel do AgPay e só então gere a credencial nova, se ela for presa ao IP.
3. O `NODE_OPTIONS` do Dockerfile já força IPv4 (o problema que travava o saque).
4. Teste com uma consulta de leitura antes de qualquer Pix ou saque.

## 6. Redirects entre os três domínios

O Caddy da VPS redirecionava `/painel/master*` para `admin`, `/painel*` para `painel` e
`/agendar/*` para `app` (`ops/vps/Caddyfile`). O EasyPanel usa Traefik e isso se perde.
Sem os redirects o app continua funcionando em qualquer um dos três domínios, mas as URLs
deixam de ser normalizadas. Para manter o comportamento, recrie as regras como middleware
de redirecionamento do Traefik (ou mantenha um Caddy na frente do app).

## 7. Reconexão do WhatsApp

- Os negócios hoje conectados na UazAPI têm credencial de UazAPI guardada. Com
  `WHATSAPP_PROVIDER=evolution` essa credencial não vale mais: cada dono entra em
  Integrações, desconecta e gera um QR Code (ou código) novo. A instância Evolution é criada
  no primeiro "Conectar".
- Até reconectarem, confirmações e lembretes daquele negócio não saem.
- Virada sem pressa: deixe `WHATSAPP_PROVIDER` ausente (UazAPI) até a Evolution estar testada
  com um negócio de teste, depois troque a variável e reinicie o serviço.

## 8. Checklist de virada

- [ ] Migrations aplicadas no Supabase
- [ ] `/etc/agenda-agora.env` copiado para fora da VPS
- [ ] Evolution responde e rejeita `apikey` errada
- [ ] App no ar nos três domínios, `/auth` com 200
- [ ] IP de saída liberado no AgPay e consulta de leitura com HTTP 200
- [ ] Crons rodando (evento AgPay e lembrete) sem erro
- [ ] QR Code gerado e mensagem de teste enviada por um negócio de teste
- [ ] DNS apontado, VPS antiga mantida desligada (não apagada) por alguns dias

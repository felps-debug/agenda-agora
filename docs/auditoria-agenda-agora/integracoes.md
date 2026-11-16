# Integrações — WhatsApp e serviços externos

**Escopo até 2026-11-13:** inspeção estática; nenhuma instância foi conectada/desconectada e nenhuma mensagem foi enviada.

## Arquitetura identificada

- Seletor server-side `WHATSAPP_PROVIDER`: usa Evolution apenas se o valor for `evolution`; qualquer valor ausente/inesperado seleciona UazAPI (`src/lib/whatsapp-provider.server.ts:7-17`).
- Adaptadores em `src/lib/evolution.server.ts` e `src/lib/uazapi.server.ts`, ambos com timeout HTTP de 12 s e mensagens de erro sanitizadas.
- Webhook público de mensagens recebidas em `/api/public/whatsapp-incoming`, protegido por `X-Webhook-Secret` comparado em tempo constante (`src/routes/api/public/whatsapp-incoming.ts:8-21`).
- Connect, status, desconexão, QR e teste de mensagem exigem Supabase auth e chamam `loadOwnedBusiness` (ou guarda Master) em `src/lib/whatsapp.functions.ts`.
- Rotina horária busca confirmações/lembretes e processa fila pós-atendimento: `/api/public/hooks/whatsapp-reminders`, protegida por `authenticateCronRequest`.

## Achados

### INT-001 — Saudação automática espera 24 h; regra pedida era 30 min

- **Status:** divergência de requisito confirmada; efeito em produção não medido.
- **Gravidade:** P2.
- **Esperado:** ficha do cliente registra regra de saudação resetar a cada 30 minutos (pedido relatado em `clientes/agenda-agora.md`, atualizado no diagnóstico de 13/11/2026).
- **Observado:** `GREETING_COOLDOWN_MS = 24 * 60 * 60 * 1_000` (`src/lib/whatsapp-greeting.server.ts:11`); resposta após 24 h (`:269-270`).
- **Impacto:** cliente não recebe saudação de novo quando retorna após meia hora, contrário ao comportamento solicitado.
- **Causa-raiz:** cooldown configurado como 24 h no código/migration, sem alinhamento com regra do cliente.
- **Validação segura:** teste unitário de cooldown nos limites 29:59/30:00 e 23:59/24:00; nenhum envio externo.
- **Correção recomendada para spec:** confirmar a janela final e fixá-la em config/testes.
- **Regressão necessária:** horário local, concorrência de webhooks repetidos, falha de envio e múltiplos remetentes.

### INT-002 — Parser não usa número alternativo de eventos `@lid`

- **Status:** limitação de parsing confirmada; volume/ocorrência atual em produção inconclusivos.
- **Gravidade:** P2.
- **Esperado:** reconhecer um telefone alternativo quando o provedor envia `remoteJid` em formato LID não discável.
- **Observado:** `digitsOf` só aceita strings contendo `@s.whatsapp.net` (`whatsapp-greeting.server.ts:22-29`); `parseIncomingWhatsapp` tenta `remoteJid`, `sender`, `from`, `number`, mas não `remoteJidAlt` (`:63-76`). A inspeção de produção de 13/11 registrou linhas com `@lid` no período do relato e reproduziu a perda de `remoteJidAlt` localmente; não correlacionou esses eventos a uma mensagem individual (`C:\Users\Felps\segundo-cerebro\clientes\agenda-agora.md:489`).
- **Impacto:** evento sem os campos aceitos vira `null`, não dispara saudação.
- **Causa-raiz:** formato alternativo do payload não está coberto pelo parser.
- **Validação segura:** fixture sanitizada do webhook com `remoteJid=@lid` e `remoteJidAlt` com telefone; afirmar se parser retorna remetente, sem enviar mensagem.
- **Correção recomendada para spec:** normalizar identificadores do payload por tipo de provedor e cobrir formatos Evolution/UazAPI com fixtures.
- **Regressão necessária:** grupo, mensagem própria, LID sem número, número alternativo, JID válido, payload inválido.

### INT-003 — Webhook confirma recebimento mesmo se o processamento da saudação falhar

- **Status:** corrigido localmente com fila durável e retry; deploy/produção não verificados.
- **Gravidade:** P2.
- **Observado/revalidado:** UazAPI documenta que a aplicação deve responder 2xx depois de registrar o recebimento e informa que entregas malsucedidas não são repetidas automaticamente ([webhook de mensagens](https://docs.uazapi.com/webhook/messages)).
- **Correção local:** a rota primeiro insere o evento em `whatsapp_incoming_greeting_events`, com hash único para deduplicar a mensagem; só então responde 200. Falha ao persistir o evento retorna 503. Erro transitório no envio mantém o evento pendente com atraso exponencial e até 10 tentativas; a fila também é processada pelo cron horário de WhatsApp. Claims concorrentes e o cooldown existente de 30 min evitam envios duplicados.
- **Segurança:** tabela com RLS habilitada, sem grants para `PUBLIC`, `anon` ou `authenticated`; somente `service_role` tem acesso.
- **Regressões:** falha de provider e retry, webhook repetido, cron, RLS e unicidade. `whatsapp-incoming.test.ts` + `whatsapp-reminders.test.ts`: 18/18; DB isolado `whatsapp-incoming-greeting-queue.test.ts`: 3/3; `npx tsc --noEmit` passou.
- **Limites:** retry periódico depende do cron já configurado (intervalo horário); após 10 falhas, item permanece em `error` para revisão. Se a própria fila não puder ser persistida, a UazAPI não oferece redelivery automática; a rota retorna 503 e a falha fica limitada ao log. Nenhuma migration remota, mensagem real, deploy, push ou commit.
- **Causa-raiz:** rota converte erro transitório em sucesso HTTP para evitar erro externo, sem persistência garantida do evento.
- **Validação segura:** teste da rota com send mock que rejeita e observar status/corpo; verificar política de retry do provedor em sandbox/documentação.
- **Correção recomendada para spec:** escolher explicitamente ACK + inbox durável ou status 5xx com retry confirmado.
- **Regressão necessária:** falha de banco, timeout de envio, retry duplicado e claim idempotente.

### INT-004 — Falha no aviso de pagamento não é repetida depois que a cobrança já mudou para paga

- **Status:** corrigido localmente; migrations/deploy de produção não verificados.
- **Gravidade:** P2.
- **Esperado:** falha de notificação deve ser reprocessável sem duplicar crédito nem perder o aviso.
- **Observado:** o fluxo anterior retornava `already_paid` antes de repetir `sendPaymentConfirmation`. Agora existe uma outbox `deposit_payment_whatsapp_confirmations` separada de `deposit_payments`, protegida por RLS e grants apenas a `service_role`. A cobrança continua paga e o crédito do ledger permanece idempotente; falha de WhatsApp retorna ao worker AgPay, que repete o aviso. Claim atômico impede workers simultâneos e estados `sent`/`skipped` não reenviam a mensagem.
- **Impacto:** reserva/pagamento seguem confirmados, mas o cliente pode não receber confirmação. Erro do WhatsApp não aparece na UI do negócio e não há reparo automático no caminho observado.
- **Causa-raiz corrigida localmente:** estado durável de notificação separado do estado financeiro, com claim UUID por cobrança e retry usando a inbox AgPay já existente.
- **Validação:** testes diretos e do worker cobrem falha no primeiro envio, retry bem-sucedido, callback duplicado e crédito único; teste PostgreSQL isolado cobre claim concorrente, retry, estado enviado e privilégios.
- **Limite:** não há transação distribuída entre WhatsApp e PostgreSQL. Se o provider aceitar a mensagem e a gravação final falhar, recuperação do lease após cinco minutos pode reenviar; confirmar entrega exatamente uma vez exige idempotência oferecida pelo provider. Produção/deploy não verificados.

### INT-005 — Log `erro` bloqueia nova tentativa de lembrete

- **Status:** falha confirmada em código; ocorrência de produção não medida.
- **Gravidade:** P2.
- **Esperado:** falha ao enviar deve permitir nova tentativa dentro da política do lembrete.
- **Observado:** `whatsapp-reminders.ts` consulta logs só por appointment/channel e compõe `alreadySent` sem filtrar `status`; quando envio falha, insere linha `status: "erro"`. A próxima execução também vê essa linha e ignora o lembrete. `reminder_logs` tem `UNIQUE (appointment_id, channel)` (`supabase/migrations/20260907052710_4d322e7a-cc76-4cd7-abcf-e0f748f6b593.sql:7-17`), então a linha de erro ainda representa a única tentativa registrada.
- **Impacto:** erro transitório/instância desconectada faz perder permanentemente aquele lembrete.
- **Causa-raiz:** qualquer existência de log é tratada como entrega, sem separar `enviado` de `erro` ou manter estado retentável.
- **Validação segura:** mock de envio com falha na primeira hora e sucesso na segunda; nenhum contato real.
- **Correção recomendada para spec:** máquina de estados de tentativa, retry/backoff e distinção de log enviado vs falha.
- **Regressão necessária:** falha temporária, erro permanente, duplicidade de cron, lembrete extra e envio concorrente.

### INT-006 — Consultas de agenda/log de lembretes ignoram erros

- **Status:** falha de tratamento de erro confirmada; efeito condicional.
- **Gravidade:** P2.
- **Esperado:** falha ao consultar agendamentos/logs deve retornar erro 5xx e evitar enviar mensagens duplicadas.
- **Observado:** `whatsapp-reminders.ts` lê `data` das consultas a appointments e reminder_logs sem verificar `error`. Consulta de agendamentos falha → rotina pula silenciosamente; consulta de logs falha → conjunto vazio pode causar reenvio do lembrete.
- **Impacto:** lembrete perdido ou duplicado durante falha de leitura. Execuções sobrepostas também podem enviar duplicados, pois não há claim atômico do lembrete antes do envio.
- **Causa-raiz:** leitura e envio não formam um claim/idempotency unitário.
- **Validação segura:** mocks de erro de consulta e execução simultânea; verificar contagem de calls do provider mockado.
- **Correção recomendada para spec:** propagar erros e estabelecer claim idempotente por appointment/channel.
- **Regressão necessária:** log indisponível, query timeout, dois workers e eventual falha do insert de log.

### INT-007 — Estado das instâncias WhatsApp observado; associação ao negócio inconclusiva

- **Status:** provedor e estado das instâncias observados em inspeção de produção de 13/11/2026; ligação entre instância e business/unidade não comprovada nesta árvore.
- **Gravidade:** P1 para completude operacional; não atribui a desconexão como causa de falhas anteriores a ela.
- **Evidência:** o registro de inspeção por SSH/Evolution informa que o app usava Evolution e duas instâncias estavam desconectadas. Uma não tinha webhook; a outra tinha webhook ativo e header compatível com o app, mas caiu em 12/11 às 21:02 (Fortaleza). Havia atividade de mensagens antes dessa queda; a desconexão posterior não explica por si só o relato anterior (`C:\Users\Felps\segundo-cerebro\clientes\agenda-agora.md:485-490`). Versão instalada, business correspondente e situação atual depois da inspeção não foram estabelecidos.
- **Validação segura:** correlacionar instâncias a negócios e capturar status/configuração em leitura somente; para teste de envio, usar número controlado e autorização explícita. Nenhuma mensagem foi enviada nesta auditoria.

### Evidência de produção — crons rejeitados e instâncias Evolution desconectadas

O checkpoint de inspeção somente leitura de 13/11/2026 registra 72 de 72 execuções identificadas do cron horário de lembretes como HTTP 401 e 4.319 chamadas do cron AgPay igualmente rejeitadas em 72 horas, causadas por valores divergentes de `AGENDA_CRON_SECRET` no app e no cron. O código local confirma que os dois hooks retornam antes de executar seus workers; AgPay não chamou `processAgpayWebhookEvents` nem `expirePendingDeposits` nessas requisições (`infraestrutura.md`, DEP-007). Não se inferiu quantidade de pagamentos/eventos em fila ou transações afetadas, pois não houve leitura do Supabase.

Na mesma inspeção, o app selecionava Evolution e duas instâncias estavam desconectadas; uma delas já estava sem webhook e a outra caiu após atividade de mensagens. Os registros não identificam qual business pertence a cada instância nem demonstram se esses estados permanecem iguais agora. Para o relato de falha de saudação/confirmação, cron 401, desconexão posterior e parser `@lid` são fatores observados separados; nenhum foi provado como causa única de uma mensagem específica.

## Regras de segurança observadas

- Endpoint de entrada exige segredo em header e faz comparação `timingSafeEqual`.
- Token de instância UazAPI é enviado por header e não aparece no path logado (`uazapi.server.ts:34-60`). Evolution não loga response body.
- Conectar/gerar QR/status/desconectar/testar envia mensagens só por função server-side autenticada e verificação de membership/permissão.
- Nenhum teste de mensagem foi executado.

## Revisão adicional de reserva pública e cron

- `cancelAppointmentPublic` e `rescheduleAppointmentPublic` usam `publicCode` UUID e rate limits dedicados; verificam estado e janela mínima. A atualização de status de cancelamento tem guarda `.eq(status, "agendado")` e lida com concorrência lendo estado final. Não foi encontrado nesta amostra um bypass do code.
- `getMyBookings` e `getDepositStatus` são públicos e dependem de UUIDs de cobrança/public code como capability; risco de descoberta por força bruta parece baixo, mas limitação, enumeração e privacy não foram testadas em ambiente web.
- Três cron hooks usam `authenticateCronRequest` (Bearer `AGENDA_CRON_SECRET`, com secret anterior opcional). A inspeção de 13/11 confirma 401 sustentado nos hooks de lembretes e AgPay por divergência de segredo; DEP-007 separa essa evidência de ausência de segredo no boot (DEP-006).
- Integração WhatsApp inclui provider configurável UazAPI/Evolution, parser multi-formato e segredos no header; inspeção de 13/11 viu Evolution e duas instâncias desconectadas, sem mapear instância para negócio nem confirmar estado posterior.

### Validação de integrações simuladas

- `npm run test -- src/lib/whatsapp-greeting.server.test.ts src/lib/whatsapp-greeting.post-service.test.ts src/lib/whatsapp-notify.server.test.ts src/lib/evolution.server.test.ts src/lib/uazapi.server.test.ts src/routes/api/public/whatsapp-incoming.test.ts`: 6 arquivos, 62 testes aprovados.
- As suítes substituem chamadas externas por `fetch` mockado ou funções fakes; nenhum envio real foi feito.
- Soma de todas as rodadas dirigidas até aqui: 17 arquivos, 278 testes aprovados. As suítes de integração persistente do ledger foram excluídas; não foi executada uma suíte completa.

### INT-008 — Erro transitório de leitura pode descartar mensagem pós-atendimento

- **Status:** falha confirmada no tratamento de erros do código; ocorrência em produção desconhecida.
- **Gravidade:** P2.
- **Módulo:** integrações / fila WhatsApp / notificações.
- **Esperado:** falha temporária ao carregar agendamento ou negócio deve manter a mensagem pendente para retry; só ausência/estado terminal confirmado deve marcar como processada.
- **Observado:** `enqueuePostServiceMessage` (`src/lib/whatsapp-greeting.server.ts:316-326`) ignora `error` ao consultar appointment e retorna `false` quando `data` é nulo. `processPostServiceMessages` (`:386-395`) também não inspeciona `error` e marca a linha `processed_at` com `last_error: "atendimento não está concluído"` se `data` vier nulo; query de negócio (`:432-440`) segue a mesma política e pode concluir como “WhatsApp não conectado”. A tabela tem `UNIQUE(appointment_id)` (`supabase/migrations/20261103000000_security_hardening.sql:77-83`), o que impede inserir outra fila para reparar a mesma mensagem.
- **Impacto:** indisponibilidade transitória de leitura pode perder silenciosamente uma mensagem pós-atendimento que não será reagendada; a operação pode retornar sucesso mesmo sem inserir a fila.
- **Reprodução segura:** fake DB devolvendo erro para `appointments`/`businesses` e observar estado da fila e retorno; nenhum envio real.
- **Causa-raiz:** consultas tratam erro e ausência de linha da mesma forma; estado terminal da fila é gravado sem confirmar leitura.
- **Correção recomendada para spec:** propagar erro antes de marcar processado; separar retryable erro técnico de estado de negócio terminal; manter contador/backoff e status final observável.
- **Regressão:** erro de leitura mantém `processed_at` nulo e permite retry; status confirmado não concluído segue sendo encerrado sem envio; falha permanente fica visível para operador.

### INT-009 — endpoint de mensagem de teste não limita envios nem valida o telefone normalizado

- **Estado (2026-11-15):** parcialmente mitigado; bloqueado pela falta de política para restringir o destino a um número verificado/aprovado.
- **Gravidade:** P2 potencial (envio externo / reputação / abuso de integração).
- **Módulo:** integração WhatsApp / segurança de endpoints com efeito externo.
- **Esperado:** uma ação de teste deve ser limitada por conta/negócio, aceitar apenas destino válido e aprovado, e restringir a mensagem à finalidade de diagnóstico.
- **Observado:** `sendTestMessage` agora limita a três tentativas por negócio em dez minutos, normaliza somente formatos brasileiros de 10/11 dígitos (com `55` opcional), e usa texto fixo do servidor; o campo `template` foi removido do contrato de entrada. O destino ainda pode ser qualquer telefone brasileiro válido informado por usuário autenticado com `generate_qrcode`. O limiter é em memória no processo único e reinicia junto do serviço.
- **Impacto residual:** até três mensagens fixas por negócio por janela podem ser dirigidas a qualquer número válido; não há confirmação de posse do destino. O limite reduz abuso repetido, mas não substitui política de número aprovado/verified.
- **Reprodução segura:** usar handler e provider mockados; chamar repetidamente com a mesma conta, destino sintético e mensagem fixa, e testar telefone composto por caracteres não numéricos com comprimento permitido. Confirmar número/conteúdo encaminhados e ausência de bloqueio local; não contatar UazAPI/Evolution nem enviar mensagem real.
- **Causa-raiz:** o endpoint de teste não tinha cota, telefone era apenas comprimento e o conteúdo vinha do chamador. Cota/normalização/conteúdo foram corrigidos; autorização do destinatário continua sem regra de produto.
- **Bloqueio:** definir se o destino deve ser o telefone do responsável, um telefone previamente verificado, ou um número de teste escolhido com confirmação explícita. Não restringi a um campo de negócio que não está verificado nem adicionei fluxo de verificação sem escopo.
- **Validação local:** RED/GREEN cobre normalização de telefone formatado, rejeição de entrada malformada, mensagem fixa apesar de `template` forjado e bloqueio da quarta chamada. Testes endpoint/rate-limit 13/13; suíte completa 137 arquivos/1.071 aprovados, 3 arquivos/8 testes ignorados; `npx tsc --noEmit` passou.
- **Bloqueio remanescente:** sem política de destino verificado, o destinatário segue arbitrário entre números válidos. Nenhuma mensagem real ou rate limit do provedor foi testado.

### INT-010 — criação externa da instância pode ficar órfã ou duplicar em retry/concorrência

- **Estado:** sequência externa→persistência e falta de claim/compensação confirmadas estaticamente; criação duplicada ou órfã não foi reproduzida.
- **Gravidade:** P2 potencial, condicionada a limites, custos ou quotas do provedor.
- **Módulo:** integração WhatsApp / provisionamento de instância.
- **Esperado:** criar no máximo uma instância por negócio e manter um caminho recuperável se a persistência local falhar após sucesso externo.
- **Observado:** quando não encontra credencial, `connectWhatsapp` chama `createBusinessInstance` e só depois grava credencial privada e atualiza `businesses` (`src/lib/whatsapp.functions.ts:116-128`). Não há claim/idempotency lock por negócio. Duas chamadas concorrentes podem ambas ler “sem instância” e executar a criação antes das gravações. Se a criação externa responder sucesso e a gravação da tabela privada falhar por erro que não seja “schema indisponível”, `persistWhatsappCredential` relança erro (`:96-108`) sem compensação; se a tabela privada estiver indisponível, o token depende da atualização legada de `businesses`, que também pode falhar (`:120-128`). Na nova tentativa, sem uma dessas credenciais persistidas, a função volta a criar instância. A interface do provider UazAPI não oferece operação de delete, embora o adaptador Evolution tenha função de deleção que o fluxo não chama (`src/lib/evolution.server.ts:149-151`; tipo/carregador em `src/lib/whatsapp-provider.server.ts:7-17`).
- **Impacto:** uma instância externa pode ficar sem referência recuperável; retry ou chamadas paralelas podem criar instâncias adicionais e sobrescrever qual credencial fica associada ao negócio. Efeito em cobrança, limite de instâncias e saúde do provider não foi confirmado.
- **Reprodução segura:** provider e storage totalmente mockados; sincronizar duas chamadas para que ambas leiam sem credencial antes de resolver `createBusinessInstance`, ou simular sucesso do provider seguido de falha na escrita. Confirmar quantidade de instâncias criadas, token persistido e resultado do retry. Não chamar endpoint real de criação nem de deleção.
- **Causa-raiz:** efeito externo não idempotente precede persistência/claim local e não existe recuperação compensatória para todos os providers.
- **Correção recomendada para spec:** reservar a criação por negócio com estado/claim transacional e chave idempotente antes da chamada; persistir progresso e tornar retry reconciliável, além de definir deleção/expiração de órfãs quando o provider suportar.
- **Regressão:** concorrência cria no máximo uma instância; falha de persistência mantém intenção recuperável sem repetir create; timeout ambíguo reconcilia antes de nova criação; rollback/deleção só ocorre se provider confirmar a operação.
- **Limitação:** nenhum provider externo foi chamado; políticas de custo/quota, histórico de instâncias e ocorrências reais permanecem desconhecidos.

### INT-011 — webhook oficial de mensagens UazAPI não era reconhecido pelo parser padrão

- **Estado:** corrigido localmente com base no contrato público atual; provider e versão ativos em produção não foram verificados.
- **Gravidade:** P2 potencial (saudação automática pode não processar mensagens no provider padrão).
- **Módulo:** integração WhatsApp / webhook de mensagens / saudação.
- **Esperado:** payload do evento `messages` escolhido pelo adaptador UazAPI deve ser reconhecido, autenticado e associado à instância/negócio correspondente.
- **Contrato verificado:** a [documentação oficial de mensagens](https://docs.uazapi.com/webhook/messages) descreve envelope raiz com `EventType`, `token` e `message`; o exemplo usa `message.chatid`, `message.sender`, `message.senderName`, `message.fromMe`, `message.isGroup` e `message.text`. A [configuração oficial do webhook](https://docs.uazapi.com/endpoint/post/webhook) lista `url`, `events`, `enabled` e filtros, sem campo `headers`.
- **Correção aplicada:** parser aceita mensagem normalizada; roteamento aceita `root.token`. A rota autentica esse token consultando a credencial registrada em `business_whatsapp_credentials`/fallback legado, sem registrar o segredo; tokens desconhecidos recebem 401. Adaptador envia somente campos documentados no corpo de configuração. A rota ainda aceita o segredo compartilhado no header para Evolution.
- **Impacto:** usando o UazAPI atual com o webhook registrado por este adaptador, mensagens recebidas podem ser confirmadas sem saudação; o handler retorna `replied: false` para payload não reconhecido. A ocorrência depende do contrato/versionamento efetivamente usado pela conta, não revalidado.
- **Causa-raiz:** parser/roteamento esperavam o envelope legado e o adaptador enviava `headers` fora do schema público documentado.
- **Reprodução segura:** fixtures sintéticas oficiais passaram pelo parser e rota com fakes; nenhum WhatsApp foi enviado. Token válido cadastrado aceito; desconhecido rejeitado. Evolution e formatos legados preservados.
- **TDD/evidência:** parser e rota falharam antes da correção (parser retornava `null`; rota retornava 401). Após: `whatsapp-greeting.server.test.ts`, `whatsapp-incoming.test.ts` e `uazapi.server.test.ts`: 33/33; `npx tsc --noEmit` passou.
- **Limitação:** documentação pública pode diferir da versão da conta; dashboard, configuração, logs e evento real permanecem não verificados. O provider não foi chamado nem mensagem enviada.

### Ciclo 165 — compatibilidade do webhook Evolution v2

- Comparei a configuração local (`MESSAGES_UPSERT`, `webhook_by_events: false`, URL única e `headers: { "X-Webhook-Secret": ... }`) com a documentação e os tipos do projeto Evolution. A documentação confirma o evento `MESSAGES_UPSERT`; o DTO oficial de instância inclui `webhook.headers`, portanto a ausência desse campo na tabela resumida da documentação não basta para concluir que a Evolution o rejeita. Ver [Webhooks Evolution](https://github.com/evolution-foundation/evolution-docs/blob/main/docs/02-Configuration/Webhooks.md), [DTO oficial](https://github.com/evolution-foundation/evolution-api/blob/main/src/api/dto/instance.dto.ts) e [tipos de eventos](https://github.com/evolution-foundation/evolution-api/blob/main/src/api/types/wa.types.ts).
- O parser local reconhece a estrutura comum Evolution `{ event: "messages.upsert", instance, data: { key: { remoteJid, fromMe }, pushName, message } }`: o parser usa `root.data`, `data.key.remoteJid`, `key.fromMe`, `pushName` e `message.conversation`; o roteamento usa `root.instance`. Um payload capturado no repositório oficial ilustra esse envelope ([issue Evolution #2713](https://github.com/evolution-foundation/evolution-api/issues/2713)).
- Limite conhecido permanece em INT-002: `digitsOf` aceita JID `@s.whatsapp.net`, não `@lid`/`remoteJidAlt`; isso é formato de identidade do remetente, separado da incompatibilidade de envelope UazAPI em INT-011. Assim, não confirmei incompatibilidade base no Evolution; o provider observado em 13/11 foi Evolution, mas a versão instalada continua desconhecida.
- Resultado: sem novo ID. Referências consultadas são documentação/source públicos atuais, não prova da versão instalada. Nenhum provider foi chamado nem mensagem enviada; sem Node/testes. Inventário segue em 150 IDs.


### INT-008 corrigido localmente ? 2026-11-15

Erros nas consultas de appointment, neg?cio, clientes selecionados e credencial n?o s?o mais tratados como aus?ncia: o item mant?m `processed_at` nulo, recebe `last_error` e libera o claim para retry. Appointment inexistente confirmado sem erro continua sendo encerrado como n?o eleg?vel. `enqueuePostServiceMessage` agora propaga falha de consulta; fallback da tabela privada s? permanece para aus?ncia reconhecida do schema. A su?te completa passou: 125 arquivos, 1.015 testes aprovados, 3 arquivos e 8 testes ignorados; `npx tsc --noEmit` passou; `git diff --check` passou com avisos preexistentes de convers?o LF/CRLF. Sem mensagem real, provider, migration ou produ??o. Contagem: 100 corrigidos localmente, 9 bloqueados/n?o verificados e 42 pendentes de 151.

### Ciclo 84 — revalidação de INT-001/002/005/006/008 (2026-11-15)

O código local usa cooldown de saudação de 30 min, extrai `remoteJidAlt`, e trata falhas de reminders e fila pós-atendimento com claim/retry recuperável. Atualizei o índice canônico e os estados do relatório de integrações. Regressão geral: 136 arquivos/1.058 testes aprovados, 3 arquivos/8 testes ignorados; DB 10 arquivos/99 testes; TypeScript aprovado. Nenhuma mensagem ou alteração de instância remota foi enviada; produção e payloads da instalação ativa continuam sem validação.

### INT-002 — número alternativo do remetente LID revalidado (2026-11-15)

O parser atual tenta `key.remoteJidAlt` e `candidate.remoteJidAlt` após o JID primário e só aceita telefone alternativo em formato discável `@s.whatsapp.net`; LID sem alternativo é ignorado. Testes focais em `whatsapp-greeting.server.test.ts`: 3/3 para LID com número, LID sem número e filtros de grupo/mensagem própria. O relatório detalhado ainda descrevia o comportamento antigo; código local já contém a correção. Sem webhook ou produção. Tally reportado 128/17/6 sem reconciliação item a item.

### INT-005/006 — retry de lembrete e leituras falham fechadas (2026-11-15)

Estado atual do handler `src/routes/api/public/hooks/whatsapp-reminders.ts`: não lê `reminder_logs` para inferir envio; usa `claim_whatsapp_reminder` antes de chamar o provedor, registra falha via `finish_whatsapp_reminder(p_sent=false)` e permite novo claim após status `erro`; erro de leitura de businesses/appointments ou falha de claim/finish encerra com HTTP 500 antes de continuar sem controle. O claim impede workers concorrentes para appointment/channel. Validação nesta rodada: `whatsapp-reminders.test.ts` 2/2 (erro de query não envia; falha de envio tenta novamente e sucesso não duplica); DB isolado `functions.test.ts -t 'claim de lembretes WhatsApp'` 2/2, 22 ignorados pelo filtro. Arquivos de código conferidos: handler, teste da rota, migration `20261114220000_claim_whatsapp_reminders.sql` e `tests/db/functions.test.ts`; nenhum código alterado nesta revalidação. Migrations/deploy de produção e operação do cron não verificados; nenhuma mensagem enviada. INT-005/006 já constavam no grupo localmente corrigido; tally histórico reportado 128/17/6 sem reconciliação item a item.

### INT-009 — envio de teste limitado e normalizado, destino ainda sem política (2026-11-15)

Revalidei `sendTestMessage` em `src/lib/whatsapp.functions.ts`: destino passa por `normalizeTestPhone`, aceita somente telefone brasileiro válido após normalização, usa texto fixo do servidor (ignora template enviado) e aplica 3 chamadas por business/10 minutos antes do provider. `npx vitest run src/lib/whatsapp.functions.test.ts`: 4/4, cobrindo mensagem fixa/número normalizado, desconectado, entrada inválida e bloqueio da quarta tentativa; provider está mockado. Nenhuma mensagem externa enviada. Permanece pendente definir destino do teste como telefone do responsável, telefone previamente verificado ou número escolhido com confirmação explícita; o telefone arbitrário válido continua aceito e o rate limit é em memória/processo. Tally histórico permanece reportado 128/17/6, sem reconciliação item a item.

### INT-010 — dependência de reconciliação do provedor confirmada (2026-11-15)

Revalidei o caminho local em `src/lib/whatsapp.functions.ts`: `connectWhatsapp` cria a instância externa antes de persistir a credencial privada e as colunas legadas; não há claim por business no handler. Não acrescentei chamadas a provider. A documentação pública UazAPI consultada descreve `POST /instance/create` com `admintoken` e um `name` (`https://docs.uazapi.com/docs/getting-started`), identifica `409` como conflito/operação já em andamento e recomenda consultar estado antes de repetir (`https://docs.uazapi.com/docs/errors-and-retries`), mas não encontrei no material consultado um contrato de idempotência, consulta/reconciliação da criação ou remoção de instância que cubra resposta ambígua. A documentação também não estabelece qual provider/versão está ativo no runtime do projeto. Sem isso, retry automático, rollback ou chave de nome não podem ser presumidos seguros; manter bloqueado até confirmar contrato e provider. Nenhuma instância foi criada/removida. Tally histórico reportado 128/17/6 permanece não reconciliado.


### Revalidacao INT-001/INT-008 - 2026-11-15

INT-001: GREETING_COOLDOWN_MS e 30 minutos e a migration 20261114210000_whatsapp_greeting_30_minute_cooldown.sql tambem usa a janela de 30 minutos na claim atomica. INT-008: falha transitoria ao ler appointment/business preserva a fila pendente; conclusao so ocorre apos ausencia/estado terminal confirmado. Regressao atual whatsapp-greeting.server.test.ts + whatsapp-greeting.post-service.test.ts: 2 arquivos/18 testes aprovados; sem mensagem real. Migration, provider e fila em producao nao verificados.


### INT-007 revalidado ? ambiente local diverge do snapshot de producao (2026-11-15)

A inspecao anterior de 13/11 registrou Evolution em producao e duas instancias desconectadas, mas sem associacao comprovada a businesses/unidades. No `.env` local atual, `WHATSAPP_PROVIDER` esta ausente (o codigo seleciona UazAPI por padrao), credenciais UazAPI estao presentes e `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` estao ausentes. Isso nao confirma o provider do processo em producao. Acesso SSH atual ao host foi negado; nao consultei provider externo nem enviei mensagens. INT-007 permanece inconclusivo sobre estado atual, associacao e causa operacional.


### INT-007 revalidado no runtime (2026-11-15)

VPS read-only confirmou `WHATSAPP_PROVIDER=evolution`, servico app 1/1 e container Evolution ativo. Supabase HEAD/count-only: 4 negocios ativos; 1 com instancia configurada e 1 marcado conectado; uma credencial privada associada a cada contagem. Nenhum ID, token ou payload lido. A consulta confirma selecao do provider e associacao agregada, mas nao prova que a instancia esteja conectada na API Evolution neste instante. Painel Evolution/instancia nao consultado; estado live permanece parcialmente nao verificado.

### INT-007 — verificação live Evolution (2026-11-15)

GET read-only `GET /instance/fetchInstances` ao endpoint oficial do runtime respondeu HTTP 200. A resposta foi agregada sem nomes, tokens, telefones ou IDs: duas instâncias, ambas `close`. Consulta Supabase via service role apenas em memória comparou duas credenciais privadas: uma corresponde a instância existente e outra não. A reconexão de uma instância requer escanear QR pelo WhatsApp vinculado; nenhuma instância foi criada, reiniciada, conectada ou alterada.
# Checkpoint — auditoria Agenda Agora

- Início: 2026-11-13 (America/Fortaleza).
- Repositório auditado: `C:\Users\Felps\code\agenda-agora`, branch `main`, HEAD `323189d` (`origin/main`, conforme `git status --short --branch`).
- Limite: análise estática e consultas somente leitura. Nenhuma cobrança, repasse, mensagem ou alteração de dados foi executada.
- Alterações locais preservadas: `CLAUDE.md` removido; `.claude/launch.json`, `AUDITORIA_AGENDA_AGORA.md` e `docs/prompt-pro-agente-limpo.md` não rastreados. Outras cópias também têm alterações próprias; foram excluídas das evidências da versão principal.

## Ciclo 1 — reconhecimento e pagamentos

Concluído até aqui:
- Identificadas quatro árvores com Git. A cópia canônica é `code/agenda-agora`; `agenda-agora-010` (branch `endurecimento-010`), `agenda-agora-panel1-preview` e `agendaagora-opencode/agenda-agora-main` são árvores distintas e não foram misturadas.
- Mapeada a história de gateway nas specs 003, 004 e 008. A migração histórica para AgPay preservou campos de split, mas o modelo de entrega 004 removeu split de cobrança: recebimento integral pela plataforma e saques posteriores.
- O código atual de criação Pix chama `POST /payments/pix` sem `splits` (`src/lib/agpay.server.ts:158-181`). A comissão é calculada no ledger interno (`src/lib/agpay-events.server.ts:77-120`).
- O adaptador ativo encontrado é AgPay (`src/lib/agpay.server.ts:11-13,36-56`). Não foi encontrado adaptador de runtime para Asaas ou RGPay; referências Asaas aparecem no histórico/migrations.
- A consulta ao conector MCP foi recusada e o projeto não aparece na lista MCP. No ciclo 170, a URL/ID/chave service role do `.env` foram validados sem exibir valores e GET direto ao Data API funcionou; isso supersede a afirmação de que nenhuma linha de produção era acessível, com escopo limitado às consultas descritas no checkpoint atual.

Achados iniciais documentados em `pagamentos.md`. Nenhuma causa foi inventada com base na contagem relatada de quatro negócios.

## Módulos

| Módulo | Estado | Evidência/limitação |
|---|---|---|
| Reconhecimento e cópias | Parcialmente concluído | Canonical `code/agenda-agora` identificado; cópias não misturadas; estado local preservado |
| Pagamentos/split | Parcial | AgPay, ledger, assinatura, saques, webhooks e grants/RLS locais revisados; 4 negócios/10 depósitos consultados por GET; crons rejeitados em produção; fila/dashboard ainda pendentes |
| Backend e APIs | Parcial | Censo de 131 handlers em 31 arquivos; SDR e superfícies centrais revisados por amostra, revisão de todos os handlers e autorização cross-tenant pendentes |
| Banco de dados/RLS | Parcial | 40/40 tabelas `public` identificadas na chain local têm RLS habilitado; 13 sem policies são restritas a backend por grants/revokes locais; schema/policies efetivos remotos continuam pendentes |
| Agendamentos | Parcial | Reserva, disponibilidade, sinais, tokens públicos e permissões parcialmente revisados; concorrência e expiração em runtime pendentes |
| Frontend/jornadas | Parcial | 29 rotas e 97 componentes mapeados; telas e jornadas não foram exercitadas integralmente em browser, acessibilidade permanece pendente |
| Segurança/infraestrutura | Parcial | Sessão, CSRF, sinks HTML, telemetria, migrations e proxy versionado revisados por amostra; segredo dos crons divergente observado em produção; MFA, outros secrets, backups e firewall pendentes |
| Integrações (WhatsApp e demais) | Parcial | Adaptadores e filas revisados; inspeção de produção viu Evolution e duas instâncias desconectadas; mapeamento business, fila e saúde posterior pendentes |
| Riscos e consolidação | Em andamento | Inventário atual com 151 IDs únicos; falhas confirmadas, operacionais, riscos condicionais e lacunas de produção separados em `problemas.md`/`riscos.md`; consolidado parcial em `relatorio-consolidado.md`. |

## Validações realizadas

- `git status --short --branch`, `git log`, `git remote -v` nas quatro árvores.
- Busca estática por gateway, split, comissão, webhooks, migrations e docs.
- Leitura de código-fonte/specs e testes dirigidos em harnesses mockados; ciclos 4, 5, 6, 10, 12 e 17 registram 20 arquivos distintos / 320 testes aprovados (execuções posteriores repetiram subconjuntos).
- Tentativa de listar tabelas do Supabase de produção: negada; sem mutação.

## Limitações

- Spec Kit e specs `001–010` estão em `specs/`, ignoradas via `.git/info/exclude`; são artefatos locais da árvore principal e não necessariamente o contrato do clone publicado.
- Não há confirmação atual de gateway configurado no ambiente de produção, estado financeiro dos estabelecimentos, fila AgPay, eventos, saques ou aplicação de migrations no projeto `qagot`.
- Logs de produção citados na ficha do cliente em 13/11 são contexto herdado. Não foram reobtidos nesta execução.

## Próximos passos

1. Fechar a revisão do fluxo financeiro: confirmação de cobrança, congelamento da comissão, ledger, estorno e saque.
2. Auditar autenticação/RLS do backend e políticas das tabelas financeiras.
3. Examinar ciclo de reservas, concorrência, disponibilidade, pagamento de sinal e expiração.
4. Mapear rotas/componentes do frontend e integrações WhatsApp.
5. Retomar a validação de produção somente com acesso de leitura ao projeto correto e evidências operacionais não sensíveis.
6. Manter a lista de achados com status explícito: confirmado, risco suspeito ou inconclusivo.

### 2026-11-13 — documentação oficial AgPay consultada

A página `https://agpay.services/documentacao` respondeu HTTP 200 e foi lida sem autenticação. Ela inclui Pix, checkout de cartão VeoPag, split configurado por regras no dashboard (sem parâmetro por cobrança), cashout, webhook HMAC e lista de eventos. Isso cria lacunas de reconciliação entre docs locais, código e configuração da conta; novas ocorrências PAY-005 a PAY-008 foram registradas em `pagamentos.md`. O runtime e o dashboard da conta seguem sem acesso.

### Ciclo 2 — autorização, banco e agendamento

- Inventariadas rotas e módulos `src/routes/`, `src/lib/`, `src/integrations/`.
- Leitura estática de auth middleware, guarda Master, migrations de hardening e constraints de agenda.
- Varredura de server functions encontrou handlers públicos esperados; amostra inicial mostra auth Master/SDR, rate limit e validação. Revisão completa de cada função ainda pendente.
- Registrados BOOK-001 (vaga com sinal não retida, P1), BOOK-002 (sem proteção atômica quando profissional é nulo, P2), BOOK-003 (falha em leituras de bloqueios/agendamentos pode falhar aberto, P2), além de limitações do schema remoto.
- Nenhum teste foi executado; reproduções propostas usam DB de ensaio/mock isolado. Nenhuma chamada financeira ou mutação remota.
- Módulos: pagamentos parcial; arquitetura parcial; backend parcial; banco parcial por migrations locais; segurança parcial; agendamentos parcial; frontend/integrações ainda pendentes.

### Ciclo 3 — WhatsApp e interfaces críticas

- Mapeados adaptadores UazAPI/Evolution, webhook, cron de lembretes, fila pós-atendimento e funções autenticadas de conexão.
- Registrados INT-001 a INT-007: cooldown 24h vs 30min; parsing sem `remoteJidAlt`; webhook ACK 200 após erro; aviso de pagamento não se repete após falha; lembrete com status erro não é retentado; queries de logs/agendamentos ignoram erro e não há claim atômico do reminder; provider e estado de produção desconhecidos.
- Triada UI de checkout: campos de cartão aparecem, mas ação informa “em breve”; Pix de sinal e assinatura estão conectados a server functions conforme fonte, sem QA browser nesta rodada.
- Criados relatórios `integracoes.md`, `frontend.md`, `riscos.md` e `problemas.md`.
- Sem envio externo, sem operação financeira, sem teste de produção. Próxima rodada: reproduções unitárias mockadas para booking, retry de eventos/reminders e ampliar revisão de frontend/backend.

### Ciclo 4 — testes isolados de pagamentos, reserva e webhooks

- Inspecionados os harnesses dos testes: `agpay-events.server.test.ts` usa banco em memória/fake e mocks para WhatsApp e status AgPay; `booking.functions.test.ts` troca `createServerFn`, banco e AgPay por mocks; os testes de rota mockam persistência/provider.
- Executado `npm run test -- src/lib/agpay-events.server.test.ts src/routes/api/public/agpay-webhook.test.ts src/routes/api/public/whatsapp-incoming.test.ts src/lib/booking.functions.test.ts`: 4 arquivos e 131 testes passaram. Nenhuma integração real foi chamada.
- A execução esclareceu um comentário obsoleto dentro de `booking.functions.test.ts` que dizia que `shouldRequireDeposit` não existia: a função está implementada e a suíte passou; isso não é achado funcional.
- `git status` após a execução mostrou as mesmas alterações preexistentes e apenas os documentos desta auditoria como novos; não houve alteração em código, lockfile ou dados.
- Revisão local de auth confirma validação de token via `getClaims` e checagem atual de `super_admin` no banco para ações Master. Isso não substitui revisão de cada função nem valida as policies remotas; RLS em produção continua inconclusiva.

| Módulo | Estado atualizado | Evidência/limitação |
|---|---|---|
| Pagamentos/split | Parcial | Testes de webhook/ledger passaram; conta AgPay, regras de split e dados reais inacessíveis |
| Backend e APIs | Parcial | Auth central e amostra de guards revisadas; auditoria por função ainda pendente |
| Banco de dados/RLS | Parcial local | Migrations locais indicam isolamento; policies efetivas e migrations aplicadas remotamente não verificadas |
| Agendamentos | Parcial | Testes de disponibilidade/reserva passaram; cenários de concorrência com banco ainda sem reprodução isolada |
| Frontend/jornadas | Parcial | Inventário de rotas e checkout crítico; QA visual, acessibilidade e demais páginas pendentes |
| Segurança/infraestrutura | Parcial | Guards, headers e migrations estáticas; deploy, secrets, logs e backups não validados |
| Integrações | Parcial | Mocks e código revisados; provider, contratos completos, runtime e entregabilidade desconhecidos |
| Riscos e consolidação | Em andamento | Inventário parcial com IDs já criado; severidades serão revisadas no fechamento |

### Próximo ciclo

1. Ampliar auditoria das funções server-side: autorização de negócio/profissional, validação, erros e acesso a service role.
2. Revisar schema/migrations para integridade de cobranças de assinatura, dados de erro e constraints de concorrência.
3. Percorrer páginas frontend por controles e ligações ao backend, sem autenticar em produção nem disparar ações externas.
4. Inspecionar tests adicionais relevantes de carteira, ciclo de assinatura, lembretes e cancelamentos; só executar harnesses comprovadamente mockados.
5. Atualizar cobertura e achados, mantendo indisponibilidades de produção explicitamente inconclusivas.

### Ciclo 5 — fluxo de saque e autorização

- Revisado o fluxo de saque UI → função autenticada → serviço server-side → reserva no ledger → cashout AgPay.
- Achado PAY-009: o PIN é verificado por Server Function separada e a solicitação não exige token/prova, então o controle é contornável fora da UI. Classificado P1; ainda sem reprodução dinâmica mockada.
- Achado PAY-010: lookup de idempotência não filtra/valida `business_id`; risco de retorno de dados de outro negócio se a chave for conhecida. Classificado P2 com pré-condição explícita.
- Regras de reserva e liquidação usam RPCs transacionais com chaves idempotentes conforme migrations locais. Sem acesso remoto para confirmar aplicação; sem operação AgPay.
- Executados mais 7 arquivos de teste de AgPay, saque, cobrança de assinatura, taxas, métricas e ciclo de assinatura: 85 testes passaram. Todos os harnesses selecionados mockam HTTP/DB; testes de integração que exigem `LEDGER_TEST_BUSINESS_ID` foram deliberadamente excluídos.
- Cobertura do módulo pagamentos permanece parcial: falta reprodução segura do PIN/idempotência, verificação de contratos/refunds do gateway e dados/configuração de produção.

- Complemento do ciclo 5: PAY-011 confirma que cashout server-side usa chave Pix salva sem consultar status/identidade da aprovação manual; SEC-004 registra ausência de limite local no handler de PIN e impacto condicionado à infraestrutura desconhecida. Estes achados não foram exercitados dinamicamente e não envolveram operação financeira.

### Ciclo 6 — integrações WhatsApp e autenticação de cron

- Executados 6 arquivos de teste: saudação de entrada, fila pós-atendimento, notificações, clientes Evolution/UazAPI e webhook de entrada. Resultado: 62 testes passaram; chamadas HTTP foram substituídas por `fetch` mockado e env de teste.
- Somando as rodadas dirigidas: 17 arquivos, 278 testes aprovados. Não foi executada a suíte completa, pois existem testes de integração de ledger que escrevem no Supabase quando variáveis de teste estão configuradas.
- A inspeção atual do código confirma que os três hooks (AgPay, lembretes WhatsApp e ciclo de assinatura) usam `authenticateCronRequest`, que exige `Authorization: Bearer` de `AGENDA_CRON_SECRET`, com suporte de rotação por `AGENDA_CRON_SECRET_PREVIOUS`. Isso é evidência do contrato esperado no código, não da configuração nem dos logs de produção.
- O endpoint WhatsApp continua retornando HTTP 200 após erro de `handleIncomingWhatsapp`; registro atual pode não permitir retry externo. Os lembretes consultam logs sem filtrar `status` e ignoram erros nas queries, como documentado em INT-003/005/006.
- Revisados cancelamento/remarcação públicos por `publicCode` UUID e status; funções são limitadas por rate limiter e checam janelas de política. Conflitos simultâneos ainda dependem da constraint e seguem sujeitos às lacunas BOOK-001/002.

### Próximo ciclo

1. Completar matriz rota/controles, incluindo páginas Master, configurações, profissionais, serviços, clientes e suporte.
2. Revisar todas as Server Functions de negócio para autorização por usuário/estabelecimento e falhas ignoradas.
3. Revisar migrations por grants de colunas, policies por papel e constraints relevantes; distinguir intenção local do schema efetivo remoto.
4. Rever arquitetura/runtime e dependências sem ler ou imprimir segredos; pedir acesso de leitura ao projeto de produção apenas se disponível via conector.
5. Consolidar reproduções mockadas para PAY-009/010/011 em harness temporário seguro quando possível, sem alterar código ou dados.

### Ciclo 6 — validação simulada da camada WhatsApp

Seis arquivos mockados de saudação, notificações, filas e adaptadores Evolution/UazAPI passaram (62 testes). O teste verificou parsers e comportamento com HTTP fake, sem envio de mensagens. Somados aos ciclos dirigidos anteriores: 17 arquivos / 278 testes. Não executar suite completa sem avaliar os testes opt-in do ledger que escrevem no banco.

### Ciclo 7 — relatório financeiro Master

- Comparados `agpay-performance.functions.ts`, seus testes e a spec 010 (T059). O teste valida fonte de lucro do ledger e papel Master, mas usa datas iguais para criação/confirmação.
- PAY-012: comentário menciona período por `paid_at` ou `created_at`, mas filtro é só por `created_at`; definir política de reconhecimento antes de declarar defeito contábil.
- PAY-013: consultas de datasets ignoram `error`, valores ausentes viram listas vazias e `deposits`/`withdrawals` têm `limit(5000)` sem paginação. Regressões propostas são fakes locais.
- Princípio da spec 010 de lucro calculado pelo ledger está atendido na função e no teste atual (T059); não valida completude, janela temporal, erros ou dados reais.

### Ciclo 8 — dependências e superfície de desenvolvimento

- `npm audit --json` e `npm audit --omit=dev --json` terminaram exit code 1. Lockfile: 2 avisos High e 7 Moderate; `zod@3.25.76` está no runtime, Vite `8.1.5` é dependência dev do projeto e `typescript-eslint` é dev.
- DEP-001: advisory High do Zod para arrays grandes sem limite, com schemas `serviceIds`, `workingDays` e `availableDays` sem `.max()`. Exposição efetiva depende de limites HTTP, mas não foi assumida como segura.
- DEP-002: advisory High do Vite 8.1.5 para launch-editor/Windows; configuração de desenvolvimento usa `host: true`, `allowedHosts: true`. Escopo restrito ao dev server; build publicado não foi verificado.
- DEP-003: sete avisos Moderate incluem `typescript-eslint` e `minimatch` transitivo, classificados como ferramentas dev; sem cadeia runtime demonstrada.
- Consultadas advisories GitHub oficiais. Nenhum payload de exploração, instalação, atualização ou mudança de lockfile.

### Ciclo 9 — reconciliar webhook e regra de comissão com a spec 005

- Verificada a edge case explícita em `specs/005-ledger-financeiro-saldo/spec.md:147-149`: valor de webhook divergente deve ficar suspeito, sem crédito automático e ir para revisão manual.
- PAY-014: `WebhookPayload` não declara `amount` e o worker passa apenas transaction UUID/status à confirmação. O ledger usa valor local; não existe comparação nem alerta de divergência. Desvio de comportamento está confirmado; ocorrência real no gateway é desconhecida.
- PAY-015: spec 005 (FR-001) declara 0% + R$ 0,25; código atual tem `PLATFORM_FLAT_FEE_CENTS=0`, com comentário de retirada em 06/10/2026. Spec 010 revisada não formaliza a substituição dessa comissão fixa. Decisão comercial vigente inconclusiva.
- Próxima validação pode usar só harness in-memory da suíte AgPay; não simular via gateway nem alterar registros.

### Ciclo 10 — validações mockadas de funções de negócio

- Executados `appointments.functions.test.ts`, `services.functions.test.ts` e `professionals.functions.test.ts`: 3 arquivos, 42 testes aprovados.
- Harnesses revisados usam mocks de autenticação/DB; não consultam o Supabase real nem alteram conta de estabelecimento.
- Cobertura acumulada das suítes dirigidas: 20 arquivos, 320 testes aprovados. Isso valida apenas cenários escritos nos testes; não cobre regras RLS remotas, arrays enormes do DEP-001 ou reprodução do PAY-014.
- Os handlers de serviço/profissional consultam `businessId` com contexto autenticado e verificam propriedade antes da mutação. O endpoint de status de agendamento usa RPC de permissão granular. A validação negativa de dois negócios em toda a superfície segue pendente.

### Ciclo 11 — fila de mensagens pós-atendimento

- Revisada a fila atômica `post_service_message_queue` e processamento pelo cron.
- INT-008: leituras de agendamento/negócio não verificam `error`; `data: null` leva a `processed_at` apesar de não distinguir falha de ausência. Como `appointment_id` é UNIQUE, não há nova linha para retry após encerramento.
- O claim SQL usa `FOR UPDATE SKIP LOCKED` e libera locks de itens pendentes após 10 minutos; concorrência de claim tem proteção local. Ainda falta política de tentativas, backoff e dead-letter observável para falhas de entrega.
- Nenhuma mensagem foi enviada; reprodução dinâmica só com banco falso.

### Ciclo 12 — cobranças da assinatura

- `PAY-016`: o worker não roteia `transaction.failed` para `subscription_charges`; a UI só termina polling em estado pago/falhou/expirou. A lacuna de transição local está confirmada; o contrato do evento de expiração e sua ocorrência real seguem sem validação.
- `PAY-017`: a chamada de criação gera nova cobrança a cada invocação. A UI permite fechar e reabrir o modal durante Pix pendente, e o schema não impede mais de uma pendência por negócio/ciclo. Confirmado caminho estático, sem executar a reprodução fake nem qualquer operação financeira.
- `subscription_charges` guarda `provider_payment_id` único e estado, mas não `expires_at` nem chave idempotente de ciclo. Inserção ocorre depois de chamar o provedor; se a gravação falhar, pode sobrar cobrança externa sem referência local.
- O teste fake confirma idempotência no mesmo provider ID (`agpay-events.server.test.ts:574-605`): segundo callback retorna `already_paid` e o histórico registra uma linha. IDs diferentes continuam independentes; isso não impede pagamentos duplicados para uma extensão congelada.

### Próximos passos

1. Revisar `confirmSubscriptionCharge` e testes correlatos para idempotência de webhook, dupla cobrança e histórico.
2. Exercitar PAY-016/PAY-017 somente com harness em memória, se o harness puder validar a hipótese sem alterar arquivos de código ou conectar a serviços reais.
3. Continuar revisão das Server Functions, matriz de páginas e constraints/migrations; módulos continuam parciais.
- Revisão dos testes `src/lib/agpay-events.server.test.ts:574-605`: callback repetido do mesmo provider ID devolve `already_paid` e cria uma única linha de histórico. Essa idempotência por cobrança não deduplica dois IDs de cobrança diferentes; PAY-017 fica limitado a pagamentos distintos para uma extensão congelada.
- Rodados `npm exec vitest -- run src/lib/agpay-events.server.test.ts src/lib/subscription-charge.functions.test.ts`: 2 arquivos / 40 testes passaram. Os harnesses substituem DB e AgPay por mocks, sem chamadas financeiras reais.
- `PAY-018`: criação do Pix vem antes do insert local; erro no insert não tem compensação observada na função. Confirmada sequência estática, não reproduzida ainda.

### Ciclo 13 — censo das funções server-side

- Varredura de 31 arquivos com `createServerFn` encontrou 131 handlers. Endpoints sem middleware TanStack têm intenção de publicidade clara ou autenticação própria (booking, SDR, assets, captura de erro); continua pendente confirmar cada guarda e os casos negativos cross-tenant.
- Token SDR HMAC tem TTL de sete dias; handlers validam assinatura e status ativo, login usa bloqueio persistido em `auth_attempts`. Runtime/estado remoto permanece desconhecido.
- Captura pública de erros valida Origin e sanitiza conteúdo; cota usa primeiro XFF. Caddy padrão ignora XFF recebido de clientes; proxy anterior/topologia e IP efetivo continuam sem validação. Nenhuma vulnerabilidade foi confirmada.
- Revisão do endpoint de reset SDR mostrou associação por `sdr_id` e evento antes da troca; nenhuma alteração foi executada.




### Ciclo 14 — transações Master

- `painel.transacoes.tsx` mantém estados de tipo/status, porém `currentList` deriva apenas de busca e aba; “Aplicar filtros” apenas define página 1. Achado UI-002 confirmado em fonte; reprodução visual não executada.
- `getTransactions` descarta `error` das quatro leituras e limita depósitos/saques a 2.000; métricas derivam da lista truncada. PAY-019 confirmado no handler, volume/ocorrência real desconhecidos.
- Os achados estão separados: UX de filtro vs completude financeira. Não foram usados dados reais nem browser de produção.

### Ciclo 15 — autenticação e reset de senha

- Login autenticado segue Supabase Auth; rota lê `user_roles` do banco e separa destinos por host. Server middleware usa `getClaims`; Master revalida role no banco.
- Reset Master/SDR validam papel/token e registram evento antes de alterar senha; fluxo foi apenas lido, sem alteração em usuário.
- Lockout SDR aparece persistente via `auth_attempts`/RPC. Política de autenticação Supabase para PIN de owners, MFA/aal, segredo token e logs de produção seguem sem leitura remota.
- Nenhum novo defeito confirmado. Revisão de autorização cross-tenant dos restantes handlers segue pendente.

### Ciclo 16 — ações de relatórios de clientes

- Varredura de marcadores `TODO`, `FIXME`, “em breve” e callbacks vazios detectou `comparativo-evolutivo`: opção do menu dispara apenas toast de sucesso com texto “relatório em breve”, sem backend/tela. UI-003 registrado como incompletude P3; confirmar escopo com spec.
- Callback `onSubmit={() => {}}` em `AppearanceEditor` é conteúdo inerte do preview, conectado ao renderer de demonstração; não foi contado como ação de produção sem evidência em contrário.

### Complemento do ciclo 14 — semântica do lucro na tela Master

- `netCents` é preenchido com `net_amount_cents` do depósito ou saque líquido de taxas (`transactions.functions.ts:73-98`), mas a UI o mostra na coluna “Lucro Ag Pay” (`painel.transacoes.tsx:359,391-394`). PAY-020 registra a divergência com FR-021 de spec 010; resultado não verificado em uso real.
- UI-002/UI-003 foram ligados a FR-028 de spec 010: filtros e ação de relatório são controles sem efeito/resultado funcional.

### Ciclo 17 — cron do ciclo de assinatura

- `subscription-lifecycle` processa os avisos via select de eventos recentes seguido de insert; sem constraint única, duas execuções simultâneas podem duplicar a timeline (PAY-021). O teste atual comprova apenas repetição sequencial.
- A rotina busca `businesses` sem paginação (PAY-022); corte só é real se o total exceder limite de resposta Supabase, configuração remota não disponível.
- Cancelamento após 15 dias é opt-in e default `false`; UI Master exige confirmação do responsável antes de ligar. Existe job/systemd e runbook, porém schedule/setting/última execução no ambiente publicado não foram validados. FR-024 em produção permanece inconclusiva.
- Não houve chamada ao cron remoto nem alteração de setting.
- `PAY-023`: deduplicação usa título + negócio e horizonte fixo de 45 dias; como o acesso renova em 30 dias, o aviso do mesmo estágio no ciclo seguinte pode ser classificado existente. O alerta visual do dono usa outra função e não foi declarado afetado.

### Ciclo 18 — reativação após pagamento

- Auto-cancel grava `status='cancelado'` e `cancelled_at`; a confirmação de assinatura só atualiza `access_until`. Como `classifyLifecycle` prioriza `cancelled_at`, estabelecimento segue em categoria cancelado no painel Master após pagamento (PAY-024).
- FR-024 exige restabelecimento após regularização. Não foi demonstrado se a UI do dono efetivamente fica bloqueada após o pagamento; marcar como P1 potencial e validar no harness com fake business/callback.
- Reversão Master limpa marcadores, mas não foi encontrada chamada automática a esse fluxo durante confirmação. Nenhuma mutação real.
- `PAY-025`: contagem de profissionais é usada para calcular base + R$ 10 por adicional, mas erro da query é descartado nos dois fluxos (resumo e criação), com fallback zero. Risco estático confirmado; reprodução com fake pendente.

- Validação adicional: `npm exec vitest -- run src/lib/subscription-lifecycle.test.ts src/routes/api/public/hooks/subscription-lifecycle.test.ts src/lib/agpay-events.server.test.ts` passou (3 arquivos / 49 testes). Os harnesses do hook e eventos usam fake DB/mocks; não cobrem concorrência, sequência de pagamento pós-cancelamento nem volume acima do limite de paginação.
- `getBillingCycle` ignora erro ao ler `subscription_payments` e devolve `pagoHistory: []`; UI renderiza ausência sem distinguir falha (PAY-026). Consultas reais não foram realizadas.

### Ciclo 19 — trial pago e regra de inadimplência

- `trial_days` é histórico persistido no cadastro de trial; confirmação de assinatura não o limpa.
- As telas Master tratam `trial_days != null && !everPaid` como trial, mas cron e RPC `cancel_overdue_business` tratam qualquer `trial_days != null` como trial e pulam cancelamento. PAY-027: conflito confirmado, impacto em produção sem medir.
- Regressão proposta cobre trial não pago e trial com pagamento histórico, vencido 15 dias, usando fakes. Não alterar dados nem setting real.

- `getSubscriptionLifecycle`/`getReceivablesCalendar` agregam consultas sem paginação; algumas coleções limitam a 20.000 e negócios/pagamentos dependem do teto remoto. PAY-028 é condicional a volume/`max_rows`; sem produção acessível para medir.

### Ciclo 20 — ação Master de reversão de cancelamento

- `setBusinessCancellation(action='reverter')` limpa timestamps mas não muda `status`; RPC de auto-cancel grava `status='cancelado'`. UI confirma “conta reativada” após sucesso (UI-004).
- Divergência de estado/mensagem está confirmada; nenhum teste de login, reserva pública ou conta real foi executado para afirmar bloqueio.


### Ciclo 21 — estado cancelado e fluxo público de reservas

- RPC de inadimplência grava `status='cancelado'`; catálogo público não rejeita esse estado, e disponibilidade/booking rejeitam apenas `suspenso` (BOOK-004).
- O risco de que negócios cancelados recebam novas reservas/sinais está confirmado estaticamente; não há evidência de ocorrência em produção. Reproduzir somente em fake DB, sem criar Pix.


### Ciclo 22 — eventos de auditoria nas mutações Master

- `extendBusinessTrial`, `setBusinessAccessDays` e `setBusinessCancellation` ignoram o valor `{ error }` de inserts em `master_business_events`; os `try/catch` não cobrem o retorno de erro do PostgREST (SEC-005).
- Contraste: reset de senha confere o erro antes/depois do Auth Admin. Nenhuma mutação real foi exercida; reproduzir apenas com fake retornando `{ error }`.




## Ciclo adicional — visão geral do Master

- Conferidos `platform-overview.functions.ts` e `PlatformOverview.tsx`: o KPI de estabelecimentos ativos incrementa para qualquer status diferente de `suspenso`, incluindo `cancelado` (ADM-001). O MRR usa categoria lifecycle separada e não inclui cancelados reconhecidos via `cancelled_at`.
- Incluídas as fontes/limites da visão geral no PAY-028: consultas para agregações e KPIs têm limites de 20.000 ou 5.000 sem paginação; volume e limite Supabase remoto não verificados.
- Nenhuma linha de produção foi consultada e nenhuma alteração foi feita fora dos documentos da auditoria.
- A ficha Master (`getBusinessDossier`) tem outras fontes com limite remoto não verificado: serviços, profissionais e pagamentos de assinatura sem paginação explícita; appointments/customers/deposits limitados localmente. Cobertura incorporada ao PAY-028.



- Revisão estática adicional: middleware valida JWT com `getClaims`; guarda Master consulta role atual; RPCs de membership/permissão têm `SECURITY DEFINER`, `search_path` fixo e grants delimitados nas migrations locais; fluxo de mudança de status de agendamento consulta autorização antes de usar client service-role. AAL2 segue como SEC-006 potencial e políticas remotas continuam inacessíveis.
- Revisado provisionamento Master: criação Auth, upsert de role e insert de negócio são etapas separadas; erro de role não é verificado e falha de negócio não remove Auth criado. ADM-002 documentado; nenhuma conta real foi criada.


- Revisados os fluxos de profissionais: consulta de teto de 10 ignora erro e a provisão Auth/role/professional/vínculos tem falhas parciais sem compensação (PRO-001/002). Nenhuma conta ou registro foi criado.

- A tela de aprovação Pix guarda o PIN extra apenas em sessionStorage; endpoints verificam role Master, mas não prova do PIN (SEC-007). Nenhum endpoint foi chamado nesta checagem.

- Revisada a máquina de status de appointments contra RLS local: `bloqueado → agendado` cai em membership genérica e update de service-role, sem permissão granular (API-003, reprodução isolada pendente).


- Adicionada matriz estática de grants/RLS para tabelas financeiras e revisão dos cinco RPCs do ledger: invoker, search_path vazio, execução service-role e validação monetária; `ledger_request_withdrawal` usa lock da wallet. Sem confirmação do catálogo remoto.
- Revisado o caminho público com sinal: erro ao inserir `deposit_payments` após criar appointment não compensa a linha `aguardando_sinal`; não foi encontrada expiração/reconciliação para órfãos sem cobrança (BOOK-005).

- Revisados Dockerfile, serviço systemd, timers, Caddy e deploy VPS: há hardening local documentado; script de release expõe env completo ao build (SEC-008) e falha de health check não reverte symlink (DEP-004). Implantação/timers atuais não consultados.


- Conferidas políticas locais de `user_roles` e hardening de UPDATE em `businesses`: cliente lê apenas suas roles, escrita administrativa permanece privilegiada e trigger filtra colunas de controle. Estado remoto não validado.
- Varredura inicial das funções sem middleware identificou endpoints públicos de booking; em `getMyBookings`, erros em consultas de cobrança/appointment/catálogo são convertidos em lista vazia (BOOK-006). A chamada não foi executada nesta revisão.

- Revisada a validação de profissional na reserva pública: erro ao ler `service_professionals` é tratado como ausência de vínculo e a reserva prossegue (BOOK-007, reprodução mockada pendente).

- Censo regex inicial encontrou 22 Server Functions sem middleware Supabase: rotas públicas de booking, login/token SDR, log de erro e assets públicos. Não se trata de verificação completa de autorização por handler; lista e limites registrados em `backend.md`.


## Estado ao retomar — 2026-11-13

- Ciclos adicionais expandiram a auditoria das grants/RLS financeiras locais, políticas de `user_roles`, autorização de status de appointments, fluxos de criação de negócios/profissionais, chamadas públicas de booking e artefatos da implantação VPS.
- Foram acrescentados BOOK-005/006/007, SEC-006/007/008, ADM-001/002, PRO-001/002, API-003/004 e DEP-004/005; todos têm fonte/caminho esperado e recomendação. Alguns requerem reprodução em fake harness; achados condicionais seguem marcados como potenciais.
- A tabela consolidada tem 66 linhas/IDs únicos na última validação. Próximo trabalho: revisar funções financeiras e agendamento ainda não cobertas, reproduzir os novos caminhos com mocks, avançar a cobertura das jornadas frontend e atualizar matriz por spec. Produção, Supabase remoto, runtime dos timers e gateway seguem inconclusivos.

### Ciclo 23 — permissões de equipe para bloqueios

- Cruzados o guard da rota, a Server Function, as policies locais e a especificação de continuidade das operações de agenda.
- `painel.tsx` libera `/painel/bloqueios` para `block_schedule` ou `block_agenda`, e a migration de 11/10/2026 concede escrita em `time_blocks` com essas permissões. A tela usa `createTimeBlock`, cujo handler consulta o negócio exigindo `owner_id = context.userId`; portanto profissionais autorizados não passam pela gravação (API-004).
- Divergência confirmada estaticamente. Ainda não houve reprodução com identidade de teste nem validação de produção/RLS efetivo. Nenhum dado foi alterado.
- Inventário atualizado para 66 IDs; resta revisão de handlers de pagamentos e agenda, reprodução mockada dos caminhos novos, QA de páginas e matriz de conformidade por requisito.

### Ciclo 24 — reconciliação de estorno

- Revisados persistência do webhook, processamento de estorno/chargeback, RPC de débito no ledger e agregações de carteira, desempenho, dossier e transações.
- Confirmado que o evento debita o líquido no ledger com chave idempotente, mas não atualiza o estado da linha `deposit_payments`. Como as telas/relatórios classificam pelo status `pago` e `paid_at`, um refund processado ainda aparece como pagamento confirmado (PAY-029).
- Cruzamento estático com US3 da spec 005: o débito de saldo está implementado; atualização/reconciliação do estado da cobrança e das métricas não está demonstrada.
- Próxima validação segura: usar os fakes já existentes para verificar o estado após refund e os agregadores; nenhum webhook real, registro remoto ou dado financeiro foi alterado.
- Rodados `src/lib/agpay-events.server.test.ts` e `src/lib/master/business-intelligence.test.ts`: 2 arquivos / 43 testes aprovados. O teste atual de refund comprova débito e idempotência no fake, mas não afirma explicitamente o status remanescente da cobrança.
- Rodado `src/lib/admin.functions.test.ts`: 1 arquivo / 27 testes aprovados; o cenário da conciliação confirma que `paid_at` sozinho inclui a comissão, mas não cobre refund.
- Inventário atualizado para 67 IDs; acessos remotos do gateway/Supabase seguem inconclusivos.

### Ciclo 25 — conciliação de saldo e liquidação de saques

- Revisada a tela Master `LedgerReconciliation`, `getLedgerReconciliation`, RPC `ledger_settle_withdrawal` e seus chamadores de cashout, webhook e ação Master.
- A conciliação local soma available/pending/locked e estima a receita por comissões em registros de pagamentos; a própria UI pede comparação manual com o saldo AgPay, que não está disponível por API segundo a observação local (`src/components/master/LedgerReconciliation.tsx:48-65`). O extrato/dashboard AgPay remoto não foi acessado; não há declaração de conciliação real concluída.
- A RPC de liquidação trava o saque (`FOR UPDATE`), só transiciona de `requested`/`processing` e ajusta bloqueado/reversão na transação (`supabase/migrations/20260929120300_ledger_settle_withdrawal.sql:12-81`). Chamadores observados incluem `withdrawal.server.ts`, `agpay-events.server.ts` e `admin.functions.ts`. Nenhum defeito adicional confirmado nesta amostra; runtime da migration não validado.
- PAY-029 amplia o risco das comissões: refunds deixam a linha marcada como paga, então a própria estimativa manual de receita da plataforma continua incluindo sua comissão. Este item depende da ausência de update após refund, confirmada por inspeção; sem transação real.
- Próxima cobertura prioritária: revisão adicional de autorização e isolamento nas operações financeiras, fluxo completo de reservas e inventário/QA das jornadas restantes do frontend.

### Ciclo 26 — campanhas na página de clientes

- Revisados handlers, inputs e CTAs das campanhas para ausentes e aniversariantes em `src/routes/_authenticated/painel.clientes.tsx`.
- Os dois handlers apenas validam a seleção e emitem um toast de sucesso; não consomem a mensagem digitada nem selecionam/envia contatos por qualquer canal. Os CTAs exibem “Enviar”. Não houve clique em produção nem envio real.
- Registrado UI-005 como incompletude confirmada, gravidade P3 potencial porque o escopo e o canal esperados não aparecem definidos na spec 001; FR-002 é uma obrigação geral de preservar funções de Clientes, não um contrato específico de campanha.
- Inventário consolidado atualizado para 68 IDs únicos. Browser QA, comportamento dos filtros/seleções e definição funcional do produto permanecem pendentes.

### Ciclo 27 — semântica dos atendimentos na área de clientes

- Cruzada query de appointments, segmentação de ausentes, comparativo mensal, cálculo do relatório principal e FR-017 da spec 001.
- A área de clientes exclui somente `bloqueado`, enquanto o cálculo principal de atendimentos concluídos usa `status === 'concluido'`. A divergência objetiva está confirmada; impacto permanece potencial porque o contrato do comparativo de clientes não define se conta reservas ou serviços realizados (UI-006).
- Rodado `npm run test -- src/lib/report-metrics.test.ts`: 1 arquivo / 1 teste aprovado. A suíte prova apenas a definição do relatório principal; não valida a contagem da rota de clientes nem sua segmentação.
- Não houve acesso a dados de cliente nem execução de browser. Inventário consolidado: 69 IDs; semântica de campanhas/relatórios e validação visual seguem pendentes.

### Ciclo 28 — autorização de leitura de clientes

- Cruzados grants e policies locais de `customers`, definição de membership/permission, guarda da navegação, máscara de telefone e colunas pessoais adicionadas por migration.
- Confirmada divergência local: `customers_professional_read` e `appointments_professional_read` autorizam qualquer profissional ativo membro para SELECT sem verificar `view_customer_phone`; a agenda busca `select("*")` e mascara telefone só na renderização. O cliente Supabase autenticado pode consultar a API diretamente. `customers` inclui telefone/e-mail/observações e migrations posteriores acrescentam data de nascimento/CPF (SEC-009).
- Gravidade P1 potencial; resultado no ambiente produtivo depende de migrations/policies efetivas. Não foi usado token de profissional nem consultado dado real; reprodução somente em DB local descartável.
- DB-002 permanece limitação: project ref remoto inacessível, portanto policy aplicada não comprovada. Inventário parcial atualizado para 70 IDs; revisão de outras policies por permissão de campo ainda pendente.

### Ciclo 29 — leitura da linha businesses por profissionais

- Revisados grants/RLS de `businesses`, o estreitamento de SELECT anônimo, migration de hardening, migração privada de credenciais WhatsApp e tipos locais das colunas.
- A migration inicial mantém `SELECT` integral para `authenticated`. A policy `businesses_professional_read` autoriza qualquer profissional ativo; não foi encontrada revogação/restrição de SELECT para `authenticated`. O hardening recente restringe UPDATE, mas não leitura. A chain inclui campos como `withdrawal_pix_key`, `withdrawal_pin_hash`, `owner_cpf`, parâmetros de AgPay e `whatsapp_instance_token` legado; SEC-010 registra potencial de exposição se preenchidos.
- `20261002150000_whatsapp_credentials_private.sql` copia credenciais para tabela privada, mas informa que a nulificação da coluna legada exige migration posterior verificada; nenhuma migration de nulificação foi encontrada. Código ainda contém fallback à coluna legada. Nenhum valor/segredo foi consultado ou escrito.
- Gravidade P1 potencial, não confirmada no serviço remoto. A migration `20260916012915` restringe `anon`, mas não altera os grants de `authenticated`. Acesso Supabase de produção continua indisponível.
- Inventário atualizado para 72 IDs únicos após SEC-011; próxima revisão deve percorrer outras policies e tabelas com campos sensíveis protegidas apenas por navegação de UI.

### Ciclo 30 — leitura do histórico de assinatura por profissionais

- Revisada a policy de `subscription_payments`: migration inicial concede SELECT ao autenticado sob policy de owner; migration de permissões adiciona SELECT para qualquer membro ativo do business. Como as policies são permissivas, o acesso do membro é adicional.
- SEC-011 registra risco potencial de confidencialidade dos valores, meses e status da assinatura. A interface observada é orientada ao proprietário, mas a intenção de produto não está declarada; não classificar como defeito confirmado sem essa confirmação.
- A chain e tipos locais foram lidos; não foi consultado catálogo, migration aplicada nem dado do Supabase de produção. Nenhuma consulta autenticada, alteração ou teste com dados foi feito.
- Inventário consolidado: 72 IDs únicos; esta rodada não executou testes. Módulos e próximo passo permanecem conforme ciclo anterior, com revisão de policies/grants sensíveis ainda pendente.
- O censo da policy de suporte encontrou API-005: seed `sender=master` pelo owner contradiz RLS e falha é ignorada; nada foi escrito nem enviado.

### Ciclo 31 — chat de suporte e policy RLS

- Cruzados os handlers do chat com a policy de INSERT e hardening local. O seed da saudação usa a sessão do owner com `sender=master`, embora RLS permita somente `sender=user`; o erro é ignorado e a thread pode aparecer vazia (API-005, P3).
- A migration de hardening limita UPDATE autenticado a `read_by_user`, então a policy antiga de update não permite por si só alterar sender ou conteúdo após o hardening local. Migrations e grants efetivos em produção continuam não verificados.
- Nenhum chat foi enviado, nenhuma mensagem real escrita e nenhum teste dinâmico foi executado. A lista consolidada passa a 73 IDs únicos após API-005.
- Próxima cobertura: revisar grants e RLS de `reminder_logs`, `client_error_log`, `outreach_templates`, configurações visuais e tabelas auxiliares; inspecionar storage policies e completar matriz de auth cross-tenant.


- Confirmado por arquivos e documentação oficial systemd: `Persistent=true` recupera disparo perdido quando timer esteve inativo; service oneshot diário não tem retry explícito para falha após ativar (DEP-005). Instalação/runtime não consultados.


- E2E versionados: seis specs; smoke de hosts só roda com `SMOKE_PRODUCTION=true`, testes autenticados exigem `OWNER_STORAGE_STATE`, e Playwright cobre desktop/mobile. Não executados para evitar efeitos de upload/provider ou chamadas a produção; QA browser segue pendente.

### Ciclo 32 — RLS da disponibilidade pública

- Revisado `time_blocks`: migration local concede SELECT a `anon` e policy `USING (true)` sem escopo por business. A tabela inclui motivo, data, faixa horária e identificadores internos.
- A rota pública de disponibilidade usa Server Function com client admin; não foi encontrada dependência do browser anon em `time_blocks`. SEC-012 fica como P2 potencial até confirmar migration ativa e uso de `reason` em dados reais.
- Não houve consulta com anon key, inserção de linha, leitura de dados de produção ou teste de endpoint. A matriz consolidada passa a 74 IDs únicos.

### Ciclo 33 — isolamento multi-tenant no Storage

- Revisada a cadeia de policies de leitura do bucket `business-logos`. A função SQL de validação de path reconhece caminhos de assets publicados e staging; policies para authenticated usam apenas bucket + path reconhecido, sem membership/autorização por business.
- SEC-013 registra potencial leitura/listagem e geração de signed URL de assets entre tenants. Staging helper existe, mas não tem caller encontrado no `src` atual; quantidade e conteúdo de objetos remotos desconhecidos.
- A leitura anon de catálogo também foi percorrida: `business_hours`, serviços/profissionais/vínculos e categorias ativas têm políticas públicas. Colunas de `businesses`/`professionals` foram estreitadas por migration; sem contrato explícito de diretório global, visibilidade permanece decisão de escopo, não defeito confirmado.
- SEC-013 amplia a revisão de Storage: a policy authenticated inclui paths staging e não testa business membership; não há acesso/objetos reais verificados.
- Nenhum objeto foi listado, assinado, baixado ou alterado. Nenhuma policy remota foi consultada. Inventário passa a 75 IDs únicos.

### Ciclo 34 — integridade do histórico de pagamentos de assinatura

- Reconstituído o grant local de `subscription_payments`: role `authenticated` tem CRUD; policy `subscription_payments_owner` autoriza `FOR ALL` ao owner. Não foi encontrada revogação posterior da escrita.
- O runtime atual lê o histórico do lado do cliente e dashboards Master o usam para métricas; webhook insere via service role. PAY-030 registra que tenant pode adulterar seu histórico e distorcer relatórios, mas não foi achado caminho direto a `access_until`.
- Nenhuma linha foi alterada e nenhum teste de DML executado. Policies remotas e ocorrências permanecem desconhecidas. A matriz de achados passa a 76 IDs únicos.

### Ciclo 35 — completar triagem local de policies por tabela

- Cruzadas as policies de `profiles`, `professionals`, `services`, `service_professionals`, `business_hours`, `service_categories`, `business_visual_settings`, `support_messages`, `reminder_logs`, `client_error_log` e `outreach_templates` com grants e uso no código.
- A policy de `service_professionals` exige que os dois IDs referenciados pertençam ao business da linha; grants de escrita do chat foram restringidos a `read_by_user`. Não apareceu novo achado confirmado nesta amostra.
- Leitura anon de catálogo e membership ampla de dados pessoais estão documentadas como SEC-009/012 e decisão de escopo; comportamento remoto segue inconclusivo. Matriz detalhada atualizada em `banco-de-dados.md`.
- Sem consulta de dados, teste, deploy ou mensagem externa. 76 IDs permanecem no inventário; próxima cobertura inclui claims/permissões de armazenamento e autorização cross-tenant nas Server Functions.

### Ciclo 36 — RPCs privilegiadas e busca limitada por credenciais

- Varredura de funções `SECURITY DEFINER`: todas as definições encontradas fixam `search_path`; funções privilegiadas listadas têm execução limitada, e `replace_professional_services` é invoker com validação de pertença. A RPC `has_role(user_id, role)` aceita UUID arbitrário para retornar boolean a authenticated; deixar como pergunta de superfície enquanto não houver evidência de IDs de terceiros acessíveis ou bypass de autorização.
- Busca limitada de padrões comuns de credenciais em `src/`, `ops/` e `supabase/` retornou zero arquivos, sem imprimir valores. Não cobriu histórico Git, `.env`, variáveis de deploy, artifacts/build ou formatos desconhecidos; checagem completa segue pendente.
- SEC-014 registra risco condicional de enumeração anon do catálogo inteiro: a policy é global, embora páginas chamem a função server-side por slug. Intenção de diretório público e estado dos tenants remotos precisam ser confirmados.

### Ciclo 37 — escopo das policies públicas de catálogo

- Comparadas policies anon de businesses, professionals, services, service-professionals, business_hours e service_categories com o carregamento público por slug. Migration estreitou colunas de businesses/professionals, mas não o filtro de linhas.
- SEC-014 é P3 potencial enquanto não se souber se o produto pretende diretório global; endpoints observados carregam por slug via service role. Não foi usado anon key, nem linha de produção consultada.
- Nenhuma alteração externa ou teste foi executado. Inventário atualizado para 77 IDs únicos.

### Ciclo 38 — INSERT autenticado em appointments

- Revisada a policy `appointments_professional_create` junto do grant de INSERT, schema e fluxo `reserveBooking`. Role authenticated mantém INSERT e policy só verifica `has_business_permission` para business_id.
- BOOK-008 (P2 potencial) registra bypass de validações de catálogo/horário/sinal por API direta; status, referências e `deposit_paid_at` são graváveis sem condições equivalentes na policy. Nenhum insert foi executado; migration remota continua desconhecida.
- O checkbox `create_appointment` existe na configuração de profissional, mas nenhum fluxo de criação manual aparece no `src` ou nas specs consultadas; confirmar se é função futura/descontinuada antes de declarar UI incompleta.
- Inventário passa a 78 IDs únicos. Reproduzir somente em Supabase local descartável, nunca no projeto de produção.

### Ciclo 39 — censo de tabelas internas e financeiras

- Acrescentada matriz das tabelas service-role-only, credentials/inbox, workers, withdrawals/subscription charges, Master records, Pix approvals, SDR e broadcasts. Credenciais, payloads, linhas financeiras e tabelas remotas não foram lidas.
- Chain local revoga acesso de cliente nas tabelas internas principais e concede SELECT Master via role; `broadcasts` tem policy de leitura autenticada mas grant efetivo não está declarado nessa migration e fica inconclusivo.
- Sem novo achado confirmado nesta amostra; BOOK-008 segue como caminho estático por policy de appointments. Inventário permanece 78 IDs.

### Ciclo 40 — DELETE autenticado da própria linha business

- Confirmados grant CRUD inicial, policy `businesses_own FOR ALL` e hardening que revoga somente UPDATE. Nenhuma revogação de DELETE foi localizada. A função de exclusão existente é Master; a spec 002 exige Master + AAL2.
- A FK do ledger usa `ON DELETE RESTRICT`, mas outras tabelas filhas usam CASCADE; business sem ledger pode perder agendamentos, clientes e histórico se o DELETE direto passar. SEC-015 P2 potencial, remoto e intenção de autoexclusão inconclusivos.
- Nenhuma tentativa de DELETE, consulta de produção ou alteração de dados. Inventário passa a 79 IDs únicos.

### Ciclo 41 — INSERT autenticado em businesses e campos de controle

- A mesma policy/grant que preservam DELETE também preservam INSERT por owner: `businesses_own FOR ALL` e GRANT CRUD do template inicial. O hardening limita UPDATE e seu trigger é `BEFORE UPDATE`; nenhum controle equivalente em INSERT foi encontrado.
- SEC-016 (P1 potencial) registra que owner poderia inserir tenant próprio com preço/status/vencimento arbitrários e contornar o provisionamento Master/SDR. `BusinessProvider` lista negócios próprios; a extensão efetiva do acesso criado depende de validações adicionais não confirmadas.
- Nenhuma linha foi inserida e nenhum valor real consultado. Migrations remotas desconhecidas. Inventário passa a 80 IDs.
- Na triagem de DML direto, também ficou confirmado que `professionals` concede INSERT ao owner sob policy `FOR ALL`; o limite de 10 existe só no handler e falha aberta. PRO-001 atualizado para incluir bypass REST, sem escrita realizada.

## Próximos passos da auditoria

1. Prioridade máxima: confirmar SEC-016, SEC-015, BOOK-008, PRO-001 e SEC-009 em Supabase local descartável com owners/profissionais fictícios; não testar em produção.
2. Completar revisão dos handlers restantes que usam `supabaseAdmin`, sobretudo validação de business/tenant, retornos de erro e mutações de Auth/assinatura.
3. Continuar a matriz de jornadas frontend por página/ação; não usar Playwright com sessão real nem disparar uploads/provedores antes de isolar o ambiente.
4. Reconciliar migrations/RLS/configuração do Supabase remoto e split AgPay somente se houver acesso estritamente read-only ao projeto correto.
5. Revisar e consolidar severidades/evidências, incluindo resumo financeiro, security, QA e decisões de produto abertas; não encerrar enquanto cobertura estiver parcial.

**Estado atual:** auditoria em andamento; 80 IDs no índice consolidado. Código e dados não foram alterados; testes nesta rodada não executados; as evidências remotas e a maioria dos cenários de browser permanecem limitadas.

### Ciclo 42 — onboarding de negócio pelo SDR e ambiente de reprodução

- Revisado `sdrCreateBusiness`: cria identidade Auth, ignora o resultado de `user_roles.upsert` e só então insere `businesses`; falha posterior deixa estado parcial sem compensação. Registrado como ADM-003 (P2 confirmado estaticamente, incidência desconhecida).
- O token SDR é HMAC-SHA256 com TTL de sete dias e `requireSdr` reconsulta status ativo; nenhum problema novo foi registrado nesse trecho.
- Docker CLI existe, mas o daemon Docker Desktop não está disponível (pipe `dockerDesktopLinuxEngine` ausente); a CLI Supabase não foi localizada. Nenhuma reprodução ou teste foi executado.
- Inventário: 81 IDs únicos após ADM-003. Estado Git preservado, com `CLAUDE.md` removido e os arquivos locais não rastreados já registrados no ciclo 1; nenhum arquivo de código ou dado foi alterado nesta rodada.
- Próxima cobertura: continuar revisão dos handlers administrativos restantes, da matriz de jornadas frontend e das lacunas de produção; manter reproduções bloqueadas até existir ambiente local descartável.

**Estado atual:** auditoria em andamento; 81 IDs no índice consolidado. Código e dados não foram alterados; ciclo estático de onboarding concluído; testes locais e evidências remotas permanecem indisponíveis.

### Ciclo 43 — revogação de sessões SDR

- Revisados `sdrLogin`, `updateSdr`, token HMAC e `requireSdr`: token de até sete dias não tem vínculo com versão do PIN; troca de credencial não invalida sessões existentes, enquanto `active=false` é checado a cada requisição. Registrado como SEC-017 (P2 potencial; retenção pós-reset confirmada estaticamente).
- Inventário: 82 IDs únicos. Nenhum teste foi executado; o daemon Docker segue indisponível. Código e dados permanecem sem alterações.
- Próxima cobertura: percorrer outros fluxos de sessão/credencial e completar a revisão de páginas e integrações. As lacunas de produção e reproduções seguem explícitas.

**Estado atual:** auditoria em andamento; 82 IDs no índice consolidado; nenhuma validação dinâmica ou remota nova nesta rodada.

### Ciclo 44 — armazenamento e logout do painel SDR

- Conferidos o salvamento do token em `localStorage` e os dois botões “Sair”: ambos removem apenas o valor local e não existe endpoint de revogação individual. Complementa SEC-017; não criou novo ID.
- Impacto de exposição via XSS fica condicionado à existência de uma vulnerabilidade XSS; nenhuma foi identificada nesta passagem e não foi feito teste de navegador.
- Inventário permanece em 82 IDs. Nenhuma alteração de código/dados, teste ou chamada externa.

**Estado atual:** auditoria em andamento; revisão de sessão SDR cobre emissão, validação, troca de PIN, armazenamento e logout em análise estática; restante da cobertura permanece parcial.

### Ciclo 45 — confiança nos cabeçalhos de IP do rate limit

- Cruzado `clientIp()` com o Caddyfile. A função prefere `CF-Connecting-IP`/`X-Real-IP`, que o Caddy configurado não sobrescreve por padrão; a documentação oficial confirma o pass-through de cabeçalhos que não sejam `X-Forwarded-*`. Registrado como SEC-018 (P2 potencial), condicionado ao deploy desse proxy e ao bloqueio de acesso direto ao upstream.
- Impacto abrange cotas públicas por IP; `sdrLogin` também tem limite por e-mail, que não é removido por este vetor.
- Nenhum request de produção ou teste foi executado. Inventário: 83 IDs. Código e dados sem alterações.

**Estado atual:** auditoria em andamento; revisão estática do rate limit concluída para proxy local; topologia de produção e controles de rede seguem pendentes.

### Ciclo 46 — falhas de persistência no retorno da impersonação

- Revisado handler Master-to-owner e retorno: update do contador de PIN incorreto e delete do token de uso único não verificam erros do Supabase. Os testes existentes cobrem caminho normal sem injeção de erro. Registrado SEC-019 (P2 potencial; pré-condições dependem de falha/race).
- Inventário: 84 IDs únicos. Nenhuma execução de teste ou escrita operacional; observação foi somente estática.

**Estado atual:** auditoria em andamento; caminho de impersonação coberto estaticamente, incluindo sua resposta a falhas ainda pendente de reprodução isolada.

### Ciclo 47 — middleware global de autenticação e CSRF

- Confirmado no código que `src/start.ts` registra `createCsrfMiddleware` para server functions e o middleware cliente anexa Bearer Supabase somente quando encontra sessão persistida; `requireSupabaseAuth` exige formato Bearer e valida claims com `getClaims`.
- Não foi inferida segurança de configuração remota a partir disso: comportamento efetivo depende do build/runtime e da configuração de Auth. Não houve teste HTTP/browser.
- Nenhum achado novo nesta passagem. Inventário permanece em 84 IDs; nenhuma escrita em código/dados ou chamada externa.

**Estado atual:** auditoria em andamento; middleware de auth/CSRF mapeado estaticamente; QA de browser e revisão dos fluxos visuais continuam pendentes.

### Ciclo 48 — validação de timezone na gravação e reserva

- Conferida a validação de `preferences.timezone`: servidor aceita qualquer string de 1–80 chars, enquanto a UI limita a quatro opções; chamadas de disponibilidade/reserva passam o valor a `Intl.DateTimeFormat`, cujo erro de timezone inválido não é convertido em erro de configuração.
- Registrado BOOK-009 (P2 potencial, configuracional e mesmo-tenant). Não há evidência de que valor inválido exista em produção nem de uso do caminho via API.
- Inventário: 85 IDs. Nenhum teste foi executado e nenhuma configuração real foi lida/escrita.

**Estado atual:** auditoria em andamento; fluxo de fuso coberto estaticamente até o ponto API→persistência→disponibilidade. Cenários dinâmicos, configuração remota e jornadas visuais seguem pendentes.

### Ciclo 49 — replay de migrations e catálogo de RLS isolado

- `npm run db:ensaio:check`: exit code 0, 71 migrations aplicadas em Postgres 17 embutido em banco temporário. `.data` não existia antes e foi removido ao encerrar; porta 54330 ficou livre. Nenhum negócio foi inserido ou consultado.
- Consulta read-only do catálogo no segundo replay confirmou grants/policies finais relevantes em `businesses`, `appointments`, `professionals`, `time_blocks` e `subscription_payments`; detalhes e limites estão em [banco-de-dados.md](banco-de-dados.md). Isso reforça a chain local para SEC-010/011/012/015/016, PAY-030, BOOK-008 e PRO-001, sem confirmar produção ou exercer acesso autenticado.
- O helper exportado `startEnsaio()` não retorna a propriedade `query` prometida por seu comentário JSDoc; a CLI de ensaio segue funcional. Nota DB-003 P4 de manutenção no relatório de banco.
- Inventário consolidado: 86 IDs únicos após DB-003.
- Nenhuma modificação de código/dados. As únicas escritas foram relatórios da auditoria.

**Estado atual:** auditoria em andamento; chain local reexecutável e permissões catalogadas em ambiente efêmero; RLS remota, testes de acesso por usuário, QA visual e cobertura global continuam pendentes.

### Ciclo 50 — DML de owner em chain isolada

- Em Postgres efêmero com migrations completas, criou-se usuário Auth fictício; com `SET LOCAL ROLE authenticated` e claim própria, reproduziu-se INSERT direto em `businesses` com status/preço/vencimento escolhidos, INSERT de `appointments` com status fora do domínio e marcador de sinal sintético, e DELETE do business com appointment filho. As três operações passaram pela policy local.
- Toda a sequência ocorreu em uma transação revertida; o database temporário foi encerrado/removido. Nenhum valor ou usuário de produção foi consultado ou alterado.
- Evidência dinâmica fortalece SEC-016, BOOK-008 e SEC-015 para a chain local. Não confirma policies remotas nem reproduz o caminho de profissional separado ou a restrição de DELETE por ledger; detalhes foram atualizados nos relatórios correspondentes.
- Inventário permanece em 86 IDs; todos os outros arquivos/código/dados seguem preservados.

**Estado atual:** auditoria em andamento; três caminhos de DML direto reproduzidos com fixtures isoladas e rollback; RLS remota e demais cenários permanecem pendentes.

### Ciclo 51 — leitura de PII por profissional e de bloqueio por anon

- No ensaio efêmero, profissional fictício com `view_customer_phone=false` consultou e recebeu phone/email/notes de `customers` e `customer_phone` de `appointments`. Usuário `anon` consultou motivo sentinela de `time_blocks`. Tudo ocorreu sob roles PostgreSQL correspondentes, com fixture fake e transação revertida; banco temporário removido.
- Evidência dinâmica local fortalece SEC-009 e SEC-012. A consulta anon testou um business sentinela apenas; escopo entre tenants decorre da policy `USING (true)`, mas não foi enumerado em múltiplos businesses. Não houve consulta ao projeto remoto.
- Inventário permanece em 86 IDs. Nenhum arquivo de código ou dado foi alterado.

**Estado atual:** auditoria em andamento; cinco cenários de autorização/entrada direta foram validados no banco isolado; RLS remota, jornadas visuais e demais módulos seguem pendentes.

### Ciclo 52 — leitura e DML do histórico de assinatura

- Replay isolado: profissional ativo fictício recebeu amount/status/reference_month de `subscription_payments`; owner alterou amount e apagou a mesma linha sintética via role `authenticated`. Fixture e negócio eram fictícios, toda a transação sofreu rollback e o banco foi removido.
- Evidência local fortalece SEC-011 e PAY-030. Não foi medido impacto em KPIs nem consultado o Supabase remoto; classificação em produção permanece potencial.
- Inventário permanece em 86 IDs; nenhuma escrita em código ou dados duráveis.

**Estado atual:** auditoria em andamento; seis cenários de autorização/entrada direta foram exercitados no banco efêmero e revertidos; não prova migrations remotas.

### Ciclo 53 — path da foto profissional entre write e catálogo público

- Revisado uploader da UI, `saveProfessional`, policy de fotos e `getProfessionals`: a UI monta prefixo próprio, mas handler aceita path livre; endpoint público usa service-role para gerar signed URL sem validar prefixo/tenant. Registrado SEC-020 (P2 potencial; depende de objeto/path existente/conhecido).
- Relaciona-se a SEC-013 (`staging` e leitura Storage autenticada ampla), mas o vetor de emissão do signed URL público é separado. Não foi assinado URL nem lido objeto.
- Inventário: 87 IDs únicos. Nenhum arquivo de código/dado modificado.

**Estado atual:** auditoria em andamento; revisão de gestão de profissionais identificou risco adicional de path de asset; validação isolada do handler permanece pendente.

### Ciclo 54 — par início/fim do funcionamento

- Inspecionados os dois inputs, o upsert direto, as constraints da tabela e `computeSlots`: UI e schema permitem `ends_at <= starts_at`; o algoritmo não cria slots nesse caso. Registrado UI-007 (P2 potencial; erro depende de configuração owner).
- Nenhum horário foi salvo ou teste executado; reprodução segura está especificada com fixture/cálculo puro.
- Inventário: 88 IDs únicos. Código e dados não alterados.

**Estado atual:** auditoria em andamento; jornada de horários fixos revisada estaticamente. QA visual, validação runtime e demais rotas permanecem pendentes.

### Ciclo 55 — salvamento do catálogo e vínculos de equipe

- Revisada a mutation da página de serviços: `saveService` persiste o serviço; a tela remove e insere vínculos em requests subsequentes, sem compensação. Existe RPC `replace_professional_services` atômica já usada pelo fluxo de profissionais, mas não por esta tela. Registrado API-006 (P2 potencial; erro parcial não injetado).
- O escopo visual de serviços permanece parcial; páginas de categorias, edição, upload de imagem, empty/loading/error e dispositivos não foram exercitados em browser.
- Inventário: 89 IDs únicos. Nenhuma escrita de produto ou dado; alteração apenas em documentação de auditoria.

**Estado atual:** auditoria em andamento; funcionamento e gravação de serviços estão parcialmente revisados estaticamente; QA visual e injeção segura de falhas continuam pendentes.

### Ciclo 56 — erro de categorias e mutações parciais no catálogo

- A query de categorias captura qualquer exceção e entrega array vazio; componente não distingue erro de resultado vazio. Registrado UI-008 (P3 potencial; sem observação de runtime).
- A edição/criação de categorias grava a linha de categoria e atualiza `services.category_id` em requests posteriores; incluído como caminho adicional de estado parcial no API-006. Nenhuma falha foi injetada.
- Specs encontradas não detalham o CRUD de categorias do catálogo; requisito esperado permanece parcialmente produto/escopo.
- Inventário: 90 IDs únicos. Apenas documentação de auditoria foi alterada; código e dados continuam intactos.

**Estado atual:** auditoria em andamento; telas de serviços/categorias tiveram revisão estática parcial. Browser QA, testes mockados de falha, restantes páginas e verificações remotas seguem pendentes.

### Ciclo 57 — publicação de mídia no editor de aparência

- Revisado o fluxo de save do editor conforme a spec 008: o novo arquivo é enviado e o asset anterior pode ser removido antes da persistência do novo path; a gravação de aparência e atualização de fundo ocorre em requests paralelos. Registrado UI-009 (P2 potencial, condicionado à falha e à policy de remoção).
- Não houve escrita em Storage ou banco; falhas não foram injetadas. A conformidade com a regra de preservar rascunho e o estado publicado precisa de teste com mocks isolados.
- Inventário: 91 IDs únicos. Somente documentação de auditoria foi atualizada.

**Estado atual:** auditoria em andamento; Appearance/Template recebeu inspeção estática parcial. Jornadas visuais, falhas parciais mockadas, acessibilidade e demais rotas seguem pendentes.

### Ciclo 58 — dependência de perfil no editor de aparência

- Revisado loading/error e dirty state das queries de configuração e perfil. O editor depende de `profile.data` para reconhecer alteração de cor e não apresenta erro/loading da query de perfil; chegada tardia pode restaurar estado recebido sobre edição local. Registrado UI-010 (P2 potencial; sem mock runtime).
- Nenhum save, upload ou dado de perfil foi alterado. A spec 008 define preservação do rascunho em falha; conformidade requer validação mocked e QA mobile/desktop.
- Inventário: 92 IDs únicos; apenas documentação foi modificada.

**Estado atual:** auditoria em andamento; editor de aparência permanece apenas parcialmente coberto; serviços, outros painéis e integrações aguardam ciclos.

### Ciclo 59 — lembretes e alertas do painel

- Revisada a tela de configuração de mensagens, handler de save, cron `whatsapp-reminders`, tabela/índice e timer systemd versionados. INT-005 foi corroborado: log `erro` entra no conjunto `alreadySent`; INT-006 também cobre erros ignorados nas consultas de appointments/logs e ausência de claim atômico.
- O timer está configurado como oneshot horário, persistente e com atraso aleatório; a rota usa segredo de cron e as configurações filtram negócios ativos com `reminder_enabled`. Configuração do host remoto não foi verificada.
- Nenhum endpoint cron foi chamado, mensagem enviada ou configuração alterada. Não foram criados IDs novos; o inventário permanece em 92.

**Estado atual:** auditoria em andamento; configuração e código de lembretes tiveram revisão estática aprofundada. Alertas in-app e demais páginas Master não foram validados controle a controle; ambiente externo e entrega real permanecem desconhecidos.

### Ciclo 60 — teste hermético de renderização das notificações WhatsApp

- Executei `npm test -- src/lib/whatsapp-notify.server.test.ts`: 1 arquivo e 12 testes passaram. O arquivo mocka provider e Supabase; as mensagens foram apenas verificadas por chamadas mockadas, sem contato real.
- A suíte valida formatação, timezone, sessão conectada/desconectada e antecedência; não cobre a rota cron, persistência de `reminder_logs`, retentativas nem concorrência. Portanto não invalida INT-005/006.
- Nenhum código ou dado alterado; inventário permanece em 92 IDs.

**Estado atual:** auditoria em andamento; teste de mensagens executado em isolamento. Cron e política de retry ainda precisam de teste específico com doubles de DB/provider; superfícies visuais, produção e demais módulos continuam pendentes.

### Ciclo 61 — estados da consulta de notificações Master

- A query de broadcasts descarta `isLoading`/`isError` no componente e usa `data ?? []` para decidir empty state. Registrado UI-011 (P3 potencial); erro de leitura pode parecer ausência de avisos.
- A ação Master cria anúncio para a caixa in-app do painel; os campos de público/prazo/cor/ícone são enviados ao handler e a autorização server-side usa `assertSuperAdmin`. O sino do painel também mascara erro da mesma query, omitindo badge/popup. Não foi enviada comunicação externa.
- Inventário: 93 IDs únicos. Nenhuma fonte/dado/código de produto foi alterado.

**Estado atual:** auditoria em andamento; tela de alertas foi parcialmente revisada. Fluxo de broadcast até caixa do negócio, permissions em runtime e acessibilidade continuam pendentes.

### Ciclo 62 — comparação inicial entre Preferências e Lembretes

- A leitura de chamadas de persistência sugeriu dois editores para `reminder_hours_before`, mas não houve checagem do JSX antes de formular a hipótese. Esta hipótese foi corrigida no ciclo 63 e não permanece como achado.
- Nenhum valor foi salvo nem lido de produção. Inventário deste estado corrigido: 93 IDs únicos.

**Estado atual:** auditoria em andamento; Preferências e Lembretes tiveram comparação parcial código/spec. Jornada integrada com UI e cron ainda precisa QA isolado; demais rotas seguem pendentes.

### Ciclo 63 — verificação do controle visual de antecedência

- Revisado o bloco JSX “Avisar Clientes”: o campo visível é `extra_reminder_minutes` (lembrete extra) e seu template. A antecedência principal `reminder_hours_before` é editável em `/painel/lembretes`; Preferências a carrega/persiste mas não a apresenta como segundo input. UI-012 removido de achados, riscos e índice; não há evidência de duplicação visual do mesmo controle.
- A distinção entre lembrete principal (horas) e lembrete extra (minutos) foi registrada na matriz de spec. O save amplo de Preferências preserva também o valor principal; risco de valor inicial sobrescrever campo ainda requer validação mocked antes de conclusão.
- Inventário: 93 IDs únicos. Apenas documentos de auditoria foram alterados.

**Estado atual:** auditoria em andamento; comparação corrigida e sem achado de duplicação. Rota de lembretes/configurações segue parcialmente coberta; QA integrado e restantes rotas continuam pendentes.

### Ciclo 64 — estados vazios da agenda de recebíveis Master

- Cruzada a UI com `getReceivablesCalendar`: servidor lança erro quando as consultas críticas falham, mas o componente usa valores opcionais como 0 e não expõe `isLoading/isError`. Registrado UI-013 (P2 potencial, impacto operacional não medido).
- Nenhuma consulta de produção, cobrança ou operação financeira foi executada. A revisão da tela continua parcial; mistura de timezone em métricas de recebimento foi observada como questão a verificar sem classificar antes de definir timezone esperado do painel.
- Inventário: 94 IDs únicos. Apenas documentação de auditoria alterada.

**Estado atual:** auditoria em andamento; tela Master de recebíveis teve inspeção estática inicial; ambiente externo e outras páginas financeiras seguem pendentes.

### Ciclo 65 — integridade das fontes no relatório do estabelecimento

- Revisada a query paralela de appointments/services/professionals e o cálculo de métricas. Apenas erro de appointments é propagado; sem serviços, revenue cai para zero; sem profissionais, ranking fica ausente. Registrado UI-014 (P2 potencial; mocks de erro pendentes).
- Nenhuma consulta financeira real foi realizada. O teste estático confirma dependência do catálogo para cálculo de receita de serviços concluídos.
- Inventário: 95 IDs únicos. Apenas documentação de auditoria alterada.

**Estado atual:** auditoria em andamento; recebíveis e relatório tiveram triagem inicial, carteira/saldo do estabelecimento e outras páginas Master aguardam revisão mais profunda.

### Ciclo 66 — preço histórico usado no relatório

- Seguido o caminho da métrica “Faturamento” da rota ao cálculo e schema: cada atendimento concluído usa preço atual por `service_id`; o modelo de appointment não guarda snapshot do preço total. Registrado UI-015 como suspeita P2, condicionada à definição do KPI.
- Sem alteração de catálogo ou fixture persistida. A spec 001 exige manter a métrica, mas não define se usa preço da data, preço atual ou valor efetivamente recebido.
- Inventário: 96 IDs únicos. Apenas documentação de auditoria atualizada.

**Estado atual:** auditoria em andamento; relatório tem três questões (falhas de fonte, fallback vazio/zero e preço histórico) em revisão estática; confirmação de semântica e QA seguro pendentes.

### Ciclo 67 — teste hermético da métrica de faturamento

- Executei `npm test -- src/lib/report-metrics.test.ts`: 1 arquivo e 1 teste passou. A fixture fornece preço fixo; confirma o cálculo esperado para esse input, mas não testa alteração de preço após reserva nem persistência de snapshot, então UI-015 permanece como risco de modelo/semântica.
- Nenhuma consulta, alteração de catálogo ou dado real ocorreu. Inventário permanece em 96 IDs.

**Estado atual:** auditoria em andamento; unidade de cálculo validada apenas para fixture estática; erro de fontes e comportamento histórico precisam testes mocked adicionais ou definição de produto.

### Ciclo 68 — edição do perfil público do estabelecimento

- Conferidos os cinco campos requeridos por FR-029a (nome, slug, categoria, telefone e endereço), a chamada da tela e o guard de ownership na Server Function. Estado estático compatível com requisito; efeito no painel público ainda não validado em E2E.
- Nenhum estabelecimento foi atualizado. Sem novo achado confirmado; inventário permanece em 96 IDs.

**Estado atual:** auditoria em andamento; cadastro do negócio inspecionado estaticamente, atualização real/isolada e reflexo de cache permanecem pendentes.

### Ciclo 69 — referência cross-tenant de categoria e ação referencial

- Reproduzida SEC-021 na chain completa (71 migrations) em Postgres embedded descartável. Owner A autenticado vinculou seu serviço à categoria B; owner B deletou a própria categoria e a FK `ON DELETE SET NULL` modificou a linha A. Update, delete e fixtures foram revertidos em uma transação; diretório `.data` removido e porta liberada.
- O caso comprova comportamento local das migrations, não do Supabase remoto. Classificado P3 porque o efeito observado recai em service que já tinha vínculo cross-tenant, sem demonstrar leitura privada ou alteração de linha sem esse vínculo. Nenhuma linha de negócio ou asset persistiu. Somente documentos de auditoria foram escritos.
- Inventário: 97 IDs únicos.

**Estado atual:** auditoria em andamento; categoria de catálogo agora tem reprodução RLS/constraint; restante da matriz de isolamento entre tenants, migrations remotas e outras rotas seguem pendentes.

### Ciclo 70 — suíte hermética padrão

- `LEDGER_DB_TESTS` estava ausente. Executei `npm test` sem carregar env do `.env`: 80 arquivos passaram, 3 arquivos foram pulados; 803 testes passaram e 8 foram pulados (18,73s). Exit code 0.
- A suíte cobre lógica com mocks e não substitui verificação de RLS/configuração remota, testes de browser, integração AgPay/UAZAPI ou testes explicitamente opt-in de banco. Nenhum teste de pagamento real foi executado.
- Nenhum código ou dado de produto foi alterado. Inventário permanece em 97 IDs.

**Estado atual:** auditoria em andamento; validação padrão local passou, mas não certifica produção nem fecha a cobertura de todas as rotas/módulos.

### Ciclo 71 — falha de carga de profissionais na tela de bloqueios

- Revisado fallback de `professionalsQuery`: erro se converte em array vazio, oculta seleção, e o formulário envia `professionalId=null`, aceito pelo handler como bloqueio global. Registrado UI-016 (P2 potencial, sem erro injetado).
- A restrição de owner em `createTimeBlock` (API-004) significa que o impacto observado está no fluxo do proprietário; criação de profissional autorizada ainda não funciona pelo handler.
- Inventário: 98 IDs únicos. Sem gravação de bloqueio, nenhum dado alterado; apenas documentação de auditoria.

**Estado atual:** auditoria em andamento; bloqueios têm cobertura parcial; falha visual foi inferida do caminho de dados, sem execução em browser.

### Ciclo 72 — central de suporte Master

- Revisadas queries de lista/thread e mutation de resposta. Falhas de leitura terminam em fallback de conversa vazia (UI-017); rejeição de resposta ocorre após o rascunho ser apagado (UI-018). Ambos são achados estáticos, ainda sem erro injetado ou browser.
- Nenhuma conversa foi consultada em produção e nenhuma mensagem foi enviada. Inventário: 100 IDs únicos.

**Estado atual:** auditoria em andamento; central de suporte estática parcialmente inspecionada. Testes mocked, jornada autenticada isolada, permissões/runtime e efeitos de resposta permanecem pendentes.

### Ciclo 73 — fallback de compatibilidade dos broadcasts

- Comparado o fallback de inserção com normalização de público e migrations: quando uma coluna nova falta, a função grava apenas título/mensagem, retorna sucesso e leitura interpreta audiência ausente como “todos”. Registrado API-007 como P2 potencial condicionado a schema legado.
- A chain local inclui migration posterior que adiciona as colunas; schema remoto não foi consultado. Nenhum aviso foi criado/enviado. Inventário: 101 IDs únicos.

**Estado atual:** auditoria em andamento; risco de expansão de audiência está demonstrado no caminho do código, mas deploy com schema antigo e ocorrência real permanecem inconclusivos.

### Ciclo 74 — estado de erro na criação de profissionais

- Revisado o gate de cadastro: query ausente vira lista vazia; erro fica visível, mas botão continua habilitado e texto anuncia primeiro profissional grátis. Registrado UI-019, relacionado à validação fail-open já registrada em PRO-001.
- Nenhum cadastro foi iniciado/salvo e preço não foi consultado no sistema real. Inventário: 102 IDs únicos.

**Estado atual:** auditoria em andamento; controle comercial e de contagem na criação de equipe permanece pendente de definição e validação em ambiente isolado.

### Ciclo 75 — cobertura de dias individuais da equipe

- Comparada a interface de dias de trabalho, schema/validador e specs: backend aceita domingo (0), interface oferece segunda a sábado, e requisitos localizados não definem se o profissional pode trabalhar domingo. Registrada como lacuna de escopo na matriz, sem novo achado.
- Nenhum horário ou agenda foi alterado. Inventário permanece em 102 IDs únicos.

**Estado atual:** auditoria em andamento; regra de dias individuais depende de confirmação de produto; outras jornadas da equipe e QA browser permanecem pendentes.

### Ciclo 76 — tratamento da exclusão no catálogo de serviços

- Revisados os resultados de loading/error e mutations do catálogo: query principal apresenta erro, vínculos são verificados ao editar e DELETE de serviço não possui feedback no erro; registrado UI-020 como P3 potencial.
- Nenhum serviço foi apagado. Inventário: 103 IDs únicos.

**Estado atual:** auditoria em andamento; tela de serviços coberta estaticamente quanto a listagem, gravação de vínculos e exclusão, ainda sem execução de componente/browser.

### Ciclo 77 — separação de categorias e vínculos de catálogo

- Rechecado `ServiceCategories`: erro de leitura geral de categoria continua coberto por UI-008; mutation de criar/editar/excluir apresenta toast no erro; gravação parcial dos vínculos de categoria permanece agrupada em API-006. Sem novo achado independente neste ciclo.
- A nota de Sunday workdays permanece classificada como questão aberta de escopo. Nenhuma categoria ou vínculo foi alterado. Inventário permanece em 103 IDs únicos.

**Estado atual:** auditoria em andamento; leitura estática do CRUD de categorias revisada, mas sem mock de falha tardia, browser ou schema remoto.

### Ciclo 78 — carregamento, exportação e exclusão de clientes

- Revisada query de clientes/visitas, CSV e exclusão: primeira carga sem cache pode renderizar empty state (UI-021); DELETE também fecha confirmação sem feedback de erro, extensão do UI-020. Exportação já coberta por SEC-009 mascara telefone, mas inclui e-mail/notas sem gate; expectativa para esses campos não está definida e ficou como questão aberta, sem novo achado.
- Nenhuma lista real foi exportada nem cliente removido. Inventário: 104 IDs únicos.

**Estado atual:** auditoria em andamento; tela de clientes tem revisão estática adicional, mas UX visual, autorização para campos exportados e teste de estados pendentes permanecem abertos.

### Ciclo 79 — preferências e formulário de lembretes

- Revisados query, estados de carregamento/erro, validação dos placeholders, mutation de save e fallback da coluna `saudacao_template`. A rota mostra estados explícitos de loading/erro e avisa quando a saudação não foi persistida por migration ausente; não surgiu novo achado neste recorte.
- Nenhum texto foi salvo e nenhum job/provedor acionado. Cobertura permanece estática, sem jornada browser ou combinação com o scheduler. Inventário: 104 IDs únicos.

**Estado atual:** auditoria em andamento; UI e persistência de lembretes estão parcialmente cobertas, integração de ponta a ponta, cron e entregabilidade remota continuam pendentes.

### Ciclo 80 — inventário das especificações locais

- Enumeradas 12 pastas de spec sem ler conteúdo de arquivos de backup local. Há dois prefixos `001-` e dois `002-`; `009-modelo-vitrine-substitui-liquid-glass` contém apenas `spec.md`, enquanto os demais têm níveis variados de plan/tasks/QA. Registrada matriz de pacotes e status parcial/pendente em `conformidade-spec.md`.
- Specs estão ignoradas pelo Git (`.git/info/exclude`) e foram mantidas intactas. Inventário de problemas permanece em 104 IDs únicos.

**Estado atual:** auditoria em andamento; inventário de specs concluído, comparação requisito a requisito dos pacotes ainda pendente.

### Ciclo 81 — precedência das specs de layout

- Conferida spec 009 (rascunho) contra história 9 da spec 010 (Elegance substitui modelos anteriores) e com a UI/storage. `PANEL_LAYOUT_MODELS` contém apenas Elegance; o runtime força esse layout e o preview também usa Elegance. Corrigida hipótese: não existe cartão Clássico; UI-022 é apenas copy residual “alterne quando quiser”, reclassificado P4.
- Nenhum modelo/configuração de negócio foi salvo. Inventário: 105 IDs únicos. Status de 009 atualizado para “superada no requisito de layout” na matriz.

**Estado atual:** auditoria em andamento; precedência de layout estática esclarecida. QA visual do editor e rodada requisito a requisito da spec 010 permanecem pendentes.

### Ciclo 82 — estado literal das checklists de tasks

- Contadas caixas `[X]` e `[ ]` nos dez arquivos `tasks.md` presentes. Vários pacotes têm checklists com pendências; em 002 e 007 o parser não encontrou caixas padrão, e 009 não tem `tasks.md`. Números e ressalvas foram registrados em `conformidade-spec.md`.
- A marcação pendente foi tratada apenas como fonte para selecionar validações, não como prova de funcionalidade ausente. Nenhum arquivo de spec foi modificado. Inventário de achados permanece em 105 IDs únicos.

**Estado atual:** auditoria em andamento; reconciliação dos requisitos/tarefas com código e evidência de aceite continua incompleta, especialmente nas specs 005–008 e validação externa da 010.

### Ciclo 83 — dias públicos e pós-reserva com Pix

- Inspecionados `getOpenDays`, as queries de profissionais/histórico e `reserveBooking` UI: erro de expediente vira calendário vazio (BOOK-010); estado de profissional ausente cai no caminho opcional da UI, ligado à validação já registrada BOOK-007; histórico reduz erro a lista vazia em BOOK-006.
- A persistência de chargeId em `localStorage` não captura exceção após o backend retornar cobrança; registrado UI-023. Não foi feita reserva, pagamento ou chamada ao provider.
- Inventário: 107 IDs únicos.

**Estado atual:** auditoria em andamento; tratamento estático da jornada pública ganhou cobertura adicional, mas loading/error mocks, recuperação após falha do browser e E2E isolado permanecem pendentes.

### Ciclo 84 — configuração Master de taxas de referência

- Confirmado que `painel.carteira-config` edita `platform_settings.agpay_fees` para simulações, não taxa financeira do ledger. Se `getAgpayFees` falhar, alerta aparece, mas valores padrão continuam salváveis; registrado UI-024 P3 potencial, impacto operacional não encontrado.
- Nenhuma configuração foi salva. Inventário: 108 IDs únicos.

**Estado atual:** auditoria em andamento; página Master de taxas de referência revisada estaticamente. Estado do setting servido e sua relevância administrativa permanecem desconhecidos.

### Ciclo 85 — double submit no fluxo de saque do proprietário

- Revisado fluxo `confirmSaque` → verificação de PIN → `requestWithdrawal`: o estado de PIN não bloqueia por `confirmSaque.isPending`; a trava local nunca vai a true e cada mutation gera novo UUID. Registrado UI-025 P2 potencial, conectado ao limite de saldo do ledger e à ausência de PIN server-side em PAY-009.
- Nenhuma verificação de PIN ou solicitação de saque foi realizada. Inventário: 109 IDs únicos.

**Estado atual:** auditoria em andamento; UI de saque revisada estaticamente para controle de submissão; concorrência mockada e reconciliação de timeout pendentes.

### Ciclo 86 — aprovação Pix e liberação da carteira

- Revisado `painel.pix-aprovacao.tsx` com `pix-approvals.functions.ts` e o guard de saque. A aprovação persiste primeiro, mas o handler ignora falha ao retirar `agpay_access_blocked`; a UI mostra sucesso com chave aprovada. Registrado PAY-031 P2 potencial.
- A consulta da tela também usa `data: list = []` sem estado de loading/erro; erro aparece como “Nenhum Pix pendente”, registrado em UI-026. SEC-007 cobre separadamente que o PIN extra é somente gate visual.
- Não houve aprovação, alteração de chave/PIN, leitura ou saque real. Inventário: 111 IDs únicos.

**Estado atual:** auditoria em andamento; fluxo Master de aprovação Pix teve revisão estática parcial. Estado do Supabase remoto, teste de falha parcial por mocks e demais telas Master continuam pendentes.

### Ciclo 87 — lista Master de assinantes e MRR

- Conferido tratamento da query de lifecycle na rota de assinantes. O servidor propaga falhas, mas a página converte `data` ausente em lista vazia, exibe MRR zero e empty state após erro; registrado UI-027 P2 potencial.
- Não foram consultados dados reais nem executado teste visual. Inventário: 112 IDs únicos.

**Estado atual:** auditoria em andamento; assinantes revisados estaticamente quanto à query, KPI e estado vazio. Sem validação visual/remota; demais páginas Master continuam parciais ou pendentes.

### Ciclo 88 — regra de classificação de assinantes

- Cruzados o rótulo da tela com `getSubscriptionLifecycle` e `classifyLifecycle`: o agrupamento “assinante” decorre de acesso vigente e histórico pago, não de uma cobrança no mês calendário atual. A semântica do MRR para acessos concedidos manualmente/isenções não está definida na spec revisada; anotada como questão inconclusiva em `conformidade-spec.md`, sem novo ID.
- PAY-027 continua cobrindo a classificação de contas originalmente em teste após pagamento; esse ciclo não reavalia nem substitui aquele achado.
- Sem dados de negócios, pagamentos ou MRR reais. Inventário permanece em 112 IDs únicos.

**Estado atual:** auditoria em andamento; lógica e texto do agrupamento foram comparados estaticamente. Regra comercial de inclusão no MRR e casos de isenção precisam de confirmação documental/produto; acesso remoto indisponível.

### Ciclo 89 — fila Master de contas em teste

- Revisada a segunda consumidora da query de lifecycle. `painel.em-teste.tsx` usa fallback `items ?? []` e, após erro, atende ao guard de empty state sem `isError`; ampliei UI-027 para cobrir ambas as listas.
- Formulário de criação/extensão não foi submetido. Nenhum negócio ou acesso foi alterado. Inventário permanece em 112 IDs únicos.

**Estado atual:** auditoria em andamento; telas Master de assinantes e contas de teste tiveram triagem estática de query/empty state. Ações, filtros, browser e condições remotas permanecem pendentes.

### Ciclo 90 — cancelamento manual e catálogo público

- Cruzada `setBusinessCancellation(action='efetivar')` com catálogo, dias disponíveis e `loadContext`: o Master grava `cancelled_at` sem atualizar `status`, e os fluxos públicos consultam só `status`, bloqueando apenas `suspenso`. Ampliei BOOK-004 para cobrir cancelamento manual e automático.
- Nenhuma conta foi cancelada; não houve reserva, cobrança ou chamada pública executada. Inventário permanece em 112 IDs únicos.

**Estado atual:** auditoria em andamento; divergência manual/automática estática documentada. E2E isolado e aplicação remota continuam pendentes.

### Ciclo 91 — tela Master de contas em atenção

- Conferido o terceiro consumidor principal de `getSubscriptionLifecycle`: a tela de atenção também deriva lista, filtros e contagens da resposta vazia, exibindo empty state durante erro/loading. Ampliei UI-027 para abranger essa visão.
- O cruzamento de UI-027 não cria nova ID: a causa é o mesmo contrato de query sem estados visíveis nos consumidores; UI-011 continua específico para broadcasts.
- Nenhuma conta ou ação foi consultada/executada. Inventário permanece em 112 IDs únicos.

**Estado atual:** auditoria em andamento; três telas Master de lifecycle amostradas estaticamente. Fluxos de ação e dados remotos continuam pendentes.

### Ciclo 92 — empty state dos filtros de atenção

- Conferida a composição `all` → `filtered` → empty state da tela Master. Quando filtro ou busca remove todos os resultados, a mensagem ainda declara fila global vazia; registrado UI-028 P3 potencial.
- Sem dados reais ou ação persistente. Inventário: 113 IDs únicos.

**Estado atual:** auditoria em andamento; filtros e estado sem resultado da tela de atenção revisados estaticamente. Navegação/UX visual permanece pendente.

### Ciclo 93 — triagem visual de erros de produção

- Conferida a rota Master de erros: filtro altera query key e reinicia cursor; botão Atualizar chama refetch e respeita fetching; loading e erro são exibidos; paginação usa cursor composto. Detalhes exibidos passam pela allowlist de `safeErrorDetail`; os limites e sanitizer já constam na análise do endpoint em `backend.md`/`seguranca.md`.
- Não encontrei comportamento de UI novo com evidência suficiente para criar achado. Topologia/proxy e efetividade da limitação de origem/IP em produção continuam inconclusivos; nenhuma requisição foi enviada.
- Inventário permanece em 113 IDs únicos.

**Estado atual:** auditoria em andamento; `painel.erros.tsx` teve inspeção estática de filtro, erro, atualização, paginação e detalhes. Browser e telemetria real não foram consultados.

### Ciclo 94 — badge de status do dossiê Master

- Cruzado o status recebido por `BusinessDossier` com os valores lifecycle: o badge reduz todos os estados exceto `suspenso` a “Ativo”; `cancelado` é estado real gravado pelo auto-cancel e pode ser tratado em cancelamento manual. Ampliei ADM-001 para cobrir o mesmo padrão do KPI e do badge.
- Nenhum registro ou ação Master foi consultado. Inventário permanece em 113 IDs únicos.

**Estado atual:** auditoria em andamento; badge do dossiê amostrado. Demais componentes/ações do dossiê e listas Master continuam pendentes.

### Ciclo 95 — efeito de reversão no estado do plano do dono

- Cruzada a ação de reversão com `planState`: o servidor limpa timestamps de cancelamento, mantém `status`, e a UI do dono calcula o plano somente por status suspenso, pagamento e vencimento. Ampliei a evidência de UI-004; BOOK-004 documenta separadamente o acesso ao booking público.
- Não foi simulada alteração de estado, login de conta cancelada ou reserva. Inventário permanece em 113 IDs únicos.

**Estado atual:** auditoria em andamento; semântica de reversão foi traçada estaticamente até o indicador de plano. Resultado real no painel e regra comercial de reativação ainda não foram confirmados.

### Ciclo 96 — disponibilidade de leitura do Supabase remoto

- Consultada a listagem read-only de projetos conectados. A conta do conector não lista Agenda Agora; o único projeto visível pertence a outro produto, que não foi consultado. A evidência mantém PAY-003 e PAY-004 inconclusivos para ambiente remoto.
- Nenhuma tabela, log ou dado de negócio foi consultado; nenhum acesso foi criado e nenhuma permissão foi alterada. O projeto correto ainda exige acesso de leitura autorizado ou export sanitizado.
- Inventário permanece em 113 IDs únicos.

**Estado atual:** auditoria em andamento; conector não oferece o projeto Agenda Agora. Código/specs locais continuam auditáveis; configuração financeira e migrations efetivamente aplicadas em produção seguem pendentes.

### Ciclo 97 — cupom de assinatura no dossiê Master

- Cruzado `CouponCard` com `getBusinessCoupon`, `setBusinessCoupon` e cálculo de preço em `createSubscriptionCharge`. A UI trata query sem dados como cupom desativado e permite salvar; documentado UI-029 P2 potencial pelo efeito no próximo Pix.
- Nenhum cupom foi lido/salvo e nenhuma cobrança foi criada. Inventário: 114 IDs únicos.

**Estado atual:** auditoria em andamento; configuração de cupom e seu uso no preço foram traçados estaticamente. UI de erro, valor remoto e ocorrência permanecem inconclusivos.

### Ciclo 98 — retenção da senha temporária no dossiê

- Seguido o estado da resposta de `resetOwnerPassword`: o componente mantém a senha temporária entre fechamento/troca do `businessId` nas rotas que não desmontam o dossiê. Registrado SEC-022 P2 potencial.
- Reset e leitura de credencial não foram feitos; reprodução proposta usa resposta sintética mockada. Nenhuma mensagem foi enviada. Inventário: 115 IDs únicos.

**Estado atual:** auditoria em andamento; retenção de credencial no componente foi verificada estaticamente. Comportamento browser não testado; restante do dossiê e produção continuam pendentes.

### Ciclo 99 — agenda de recebíveis e indicador de churn

- Revisados `painel.recebiveis.tsx`, `getReceivablesCalendar`, gravação do pedido de cancelamento e T076 da spec 010. Registrados UI-030 a UI-033: KPI “Recusado” literal zero sem agregado de recusas; KPI mensal em UTC versus grade local; setas semanais alteram o cursor, mas a grade continua usando `today`; métrica “próximos 30 dias” soma qualquer pedido pendente sem filtro temporal.
- Os impactos de recusas, fusos e horizonte são potenciais; não houve leitura de pagamentos/negócios reais, nem validação visual. A semântica de efetivação de cancelamento permanece aberta.
- Nenhuma cobrança, configuração ou estado de produto foi alterado. Inventário: 119 IDs únicos.

**Estado atual:** auditoria em andamento; recebíveis tiveram revisão estática de quatro indicadores/navegação e cruzamento com a spec 010. Harness sintético e visualização em browser continuam pendentes; produção financeira permanece inacessível.

### Ciclo 100 — limite do histórico financeiro na navegação

- Cruzada a janela `now - 120 dias` aplicada em `getReceivablesCalendar` com navegação por cursor, calendário e visão anual. Registrado UI-034 P2 potencial: a UI pode navegar períodos anteriores ao corte, mas o endpoint não entrega recebimentos para esses períodos.
- A série histórica não foi consultada em produção; impacto é condicional a pagamentos anteriores à janela. Reprodução sintética proposta, sem execução nem alteração de estado.
- Nenhum código, dado, cobrança ou configuração foi alterado. Inventário: 120 IDs únicos.

**Estado atual:** auditoria em andamento; janela temporal de recebíveis foi cruzada com todas as visões navegáveis. Histórico remoto e comportamento visual permanecem não verificados.

### Ciclo 101 — reconciliação do relato de split pendente e 0%

- Revalidados PAY-001/PAY-003/PAY-006/PAY-015 contra spec 004 T077, spec 005 FR-001, spec 010 research/T055/T059 e cálculo atual do ledger. O código Pix não envia `splits`; `agpay_split_status` pode ser legado sob o modelo de recebimento integral. Percentual de comissão 0% é aceito e resulta em comissão percentual zero; o código separadamente desconta R$ 0,75 de custo do gateway por depósito e define comissão fixa da plataforma como zero.
- A spec 005 ainda descreve 3,99% + R$ 0,49 de gateway e comissão fixa da plataforma de R$ 0,25. Spec 010 documenta R$ 0,75 como taxa atual de depósito para simulação, mas não formaliza claramente a retirada dos R$ 0,25 da comissão. PAY-015 foi enriquecido com essa reconciliação; PAY-003 agora separa conclusão local da situação dos quatro registros.
- Conclusão parcial: o relato não comprova split quebrado, onboarding incompleto ou erro de configuração; negócios específicos e Dashboard AgPay permanecem inconclusivos porque o projeto correto não está acessível. Nenhuma consulta financeira ou operação foi feita. Inventário permanece em 120 IDs únicos.

**Estado atual:** auditoria em andamento; modelo financeiro local foi comparado às specs e o significado provável de split pendente delimitado. Configurações reais dos quatro negócios, split global no provedor e decisão comercial vigente ainda precisam de acesso/documentação.

### Ciclo 102 — conversão de horário em transição DST

- Revisitados helpers de timezone, schema de preferências e seletor da UI. Executei a função real `toIso` de forma isolada (sem banco/provider): `2027-03-14 03:30 America/New_York` gera `08:30Z`, que volta como `04:30` local. Testes existentes cobrem datas comuns, sem DST.
- Registrado BOOK-011 P2 potencial. O seletor padrão oferece apenas quatro fusos brasileiros sem DST, mas a Server Function permite gravar string de fuso arbitrária; impacto depende de configuração via chamada autenticada ou legado.
- Nenhuma configuração, reserva ou dado foi persistido; nenhum teste do produto foi alterado. Inventário: 121 IDs únicos.

**Estado atual:** auditoria em andamento; conversão DST foi reproduzida isoladamente e ligada ao caminho de configuração. Estado real de fusos de estabelecimentos permanece desconhecido.

### Ciclo 103 — proteção CSRF de Server Functions

- Revisados `src/start.ts`, `auth-middleware.ts`, `auth-attacher.ts` e a implementação da versão TanStack instalada. A aplicação registra middleware CSRF explicitamente apenas para handlers `serverFn`; a biblioteca valida `Sec-Fetch-Site` same-origin, ou `Origin`/`Referer` contra a origem da requisição, e nega quando não há sinais de origem (padrão sem permissão para ausência). A biblioteca usa o `requestMiddleware` definido por `startInstance`, então a inclusão explícita encontrada é necessária.
- Nenhum bypass local foi identificado nesta configuração; não foram feitas chamadas HTTP ou falsificações de origem. Versão implantada, proxy/CDN e headers efetivos de produção seguem sem verificação.
- Cobertura documentada sem novo ID. Nenhum arquivo de código/dado foi alterado; inventário permanece em 121 IDs únicos.

**Estado atual:** auditoria em andamento; controle CSRF local estático analisado. Autorização função a função, configuração de origem em produção e topologia de proxy ainda requerem cobertura.

### Ciclo 104 — evidência documental de backup/restore

- Revisados runbooks locais, arquivos operacionais e notas versionadas da spec 010. O runbook pede backup lógico antes/depois de deploy e cuidado com restauração; nota datada de 03/11 registra historicamente backup lógico de 13 tabelas do projeto qagot, armazenado fora do Git, e migration destrutiva ainda pendente naquele registro.
- Não abri o arquivo de backup excluído do Git. Não encontrei prova local de restore testado, backup recorrente, retenção ou estado atual do provedor; classificado como lacuna de evidência, sem afirmar que não exista backup gerenciado.
- Nenhum acesso remoto, export, deploy ou operação de restore foi feito. Sem novo ID; índice permanece em 121 IDs únicos.

**Estado atual:** auditoria em andamento; backup tem registro histórico e procedimento documental, mas proteção/restore atuais não foram verificáveis. Consulta ao projeto correto ou documentação sanitizada permanece necessária para fechar cobertura operacional.

### Ciclo 105 — escopo de autorização das funções SDR

- Revisitados os nove handlers sem middleware Supabase no domínio SDR e os seis handlers de administração Master: as ações SDR validam token HMAC/TTL e atividade em `requireSdr`; consultas e mutações observadas são filtradas por `sdr.id`, inclusive pagamentos via IDs dos negócios e reset de owner por `business_id + sdr_id`. As funções Master usam Bearer Supabase e `assertSuperAdmin`.
- Não surgiu novo achado de isolamento. ADM-003 permanece para provisionamento parcial; SEC-017 permanece para tokens não revogados após troca de PIN/logout. Nenhum login, reset, cadastro ou chamada externa foi executado.
- A documentação agora marca a cobertura estática SDR concluída nesta amostra; RLS/runtime remoto e revisão das demais funções seguem pendentes. Sem novo ID; inventário permanece em 121.

**Estado atual:** auditoria em andamento; autorização SDR foi rastreada handler por handler no código local. Acesso remoto, teste dinâmico e cobertura total das outras Server Functions ainda não concluídos.

### Ciclo 106 — projeção de configuração no catálogo público

- Cruzado o retorno de `getPublicBookingCatalog` com `Panel1Preferences` e os consumidores da página pública. Confirmado que o endpoint sem auth serializa `config.preferences`/`config.visual` inteiros; entre os campos há templates de lembrete/pós-atendimento e `post_service_clients`, lista de IDs consumida pelo worker interno. A rota pública só usa timezone e flags de cancelar/remarcar.
- Registrado SEC-023 P2 potencial. A exposição do contrato é confirmada no código local; se e quantos IDs/templates reais estão preenchidos não foram consultados. O payload sintético proposto não foi executado; nenhum objeto Storage ou registro real foi lido.
- Nenhum código/dado foi alterado. Inventário: 122 IDs únicos.

**Estado atual:** auditoria em andamento; fronteira de dados do catálogo público revisada e um payload excessivo registrado. Estado real da configuração e cobertura das demais APIs públicas seguem pendentes.

### Ciclo 107 — revisão de sinks HTML e previews

- Seguidos os quatro usos de `dangerouslySetInnerHTML` encontrados na busca local. Os previews escapam `&`, `<` e `>` antes da formatação permitida; o script de tema é literal com seleção por allowlist. `ChartContainer` não tem consumidores encontrados fora do próprio módulo.
- Nenhum XSS confirmado nessa amostra; o componente de chart mantém risco condicional se ganhar consumidores com cores/keys controláveis. Não houve payload no navegador nem inspeção runtime, portanto não é conclusão global sobre XSS.
- Sem novo ID; inventário permanece em 122 IDs únicos. Nenhum código, dado ou configuração foi alterado.

**Estado atual:** auditoria em andamento; sinks HTML conhecidos nesta busca foram rastreados até o escaping/origem. Busca ampla de outros contextos de saída, produção e testes dinâmicos seguros seguem pendentes.

### Ciclo 108 — sessão de navegador e guards autenticados

- Mapeado o fluxo comum: Supabase persiste/renova sessão no browser; middleware cliente anexa access token Bearer; middleware servidor valida claims e `sub`; service role está em módulo server separado. Layout autenticado bloqueia navegação no cliente, mas não substitui autorização por função/policy.
- Nenhum bypass de sessão confirmado na cadeia comum. Persistência no browser foi registrada como contexto para impacto potencial de XSS, sem novo achado. CSP, configuração remota, SSR implantado e auditoria exaustiva função por função seguem pendentes.
- Sem novo ID; inventário permanece em 122 IDs únicos. Nenhuma chamada autenticada, alteração de sessão ou dado foi realizada.

**Estado atual:** auditoria em andamento; cadeia central de sessão documentada estaticamente. Revisão de handlers de autorização e controles operacionais ainda é parcial.

### Ciclo 109 — login legado, PIN de segurança e recuperação Master

- Reconciliados fluxo de login owner/profissional, senha legada de quatro dígitos, recuperação Master e PIN Master de 6–12 dígitos. O PIN Master tem limite persistido e falha fechada; o handler de login não tem limitador local observável, mas validação e limites efetivos pertencem ao Supabase Auth remoto, inacessível nesta auditoria.
- Nenhum bypass confirmado nem novo ID. SEC-004 continua restrito à ausência de rate limit no PIN de saque; SEC-022 cobre estado da senha temporária. O risco da credencial owner legada depende das configurações do Auth e da permanência de contas usando-a.
- Nenhuma tentativa real de login, reset ou verificação de PIN foi realizada. Inventário permanece em 122 IDs únicos.

**Estado atual:** auditoria em andamento; fluxos locais de autenticação e recuperação foram reconciliados com os achados existentes. Configuração Supabase de produção continua sendo lacuna essencial.

### Ciclo 110 — cabeçalhos de segurança e framing

- Inspecionados `ops/vps/Caddyfile`, `vercel.json` e código. Caddy aplica HSTS, `nosniff`, Referrer-Policy e remove `Server`; CSP e anti-framing não aparecem nos arquivos versionados. Vercel também não define headers no manifesto.
- Registrado SEC-024 P2 potencial, condicionado a ausência de política em proxy/CDN externo e ao risco de clickjacking para jornadas autenticadas. Não houve acesso aos hosts nem requisição de produção.
- Contagem atual: 123 IDs únicos. Nenhum código, configuração operacional ou dado foi alterado.

**Estado atual:** auditoria em andamento; baseline de headers dos arquivos locais documentado. Cabeçalhos efetivos e compatibilidade de CSP continuam pendentes de verificação no deploy.

### Ciclo 111 — telemetria de erros e minimização

- Rastreados coleta no browser, sanitização, persistência via service role, consulta Master e RLS local. A allowlist exclui headers/body/cookies, URLs perdem query/fragment e padrões comuns de segredo/PII são redigidos. A leitura é superadmin.
- Nenhum vazamento confirmado nesta amostra; sanitização por regex não garante remoção de todos os dados sensíveis presentes em texto arbitrário. Rate limit usa `X-Forwarded-For` em memória; proxy versionado protege o header, mas configuração real permanece junto à lacuna SEC-018.
- Sem novo ID; inventário permanece em 123 IDs únicos. Nenhum dado de log foi consultado ou alterado.

**Estado atual:** auditoria em andamento; caminho local de telemetria e controle de acesso documentado. Retenção, volume, proxy em produção e dados realmente gravados não foram verificados.

### Ciclo 112 — revisão de consistência do checkpoint

- Comparei a tabela executiva de módulos com os ciclos recentes e o inventário de `problemas.md`. Atualizei os estados para refletir cobertura parcial real e substituí a contagem histórica de 80 por 123 IDs únicos atuais.
- Não houve novo achado; esta atualização corrige somente a documentação da auditoria. Módulos ainda não cobertos integralmente permanecem explicitamente parciais.
- Nenhum arquivo fora de `docs/auditoria-agenda-agora/` foi alterado por esta auditoria.

**Estado atual:** auditoria em andamento; resumo executivo sincronizado com o inventário atual, sem declarar cobertura total.

### Ciclo 113 — falha de persistência após cashout

- Seguido o cashout da resposta do AgPay ao processamento do webhook. A atualização de `provider_ref` e status pode falhar após resposta do provedor; o fallback ignora erro e não preserva a referência, enquanto o webhook exige correspondência exata por `provider_ref`.
- Registrado PAY-032 P1 potencial. A falha é estruturalmente confirmada no código, sem ocorrência reproduzida; o caminho de reprodução recomendado usa somente mocks. Nenhuma chamada financeira foi feita.
- Inventário atualizado para 124 IDs únicos. Nenhum código, dado ou configuração operacional foi alterado.

**Estado atual:** auditoria em andamento; cashout tem nova lacuna de recuperação pós-resposta identificada. Operações reais e estado do provedor permanecem inacessíveis.

### Ciclo 114 — retry da inbox para referência tardia de saque

- Conferidos worker e teste já existente para webhook recebido antes de o saque local ter `provider_ref`. A inbox tenta novamente com backoff, mantém evento sem referência em `failed` e o muda para `error` após 24 h; há teste unitário para essa transição e recuperação quando a referência aparece.
- PAY-032 permanece porque a falha de escrita pode descartar a referência de modo permanente; inbox preserva o evento, mas não reconcilia o payout por si só. Severidade/impacto documentados com essa mitigação. Nenhum teste foi executado nesta rodada.
- Sem novo ID; inventário permanece em 124 IDs únicos.

**Estado atual:** auditoria em andamento; comportamento da inbox de webhooks verificado estaticamente e cruzado com teste existente. Operação de alerta/reconciliação do estado `error` em produção segue sem validação.

### Ciclo 115 — caminho de triagem manual de cashout

- Inspecionada a tela Master de saques: permite liquidar manualmente pedidos `processing`, mas não mostra `provider_ref`; a consulta local à inbox de eventos fica vinculada a cobrança Pix de sinal, sem superfície identificada para visualizar erro de webhook de cashout.
- PAY-032 atualizado: há ação manual de fallback, mas ela exige consulta e correlação fora do painel e não corrige a referência ausente. Não se sabe se existe runbook/alerta externo ou rotina operacional; produção não foi acessada.
- Sem novo ID; inventário permanece em 124 IDs únicos. Nenhuma liquidação manual foi chamada.

**Estado atual:** auditoria em andamento; fallback manual para saque documentado com lacuna de observabilidade/reconciliação operacional.

### Ciclo 116 — allowlist de origens e validação de configuração

- Conferidos `getAllowedAppOrigins`, validação de produção no boot, auth de cron e os runbooks. A origem é canonicalizada para `URL.origin`; a validação de produção confere URL/origens e PINs Master. `SDR_TOKEN_SECRET`, `WHATSAPP_WEBHOOK_SECRET` e `AGENDA_CRON_SECRET` são exigidos no uso, mas não no check de boot.
- Registrado DEP-006 P2 potencial: se ausentes, processo e health check podem iniciar; as rotas/funções relacionadas falham quando usadas. Configuração de produção não foi consultada. Não foi identificado CORS explícito nas rotas inspecionadas; Server Functions usam CSRF same-origin.
- Inventário atualizado para 125 IDs únicos. Nenhum env foi lido, nem endpoint/cron executado.

**Estado atual:** auditoria em andamento; allowlist e boot config analisados estaticamente. Valores reais, origem efetiva, proxy e CORS externo permanecem pendentes.

### Ciclo 117 — censo de handlers sem middleware

- Recontados handlers com scan estático por arquivo e agrupados os 22 sem middleware TanStack: 11 booking público, nove SDR (login mais oito com `requireSdr`), telemetria e catálogo estático. Corrigida a interpretação: falta de middleware comum não equivale a falta de autorização; cada grupo tem mecanismo próprio, com achados já referenciados.
- Revisão individual completa dos endpoints públicos e testes negativos cross-tenant seguem pendentes; este ciclo não declara todas as APIs autenticadas ou públicas conformes.
- Sem novo ID; inventário permanece em 125 IDs únicos. Nenhum handler foi chamado.

**Estado atual:** auditoria em andamento; censo das exceções ao middleware comum explicitado e cruzado com achados existentes.

### Ciclo 118 — rotas HTTP de webhook e jobs

- Revisadas as cinco rotas HTTP versionadas (AgPay webhook, WhatsApp incoming e três jobs). Webhooks/jobs usam respectivamente HMAC AgPay, segredo WhatsApp comparado em tempo constante e Bearer de cron em tempo constante. As rotas de cron validam autenticação antes de executar workers.
- Registrado SEC-025 P2 potencial: endpoint AgPay materializa corpo inteiro e calcula HMAC antes de validar assinatura, sem limite de bytes local identificado; proxy/runtime podem ter limitação externa não consultada. A rota WhatsApp valida segredo antes do parse do body, então ficou separada.
- Inventário atualizado para 126 IDs únicos. Nenhuma chamada HTTP, mensagem, job, assinatura ou operação financeira foi executada.

**Estado atual:** auditoria em andamento; fronteiras de autenticação das rotas HTTP identificadas. Tamanho máximo imposto pela borda, eventos reais, retentativas remotas e monitoramento seguem pendentes.

### Ciclo 119 — varredura textual de funcionalidades incompletas

- Busca estática por TODO/FIXME, “em breve” e toasts de preparação cruzou resultados com UI-001, UI-003, UI-005 e UI-022. Os stubs relevantes encontrados já estão registrados; não surgiu nova ação incompleta comprovada.
- A varredura é apenas um filtro de triagem. Não representa inspeção de todos os controles em browser nem comprovação das jornadas integradas.
- Sem novo ID; inventário permanece em 126 IDs únicos.

**Estado atual:** auditoria em andamento; stubs textuais conhecidos foram consolidados, testes de jornada e acessibilidade seguem pendentes.

### Ciclo 120 — protocolo HTTPS da configuração de produção

- Cruzados `validateProductionConfig`, documentação de acesso Master e Caddyfile. O validador aceita `http:` tanto em `PUBLIC_APP_URL` como na allowlist, embora o runbook descreva a URL pública HTTPS.
- Registrado SEC-026 P2 potencial; risco condicionado aos valores reais e à terminação TLS/redirect no deploy, não verificados. HTTP local permanece necessário em desenvolvimento; a validação precisa distinguir ambientes.
- Inventário atualizado para 127 IDs únicos. Nenhuma variável nem host foi consultado.

**Estado atual:** auditoria em andamento; divergência da exigência de TLS em produção registrada; valores de runtime e tráfego continuam pendentes.

### Ciclo 121 — convergência de tarefas Spec 010

- Revisadas as tarefas abertas T039/T093, T048, T061/T096, T073/T094, T074/T095, T080/T097, T085/T099, T086/T098 e T100–T102, distinguindo validação browser/provedor pendente de execução e defeito confirmado.
- Registrado DOC-001 P3: nota de mudanças afirma “não publicada/sem deploy”, mas `tasks.md` registra merge/deploy em 04/11. Documentado sem alterar o artefato de produto.
- Inventário atualizado para 128 IDs (127 códigos previamente inventariados + DOC-001). Busca de referências em `src/` só encontrou sentinelas no teste `reset-password.test.ts`; nota de types/tsc é histórica e não foi reexecutada.

**Estado atual:** auditoria em andamento; convergência da spec 010 explicitada, com validações e tarefas não executadas preservadas como pendentes.

### Ciclo 122 — variáveis client e contexto Docker

- Revisados usos de `import.meta.env`, nomes de segredos no source, `vite.config.ts`, `Dockerfile`, `.dockerignore` e `.gitignore`, sem abrir `.env` nem imprimir valores.
- Nenhum segredo privado aparece em referências client no source; build define somente URL/chave publicável do Supabase e flag visual. `.env` é excluído do contexto e runtime recebe `.output`.
- Sem novo ID; inventário permanece em 128 IDs. Bundle compilado, source maps publicados, histórico Git e imagem do deploy não foram inspecionados.

**Estado atual:** auditoria em andamento; exposição de env foi revisada estaticamente no source e no Docker. A verificação de artefato compilado e cadeia de build segue pendente.

### Ciclo 123 — rótulos diários na performance financeira

- Cruzado o agrupamento `daily.date` em UTC com o formatador do eixo/tooltip em timezone local. Reprodução pura de data demonstrou que `2026-11-13` é exibido como `12/11/2026` em `America/Fortaleza`.
- Registrado UI-035 P2 potencial: o rótulo diário recua um dia em fusos negativos; os valores permanecem nos buckets UTC. Política de fuso de relatório Master segue sem decisão explícita.
- Inventário atualizado para 129 IDs únicos. Nenhum pagamento ou série de produção foi lido.

**Estado atual:** auditoria em andamento; data civil UTC versus renderização local no gráfico documentada, sem acesso a registros reais.

### Ciclo 124 — vitrine de templates

- Revisada estaticamente a jornada inicial e abertura de nichos em `src/routes/_authenticated/painel.templates.tsx`. “Escolher Nicho” rola até a vitrine, seleção altera o destaque e a seta abre os assets; o botão “Como Funciona” não tem `onClick`, link, âncora nem outro comportamento.
- Registrado UI-036 P3: controle anunciado como ação não executa ação. O texto explicativo já aparece abaixo no mesmo hero, então o impacto parece limitado a affordance enganosa; browser/teclado não foram exercitados.
- Inventário atualizado para 130 IDs únicos. Não houve alteração de assets, chamada de endpoint ou interação com dados.

**Estado atual:** auditoria em andamento; controle da vitrine revisado por fonte; catálogo completo, editor de template e QA browser continuam pendentes.

### Ciclo 125 — entrada do editor visual e FR-010

- Comparei FR-010 e T030 da spec 007 com a rota `/painel/templates`, a rota do editor, e buscas de referências a `/editor-template` e `MasterTemplatesTab` no source.
- A vitrine atual (`painel.templates.tsx`) oferece seleção de nichos/download de artes estáticas, sem link para o editor visual. A única referência de UI ao editor está em `MasterTemplatesTab`, que não é importado/montado em outro arquivo `src/`; o editor ainda pode ser aberto diretamente se o usuário já souber a rota/ID.
- Registrado UI-037 P2 confirmado estaticamente: o fluxo de seleção de arte exigido pela FR-010 não está acessível a partir da tela Templates atual, apesar de T030 marcada concluída. O quickstart de 30/09 relata navegação direta para a URL e não demonstra a entrada pela vitrine.
- Inventário atualizado para 131 IDs únicos. Nenhum dado, arte ou template foi alterado.

**Estado atual:** auditoria em andamento; mismatch de navegação da spec 007 registrado; acesso direto autenticado, arte real e persistência não foram testados nesta rodada.

### Ciclo 126 — consequência de refund sobre reserva

- Cruzei o branch de refund do webhook, a ação pública de cancelar reserva, as ações no histórico e os requisitos de cancelamento das specs 004/005.
- O webhook só faz lançamentos do ledger; o estado do appointment é alterado por ação pública separada. As specs encontradas cobrem cada comportamento, mas não definem se refund externo deve cancelar atendimento/liberar horário.
- Registrei essa lacuna como inconclusiva em `pagamentos.md` e `agendamentos.md`, sem criar defeito por ausência de uma regra de produto. Nenhum dado/evento remoto foi consultado e nenhum estado foi modificado.
- Inventário permanece em 131 IDs únicos.

**Estado atual:** auditoria em andamento; consequência operacional do refund está explicitada como pergunta de regra pendente para especificação de correção.

### Ciclo 127 — confirmação pública dos eventos de webhook AgPay

- Reconsultei a página oficial `https://agpay.services/documentacao` em modo somente leitura; respondeu HTTP 200. A tabela atual de eventos lista `deposit.completed`, `withdrawal.completed`, `withdrawal.pending`, `transaction.failed` e `transaction.waiting_payment`; não descreve refund/chargeback.
- PAY-007 já registra o risco; atualizei a evidência para distinguir omissão documental de prova de que o gateway não emita outros eventos. O nome efetivo segue inconclusivo sem contrato escrito adicional ou payload de sandbox.
- Reconsultei também os projetos Supabase conectados: a lista retorna apenas um projeto distinto do `qagotnmdqjoodoudcikd` registrado para Agenda Agora. Banco e registros de produção continuam sem acesso nesta sessão.
- Nenhuma autenticação, chamada de API, cobrança, estorno ou webhook real foi executado. Inventário permanece em 131 IDs.

**Estado atual:** auditoria em andamento; consulta pública atualizada não fecha T074/T095 da spec 010, que exige validar o contrato efetivo do evento.

### Ciclo 128 — hashes legados de PIN do SDR

- Revisei `sdrLogin`, a migração de hash para scrypt descrita na spec 010, acesso à tabela `sdrs` e os privilégios SDR após login.
- Confirmado no source: PIN tem quatro dígitos; hash legado é SHA-256 de e-mail normalizado + PIN, sem salt aleatório ou pepper; login aceita o formato legado e só o converte para scrypt depois de autenticação bem-sucedida. A spec confirma que hashes antigos continuam válidos até o próximo login.
- Registrado SEC-027 P2 potencial: se ainda houver hash legado e um dump/leitura não autorizada expuser `sdrs.pin`, o espaço de 10 mil PINs pode ser enumerado offline; o PIN recuperado pode obter sessão SDR ativa. Nenhuma linha de produção foi lida; existência e quantidade desses hashes são desconhecidas. A migration local revoga acesso de `anon`/`authenticated`, reduzindo o cenário aos caminhos de leitura privilegiados/backup.
- Inventário atualizado para 132 IDs únicos. Não houve tentativa de enumerar PIN real, acesso autenticado, alteração de hash ou chamada SDR.

**Estado atual:** auditoria em andamento; risco de hash legado documentado como condicional a dado e exposição não verificados.

### Ciclo 129 — alteração de e-mail do SDR sem redefinição do PIN

- Cruzei o handler `updateSdr`, o formulário da equipe Master e a função de validação usada pelo login SDR.
- Confirmado estaticamente: a edição sempre grava o e-mail novo, mas só atualiza o hash quando o campo opcional de PIN vem preenchido. Como SHA-256 legado e scrypt usam `email::pin` como segredo de entrada, login pelo novo e-mail falha com o PIN anterior.
- Reproduzi a propriedade com hash SHA-256 e scrypt sintéticos (sem arquivo, tabela ou credencial real): a mesma combinação verificou no e-mail antigo e falhou no novo em ambos os formatos. O formulário permite editar e-mail com PIN vazio; não há teste de `updateSdr` na suíte localizada.
- Registrado ADM-004 P2: mudança de e-mail sem trocar PIN bloqueia a próxima autenticação SDR, após token atual expirar ou logout. Nenhuma conta real foi alterada.
- Inventário atualizado para 133 IDs únicos.

**Estado atual:** auditoria em andamento; impacto reproduzido somente com dados sintéticos; frequência e ocorrência em produção desconhecidas.

### Ciclo 130 — bind do serviço web e caminho direto ao upstream

- Cruzei o unit systemd, o Caddyfile e o runbook da VPS. O runbook diz que a aplicação escuta em `127.0.0.1:3000`, mas o unit não define `HOST`/`NITRO_HOST` e importa um arquivo de ambiente que não foi acessado. O runtime Nitro deriva hostname dessas variáveis; a documentação do Node descreve bind em endereço não especificado quando host não é passado.
- Atualizei SEC-018 e `infraestrutura.md` como questão condicional/inconclusiva: configuração de ambiente, socket ativo, firewall e acessibilidade externa não foram verificados. A declaração `HOST=0.0.0.0` no Dockerfile pertence ao estágio de build e não prova configuração do unit systemd.
- Nenhum serviço, host, firewall ou endpoint foi consultado ou alterado. Nenhum novo ID; inventário permanece em 133 IDs únicos.

**Estado atual:** auditoria em andamento; caminho de exposição do upstream requer confirmação somente leitura no host implantado ou ambiente equivalente.

### Ciclo 131 — concorrência da remarcação sem profissional

- Cruzei `rescheduleAppointmentPublic` com a exclusion constraint existente. A remarcação consulta disponibilidade antes do UPDATE; a constraint não cobre appointments com `professional_id IS NULL`, assim como já ocorria na criação sem profissional.
- Ampliei BOOK-002 para abranger a lacuna de serialização na criação e remarcação. A leitura confirma a sequência e o escopo da constraint, mas concorrência não foi reproduzida nesta rodada e a aplicação da migration em produção é desconhecida.
- Nenhuma reserva ou linha foi criada/alterada. Nenhum novo ID; inventário permanece em 133 IDs únicos.

**Estado atual:** auditoria em andamento; concorrência de remarcação deve ser reproduzida em banco descartável com duas transações sincronizadas.

### Ciclo 132 — owner scoping e referências financeiras entre tenants

- Revisão estática amostral de `getLedgerStatementForOwner`, `updateBusinessProfile`, `createTimeBlock`, `saveService`, `saveServiceDeposit` e `setAppointmentStatus`; não identifiquei bypass cross-tenant nos caminhos inspecionados.
- A migration do ledger separa FKs de `business_id` e `payment_id`/`withdrawal_id`, sem impor que as referências pertençam ao mesmo negócio. O extrato busca detalhes por IDs derivados de lançamentos já filtrados, sem filtro tenant secundário. Registrei DB-004 no inventário como risco suspeito, sem caminho de exploração confirmado.
- Callers financeiros completos, validação em banco descartável e integridade remota ainda pendentes. Nenhuma query, RPC ou dado de produção foi acessado; nenhum teste ou mutação executado.
- Inventário atualizado para 134 IDs únicos.

**Estado atual:** auditoria em andamento; DB-004 requer validação segura das RPCs/callers e invariantes compostas antes de classificar como falha confirmada.

### Ciclo 133 — reprodução isolada das referências cruzadas do ledger

- Revalidei que `scripts/ensaio/.data` não existia e a porta 54330 estava livre. O helper local subiu Postgres efêmero, aplicou as 71 migrations e foi encerrado com remoção dos arquivos temporários.
- Sob `service_role`, com UUIDs inteiramente sintéticos, `ledger_credit_payment` aceitou lançamento do business A vinculado a pagamento do business B; `ledger_request_withdrawal` aceitou débito do A vinculado a saque do B. A checagem por JOIN confirmou as duas inconsistências; a transação terminou em `ROLLBACK`.
- Revisei os call sites de produção encontrados: crédito/refund e reserva de saque derivam business e ID da mesma linha. Nenhum endpoint de owner que forneça referência arbitrária às RPCs service-role foi encontrado nesta varredura. DB-004 segue risco de integridade P2 potencial, com exploração comum não demonstrada.
- Nenhum registro real foi consultado. Nenhum arquivo de código ou dado do projeto foi alterado; helper confirmou pasta removida e porta encerrada. Inventário permanece em 134 IDs.

**Estado atual:** auditoria em andamento; consistência foi reproduzida somente na chain local e na superfície privilegiada.

### Ciclo 134 — configuração do Painel 1

- Revisei guards, chave do objeto no Storage, merge de patch, normalização das mídias e testes de concorrência existentes.
- Nenhum bypass tenant confirmado. O lock de escrita é process-local; o unit versionado declara um único processo Node, mas a topologia real/scale-out não foi verificada. A cobertura de teste existente usa o mesmo processo/client; testes não foram reexecutados.
- Relacionei preferências retornadas publicamente a SEC-023 e paths de foto de profissional a SEC-020; não dupliquei achados. Sem escrita em Storage ou configuração; nenhum novo ID. Inventário permanece em 134 IDs.

**Estado atual:** auditoria em andamento; confirmar implantação efetiva e concorrência somente se houver múltiplas instâncias do app.

### Ciclo 135 — endpoint de mensagem de teste WhatsApp

- Cruzei schema, permissão `generate_qrcode`, ação da UI e normalização dos dois providers. A UI usa texto fixo, mas a Server Function aceita template e destino do caller; no handler não há rate limit, e o telefone de 10–20 caracteres é apenas reduzido a dígitos/prefixado pelos adaptadores.
- Registrei INT-009 P2 potencial: sessão autorizada pode repetir mensagens externas a destino arbitrário. A ausência de controle local estática é confirmada; abuso depende de conta/integração autorizada, e throttle externo/ocorrência não foram verificados.
- Nenhuma mensagem enviada. Não foi feita reprodução mockada nesta rodada. Inventário atualizado para 135 IDs.

**Estado atual:** auditoria em andamento; confirmar política de destino e frequência com regra de produto e, em seguida, reproduzir apenas com provider mockado.

### Ciclo 136 — provisionamento de instância WhatsApp

- Cruzei a ordem de criação externa, gravação privada/legada e atualização do business; também conferi chamadas paralelas e recursos de deleção expostos pelos adaptadores.
- Registrado INT-010 P2 potencial: duas chamadas podem criar antes da persistência; falha de escrita posterior ao create pode deixar a credencial sem referência local. Não há claim por business nem compensação geral. Custos, quotas e ocorrência real são desconhecidos.
- Nenhum provider foi chamado; nenhuma mensagem, instância ou credencial foi criada/alterada. Inventário atualizado para 136 IDs únicos.

**Estado atual:** auditoria em andamento; validar cenários de retry e paralelismo com provider/storage mockados antes de concluir efeito e severidade.

### Ciclo 137 — validação de data civil nas jornadas públicas

- Cruzei o regex da data em `slugSchema`, os helpers de weekday/UTC, a comparação de `block_date` e os pontos de gravação em reserva/remarcação.
- A regex aceita `2026-02-31`; reprodução local da mesma construção de `Date`/offset normalizou `2026-02-31 10:00` em São Paulo para `2026-03-03T13:00Z` (03/03 local). Como o bloqueio compara a string de entrada literal, um bloqueio da data efetiva não corresponde à entrada inválida. Adicionei BOOK-012 P2 potencial.
- Nenhum DB, provider, reserva ou bloqueio real foi consultado ou alterado. O handler completo não foi executado; inventário atualizado para 137 IDs.

**Estado atual:** auditoria em andamento; validar rejeição e aplicação de bloqueio em handler/DB descartável, sem chamar provider.

### Ciclo 138 — classificação de rejeição na geração de Pix

- Cruzei o erro `AgpayApiError`, o wrapper `pixExternalStep`, a escolha de outcome no release, as migrations de claim e o teste unitário que simula rejeição.
- Confirmado localmente: o wrapper remove detalhes/classificação do erro; a chamada então libera como `falhou`, deixando `post_enviado` evoluir para `post_incerto`. A migration posterior prevê `rejeitado` para retry imediato. O teste mockado focal passou (1 teste, 84 ignorados) e documenta a expectativa conflitante; não houve chamada externa nem espera simulada de dois minutos. Registrei PAY-033 P3, com efeito de produção desconhecido.
- Inventário atualizado para 138 IDs únicos. Sem alteração em código, dado, migration ou configuração; somente documentação da auditoria foi atualizada. Alterações locais preexistentes permanecem preservadas.

**Estado atual:** auditoria em andamento; necessário identificar quais status/códigos AgPay significam rejeição definitiva antes de definir classificação segura; host/configuração e dados de produção continuam inacessíveis.

### Ciclo 139 — atomicidade da renovação de acesso por webhook

- Cruzei `confirmSubscriptionCharge`, o requisito T062 de renovação via `max`, as migrations, os testes unitários disponíveis e o worker AgPay.
- O código evita encurtamento apenas com uma leitura/comparação seguida de UPDATE, sem guarda atômica; os testes cobrem o caso sequencial, não duas chamadas concorrentes. Documentei PAY-034 P2 potencial, condicionado a cobranças com `period_end` distintos e execução simultânea. O desenho do risco está confirmado; ocorrência e sobreposição do worker em produção não foram verificadas.
- Não executei testes nem iniciei processos Node após o usuário informar que encerrou processos para aliviar a máquina. Nenhuma API, banco remoto ou evento foi acessado. Inventário atualizado para 139 IDs; somente documentação de auditoria foi alterada.

**Estado atual:** auditoria em andamento; confirmar concorrência do worker no deploy e validar o interleaving em harness isolado quando isso não afetar a estação do usuário.

### Ciclo 140 — ordenação de resultados terminais de saque

- Cruzei a classificação de `withdrawal.*`, a lookup por `provider_ref` e a RPC transacional `ledger_settle_withdrawal`.
- Confirmado localmente: após `failed`/`canceled`, qualquer evento terminal posterior é no-op, mesmo se trouxer `paid`; a primeira transição devolve o saldo bloqueado. Se o provedor puder revisar/reordenar resultado, existe risco condicional de liberar saldo antes da confirmação. Documentado PAY-035 P2 potencial; não há evidência de que isso aconteça no AgPay.
- A consulta pública não trouxe contrato verificável sobre transições/ordem e não existe payload de sandbox. Não executei teste nem processo Node a pedido do usuário; nenhum evento, saque, ledger ou dado real foi alterado. Inventário atualizado para 140 IDs.

**Estado atual:** auditoria em andamento; obter documentação contratual/sandbox do AgPay para validar se status `failed`/`rejected` é terminal absoluto e se eventos podem chegar fora de ordem.

### Ciclo 141 — autorização concorrente da transição de status

- Revisei a função central `has_business_permission`, `setAppointmentStatus`, o mapeador de transições, API-003 e os testes existentes.
- Confirmado estaticamente: o handler deriva permissão do status lido, mas UPDATE service-role filtra somente pelo ID; um status ativo aprovado como “neutro” pode sobrescrever um cancelamento/conclusão concorrente e contornar `reopen_appointment`. Registrei API-008 P2 potencial, distinto de API-003 (transições diretas envolvendo bloqueio).
- A busca dos testes não encontrou caso de concorrência; não executei Node nem alterei testes. Nenhum appointment, usuário ou dado foi alterado. Inventário atualizado para 141 IDs.

**Estado atual:** auditoria em andamento; validar corrida em harness com mocks e seguir a revisão função a função de autorização e isolamento de tenant.

### Ciclo 142 — escrita de permissões da equipe

- Cruzei o predicado `has_business_permission`, grants/policies de `professionals` e `saveProfessional`.
- Resultado negativo para autoelevação direta no escopo inspecionado: RLS limita escrita ao dono e a mutation valida o owner antes do service role. Documentei evidência e limite em `seguranca.md`; migrations efetivas no remoto seguem não verificadas.
- Nenhum teste ou processo Node foi executado; nenhum dado ou configuração foi alterado. Sem novo ID; total do inventário permanece em 141 IDs.

**Estado atual:** revisão de segurança segue parcial; faltam handlers fora da amostra e confirmação de policies do projeto remoto.

### Ciclo 143 — autenticação de endpoints de cron

- Revisei o autenticador compartilhado, os três hooks, o script systemd e referências de rotação nos runbooks/specs.
- Não identifiquei bypass local na guarda Bearer/timing-safe. Registrei na seção de infraestrutura que a chave anterior não expira por código e que o procedimento de remoção não foi encontrado; mantive como limitação operacional, sem novo ID de defeito.
- Sem leitura de env, chamada de cron, restart ou processo Node. O total de achados permanece em 141; deploy/segredos efetivos continuam sem verificação.

**Estado atual:** falta validar a janela real de rotação e completar a inspeção de handlers, browser e ambiente efetivo.

### Ciclo 144 — retenção e crescimento da inbox de webhook

- Cruzei schema, upsert/dedupe, estados de retry/error e todas as referências locais à tabela `agpay_webhook_events` em código, migrations, ops e runbooks.
- A chain versionada define payload JSONB e índices; não encontrei expurgo/partição/arquivamento. O estado `error` após 24h move a referência para triagem, mas não remove a linha. Registrei DB-005 P3 potencial sem inferir volume ou PII em produção.
- Nenhum evento ou registro real foi lido; não executei testes, jobs ou processos Node. Inventário atualizado para 142 IDs.

**Estado atual:** auditoria em andamento; consultar métricas/retention do projeto correto e estabelecer prazo operacional documentado antes de estimar impacto real.

### Ciclo 145 — cobertura da trilha de auditoria Master

- Comparei os tipos/eventos gravados por lifecycle, dossiê, reset e cron com a constraint local de `master_business_events`; não encontrei tipo incompatível na chain pesquisada.
- Revendo os call sites, encontrei o mesmo erro tratado em SEC-005 no helper `recordEvent`: o insert do dossiê ignora `{ error }`, inclusive após alterar dados comerciais e após consultar o snapshot de suporte. Atualizei o achado existente em vez de criar ID duplicado. Erro/omissão real em produção não foi reproduzido.
- Sem execução de testes, Node, operação Master ou leitura de dados. Inventário permanece em 142 IDs.

**Estado atual:** a trilha local tem lacunas de garantia e cobertura; aplicação da constraint e registros reais permanecem sem verificação.

### Ciclo 146 — classificação do resultado do cashout AgPay

- Cruzei os erros produzidos por `agpayFetch`/`createCashoutPix`, o catch de `createWithdrawal`, a reversão da RPC de saque, testes existentes e comentários do adaptador.
- Confirmado localmente: qualquer `AgpayApiError` cai em `failed`, inclusive erros HTTP 5xx; resposta 2xx sem identificador também vira 422 interno e segue a reversão. O caminho de timeout genérico permanece `processing`. Registrei PAY-036 P1 potencial; payout externo aceito em 5xx/resposta sem referência não foi demonstrado e depende do contrato do AgPay.
- Testes existentes foram apenas inspecionados (sem execução): timeout genérico conserva `processing`, erro 422 sintético reverte; não cobrem 5xx ou 2xx incompleto. Buscas oficiais não forneceram contrato de erro verificável. Nenhum provider, saldo ou dado foi tocado; sem Node. Inventário atualizado para 143 IDs.

**Estado atual:** auditoria em andamento; obter semântica oficial de erros/correlação AgPay e validar o ramo em harness isolado antes de declarar ocorrência ou efeito real.

### Ciclo 147 — feedback assíncrono da cópia Pix

- Inspecionei o handler `handleCopyPix` e o bloco de pagamento em `src/components/public-booking/PaymentDialog.tsx:116-121,239-247`.
- Registrei UI-038 P3 confirmado estaticamente: a Promise da clipboard é descartada e a UI informa cópia antes de saber se resolveu. O QR/código seguem visíveis, limitando o impacto.
- A rejeição não foi reproduzida em harness; não iniciei Node, teste ou browser após o usuário informar que encerrou processos para aliviar o PC. Nenhum dado, pagamento ou configuração foi tocado. Inventário atualizado para 144 IDs.

**Estado atual:** auditoria em andamento; verificar a resolução/rejeição em harness isolado quando isso puder ser feito sem sobrecarregar a máquina, e continuar a revisão de cobertura frontend.

### Ciclo 148 — rate limit do polling de pagamento

- Cruzei o intervalo de cinco segundos do `PaymentDialog`, o endpoint `getDepositStatus`, a cota de 120 chamadas/minuto e a chave compartilhada por IP do rate limiter.
- Registrei UI-039 P3 potencial: dez diálogos sustentados no mesmo IP atingem a cota teórica; erros de consulta são engolidos e o modal não informa a falha. A sessão única fica abaixo do limite; impacto real depende de concorrência e rede compartilhada, não verificados.
- Nenhum processo, teste, browser ou endpoint foi iniciado. Nenhum dado/pagamento foi acessado ou alterado. Inventário atualizado para 145 IDs.

**Estado atual:** auditoria em andamento; dimensionamento de concorrência real e comportamento visual após rate limit não foram exercitados. Continuar revisão estática das jornadas públicas e fechar lacunas de cobertura sem iniciar Node.

### Ciclo 149 — integração da rota de agendamento com o modal

- Inspecionei o `refetchInterval` de histórico (15 s com sinal pendente), o callback inline `onClose` em `agendar.$slug.tsx` e as dependências do efeito de status em `PaymentDialog.tsx`.
- A rota pode recriar o callback e reiniciar o timer de polling em renders; com a periodicidade local de 15 s contra 5 s, não há evidência estática de starvation. Registrei a cobertura em `frontend.md`, sem criar novo achado.
- Nenhum processo, teste, browser ou endpoint foi iniciado; nenhum dado foi acessado ou alterado. O inventário segue em 145 IDs.

**Estado atual:** auditoria em andamento; confirmar o polling sob rede/renderizações reais permanece pendente, sem executar a aplicação neste ciclo.

### Ciclo 150 — regras de disponibilidade na remarcação Elegance

- Cruzei o componente ativo `EleganceHistoryActions`, a consulta de slots sem `professionalId` e a Server Function que valida a remarcação contra `appointment.professional_id`.
- Registrei UI-040 P2 confirmado estaticamente: em serviços com profissionais vinculados, a consulta sem ID é rejeitada pelo servidor e a UI transforma o erro em “Sem horários”; a jornada de remarcação fica indisponível nessa configuração. Não exercitei a ocorrência em fixture.
- Não iniciei Node, testes ou browser; nenhuma reserva ou dado foi alterado. Inventário atualizado para 146 IDs.

**Estado atual:** auditoria em andamento; reproduzir a divergência com fixtures isoladas e revisar as demais regras da jornada de remarcação permanecem pendentes.

### Ciclo 151 — recuperação de cobrança Pix sem QR

- Cruzei o tipo/resposta de `createPixCharge`, persistência sequencial do ID e QR, guarda contra POST duplicado, liberação do claim e sincronização de status.
- Registrei PAY-037 P2 potencial: se o ID externo for persistido sem QR (resposta sem `pix_code` ou falha na segunda gravação), a função retorna erro; tentativas posteriores são bloqueadas e a sincronização atualiza status, mas não recupera o código. O contrato de resposta parcial e ocorrência de persistência não foram verificados.
- Nenhum gateway, dado, endpoint ou processo foi acessado; sem Node/testes. Inventário atualizado para 147 IDs.

**Estado atual:** auditoria em andamento; contrato de `pix_code` e capacidade de recuperar QR pelo ID externo são lacunas externas pendentes. Continuar revisão estática de pagamentos e fluxos críticos.

### Ciclo 152 — validação do valor em webhook e polling de pagamento

- Reexaminei PAY-014 e ampliei sua evidência: além do webhook descartar `amount`, o caminho de polling usa `fetchPaymentStatus`, que retorna somente `status` embora `fetchPayment` carregue `amount`; `completed` chama a mesma confirmação local sem reconciliação do montante.
- Atualizei `pagamentos.md` e `riscos.md` sem criar ID duplicado. A divergência efetiva de valor do AgPay continua não verificada; nenhum webhook, endpoint ou pagamento foi executado.
- Nenhum teste ou processo Node iniciado. Inventário permanece em 147 IDs únicos.

**Estado atual:** auditoria em andamento; confirmar unidade/semântica oficial do valor no AgPay e cobrir ambas as vias de confirmação em ambiente isolado, sem operações financeiras reais.

### Ciclo 153 — idempotência do POST Pix após timeout

- Cruzei o timeout de rede de 8 s, classificação `post_incerto`, condição SQL de retry após dois minutos, payload do POST e ausência local de lookup por referência externa.
- Registrei PAY-038 P2 potencial: se AgPay aceitar o primeiro POST e a resposta se perder, o segundo POST após a carência pode criar outra cobrança. O efeito do gateway não foi demonstrado; não declarei duplicidade ocorrida.
- Nenhum endpoint, provider, banco ou processo foi acessado. Não iniciei Node/testes. Inventário atualizado para 148 IDs.

**Estado atual:** auditoria em andamento; validar o contrato de idempotência e o tratamento de timeout com material oficial/sandbox isolado segue pendente. Continuar a revisão financeira.

### Ciclo 154 — eventos de falha e confirmação fora de ordem em sinal

- Cruzei o handler `transaction.failed`, que expira a cobrança pendente, com `deposit.completed` e o caminho tardio de `confirmDepositPayment`.
- Ampliei BOOK-001 para explicitar a sequência: uma falha local seguida de confirmação posterior pode creditar como `pago_sem_agendamento`, sem restaurar a reserva. Isso é comportamento local confirmado; não indica que AgPay emita a sequência nem que ocorreu em produção.
- Atualizei `agendamentos.md` e a síntese de riscos; nenhum ID novo. Sem endpoint, dado ou pagamento real; sem Node/testes. Inventário permanece em 148 IDs.

**Estado atual:** auditoria em andamento; validar os nomes/ordem oficiais de eventos AgPay segue pendente. Continuar revisão financeira e de dados críticos.

### Ciclo 155 — compatibilidade do webhook UazAPI

- Comparei o parser e o roteamento locais com o adaptador padrão UazAPI e a documentação oficial atual do evento `messages`.
- Registrei INT-011 P2 potencial: contrato documenta `token` e objeto `message`, enquanto parser/roteamento exigem `instance`/`data` e campos planos/Evolution; payload oficial atual não é reconhecido. A versão e provider efetivos de produção permanecem inconclusivos.
- Consulta somente à documentação pública e source local; sem chamada ao provider, webhook real ou envio de mensagem. Sem Node/testes. Inventário atualizado para 149 IDs.

**Estado atual:** auditoria em andamento; confirmar contrato da instância ativa e fixtures sanitizadas de ambos os providers segue pendente.

### Ciclo 156 — schema de configuração do webhook UazAPI

- Comparei o `setInstanceWebhook` local com o schema público atual de `POST /webhook`: o adaptador envia campo `headers` com `X-Webhook-Secret`, mas a documentação enumera outros campos e não documenta `headers`; a rota local exige esse header.
- Acrescentei essa lacuna ao INT-011 como inconclusiva: não concluí que UazAPI rejeita ou ignora propriedades não documentadas. A incompatibilidade do payload `message`/`token` segue confirmada contra a referência pública atual; provider/runtime ativos continuam desconhecidos.
- Só consulta a documentação oficial e leitura local; sem configuração ou chamada ao provider, sem mensagem, sem Node/testes. Inventário permanece em 149 IDs.

**Estado atual:** auditoria em andamento; confirmar suporte a headers customizados e formato na instância efetiva requer documentação da versão contratada ou inspeção segura do dashboard/logs autorizados.

### Ciclo 157 — cobertura estrutural de RLS nas migrations

- Varri `CREATE TABLE`, `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` e ACLs em todos os SQL de `supabase/migrations`: 40/40 tabelas criadas na chain têm RLS; 27 têm policies declaradas; 13 não têm policy e são revogadas de `anon`/`authenticated`, com `service_role` autorizado.
- Registrei o alcance e as limitações em `seguranca.md` e na linha de banco/RLS: análise local da chain não prova estado remoto nem tabelas fora dela.
- Sem CLI/conexão Supabase, migration, processo ou teste; nenhum dado alterado. Inventário permanece em 149 IDs.

**Estado atual:** auditoria em andamento; revisar separadamente `EXECUTE` de funções públicas/`SECURITY DEFINER`, ACLs efetivas e policies individuais ainda é necessário para cobertura completa.

### Ciclo 158 — grants de funções privilegiadas

- Revalidei as 10 definições locais `SECURITY DEFINER`, seus `search_path` e ACLs; todas fixam path. Escritas financeiras/workers são service-role-only; helpers de policy concedidos a `authenticated` têm chamadas com identidade obtida em RLS/Server Functions.
- Confirmei os helpers de path do Storage como `SECURITY INVOKER` com `search_path = ''`, corrigindo a descrição da triagem para não contá-los como definers. A chamada direta a `has_role(uuid, role)` ainda permite boolean para UUID informado; sem prova de UUIDs acessíveis ou abuso, mantive como lacuna, não achado.
- Nenhuma conexão Supabase, query, migration, processo ou teste. Inventário permanece em 149 IDs.

**Estado atual:** auditoria em andamento; revisar RPCs invoker, ACLs efetivas remotas e superfície de descoberta de UUID continua pendente.


### Ciclo 159 — políticas finais de leitura do Storage

- Reconstruí a sequência local de migrations do bucket `business-logos`: bucket privado, leitura inicial de imagens públicas, liberação temporária anon/authenticated para paths visuais e hardening final. A política final mantém leitura anônima somente de logos legados; leitura de paths visuais (incluindo `staging/<uuid>/...`) é para `authenticated` e valida apenas bucket/formato, sem membership/publicação.
- Confirmei que SEC-013 já registra essa exposição potencial, o contexto de staging e a incerteza de objetos existentes. Nenhum novo ID; nenhuma policy remota foi consultada e nenhum objeto foi listado ou baixado.
- Revisão somente de migrations e documentação local; sem Supabase CLI, conexão, processo Node, teste ou alteração de dados. Inventário permanece em 149 IDs.

**Estado atual:** auditoria em andamento; SEC-013 depende de verificação da chain aplicada e dos objetos existentes no remoto. Revisar RPCs invoker, ACLs remotas e superfície de descoberta de UUID continua pendente.
### Ciclo 160 — ACLs das RPCs `SECURITY INVOKER`

- Revisei as funções invoker definidas nas migrations: `replace_professional_services` é executável por `authenticated` e valida ownership, vínculo do profissional e pertencimento dos serviços; as RPCs de claim Pix e ledger/saque revogam `PUBLIC`, `anon` e `authenticated` e concedem `EXECUTE` somente a `service_role`. Os helpers de parsing de Storage têm grants direcionados para as roles que suas policies/clientes exigem.
- A revisão estática não encontrou RPC invoker transacional com grant aberto. A chamada direta autenticada de `has_role`, `is_business_member` e `has_business_permission` ainda pode responder boolean para IDs/valores fornecidos; sem superfície/impacto de enumeração confirmado, mantive como lacuna de validação já registrada em `seguranca.md`, sem novo ID.
- Evidência limitada à chain local e aos call sites encontrados; não comprova ACL efetiva remota. Nenhum Node, teste, SQL, conexão Supabase ou dado alterado. Inventário permanece em 149 IDs.

**Estado atual:** auditoria em andamento; conferir grants efetivos no projeto e testar autorização em ambiente descartável segue pendente. A revisão integral de handlers e demais módulos também permanece parcial.
### Ciclo 161 — autorização e consistência das Server Functions de assinatura

- Releitura cruzada de `subscription.functions.ts`, `subscription-charge.functions.ts`, migrations da tabela `subscription_charges` e achados PAY existentes. `getBillingCycle` autoriza owner/Master após ler business sob client de sessão; `getSubscriptionChargeStatus` usa client de sessão e RLS owner-only local; criar cobrança e salvar CPF checam owner/Master antes de usar service role; operações de cupom exigem Master.
- Confirmei que os riscos encontrados neste conjunto já estão no índice: cobrança externa anterior ao insert local (PAY-018), múltiplos Pix pendentes (PAY-017), erro da contagem de profissionais tratado como zero (PAY-025), erro do histórico tratado como vazio (PAY-026), e evento `transaction.failed` sem transição da cobrança (PAY-016). Não identifiquei novo bypass de autorização ou exposição além desses achados.
- Evidência restrita a source e migrations locais; policy efetiva remota, cobranças atuais e logs não foram consultados. Sem Node, testes, provider, banco, cobrança ou alteração de dados. IDs únicos permanecem em 149.

**Estado atual:** auditoria em andamento; ciclo de assinatura ainda requer validação em ambiente isolado e reconciliação com produção quando houver acesso somente de leitura; backend e pagamentos permanecem parciais.
### Ciclo 162 — cruzamento do expediente com disponibilidade pública

- Cruzei UI-007 (validação do formulário de funcionamento) com o schema `business_hours` e o algoritmo `computeSlots` usado por `getAvailability`/`reserveBooking`. Fechamento igual ou anterior à abertura persiste na chain local e a iteração de slots retorna vazio; não existe semântica overnight no cálculo atual.
- Registrei a consequência em `agendamentos.md` referenciando UI-007, sem duplicar finding. O efeito operacional depende de configuração desse tipo; não consultei negócios reais.
- Leitura estática somente. Sem UI/app, Node, teste, banco, reserva ou alteração de estado. Inventário permanece em 149 IDs.

**Estado atual:** auditoria de agendamentos continua parcial; timezone/limites, falhas de leitura, concorrência e ciclo de sinal têm achados/questões separados e ainda requerem cobertura e validação isolada.
### Ciclo 163 — corrida entre cancelar sinal e confirmação do webhook

- Segui a jornada de cancelamento manual do Pix de sinal até `expireLocalCharge` e a UI. O UPDATE de expiração é condicional e retorna boolean; `cancelPendingDeposit` ignora `false` e retorna `expirado`. Em paralelo, `confirmDepositPayment` atualiza `pendente → pago`, credita e confirma o appointment sem compartilhar o claim de cancelamento. A UI fecha com “Agendamento cancelado” para qualquer sucesso da Server Function.
- Registrei BOOK-013 P2 potencial: se a confirmação vencer a corrida, estado final pode permanecer pago/confirmado enquanto o cliente vê cancelamento concluído. Testes existentes cobrem cancelamento sequencial e claim ocupado, não esse interleaving. A reprodução segura foi descrita em harness fake, mas não executada.
- Atualizei `agendamentos.md`, o índice `problemas.md` e `riscos.md`. Contagem do inventário: 150 IDs únicos; sem duplicidade de BOOK-001, que trata reserva não retida e pagamento sem vaga.
- Somente leitura estática e documentação de auditoria. Sem Node, testes, servidor, banco, provider, cobrança ou mensagem real.

**Estado atual:** auditoria em andamento; confirmar e cobrir a concorrência exige reprodução isolada futura. Produção e ordem real de webhooks permanecem desconhecidas.
### Ciclo 164 — recuperação do Pix ao fechar o modal

- Segui `PaymentDialog.onClose` até o histórico da rota pública. Fechar o modal limpa apenas `activeCharge` e refaz a consulta; `chargeId` continua na lista de `localStorage`, `getMyBookings` retorna a cobrança pendente e `EleganceHistoryList` mostra “Pagar sinal” para reabrir o modal.
- Resultado: não confirmei perda de cobrança/QR por fechar o modal quando `localStorage` funciona. A falha de persistência antes de ativar o Pix continua coberta por UI-023; não criei outro ID.
- Só leitura estática; sem navegador, Node, teste, cobrança, mensagem ou alteração de estado. Inventário permanece em 150 IDs únicos.

**Estado atual:** auditoria em andamento; UI-023 condiciona recuperação à persistência local e deve continuar explícita no diagnóstico. Revisão integral de jornadas públicas e armazenamento em dispositivos ainda não concluída.
### Ciclo 165 — contrato do webhook Evolution

- Confrontei `evolution.server.ts` e o parser multi-formato com documentação, DTO e tipos oficiais Evolution. O evento `MESSAGES_UPSERT` e `webhook.headers` estão previstos; o payload padrão com `event`, `instance`, `data.key.remoteJid/fromMe` e `data.message` é reconhecido pelo parser local.
- Diferenciei duas questões existentes: INT-011 trata incompatibilidade do envelope UazAPI; INT-002 cobre remetentes LID/`remoteJidAlt` não resolvidos. Não identifiquei achado novo de compatibilidade para o formato Evolution padrão. Versão/provedor efetivos seguem inconclusivos.
- Registrei a comparação e fontes oficiais em `integracoes.md`. Consulta somente de documentação pública e source local; nenhum endpoint/provider, mensagem real, Node ou teste. Inventário permanece em 150 IDs únicos.

**Estado atual:** auditoria de integrações continua parcial; a compatibilidade de produção requer identificar a versão/provider configurados e conferir logs/eventos redigidos com leitura autorizada.
### Ciclo 166 — snapshot consolidado e reconciliação de cobertura

- Reconciliei o índice de `problemas.md`: 150 linhas de achados/risco/cobertura, 150 IDs únicos. O inventário não equivale a 150 defeitos confirmados; várias entradas são riscos potenciais ou lacunas P1 de produção/cobertura.
- Atualizei a linha de estado atual da tabela de módulos e criei `relatorio-consolidado.md`, com prioridades P1 separadas por confirmação/condicional/lacuna, cobertura de todos os módulos, limitações e próximos passos. O relatório está marcado como parcial e não substitui a conclusão da auditoria.
- Nenhuma correção de código/dados, operação externa ou processo Node/teste iniciado. Arquivos escritos somente em `docs/auditoria-agenda-agora/`.

**Estado atual:** auditoria permanece aberta; a consolidação ainda depende da revisão restante e das lacunas de produção listadas.

### Ciclo 167 — confirmação da exposição de Zod sem carga de teste

- Verifiquei estaticamente o lockfile e os handlers: `zod@3.25.76` é dependência raiz, e três arrays sem `.max()` chegam a Server Functions POST que exigem sessão. Confrontei a faixa afetada e as condições descritas na advisory oficial; refinei DEP-001 para manter separado o que está confirmado (dependência/schema server-side) do que permanece condicional (exploração/autorização efetiva/limites externos e versão implantada).
- Não enviei payload, não instalei dependências, não rodei Node, servidor ou teste. Nenhum ID novo; inventário permanece em 150 IDs únicos. Escritas limitadas a `seguranca.md` e este checkpoint.

**Estado atual:** DEP-001 tem escopo mais preciso, mas não é achado de exploração confirmada. O restante da auditoria segue parcial e a validação de produção continua pendente.

### Ciclo 168 — autorização e validação dos templates de contato

- Revisei a família de Server Functions que lista templates para equipe, altera designs globais ou overrides por negócio e lê/salva templates de confirmação, lembretes e saudação. Confirmei as guardas de sessão, membership, ownership e superadmin, além dos limites principais de entrada.
- Confirmei que a falta local da coluna `saudacao_template` produz retorno parcial explícito e aviso visível na UI. Nenhum achado novo nesta amostra; não confundi a rota de configuração com a fila de entrega de lembretes, que permanece coberta separadamente em INT-006.
- Apenas leitura estática. Sem Node, teste, banco ou mensagem; sem novo ID. Registrei a cobertura em `backend.md`.

**Estado atual:** uma família adicional de funções foi revisada sem nova falha confirmada; endpoints e jobs restantes ainda não foram cobertos integralmente.

### Ciclo 169 — confronto com inspeção de produção WhatsApp e crons

- Integrei ao relatório o registro de inspeção somente leitura de 13/11/2026 mantido em `C:\Users\Felps\segundo-cerebro\clientes\agenda-agora.md:485-490`. Ele confirma 72/72 chamadas horárias de lembretes e 4.319 chamadas do cron AgPay com HTTP 401 em 72h por `AGENDA_CRON_SECRET` divergente; as duas rotas locais retornam antes dos workers. Registrei DEP-007, sem inferir volume de fila ou pagamento perdido.
- Atualizei INT-007: app usava Evolution e as duas instâncias estavam desconectadas na observação; uma sem webhook e a outra caiu após atividade de mensagens. O parser `@lid` já é INT-002 e não foi correlacionado a mensagem específica. O relato anterior às 21:02 não foi atribuído à desconexão posterior.
- O conector Supabase disponível não lista o projeto alvo; portanto não pude verificar fila, estado financeiro, correspondência das instâncias com negócios ou o caso dos quatro splits. Nenhuma chamada ao serviço foi feita neste ciclo. Inventário: 151 IDs únicos.

**Estado atual:** agora há falha operacional de cron confirmada e snapshot de desconexão Evolution, mas efeitos por transação/negócio e estado atual posterior continuam pendentes; auditoria permanece parcial.

### Ciclo 170 — consulta do `.env` e revalidação dos quatro negócios

- Usei GET read-only no Data API com credencial carregada em memória do `.env`; projeto ID e host da URL coincidem com `qagotnmdqjoodoudcikd` e a chave é `service_role`. Nenhum valor de segredo foi exibido. A resposta paginada confirmou 4 negócios (Content-Range `0-3/4`), todos ativos, split `pendente`, email de split nulo e comissão 0%.
- Para esses quatro business IDs, a consulta completa encontrou 10 `deposit_payments`: 6 pendentes, 4 expirados e 0 pagos; `ledger_entries` retornou zero linhas. Nenhum nome, UUID, email ou montante individual foi exibido. Nenhum dado foi alterado e nenhum endpoint de gateway foi chamado.
- Comparei com specs: spec 004 diz que cobrança recebe na plataforma e saque posterior, dispensando e-mail/split por negócio; spec 005 registra comissão percentual de 0% como baseline, mas também taxa fixa de R$ 0,25, ainda divergente do cálculo local em PAY-015. Assim, os campos pendentes não mostram falha de repasse atual e nenhuma perda de comissão foi observada nesses depósitos; dashboard AgPay e política atual da taxa fixa continuam pendentes.
- Atualizei PAY-002/PAY-003, `pagamentos.md`, índice, riscos e relatório consolidado. Não criei ID novo; inventário segue em 151 IDs únicos.

**Estado atual:** o relato dos quatro cadastros foi confirmado e contextualizado como campo legado; faltam dashboard AgPay, fila afetada pelos 401, vigência da taxa fixa e o restante da auditoria.

### 2026-11-14 — PAY-029

- Root cause revalidada: o refund creditava/congelava e debitava o líquido no ledger, mas deixava `deposit_payments` como `pago`; relatórios e conciliação liam estado/paid_at inconsistente.
- Correção local: persistir `estornado` + provider status após o débito; retorno de completed atrasado não regride o estado. Performance e dossiê separam volume bruto, estorno e líquido; comissão/taxa histórica é preservada pois somente o líquido é debitado.
- Evidência: cinco arquivos focados, 77/77; `npx tsc --noEmit` passou; `git diff --check` sem erros.
- Limites: sem dados/ações remotas, sem migration/deploy/push/commit. Semântica oficial do evento segue inconclusiva (PAY-007).
- Contagem atual: 68 corrigidos localmente, 7 bloqueados/não verificados, 76 pendentes de 151. Continuar em ordem P2.


### 2026-11-14 - UI-001

- Removed card option, sensitive fields, and CTA without hosted checkout; PIX and coupon remain.
- Selector RED/GREEN; selector plus PIX regression: 2/2. TypeScript and diff check passed.
- No charge, migration, deploy, push, or commit.
- Current count: 69 fixed locally, 7 blocked/unverified, 75 pending of 151.


### 2026-11-14 - UI-002

- Revalidated the route wiring and the `filterTransactionRows` utility; selected type/status affect rows, Apply and Clear reset pagination.
- `npm test -- src/lib/transactions-filter.test.ts`: 2/2 passed. Covers type/status, search, and clearing.
- No production data or browser session used.
- Current count: 70 fixed locally, 7 blocked/unverified, 74 pending of 151.


### 2026-11-14 - UI-003

- The report card now shows an explicit unavailable state (disabled, "em breve", aria-disabled); removed the success toast.
- Component tests: 2/2. TypeScript and diff check passed.
- Report scope remains undocumented; no report data or external service was accessed.
- Count: 71 fixed locally, 7 blocked/unverified, 73 pending of 151.


### UI-004 revalidated (2026-11-14)

The current server mutation already sets `businesses.status` to `ativo` and clears `cancel_requested_at`/`cancelled_at`; `lifecycle.cancellation.test.ts` confirms the exact patch. `access_until` remains unchanged and continues to govern plan access. Updated the master success message so reverting cancellation does not claim that paid access was restored. Feedback tests plus cancellation mutation tests: 4/4; TypeScript and diff check passed. This UI message change does not add a new finding to the count. Total remains 71 fixed, 7 blocked/unverified, 73 pending of 151.


### UI-013 revalidated (2026-11-14)

Current route gates KPIs/calendar on `receivablesViewState`; loading renders progress, query failure renders an alert with retry, and valid empty data reaches zero-valued metrics. Focused tests: 3/3. No remote data or browser session. Already included in the 71 local fixes.


### UI-014 revalidated (2026-11-14)

Current report query passes all three dataset results through `requireReportDatasets`; any source error rejects the query, and the route renders loading/error with retry while hiding metrics until data is valid. Valid empty arrays remain accepted. Focused tests: 5/5. No remote data or browser session. Already counted among 71 local fixes.


### UI-023 revalidated (2026-11-14)

`saveCharge` now uses `appendRecoveryId`, which catches storage acquisition/read/write failures and returns an updated in-memory ID list. The mutation then continues to set the reserved amount and active charge and opens history/Pix. `savePublicCode` also catches Storage errors. Focused storage tests: 2/2. No real booking, charge, or provider call. Already counted among 71 local fixes.


### UI-017 revalidated (2026-11-14)

Both support list and thread now derive loading/error/ready from `supportQueryState`; error takes precedence even when cached data exists, and the UI exposes retry while preventing failure from appearing as valid empty results. New state tests plus existing support tests: 4/4. TypeScript and diff check passed. No real support records or external service accessed. Already counted among 71 fixes.


### PAY-017 revalidated and still blocked (2026-11-14)

Current server code creates a fresh AgPay Pix before inserting another `pending` row and does not inspect open charges. The UI `start()` opens the dialog and starts a new mutation whenever saved CPF exists; closing does not cancel the provider charge. Focused tests pass 13/13 but do not cover duplicate provider IDs/cycle reuse. Safe correction still requires a defined cycle key, expiry/pending recovery policy for provider timeout/crash, and late-payment handling. No code, provider, or database changes. Count unchanged: 71 fixed, 7 blocked/unverified, 73 pending of 151.


### PAY-032 revalidated and still blocked (2026-11-14)

After an AgPay response, the first database update stores `provider_ref`; if it fails, the catch writes only generic `processing` status and returns success with the original row. The webhook matches only by `provider_ref`. `withdrawal.server.test.ts` passes 36/36, but no supported provider lookup/idempotency/reconciliation contract is documented. Do not retry or correlate by amount/key/time. No cashout, provider call, database write, or code fix. Count unchanged: 71 fixed, 7 blocked/unverified, 73 pending of 151.


### SEC-006 revalidated (2026-11-14)

`assertSuperAdmin` now requires both JWT claim `aal2` and a current `super_admin` role lookup before returning the admin client. The MFA flow challenges a verified TOTP factor and confirms current assurance reached `aal2`. Focused tests: 15/15. Production MFA configuration and enrolled accounts were not inspected. Already counted among 71 local fixes.


### 2026-11-14 - UI-030

The rejected-charge KPI now shows an em dash and "Metric unavailable" instead of a fabricated zero. No source/window or live data was assumed. Focused tests 4/4; TypeScript and diff check passed. Count 72/7/72 of 151.


### UI-031/UI-032/UI-034 revalidated (2026-11-14)

Receivables now uses local month boundaries for the monthly KPI, computes the visible week from the selected cursor, and shares the 120-day history limit between the server query and a visible notice that older periods may be incomplete. Focused date/calendar/history tests: 4/4. No production buckets or remote data inspected. These items were already counted among local fixes; total remains 72/7/72 of 151.


### 2026-11-14 - UI-033

Renamed the all-open-requests aggregate to "Pedidos de cancelamento em aberto", kept the associated monthly amount, and removed the unsupported 30-day forecast and percentage. Metric + state tests 5/5; TypeScript and diff check passed. No policy or live data inferred. Count 73/7/71 of 151.


### UI-037 fixed locally (2026-11-14)

Added an owner-scoped "Suas artes para editar" section to Templates. It lists active visual outreach templates with their effective business design and opens the selected template at `/editor-template/<id>`; the server list function validates business ownership. The existing editor then loads preview and layer controls. Focused component + server-function tests: 5/5; `npx tsc --noEmit` and `git diff --check` passed. No live business or database changes. Count: 74 fixed, 7 blocked/unverified, 70 pending of 151.


### PAY-014 official documentation lookup (2026-11-14)

Rechecked the integration host `agpay.services` and searched for its public webhook contract. The host and common documentation paths were inaccessible to the web reader, and searches returned no official payload specification. Other processors' `amount` conventions do not establish this provider's unit. Local handler still discards the webhook amount; no patch applied. Keep blocked pending the AgPay contract and the spec-required manual review/quarantine flow.

### DEP-004 fixed locally (2026-11-14)

Root cause was confirmed in `ops/vps/deploy-release.sh`: after switching `/opt/agenda-agora/current`, restart or health-check failures exited without restoring the prior release. Added an EXIT rollback handler that restores the previous symlink (or removes the new link if there was no previous target) and attempts to restart the service. Added `ops/vps/deploy-release.test.sh`, which uses temporary directories and command shims; RED reproduced the missing rollback, GREEN passed for health-check failure, service restart failure, and healthy deployment. `bash -n` passed for both scripts; `npx tsc --noEmit` and `git diff --check` passed. No deploy or host/service operation was run. Count: 75 fixed locally, 7 blocked/unverified, 69 pending of 151.

### UI-016 corrigido localmente (2026-11-14)

A tela confundia erro/carregamento da consulta de profissionais com lista vazia e iniciava o escopo como global; em negócios com múltiplos profissionais, isso permitia criar bloqueio para todos sem escolha explícita. Agora erro mostra retry e erro/carregamento bloqueiam a submissão; com mais de um profissional o owner precisa escolher “Todos” ou um profissional. Consulta válida com zero ou um profissional mantém o escopo global compatível. Testes do helper de escopo e da Server Function: 6/6; `npx tsc --noEmit` e `git diff --check` passaram. Sem bloqueio salvo em dados reais. Contagem: 76 corrigidos localmente, 7 bloqueados/não verificados, 68 pendentes dos 151.

### UI-007 corrigido localmente (2026-11-14)

O formulário de funcionamento agora rejeita horário inválido e `fim <= início`, mostra o erro junto aos campos e desabilita Salvar. Migration aditiva `20261115010000_business_hours_end_after_start.sql` impõe `CHECK (ends_at > starts_at) NOT VALID` para novas escritas, sem validar ou alterar linhas antigas; intervalo overnight segue fora do modelo diário documentado. Testes unitários: 2/2; DB isolado: 3/3; TypeScript, diff check, `npm test` (115 arquivos, 988 aprovados/8 ignorados) e `npm run test:db` (85/85) passaram. Migration não foi aplicada remotamente. Contagem: 77 corrigidos localmente, 7 bloqueados/não verificados, 67 pendentes de 151.
### Regressão da suíte geral — 2026-11-14

A primeira suíte completa após as mudanças locais encontrou 19 falhas em cinco arquivos: fixtures Master ainda usavam AAL1/claims vazias após a guarda exigir AAL2, e `sdr.login.test.ts` ainda esperava migração automática de hash legado embora o fluxo atual exija redefinição. Os fixtures agora representam AAL2 e hash scrypt; foi mantido teste de rejeição de hash legado sem migração. Os cinco arquivos passaram (40/40); suíte final passou com 115 arquivos, 988 aprovados e 8 ignorados. Nenhuma regra de produção foi afrouxada para fazer os testes passar.

### UI-019 corrigido localmente (2026-11-14)

A tela tratava `data ?? []` como uma contagem confirmada: erro de query indicava “1º profissional grátis” e liberava cadastro. Agora estados de loading e erro não mostram preço estimado e desabilitam a ação; erro oferece retry. Só uma lista carregada permite derivar gratuidade, custo adicional e limite de dez. Teste do estado de contagem: 3/3; `npx tsc --noEmit` e `git diff --check` passaram. Nenhum profissional foi criado e regra de cobrança não foi alterada. Contagem: 78 corrigidos localmente, 7 bloqueados/não verificados e 66 pendentes de 151.

### UI-010 corrigido localmente (2026-11-14)

O editor de aparência agora aguarda configuração e perfil do negócio antes de expor controles. Loading fica explícito; falha sem dados mostra erro e retry para ambas as queries. Uma falha de refetch com dados previamente carregados preserva o editor e não desmonta o rascunho. Testes do gate: 4/4; `npx tsc --noEmit`, `git diff --check` e regressão completa passaram: 117 arquivos, 995 testes aprovados, 8 ignorados. Não houve escrita no negócio nem acesso ao Storage remoto. Contagem: 79 corrigidos localmente, 7 bloqueados/não verificados, 65 pendentes dos 151.

### UI-009 corrigido localmente (2026-11-14)

O editor agora conclui `saveFn` e `updateProfileFn` antes de limpar paths antigos de logo/fundo. Qualquer falha de persistência impede a limpeza; falha ao remover depois de persistir só deixa asset órfão e é registrada, sem reverter a publicação. Teste da sequência: persistência precede limpeza e, em erro, cleanup não é chamado (2/2). `npx tsc --noEmit`, `git diff --check` e regressão completa passaram: 118 arquivos, 997 aprovados/8 ignorados. Nenhum upload ou remoção real no Storage. Contagem: 80 corrigidos localmente, 7 bloqueados/não verificados, 64 pendentes de 151.

### UI-009 corrigido localmente (2026-11-14)

O editor agora conclui `saveFn` e `updateProfileFn` antes de limpar paths antigos de logo/fundo. Qualquer falha de persistência impede a limpeza; falha ao remover depois de persistir só deixa asset órfão e é registrada, sem reverter a publicação. Teste da sequência: persistência precede limpeza e, em erro, cleanup não é chamado (2/2). `npx tsc --noEmit`, `git diff --check` e regressão completa passaram: 118 arquivos, 997 aprovados/8 ignorados. Nenhum upload ou remoção real no Storage. Contagem: 80 corrigidos localmente, 7 bloqueados/não verificados, 64 pendentes de 151.

### API-007 corrigido localmente (2026-11-14)

Removido o retry que, diante de colunas de audiencia ausentes, gravava somente titulo e mensagem; a leitura interpreta audiencia ausente como todos. A insercao agora falha com o erro de schema e nao grava aviso parcial. Teste de regressao reproduz falha seguida de retry que seria aceito: 1/1; TypeScript e diff check passaram; npm test: 119 arquivos aprovados, 3 ignorados; 998 testes aprovados, 8 ignorados. Nenhum aviso foi criado em ambiente remoto; schema de producao nao foi consultado. Contagem: 81 corrigidos localmente, 7 bloqueados/nao verificados, 63 pendentes de 151.
### API-008 validado localmente (2026-11-14)

A gravação de status já usa compare-and-set (`UPDATE ... WHERE id = ? AND status = status_lido`) e retorna erro quando outra operação mudou o status após a autorização. Adicionado teste de concorrência com status neutro para provar que uma corrida não reativa agendamento cancelado. Teste focado 1/1; TypeScript passou; regressão completa: 120 arquivos passaram, 3 ignorados; 999 testes passaram, 8 ignorados. Contagem: 82 corrigidos/validados localmente, 7 bloqueados/não verificados, 62 pendentes de 151. Nenhuma operação remota.
### UI-023 validado corrigido localmente (2026-11-14)

A falha de `localStorage` durante a reserva com sinal agora retorna IDs atualizados em memória, mostra aviso de persistência e não interrompe a configuração do Pix/histórico; a lista de códigos públicos também permanece em memória mesmo se a gravação falhar. Testes de storage indisponível/leitura falha: 2/2. TypeScript e suíte completa recentes passaram: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. Limitação: sem Storage local funcional, a recuperação após recarregar a página não é persistida. Nenhuma cobrança real. Contagem: 83 corrigidos/validados localmente, 7 bloqueados/não verificados, 61 pendentes de 151.
### BOOK-010 validado corrigido localmente (2026-11-14)

`getOpenDays` agora propaga falhas nas leituras de negócio e expediente, distinguindo indisponibilidade do banco de uma agenda sem dias abertos. Testes injetando erro nas duas fontes: arquivo `booking.functions.test.ts` passou 117/117. TypeScript e regressão completa recentes passaram: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. Nenhuma consulta remota. Contagem: 84 corrigidos/validados localmente, 7 bloqueados/não verificados, 60 pendentes de 151.
### BOOK-012 validado corrigido localmente (2026-11-14)

O schema compartilhado `civilDateSchema` agora exige forma `YYYY-MM-DD` e round-trip real no calendário gregoriano; criação, disponibilidade e remarcação usam essa validação antes das consultas/escritas. Teste `booking.functions.test.ts` inclui datas válidas e impossíveis; arquivo passou 117/117. TypeScript e regressão completa recentes passaram: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. Contagem: 85 corrigidos/validados localmente, 7 bloqueados/não verificados, 59 pendentes de 151.
### UI-017 validado corrigido localmente (2026-11-14)

A central Master distingue loading, erro, lista vazia válida e conteúdo carregado para lista e thread; falhas exibem retry e não parecem ausência de conversas. Teste dos estados: 2/2; TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Consultas remotas não foram executadas. Contagem: 86 corrigidos/validados localmente, 7 bloqueados/não verificados, 58 pendentes de 151.
### UI-035 validado corrigido localmente (2026-11-14)

O eixo e o tooltip agora interpretam `YYYY-MM-DD` como data civil via `parseCivilDate`, sem converter a chave UTC para meia-noite local e recuar um dia. Teste sob `America/Fortaleza` confirma que a chave `2026-11-13` continua no dia 13. Focal 1/1; TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Política de agregação UTC vs. fuso do negócio continua não documentada; esta correção alinha a etiqueta à chave retornada. Contagem: 87 corrigidos/validados localmente, 7 bloqueados/não verificados, 57 pendentes de 151.
### UI-025 validado corrigido localmente (2026-11-14)

A confirmação de saque combina lock síncrono antes da verificação do PIN e botão desabilitado durante verificação/saque; o lock é liberado em sucesso ou erro. Isso impede dois cliques de gerar intenções/UUIDs distintos enquanto a primeira submissão está pendente. Testes do lock: 2/2. TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Nenhum saque real. Contagem: 88 corrigidos/validados localmente, 7 bloqueados/não verificados, 56 pendentes de 151.
### UI-026/UI-027 validados corrigidos localmente (2026-11-14)

UI-026: aprovação Pix separa loading, erro com retry, fila vazia válida e fila pendente. UI-027: telas Master de assinantes, testes e atenção distinguem erro/loading de sucesso; MRR mostra indisponível, contadores usam travessão e estados vazios só aparecem com resposta válida. Testes dos estados: 7/7; TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Sem leitura remota. Contagem: 90 corrigidos/validados localmente, 7 bloqueados/não verificados, 54 pendentes de 151.

### UI-006 corrigido localmente (2026-11-15)

A consulta de appointments inclui `status`; a lista de clientes continua considerando reservas para identificar pessoas, mas `lastAppointmentAt`, contagem mensal e série diária consideram apenas `concluido`, alinhados à spec 001 e a `report-metrics.ts`. Teste focal: 2/2; TypeScript aprovado; suíte completa: 128 arquivos aprovados, 3 ignorados, 1.020 testes aprovados e 8 ignorados. Sem acesso remoto. Contagem: 104 corrigidos, 10 bloqueados/não verificados, 37 pendentes de 151.

### UI-018 corrigido localmente (2026-11-15)

O chat Master passa `mutateAsync` e só limpa o rascunho após confirmação; rejeição mantém o conteúdo. A limpeza compara o texto atual com o submetido para não apagar uma edição nova durante a espera. Teste focal 2/2; TypeScript passou; regressão completa 129 arquivos aprovados, 3 ignorados, 1.022 testes aprovados e 8 ignorados. Nenhuma resposta real enviada. Contagem: 105 corrigidos, 10 bloqueados, 36 pendentes de 151.

### UI-008 corrigido localmente (2026-11-15)

A leitura de `service_categories` propaga falhas; a interface diferencia carregamento, erro com retry e vazio após resposta válida, mantendo dados em cache e bloqueando a criação durante erro. Testes de estado: 3/3; encoding: 1/1; TypeScript e diff check aprovados; regressão completa: 130 arquivos aprovados, 3 ignorados, 1.025 testes aprovados e 8 ignorados. Atomicidade de gravação permanece em API-006. Contagem: 106 corrigidos, 10 bloqueados, 35 pendentes de 151.

### UI-020 corrigido localmente (2026-11-15)

Handlers de remoção de serviço e cliente mostram erro e preservam a confirmação quando DELETE falha; sucesso fecha só a confirmação do ID removido. Teste 3/3; TypeScript aprovado; regressão completa 131 arquivos/1.028 testes aprovados, 3 arquivos/8 testes ignorados. Sem exclusões remotas. Contagem: 107 corrigidos, 10 bloqueados, 34 pendentes de 151.

### UI-021 corrigido localmente (2026-11-15)

Lista de clientes só mostra vazio após sucesso das queries de clientes e visitas; loading/erro têm aviso e retry conjunto. Teste 3/3; TypeScript/diff check aprovados; regressão completa: 132 arquivos aprovados, 3 ignorados, 1.031 testes aprovados e 8 ignorados. Contagem: 108 corrigidos, 10 bloqueados, 33 pendentes de 151.

### UI-024 corrigido localmente (2026-11-15)

Gravação de taxas Master bloqueada em loading/erro da leitura; liberada somente após resposta válida e quando mutation não está pendente. Teste 2/2, TypeScript aprovado, suíte completa 133 arquivos/1.033 testes aprovados, 3 arquivos/8 testes ignorados. Nenhuma gravação remota. Contagem 109 corrigidos, 10 bloqueados, 32 pendentes de 151.

### UI-028 corrigido localmente (2026-11-15)

Tela de atenção separa fila global vazia de filtros sem correspondência e permite limpar busca/motivo; query loading/erro não gera estado vazio. Teste 4/4; TypeScript/diff check aprovados; regressão completa 134 arquivos/1.037 testes aprovados, 3 arquivos/8 testes ignorados. Contagem 110 corrigidos, 10 bloqueados, 31 pendentes de 151.

### UI-022 e DB-003 corrigidos localmente (2026-11-15)

UI-022: descrição do AppearanceEditor ajustada ao modelo único Elegance; teste 11/11. DB-003: JSDoc de `startEnsaio()` atualizado ao retorno implementado; `node --check` passou sem iniciar Postgres. TypeScript e regressão completa: 134 arquivos/1.037 testes aprovados, 3 arquivos/8 ignorados. Contagem: 112 corrigidos, 10 bloqueados, 29 pendentes de 151.

### DEP-003 revalidado e bloqueado (2026-11-15)

`npm audit`: 7 moderadas dev-only e zero vulnerabilidades com `--omit=dev`. Advisory do minimatch corrige em 11.0.1, fora da major 10 exigida pelo parser atual de `typescript-eslint`. Override não aplicado; package/lockfile já alterados por trabalho anterior foram preservados. Contagem 112 corrigidos, 11 bloqueados, 28 pendentes.

### API-005 bloqueado aguardando aprovação do desenho (2026-11-15)

Owner não consegue semear greeting como master pela RLS; a falha é ignorada. O desenho proposto preserva a policy do owner e usa escrita server-only com validação de ownership/idempotência; gate da skill `brainstorming` aguardando resposta. Sem alteração de código, migration ou dado. Contagem 112 corrigidos, 12 bloqueados, 27 pendentes.

### 2026-11-15 — PAY-005 corrigido localmente

`agpayFetch` agora inclui `X-Client-ID` quando `AGPAY_CLIENT_ID` estiver configurado. A documentação oficial atual usa os dois headers nos exemplos de Pix. A credencial local retornou 200/success em GET `/transactions?limit=1` com e sem o header; corpo e dados não foram exibidos. RED/GREEN no teste de contrato; `src/lib/agpay.server.test.ts` 14/14; suíte 134 arquivos/1.038 testes aprovados, 3 arquivos/8 testes ignorados; `npx tsc --noEmit` passou; `git diff --check` sem erros (avisos LF/CRLF já existentes). POST sandbox/produção não verificados; sem pagamento, deploy, push ou commit. Contagem 113 corrigidos, 12 bloqueados, 26 pendentes de 151.
### Ciclo 78 — revalidação de API-006 (2026-11-15)

- Confirmado no código: a tela grava `services`, depois executa DELETE e INSERT separados em `service_professionals`; falha tardia pode persistir estado parcial.
- `replace_professional_services` é atômica somente para links de um profissional e não abrange o upsert de `services`. CRUD de categorias também persiste entidade e associação em chamadas separadas.
- Fix completo exige uma nova operação transacional no Postgres, migração aditiva, migração dos chamadores e teste de rollback em banco local descartável. Nenhuma migration, escrita no banco, produção ou serviço remoto foi executado nesta revalidação.
- Estado do API-006: causa confirmada, pendente de implementação/validação isolada. Não entra na contagem de corrigidos ou testados.

### Ciclo 79 — API-006 corrigido localmente (2026-11-15)

- Serviço e vínculos de profissionais agora são salvos pela RPC `save_service_with_professionals`; categoria e vínculos de serviço pela `save_service_category_with_services`. Ambas validam owner e negócio sob RLS.
- TDD no handler de serviço: RED em 2 assertions antes da implementação; GREEN 30/30 testes focais. Banco descartável: 6/6 testes dos dois fluxos, incluindo falhas após iniciar mudanças e confirmação do rollback. `npm test`: 134 arquivos/1.039 testes aprovados, 3 arquivos/8 testes ignorados. `npm run test:db`: 10 arquivos/99 testes. `npx tsc --noEmit` passou.
- Arquivos: migration `20261115060341_save_service_with_professionals.sql`, handler/testes, rota de serviços, componente de categorias, tipos gerados e dois testes DB.
- Migration não aplicada remotamente; nenhum deploy, pagamento, push, commit ou dado real. API-006 corrigido no código local, dependente de aplicação de migration no ciclo de release.
### Ciclo 80 — PAY-031 revalidado (2026-11-15)

A atualização de `agpay_access_blocked` agora propaga erro explícito após a aprovação da chave; a rota apresenta erro em vez de sucesso e permite ao operador reconhecer a conclusão parcial. `pix-approvals.functions.test.ts`: 2/2. A alternativa de feedback claro da expectativa foi validada; estado remoto não consultado ou alterado. A operação não é atômica; residual documentado.
### Ciclo 81 — PAY-014 corrigido localmente (2026-11-15)

- **Causa revalidada:** o worker e a sincronização por consulta confirmavam pagamentos `completed` sem comparar o valor bruto reportado pelo AgPay com `amount_cents`; a divergência contrariava a regra em `specs/005-ledger-financeiro-saldo/spec.md:147-149`.
- **Contrato verificado:** documentação pública oficial em `https://agpay.services/documentacao` apresenta `data.amount` em reais, inclusive no exemplo de webhook. O adaptador `fetchPayment` já retorna o campo `amount` da consulta de transação.
- **Correção:** webhook e consulta agora normalizam reais para centavos e comparam com depósitos e cobranças de assinatura antes de creditar ou renovar acesso. Valor divergente, inválido ou ausente impede a confirmação; webhook divergente é retido como `error`. Divergência encontrada na consulta cria evento `payment.amount_mismatch` em `agpay_webhook_events`. A tela Master de erros lista até 30 eventos `error` com motivo, tipo, referência, horário e tentativas, sem expor o payload.
- **TDD/evidências:** teste RED reproduziu confirmação automática com valor divergente antes da correção. Testes cobrem valor menor, valor ausente, assinatura divergente, assinatura compatível e consulta de status divergente; `agpay-events.server.test.ts` + `agpay-amount.test.ts`: 50/50. Privacidade de marca: 1/1. `npm test`: 135 arquivos aprovados, 3 ignorados; 1.057 testes aprovados, 8 ignorados. `npm run test:db`: 10 arquivos/99 testes aprovados. `npx tsc --noEmit` passou; `git diff --check` sem erros (avisos LF/CRLF preexistentes).
- **Limites:** contrato de valor em reais confirmado pela documentação, mas não houve chamada ao gateway nem validação de produção. Sem migração remota, dados reais, deploy, push ou commit. Revisão manual fica disponível na tela Master de erros para usuários Master.
- **Contagem dos 151 IDs:** PAY-014 passou de bloqueado para corrigido localmente: 114 corrigidos, 11 bloqueados/não verificados, 26 pendentes. API-006 continua como correção local adicional fora da lista compacta, sem alterar esse tally.
### Revalidação de BOOK-001 — 2026-11-15

A lacuna segue presente no código atual: `aguardando_sinal` permanece excluído dos filtros de conflito do booking e da exclusion constraint. O teste DB `business-only-appointment-overlap.test.ts` ainda aceita reservar o intervalo quando já existe uma reserva nesse status (4/4); `booking.functions.test.ts` passou 117/117, sem cobrir hold temporário. `specs/003-migracao-asaas-agpay/quickstart.md` exige preservar `cancelado` após um `deposit.completed` tardio, mas não define ação financeira/refundo para o pagamento tardio. A implementação de hold de 5 minutos exige alinhar a checagem de disponibilidade, proteção transacional e liberação após expiração; não mudei comportamento enquanto esse desenho e a política de pagamento tardio não forem aprovados. Nenhuma reserva ou pagamento foi criado.
### Revalidação de PAY-032/PAY-036 — 2026-11-15

A documentação oficial pública (`https://agpay.services/documentacao`) descreve `POST /cashout/pix` e um identificador `withdrawal.id` na resposta, mas não documenta chave idempotente, consulta de saque por essa referência ou garantias de que erro HTTP/timeout implique ausência de payout. Portanto PAY-032 segue aberto: a referência ainda é persistida após a chamada externa; sua perda em falha de escrita não tem recuperação oficial comprovada.

PAY-036 foi mitigado localmente: somente HTTP 422 e o marcador explícito `success:false` são classificados como rejeição definitiva; HTTP 5xx e HTTP 2xx incompleto mantêm o saque `processing` e o saldo reservado. Testes em `withdrawal.server.test.ts` cobrem 5xx e resposta 2xx sem referência, e `agpay.server.test.ts` cobre mapeamento; os dois arquivos passaram (50/50). Limite residual: não há contrato acessível que confirme se todo 422/`success:false` prova ausência de payout externo; nenhuma chamada de saque foi feita.
### Revalidação de acesso externo — 2026-11-15

Supabase: project listing do conector mostra somente outro projeto; chamada de advisors para `qagotnmdqjoodoudcikd` foi negada. GET ao endpoint REST público do projeto configurado com `select=id&limit=0` retornou HTTP 200 sem linhas. Não permite confirmar RLS, migrations, backup, logs ou dados; DB-002/SEC-002 permanecem inconclusivos. Painel AgPay/Evolution não foi aberto: `sky.list_apps()` falhou três vezes (incluindo após reset) com pipe nativo indisponível. Sem mutação remota.
### Ciclo 82 — reconciliação dos P2 financeiros (2026-11-15)

Revalidei PAY-010, PAY-013, PAY-016, PAY-019, PAY-022, PAY-023, PAY-025, PAY-026, PAY-028 e PAY-029 no código e atualizei o índice canônico `problemas.md` e os estados dos achados. Cobertura dirigida: AgPay events, performance, transações, lifecycle, hook de lifecycle, assinatura e charges — 7 arquivos/86 testes aprovados. `npm test` completo no ciclo 81 passou com 1.057/8 ignorados; DB completo 99/99. Esses dez itens já constavam entre os corrigidos locais e não alteram o tally 114/11/26. Nenhum cron, webhook, cobrança, DB remoto ou saldo foi acionado.
### PAY-020 corrigido localmente — 2026-11-15

A coluna que renderiza `netCents` foi renomeada de “Lucro Ag Pay” para “Valor líquido”. A fórmula e o saldo continuam iguais; a UI não atribui lucro da plataforma ao valor líquido do recebedor. TDD: teste SSR falhou com o título antigo e passou com o novo. Focal 3/3; TypeScript passou; `npm test`: 136 arquivos aprovados, 3 ignorados; 1.058 testes aprovados, 8 ignorados; `git diff --check` sem erros (avisos LF/CRLF preexistentes). Sem escrita remota ou financeira. Contagem dos 151 IDs: 115 corrigidos, 11 bloqueados/não verificados e 25 pendentes; API-006 segue adicional fora do tally.
### Ciclo 83 — reconciliação BOOK/UI P2 — 2026-11-15

Revalidei e atualizei o índice de BOOK-002/003/005/006/007/010/012/013 e UI-002/007/009/010/016/019/021/028/037 com correções locais documentadas nas fichas. Suíte geral recente: 136 arquivos passaram, 3 ignorados; 1.058 testes passaram, 8 ignorados. DB: 10 arquivos/99 testes. TypeScript e diff check passaram no ciclo. Migrations apenas locais; sem escrita de agenda/Storage em produção, deploy ou publicação. Os itens já estavam no conjunto de corrigidos; tally 115/11/25 inalterado.
### Ciclo 84 — revalidação de INT-001/002/005/006/008 (2026-11-15)

O código local usa cooldown de saudação de 30 min, extrai `remoteJidAlt`, e trata falhas de reminders e fila pós-atendimento com claim/retry recuperável. Atualizei o índice canônico e os estados do relatório de integrações. Regressão geral: 136 arquivos/1.058 testes aprovados, 3 arquivos/8 testes ignorados; DB 10 arquivos/99 testes; TypeScript aprovado. Nenhuma mensagem ou alteração de instância remota foi enviada; produção e payloads da instalação ativa continuam sem validação.
### Ciclo 85 — reconciliação UI/Admin P2 — 2026-11-15

Índice atualizado para UI-003/004/013/014/030/033 e ADM-001/002/003/API-004 conforme correções locais já registradas no histórico. `npm test` corrente: 136 arquivos/1.058 testes aprovados, 3/8 ignorados; TypeScript e `git diff --check` passaram. Policies remotas, produção e uso real não foram alterados ou confirmados. Tally permanece 115/11/25.
### Ciclo 86 — DB-004 integridade tenant do ledger (2026-11-15)

RED no Postgres efêmero confirmou associação cruzada de pagamentos/saques sob service_role. Migration local adiciona triggers que validam o business das referências e impedem alteração posterior do tenant da linha referenciada; extrato também aplica business_id nas consultas de detalhes. Testes DB 13 arquivos/107 testes, suíte geral 137 arquivos/1.071 aprovados/8 ignorados, TypeScript aprovado. Migration remota e registros legados não verificados. Contagem 122/17/12.

### Ciclo 87 — BOOK-001 hold local para sinal (2026-11-15)

TDD RED reproduziu duas sobreposições em hold aguardando_sinal aceitas pelo Postgres, com e sem profissional. Código e migration local agora mantêm o hold ocupado até reconciliação/cancelamento; as constraints rejeitam sobreposição concorrente. DB 13/108, booking 117/117, suíte geral 137/1.071 aprovados/8 ignorados, TypeScript aprovado. Migration/worker remotos não verificados. Pagamento tardio ainda pode virar pago_sem_agendamento; política operacional/financeira segue bloqueadora. Tally 122/17/12.

### Ciclo 88 — revalidação UI-032 (2026-11-15)

A causa descrita no inventário não corresponde ao código atual: a grade chama calendarWeekDays(cursor) e os testes cobrem a semana do cursor. Teste 2/2 passou; sem QA visual ou alteração funcional. UI-032 já constava entre os corrigidos. Tally permanece 122/17/12.

### Ciclo 89 — PAY-030 escrita no histórico de assinatura (2026-11-15)

Revalidada migration local que remove CRUD owner em subscription_payments; teste DB confirmou owner read-only e escrita exclusiva service_role (54/54). Sem dados reais ou rollout remoto. PAY-030 corrigido localmente; tally 123/17/11.

### Revalidação SEC-012 — 2026-11-15

Migration local retira leitura anônima de time_blocks; suíte security-hardening 54/54 confirma anon permission denied e isolamento owner/outro owner. Sem dados reais ou rollout remoto. Item já contabilizado como corrigido; tally permanece 123/17/11.
Revalidação SEC-013 — 2026-11-15: migration local restringe assets publicados por membership e staging por permissão/uploader; teste security-hardening 54/54. Sem objects reais ou rollout remoto. Já contado; tally 123/17/11.

### Revalidação SEC-015 — 2026-11-15

Migration local já revoga DELETE de authenticated em businesses. Nova regressão confirma owner sem permissão e linha preservada; security-hardening 55/55. Sem alteração de negócio real nem rollout remoto. SEC-015 contabilizado como corrigido; tally 124/17/10.

### Revalidação BOOK-011 — 2026-11-15

A causa descrita no inventário não corresponde ao código atual: `toIso` encontra offsets candidatos e confere round-trip; horários locais inexistentes/ambíguos são rejeitados. Testes de DST e booking.functions.test.ts 117/117 passaram. Configurações reais não consultadas. BOOK-011 contabilizado como corrigido; tally 125/17/9.

Revalidação UI-034 — 2026-11-15: servidor e UI compartilham limite de 120 dias e o corte é informado; correção já estava na checklist. Dados históricos/produção não consultados. Tally 125/17/9 permanece.

Revalidação UI-031 — 2026-11-15: KPI de recebimentos usa mês local; fronteira UTC/Fortaleza passa (receivables-month.test.ts 1/1). Já contado como corrigido. Tally 125/17/9.

Reconciliação de índice (2026-11-15): atualizei os estados de PRO-001, SEC-008 e DEP-004 conforme correções e testes já registrados; DEP-005 permanece parcialmente mitigado até validar alertas/instalação. Nenhuma alteração funcional nesta reconciliação. Tally 125/17/9.

### Revalidação API-003 — 2026-11-15

`setAppointmentStatus` exige permissão granular para criar/reabrir status bloqueado e faz update condicional. Teste mapping 6/6 passou. Nenhuma policy/execução remota verificada. API-003 corrigido localmente; tally 126/17/8.


### SEC-024 — mitigado localmente (2026-11-15)

Adicionei X-Frame-Options: DENY e CSP frame-ancestors 'none' ao bloco comum do Caddy e aos headers globais do vercel.json. A CSP contém apenas a diretiva anti-framing, sem restringir scripts, estilos, conexões ou integrações. Regressão src/security-headers.test.ts passou 1/1 após falhar antes do fix. Não validei domínio ativo, proxy/CDN externo, browser ou deploy; estado remoto segue não verificado. Tally: 127 corrigidos/mitigados, 17 bloqueados/não verificados, 7 pendentes.
### PAY-017 — causa revalidada, correção bloqueada (2026-11-15)

Arquivos revisados: src/lib/subscription-charge.functions.ts, src/lib/agpay.server.ts, src/components/painel/SubscriptionPixPayment.tsx e migration subscription_charges. Confirmado que cada chamada gera POST antes do INSERT, sem consulta de pendência, chave idempotente enviada ao provedor ou persistência local de QR/expiração; reabrir o modal chama de novo. Uma exclusão única de pending não cobre crash/timeout após criação externa. Bloqueador: contrato AgPay de idempotência/reconciliação não confirmado e política de produto para expiração/pagamento tardio/IDs duplicados ausente. Sem mudança de código ou chamada real. Tally inalterado: 127 corrigidos/mitigados, 17 bloqueados/não verificados, 7 pendentes.
### PAY-006 — revalidação do limite local (2026-11-15)

Revisei a chamada de criação de PIX em src/lib/agpay.server.ts: o payload não inclui splits nem configuração de recebedores. Isso confirma somente o estado do adaptador local; as regras que o provedor aplica automaticamente no dashboard não estão no repo e não há conector AgPay disponível para inspeção nesta execução. Nenhuma configuração externa foi alterada ou consultada e nenhuma transação foi criada. O risco permanece inconclusivo até leitura somente de configuração no dashboard e reconciliação contratual, sem testar por pagamento real. Tally inalterado: 127 corrigidos/mitigados, 17 bloqueados/não verificados, 7 pendentes.
### BOOK-008 — revalidação do consumidor (2026-11-15)

A tela src/routes/_authenticated/painel.index.tsx possui duas inserções diretas em appointments: criação de reserva manual e bloqueio de horário. Isso confirma que não basta revogar INSERT: ambas as operações precisam migrar para Server Functions com permission check e validações do domínio. A ação Agendar é um fluxo suportado pela UI; o botão está sujeito a permissões na tela, mas a autorização efetiva deve ser checada no servidor. Sem alteração de código neste passo; desenho apresentado ao usuário para alinhar regras de negócio antes do fix.
### SEC-009/010 — escopo de consumidores recontado (2026-11-15)

Busca atual na árvore src sem testes: 114 chamadas a businesses, 32 a appointments e 8 a customers; 9 chamadas a appointments em rotas _authenticated. A contagem inclui server functions e serviços com níveis de acesso distintos, então revogar SELECT/GRANT sem inventariar cada caminho interromperia funções legítimas. A tela de clientes e a agenda fazem queries diretamente pelo cliente Supabase; além de reads, clientes grava e remove customers e a agenda cria/atualiza/remove appointments. A fronteira precisa separar chamadas browser/role profissional de funções server-side já privilegiadas, e preservar owners. Pergunta sobre contrato de campos foi enviada ao usuário; sem mudança de código até resposta/desenho aprovado.
### PAY-024 — causa e lacuna de semântica confirmadas (2026-11-15)

Revalidei a confirmação de cobrança: ela atualiza access_until e charge status/history; não limpa status nem cancelled_at do negócio. cancel_overdue_business grava status=cancelado e cancelled_at após a janela de atraso; ação Master efetivar também grava cancelled_at, enquanto reverter limpa ambos. Não há campo local que diferencie cancelamento por inadimplência de cancelamento voluntário/administrativo. Como a spec exige restaurar acesso em regularização, mas o evento de pagamento não prova que o cancelamento foi somente por atraso, limpar marcadores automaticamente pode reativar um cancelamento deliberado. Mantido bloqueado até separar causa/origem do cancelamento ou confirmar a regra do produto. Nenhum estado real foi alterado; tally 127/17/7.
### SEC-011 — corrigido localmente (2026-11-15)

Migration nova remove policy SELECT por membership e instala policy owner-only em subscription_payments. Teste security-hardening.test.ts: RED confirmou que profissional lia a cobrança sintética; GREEN: owner lê e profissional ativo recebe zero linhas. A escrita continua reservada a service_role. Focal 56/56; DB 13 arquivos/110 testes; app 138 arquivos/1.072 aprovados, 8 ignorados; TypeScript e git diff --check passaram. Sem migration remota. Tally: 128 corrigidos/mitigados, 17 bloqueados/não verificados, 6 pendentes.
### Recuperação dos índices de achados — 2026-11-15

Uma substituição regex incorreta sobrescreveu todas as linhas das tabelas problemas.md e riscos.md, que não têm cópia rastreada no Git. Procurei backups locais e não encontrei outra cópia. Preservei as versões danificadas em %TEMP%\agenda-agora-index-recovery e reconstruí os índices usando títulos e estados das seções detalhadas: 151 IDs únicos em problemas.md e 93 riscos/pendências em riscos.md. A recuperação preserva os relatórios fonte e a contagem 128/17/6, mas não recupera literalmente o texto original das duas tabelas; campos sem etiqueta explícita apontam para a fonte. Revisão dos índices reconstruídos ainda necessária.
### PAY-012 — janela temporal sem regra de reconhecimento (2026-11-15)

Revisei o filtro e o contrato local: getAgpayPerformance seleciona deposit_payments por created_at, inclui paid_at no payload e classifica pagamentos por status/paid_at. A spec revisada não define se a carteira agrupa tentativas criadas no período ou valores reconhecidos quando pagos; não há cenário de webhook tardio nos testes existentes. Não alterei o filtro nem reescrevi o comentário, pois isso escolheria política contábil sem evidência. Pendente definição da data de reconhecimento; tally não alterado (128/17/6).
### API-004 — revalidado corrigido localmente (2026-11-15)

createTimeBlock consulta a permission granular via RLS no business autenticado e permite block_schedule com fallback legado block_agenda antes do INSERT; usa client de sessão/RLS e continua validando business e professionalId. Teste src/lib/time-blocks.functions.test.ts: 3/3, cobrindo ambas permissões e recusa sem permissão. Sem login ou escrita real; policies remotas não verificadas. Tally inalterado: 128/17/6.
### Correção da reconstrução dos índices (2026-11-15)

A primeira reconstrução usou headings sem reconciliar aliases e requisitos, e gerou 93 riscos; ela foi substituída. Versão atual: problemas.md tem 151 IDs canônicos segundo a reconciliação do checklist (remove API-001/BOOK-003, DB-001/BOOK-002, API-009/PAY-009, UI-012 histórico, FR-* e SHA-256; inclui DOC-001 e DB-003 inline). riscos.md tem 13 grupos P1 do relatorio-consolidado mais PAY-012/PAY-024 como observações P2. As tabelas originais não foram recuperadas literalmente; revisão da gravidade/estado por ID continua necessária. Contagem reportada 128/17/6, item-level ainda não reconciliado.
### PAY-033 — contrato AgPay continua bloqueando classificação — 2026-11-15

Revalidação: a busca pública não encontrou documentação oficial verificável de códigos de rejeição do wrapper AgPay. A tentativa de inspeção read-only do dashboard não foi concluída porque a automação do Windows falhou ao conectar ao pipe nativo. O código local ainda perde a classificação ao sanitizar erros, mas sem contrato não é seguro mapear status HTTP para `rejeitado`. Sem mudança de código, chamada ao gateway ou consulta a dados de produção. PAY-033 permanece bloqueado; tally reportado 128/17/6 segue não reconciliado por item.

### UI-002 revalidado — corrigido localmente — 2026-11-15

A tela conecta os selects de tipo/status a `appliedFilters` e a `filterTransactionRows`; “Aplicar” reseta a página e “Limpar” restaura busca/filtros. Teste focal `src/lib/transactions-filter.test.ts`: 2/2. QA visual em browser pendente. UI-002 já consta entre os corrigidos localmente; tally reportado 128/17/6 permanece sem reconciliação item a item.
### DEP-001 — corrigido localmente; produção não verificada — 2026-11-15

O lockfile e `node_modules` resolvem Zod 4.6.7; o advisory oficial GHSA-mrhx-c7xc-m3w5 informa patch em 4.6.6. Os arrays `workingDays`, `serviceIds` e `availableDays` têm limites no schema. Testes focais de profissionais e serviços: 50/50 aprovados. Não fiz payload de exaustão nem consultei versão implantada. DEP-001 já estava na relação de corrigidos; tally reportado 128/17/6 permanece não reconciliado por item.

### DEP-007 — tentativa de revalidação somente leitura — 2026-11-15

Não há alias SSH local; a conexão não interativa ao host registrado foi recusada por autenticação. Não consultei estado de crons, filas ou logs atuais e não executei jobs. Os 401 permanecem evidência histórica de 13/11; impacto e correção atual desconhecidos. Tally reportado inalterado: 128/17/6, ainda não reconciliado por item.

### BOOK-003 — correção local revalidada — 2026-11-15

As leituras de `time_blocks`, `appointments` e conflito final propagam erro e impedem a reserva. `booking.functions.test.ts` passou 117/117, cobrindo as três falhas e ausência de inserts. Produção não verificada; item já contabilizado como corrigido. Tally reportado 128/17/6 permanece sem reconciliação por item.

### PAY-027 — correção local revalidada — 2026-11-15

O hook classifica trial por histórico de pagamento; a RPC de cancelamento só aplica a exceção de trial quando não há pagamento em `subscription_payments` ou `subscription_charges`. Teste do hook 10/10; DB direcionado 2/2. A migration local não foi aplicada remotamente. Item já contabilizado como corrigido; tally reportado 128/17/6 segue não reconciliado.

### PAY-022 — paginação do cron revalidada — 2026-11-15

O hook usa fetchAllPages em intervalos de 1.000, ordem estável por id e registra o total completo. Teste focal com 1.001 businesses passou 1/1, verificando duas páginas e total 1.001. O caso de falha de página existe, sem execução nesta rodada. Produção não verificada; tally permanece 128/17/6, não reconciliado por item.

### PAY-029 — estado de refund revalidado — 2026-11-15

O ramo refund debita ledger, grava `estornado`/`provider_status`, e os relatórios separam pago líquido de volume bruto/refundado. Testes focais em cinco arquivos passaram 86/86, incluindo duplicata e pagamento antigo após estorno. Contrato do evento/chargeback e política de comissão permanecem não verificados. PAY-029 já estava contabilizado como corrigido; tally reportado 128/17/6 segue não reconciliado por item.

### BOOK-005 — residual da falha dupla identificado — 2026-11-15

A compensação atual cancela a reserva quando falha o INSERT da cobrança, mas se o UPDATE compensatório também falha, não existe registro durável de recuperação. Testes cobrem as duas saídas; booking.functions.test.ts 117/117. Sugeri RPC transacional server-only; alinhamento do desenho aguardado. Sem implementação até resposta; tally permanece reportado 128/17/6, não reconciliado.

### BOOK-006 — falha de consulta pública exibida e recuperável (2026-11-15)

A função `getMyBookings` já propaga erros de leitura; agora as telas Elegance e legada consomem `bookings.isError`, exibem alerta acessível em vez do estado vazio e oferecem retry por `bookings.refetch()`. Adicionado teste de regressão da Elegance. `npx vitest run src/components/public-booking/elegance-history.test.tsx`: 1/1; `npx vitest run src/lib/booking.functions.test.ts`: 117/117; `git diff --check` sem erro (apenas avisos de LF/CRLF preexistentes em outros arquivos). BOOK-006 já constava na lista reportada de corrigidos; tally permanece 128/17/6, não reconciliado item a item. Sem acesso a produção.

### BOOK-007 — vínculo de profissional validado (2026-11-15)

A versão atual de `validateProfessional` diferencia erro de leitura de resposta válida vazia, rejeita profissional informado sem vínculo, e consulta profissional pelo par `id`/`business_id`, exigindo `active`. Teste focal `booking.functions.test.ts -t 'professionalId fornecido|falha a leitura de vínculos|consulta do profissional vinculado|profissional ativo que pertence'`: 4 passaram, 113 ignorados pelo filtro; a rodada anterior do arquivo completo foi 117/117. BOOK-007 já constava entre os corrigidos localmente; tally permanece reportado 128/17/6, não reconciliado. Sem dados reais ou produção.

### BOOK-009 — fusos inválidos rejeitados (2026-11-15)

`preferencesPatch.timezone` usa enum dos fusos suportados (`PANEL1_TIMEZONES`); a normalização de configuração substitui fuso legado não suportado pelo padrão. Regressão `npx vitest run src/lib/panel1-config.functions.test.ts -t 'time.?zone|timezone|fuso'`: 1 passou, 8 ignorados pelo filtro; documentação registra suite do arquivo 9/9. BOOK-009 já estava corrigido localmente; nenhuma configuração real consultada. Tally reportado 128/17/6 inalterado e não reconciliado item a item.

### BOOK-010 — erro ao carregar dias abertos (2026-11-15)

`getOpenDays` propaga falhas nas leituras de negócio e expediente em vez de retornar sucesso com lista vazia. Regressão focal junto com BOOK-012 em `booking.functions.test.ts`: os casos direcionados passaram; arquivo completo 117/117 na rodada anterior. BOOK-010 já estava marcado como corrigido em relatório detalhado. Sem consulta remota; tally reportado 128/17/6 não reconciliado.

### BOOK-012 — datas civis impossíveis rejeitadas (2026-11-15)

`civilDateSchema` valida o round-trip do calendário gregoriano e é usado nos inputs de criação, disponibilidade e remarcação. Regressão focal (`civilDateSchema|getOpenDays: consulta indisponivel`): 9 passaram, 108 ignorados pelo filtro; inclui datas bissextas válidas, datas inexistentes e erros em `getOpenDays`. Arquivo completo 117/117 na rodada anterior. Sem reserva real; tally reportado 128/17/6 segue não reconciliado.

### BOOK-011 — transições de horário sazonal validadas (2026-11-15)

`toIso` preserva horários locais válidos e rejeita horários inexistentes ou ambíguos; `filterPossibleLocalTimes` também remove slots DST inválidos. Teste focal `booking.functions.test.ts -t 'toIso: transições de horário sazonal'`: 4/4; sem fuso ou reserva real consultados. BOOK-011 já constava corrigido localmente; tally reportado 128/17/6 inalterado e não reconciliado.

### ADM-002/003/004 — onboarding compensado e alteração de email protegida (2026-11-15)

`createBusinessWithOwner` interrompe na falha da gravação da role e compensa Auth; na falha de negócio, reconcilia por `owner_id` antes de apagar e preserva a conta quando o estado é ambíguo. `sdrCreateBusiness` tem compensação equivalente. `updateSdr` exige PIN novo ao trocar email de login. Evidências desta rodada: `admin-onboarding.test.ts` 3/3; `sdr.functions.test.ts -t 'compensates role and Auth|requires a replacement PIN when the login email changes'` 2 passaram, 18 ignorados pelo filtro. Nenhuma conta real criada; chamadas Auth/Postgres não são transacionais e produção não foi verificada. Tally reportado 128/17/6 continua sem reconciliação item a item.

### INT-002 — número alternativo do remetente LID revalidado (2026-11-15)

O parser atual tenta `key.remoteJidAlt` e `candidate.remoteJidAlt` após o JID primário e só aceita telefone alternativo em formato discável `@s.whatsapp.net`; LID sem alternativo é ignorado. Testes focais em `whatsapp-greeting.server.test.ts`: 3/3 para LID com número, LID sem número e filtros de grupo/mensagem própria. O relatório detalhado ainda descrevia o comportamento antigo; código local já contém a correção. Sem webhook ou produção. Tally reportado 128/17/6 sem reconciliação item a item.

### DEP-006 — boot exige segredos obrigatórios do runbook (2026-11-15)

Revalidei causa e requisito: `assertProductionConfig` só recebe `process.env` em produção; o runbook marca `SDR_TOKEN_SECRET`, `WHATSAPP_WEBHOOK_SECRET` e `AGENDA_CRON_SECRET` obrigatórios. A validação ignorava os três, embora as funções falhassem ao usá-los; o schema de runtime já exige 32 caracteres para SDR/WhatsApp quando presentes. Atualizei `src/lib/production-config.ts` para exigir os três em produção e rejeitar SDR/WhatsApp abaixo de 32, com erros sem valores secretos. `production-config.test.ts`: RED 5 falhas específicas antes do fix; GREEN 14/14. `npx tsc --noEmit` e `git diff --check` focado passaram. `.env` não foi lido; nenhuma configuração remota alterada. Produção ainda não verificada. Tally histórico permanece reportado 128/17/6, não reconciliado item a item.

### DB-002 / acesso de leitura ao Supabase — 2026-11-15

O conector Supabase retornou `You do not have permission` para `get_project`, avisos de segurança e lista de migrations no projeto `qagotnmdqjoodoudcikd`. Verifiquei também o caminho REST local documentado: GET ao catálogo `/rest/v1/` com as credenciais do `.env` respondeu HTTP 200 e expôs metadados de 62 endpoints; o corpo completo foi descartado e nenhuma linha de cliente/negócio foi consultada. `Accept: application/vnd.pgrst.openapi+json` recebeu HTTP 406; `Accept: application/json` foi aceito. O catálogo REST não expõe endpoint de migrations, então políticas, schema aplicado, versionamento remoto e filas continuam sem verificação. Nenhum segredo foi impresso e nenhum dado ou configuração foi alterado.

### Índice de arquivos por revalidação — 2026-11-15

- **BOOK-006:** alterados `src/components/public-booking/elegance-history.tsx`, `src/routes/agendar.$slug.tsx` e novo `src/components/public-booking/elegance-history.test.tsx`; teste de componente 1/1, `booking.functions.test.ts` 117/117, TypeScript passou. `getMyBookings` e `bookings.isError` verificados; sem consulta remota.
- **BOOK-007:** revalidados `src/lib/booking.functions.ts` e `src/lib/booking.functions.test.ts`; nenhum código adicional alterado nesta revalidação; 4/4 casos focais passaram.
- **BOOK-009:** revalidados `src/lib/panel1-config.functions.ts`, `src/lib/panel1-config.functions.test.ts` e `src/lib/panel1-config.ts`; sem código adicional; teste focal 1/1.
- **BOOK-010/011/012:** revalidados `src/lib/booking.functions.ts` e `src/lib/booking.functions.test.ts`; sem código adicional; focais de getOpenDays/data civil 9/9 e DST 4/4.
- **ADM-002/003/004:** revalidados `src/lib/admin.functions.ts`, `src/lib/admin-onboarding.test.ts`, `src/lib/sdr.functions.ts` e `src/lib/sdr.functions.test.ts`; sem código adicional; focais 3/3 + 2/2.
- **INT-002:** revalidados `src/lib/whatsapp-greeting.server.ts` e `src/lib/whatsapp-greeting.server.test.ts`; sem código adicional; focais 3/3.
- **DEP-006:** alterados `src/lib/production-config.ts` e `src/lib/production-config.test.ts`; RED 5 falhas específicas, GREEN 14/14, `npx tsc --noEmit` e diff check aprovados. Exigência derivada de `docs/runbooks/deploy-versao-cliente.md`; nenhuma variável ou configuração de produção lida/alterada.
- **DB-002:** tentativa via Supabase MCP negada; GET REST somente ao catálogo retornou HTTP 200/62 endpoints, sem ler linhas. Arquivos de registro: `docs/auditoria-agenda-agora/banco-de-dados.md` e este checklist; schema/migrations remotos continuam não verificados.

Tally global segue como histórico reportado 128/17/6, sem reconciliação item a item; não somar revalidações a correções já contabilizadas.

### INT-005/006 — retry de lembrete e leituras falham fechadas (2026-11-15)

Estado atual do handler `src/routes/api/public/hooks/whatsapp-reminders.ts`: não lê `reminder_logs` para inferir envio; usa `claim_whatsapp_reminder` antes de chamar o provedor, registra falha via `finish_whatsapp_reminder(p_sent=false)` e permite novo claim após status `erro`; erro de leitura de businesses/appointments ou falha de claim/finish encerra com HTTP 500 antes de continuar sem controle. O claim impede workers concorrentes para appointment/channel. Validação nesta rodada: `whatsapp-reminders.test.ts` 2/2 (erro de query não envia; falha de envio tenta novamente e sucesso não duplica); DB isolado `functions.test.ts -t 'claim de lembretes WhatsApp'` 2/2, 22 ignorados pelo filtro. Arquivos de código conferidos: handler, teste da rota, migration `20261114220000_claim_whatsapp_reminders.sql` e `tests/db/functions.test.ts`; nenhum código alterado nesta revalidação. Migrations/deploy de produção e operação do cron não verificados; nenhuma mensagem enviada. INT-005/006 já constavam no grupo localmente corrigido; tally histórico reportado 128/17/6 sem reconciliação item a item.

### INT-009 — envio de teste limitado e normalizado, destino ainda sem política (2026-11-15)

Revalidei `sendTestMessage` em `src/lib/whatsapp.functions.ts`: destino passa por `normalizeTestPhone`, aceita somente telefone brasileiro válido após normalização, usa texto fixo do servidor (ignora template enviado) e aplica 3 chamadas por business/10 minutos antes do provider. `npx vitest run src/lib/whatsapp.functions.test.ts`: 4/4, cobrindo mensagem fixa/número normalizado, desconectado, entrada inválida e bloqueio da quarta tentativa; provider está mockado. Nenhuma mensagem externa enviada. Permanece pendente definir destino do teste como telefone do responsável, telefone previamente verificado ou número escolhido com confirmação explícita; o telefone arbitrário válido continua aceito e o rate limit é em memória/processo. Tally histórico permanece reportado 128/17/6, sem reconciliação item a item.

### INT-010 — dependência de reconciliação do provedor confirmada (2026-11-15)

Revalidei o caminho local em `src/lib/whatsapp.functions.ts`: `connectWhatsapp` cria a instância externa antes de persistir a credencial privada e as colunas legadas; não há claim por business no handler. Não acrescentei chamadas a provider. A documentação pública UazAPI consultada descreve `POST /instance/create` com `admintoken` e um `name` (`https://docs.uazapi.com/docs/getting-started`), identifica `409` como conflito/operação já em andamento e recomenda consultar estado antes de repetir (`https://docs.uazapi.com/docs/errors-and-retries`), mas não encontrei no material consultado um contrato de idempotência, consulta/reconciliação da criação ou remoção de instância que cubra resposta ambígua. A documentação também não estabelece qual provider/versão está ativo no runtime do projeto. Sem isso, retry automático, rollback ou chave de nome não podem ser presumidos seguros; manter bloqueado até confirmar contrato e provider. Nenhuma instância foi criada/removida. Tally histórico reportado 128/17/6 permanece não reconciliado.

### DB-005 — contagem agregada da inbox AgPay (2026-11-15)

A chain local segue sem rotina de retenção/expurgo ou prazo de retenção. Fiz leitura REST somente agregada à tabela `agpay_webhook_events`: GET com `select=id&limit=0` e `Prefer: count=exact` respondeu HTTP 206 com `Content-Range: */2`; o corpo foi descartado e nenhum payload/ID foi lido. Isso registra 2 linhas no instante da consulta, sem provar retenção gerenciada/backup nem definir a janela de dedupe necessária. Nenhum expurgo executado. Prazo/política de retenção continuam necessários antes de adicionar exclusão automática. Sem mudança de código. Tally histórico reportado 128/17/6 não reconciliado item a item.

### SEC-018 — proxy chain público continua inconclusivo (2026-11-15)

Revalidei os três hosts documentados por DNS/HEAD somente leitura: os três resolvem para o mesmo registro A público; não há CNAME observado. HEAD segue 307 para `/auth` e 200 após redirect; não foram retornados `Via`, `CF-Ray`, `X-Cache` ou `Server` nos cabeçalhos coletados. Comparei sem exibir valores o IP A público do app com o host VPS definido localmente em `.env`: ambos resolvem, mas não coincidem. Esses sinais não identificam o equipamento/proxy ativo nem provam ausência de CDN ou proxy intermediário, e o backend pode ser acessível por outro caminho. Não alterei Caddy nem a seleção de IP em `clientIp()`. SEC-018 permanece bloqueado até confirmar a cadeia e bind/firewall do upstream; sem tráfego com headers falsificados e sem alteração remota.

### SEC-019 — retorno de impersonação falha fechado (2026-11-15)

Revalidei `returnToMasterSession` em `src/lib/lifecycle.functions.ts`: erros ao atualizar tentativas de PIN ou consumir o token único encerram a função antes de emitir sessão Master; no terceiro erro, o handler só afirma encerramento depois de confirmar o DELETE. `npx vitest run src/lib/lifecycle.impersonation.test.ts`: 11/11. Nenhuma sessão real ou banco remoto acessado; nenhum código alterado nesta revalidação. SEC-019 já constava corrigido localmente; tally histórico 128/17/6 permanece sem reconciliação.


### BOOK-004 ? cancelamentos bloqueiam o booking publico (revalidado em 2026-11-15)

A guarda `isPublicBookingEnabled` exige `status === "ativo"` e `cancelled_at` ausente. O catalogo publico a aplica; a selecao de servico filtra status ativo e `cancelled_at IS NULL`; `loadContext` impede reserva e geracao de sinal; `getOpenDays` devolve dias vazios para negocio encerrado. `npx vitest run src/lib/booking.functions.test.ts -t "cancelamento|cancelado|cancelled_at|booking disabled|isPublicBookingEnabled"`: 8 testes passaram, 109 ignorados pelo filtro. Nenhum provider, dado real ou producao foi acessado. A observacao original acima esta supersedida por esta revalidacao; migration/deploy e estados existentes em producao nao foram verificados.


### PAY-016 ? falha de Pix de assinatura encerra o estado pendente (revalidado em 2026-11-15)

O handler `transaction.failed` consulta primeiro `deposit_payments`; quando nao encontra referencia, procura `subscription_charges` por `provider_payment_id` e altera somente `pending` para `failed` com compare-and-set. Uma cobranca ja paga nao regride. O teste `npx vitest run src/lib/agpay-events.server.test.ts -t "transaction.failed encerra uma cobran?a pendente de assinatura sem regredir uma paga"` passou 1/1 (38 ignorados pelo filtro), com provider e DB simulados. Nenhum evento real foi processado. A observacao inicial de ausencia da transicao esta supersedida pelo handler/teste atual; o contrato do evento no AgPay e deploy continuam nao verificados.


### UI-013 ? recebiveis escondem KPIs durante carga e erro (revalidado em 2026-11-15)

A rota atual deriva loading/error/ready de `calendarQuery` e renderiza KPIs/calendario somente em ready; o estado de erro exibe alerta e retry, sem numeros parciais como confirmados. Resposta vazia valida continua em ready e representa zeros calculados. Revalidacao: `receivables-view-state.test.ts` 3/3; tambem coberta pelo novo teste SSR da rota em `painel.recebiveis.test.tsx`. Nenhuma consulta remota foi feita; QA visual em browser segue pendente. A descricao inicial de fallback numerico da UI esta supersedida pelo codigo/teste atual.

### UI-030 ? KPI Recusado marca metrica nao disponivel (corrigido localmente em 2026-11-15)

A revalidacao encontrou que o helper `unavailableRejectedChargesMetric` existia, mas o JSX continuava renderizando `R$ 0` literal. Conectei o card da rota ao helper e adicionei teste SSR que renderiza a rota real. O teste RED falhou com `R$ 0,00`/`0 cobrancas`; apos a correcao, loading/erro/vazio validos passaram 3/3, junto com os dois testes de estado/metrica: 7/7. `npx tsc --noEmit` passou. Nao ha fonte nem janela temporal definida para contar recusas; o KPI agora explicita indisponibilidade em vez de inventar zero. Nenhum dado financeiro real foi consultado e QA visual em browser permanece pendente.


### UI-014 ? relatorio interrompe calculos quando qualquer dataset falha (revalidado em 2026-11-15)

A query da rota `painel.relatorio.tsx` passa appointments, services e professionals a `requireReportDatasets`; a funcao propaga erro de qualquer fonte antes de montar metricas. A interface mostra loading, erro com retry e so renderiza cards/graficos quando ha data sem erro. `npx vitest run src/lib/report-datasets.test.ts`: 4/4, cobrindo cada dataset critico com erro e resposta vazia valida. `npx tsc --noEmit` passou nesta retomada. Nao houve leitura de dados reais; producao e QA visual seguem sem verificacao. A descricao inicial de erro parcial e supersedida pelo estado atual.


### UI-026 ? fila de aprovacao Pix distingue erro, carregamento e vazio (revalidado em 2026-11-15)

A rota expoe `isLoading`, `isError`, `isFetching` e `refetch`; erro mostra alerta com retry, loading nao apresenta fila vazia, e a mensagem ?Nenhum Pix pendente? ocorre apenas no estado empty depois de resposta valida. O estado ready preserva a fila pendente. `npx vitest run src/lib/pix-approval-list-state.test.ts`: 4/4 (loading, erro, vazio valido, fila pronta). Nenhuma chave real foi consultada ou alterada; backend remoto e QA visual continuam sem verificacao. A descricao inicial de erro indistinto de vazio esta supersedida pelo codigo atual.


### SEC-016 ? INSERT direto por owner bloqueado localmente (revalidado em 2026-11-15)

A migration aditiva `20261114150000_restrict_business_owner_insert.sql` revoga INSERT/DELETE autenticados em `businesses` e mant?m provisionamento no fluxo `service_role`. No Postgres isolado, a regressao confirmou que owner nao cria business com campos comerciais e que `service_role` continua criando: `npx vitest run -c vitest.db.config.ts tests/db/security-hardening.test.ts -t "cria??o de businesses autorizada"` passou 3/3 (53 ignorados). Nenhuma migration foi aplicada remotamente. A regra de descoberta/acesso de tenants e o deploy ainda nao foram verificados; a evid?ncia original de vulnerabilidade na chain sem a migration fica supersedida pela chain local atual.


### PAY-009/PAY-011 ? PIN e aprovacao de chave impostos no servidor (revalidado em 2026-11-15)

`createWithdrawal` valida o PIN contra o hash do negocio e confere se a chave e tipo atuais correspondem a um registro `pix_key_approvals` aprovado antes de inserir/reservar o saque. Os casos negativos confirmam que PIN incorreto ou aprovacao ausente/divergente impede criar withdrawal e nao chama o provider. Regressao completa do arquivo mockado: `npx vitest run src/lib/withdrawal.server.test.ts` passou 37/37. Nenhum saque real foi solicitado. Migration/deploy e chaves existentes em producao nao foram verificados; as descricoes iniciais de bypass estao supersedidas pela chain/codigo local atual.


### PAY-013/PAY-019/PAY-025/PAY-026 ? consultas financeiras falham fechadas e paginam (revalidado em 2026-11-15)

Revalidei os handlers e testes atuais: PAY-013 propaga erros e pagina agregados AgPay; PAY-019 propaga erros e pagina datasets da lista de transacoes; PAY-025 interrompe precificacao/emissao se a contagem de profissionais falhar; PAY-026 propaga erro de leitura do negocio/historico em vez de tratar como vazio. Lote focal: `npx vitest run src/lib/agpay-performance.functions.test.ts src/lib/transactions.functions.test.ts src/lib/subscription.functions.test.ts src/lib/subscription-charge.functions.test.ts` passou 4 arquivos/26 testes. Nenhum dado financeiro remoto, cron ou cobranca foi consultado/processado. Producao nao verificada; os estados originais de falha no codigo estao supersedidos pela chain local atual.


### Regressao completa apos UI-030 ? 2026-11-15

`npm test -- --reporter=dot` passou: 140 arquivos, 1.082 testes aprovados; 3 arquivos e 8 testes ignorados. `npx tsc --noEmit` tambem passou. A saida stderr de testes que injetam falhas e esperada. Esta e a regressao global do lote de recebiveis e dos registros locais revalidados; nao valida deploy, migrations remotas ou QA visual.


### Revalidacao da documentacao publica AgPay: PAY-007, PAY-037 e PAY-038 - 2026-11-15

Consultei https://agpay.services/documentacao por HTTPS (HTTP 200). O exemplo de criacao Pix documenta transaction_uuid, status, qr_code, pix_code, expires_at e expires_in_seconds. Isso confirma somente os dados da resposta inicial. A secao publica de consulta de transacoes lista status, page e limit, sem filtro por UUID ou schema de detalhe Pix. A rota /payments/{transaction_uuid} aparece na secao de cartao/VeoPag e nao comprova suporte de consulta Pix. A pagina nao documenta chave idempotente ou external_id. Tambem nao encontrei nomes/payloads publicos de eventos de estorno/chargeback; essa ausencia nao prova que os recursos nao existam.

PAY-037 segue bloqueado: a recuperacao do QR apos perda da resposta de criacao nao esta documentada. PAY-038 segue bloqueado: os docs nao comprovam retry idempotente ou conciliavel apos timeout. PAY-007 segue bloqueado: nomes/payloads oficiais de estorno nao estao disponiveis. Nao alterei comportamento nem inventei rota, campo ou evento. E necessario contrato oficial adicional ou confirmacao em sandbox autorizado. Nenhuma chamada autenticada, cobranca, consulta a dados privados ou escrita de producao foi feita.


### UI-015 revalidado - semantica de faturamento pendente (2026-11-15)

O calculo atual em src/lib/report-metrics.ts soma price_cents vigente do servico associado a cada appointment concluido; a rota carrega esse catalogo na consulta. A spec 001, FR-017, exige manter a metrica de faturamento existente, sem definir se o valor deve refletir o preco atual ou o preco na data do atendimento. O modelo atual de appointment tambem nao guarda snapshot do preco integral. Alterar agora o calculo ou o schema escolheria uma regra cont?bil/comercial sem respaldo, entao UI-015 permanece bloqueado ate decisao de produto. Nenhum dado ou preco real foi acessado e nenhum codigo foi alterado.


### BOOK-008 revalidado - INSERT manual ainda depende de definicao de produto (2026-11-15)

Revisei a policy appointments_professional_create da migration 20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql: o WITH CHECK valida apenas has_business_permission(business_id, create_appointment). A grant INSERT da migration inicial continua presente, e nao localizei handler manual em src; o fluxo publico usa reserveBooking com validacoes server-side. A reproducao previa em Postgres efemero provou que owner authenticated consegue gravar status nao previsto e deposit_paid_at sintetico, com rollback da transacao. O caminho de profissional, referencias cross-business e producao continuam nao verificados.

A correcao depende de decidir se staff pode criar reservas manuais e, se sim, qual fluxo autorizado deve substituir o INSERT direto. Revogar INSERT sem esse alinhamento pode quebrar operacao legitima; manter como esta preserva a lacuna. Mantido bloqueado para decisao de produto/desenho, sem migration ou alteracao de dados. Nenhuma escrita real foi feita.


### PAY-035 revalidado contra documentacao publica AgPay - 2026-11-15

A consulta HTTPS a https://agpay.services/documentacao (HTTP 200) lista os eventos withdrawal.completed (saque processado com sucesso) e withdrawal.pending (aguardando processamento). Nao lista withdrawal.failed nem withdrawal.rejected; tambem nao define revisao de estado, ordem de entrega, versao do evento ou consulta de reconciliacao. A implementacao local continua tratando failed/rejected como terminais: ledger_settle_withdrawal devolve o valor bloqueado e nao muda um saque que ja esteja terminal, portanto completed posterior ao failed nao restaura o status nem o bloqueio. Sem contrato dos eventos negativos e de estados conflitantes, nao alterei a regra: ignorar a falha pode prender saldo; liberar saldo com evento nao documentado pode permitir saque duplicado. PAY-035 segue bloqueado por contrato oficial ou confirmacao em sandbox autorizado. Nenhum webhook, saque ou dado privado foi acessado.


### Reconciliacao UI-007/UI-009/UI-010 - 2026-11-15

Revalidei os tres fixes atuais e rodei regressao focal: src/lib/business-hours.test.ts, persist-before-cleanup.test.ts, appearance-editor-load-state.test.ts e support-query-state.test.ts passaram, 4 arquivos/10 testes; tests/db/business-hours.test.ts passou 1 arquivo/3 testes no banco descartavel configurado pelo vitest.db.config.ts. UI-007 rejeita intervalos invalidos no form e no banco para novas escritas (migration local nao aplicada remotamente). UI-009 aguarda persistencia de config/perfil antes do cleanup; falhas mantem o asset anterior. UI-010 aguarda carregamento do perfil e da config e mostra retry em erro, preservando dados ja carregados durante refetch. Nao fiz upload/remocao em Storage, escrita de negocio, deploy ou acesso a producao. Tally 128/17/6 permanece historico e nao reconciliado item a item.


### UI-004 revalidado - reversao e vigencia (2026-11-15)

O codigo atual de setBusinessCancellation(action=reverter) aplica status=ativo e limpa cancel_requested_at/cancelled_at. A UI usa cancellationSuccessMessage, que informa que a vigencia do plano continua determinando acesso; nao promete restauracao de acesso pago. Regressao atual: lifecycle.cancellation.test.ts e cancellation-feedback.test.ts, 2 arquivos/4 testes aprovados. Isso cobre a acao manual Master; nao decide PAY-024, que trata de pagamento apos cancelamento por inadimplencia. Sem acesso ou alteracao de negocio real.


### Reconciliacao UI-016/UI-017/UI-019/UI-023 - 2026-11-15

Revalidei as correcoes locais e rodei cinco arquivos/13 testes: time-block-professional-scope.test.ts, time-blocks.functions.test.ts, support-query-state.test.ts, professional-count-state.test.ts e booking-recovery-storage.test.ts. Todos passaram. UI-016 falha fechado durante erro/loading e exige escopo quando ha multiplos profissionais; UI-017 distingue erro/loading/vazio na central Master; UI-019 nao habilita cadastro/preco quando a contagem falha; UI-023 mantem a reserva/Pix em memoria quando localStorage falha, mas recarga sem Storage funcional ainda perde persistencia local. Sem bloqueio, profissional, reserva ou cobranca real. Tally historico 128/17/6 permanece sem reconciliacao global.


### Reconciliacao UI-025/UI-027/UI-033/UI-035/UI-037/UI-038 - 2026-11-15

Revalidei os fixes atuais e rodei oito arquivos/17 testes: withdrawal-confirmation, lifecycle-query-state, pending-cancellation-metric, receivables-view-state, civil-date, BusinessTemplatesTab, outreach-templates.functions e copy-pix-code. Todos passaram. UI-025 serializa submissao de saque no cliente; UI-027 apresenta erro/loading em vez de vazio/MRR zero; UI-033 nomeia pedidos abertos sem prometer horizonte de 30 dias; UI-035 preserva a data civil da chave diaria; UI-037 oferece lista owner-scoped de templates e acesso ao editor; UI-038 aguarda resultado real da Promise de clipboard. UI-035 ainda nao define o fuso comercial de agregacao. Sem operacao externa, saque, pagamento ou dados reais. Tally 128/17/6 continua historico e nao reconciliado globalmente.


### Reconciliacao UI-011/UI-036/UI-039 - 2026-11-15

UI-011: broadcast-list-state.test.ts revalidado no lote, estados de loading/erro/retry/vazio permanecem distintos. UI-036: o controle Como Funciona agora e link para #templates-como-funciona, a explicacao recebe o id; teste SSR da rota falhou antes da alteracao e passou depois, junto dos testes de componente e server-function (3 arquivos/6 testes); npx tsc --noEmit passou. UI-039: polling atual espera 15 s entre leituras apos a inicial, evita concorrencia, mostra erro e aplica backoff ate 60 s; deposit-status-polling.test.ts passou. Limites por IP e comportamento em producao/proxy continuam sem verificacao. Sem pagamento real ou QA visual em browser.


### Reconciliacao API-005/006/007/008 - 2026-11-15

API-005 permanece bloqueado: a seed owner-side de sender=master falha sob RLS e o erro e ignorado; ainda nao existe correcao server-only aprovada neste estado. API-006 foi revalidado com service/category RPCs transacionais em Postgres descartavel (2 arquivos/6 testes); migration remota nao verificada. API-007/008 foram revalidados dentro da regressao de backend/agendamento (5 arquivos/89 testes): broadcast nao tenta gravacao parcial apos erro de schema; status de reserva usa compare-and-set. Sem writes remotas.


### Reconciliacao BOOK-001/BOOK-013 - 2026-11-15

BOOK-001 segue como risco local reproduzido: awaiting_sinal nao esta nos filtros de conflito nem na exclusion constraint; tests/db/business-only-appointment-overlap.test.ts passou 5/5, incluindo sobreposicao nesse estado. A correcao exige hold/liberacao de slot e regra de pagamento tardio; nao mudei a migration nem a policy financeira. BOOK-013 segue corrigido: a regressao do agpay-events.server.test.ts foi aprovada dentro do lote backend/booking de 89 testes e confirma a corrida de pagamento/cancelamento sem retorno falso de expiracao. Nenhuma reserva ou cobranca real.


### Revalidacao DEP-004/DEP-005 - 2026-11-15

DEP-004: executei ops/vps/deploy-release.test.sh com Git Bash. Harness aprovou rollback da release anterior quando health-check falha e quando restart falha, alem do caminho de sucesso. Nenhum deploy real foi feito. DEP-005: a unit local atual difere do snapshot anterior: agenda-subscription-lifecycle.service define Type=oneshot, Restart=on-failure, RestartSec=5min, StartLimitIntervalSec=1h e StartLimitBurst=3. A documentacao oficial systemd.service confirma restart em saida nao zero para on-failure e permite a combinacao com oneshot; systemd.timer Persistent=true recupera execucoes perdidas durante inatividade, nao substitui o retry do service. O timer/service instalados na VPS e a existencia de cron alternativo seguem sem verificacao. Fontes: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html e https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html.


### Revalidacao INT-001/INT-008 - 2026-11-15

INT-001: GREETING_COOLDOWN_MS e 30 minutos e a migration 20261114210000_whatsapp_greeting_30_minute_cooldown.sql tambem usa a janela de 30 minutos na claim atomica. INT-008: falha transitoria ao ler appointment/business preserva a fila pendente; conclusao so ocorre apos ausencia/estado terminal confirmado. Regressao atual whatsapp-greeting.server.test.ts + whatsapp-greeting.post-service.test.ts: 2 arquivos/18 testes aprovados; sem mensagem real. Migration, provider e fila em producao nao verificados.


### Reconciliacao PAY-010/014/020/023/028/031/034/036 - 2026-11-15

Revalidacao focal atual: 9 arquivos/104 testes unitarios e 2 testes DB descartaveis aprovados. PAY-010 vincula idempotency key ao negocio; PAY-014 compara valor bruto do evento/consulta antes de creditar; PAY-020 corrige rotulo sem alterar calculo; PAY-023 deduplica por ciclo; PAY-028 pagina agregacoes com ordem estavel; PAY-034 aplica renovacao monotona; PAY-031 propaga falha da segunda gravacao sem reportar sucesso, mas segue nao atomico; PAY-036 mantem saque processing e saldo reservado em 5xx/2xx incompleto, mas contrato sobre 422/success:false continua sem confirmacao publica. Sem saque, webhook, cobranca ou dados remotos.


### Reconciliacao PAY-001/PAY-008 - 2026-11-15

PAY-001: modelo 004 recebe o sinal integral na plataforma e realiza saque posterior; flag split e email sao legados e nao roteiam o Pix local, mas agpay_split_status ainda mapeia cartao no lifecycle. Sem definicao se a flag ainda habilita metodo de assinatura, mantido parcialmente mitigado/bloqueado para decisao; nao removi leitura nem alterei rotulo. PAY-008: o produto local segue Pix-only nas jornadas de sinal e assinatura; nao encontrei requisito de cartao nas specs revisadas. SubscriptionPaymentMethodSelector.test.tsx revalidado no lote de 93 testes. Nenhuma chamada ao gateway ou mudanca de fluxo financeiro.


### PRO-002 revalidado - 2026-11-15

Provisioning profissional compensa falha em role, perfil e service links; remocao nao reporta sucesso se Auth deletion falhar. professionals.functions.test.ts passou dentro do lote de 7 arquivos/93 testes. Auth/Postgres nao sao uma transacao unica; falha de compensacao permanece explicita para conciliacao manual. Nenhuma conta real criada/removida.


### Reconciliacao SEC-004/SEC-006 - 2026-11-15

SEC-004: PIN de saque tem lockout persistente por user/business apos cinco falhas em 15 minutos por 30 minutos; o bucket de IP ainda depende de identificacao confiavel da origem em SEC-018, e o hash SHA-256 mantem risco offline se houver vazamento. SEC-006: assertSuperAdmin exige role super_admin/AAL2; login Master encaminha sessao AAL1 para enrollment/challenge e bloqueia o painel sem AAL2. Regressao focal security-pin, withdrawal, require-super-admin, master-mfa e auth passou no lote de 7 arquivos/93 testes. Fatores, Auth settings e projeto remoto nao foram consultados.


### Reconciliacao ADM-001/DB-003/DOC-001/PRO-001/PAY-022/PAY-027/PAY-029 - 2026-11-15

Regressao atual: 10 arquivos/144 testes unitarios aprovados e 1 ignorado; DB do limite de profissionais passou 2/2 filtrado; node --check scripts/ensaio/db.mjs passou. ADM-001: status cancelado e apresentado como Cancelado. DB-003: JSDoc bate com retorno. DOC-001: nota separa deploy aa4a32e do HEAD 323189d; git confirma 24 commits posteriores e ancestralidade do hash, sem confirmar producao. PRO-001: limite de 10 bloqueia cadastro acima do teto em DB e fluxo server-side. PAY-022: hook pagina todas as empresas. PAY-027: pagamentos anteriores impedem classificacao trial/cancelamento indevido. PAY-029: evento de refund sincroniza ledger, status e agregados; contrato oficial de refund e regra de retencao de comissao seguem nao verificados. Sem cron, webhook, conta, deploy ou dados remotos.


### Revalidacao UI-018/UI-022 - 2026-11-15

`support-draft.test.ts` confirma que texto e preservado enquanto o envio esta pendente e em erro, e limpo somente apos sucesso. O SSR de `AppearanceEditor.test.tsx` confirma que o texto descreve apenas o modelo disponivel. Os dois arquivos passaram, 13/13 testes. Nenhuma mensagem foi enviada.

### Revalidacao de acesso Supabase — 2026-11-15

A lista de projetos do conector retornou apenas `aurapeptides99@gmail.com's Project` (ref `jllhlfbgrvfvunetygjf`), sem relação demonstrada com Agenda Agora. `get_project` para o ref local `qagotnmdqjoodoudcikd` respondeu `You do not have permission to perform this action`. Mantive sem consulta o projeto de peptídeos; não executei SQL, leitura de tabelas ou advisors em projeto alheio. Isso confirma o bloqueio para DB-002/SEC-002. O GET REST previamente registrado (HTTP 200) acessou somente o catálogo OpenAPI/metadados, não prova acesso a linhas, policies ou migrations. Sem escrita remota.

### BOOK-001/BOOK-002 current validation - 2026-11-15

Revalidated the current migration chain: `20261115110000_hold_booking_slots_for_deposit.sql` rebuilds both professional and business-only exclusion constraints to keep every non-cancelled appointment, including `aguardando_sinal`, on the slot until reconciliation. This supersedes the earlier BOOK-001 note that pending-signal appointments were excluded. Residual: a provider payment arriving after local expiry/cancellation can still end as `pago_sem_agendamento`; financial handling and refund policy are not defined, and the migration is not deployed remotely. BOOK-002 is corrected locally by the business-only exclusion constraint. Tests: isolated DB overlap regression 5/5; full DB suite 13 files/110 tests passed; `booking.functions.test.ts` 117/117. The ensaio check applied 90 local migrations to the isolated test DB. No production rows, payment provider, deployment, push, or commit used. Global tally remains historical 128/17/6 and unreconciled.

### SEC-006 current validation - 2026-11-15

The current `assertSuperAdmin` rejects any session whose claims do not show `aal2`, then checks the current `super_admin` role from `user_roles`. Login flow sends an AAL1 Master session to `/painel/master-auth`; MFA helper requires successful TOTP verification and confirms current assurance is AAL2. Focused regression: `require-super-admin.test.ts`, `master.functions.test.ts`, and `master-mfa.test.ts`, 3 files/19 tests passed. This supersedes the older source snapshot above. The remote project remains inaccessible, so deployed Auth settings/factors are not verified. No live login or MFA factor was used; global tally remains historical and unreconciled.

### DEP-007 current-state check - 2026-11-15

The historical inspection still attributes 401s to a mismatch between the cron token and app configuration. Current-state SSH access was refused (`Permission denied`); Supabase connector access to the Agenda Agora project is also denied. No secret values were read, no cron was called, and no worker was restarted. The local cron script reads `AGENDA_CRON_SECRET` from `/etc/agenda-agora.env`, while the app service also uses that environment file, but this does not establish which version is running on the host. Keep DEP-007 open and blocked on authorized read-only host access and queue reconciliation before any replay.

### PRO-001 current validation - 2026-11-15

Revalidated the local limit: `20261114232004_enforce_professional_limit.sql` locks the business row before counting and blocks INSERT/UPDATE at ten; `saveProfessional` fails closed when the count is unavailable. Isolated DB tests cover direct owner INSERT above ten and concurrent inserts when one place remains; both passed. `functions.test.ts -t 'limite de profissionais por negocio'`: 2/2; `professionals.functions.test.ts`: 20/20. The migration is local only; production policy remains unverified. Global tally remains historical and unreconciled.

### UI-023 current validation - 2026-11-15

`appendRecoveryId` catches errors acquiring/reading/writing browser storage and returns the updated recovery ID list in memory with `persisted=false`. The route applies that state before continuing to `setReservedAmount`, `setActiveCharge`, and the history tab; provider/persistence failure cannot throw from `saveCharge`. `booking-recovery-storage.test.ts`: 2/2 passed, covering setItem failure and getItem failure. The booking server regression was 117/117 in this session. Residual: memory state is lost after reload if browser storage remains unavailable; the UI shows a warning. No real reservation/payment. Global tally remains unreconciled.

### UI-001 current validation - 2026-11-15

The subscription selector renders only PIX, with no card fields or input controls while hosted card checkout is unavailable. Static search in the subscription panel found no PAN/CVV fields; the SSR selector regression passed 1/1. Card payment scope remains open under PAY-008; this closes the misleading nonfunctional form without adding a payment path. No charge was created. Global tally remains historical and unreconciled.

### UI-002 current validation - 2026-11-15

The transaction route separates draft and applied filter state, sends applied type/deposit-status/withdrawal-status into `filterTransactionRows`, resets page on Apply, and restores all values on Clear. `transactions-filter.test.ts` and the route SSR test passed, 2 files/3 tests. No production transactions were read. Global tally remains historical and unreconciled.

### PRO-002/ADM-002/ADM-003 current validation - 2026-11-15

The professional, Master, and SDR onboarding paths now check role/profile/link writes and attempt compensating cleanup after partial failure. If cleanup also fails, handlers report incomplete compensation rather than success. Focused tests passed: `professionals.functions.test.ts` 20/20; `admin-onboarding.test.ts` + `sdr.functions.test.ts` 23/23. Auth and Postgres are still not a single transaction, so residual partial state requires operator reconciliation; no real Auth account was created or deleted.

### UI-017 current validation - 2026-11-15

`painel.suporte.tsx` derives list and thread states through `supportQueryState`, renders separate error notices with retry, and renders the empty state only after a successful query with no rows. `support-query-state.test.ts`: 2/2 passed, including error with cached data. No real support data queried; no reply sent.

### DEP-004/DEP-005 current validation - 2026-11-15

DEP-004 harness `ops/vps/deploy-release.test.sh` passed rollback after failed health check, rollback after failed restart, and healthy success. It uses temporary directories and mocked sudo/systemctl/curl/npm; no deploy was run. DEP-005 PowerShell test `agenda-subscription-lifecycle.test.ps1` passed assertions for `Restart=on-failure`, `RestartSec=5min`, and a limit of three starts per hour. Current versioned unit is verified; its installation on the VPS and alert channel remain unknown.


### DEP-003 locally corrected - 2026-11-15

Added a scoped npm override under @typescript-eslint/typescript-estree to minimatch 11.0.1; other minimatch consumers remain unchanged. scripts/test-typescript-eslint-minimatch.mjs failed on 10.2.6 before the override and passed on 11.0.1.\
px eslint src/lib/transactions-filter.ts --rule 'prettier/prettier: off' passed to isolate parser compatibility (normal lint reports an existing Prettier issue on that unrelated line);\
px tsc --noEmit passed;\
pm audit --json found zero vulnerabilities. npm registry still publishes typescript-estree 8.72.2 with ^10.2.2, while upstream PR #13145 is merged; remove the override when the corrected release is available. No app runtime dependency or production state changed. Global tally remains historical/unreconciled. Source: https://github.com/typescript-eslint/typescript-eslint/pull/13145.


### Revalidacao read-only DB-002 / SEC-002 / SEC-009/010 ? 2026-11-15

`DATABASE_URL` do `.env` abriu conexao somente leitura; `default_transaction_read_only=on`, queries limitadas a catalogos, `BEGIN READ ONLY` e `ROLLBACK`. 62 migrations remotas, ultima `20261108122836`; repo tem 90 arquivos SQL, com 38 versoes locais ausentes no historico remoto e 9 versoes remotas sem arquivo local. RLS habilitado em 39 tabelas publicas. Policies de customers/appointments/services usam membership amplo; businesses libera linha completa a profissional ativo. Confirmado risco estrutural SEC-009/010. MCP segue negando advisors/migrations; sem leitura de linhas de negocio ou mutacao. Nao fazer rollout antes de reconciliar drift e fechar projecoes/contrato de campos.


### INT-007 ? estado atual nao revalidado no host (2026-11-15)

`.env` local indica UazAPI; `WHATSAPP_PROVIDER` ausente seleciona esse provider no codigo e variaveis Evolution estao ausentes. Snapshot de 13/11 dizia Evolution e duas instancias desconectadas. SSH ao host continua negado; a divergencia nao identifica o runtime atual. Sem chamada de provider ou mensagem; associacao business/instancia continua desconhecida.


### PAY-005 ? revalidacao local (2026-11-15)

Teste focal de `agpay.server.test.ts` passou 14/14. O adaptador envia Bearer/Accept e Client ID opcional, encaminha proxy e rejeita 3xx. GET read-only anterior teve 200 com e sem Client ID. Sem POST, pagamento ou validacao do ambiente de producao; sandbox POST pendente.


### AgPay ? busca por contratos de pagamentos (2026-11-15)

Consultas ao dominio oficial para idempotencia/external_id, recuperacao de QR, erros de POST, cashout, refund e chargeback retornaram busca vazia; endpoints documentais conhecidos nao abriram anteriormente. Limitacao de busca, nao prova de inexistencia. PAY-007/017/032/033/035/037/038 continuam sem contrato verificavel; nenhuma chamada ao gateway.

### 2026-11-15 - SEC-014 corrigido localmente

A migration `20261115113000_restrict_anon_catalog_reads.sql` revoga grants anon de tabela/coluna em sete tabelas do catalogo e remove as policies correspondentes. `/agendar/$slug` carrega os dados via Server Function com `service_role`; nao ha rota de diretorio neste repo. RED confirmou SELECT anon em `business_hours`; GREEN: security-hardening 57/57 e booking.functions 117/117. Banco descartavel; sem aplicacao remota, deploy, push ou commit. Drift DB-002 segue sem reconciliacao.


### DEP-007 - causa de producao confirmada por leitura (2026-11-15)

SSH read-only ao host `srv2024818` confirmou `agenda-agora_app` 1/1 healthy (up 3 dias) e `agenda-agora_cron` 1/1 running (up 4 semanas; zero reinicios no container atual). O cron invoca `/api/public/hooks/agpay-events` a cada minuto e `/api/public/hooks/whatsapp-reminders` a cada hora. Agregados dos ultimos 24 h: 1.440 respostas HTTP 401 em AgPay e 24 em lembretes; o cron registrou `FALHOU` em cada tentativa. A variavel `AGENDA_CRON_SECRET` existe nos dois containers, mas os valores diferem; o app nao tem `AGENDA_CRON_SECRET_PREVIOUS`. Comparacao feita sem imprimir nem registrar valores/hash. Causa confirmada: secret divergente entre cron e app. Nenhum secret/container foi alterado; correcao exige alinhar a configuracao no deploy e recriar/reimplantar o servico, depois validar respostas 2xx.


### PAY-033 corrigido localmente com contrato oficial (2026-11-15)

A pagina oficial `https://agpay.services/documentacao` responde HTTP 200 e lista 400 (Bad Request), 401 (nao autenticado), 403 (acesso negado), 404 (nao encontrado), 422 (erro de validacao) e 500 (erro interno). `pixExternalStep` agora preserva uma classificacao interna: 400/401/403/404/422 marcam a tentativa como `rejeitado`, permitindo retry controlado; 3xx, 5xx e falhas sem resposta permanecem `falhou`/`post_incerto`, sem novo POST imediato. RED: cinco casos documentados liberavam incorretamente como `falhou`; GREEN: `booking.functions.test.ts` 124/124, incluindo 302/500 ambiguos; `npx tsc --noEmit` passou. Nenhuma chamada autenticada ao gateway ou pagamento real. Sem validacao de runtime de producao.

### Publicacao pronta para homologacao — 2026-11-16

Commit `eb4856b` em `origin/main`; deploy ativo como `agenda-agora/app:codex-eb4856b` no Swarm (1/1, rollback configurado). A migration `20261116060100_secure_master_role_and_business_private_data.sql` foi aplicada no Supabase `qagotnmdqjoodoudcikd`. Uma transacao read-only com role `authenticated`, claims `aal1` e usuario Master real confirmou a policy sem MFA e acesso a lista de businesses; rollback da transacao executado. `/auth` nos tres hosts e uma pagina publica `/agendar/<slug>` retornaram 200.

`npm test`: 1.125 aprovados e 8 ignorados; `npm run test:db`: 134/134; `npm run build` passou; `npm run lint`: 0 erros e 34 avisos. A validacao visual autenticada ainda nao ocorreu: o usuario vai testar o upload de logo e a homologacao. AgPay ponto 2 fica fora por enquanto; spec 006 nao foi incluida.

# Backend e APIs — triagem estática

## Superfície inicial

- Server functions em `src/lib/*.functions.ts` e `src/lib/*.ts`.
- Rotas HTTP em `src/routes/api/public/` (webhooks e jobs).
- Autenticação Supabase Bearer + `getClaims` em `src/integrations/supabase/auth-middleware.ts`.
- Guarda Master consulta `user_roles` no banco atual em toda chamada e usa cliente admin só após aprovação (`src/lib/auth/require-super-admin.ts`).
- Uma varredura estática de declarations `createServerFn` em `src/lib/*.ts` encontrou handlers sem `.middleware` apenas em superfícies públicas previstas (reserva pública, login SDR, handlers que chamam `requireSdr`, registro de erro e listagem de assets públicos). Isso não comprova autorização completa; requer revisão função a função.

## Achados e riscos em avaliação

### API-003 — transições de status de bloqueio de agenda (revalidado em 2026-11-15)

- **Estado:** corrigido localmente; permissões e uso em produção não verificados.
- **Gravidade:** P2.
- **Causa original:** atualizações privilegiadas podiam converter `bloqueado` em status ativo sem checar a permissão granular de agenda.
- **Correção presente:** `permissionForStatusChange` exige `block_schedule` para transições de/para `bloqueado`; a Server Function valida `has_business_permission` antes de usar o cliente `service_role` e faz update condicionado ao status lido.
- **Regressão:** `appointments.functions.test.ts` verifica bloqueio de status normal e reabertura de um bloqueio; 6/6 aprovados. A cadeia remota não foi verificada.
### API-004 — Server Function de bloqueios exige proprietário apesar da permissão de equipe

- **Estado:** divergência de autorização confirmada no código; impacto operacional depende de uso da tela por profissionais.
- **Gravidade:** P2 potencial.
- A rota `/painel/bloqueios` é liberada no painel para `block_schedule` ou `block_agenda` (`src/routes/_authenticated/painel.tsx:345-348`), e as policies locais de `time_blocks` também permitem essas permissões (`supabase/migrations/20261011000200_block_agenda_permission.sql:1-14`). Porém `createTimeBlock` consulta `businesses` por `owner_id = context.userId` e rejeita quem não é dono (`src/lib/time-blocks.functions.ts:24-30`). A ação de criação da tela chama essa função (`src/routes/_authenticated/painel.bloqueios.tsx:109-123`).
- **Comportamento esperado/observado:** usuário profissional autorizado abre a tela, mas a criação falha na validação do negócio; não foi executado login nem escrita para reproduzir.
- **Causa confirmada:** a Server Function aplica regra de ownership mais restritiva que a permissão de equipe da rota e do RLS local.
- **Impacto:** profissionais autorizados não conseguem cumprir a tarefa de criar bloqueios pela interface; a lista de permissões da equipe fica incoerente com a operação disponível.
- **Reprodução segura:** com usuário de teste isolado ligado ao negócio e `block_schedule` ou `block_agenda`, abrir `/painel/bloqueios` e tentar criar bloqueio fictício; não usar produção.
- **Correção recomendada:** alinhar a validação server-side ao modelo de membership/permissão, mantendo a validação de que o profissional pertence ao negócio; validar leitura, criação e remoção em harness isolado.
- **Regressão necessária:** owner sem permissão explícita, profissional com cada permissão, profissional sem permissão, usuário de outro negócio e erros de consulta devem ter resultados definidos.

### API-001 — Verificação de agenda não propaga erros de consultas críticas

- **Status:** confirmado; detalhado como BOOK-003 em `agendamentos.md`.
- **Gravidade:** P2.
- `computeAvailableSlots` ignora erros em consultas de `time_blocks` e `appointments`; fluxo de reserva pode tratar consulta que falhou como coleção vazia.

### INT-004 — falhas em integração de notificação pós-atendimento não impedem atualização do agendamento

- **Status:** decisão de resiliência confirmada, impacto operacional pendente.
- **Gravidade:** P3 suspeita.
- `setAppointmentStatus` conclui status e depois tenta enfileirar mensagem; a exceção de fila é capturada e registrada, sem reversão (`src/lib/appointments.functions.ts:58-64`). Isso preserva operação principal, mas deixa dependência de fila/log e uma reconciliação posterior a verificar.
- **Validação pendente:** se o status retornado ao usuário evidencia a falha, existe retentativa de fila e quais métricas/alertas acompanham o erro.

## Segurança por camada observada

- Todas as funções administrativas Master encontradas chamam `assertSuperAdmin` após autenticação.
- Endpoints SDR públicos dependem de token assinado, validade e registro ativo via `requireSdr`; login aplica bloqueio persistente de tentativas e limites por IP (`sdr.functions.ts`).
- Endpoints públicos de agendamento aplicam Zod e rate limit; riscos de rate-limit em memória estão separados em `seguranca.md`.
- Rotas do painel têm guarda de navegação, mas autorização real depende das server functions e RLS; não considerar client-side guard suficiente.
- A policy local permite INSERT autenticado em `appointments` a profissional com `create_appointment`, mas valida somente permissão do business; detalhes do bypass de invariantes e campos de sinal estão em BOOK-008 (`agendamentos.md`). O caminho owner foi reproduzido em banco efêmero e revertido; não houve write em produção nem reprodução com perfil profissional.

## Pendências para o próximo ciclo

- Revisar cada função que usa `supabaseAdmin` e provar checagem de `owner_id`/membership/role no mesmo fluxo.
- Revisar payloads Zod, limites, erros, timeouts e idempotência de todas as APIs públicas.
- Revisar jobs de assinatura, lembretes e fila de pós-atendimento, incluindo locks e dead-letter.
- Revisar functions de suporte, impersonação, reset de senha e logging de dados de erro.
- Não houve execução de testes nesta etapa.

## Ciclo 168 — configuração de templates de contato

- Revisei as Server Functions de templates visuais, lembretes e saudação em `src/lib/outreach-templates.functions.ts` e a resposta correspondente da tela em `painel.lembretes.tsx`.
- Controle observado: todas as funções exigem sessão; listagem para equipe valida `is_business_member`; leitura/gravação das preferências e overrides valida o `owner_id` no servidor; edição de template global exige `assertSuperAdmin`. A entrada limita mensagens a 2.000 caracteres, seleção a 100 UUIDs e antecedência a 1–168 horas.
- A compatibilidade com schema sem `saudacao_template` persiste apenas os demais campos e retorna `saudacaoPersisted: false`; a tela exibe aviso explícito para executar a migration. Nesta amostra não identifiquei inconsistência adicional que justifique novo ID.
- Limitação: inspeção estática da família de funções; sem testes, leitura do schema remoto ou alteração de configuração. A revisão do backend como um todo continua parcial.

## Ciclo 4 — validação de teste e guardas de acesso

### Testes isolados executados

`npm run test -- src/lib/agpay-events.server.test.ts src/routes/api/public/agpay-webhook.test.ts src/routes/api/public/whatsapp-incoming.test.ts src/lib/booking.functions.test.ts` passou: 4 arquivos, 131 testes. Os harnesses inspecionados usam banco falso e mocks para AgPay/WhatsApp; não foram realizadas chamadas reais. A suíte de agendamento contém comentário obsoleto afirmando que `shouldRequireDeposit` estaria ausente, mas o código exporta a função e os testes passaram.

### Evidência estática de autenticação

- `src/integrations/supabase/auth-middleware.ts:34-89` exige Bearer, valida formato JWT e chama `auth.getClaims`; as claims não são tomadas como prova de papel Master.
- `src/lib/auth/require-super-admin.ts:19-43` consulta `user_roles` a cada chamada e só então devolve `supabaseAdmin`.
- Migrations locais recentes restringem `sdrs`, `sdr_config`, `sdr_ideas`, `master_impersonation_sessions` e tabelas financeiras a service role, com exceções de leitura sob RLS. Isso sustenta a intenção do modelo local, mas não prova que a cadeia foi aplicada no Supabase de produção.
- Não foi confirmado acesso cross-tenant nesta rodada; a revisão de cada Server Function e teste negativo com dois estabelecimentos segue pendente.

Nenhum novo defeito foi confirmado por essa amostra. O status de segurança e isolamento continua parcial/inconclusivo até concluir a revisão de funções e obter o estado efetivo do banco.

### Execução de testes de autorização e regras de negócio

Três suites mockadas (`appointments.functions`, `services.functions`, `professionals.functions`) passaram: 42 testes. Elas verificam permissões de transição de status, validação de sinal e owner-checks destas funções; não são testes de RLS efetivo nem de separação de todos os endpoints por negócio. Acumulado no relatório: 20 arquivos / 320 testes dirigidos.

## Ciclo 13 — inventário de autorização dos handlers

- Varredura de 31 arquivos-fonte com `createServerFn` encontrou 131 handlers.
- Handlers sem middleware TanStack se concentram em endpoints públicos de booking (a autorização é por dados/capability e rate limit), login/handlers SDR (token HMAC validado por `requireSdr`), `listNicheAssets` (conteúdo público) e `logClientError` (intencionalmente público e limitado). A enumeração é um mapa de triagem, não uma confirmação completa de cada autorização.
- O token SDR é assinado HMAC-SHA256, expira em sete dias e cada chamada também exige SDR ativo no banco (`src/lib/sdr-token.ts:8-39`, `src/lib/sdr.functions.ts:52-78`). Login usa `auth_attempts` com RPC para bloqueio persistente, além de limite por IP; efetividade de produção depende da migration aplicada.
- `resetSdrOwnerPassword` restringe o negócio pelo `sdr_id` do token, registra evento e retorna a senha temporária uma única vez; `sdrCreateBusiness` associa o negócio ao SDR. Leitura estática, sem mutações executadas.
- O endpoint público `logClientError` valida allowlist de Origin, limita strings e sanitiza os dados antes de inserir com service role. A chave do limitador é o primeiro item de `x-forwarded-for`. Segundo a documentação oficial do Caddy, o reverse proxy padrão ignora valores `X-Forwarded-*` recebidos do cliente; se existir CDN anterior, ela precisa ser configurada como proxy confiável para preservar o IP real. Topologia implantada e IP efetivo no handler permanecem sem validação; não foi confirmado contorno do limite.
- Nenhum achado confirmado novo nesta triagem. A cadeia de proxy e IP efetivo para `logClientError` permanecem como limitação de cobertura; não foi enviado tráfego de teste.


## Ciclo 15 — login, sessões e suporte de senha

- Página `/auth` usa Supabase Auth `signInWithPassword`, valida rota de destino a partir de `user_roles` lida do banco e encerra sessão se o host não corresponde ao papel (`src/routes/auth.tsx:31-146`). Os papéis não vêm de metadata do usuário.
- `requireSupabaseAuth` exige Bearer JWT e verifica claims com `auth.getClaims` (`src/integrations/supabase/auth-middleware.ts:34-89`); `assertSuperAdmin` consulta a role corrente em cada chamada (`src/lib/auth/require-super-admin.ts:19-43`). Não se validou configuração real de Auth, MFA, rate limits ou logs.
- Reset Master valida papel, cria evento de auditoria, troca a senha pelo Auth Admin e não grava o segredo (`src/lib/reset-password.functions.ts:8-68`). No reset SDR, token limita o negócio a `sdr_id`, evento é exigido antes da troca e senha temporária é retornada ao próprio painel SDR (`src/lib/sdr.functions.ts:602-627`). Não houve reset real nem teste contra usuários.
- Login SDR usa PIN de quatro dígitos, mas o lockout é persistido em `auth_attempts`/RPC; token HMAC-SHA256 tem prazo de sete dias e cada função revalida se a conta SDR continua ativa. Migrações e segredo do token em runtime continuam sem verificação.
- Login de owners/profissionais pode tentar senha `agendaagora:<PIN de 4 dígitos>` conforme regra de compatibilidade em `auth.tsx`; não foi possível avaliar proteção por IP/lockout aplicada pelo serviço Supabase de produção. Registrar como lacuna, não falha confirmada.
- Sem achado novo confirmado nesta amostra. Cross-tenant por todos os endpoints, MFA/assurance e configurações remotas seguem pendentes.

## Ciclo 117 — classificação dos handlers sem middleware TanStack

Uma varredura local em `src/**/*.ts(x)` enumerou 22 declarações `createServerFn` sem `.middleware(...)`, sem avaliar rotas HTTP separadas. Cada handler foi agrupado por fronteira de autorização:

- **Booking público (11):** `getPublicBookingCatalog`, `getPublicBookingProfessionals`, `getAvailability`, `getOpenDays`, `reserveBooking`, `generateDepositPix`, `getDepositStatus`, `cancelDepositBooking`, `cancelAppointmentPublic`, `rescheduleAppointmentPublic` e `getMyBookings`. O grupo usa slug/UUID de reserva ou cobrança como capability e Zod; os handlers revisados aplicam rate limit por IP. Não há identidade Supabase do consumidor; o payload excessivo do catálogo é SEC-023, erro de leitura de `getOpenDays` é BOOK-010 e os demais riscos de booking estão em `agendamentos.md`.
- **SDR (9):** `sdrLogin` usa PIN e lockout persistente mais limite IP; os outros oito (script kit, salvar notas, adicionar/apagar ideia, dashboard, cadastros, reset de senha owner e criação de negócio) chamam `requireSdr` e escopam operações ao `sdr.id`/`sdr_id`. A revisão individual anterior não encontrou novo bypass; SEC-017 registra revogação tardia de tokens.
- **Telemetria pública (1):** `logClientError` valida origem, limita/sanitiza payload e usa service role apenas para INSERT; SEC-018 mantém dependência da confiança do proxy no IP.
- **Catálogo estático (1):** `listNicheAssets` devolve assets públicos pré-definidos, sem acesso a dados de negócio.

**Resultado:** os 22 handlers foram classificados; ausência de middleware TanStack não significa por si só ausência de controle. Autorização e capability dos handlers públicos de booking foram revisadas por amostra no fluxo, mas não foram executadas baterias negativas de cada ID/tenant; contratos remotos e RLS continuam fora da prova local. Nenhum novo ID nesta varredura.

### ADM-002 - Master onboarding can leave an orphan Auth account

- State: corrected locally; no real Auth or database account was created.
- Root cause: `createBusinessWithOwner` ignored the `user_roles.upsert` result and did not compensate Auth/role state after a failed `businesses.insert`.
- Correction: role assignment errors now stop the flow and delete the newly created Auth user. If business insertion fails, the handler checks by `owner_id`; it preserves Auth and role when the lookup errors or finds a row, and removes role plus Auth only after confirming no business exists. Cleanup errors return an explicit partial-failure error.
- Regression: tests cover role failure, confirmed business failure with cleanup, and ambiguous reconciliation preserving the account. TDD red/green; 3/3 focused tests; `npx tsc --noEmit` passed.
- Limitation: cleanup uses separate Supabase Auth/Postgres operations, so remote behavior and provider availability were not verified. No production writes.

### ADM-003 - SDR onboarding can leave a partial owner account

- State: corrected locally; no real Auth or database account was created.
- Root cause: `sdrCreateBusiness` ignored the owner-role upsert result and did not compensate after a failed business insert.
- Correction: role assignment errors stop provisioning and delete the new Auth user. After business insert error, the handler checks by `owner_id`; it preserves Auth and role when lookup is inconclusive or finds a row, and removes role plus Auth only after confirming absence. Cleanup errors surface as partial failure.
- Regression: forced role upsert and business insert failures; tests confirm fail-closed behavior and compensation. The existing SDR file passes 8/8 tests; `npx tsc --noEmit` passes. No remote write.
- Limitation: Auth/Postgres compensation is not atomic; remote provider behavior and deployed data were not checked.

### ADM-004 - Changing an SDR email can invalidate the stored PIN

- State: corrected locally.
- Root cause: PIN hashes include `email::pin`, but `updateSdr` allowed email changes without a replacement PIN; subsequent login used the new email and could not verify the old hash.
- Correction: the server reads the current email and rejects a changed login email when no new PIN is supplied. The edit form gives the same validation before sending. Supplying a new PIN writes a new scrypt hash for the updated email; unchanged email can still be edited without changing the PIN.
- Regression: changing email without PIN is rejected before update; new email plus PIN stores a fresh scrypt hash; unchanged email without PIN remains supported. SDR tests 11/11 and `npx tsc --noEmit` passed.
- Limitation: no real SDR credentials were changed; deployed state not inspected.

### Caminhos de owner revistos por amostra

Foram relidos `getLedgerStatementForOwner`, `updateBusinessProfile`, `createTimeBlock`, `saveService`, `saveServiceDeposit` e `setAppointmentStatus` (`src/lib/ledger.statement.server.ts`, `business.functions.ts`, `time-blocks.functions.ts`, `services.functions.ts`, `appointments.functions.ts`). Nos quatro fluxos de negócio que recebem `businessId`, a sessão autenticada valida owner no registro do negócio antes da operação; `saveService` e `saveServiceDeposit` também condicionam as escritas do recurso a `business_id`. `createTimeBlock` usa client de sessão/RLS para inserir e rejeita `professionalId` que não pertença ao estabelecimento. `setAppointmentStatus` resolve o estabelecimento pelo appointment sob RLS, valida membership/permissão para aquele business e só então faz update privilegiado pelo ID do appointment.

**Resultado da amostra:** não foi encontrado bypass cross-tenant nesses caminhos inspecionados. Esta leitura estática não prova as policies remotas nem cobre todas as Server Functions. Não foi feito teste com duas contas/estabelecimentos nesta rodada.

### DB-004 — referências do ledger não impõem consistência do tenant

- **Estado:** corrigido localmente; dados existentes e migration remota não verificados.
- **Gravidade:** P2.

A migration `20260929120000_ledger_wallet.sql` mantinha FKs independentes entre `ledger_entries.business_id` e `payment_id`/`withdrawal_id`, permitindo associação cruzada criada por caminho privilegiado.

`getLedgerStatementForOwner` valida o owner e filtra lançamentos pelo business. As consultas de detalhes agora também filtram pagamentos e saques pelo `business_id` validado, para impedir que registros inconsistentes exponham dados de outro tenant.

- **Validação segura:** o teste DB `tests/db/ledger-tenant-integrity.test.ts` falhou antes da correção porque o banco aceitava associações cruzadas. Após a migration aditiva, as referências de outro negócio são recusadas e referências do mesmo negócio continuam aceitas. Fixture executada no PostgreSQL efêmero, sem dados de produção.
- **Correção local:** `20261115100000_ledger_reference_tenant_integrity.sql` valida business nas referências de lançamento e impede mudar o business de pagamentos/saques já referenciados para outro tenant. O extrato filtra o tenant nas consultas de detalhe.
- **Regressão:** teste focal DB 2/2; suíte DB 13 arquivos/107 testes; suíte geral 137 arquivos/1.071 testes aprovados, 3 arquivos/8 testes ignorados; TypeScript passou. Migration não aplicada remotamente.

**Validação pendente:** verificar possíveis referências cruzadas legadas apenas em ambiente autorizado. Triggers barram inconsistências novas, mas não alteram registros existentes.
## Ciclo 134 — configuração do Painel 1 e sincronização do Storage

- `getPanel1Config` e `savePanel1Config` passam por `requireSupabaseAuth` e chamam `has_business_permission` com `manage_settings` para o `businessId` solicitado (`src/lib/panel1-config.functions.ts:17-36,102-120`). Leituras e gravações usam service role depois da checagem; o objeto fica no caminho derivado do business (`src/lib/panel1-config.ts:369-371`; `panel1-config.storage.ts:46-49,99-107`). Não identifiquei neste caminho uma referência sem escopo de tenant.
- A leitura usa defaults apenas quando o objeto não existe e propaga erro de bucket/permissão; gravação faz merge parcial e serializa por `WeakMap`/`Map` em memória (`panel1-config.storage.ts:10-37,46-73,77-113`). A normalização de mídia só mantém as chaves `classic` e `elegance` (`panel1-config.ts:564-603`).
- Testes existentes cobrem merge, persistência e duas gravações concorrentes sequenciais/no mesmo processo e client (`panel1-config.storage.test.ts:81-149`); não foram executados nesta rodada. O lock é local ao processo: duas instâncias independentes não compartilham fila e poderiam fazer read-modify-write concorrente sobre o mesmo objeto. O unit versionado da VPS inicia um único processo Node (`ops/vps/agenda-agora.service:6-16`), mas a topologia efetiva de produção e qualquer scale-out não foram confirmados.
- **Resultado:** nenhuma falha confirmada; risco de lost update entre instâncias é condicional à implantação multi-instância e não foi promovido a achado. Confirmar topologia e, se houver scale-out, validar concorrência distribuída ou controle de versão do objeto.
- Sem gravação de configuração, upload ou chamada ao Storage; sem novo ID. A projeção pública de preferências já está coberta por SEC-023 e a validação de `avatar_path` por SEC-020.

### PRO-002 - Professional access provisioning and removal can fail partially

- State: corrected locally for the audited create/remove paths; no real Auth account was created or removed.
- Root cause: a new Auth account and role could be created before the professional row/service links; later failures did not compensate. Professional deletion also ignored Auth deletion errors.
- Correction: role-write failure deletes the new Auth user; professional-row failure removes role and Auth, and reports incomplete cleanup; service-link failure removes the newly created profile, role, and Auth in order, stopping if profile cleanup fails. Deletion now surfaces Auth cleanup failure instead of reporting success.
- Regression: injected role, profile-row, service-link, and Auth deletion failures. `src/lib/professionals.functions.test.ts` passes 19/19; `npx tsc --noEmit` passed.
- Limitation: Auth and Postgres operations are not one transaction. Partial cleanup is reported for manual reconciliation; no remote provider behavior was verified.


### API-007 corrigido localmente (2026-11-14)

Removido o retry que, diante de colunas de audiencia ausentes, gravava somente titulo e mensagem; a leitura interpreta audiencia ausente como todos. A insercao agora falha com o erro de schema e nao grava aviso parcial. Teste de regressao reproduz falha seguida de retry que seria aceito: 1/1; TypeScript e diff check passaram; npm test: 119 arquivos aprovados, 3 ignorados; 998 testes aprovados, 8 ignorados. Nenhum aviso foi criado em ambiente remoto; schema de producao nao foi consultado. Contagem: 81 corrigidos localmente, 7 bloqueados/nao verificados, 63 pendentes de 151.
### API-008 validado localmente (2026-11-14)

A gravação de status já usa compare-and-set (`UPDATE ... WHERE id = ? AND status = status_lido`) e retorna erro quando outra operação mudou o status após a autorização. Adicionado teste de concorrência com status neutro para provar que uma corrida não reativa agendamento cancelado. Teste focado 1/1; TypeScript passou; regressão completa: 120 arquivos passaram, 3 ignorados; 999 testes passaram, 8 ignorados. Contagem: 82 corrigidos/validados localmente, 7 bloqueados/não verificados, 62 pendentes de 151. Nenhuma operação remota.

### API-005 — bloqueado aguardando aprovação do desenho (2026-11-15)

Causa confirmada: RLS permite owner inserir apenas `sender='user'`, enquanto a seed do greeting usa `sender='master'` e ignora a falha. Proposta segura requer escrita server-only com validação de ownership e garantia idempotente aditiva, mantendo a policy existente. Aprovação do desenho pendente pelo gate da skill `brainstorming`; sem alteração de código, migration ou dados nesta etapa.

### API-006 — serviço, profissionais e categorias no catálogo (corrigido localmente em 2026-11-15)

`save_service_with_professionals` combina upsert do serviço e substituição dos vínculos de profissionais; `save_service_category_with_services` combina upsert da categoria e atualização de `services.category_id`. As RPCs são `SECURITY INVOKER`, validam ownership e vínculo ao mesmo negócio, e executam sob as policies RLS do chamador. A exclusão de categoria mantém `ON DELETE SET NULL`, que já é uma única operação transacional no Postgres. Testes DB injetaram falha depois de iniciar a substituição para confirmar rollback integral. Migration e suite DB foram validadas em Postgres embutido descartável; schema remoto permanece sem verificação.
### Ciclo 85 — reconciliação UI/Admin P2 — 2026-11-15

Índice atualizado para UI-003/004/013/014/030/033 e ADM-001/002/003/API-004 conforme correções locais já registradas no histórico. `npm test` corrente: 136 arquivos/1.058 testes aprovados, 3/8 ignorados; TypeScript e `git diff --check` passaram. Policies remotas, produção e uso real não foram alterados ou confirmados. Tally permanece 115/11/25.
### API-004 — revalidado corrigido localmente (2026-11-15)

createTimeBlock consulta a permission granular via RLS no business autenticado e permite block_schedule com fallback legado block_agenda antes do INSERT; usa client de sessão/RLS e continua validando business e professionalId. Teste src/lib/time-blocks.functions.test.ts: 3/3, cobrindo ambas permissões e recusa sem permissão. Sem login ou escrita real; policies remotas não verificadas. Tally inalterado: 128/17/6.
### ADM-002/003/004 — onboarding compensado e alteração de email protegida (2026-11-15)

`createBusinessWithOwner` interrompe na falha da gravação da role e compensa Auth; na falha de negócio, reconcilia por `owner_id` antes de apagar e preserva a conta quando o estado é ambíguo. `sdrCreateBusiness` tem compensação equivalente. `updateSdr` exige PIN novo ao trocar email de login. Evidências desta rodada: `admin-onboarding.test.ts` 3/3; `sdr.functions.test.ts -t 'compensates role and Auth|requires a replacement PIN when the login email changes'` 2 passaram, 18 ignorados pelo filtro. Nenhuma conta real criada; chamadas Auth/Postgres não são transacionais e produção não foi verificada. Tally reportado 128/17/6 continua sem reconciliação item a item.


### Reconciliacao API-005/006/007/008 - 2026-11-15

API-005 permanece bloqueado: a seed owner-side de sender=master falha sob RLS e o erro e ignorado; ainda nao existe correcao server-only aprovada neste estado. API-006 foi revalidado com service/category RPCs transacionais em Postgres descartavel (2 arquivos/6 testes); migration remota nao verificada. API-007/008 foram revalidados dentro da regressao de backend/agendamento (5 arquivos/89 testes): broadcast nao tenta gravacao parcial apos erro de schema; status de reserva usa compare-and-set. Sem writes remotas.


### PRO-002 revalidado - 2026-11-15

Provisioning profissional compensa falha em role, perfil e service links; remocao nao reporta sucesso se Auth deletion falhar. professionals.functions.test.ts passou dentro do lote de 7 arquivos/93 testes. Auth/Postgres nao sao uma transacao unica; falha de compensacao permanece explicita para conciliacao manual. Nenhuma conta real criada/removida.


### Reconciliacao ADM-001/DB-003/DOC-001/PRO-001/PAY-022/PAY-027/PAY-029 - 2026-11-15

Regressao atual: 10 arquivos/144 testes unitarios aprovados e 1 ignorado; DB do limite de profissionais passou 2/2 filtrado; node --check scripts/ensaio/db.mjs passou. ADM-001: status cancelado e apresentado como Cancelado. DB-003: JSDoc bate com retorno. DOC-001: nota separa deploy aa4a32e do HEAD 323189d; git confirma 24 commits posteriores e ancestralidade do hash, sem confirmar producao. PRO-001: limite de 10 bloqueia cadastro acima do teto em DB e fluxo server-side. PAY-022: hook pagina todas as empresas. PAY-027: pagamentos anteriores impedem classificacao trial/cancelamento indevido. PAY-029: evento de refund sincroniza ledger, status e agregados; contrato oficial de refund e regra de retencao de comissao seguem nao verificados. Sem cron, webhook, conta, deploy ou dados remotos.


### PRO-001 current validation - 2026-11-15

Revalidated migration 20261114232004_enforce_professional_limit.sql: trigger locks the business row before counting and enforces the limit of ten on INSERT/UPDATE. saveProfessional also fails closed when count query fails or returns no usable count. Tests: isolated 	ests/db/functions.test.ts -t 'limite de profissionais por negocio' 2/2; src/lib/professionals.functions.test.ts 20/20. No real professional account was created; remote migration remains unverified.


### PRO-002/ADM-002/ADM-003 current validation - 2026-11-15

Onboarding paths check each role/profile/service-link write and perform compensation; cleanup failure is returned explicitly. professionals.functions.test.ts: 20/20; dmin-onboarding.test.ts + sdr.functions.test.ts: 23/23. Auth and Postgres are separate systems, so compensation is not atomic and residual state still needs reconciliation if cleanup fails. No real account operation.

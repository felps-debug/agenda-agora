# Banco de dados e integridade — triagem estática

## Evidência disponível

- Migration chain imperativa em `supabase/migrations/` contém AgPay, pagamentos de sinal, carteira/ledger, saques, agenda, permissões, suporte e hardening.
- `deposit_payments` nasceu com política de owner e CRUD authenticated em migration antiga; a migration de mudança de gateway revogou todo acesso de `anon`/`authenticated`, removeu a policy e concedeu operações apenas ao `service_role` (`20260918010000...sql:56-58`). Código de cobrança atual usa o cliente admin server-side.
- `ledger_entries` é descrito e implementado como append-only, com idempotency key única e triggers de bloqueio UPDATE/DELETE; saldo projetado em `wallets` é atualizado por RPCs. Referências: `20260929120000_ledger_wallet.sql:18-24,26-79,85-110`.
- `subscription_charges` tem RLS, leitura do próprio negócio e escrita revogada para anon/authenticated (`20261106120000_subscription_charges.sql:9-39`).
- Tabelas internas em migration de hardening são revogadas de `anon`/`authenticated` e recebem privilégios de service role; functions privilegiadas listadas são explicitamente revogadas de PUBLIC.

## Achados

### DB-001 — Constraint de overlap deixa fora reservas sem profissional e aguardando sinal

- **Status:** confirmado no schema local versionado; schema remoto não verificado.
- **Gravidade:** P1 para `aguardando_sinal` (cruza pagamento) e P2 para `professional_id IS NULL`.
- Detalhes e reprodução segura estão em BOOK-001/BOOK-002.

### DB-002 — Estado do schema remoto e policies aplicadas não foram validados

- **Status:** inconclusivo, bloqueio de acesso.
- **Gravidade:** P1 para completude desta auditoria; não é achado de defeito do SaaS.
- `supabase/config.toml` aponta para `qagotnmdqjoodoudcikd`; MCP listou apenas projeto não relacionado e recusou `list_tables` para `qagot` com erro de permissão. Migrations locais e relatórios históricos não substituem leitura do catálogo/`schema_migrations` remoto.

## Próxima validação

- Acesso read-only ao alvo correto para consultar schema, RLS, policies, triggers, funções, extensions e versões aplicadas.
- Comparar todas as tabelas e índices com tipos gerados e migrations. Priorizar restrições de agendamentos, `deposit_payments`, webhook inbox, `wallets`, `ledger_entries`, `withdrawals`, CPF e queues.
- Fazer reconciliação agregada e sem identificadores pessoais entre ledger e carteiras somente se acesso for concedido.
- Confirmar se views/SECURITY DEFINER/functions públicas atendem grants e `search_path`; o código/migrations foram apenas triados.

## Matriz estática de acesso financeiro — migrations locais

| Tabela | Acesso anon/authenticated em migrations | Escrita privilegiada | Evidência local | Limitação |
|---|---|---|---|---|
| `deposit_payments` | `REVOKE ALL` para `PUBLIC`, `anon`, `authenticated`; policy antiga de owner removida | `service_role` | `20260918010000_a1b2c3d4-e5f6-4789-9abc-def012345678.sql:56-59` | Confirmar grant/policy efetivos em produção; código de leitura owner usa server functions |
| `agpay_webhook_events` | RLS habilitada e `REVOKE ALL` para `PUBLIC`, `anon`, `authenticated` | `service_role` | `20260926100655_agpay_gateway_foundation.sql:30-57` | Não foi consultada a inbox remota |
| `ledger_entries` | RLS; SELECT autenticado se business.owner_id = auth.uid(); INSERT/UPDATE/DELETE revogados | `service_role`; trigger impede UPDATE/DELETE | `20260929120000_ledger_wallet.sql:52-68,95-102` | Role efetiva e volume não verificados |
| `wallets` | RLS; SELECT autenticado só para owner; INSERT/UPDATE/DELETE revogados | `service_role` | `20260929120000_ledger_wallet.sql:104-111` | Sem conciliação remota |
| `withdrawals` | RLS e SELECT próprio; INSERT/UPDATE/DELETE revogados | `service_role` | `20260928190000_withdrawals.sql:19-25` | Sem estado remoto de pedidos |
| `subscription_charges` | RLS e SELECT próprio; INSERT/UPDATE/DELETE revogados | `service_role` | `20261106120000_subscription_charges.sql:29-39` | Sem histórico de cobranças de produção |
| `pix_key_approvals` | Dono lê/insere; update/delete revogados; insert atualizado exige owner, status pendente e campos de aprovação nulos | Server functions Master usam `service_role` | `20261007120000_trial_pix_broadcasts.sql:23-30`; `20261103000000_security_hardening.sql:203-218` | A política de leitura e grants efetivos remotos não foram verificados |
| `subscription_payments` | CRUD `authenticated` concedido; policy owner `FOR ALL`; policy adicional de SELECT para profissional ativo | Webhook e funções Master escrevem com service role | `20260902060129_a03cc3ea-196e-47eb-b342-4887bad7ed4d.sql:47-62`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:130-132` | Owner pode manipular histórico exibido/consumido por dashboards (PAY-030); membros leem valor/status (SEC-011); remoto não verificado |
| `customers` | `SELECT` autenticado para owner e todo membro profissional ativo; policy não testa `view_customer_phone` | CRUD do owner e service role; policy separada de leitura membro | `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:87-101`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:122-124` | Dados/colunas legíveis dependem da policy remota; acesso amplo local detalhado como SEC-009 |
| `appointments` | `SELECT` autenticado para owner e todo membro profissional ativo; policy não testa `view_customer_phone` | Owner CRUD; profissional autenticado tem INSERT se `create_appointment`, policy confere permissão por business, sem validar campos/relações | `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:104-123`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:103-108` | Linhas incluem PII (SEC-009); INSERT direto pode bypassar invariantes/sinal (BOOK-008); produção não validada |
| `businesses` | `SELECT` integral para authenticated; policy owner `FOR ALL` e policy profissional ativo por membership | UPDATE autenticado é limitado a colunas de UI, mas INSERT/DELETE não são revogados na chain inspecionada; Master usa service role | `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:70-75`; `20261103000000_security_hardening.sql:177-206` | SELECT sensível (SEC-010), INSERT de controles comerciais (SEC-016) e DELETE com cascatas fora do fluxo Master (SEC-015); produção não validada |
| `time_blocks` | `SELECT` concedido a anon e authenticated; policy anônima `USING (true)`; owner/member têm políticas adicionais | DML autenticado protegido por owner/permission policies; service role | `20260902060129_a03cc3ea-196e-47eb-b342-4887bad7ed4d.sql:26-42`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:113-120` | SELECT anônimo inclui motivos e horários de todos os businesses; potencial SEC-012. Remoto não verificado |

### Procedimentos de ledger conferidos

`ledger_credit_payment`, `ledger_request_withdrawal`, `ledger_reverse_withdrawal`, `ledger_debit_refund` e `ledger_adjustment` são `SECURITY INVOKER`, fixam `search_path=''`, validam valores monetários não nulos/positivos (ajuste não zero), e têm execute revogado para `PUBLIC/anon/authenticated`, concedido apenas a `service_role` (`20260929120000_ledger_wallet.sql:114-379`). `ledger_request_withdrawal` bloqueia linha da wallet com `FOR UPDATE` e atualiza wallet+ledger na mesma chamada; isto protege saldo contra corrida entre saques daquele business. A idempotência global por chave é segura para o fluxo atual observado, que cria UUID do saque e deriva `withdrawal_debit:<withdrawalId>`, mas exige que futuras chamadas mantenham esse vínculo; a função SQL não valida que entrada idempotente preexistente tenha o mesmo business/withdrawal.

Esse parecer é somente sobre migrations versionadas e fluxo local. O projeto Supabase de produção recusou acesso e a cópia de migrations do repositório pode não estar integralmente aplicada.

### Dados pessoais de clientes

A chain local adiciona `customers_professional_read` e `appointments_professional_read` para `is_business_member`, enquanto a permissão `view_customer_phone` é consultada no cliente web e não aparece nas policies de leitura dessas tabelas. Como SELECT é concedido para a tabela e a policy opera por linha, profissionais ativos podem obter telefones sem a permissão granular; appointments também contém nome/telefone/notas e customers tem campos pessoais adicionais. Detalhes de impacto, limites e reprodução segura: [SEC-009](seguranca.md#sec-009-profissionais-conseguem-ler-dados-pessoais-de-clientes-sem-a-permissao-especifica-de-telefone). O catálogo remoto e dados reais não foram acessados.

### SELECT na linha `businesses`

A policy local para profissional ativo dá acesso à linha de `businesses` e o grant de SELECT autenticado herdado da migration inicial segue integral. O hardening mais recente trata UPDATE, não SELECT. A migration que move credenciais WhatsApp para tabela privada é aditiva e instrui uma migration posterior para nulificar a coluna legada, não presente nesta chain. Ver SEC-010 em [seguranca.md](seguranca.md). Conteúdo de colunas, role efetiva e versão remota não foram consultados.

### Histórico de assinatura

A chain local concede SELECT a `authenticated`, inicialmente condicionado a owner, depois ampliado por policy permissiva de membro ativo (`is_business_member`). Como RLS combina policies permissivas por OR, o profissional pode ler o histórico do business. A tabela traz valores, status e meses de referência; intenção de acesso não foi localizada. Ver SEC-011 em [seguranca.md](seguranca.md). Acesso e conteúdo de produção não foram consultados.

### Bloqueios de agenda

`time_blocks` recebe SELECT e policy anon `USING (true)`, sem filtro por business; suas colunas incluem motivo livre, horário, data, business e professional. A disponibilidade pública já é lida pelo server handler usando admin, então o grant anon não é necessário ao fluxo observado. Ver SEC-012 em [seguranca.md](seguranca.md); catálogo remoto e linhas não foram consultados.

### Storage de assets visuais

As policies locais de SELECT validam bucket e path reconhecido, mas não autorizam pelo business. A função de parse reconhece também o prefixo `staging`, permitindo potencialmente a qualquer autenticado listar/assinar assets de outros tenants, inclusive rascunhos, conforme SEC-013 em [seguranca.md](seguranca.md). Policies e objetos de produção não foram verificados.

### Matriz adicional de RLS por tabela

| Tabela/área | Policies e grants locais observados | Resultado da triagem |
|---|---|---|
| `profiles` | Grant autenticado; policy `profiles_own` compara `id = auth.uid()`; service role separado (`20260822051036...:9-12`) | Leitura/escrita restrita ao próprio perfil na chain. Catálogo remoto não validado. |
| `professionals` | Owner gerencia; profissional lê sua própria linha; `anon` recebe apenas colunas públicas limitadas em migration posterior (`20260822051036...:63-66`; `20260914061103...:77-79`; `20260916012915...:15-17`) | DML direto owner-only na policy local. Leitura pública sem filtro de business foi registrada como decisão de escopo; campos `user_id`, email e permissões foram excluídos do grant anon. |
| `services` | Owner gerencia; membro lê; anon lê apenas ativo (`20260822051036...:80-83`; `20260914061103...:81-83`; `20260902053903...:2,6`) | Valores/detalhes comerciais podem ser públicos por finalidade de catálogo. Não foi encontrada evidência de DML cross-tenant neste trecho. |
| `service_professionals` | Owner `FOR ALL` com checagem de que serviço e profissional pertencem ao `business_id`; membro e anon têm SELECT (`20260914061103...:85-102`) | Policy de escrita valida ambas as FKs contra o business indicado. Leitura anon expõe associações de linhas públicas de serviço/profissional; escopo público segue sem decisão explícita. |
| `business_hours` | Owner e membro leem; anon tem SELECT em todas as linhas (`20260902060129...:12-18`; `20260914061103...:126-128`) | Horários genéricos podem ser dados públicos; policy não restringe business. Registrar revisão de escopo, sem concluir defeito isoladamente. |
| `service_categories` | Owner gerencia; membro lê; anon lê categorias `active` (`20261011000000...:16-30`) | Texto e posição são metadados do catálogo; policy anon não escopa business. Sem payload sensível identificado. |
| `business_visual_settings` | Membro lê; `manage_appearance` governa `FOR ALL` (`20261002143000...:22-32`) | Leitura de config visual por membro parece necessária à UI compartilhada; conteúdo remoto não verificado. |
| `support_messages` | Owner lê/insere apenas sender `user`; atualização autenticada está limitada à coluna `read_by_user`; Master usa service role (`20261029140000...:21-38`; `20261103000000...:221-223`) | Ownership de conversa localmente separado. A falha do seed da saudação está em API-005. Grants base remotos não conferidos. |
| `reminder_logs` | SELECT autenticado somente quando `owns_business`; escrita service role (`20260907052710...:20-26`) | Logs limitados ao proprietário na chain inspecionada; PII de telefone depende da retenção e do conteúdo real, não consultados. |
| `client_error_log` | INSERT por service role do handler; SELECT sob `has_role(..., 'super_admin')`; sanitizer allowlist em código (`20261108122836...:17-30`; `src/lib/client-error-data.ts`) | Não há leitura autenticada geral pelas policies locais. Dados/logs de produção não verificados. |
| `outreach_templates` | Owner de negócio lê ativos; Master lê/gerencia via policy de role (`20260922105421...:27-46`) | Não há DML direto comum para authenticated; políticas de leitura dependem da existência de business do usuário. |
| `business_outreach_overrides` | CRUD authenticated sob policy que exige owner do `business_id` (`20260928210000...:16-29`) | Grant explícito a service role não aparece nessa migration | Não foi encontrado filtro cross-tenant ausente nesta policy; reconciliação de privilégios remotos pendente. |
| `asaas_business_credentials`, `asaas_webhook_events` | `REVOKE ALL` para PUBLIC/anon/authenticated; RLS ativa | Exclusivo `service_role` (`20260918010000...:27-38,64-84`) | Secrets e payloads não consultados; Asaas não é runtime ativo segundo adaptadores pesquisados. |
| `agpay_webhook_events` | `REVOKE ALL` para PUBLIC/anon/authenticated; RLS ativa | Exclusivo `service_role` (`20260926100655...:30-57`) | Inbox remota não examinada. |
| `business_whatsapp_credentials`, `whatsapp_greeting_replies` | `REVOKE ALL` para anon/authenticated; RLS ativa | Exclusivo `service_role` (`20261002150000...:2-12`; `20261012120000...:7-16`) | Compatibilidade da credencial WhatsApp legada em `businesses` está em SEC-010; conteúdo não lido. |
| `auth_attempts`, `platform_settings`, `subscription_lifecycle_runs`, `post_service_message_queue` | `REVOKE ALL` para anon/authenticated; RLS ativa | Exclusivo `service_role` (`20261103000000...:6-15,55-89`) | Funções de worker também têm execute restringido; remoto não verificado. |
| `sdrs`, `sdr_config`, `sdr_ideas`, `master_impersonation_sessions` | Loop hardening habilita RLS e revoga ALL de anon/authenticated | Exclusivo `service_role` (`20261103000000...:225-233`) | Segredos/config não lidos; handlers/token SDR são revisão separada. |
| `withdrawals`, `subscription_charges` | SELECT do owner para sua própria conta; INSERT/UPDATE/DELETE revogados para anon/authenticated | Exclusivo `service_role` para escrita (`20260928190000...:19-25`; `20261106120000...:29-39`) | Compatibilidade remota não confirmada. |
| `master_business_notes`, `master_business_events` | Grant SELECT authenticated, policy `FOR ALL` com `has_role(auth.uid(),'super_admin')` (`20261023120000...:61-76`) | service role para CRUD administrativo | A política local restringe leitura/escrita aos Master; role e migration aplicadas desconhecidas. |
| `pix_key_approvals` | Owner SELECT e INSERT pendente; update/delete revogados a authenticated; INSERT exige status pendente e campos decisórios nulos (`20261007120000...:23-30`; `20261103000000...:203-218`) | Master/service role aprova | Chave Pix é dado sensível; dados remotos não lidos. |
| `broadcasts` | Policy SELECT aceita authenticated (`20261007120000...:16,24-25`) | Grant e caminho de escrita não estão explícitos nessa migration | A intenção é aviso amplo a usuários autenticados; confirmar privilégios efetivos e conteúdo publicado no remoto. |

Esta matriz é uma triagem da chain versionada e não afirma que grants/policies estão ativos no projeto remoto.

## Integridade do tenant em categorias (SEC-021)

`services.category_id` tem uma FK simples para `service_categories.id` com `ON DELETE SET NULL`; não há verificação de igualdade entre `services.business_id` e `service_categories.business_id`. Na chain local, owner de A vinculou serviço A à categoria B sob sua própria policy de serviço; owner B pôde apagar sua categoria e a ação referencial zerou o vínculo na linha de A. O ensaio ocorreu em DB descartável e transaction com rollback. Deploy remoto não verificado. Ver reprodução e risco em [seguranca.md](seguranca.md).

## Validação isolada da chain de migrations — 2026-11-13

- `npm run db:ensaio:check` terminou com exit code 0: 71 migrations foram aplicadas a um Postgres 17 embutido, vazio e temporário. A mensagem de término síncrono do runtime não alterou o código de saída; o diretório temporário foi removido.
- Em segunda execução do mesmo ensaio, foram consultados somente `information_schema.role_table_grants` e `pg_policies`; nenhuma linha de negócio foi criada ou lida. Resultado observado após a chain completa:

| Tabela | Grants/policies finais relevantes no ensaio |
|---|---|
| `businesses` | `authenticated` conserva INSERT e DELETE (UPDATE não listado); `businesses_own` é `FOR ALL` com `owner_id = auth.uid()`; `businesses_professional_read` permite SELECT ao profissional ativo do negócio. Confirma a superfície local de SEC-015/016/010. |
| `appointments` | `authenticated` tem INSERT/SELECT/UPDATE/DELETE; policy de INSERT profissional verifica só `has_business_permission(...,'create_appointment')`; SELECT profissional usa membership. Confirma a superfície local de BOOK-008/SEC-009. |
| `professionals` | `authenticated` conserva INSERT/UPDATE/DELETE sob `professionals_owner FOR ALL`; não apareceu policy de teto de quantidade. Confirma a superfície local de PRO-001. |
| `time_blocks` | `anon` tem SELECT e policy `time_blocks_public_read` com `qual=true`. Confirma a superfície local de SEC-012. |
| `subscription_payments` | `authenticated` tem CRUD; policies permitem `SELECT` a membros e `FOR ALL` ao owner. Confirma a superfície local de SEC-011/PAY-030. |

- O ensaio valida apenas a reexecução da chain versionada no stub local. Não prova que essas migrations foram aplicadas no projeto `qagotnmdqjoodoudcikd`, nem demonstra consultas/inserts reais por usuários autenticados ou o conteúdo de produção.
- Em segundo conjunto de fixtures, um profissional `authenticated` com `view_customer_phone=false` leu `customers.phone/email/notes` e `appointments.customer_phone`; `anon` leu o campo `reason` de bloqueio sentinela. As consultas passaram na chain local em transação revertida. A descrição de cada cenário e as limitações estão em SEC-009/SEC-012.
- Outro replay demonstrou que profissional ativo lê a linha sintética de `subscription_payments` e owner consegue alterá-la/removê-la sob `authenticated`; a transação foi revertida. Ver SEC-011 e PAY-030.
- **DB-003 corrigido localmente (2026-11-15):** JSDoc de `startEnsaio()` agora descreve `{url, pg, applied, failures, stop}`, igual ao objeto retornado (`scripts/ensaio/db.mjs`). `node --check scripts/ensaio/db.mjs` passou; nenhuma instância de Postgres foi iniciada.

### Superfície pública de catálogo

A chain mantém leitura anônima de `business_hours`, serviços ativos, profissionais ativos, vínculos de serviço/profissional e categorias ativas. `20260916012915` limita as colunas públicas de `businesses` e `professionals`, mas as policies `businesses_public_read`/`professionals_public_read` não filtram slug ou business; a policy inicial de `business_hours` também usa `true`. Os handlers públicos encontrados buscam o catálogo por slug com cliente admin, sem exigir essas leituras diretas. SEC-014 registra como risco P3 potencial a enumeração global, condicionada a confirmar se há diretório público e se negócios não publicados devem ficar ocultos. Não foram consultadas linhas reais.
- `user_roles`: authenticated tem leitura própria e leitura Master via policy; a função `has_role` teve execute revogado de PUBLIC/anon e concedido a authenticated/service_role numa migration posterior (`20260907045316_856b1ad9-ac27-4eca-a1de-d2ebce788209.sql:3-35`; `20260914061139_fd193e2a-a656-422c-be9f-e9adccb68a92.sql:1-2`). Roles não podem ser gravadas diretamente pelo cliente na migration inicial.

## DB-005 — inbox AgPay não tem retenção/expurgo versionado

- **Estado:** ausência de mecanismo local de expurgo confirmada na varredura; volume, payloads e retenção do banco remoto desconhecidos.
- **Gravidade:** P3 potencial (crescimento acumulado de tabela/índices e retenção maior que a necessária de dados de eventos).
- **Módulo:** banco de dados / pagamentos / retenção.
- **Observado:** a migration cria `agpay_webhook_events` com `payload jsonb` integral, `dedupe_hash` único, campos de estado/erro e dois índices (`20260926100655_agpay_gateway_foundation.sql:30-57`). O recebimento faz upsert por hash do corpo e o worker atualiza a mesma linha; a varredura em `src/`, migrations, `ops/` e runbooks não encontrou DELETE, partição, arquivamento ou job de limpeza dessa tabela. Eventos com referência local ausente podem passar a `error` após 24 h, mas permanecem registrados (`src/lib/agpay-events.server.ts:568-630`).
- **Impacto:** se a tabela crescer continuamente no ambiente ativo, aumenta armazenamento e tamanho de índices/backups; se payloads contiverem PII ou outros dados excessivos do provedor, eles ficam retidos sem prazo local definido. O conteúdo real e o volume por dia não foram consultados.
- **Causa-raiz:** a inbox preserva deduplicação e evidência de processamento, mas não há política ou processo de ciclo de vida observável na chain versionada.
- **Reprodução segura:** consulta somente a `pg_policies`, `information_schema`, migrations e jobs locais mostrou tabela sem operação de exclusão local; nenhuma linha foi contada/lida no banco real.
- **Correção recomendada para spec:** definir retenção por estado/idade, anonimização ou arquivo seguro e uma estratégia de dedupe que preserve a janela necessária após expurgo (por exemplo, tombstones compactos com prazo explícito); alertar quando volume/idade de `pending`/`error` superar limites operacionais.
- **Regressão:** limpeza remove somente eventos fora do prazo; evento dentro da janela continua idempotente; tombstone impede replay durante prazo definido; retenção de payload corresponde a política aprovada.
- **Limitação:** não prova crescimento atual, presença de PII, ausência de backup/retention gerenciados externamente nem impacto observado em produção.


### DB-002 / acesso de leitura ao Supabase — 2026-11-15

O conector Supabase retornou `You do not have permission` para `get_project`, avisos de segurança e lista de migrations no projeto `qagotnmdqjoodoudcikd`. Verifiquei também o caminho REST local documentado: GET ao catálogo `/rest/v1/` com as credenciais do `.env` respondeu HTTP 200 e expôs metadados de 62 endpoints; o corpo completo foi descartado e nenhuma linha de cliente/negócio foi consultada. `Accept: application/vnd.pgrst.openapi+json` recebeu HTTP 406; `Accept: application/json` foi aceito. O catálogo REST não expõe endpoint de migrations, então políticas, schema aplicado, versionamento remoto e filas continuam sem verificação. Nenhum segredo foi impresso e nenhum dado ou configuração foi alterado.

### DB-005 — contagem agregada da inbox AgPay (2026-11-15)

A chain local segue sem rotina de retenção/expurgo ou prazo de retenção. Fiz leitura REST somente agregada à tabela `agpay_webhook_events`: GET com `select=id&limit=0` e `Prefer: count=exact` respondeu HTTP 206 com `Content-Range: */2`; o corpo foi descartado e nenhum payload/ID foi lido. Isso registra 2 linhas no instante da consulta, sem provar retenção gerenciada/backup nem definir a janela de dedupe necessária. Nenhum expurgo executado. Prazo/política de retenção continuam necessários antes de adicionar exclusão automática. Sem mudança de código. Tally histórico reportado 128/17/6 não reconciliado item a item.


### Reconciliacao ADM-001/DB-003/DOC-001/PRO-001/PAY-022/PAY-027/PAY-029 - 2026-11-15

Regressao atual: 10 arquivos/144 testes unitarios aprovados e 1 ignorado; DB do limite de profissionais passou 2/2 filtrado; node --check scripts/ensaio/db.mjs passou. ADM-001: status cancelado e apresentado como Cancelado. DB-003: JSDoc bate com retorno. DOC-001: nota separa deploy aa4a32e do HEAD 323189d; git confirma 24 commits posteriores e ancestralidade do hash, sem confirmar producao. PRO-001: limite de 10 bloqueia cadastro acima do teto em DB e fluxo server-side. PAY-022: hook pagina todas as empresas. PAY-027: pagamentos anteriores impedem classificacao trial/cancelamento indevido. PAY-029: evento de refund sincroniza ledger, status e agregados; contrato oficial de refund e regra de retencao de comissao seguem nao verificados. Sem cron, webhook, conta, deploy ou dados remotos.


Complemento DB-002 (2026-11-15): a tentativa atual pelo conector confirmou falta de permissão para o ref qagotnmdqjoodoudcikd; a lista de projetos mostrou somente um projeto de peptídeos. GET HTTP 200 anotado anteriormente expôs só o catálogo de metadados; schema/policies/migrations continuam sem validação remota.


### DB-002 revalidado por conexao PostgreSQL somente leitura ? 2026-11-15

A conexao obtida por `DATABASE_URL` no `.env` foi aberta com `default_transaction_read_only=on` e cada consulta de catalogo ocorreu em transacao `READ ONLY` seguida de `ROLLBACK`. Nenhuma linha de negocio foi consultada. O catalogo retornou 62 migrations aplicadas, ultima versao `20261108122836`; a arvore local contem 90 arquivos SQL, dos quais 38 versoes nao aparecem no registro remoto, e 9 versoes remotas nao existem na arvore local. A divergencia indica que nao se deve aplicar automaticamente a cadeia local. RLS esta habilitado nas 39 tabelas publicas consultadas; nomes e expressoes de policies foram lidos para businesses, customers, professionals, appointments e services. O conector Supabase continua negando listagem de migrations e advisors. Estado de policies e migracoes ficou parcialmente verificado por SQL read-only; advisors, logs e configuracao operacional continuam sem acesso. Nenhum dado, schema, migration ou config foi alterado.


**SEC-014 (2026-11-15):** migration local `20261115113000_restrict_anon_catalog_reads.sql` revoga grants an?nimos de tabela e coluna no cat?logo direto. O endpoint de reserva por slug usa `service_role`; cobertura Postgres no ensaio passou. N?o aplicar remotamente antes de reconciliar o hist?rico de migrations.

### DB-002 — histórico remoto recuperado e comparado (2026-11-15)

`supabase migration list` em modo read-only mostrou 62 versões remotas e 91 arquivos locais antes da recuperação. `supabase migration fetch` recuperou nove arquivos cujo SQL ainda estava salvo no histórico remoto; após copiá-los para a árvore local, a conferência ficou em 62 remotas/100 locais, 0 remotas sem arquivo e 38 apenas locais. Das 38, 18 são versões antigas/renumeradas já rastreadas no repo (duas correspondem a versões remotas sob timestamp diferente) e 20 são migrations novas, locais e não commitadas da auditoria. Não apliquei nem corrigi history remoto: sem confirmar todos os 18 legados e revisar o rollout, `db push` pode executar SQL fora de ordem.
### DB-002 / estado de produção confirmado por leitura direta — 2026-11-16

A conexão PostgreSQL de `DATABASE_URL` foi usada somente em transação `READ ONLY`. O histórico remoto tem 62 versões; a pasta local tem 102 migrations: 40 ausentes no histórico (18 arquivos legados/renumerados anteriores ao baseline e 22 posteriores à versão remota mais recente), zero versões remotas sem arquivo. A tabela `public.ledger_entries` existe.

A migration local `20261116060100_secure_master_aal2_and_business_private_data.sql` **não está aplicada em produção**: `has_super_admin_aal2()` não existe; `authenticated` ainda tem SELECT de tabela em `businesses` e lê `owner_cpf` e `withdrawal_pix_key`; seis policies Master correspondentes seguem sem requisito AAL2. A correção local depende de rollout coordenado com o código que move essas leituras para `supabaseAdmin`; aplicar apenas a migration quebraria fluxos da imagem atualmente servida.

No VPS, serviço Docker Swarm `agenda-agora_app` está 1/1 e saudável, mas a imagem ativa foi criada em 12/11/2026. `/auth` respondeu HTTP 200 nos três domínios públicos consultados. O runtime é EasyPanel/Docker Swarm; o script de release local baseado em `systemd` não descreve esse runtime. Nenhuma alteração remota foi feita. MCP Supabase continua sem permissão neste projeto, embora a conexão PostgreSQL read-only pelo `.env` funcione.

Não avançar com `supabase db push` até resolver as 18 versões legadas e revisar/ordenar as 22 novas, comparar schema com o estado remoto e preparar rollback. PAY-007 também segue sem contrato público AgPay de estorno.
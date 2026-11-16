

### SEC-007 ? PIN adicional e decisao de politica (2026-11-15)

Handlers de aprovacao/edicao exigem super_admin/AAL2 por `assertSuperAdmin`, sem PIN UI server-side. Teste `pix-approvals.functions.test.ts` 2/2, mocks apenas. Nao houve escrita real. Confirmar se PIN extra deve autorizar a operacao; somente se sim, criar step-up server-side protegido contra replay.


### DEP-007 ? consulta read-only de logs negada (2026-11-15)

`supabase_query_logs` com query limitada a fontes de log nas ultimas 24h retornou `You do not have permission`; SSH read-only segue negado conforme tentativa anterior. Nao verificar cron/fila atuais; nao executar worker/reprocessamento nem expor segredo. 401 de 13/11 e evidencia historica.


### DEP-007 ? agregados da fila em 2026-11-15

Transacao PostgreSQL read-only, queries apenas agregadas. `agpay_webhook_events`: 2 pending recebidos 05-06/11, 0 tentativas; `post_service_message_queue` e `reminder_logs` vazias; ultima linha do lifecycle run em 03/11, 1 business escaneado, zero notices/cancellations. Evidencia mostra ausencia de progresso recente registrado, sem provar causa ou estado dos crons. MCP logs/SSH negados. Nao reprocessar e nao chamar workers.


Complemento DEP-007: `pg_extension` nao mostra `pg_cron` nem `pg_net`; jobs nao sao agendados por essas extensoes nesse banco. Cron externo permanece desconhecido, SSH/logs negados.




### 2026-11-15 - SEC-014 local correction

Migration `20261115113000_restrict_anon_catalog_reads.sql` revokes anon table/column grants on seven catalog tables and removes matching policies. `/agendar/$slug` loads data through a server function using `service_role`; no directory route exists in this repository. RED confirmed anon SELECT on `business_hours`; GREEN: security-hardening 57/57 and booking.functions 117/117. Disposable database only; no remote apply, deploy, push, or commit. DB-002 migration drift remains unresolved.


### 2026-11-15 - SEC-021 revalidado

Teste `service-category-tenant-integrity.test.ts` passou 2/2 no banco descartavel: a FK composta bloqueia categoria de outro tenant e preserva `business_id` no ON DELETE SET NULL. A migration faz preflight e aborta sem alterar constraints diante de vinculos legados cruzados. Nenhuma migration remota aplicada.


### 2026-11-15 - BOOK-010 revalidado

`getOpenDays` diferencia erro de consulta de expediente vazio e propaga falhas de `businesses` e `business_hours`. Teste focal: 2/2. Somente valida??o local; produ??o n?o consultada.


### DEP-007 - causa de producao confirmada por leitura (2026-11-15)

SSH read-only ao host `srv2024818` confirmou `agenda-agora_app` 1/1 healthy (up 3 dias) e `agenda-agora_cron` 1/1 running (up 4 semanas; zero reinicios no container atual). O cron invoca `/api/public/hooks/agpay-events` a cada minuto e `/api/public/hooks/whatsapp-reminders` a cada hora. Agregados dos ultimos 24 h: 1.440 respostas HTTP 401 em AgPay e 24 em lembretes; o cron registrou `FALHOU` em cada tentativa. A variavel `AGENDA_CRON_SECRET` existe nos dois containers, mas os valores diferem; o app nao tem `AGENDA_CRON_SECRET_PREVIOUS`. Comparacao feita sem imprimir nem registrar valores/hash. Causa confirmada: secret divergente entre cron e app. Nenhum secret/container foi alterado; correcao exige alinhar a configuracao no deploy e recriar/reimplantar o servico, depois validar respostas 2xx.


### PAY-033 corrigido localmente com contrato oficial (2026-11-15)

A pagina oficial `https://agpay.services/documentacao` responde HTTP 200 e lista 400 (Bad Request), 401 (nao autenticado), 403 (acesso negado), 404 (nao encontrado), 422 (erro de validacao) e 500 (erro interno). `pixExternalStep` agora preserva uma classificacao interna: 400/401/403/404/422 marcam a tentativa como `rejeitado`, permitindo retry controlado; 3xx, 5xx e falhas sem resposta permanecem `falhou`/`post_incerto`, sem novo POST imediato. RED: cinco casos documentados liberavam incorretamente como `falhou`; GREEN: `booking.functions.test.ts` 124/124, incluindo 302/500 ambiguos; `npx tsc --noEmit` passou. Nenhuma chamada autenticada ao gateway ou pagamento real. Sem validacao de runtime de producao.


### 2026-11-15 - reconciliacao dos 151 IDs

Classificacao item a item baseada no estado/evidencia atual em `problemas.md`: 121 corrigidos/mitigados ou resolvidos localmente/no runtime observado; 30 bloqueados/nao verificados; 0 sem triagem. Tally historico 128/17/6 substituido. INT-007 confirmou provider Evolution e contagens agregadas de um business ativo com instancia/conectado/credencial; estado live da instancia permanece sem consulta.


### PAY-015 - regra confirmada e corrigida localmente (2026-11-15)

O usuario confirmou pela captura do WhatsApp R$ 0,20 de comissao da plataforma por pagamento de sinal e R$ 3,00 por saque. `PLATFORM_FLAT_FEE_CENTS` foi alterada para 20; o custo de gateway permanece em R$ 0,75, com percentual comercial em 0%, totalizando R$ 0,95 de descontos por sinal. A taxa de saque de R$ 3,00 ja estava no codigo. Spec 005, expectativas de ledger/eventos e indice PAY-015 foram alinhados. O tally atual passa a 123 resolvidos localmente/mitigados e 28 bloqueados ou nao verificados (151 no total). Nenhum teste foi executado, sem deploy, commit, push ou alteracao remota.

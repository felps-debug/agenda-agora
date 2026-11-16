# Handoff ? auditoria Agenda Agora

## Estado e escopo

A auditoria t?cnica permanece **em andamento e parcial**. O checklist mestre consolida 151 IDs can?nicos e reconcilia os 14 relat?rios existentes. N?o presumir que os achados foram corrigidos.

- **Reposit?rio:** `C:\Users\Felps\code\agenda-agora`
- **Fontes:** `docs/auditoria-agenda-agora/`
- **Checklist:** `auditoria-agenda-agora/CHECKLIST-MESTRE.md`
- **Data do snapshot:** 2026-11-14

## Para continuar

1. Leia o achado e seu relat?rio original antes de concluir ou sugerir mudan?a.
2. Priorize P0/P1 confirmados; feche as lacunas externas/configura??o que possam mudar riscos financeiros, de seguran?a ou integridade.
3. Preserve distin??o entre confirmado, potencial/suspeito e inconclusivo.
4. Testes no checklist s?o pendentes; `checkpoint.md` registra execu??es anteriores, n?o realizadas nesta consolida??o.
5. O acesso Supabase foi verificado via `.env` usando somente GET. N?o alegue falta de acesso sem conferir o mecanismo local; nunca exponha segredos.
6. Houve relato de processos Node.js consumindo recursos. Confira estado/processos antes de iniciar tarefas pesadas.
7. N?o realizar cobran?a/repasse real, mensagens externas, muta??o de dados, migra??o ou deploy. Altera??es de estado s? em ambiente isolado sem integra??es/dados reais.

## Evid?ncias importantes j? registradas

### Pagamentos

O c?digo identificado usa adaptador AgPay; refer?ncias Asaas aparecem como hist?ricas em migrations/specs antigas. Runtime/credencial de produ??o e Dashboard AgPay n?o foram validados.

Leitura Supabase de 14/11/2026 via `.env`: quatro neg?cios ativos tinham split pendente, e-mail de split nulo e comiss?o 0%. Foram vistos 10 dep?sitos associados: seis pendentes, quatro expirados, nenhum pago; consulta do ledger retornou zero linhas nesse conjunto. Nenhuma identifica??o individual, segredo ou valor foi reproduzido. A spec 004 descreve modelo sem split por neg?cio no payload; `pendente` ? estado legado e n?o prova falha de repasse. A spec 005 registra comiss?o fixa de R$0,25, divergente do c?lculo atual de taxa fixa zero (PAY-015). Pol?tica comercial e Dashboard AgPay continuam pendentes; nenhuma perda foi demonstrada.

### Opera??es e integra??es

- **DEP-007:** snapshot hist?rico cita respostas 401 em cron de lembretes e chamadas AgPay; workers retornaram cedo. Estado de fila/efeitos e condi??o posterior precisam de confirma??o segura antes de restart/reprocessamento.
- **INT-007:** duas inst?ncias Evolution foram observadas desconectadas naquele snapshot; associa??o a neg?cios e estado atual n?o comprovados.
- N?o atribuir efeitos externos sem correla??o de eventos.

## Relato do cliente a incluir na pr?xima sess?o

O cliente relatou que a integra??o WhatsApp/Evolution conclui, mas sauda??o, confirma??o e lembrete n?o chegam em alguns fluxos. A confirma??o parece funcionar quando o agendamento ? confirmado ou inserido pela agenda do Painel 2. A sauda??o aparece na primeira mensagem e, segundo o relato, reaparece ap?s 30 minutos. A anteced?ncia do lembrete segue a configura??o; salvar nova anteced?ncia em Prefer?ncias tamb?m atualiza a Evolution.

O cliente quer mensagens padr?o para todos, inclusive clientes cujo sinal ainda n?o foi pago. Isso ainda precisa de valida??o de produto: definir qual mensagem ? correta para reserva pendente e se confirma??o/lembrete devem ser enviados nesse estado, sem comunicar pagamento inexistente. O checklist mestre cont?m roteiro de diagn?stico e aceite para esses cen?rios, ligado aos achados INT-001, INT-004/005/006/008 e BOOK-001. O relato ? requisito a validar, n?o falha t?cnica confirmada. N?o foi implementado nesta sess?o.

## Mudan?as locais pr?-existentes

O status previamente registrado do reposit?rio tinha: `D CLAUDE.md`, `?? .claude/launch.json`, `?? AUDITORIA_AGENDA_AGORA.md`, `?? docs/auditoria-agenda-agora/` e `?? docs/prompt-pro-agente-limpo.md`. Preserve tudo; n?o limpar, resetar, fazer checkout ou alterar hist?rico. Esta consolida??o criou apenas `CHECKLIST-MESTRE.md` e `HANDOFF.md` neste diret?rio.

## Limita??es

Nenhum achado foi corrigido e nenhum teste foi executado nesta consolida??o. A auditoria continua parcial; n?o declarar conformidade total. O checklist registra lacunas e n?o prova aus?ncia de problemas.

## Atualização de continuidade — 2026-11-14

- **Corrigidos no código:** DEP-001 (Zod atualizado para 4.6.7 e arrays limitados) e PAY-027 (cron/RPC distinguem trial histórico de assinatura já paga). **Achado novo TEST-001**: fixture instável corrigida; fora dos 151 IDs canônicos.
- **Bloqueados com evidência registrada no checklist:** BOOK-001 (hold de reserva sem política segura para expiração e pagamento tardio) e PAY-017 (duplicação de Pix sem ciclo de expiração/reuso durável).
- **Próximo P1:** PAY-032; preservar PAY-006 como verificação externa do Dashboard AgPay. Depois seguir demais P1 na ordem do checklist.
- **Validação:** `npm test` passou (80 arquivos, 807 testes; 8 ignorados); `npm run test:db` passou (3 arquivos, 70 testes); `npx tsc --noEmit` e `npm run build` passaram. `npm audit` não lista Zod; restam 8 achados de dependência, com Vite como único High (DEP-002). `npm run lint` segue falhando no repositório (3.647 erros e 34 avisos); detalhes no checklist.
- A migration `20261114120000_fix_paid_trial_lifecycle.sql` está apenas no working tree; nenhuma migration, dado, cobrança, produção, deploy ou push foi executado. Alterações locais preexistentes seguem preservadas; nada foi commitado.
- A auditoria continua parcial; não declarar o SaaS pronto para produção.
## Atualização de continuidade — 2026-11-14 (fim desta etapa)

- **Corrigidos:** PAY-011 (aprovação exata da chave PIX verificada server-side) e PAY-009 (PIN obrigatório e validado no comando de saque). Teste focado 30/30; `npm test` 80 arquivos, 809 aprovados/8 ignorados; `npx tsc --noEmit` aprovado.
- **Bloqueados:** PAY-032 depende de mecanismo AgPay oficial de consulta/idempotência/reconciliação; nenhum cashout real foi tentado. PAY-006 continua leitura de dashboard externo pendente.
- **Próximo:** continuar outros P1 na ordem do checklist. Auditoria parcial; não declarar o SaaS pronto para produção. Sem produção, migração remota, deploy, push ou commit.
## Atualização de continuidade — 2026-11-14 (SEC-016 e dependências)

- **SEC-016 corrigido:** migration local `20261114150000_restrict_business_owner_insert.sql` remove INSERT/DELETE por owner e mantém provisionamento por service role. `npm run test:db`: 3 arquivos, 72 testes aprovados. A reaplicação da migration antiga de hardening nos testes agora restaura as migrations posteriores.
- **DEP-002 corrigido:** Vite 8.1.5 atualizado para 8.1.7, versão corrigida do advisory atual GHSA-p4f5-76q4-ffq7. `npm audit`: 7 moderados, nenhum alto/crítico. Suíte: 809 aprovados/8 ignorados; tsc e build aprovados.
- **PAY-014 bloqueado:** falta contrato verificável da unidade/arredondamento de `amount` AgPay e falta fluxo de revisão manual definido. Não inferir comportamento financeiro.
- **Contagem canônica atual:** 6 corrigidos, 4 bloqueados, 141 pendentes dos 151 IDs; TEST-001 extra corrigido. Seguir P1 na ordem do checklist; sem produção, migração remota, deploy, push ou commit.
## Atualização de continuidade — 2026-11-14 (PAY-036)

- **PAY-036 corrigido:** HTTP 5xx e resposta HTTP 2xx sem referência deixam o saque em `processing`, sem estornar saldo. Só HTTP 422 explícito mapeado como rejeição encerra com falha. Testes focados 45/45; suíte completa 813 aprovados/8 ignorados; tsc e build aprovados.
- **PAY-006:** regra externa não verificada. A sessão de Computer Use não conectou ao Windows; nenhuma configuração foi acessada.
- **Contagem canônica atual:** 7 corrigidos, 5 bloqueados/não verificados, 139 pendentes dos 151 IDs; TEST-001 extra corrigido. Próximos P1: revisar SEC-009/010 e demais itens na ordem do checklist.
## Atualização de continuidade — 2026-11-14 (BOOK-004)

- **BOOK-004 corrigido:** booking público exige negócio ativo e sem `cancelled_at` para catálogo, profissionais, dias e reserva/PIX. Testes incluíram cancelamento automático e manual.
- **Validação atual:** `npm test` — 80 arquivos, 820 aprovados/8 ignorados; `npm run test:db` — 72 aprovados; tsc/build aprovados.
- **Contagem canônica:** 8 corrigidos, 5 bloqueados/não verificados, 138 pendentes dos 151 IDs; TEST-001 extra corrigido. Próximos P1: revalidar SEC-009/010 e prosseguir na ordem. Sem ação remota ou commit.
## Atualização de continuidade — 2026-11-14 (SEC-009/010)

- **SEC-009/010 revalidados, implementação bloqueada por arquitetura:** leitura direta de customer/appointments/businesses persiste em dezenas de componentes. Owners e profissionais compartilham a role Postgres `authenticated`; grants por coluna não os distinguem. Revogar SELECT isoladamente quebraria fluxos. É preciso definir projeções seguras por papel/permissão e migrar chamadas para API/RPC/view segura.
- **Contagem canônica:** 8 corrigidos, 7 bloqueados/não verificados, 136 pendentes dos 151 IDs; TEST-001 extra corrigido. SEC-006 aguarda experiência para AAL1→AAL2.
- **Validação:** `npm test` 820/8 ignorados; DB 72; tsc/build passaram. PAY-006 não verificado (Computer Use indisponível). Nenhuma alteração remota.

## Continuacao - 2026-11-14

- BOOK-003 corrigido localmente. Falhas nas leituras de `time_blocks`, agendamentos e checagem final de conflito bloqueiam a reserva antes de qualquer insert.
- Validacao: booking.functions.test.ts 95/95; `npm test` 823 aprovados/8 ignorados; `npx tsc --noEmit` passou.
- Contagem: 9 corrigidos, 7 bloqueados/nao verificados e 135 pendentes de 151 originais, alem de TEST-001 corrigido. Sem alteracao remota, deploy, push ou commit.

- PAY-006 segue nao verificado: apos reset/reinicializacao do Computer Use, `sky.list_apps()` ainda falha por pipe nativo Windows indisponivel. Nenhuma mudanca no Dashboard.


## Continuacao - PAY-025 - 2026-11-14

- Corrigido: contagem falha ou nula de profissionais interrompe tanto emissao de cobranca quanto resumo do ciclo; testes cobrem erro e valor valido.
- Validacao: 15 testes focados; suite 826 aprovados/8 ignorados; tsc passou. Nenhuma chamada real ao AgPay.
- Auditoria: 10 corrigidos, 7 bloqueados/nao verificados e 134 pendentes de 151 IDs; TEST-001 extra. PAY-006 ainda bloqueado por indisponibilidade do Computer Use. Sem alteracao remota, deploy, push ou commit.


## Continuacao - PAY-031 - 2026-11-14

- Aprovacao de chave e desbloqueio AG Pay seguem duas gravacoes, mas o handler agora rejeita com mensagem explicita se o desbloqueio falhar depois da aprovacao. O estado parcial fica claro para o Master; nao e transacional.
- Validacao: teste focal 2/2; suite 828 aprovados/8 ignorados; tsc passou. Sem alteracao remota.
- Auditoria: 11 corrigidos, 7 bloqueados/nao verificados e 133 pendentes de 151 IDs; TEST-001 extra. PAY-006 segue sem verificacao externa por indisponibilidade do Computer Use.


## Continuacao - BOOK-007 e TEST-002 - 2026-11-14

- BOOK-007 corrigido: falha nas consultas de vinculos/cadastro interrompe reserva; professionalId deve pertencer aos vinculos do servico e a profissional ativa do mesmo negocio; servico sem profissionais segue aceitando professionalId ausente.
- TEST-002 extra corrigido: senha temporaria do SDR agora usa prefixo valido para nao falhar aleatoriamente na validacao do login.
- Validacao: booking focal 99/99; suite 833 aprovados/8 ignorados; tsc passou. Auditoria original: 12 corrigidos, 7 bloqueados/nao verificados, 132 pendentes; TEST-001/002 extras corrigidos. Sem alteracao remota, deploy, push ou commit.


## Continuacao - BOOK-006 - 2026-11-14

- Corrigido: erro em leitura de charges, appointments, services ou professionals agora interrompe `getMyBookings`, em vez de retornar `{ bookings: [] }`.
- Validacao: booking focal 100/100; suite 834 aprovados/8 ignorados; tsc passou. Auditoria: 13 corrigidos, 7 bloqueados/nao verificados, 131 pendentes dos 151 IDs; TEST-001/002 extras.
- Nenhuma alteracao remota, pagamento, deploy, push ou commit.


## Continuacao - PAY-026 - 2026-11-14

- `getBillingCycle` propaga erro de consulta do negocio e de `subscription_payments`; historico vazio so e retornado quando a consulta teve sucesso sem linhas.
- Validacao: teste focal 3/3; suite 835 aprovados/8 ignorados; tsc passou. Auditoria: 14 corrigidos, 7 bloqueados/nao verificados, 130 pendentes de 151 IDs; TEST-001/002 extras.
- Sem alteracao remota, pagamento, deploy, push ou commit.


## Continuacao - PAY-010 - 2026-11-14

- Lookup idempotente de saque agora valida que a linha pertence ao business solicitado; colisao global de chave entre negocios e rejeitada tambem no caminho apos conflito de unicidade.
- Validacao: teste focal 33/33; suite 836 aprovados/8 ignorados; tsc passou. Nenhuma movimentacao financeira ou chamada AgPay real.
- Auditoria: 15 corrigidos, 7 bloqueados/nao verificados, 129 pendentes dos 151 IDs; TEST-001/002 extras. Sem alteracao remota.


## Continuacao - PAY-013 - 2026-11-14

- Relatorio de performance agora propaga erro de consulta e pagina `businesses`, `profiles`, `deposit_payments` e `withdrawals` em blocos de 1.000; removido teto local de 5.000.
- Validacao: fixture de 5.001 depositos integralmente agregada; foco 6/6; suite 838/8 ignorados; tsc passou.
- Auditoria: 16 corrigidos, 7 bloqueados/nao verificados, 128 pendentes de 151; TEST-001/002 extras. Sem escrita remota ou commit.


## Continuacao - PAY-019 - 2026-11-14

- `getTransactions` agora propaga erros e pagina deposits, withdrawals, businesses e profiles usando o helper compartilhado; removeu o limite de 2.000.
- Validacao: fixture de 2.001 registros completa; foco transactions 2/2 e AgPay performance 6/6; suite 840 aprovados/8 ignorados; tsc passou.
- Auditoria: 17 corrigidos, 7 bloqueados/nao verificados e 127 pendentes de 151 IDs; TEST-001/002 extras. Sem alteracao remota, pagamento ou commit.


## Continuacao - BOOK-010 - 2026-11-14

- `getOpenDays` propaga erro das consultas de business e `business_hours`; consulta valida sem expediente continua retornando `days: []`.
- Validacao: booking focal 102/102; suite 842 aprovados/8 ignorados; tsc passou.
- Auditoria: 18 corrigidos, 7 bloqueados/nao verificados e 126 pendentes de 151 IDs; TEST-001/002 extras. Nenhuma alteracao remota.

## Continuacao - PAY-022 - 2026-11-14

- Corrigido localmente: cron do ciclo de assinatura pagina negocios ordenados por ID em blocos de 1.000; erro de pagina impede sucesso parcial.
- Validacao red/green: teste com 1.001 negocios, duas faixas verificadas e `businesses_scanned: 1001`; focal 8/8; `npm test`: 83 arquivos aprovados, 3 ignorados; 843 aprovados, 8 ignorados; `npx tsc --noEmit` passou.
- Contagem: 19 corrigidos, 7 bloqueados/nao verificados e 125 pendentes dos 151 IDs; TEST-001/002 extras corrigidos. Sem cron real, cancelamento, escrita remota, deploy, push ou commit. BOOK-002 aguarda decisao sobre agenda sem profissional.

**Revalidacao em 2026-11-14 - corrigido localmente:** quando o INSERT em `deposit_payments` falha, `reserveBooking` atualiza o appointment correspondente de `aguardando_sinal` para `cancelado` antes de devolver o erro; a compensacao usa guarda pelo ID e status. Se o UPDATE falhar ou nao retornar a linha, a resposta sinaliza explicitamente que a reserva pendente nao foi cancelada. Testes cobrem falha no INSERT, cancelamento e falha na compensacao; provedor Pix nao e chamado. `booking.functions.test.ts`: 104/104; `npm test`: 83 arquivos aprovados, 3 ignorados; 846 aprovados, 8 ignorados; `npx tsc --noEmit` passou. Sem escrita remota ou geracao de Pix real.
## Atualizacao de validacao - 2026-11-14

- PAY-022 apos cobertura adicional de erro: focal 9/9; erro em page retorna HTTP 500 e nao registra run parcial.
- BOOK-005 corrigido conforme evidencia acima; booking focal 104/104.
- Validacao geral final desta continuacao: 83 arquivos aprovados, 3 ignorados; 846 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou.
- Contagem: 20 IDs originais corrigidos, 7 bloqueados/nao verificados, 124 pendentes dos 151; TEST-001/002 extras corrigidos. Sem escrita remota, cron real, cobranca, Pix, deploy, push ou commit.

**Revalidacao em 2026-11-14 - corrigido localmente:** `filterTransactionRows` aplica busca, tipo, status de deposito e status de saque; a rota usa filtros selecionados ao clicar Aplicar, reinicia a pagina e Limpar restaura os filtros e resultados. Testes unitarios cobrem tipo/status, busca, saque pendente e conjunto limpo. Focal: 2/2; regressao focal booking + cron + filtros: 115/115; `npm test`: 84 arquivos aprovados, 3 ignorados; 848 aprovados, 8 ignorados; `npx tsc --noEmit` passou. QA visual no browser nao foi executado. Nenhuma alteracao remota.
## Atualizacao - UI-002 - 2026-11-14

- Corrigido localmente: filtros de tipo e status afetam as listas; Aplicar usa os valores escolhidos e reinicia pagina; Limpar restaura todos os resultados. Busca permanece imediata.
- Validacao: helper de filtros 2/2; testes focais de booking, cron e filtros 115/115; `npm test`: 84 arquivos aprovados, 3 ignorados; 848 aprovados, 8 ignorados; `npx tsc --noEmit` passou. QA visual browser pendente.
- Contagem: 21 IDs originais corrigidos localmente, 7 bloqueados/nao verificados e 123 pendentes dos 151; TEST-001/002 extras corrigidos. Sem escrita remota, deploy, push ou commit.

**Revalidacao em 2026-11-14 - corrigido localmente:** `permissionForStatusChange` agora exige `block_schedule` ao entrar ou sair de `bloqueado`; o handler aceita `block_agenda` como alias legado e nunca usa somente membership nessas transicoes. Testes cobrem mapeamento, recusa sem permissao e aprovacao com alias; foco 8/8; `npm test`: 85 arquivos aprovados, 3 ignorados; 851 aprovados, 8 ignorados; `npx tsc --noEmit` passou. Sem alteracao remota.
## Atualizacao - API-003 - 2026-11-14

- Corrigido localmente: mudancas de status envolvendo `bloqueado` exigem `block_schedule`; `block_agenda` legado tambem autoriza. Membership isolado nao permite converter/desfazer bloqueios.
- Validacao: testes de autorizacao 8/8; `npm test`: 85 arquivos aprovados, 3 ignorados; 851 aprovados, 8 ignorados; `npx tsc --noEmit` passou.
- Contagem: 22 IDs originais corrigidos localmente, 7 bloqueados/nao verificados e 122 pendentes dos 151; TEST-001/002 extras corrigidos. Sem escrita remota, deploy, push ou commit.

**Revalidacao em 2026-11-14 - corrigido localmente:** migration `20261114204014_restrict_subscription_payment_writes.sql` remove a policy owner `FOR ALL`, revoga DML de `anon` e `authenticated`, mantém SELECT para authenticated e privilegios completos de `service_role`. Teste DB reproduziu red antes da migration (owner conseguia inserir); apos a migration, SELECT do owner segue funcionando, INSERT/UPDATE/DELETE sao recusados, e INSERT por service_role funciona dentro da transacao de teste. `npm run test:db -- --run tests/db/security-hardening.test.ts`: 49/49; suite DB completa: 3 arquivos, 73/73; `npm test`: 85 arquivos, 3 ignorados, 851 aprovados e 8 ignorados; `npx tsc --noEmit` passou. Migration local nao aplicada remotamente.
## Atualizacao - PAY-030 - 2026-11-14

- Corrigido localmente por migration aditiva: owner e profissional autenticados podem consultar o historico, mas nao inserir, alterar ou apagar pagamentos. O fluxo service_role conserva escrita.
- Validacao red/green no Postgres descartavel; DB focal 49/49; suite DB 3 arquivos, 73/73; `npm test`: 85 arquivos aprovados, 3 ignorados; 851 aprovados, 8 ignorados; `npx tsc --noEmit` passou.
- Contagem: 23 IDs originais corrigidos localmente, 7 bloqueados/nao verificados e 121 pendentes dos 151; TEST-001/002 extras corrigidos. Migration nao foi aplicada no remoto; sem deploy, push ou commit.

**Revalidacao em 2026-11-14 - corrigido localmente:** `appendRecoveryId` captura acesso/leitura/escrita do storage e devolve os IDs para estado em memoria; a reserva continua definindo `activeCharge`, abrindo o historico e mostrando o Pix. Codigo publico fica visivel no historico simples e no cartao compacto do tema elegante, mesmo sem persistencia local. Focal 2/2; `npm test`: 86 arquivos aprovados, 3 ignorados; 853 aprovados, 8 ignorados; `npx tsc --noEmit` passou. Sem reserva ou pagamento real; QA visual browser pendente.
**Revalidacao em 2026-11-14 - PAY-020 permanece pendente de definicao:** FR-021 exige lucro vindo do ledger, mas o `ledger_entries` atual registra movimentos da carteira dos negocios; nao encontrei conta/lancamento da plataforma nesse razao. `deposit_payments` guarda comissao e `withdrawals` guarda taxas, mas o significado de lucro consolidado/por saque precisa ser definido antes de trocar valor e fonte. Pergunta enviada ao responsavel; nenhum calculo financeiro foi alterado.
## Atualizacao - UI-023 - 2026-11-14

- Corrigido localmente: falha de localStorage agora mantem chargeId e codigo publico em memoria, segue para historico/Pix e mostra codigo do agendamento como alternativa de recuperacao.
- Validacao: helper focal 2/2; `npm test`: 86 arquivos aprovados, 3 ignorados; 853 aprovados, 8 ignorados; `npx tsc --noEmit` passou. QA visual browser pendente; sem reserva/pagamento real.
- Contagem: 24 IDs originais corrigidos localmente, 7 bloqueados/nao verificados e 120 pendentes dos 151; TEST-001/002 extras corrigidos. PAY-020 aguarda definicao do lucro no relatorio; sem deploy, push ou commit.

**Revalidacao em 2026-11-14 - corrigido localmente:** lista e thread de suporte exibem aviso de falha com botao de retry; dados anteriores permanecem visiveis quando houve sucesso previo, e erro inicial nao mostra estado vazio. Resposta valida sem linhas segue mostrando vazio. `npx tsc --noEmit` passou; `npm test`: 86 arquivos aprovados, 3 ignorados; 853 aprovados, 8 ignorados. Teste visual browser pendente; sem consulta ou envio de mensagem real.
## Atualizacao - UI-017 - 2026-11-14

- Corrigido localmente: erros da lista e thread mostram mensagem e retry; cache anterior permanece visivel e vazio so e mostrado apos resposta valida sem registros.
- Validacao: `npx tsc --noEmit` passou; `npm test`: 86 arquivos aprovados, 3 ignorados; 853 aprovados, 8 ignorados. QA visual browser pendente.
- Contagem: 25 IDs originais corrigidos localmente, 7 bloqueados/nao verificados e 119 pendentes dos 151; TEST-001/002 extras corrigidos. Sem mensagens reais, escrita remota, deploy, push ou commit.
## PAY-020 permanece pendente - 2026-11-14

A FR-021 pede lucro do ledger, mas o razao atual registra movimentos da carteira dos negocios e nao uma conta da plataforma. Comissao em depositos e taxa em saques estao em outras colunas, sem definicao suficiente de lucro consolidado. Decisao solicitada ao responsavel; nenhum valor financeiro foi trocado ou reclassificado.

## PAY-016 — 2026-11-14

`transaction.failed` agora procura primeiro a cobrança de depósito e, se não existir, busca `subscription_charges` pelo `provider_payment_id`. Altera somente `pending` para `failed`, com guarda condicional; estados terminais não são regredidos. Teste red/green em memória; foco AgPay 29/29; `npm test`: 86 arquivos aprovados, 3 ignorados; 854 aprovados, 8 ignorados; `npx tsc --noEmit` passou. A UI já encerra polling em `failed`; QA visual e confirmação de outros eventos de expiração permanecem pendentes. Auditoria: 26 corrigidos, 7 bloqueados/não verificados, 118 pendentes de 151, além de TEST-001/002 extras. Sem acesso ao gateway/banco remoto, deploy, push ou commit.

## UI-013 — 2026-11-14

Recebíveis agora distinguem carregamento, falha com retry e resposta válida. KPIs/calendário só aparecem após sucesso; resposta válida vazia continua permitindo zeros. Testes dos três estados 3/3; `npm test`: 87 arquivos aprovados, 3 ignorados; 857 aprovados, 8 ignorados; `npx tsc --noEmit` passou. QA visual browser e produção pendentes. Auditoria: 27 corrigidos, 7 bloqueados/não verificados e 117 pendentes de 151, mais TEST-001/002 extras. Sem escrita remota, deploy, push ou commit.

## UI-014 — 2026-11-14

Query do relatório propaga erro de appointments, services ou professionals; a página exibe erro/retry e não calcula métricas parciais. Resultado vazio válido permanece suportado. Foco 5/5; `npm test`: 88 arquivos aprovados, 3 ignorados; 861 aprovados, 8 ignorados; `npx tsc --noEmit` passou. QA visual pendente. Auditoria: 28 corrigidos, 7 bloqueados/não verificados e 116 pendentes de 151, além de TEST-001/002. Sem produção, deploy, push ou commit.

## UI-029 — 2026-11-14

Gestão de cupom fica bloqueada enquanto a query carrega, falha ou não retornou configuração; erro oferece retry. Estados do gate testados 4/4; `npm test`: 89 arquivos aprovados, 3 ignorados; 865 aprovados, 8 ignorados; `npx tsc --noEmit` passou. Nenhum cupom foi gravado; QA visual pendente. Auditoria: 29 corrigidos, 7 bloqueados/não verificados, 115 pendentes de 151, além de TEST-001/002. Sem cobrança, produção, deploy, push ou commit.

## UI-025 — 2026-11-14

Confirmação de saque agora protege PIN+saque com lock síncrono, desabilita o botão durante as mutations e libera o lock no resultado final. Teste do lock 2/2; suite: 90 arquivos aprovados, 3 ignorados; 867 aprovados, 8 ignorados; TypeScript passou. Retry após erro ambíguo ainda gera chave nova; QA visual pendente. Nenhum saque enviado. Auditoria: 30 corrigidos, 7 bloqueados/não verificados, 114 pendentes de 151, mais TEST-001/002; sem produção, deploy, push ou commit.

## UI-026 — 2026-11-14

Fila de aprovação Pix agora distingue loading/erro/vazio válido; erro tem retry, mantém resultados já carregados e não mostra fila vazia sem resposta válida. Helper 4/4; suite: 91 arquivos aprovados, 3 ignorados; 871 aprovados, 8 ignorados; TypeScript passou. Nenhuma aprovação real; QA visual pendente. Auditoria: 31 corrigidos, 7 bloqueados/não verificados e 113 pendentes de 151, mais TEST-001/002.

## UI-027 — 2026-11-14

As três páginas de lifecycle Master agora mostram loading/erro recuperável com retry; MRR e contadores não viram zero em falha e empty states exigem resposta válida. Testes de helper/componente 6/6; suite: 93 arquivos aprovados, 3 ignorados; 877 aprovados, 8 ignorados; TypeScript passou. QA visual/ambiente remoto pendentes. Contagem: 32 corrigidos, 7 bloqueados/não verificados, 112 pendentes de 151, mais TEST-001/002.

## UI-032 — 2026-11-14

Grade semanal de recebíveis agora usa `cursor`, acompanhando a navegação das setas; teste cobre semana do cursor e deslocamento para semana anterior. Foco 2/2; suite: 94 arquivos aprovados, 3 ignorados; 879 aprovados, 8 ignorados; TypeScript passou. QA visual pendente. Auditoria: 33 corrigidos, 7 bloqueados/não verificados e 111 pendentes, mais TEST-001/002.

## UI-034 — 2026-11-14

Agenda comunica explicitamente que a série de recebimentos cobre somente 120 dias e pode estar incompleta em períodos anteriores; constante compartilhada evita divergência entre filtro e aviso. Teste 1/1; suite 95 arquivos aprovados, 3 ignorados; 880 aprovados, 8 ignorados; TypeScript passou. Histórico remoto e QA visual pendentes. Auditoria: 34 corrigidos, 7 bloqueados/não verificados, 110 pendentes, mais TEST-001/002.

## UI-031 — 2026-11-14

KPI mensal de recebimentos compara o mês no fuso local, alinhado ao agrupamento da grade. Teste cobre virada para Fortaleza (1/1); suite 96 arquivos aprovados, 3 ignorados; 881 aprovados, 8 ignorados; TypeScript passou. Sem definição de fuso por estabelecimento, QA visual/remota pendentes. Contagem: 35 corrigidos, 7 bloqueados/não verificados, 109 pendentes de 151.

## UI-035 — 2026-11-14

Eixo/tooltip do gráfico AgPay agora interpretam `YYYY-MM-DD` como data civil local, sem mover o rótulo ao dia anterior em Fortaleza. Teste 1/1; suite 97 arquivos aprovados, 3 ignorados; 882 aprovados, 8 ignorados; TypeScript passou. Agregação permanece UTC; QA visual pendente. Auditoria: 36 corrigidos, 7 bloqueados/não verificados e 108 pendentes de 151.

## UI-040 — 2026-11-14

Histórico Elegance consulta disponibilidade com o profissional associado à reserva; erro de consulta tem mensagem e ação para tentar novamente, distinta da resposta válida sem horários. Teste focado 3/3; `npm test`: 98 arquivos aprovados, 3 ignorados; 885 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou. QA visual/remoto pendente. Contagem: 37 corrigidos, 7 bloqueados/não verificados e 107 pendentes de 151.

## BOOK-009 — 2026-11-14

O schema server-side de preferências agora aceita somente os quatro fusos que a tela oferece, com opções centralizadas entre ambos. Teste focal 9/9; `npm test`: 98 arquivos aprovados, 3 ignorados; 886 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou. Não houve consulta a dados de produção. Contagem: 38 corrigidos, 7 bloqueados/não verificados e 106 pendentes de 151.

## BOOK-011 — 2026-11-14

`toIso` agora verifica round-trip IANA, rejeita local times inexistentes/ambíguos e a disponibilidade não oferece esses slots. Preferências legadas fora da lista aceita são normalizadas para São Paulo. Foco em 4 arquivos: 141/141; suíte: 98 arquivos aprovados, 3 ignorados; 892 aprovados, 8 ignorados; TypeScript passou. Nenhum dado real consultado. Contagem: 39 corrigidos, 7 bloqueados/não verificados e 105 pendentes de 151.

## BOOK-012 — 2026-11-14

Schema civil compartilhado rejeita datas ISO impossíveis antes dos handlers de disponibilidade e reserva; remarcação também usa a validação. Casos de ano bissexto, dia inexistente e mês inválido cobertos. Foco em 4 arquivos: 148/148; suíte 98 arquivos aprovados, 3 ignorados; 899 aprovados, 8 ignorados; TypeScript passou. Contagem: 40 corrigidos, 7 bloqueados/não verificados e 104 pendentes de 151.



## Continuidade - 2026-11-14 (ADM-001 e API-004)

- ADM-001: KPI conta apenas status `ativo`; labels do overview, dossier e cartao rapido distinguem cancelado.
- API-004: `createTimeBlock` aceita owner e profissionais com `block_schedule` ou alias legado `block_agenda`; sem permissao, recusa antes do INSERT.
- Testes focados combinados: 11/11. TypeScript e suite completa nao repetidos por memoria limitada; nenhum teste consultou ou alterou dados remotos.
- Contagem: 42 corrigidos, 7 bloqueados/nao verificados, 102 pendentes. BOOK-008 aguarda definicao de desenho. Sem producao, deploy, push ou commit.


## Continuidade - 2026-11-14 (INT-002)

- Corrigido localmente: parser do webhook usa `remoteJidAlt` para recuperar telefone quando `remoteJid` e LID. A documentacao/codigo oficial Evolution confirma o JID alternativo normalizado.
- Foco `whatsapp-greeting.server.test.ts`: 7/7. TypeScript e suite geral nao foram repetidos por memoria; sem mensagens reais ou alteracoes remotas.
- Contagem: 43 corrigidos, 7 bloqueados/nao verificados, 101 pendentes. Checklist mestre truncado acidentalmente; nao recriar achados ausentes. Restauracao por copia original pendente.


## Continuidade - 2026-11-14 (API-008)

- Corrigido localmente: update de status de appointment condiciona a escrita ao status previamente autorizado; se mudou, retorna conflito sem sobrescrever o estado novo.
- Regressao red/green no harness; testes focados combinados em 5 arquivos: 27/27. TypeScript e suite completa nao repetidos por memoria limitada.
- Contagem: 44 corrigidos, 7 bloqueados/nao verificados, 100 pendentes. Checklist mestre permanece truncado e aguarda recuperacao; nao reconstruir secoes perdidas por inferencia. Sem producao, deploy, push ou commit.


## Continuidade - 2026-11-14 (UI-004)

- Corrigido localmente: reverter cancelamento limpa timestamps e grava `status=ativo`, alinhado ao feedback da interface.
- Testes focados de lifecycle e regressao combinados: 43/43. Sem dados remotos; TypeScript/suite completa nao repetidos.
- Contagem: 45 corrigidos, 7 bloqueados/nao verificados, 99 pendentes. Checklist mestre segue truncado e aguarda recuperacao.


## Validacao do lote corrente - 2026-11-14

- Oito arquivos focados passaram (56/56), incluindo teste integrado do webhook Evolution com `remoteJid` LID e `remoteJidAlt`. `git diff --check` sem erros.
- Suite total e TypeScript nao repetidos por memoria; nenhum teste enviou mensagem ou escreveu em ambiente remoto.
- Contagem registrada no vault: 45 corrigidos, 7 bloqueados/nao verificados, 99 pendentes. Checklist mestre original aguarda restauracao.


## Validacao geral - 2026-11-14

- `npx tsc --noEmit`: passou.
- `npm test`: 101 arquivos aprovados, 3 ignorados; 915 testes aprovados e 8 ignorados.
- Lote focal anterior: 8 arquivos, 56/56; `git diff --check` sem erros.
- Contagem: 45 corrigidos, 7 bloqueados/nao verificados, 99 pendentes. O CHECKLIST-MESTRE permanece incompleto e aguarda recuperacao do original de 712746 bytes.

## Continuidade - 2026-11-14 (INT-001)

- Corrigido localmente: saudacao WhatsApp pode ser enviada novamente apos 30 minutos; claim atomico atualizado em migration aditiva local, preservando reserva concorrente e retry apos falha.
- Regressao red/green: teste DB reprova aos 30 min com a migration antiga e passa aos 30 min com a atual; continua bloqueando aos 29:59. Testes focados WhatsApp 20/20; DB focal 5/5; `npm test` 912 aprovados/8 ignorados; DB completo 73/73; `npx tsc --noEmit` passou.
- Nenhuma mensagem ou migration remota. Contagem no vault: 46 corrigidos, 7 bloqueados/nao verificados, 98 pendentes de 151; checklist segue incompleto.
- PAY-001 permanece parcial: setters e leituras de split removidos do painel Master; a escolha sobre disponibilizar um controle por estabelecimento aguarda resposta. Campos legados do banco preservados.

## Continuidade - 2026-11-14 (INT-005/006)

- Corrigidos localmente: logs de erro deixam de bloquear lembretes; claims SQL por appointment/channel serializam cron concorrente e permitem retry após falha; falha ao ler appointments retorna HTTP 500. A migration adiciona lease de 15 minutos e funções RPC somente para `service_role`.
- Regressão: handler mockado cobre erro → retry bem-sucedido → ausência de reenvio posterior e falha da leitura; banco descartável cobre retry, sucesso terminal, seis claims concorrentes e ACL. `npm test`: 102 arquivos passaram, 3 ignorados; 914 testes passaram/8 ignorados. `npm run test:db`: 3 arquivos, 77 passaram. TypeScript e `git diff --check` passaram.
- Limite de entrega: se o provider aceitar a mensagem e o processo morrer antes de persistir sucesso, a expiração do lease pode repetir a mensagem; este provider não oferece idempotency key no caminho verificado. Nenhum envio real ou migration remota.
- Contagem: 48 corrigidos, 7 bloqueados/não verificados e 96 pendentes dos 151 IDs; checklist-mestre segue truncado e aguarda restauração do original.

## Continuidade - 2026-11-14 (SEC-022)

- Corrigido localmente: senha temporária do reset fica associada ao business que a gerou, só é renderizada na ficha correspondente e é limpa ao fechar/trocar; resposta tardia do reset é ignorada se a ficha mudou.
- Teste focal de estado 1/1; `npm test`: 103 arquivos passaram, 3 ignorados; 915 testes passaram/8 ignorados. TypeScript passou. Nenhum reset real ou alteração de credencial.
- Contagem no vault: 49 corrigidos, 7 bloqueados/não verificados e 95 pendentes de 151; checklist segue incompleto e aguarda recuperação.

## Continuidade - 2026-11-14 (SEC-005)

SEC-005 corrigido localmente. A causa era o client PostgREST retornar `{ error }` sem lancar excecao, enquanto chamadas de auditoria eram aguardadas sem verificar esse valor. A edicao de contato ja tinha evento previo e validacao, e nao foi alterada. O helper do dossie e os tres fluxos de ciclo de assinatura agora propagam a falha; mutacoes ja persistidas informam explicitamente o estado parcial, e o snapshot de suporte nao e retornado sem trilha. Regressao red/green em cancelamento e edicao comercial; 3 arquivos focados, 19/19; TypeScript e `git diff --check` passaram. Contagem: 50 corrigidos, 7 bloqueados/nao verificados, 94 pendentes de 151. Sem dados remotos, deploy, push ou commit.
## Continuidade - 2026-11-14 (PRO-001)

PRO-001 corrigido localmente. O banco agora serializa insercoes/transferencias pelo lock da linha do estabelecimento e rejeita a 11a linha; o handler falha fechado quando a consulta de contagem e inconclusiva. RED confirmou INSERT direto e duas insercoes concorrentes excedendo o teto. Testes: handler 15/15, DB focal 24/24, DB completa 79/79, `npm test` 921/8 ignorados, TypeScript e diff check aprovados. Contagem: 51 corrigidos, 7 bloqueados/nao verificados, 93 pendentes. Migration `20261114232004_enforce_professional_limit.sql` e apenas local; nenhuma mudanca remota, deploy, push ou commit.
## Continuidade - 2026-11-14 (SEC-012)

SEC-012 corrigido localmente. A migration revoga SELECT anon em `time_blocks` e remove `time_blocks_public_read`. A rota publica de disponibilidade usa `admin()` com filtro de negocio; owner autenticado ainda le seus bloqueios e outro owner nao. RED reproduziu leitura anonima do motivo sentinela; green valida permission denied, leitura owner e isolamento. `booking.functions.test.ts` 116/116; DB security-hardening 52/52; DB completa 80/80; `npm test` 921/8 ignorados; TypeScript e diff check passaram. Contagem: 52 corrigidos, 7 bloqueados/não verificados, 92 pendentes. Migration apenas local, sem acesso/alteração remota ou commit.
## Continuidade - 2026-11-14 (SEC-013)

SEC-013 corrigido localmente. RED confirmou que owner de um tenant lia paths visuais do outro (`logo-*`, `services`, `background` e `staging`). A policy de logos/serviços legados e a de assets visuais publicados agora exigem membership; staging requer `manage_appearance` e UUID do uploader igual a `auth.uid()`. Testes DB cobrem owner, profissional com permissão, staging próprio e isolamento cross-tenant. DB focal 53/53, DB completa 81/81, `npm test` 921/8 ignorados, TypeScript e diff check passaram. Contagem: 53 corrigidos, 7 bloqueados/não verificados, 91 pendentes. Migration apenas local; configuração remota não consultada nem alterada.

## Continuidade - 2026-11-14 (SEC-025)

SEC-025 corrigido localmente: webhook AgPay impõe 1 MiB com validação do `Content-Length` e contagem em streaming, respondendo 413 antes do HMAC e cancelando corpo excedente. Teste focal 8/8; suíte completa 103 arquivos aprovados, 3 ignorados, 923/8 testes; TypeScript e diff check passaram. Limites da borda/produção não consultados. Contagem 54 corrigidos, 7 bloqueados/não verificados e 90 pendentes. Sem deploy, chamada externa, commit ou push.

## Continuidade - 2026-11-14 (SEC-026)

SEC-026 corrigido localmente: produção exige HTTPS para URL pública e origins; em desenvolvimento HTTP só aceita loopback. Teste focal 8/8 e TypeScript passaram; suíte completa pendente após a alteração. Configuração implantada/terminação TLS não verificadas. Contagem 55 corrigidos, 7 bloqueados/não verificados, 89 pendentes.



## SEC-006 local completion - 2026-11-14

SEC-006 corrected locally: Master guards require current role and AAL2; AAL1 login follows TOTP at `/painel/master-auth`, and the Master panel redirects sessions without AAL2. Four focused files, 33/33 tests; TypeScript and diff check passed. Deployed auth settings and real user factors remain unverified; no remote action. Count at this point: 56 corrected, 6 blocked/unverified, 89 pending.


## Continuity - 2026-11-14 - ADM-002

- Corrected locally: owner role upsert errors now fail closed and remove the newly created Auth user.
- On business insert error, the handler checks whether a business exists for the owner. It preserves the account if lookup is inconclusive or a row exists; otherwise it removes the owner role and Auth user. Partial cleanup failures are surfaced.
- TDD red/green; 3 focused tests pass (role failure, confirmed business failure, ambiguous reconciliation); `npx tsc --noEmit` passes. No real account or remote write.
- Count: 57 corrected locally, 6 blocked/unverified, 88 pending of 151.


## ADM-003 local completion - 2026-11-14

- Corrected locally: SDR onboarding stops on owner-role upsert error and deletes the new Auth user. On business insert error, it checks by owner_id and compensates only after confirming absence; uncertain outcomes preserve the account for reconciliation.
- Regression tests forced role and business insert failures; 8 tests in `src/lib/sdr.functions.test.ts` pass. `npx tsc --noEmit` passes. No real account or remote write.
- Count: 58 corrected locally, 6 blocked/unverified, 87 pending of 151.


## ADM-004 local completion - 2026-11-14

- Corrected locally: changing an SDR login email requires a new PIN; server and edit form both validate this. With a new PIN, the hash is regenerated for the new email. Other edits with unchanged email still allow an empty PIN.
- Tests cover rejected email change without PIN, successful change with new scrypt hash, and unchanged email without PIN. `src/lib/sdr.functions.test.ts` 11/11; `npx tsc --noEmit` passed. No real credentials changed.
- Count: 59 corrected locally, 6 blocked/unverified, 86 pending of 151.


## SEC-019 local completion - 2026-11-14

Impersonation return now checks errors from attempts UPDATE and token DELETE. It fails closed if an incorrect-PIN attempt cannot be persisted, and does not issue a Master session unless the one-time token was deleted successfully. Tests inject UPDATE/DELETE failures; impersonation file passes 11/11 and `npx tsc --noEmit` passes. No production session or database was accessed. Count: 60 corrected locally, 6 blocked/unverified, 85 pending of 151.


## BOOK-009 local verification - 2026-11-14

The local tree already constrains `preferencesPatch.timezone` to the supported `PANEL1_TIMEZONES` values and normalizes unsupported legacy values to the default. The audit record had not been updated. `src/lib/panel1-config.functions.test.ts` passes 9/9, including invalid rejection and supported acceptance. Deployed configuration not inspected. Count: 61 corrected locally, 6 blocked/unverified, 84 pending of 151.


## SEC-018 blocked - proxy chain not confirmed - 2026-11-14

`clientIp()` trusts CF-Connecting-IP/X-Real-IP, which the versioned Caddyfile passes through. Caddy documents that it sanitizes X-Forwarded-* when no trusted proxy is configured, but if a CDN is in front, trusted-proxy configuration is required; direct upstream access also depends on deployed bind/firewall. The correct canonical source cannot be selected without confirming that network path. No infrastructure was inspected or changed. Source: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy. Count: 61 corrected, 7 blocked/unverified, 83 pending of 151.


## PRO-002 local completion - 2026-11-14

New professional provisioning now removes the Auth user if role assignment fails; later profile-save failures remove role and Auth; service-link failures remove the new profile, role, and Auth, stopping if profile removal fails. Professional deletion reports Auth cleanup failure instead of returning success. Injected failure tests: `src/lib/professionals.functions.test.ts` 19/19; `npx tsc --noEmit` passed. Auth/Postgres remain separate operations and partial cleanup requires reconciliation. No remote account operation. Count: 62 corrected locally, 7 blocked/unverified, 82 pending of 151.

## SEC-017 conclusão local - 2026-11-14

Tokens SDR agora incluem versão de sessão assinada e cada requisição confere a versão atual no banco. A migration inicia SDRs existentes em versão 1 para invalidar tokens legados e deixa default 0 para novos SDRs. Mudança de PIN/email, estado ativo e logout incrementam a versão com compare-and-set; a UI só limpa a sessão depois de confirmar logout no servidor. Testes focados SDR 22/22 (17 funções + 5 tokens); DB security-hardening 54/54; TypeScript e diff check passaram. Migration local não aplicada; sem acesso a sessões reais, deploy, push ou commit. Contagem: 63 corrigidos localmente, 7 bloqueados/não verificados e 81 pendentes de 151.

## SEC-020 conclusão local - 2026-11-14

`saveProfessional` agora aceita avatar somente no prefixo `<business_id>/professional/` e com extensão de imagem publicada. O catálogo público repete a validação contra o negócio do serviço antes de assinar a URL; caminho legado inválido não produz URL. RED/green reproduziu a gravação cross-tenant no teste; validação cobre negócio diferente, staging, traversal, subpasta e extensão SVG. Foco conjunto: 4 arquivos, 51/51; `booking.functions.test.ts` 116/116; `npx tsc --noEmit` e `git diff --check` passaram. Sem acesso a objetos existentes ou deploy; sem migration, deploy, push ou commit. Contagem: 64 corrigidos localmente, 7 bloqueados/não verificados e 80 pendentes de 151.

## SEC-023 conclusão local - 2026-11-14

O catálogo público agora serializa somente `timezone`, `cancellations_enabled`, `reschedule_enabled` e `visual.layout_key` (usado pela prévia de aparência). Templates, IDs de clientes e paths internos de mídia não são devolvidos. Teste de regressão reproduziu a exposição antes da correção com valores sentinela; booking.functions 117/117, TypeScript e diff check passaram. Sem leitura de dados reais ou endpoint implantado. Contagem: 65 corrigidos localmente, 7 bloqueados/não verificados e 79 pendentes de 151.

## SEC-027 conclusão local - 2026-11-14

Autenticação SDR aceita somente PIN armazenado com scrypt. Hash SHA-256 legado deixa de autenticar e recebe instrução para redefinição pelo Master; `updateSdr` exige PIN novo, salva scrypt com salt e incrementa a versão da sessão. Testes de SDR/tokens 25/25; TypeScript e diff check passaram. Nenhum hash real foi lido; contas reais não inventariadas, sem migration ou operação remota. Contagem: 66 corrigidos localmente, 7 bloqueados/não verificados e 78 pendentes de 151.

## SEC-004 conclusão local - 2026-11-14

`verifyWithdrawalPinForOwner` agora aplica lockout persistente por usuário autenticado + negócio. Cinco falhas em 15 minutos bloqueiam por 30 minutos; contador não verificável ou não gravável falha fechado; PIN correto limpa tentativas. Testes: `withdrawal.server.test.ts` 36/36; TypeScript e diff check passaram. Limitações: sem bucket IP devido SEC-018; hash existente segue SHA-256 para cenário offline; produção não consultada. Contagem: 67 corrigidos localmente, 7 bloqueados/não verificados e 77 pendentes de 151.

## PAY-029 conclusão local - 2026-11-14

Estorno reconhecido atualiza o estado da cobrança para `estornado` após o lançamento idempotente no ledger; evento completed atrasado não reverte esse estado e erro de persistência permite retry. Relatórios de dossiê e desempenho mostram volume bruto, estorno e líquido, preservando taxas/comissão registradas porque o estorno debita apenas o líquido do negócio. Cinco arquivos focados: 77/77; TypeScript e diff check passaram. Nenhuma chamada ou escrita remota e nenhuma migration. PAY-007 ainda depende da confirmação oficial dos eventos aceitos. Contagem: 68 corrigidos localmente, 7 bloqueados/não verificados e 76 pendentes de 151. Próximo: continuar a ordem P2 do checklist; verificar itens em sequência, sem assumir que os testes aqui validam achados não relacionados.

## BOOK-005 revalidado - 2026-11-14

O código vigente compensa falha no insert de `deposit_payments` cancelando por ID e status a reserva `aguardando_sinal`; se essa atualização falhar, retorna mensagem de estado parcial em vez de ocultar o órfão. Testes incluem insert falho, compensação e erro da compensação. `npm test -- src/lib/booking.functions.test.ts`: 117/117. O registro foi atualizado sem incrementar a contagem, pois a correção já estava incluída nas 68 correções locais. Sem provider, banco remoto ou migration.


## UI-001 local completion - 2026-11-14

Removed the card option and PAN/expiry/CVV/name/CPF fields from subscription checkout until hosted integration exists. PIX and coupon remain. Selector test was RED before implementation and GREEN after; selector plus PIX regression: 2/2. TypeScript and diff check passed. No charge or remote action. Count: 69 fixed locally, 7 blocked/unverified, 75 pending of 151.


## UI-002 local verification - 2026-11-14

The current route applies the selected type/status filters to both transaction lists through `filterTransactionRows`, and Apply/Clear reset pagination. Focused utility tests pass 2/2 for type, status, search, and clearing. No production data or browser session used. Count: 70 fixed locally, 7 blocked/unverified, 74 pending of 151.


## UI-003 local resolution - 2026-11-14

The Comparativo Evolutivo card is visibly disabled, labelled "em breve", and exposes aria-disabled. Its misleading success toast was removed. Focused component tests pass 2/2; TypeScript and diff check passed. Scope of a real report is not in the reviewed specs, so it remains explicitly unavailable. No external service accessed. Count: 71 fixed, 7 blocked/unverified, 73 pending of 151.


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


## UI-030 local fix - 2026-11-14

The rejected-charge KPI now shows an em dash and "Metric unavailable" instead of a fabricated zero. No source/window or live data was assumed. Focused tests 4/4; TypeScript and diff check passed. Count 72/7/72 of 151.


### UI-031/UI-032/UI-034 revalidated (2026-11-14)

Receivables now uses local month boundaries for the monthly KPI, computes the visible week from the selected cursor, and shares the 120-day history limit between the server query and a visible notice that older periods may be incomplete. Focused date/calendar/history tests: 4/4. No production buckets or remote data inspected. These items were already counted among local fixes; total remains 72/7/72 of 151.


## UI-033 local resolution - 2026-11-14

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
## Continuidade — 2026-11-15 — DEP-005 mitigação parcial

O unit local `agenda-subscription-lifecycle.service` foi configurado para `Restart=on-failure`, intervalo de 5 minutos e limite de 3 partidas por hora. Teste estático PowerShell reproduziu a ausência da política (RED) e passou após a alteração (GREEN). A documentação oficial do systemd confirma `on-failure` para `Type=oneshot` e o controle por `StartLimitIntervalSec`/`StartLimitBurst`. `npm test`: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. TypeScript e diff check passaram. Limites: host/instalação não inspecionados; canal de alerta operacional não identificado. DEP-005 segue parcialmente mitigado, sem alterar a contagem 90/7/54. Nenhum timer ou service foi iniciado; sem mudança remota, deploy, push ou commit.
## Continuidade — 2026-11-15 — BOOK-013 e acessos externos

BOOK-013 corrigido e validado localmente. O teste RED reproduziu resposta `expirado` apesar de cobrança `pago` e appointment `agendado`; o handler agora relê o status quando a expiração condicional perde a corrida, e a interface diferencia cancelado, pago confirmado, pago sem reserva e pendente. Focal: 32/32; suíte: 121 arquivos, 1001 testes aprovados/8 ignorados; TypeScript e diff check passaram. Contagem: 91/7/53.

Verificações externas somente leitura: CUA retornou inventário vazio e indisponibilidade do browser host, então o Dashboard AgPay (PAY-006) não foi acessado. O conector Supabase listou apenas outro projeto; leitura do projeto `qagotnmdqjoodoudcikd` foi negada. Nenhuma consulta com credenciais locais, SQL, operação remota, pagamento, deploy, push ou commit foi feita. PAY-006, DB-002 e SEC-002 permanecem sem evidência atual.
## Continuidade — 2026-11-15 — UI-038

UI-038 corrigido localmente após revalidar o handler: `writeText` não era aguardado, e `copied=true`/toast de sucesso ocorriam de imediato. Helper `copyPixCode` agora só confirma após resolução e captura rejeição; UI mostra falha e preserva QR/código visível. Testes focal 2/2; suíte completa 122 arquivos/1003 aprovados/8 ignorados; TypeScript e diff check passaram. Sem browser, clipboard real ou pagamento. Contagem: 92/7/52.
## Continuidade — 2026-11-15 — UI-039

Polling de pagamento reduziu a frequência normal de 12 para até 4 chamadas/minuto por modal; retries são sequenciais, falhas aparecem na interface e backoff cresce até 60s. Teste focal 1/1; suíte 123 arquivos/1004 aprovados/8 ignorados; TypeScript e diff check passaram. A cota por IP segue compartilhada; tráfego e proxy de produção continuam sem medição. Mitigação local validada, contagem 93/7/51.

## Continuidade — 2026-11-15 — SEC-021

SEC-021 corrigido localmente. RED reproduziu a associação cross-tenant; a migration `20261115020000_enforce_service_category_business_scope.sql` acrescenta FK composta e, antes de trocar constraints, aborta se já houver vínculos cruzados. A cadeia DB passou (5 arquivos/87 testes); a suíte app passou (123 arquivos, 1004 aprovados/8 ignorados) e TypeScript passou. Contagem: 94 corrigidos, 7 bloqueados/não verificados, 50 pendentes. Estado remoto não consultado; nenhuma migration aplicada fora do ensaio descartável. Se houver links cruzados legados, a migration exige inspeção antes de prosseguir.

## Continuidade — 2026-11-15 — DOC-001

DOC-001 corrigido localmente. A nota de mudanças distingue agora o deploy registrado em 04/11 (`aa4a32e`) do HEAD observado em `main` em 15/11 (`323189d`, 24 commits posteriores) e resume as mudanças registradas no commit `742114f` de 05/11. Não há confirmação de que os commits posteriores estejam na produção. O worktree de auditoria segue com alterações sem commit/push e foi excluído do histórico de release. Contagem: 95 corrigidos, 7 bloqueados/não verificados, 49 pendentes.

## Continuidade — 2026-11-15 — PAY-033

PAY-033 permanece sem correção segura: VeoPag publica documentação de sua API direta (`POST /api/payments/deposit`), mas o app usa o wrapper AgPay (`/api/v1/payments/pix`). A documentação direta indica 422 para payload rejeitado e 500 para provedor indisponível, com `external_id` idempotente ([docs VeoPag](https://veopag.readme.io/reference/createdeposit)); não comprova que o wrapper preserve esses status/códigos. Não alterei a classificação de erro nem reenviei cobrança. Item movido para bloqueado até obter contrato AgPay aplicável. Contagem: 95 corrigidos, 8 bloqueados/não verificados, 48 pendentes.

## Continuidade — 2026-11-15 — PAY-034

PAY-034 corrigido localmente: o `UPDATE businesses.access_until` recebe predicate de compare-and-set `(access_until IS NULL OR access_until < target)`, executado de forma atômica no banco. Teste unitário red/green e teste PostgreSQL concorrente nos dois ordenamentos passaram. Suítes: app 123 arquivos/1005 aprovados/8 ignorados; DB 6 arquivos/88 testes; TypeScript aprovado. Sem migration nem uso de provider/dados remotos. Contagem: 96 corrigidos, 8 bloqueados/não verificados, 47 pendentes.

## Continuidade — 2026-11-15 — UI-036

UI-036 aguarda escolha do destino de “Como Funciona”. A proposta é âncora até a explicação já presente na tela. Pergunta enviada; nenhuma resposta ainda. A skill `brainstorming` impõe aprovação da descrição antes da mudança de comportamento, então não alterei o botão. Retomar quando houver decisão; enquanto isso, seguir outros itens. Contagem: 96 corrigidos, 9 bloqueados/não verificados, 46 pendentes.

## Continuidade — 2026-11-15 — PAY-021/PAY-023

O cron agora registra avisos por chave de ciclo (`access_until + title`) e usa índice único em `master_business_events` com upsert `ignoreDuplicates`. Isso fecha a corrida sem manter a janela de 45 dias que suprimia o mesmo alerta no ciclo mensal seguinte. Testes de rota e PostgreSQL concorrente passaram. Suítes: app 123 arquivos/1006 aprovados/8 ignorados; DB 7 arquivos/89 testes; TypeScript aprovado. Sem execução de cron/produção; migration somente no banco descartável. Contagem: 98 corrigidos, 9 bloqueados, 44 pendentes.


### UI-011 corrigido localmente ? 2026-11-15

A lista Master de notifica??es agora distingue carregamento, falha de consulta e vazio confirmado; falha oferece ?Tentar novamente? e n?o mostra o convite para criar a primeira notifica??o. O teste unit?rio dos quatro estados passou (3/3) e `npx tsc --noEmit` passou. Sem browser ou backend remoto; QA visual permanece pendente. Contagem: 99 corrigidos localmente, 9 bloqueados/n?o verificados e 43 pendentes de 151.


### INT-008 corrigido localmente ? 2026-11-15

Erros nas consultas de appointment, neg?cio, clientes selecionados e credencial n?o s?o mais tratados como aus?ncia: o item mant?m `processed_at` nulo, recebe `last_error` e libera o claim para retry. Appointment inexistente confirmado sem erro continua sendo encerrado como n?o eleg?vel. `enqueuePostServiceMessage` agora propaga falha de consulta; fallback da tabela privada s? permanece para aus?ncia reconhecida do schema. A su?te completa passou: 125 arquivos, 1.015 testes aprovados, 3 arquivos e 8 testes ignorados; `npx tsc --noEmit` passou; `git diff --check` passou com avisos preexistentes de convers?o LF/CRLF. Sem mensagem real, provider, migration ou produ??o. Contagem: 100 corrigidos localmente, 9 bloqueados/n?o verificados e 42 pendentes de 151.


### PAY-028 corrigido localmente ? 2026-11-15

As agrega??es de lifecycle, receb?veis, vis?o geral Master e dossi? agora percorrem p?ginas de 1.000 linhas com `range` e ordena??o est?vel, falhando fechado se qualquer p?gina falhar. Eventos/notas limitados a 60/100 continuam como listas recentes de interface, sem alimentar totais agregados. Teste de lifecycle com 20.001 agendamentos reproduziu o corte anterior e agora retorna todos; testes de pagina??o e integra??o: 6 arquivos/22 testes passaram. Su?te completa: 128 arquivos, 1.019 testes aprovados, 3 arquivos e 8 testes ignorados; TypeScript e diff check passaram (avisos preexistentes LF/CRLF). Sem produ??o ou migration. Contagem: 101 corrigidos localmente, 9 bloqueados/n?o verificados e 41 pendentes de 151.

### SEC-008 corrigido localmente — 2026-11-15

`deploy-release.sh` executa `npm ci --include=dev` e `npm run build` com ambiente limpo, passando somente `PATH`, `HOME` e as três variáveis públicas VITE do bundle. Teste shell com sentinelas confirma que chaves secretas Supabase/AgPay não chegam aos dois comandos; rollback, falha de restart e release saudável também passam. Suíte completa: 128 arquivos/1.019 testes aprovados, 3 arquivos/8 testes ignorados; TypeScript aprovado. O script ativo e a configuração do host seguem sem verificação; nenhuma credencial real foi lida e não houve deploy. Contagem: 102 corrigidos localmente, 9 bloqueados/não verificados e 40 pendentes de 151.

### BOOK-002 corrigido localmente — 2026-11-15

Migration aditiva adiciona exclusion constraint para reservas sem profissional por negócio, cobrindo criações e remarcações concorrentes. Mantém horários adjacentes válidos e não altera a elegibilidade atual de cancelado/aguardando sinal; a constraint com profissional segue ativa. RED reproduziu duas criações e duas remarcações simultâneas aceitas; GREEN: banco descartável com 8 arquivos/93 testes, app com 128 arquivos/1.019 testes aprovados, 3 arquivos/8 testes ignorados, TypeScript e diff check aprovados. Migration não aplicada em produção. Contagem: 103 corrigidos localmente, 9 bloqueados/não verificados e 39 pendentes de 151.

### UI-005 bloqueado por decis?o de produto ? 2026-11-15

Revalidei `sendCampaign` e `sendBirthdayCampaign`: ambos s? mostram toast de sucesso; n?o enviam, copiam nem montam conte?do utiliz?vel. A tela/spec n?o define canal, regra de consentimento ou entrega. N?o vou escolher WhatsApp, clipboard ou desativa??o sem essa defini??o. Nenhuma mensagem foi enviada. Contagem: 103 corrigidos, 10 bloqueados/n?o verificados, 38 pendentes de 151.

### Continuidade — 2026-11-15 — UI-006

UI-006 corrigido localmente: `status` agora é carregado na consulta; contagem mensal, distribuição diária e data do último atendimento usam somente `concluido`, enquanto reservas de outros estados continuam identificando clientes. Teste focal 2/2, TypeScript aprovado e suíte completa 128 arquivos/1.020 testes aprovados (3 arquivos/8 testes ignorados). Contagem atual: 104 corrigidos, 10 bloqueados/não verificados, 37 pendentes. Próximo passo: seguir os itens restantes em P3/P4, começando por UI-008/UI-018/UI-020/UI-021; revalidar causa e dependências antes de cada alteração. UI-005 permanece bloqueado por decisão de produto.

### Continuidade — 2026-11-15 — UI-018

UI-018 corrigido localmente; o rascunho permanece em caso de falha e edição feita durante o envio não se perde. Testes: focal 2/2, TypeScript aprovado, suíte completa 129 arquivos/1.022 testes aprovados (3 arquivos/8 testes ignorados). Contagem atual: 105 corrigidos, 10 bloqueados/não verificados, 36 pendentes. Continuar P3/P4 com validação por item; próximos candidatos incluem UI-008, UI-020 e UI-021, reavaliando dependências. Sem envio real, commit ou push.

### Continuidade — 2026-11-15 — UI-008

UI-008 corrigido localmente no estado de leitura: falha não aparece como vazio, há retry e não se inicia criação quando a leitura falha. Atomicidade de edição/vínculos segue em API-006. Testes de estado 3/3, encoding 1/1, TypeScript e regressão completa (130 arquivos/1.025 aprovados; 3 arquivos/8 testes ignorados). Contagem: 106 corrigidos, 10 bloqueados, 35 pendentes. Próximos itens P3 seguros a revalidar: UI-020 e UI-021; continuar sem produção, deploy, push ou commit.

### Continuidade — 2026-11-15 — UI-020

UI-020 corrigido localmente: handlers de remoção de serviço e cliente mantêm o diálogo e comunicam falha; sucesso fecha a confirmação correspondente. Teste focal 3/3, TypeScript aprovado, suíte 131 arquivos/1.028 testes aprovados (3 arquivos/8 testes ignorados). Contagem 107 corrigidos, 10 bloqueados, 34 pendentes. Próximo P3 independente a revalidar: UI-021. Sem DELETE remoto ou integração.

### Continuidade — 2026-11-15 — UI-021

UI-021 corrigido localmente: carregamento/error/retry das duas consultas não se confundem mais com lista vazia. Teste 3/3, TypeScript aprovado, suíte 132 arquivos/1.031 testes aprovados (3 arquivos/8 testes ignorados). Contagem 108 corrigidos, 10 bloqueados, 33 pendentes. Continuar P3/P4; revalidar cada achado seguro. Sem produção, push ou commit.

### Continuidade — 2026-11-15 — UI-024

UI-024 corrigido localmente; falha de leitura bloqueia gravação das taxas de referência até retry bem-sucedido. Teste focal 2/2, TypeScript aprovado, suíte 133 arquivos/1.033 testes aprovados (3 arquivos/8 testes ignorados). Contagem 109 corrigidos, 10 bloqueados, 32 pendentes. Próximo P3 independente a revalidar: UI-028. Sem alteração remota.

### Continuidade — 2026-11-15 — UI-028

UI-028 corrigido localmente com empty state global separado de filtro sem match e ação para limpar busca/filtros; query pendente/falha não é chamada de vazia. Teste 4/4, TypeScript aprovado, suíte 134 arquivos/1.037 testes aprovados (3 arquivos/8 testes ignorados). Contagem 110 corrigidos, 10 bloqueados, 31 pendentes. Próximo: conferir se restam itens P3 executáveis e seguir para P4 depois. Sem produção ou commit.

### Continuidade — 2026-11-15 — UI-022 / DB-003

P4 seguros executados: UI-022 copy do modelo Elegance corrigida, teste SSR 11/11; DB-003 JSDoc reconciliado com retorno real, `node --check` passou. TypeScript e suíte completa 134 arquivos/1.037 testes aprovados; 3 arquivos/8 testes ignorados. Contagem: 112 corrigidos, 10 bloqueados, 29 pendentes. P3 restante inclui itens de decisão/ambiente e deve ser reavaliado antes de P4 pendente. Sem produção, commit ou push.

### Continuidade — 2026-11-15 — DEP-003

Triagem atual do `npm audit`: 7 Moderate no grafo dev, zero em `--omit=dev`. A correção do advisory requer minimatch 11.0.1; parser atual declara faixa major 10. Não apliquei override devido à incompatibilidade e alterações locais preexistentes do lockfile. DEP-003 bloqueado até suporte upstream ou escolha de substituir cadeia em mudança isolada. Contagem: 112 corrigidos, 11 bloqueados, 28 pendentes.

### Continuidade — 2026-11-15 — API-005 bloqueado

API-005: policy aceita owner INSERT apenas `sender=user`, mas seed tenta `sender=master` e ignora falha. A proposta server-only preserva RLS e valida ownership, com idempotência aditiva. Gate da skill `brainstorming` aguarda aprovação do desenho antes de construir; nenhum código/migration alterado. Contagem: 112 corrigidos, 12 bloqueados, 27 pendentes. Retomar este item com a resposta; os outros P3 seguros e P4 desta rodada estão concluídos.

## Continuidade — 2026-11-15 — PAY-005

PAY-005 foi corrigido localmente: `agpayFetch` encaminha `X-Client-ID` quando `AGPAY_CLIENT_ID` está configurado, `.env.example` e runbook documentam a variável, e uma consulta GET read-only com a credencial local retornou 200 tanto com como sem o header. Documentação oficial atual usa ambos nos exemplos Pix. Teste focado 14/14; suíte completa 134 arquivos aprovados/3 ignorados e 1.038 testes aprovados/8 ignorados; TypeScript aprovado. Não houve POST, pagamento, alteração remota, deploy, push ou commit. A validação de POST em sandbox e o ambiente de produção continuam pendentes. Contagem: 113 corrigidos, 12 bloqueados/não verificados, 26 pendentes.
### Continuação — API-006 (2026-11-15)

API-006 foi corrigido localmente com migration aditiva `20261115060341_save_service_with_professionals.sql`: duas RPCs `SECURITY INVOKER` tornam atômicos serviço+profissionais e categoria+serviços. Testes DB no Postgres descartável comprovaram rollback; testes focais 30/30, suíte 134 arquivos/1.039 testes (3/8 ignorados), DB 10 arquivos/99 testes e TypeScript passaram. Nenhuma migration remota/deploy/push/commit. Ver evidência detalhada no fim de `CHECKLIST-MESTRE.md`; a divergência de contagem 113 vs 103 IDs continua sem reconciliação.
### Continuação — PAY-031 (2026-11-15)

PAY-031 foi revalidado: o erro no segundo write já é propagado explicitamente e a rota não apresenta sucesso. Teste focal 2/2; registro atualizado em `CHECKLIST-MESTRE.md` e `pagamentos.md`. As gravações ainda não são atômicas; a expectativa atual aceita comunicação clara e essa alternativa passou. Nenhuma escrita remota.
### Ciclo 81 — PAY-014 corrigido localmente (2026-11-15)

- **Causa revalidada:** o worker e a sincronização por consulta confirmavam pagamentos `completed` sem comparar o valor bruto reportado pelo AgPay com `amount_cents`; a divergência contrariava a regra em `specs/005-ledger-financeiro-saldo/spec.md:147-149`.
- **Contrato verificado:** documentação pública oficial em `https://agpay.services/documentacao` apresenta `data.amount` em reais, inclusive no exemplo de webhook. O adaptador `fetchPayment` já retorna o campo `amount` da consulta de transação.
- **Correção:** webhook e consulta agora normalizam reais para centavos e comparam com depósitos e cobranças de assinatura antes de creditar ou renovar acesso. Valor divergente, inválido ou ausente impede a confirmação; webhook divergente é retido como `error`. Divergência encontrada na consulta cria evento `payment.amount_mismatch` em `agpay_webhook_events`. A tela Master de erros lista até 30 eventos `error` com motivo, tipo, referência, horário e tentativas, sem expor o payload.
- **TDD/evidências:** teste RED reproduziu confirmação automática com valor divergente antes da correção. Testes cobrem valor menor, valor ausente, assinatura divergente, assinatura compatível e consulta de status divergente; `agpay-events.server.test.ts` + `agpay-amount.test.ts`: 50/50. Privacidade de marca: 1/1. `npm test`: 135 arquivos aprovados, 3 ignorados; 1.057 testes aprovados, 8 ignorados. `npm run test:db`: 10 arquivos/99 testes aprovados. `npx tsc --noEmit` passou; `git diff --check` sem erros (avisos LF/CRLF preexistentes).
- **Limites:** contrato de valor em reais confirmado pela documentação, mas não houve chamada ao gateway nem validação de produção. Sem migração remota, dados reais, deploy, push ou commit. Revisão manual fica disponível na tela Master de erros para usuários Master.
- **Contagem dos 151 IDs:** PAY-014 passou de bloqueado para corrigido localmente: 114 corrigidos, 11 bloqueados/não verificados, 26 pendentes. API-006 continua como correção local adicional fora da lista compacta, sem alterar esse tally.
## Continuidade — 2026-11-15

Auditoria retomada com 151 IDs canônicos e worktree preexistente preservado (256 caminhos sujos; HEAD 323189d, 12/11; sem commit ou push). Ciclos 86–89: PAY-018 e PAY-032 mitigados localmente com eventos de revisão para falha pós-gateway; SEC-022 revalidado como corrigido; INT-011 corrigido com base no envelope oficial UazAPI. Estado atual: 118 corrigidos/mitigados, 11 bloqueados/não verificados, 22 pendentes. PAY-032 e PAY-018 ainda têm risco se a inbox falhar junto com a gravação principal.

Testes desta continuação: PAY-032 51/51; INT-011 33/33; `npx tsc --noEmit` passou; `git diff --check` sem erros (avisos preexistentes LF/CRLF). Suíte completa não foi repetida porque havia processo Node preexistente com ~1,55 GB. Nada remoto foi alterado. Tentativa somente leitura de SSH para revalidar DEP-007 foi recusada pelo host (`Permission denied`); estado operacional atual permanece sem revalidação. PAY-017 e BOOK-001 seguem aguardando decisões de produto; PAY-006, DB-002/SEC-002 e outros itens de produção continuam sem acesso ou evidência atual. Próximo: continuar P1 com evidência local/externa somente leitura disponível e depois P2–P4; não declarar o SaaS pronto para produção.### Continuidade — 2026-11-15 — INT-003

INT-003 mitigado localmente por fila durável de webhook UazAPI: evento é salvo e deduplicado antes do ACK; falhas de persistência respondem 503, falhas do provider ficam pendentes com retry exponencial e o cron horário busca a fila. Migration local restringe acesso com RLS/grants. Testes webhook+cron 18/18, DB isolado 3/3, TypeScript passou; diff check sem erros com avisos LF/CRLF preexistentes. Nenhuma escrita remota, mensagem, deploy, push ou commit. Contagem 119 corrigidos/mitigados, 11 bloqueados/não verificados, 21 pendentes. Limite: sem redelivery UazAPI quando banco não registra evento; após 10 tentativas exige revisão. Próximo: continuar o backlog P2 com PAY-017 e BOOK-001 dependentes de decisão; priorizar itens locais independentes.
### Continuidade — 2026-11-15 — DEP-002

DEP-002 mitigado localmente: lockfile/instalação em Vite 8.1.7, corrigido para os dois advisories conferidos; removido `allowedHosts: true`, preservando host por IP local. Teste de configuração RED/GREEN 1/1, `npm audit` não aponta Vite; 7 moderadas restantes são minimatch/DEP-003. `npm audit --omit=dev` zero. Sem PoC, servidor de rede, alteração remota, commit ou push. Tally 119/11/21.
### Continuidade — 2026-11-15 — SEC-005

SEC-005 revalidado como corrigido localmente: helpers lifecycle/dossiê inspecionam retorno PostgREST e rejeitam falha de auditoria. Focais 19/19; documentação/checklist atualizados. Residual: evento e alteração de negócio não são atômicos; falha posterior é reportada como parcial e produção não foi verificada. Tally 119/11/21. Sem escrita remota.
### Continuidade — 2026-11-15 — PAY-021

PAY-021 já corrigido localmente: índice único por business/dedupe_key de ciclo e upsert idempotente; reescrevi status/evidência inicial para não contradizer os testes já executados. Migration remota continua não verificada. Sem código novo ou alteração de produção; tally inalterado 119/11/21.


### Continuidade — 2026-11-15 — SEC-006

Guard central atual exige JWT AAL2 e role super_admin vigente. Testes de MFA/guard 15/15. Docs Supabase confirmam semântica de AAL2; changelog sem breaking relevante. Conector lista apenas projeto Supabase não relacionado; produção qagot e fatores reais seguem sem validação. Item já estava contabilizado; tally 119/11/21.

### Continuidade — 2026-11-15 — P1 remanescentes

P0: nenhum listado. P1 localmente resolvido/revalidado: SEC-006, PAY-009/011/014, PAY-036, BOOK-004, SEC-016. P1 ainda pendente/bloqueado: BOOK-001 e PAY-017 dependem de decisão de ciclo de hold/pagamento tardio e cobrança Pix aberta; SEC-009/010 exigem mapear projeção por papel antes de reduzir grants; SEC-002/DB-002/DEP-007/INT-007/PAY-004/PAY-006 dependem de acesso/configuração/produção. Nenhum acesso remoto novo ao qagot; listagem de projetos conectados apresentou apenas projeto não relacionado. Continuar por P2 independente enquanto essas dependências persistirem.

INT-004 corrigido localmente: retry da inbox AgPay volta a tentar confirmação WhatsApp sem duplicar crédito; outbox privada separada e claim com lease de cinco minutos. Focais AgPay/WhatsApp/webhook 60/60, DB isolado 3/3, TypeScript passou. Sem migration/deploy remoto. Risco residual: provider aceitar e a finalização no banco falhar pode levar a reenvio após lease; entrega exatamente uma vez depende de idempotência do provider. Contagem 120/11/20. Prosseguir P2 após este checkpoint.
UI-029 mitigado localmente e revalidado: query de cupom em loading/erro/sem dados bloqueia edição; falha oferece retry; leitura válida mostra o estado atual. Teste gate 4/4; regressão completa 137 arquivos/1.070 aprovados, 3 arquivos/8 testes ignorados; TypeScript passou. Sem salvar cupom. Contagem 121/11/19; QA visual e produção não verificados.
UI-040 revalidado como corrigido localmente: remarcação mantém profissional original, erro de disponibilidade fica visível com retry e lista realmente vazia continua distinta. `elegance-reschedule.test.ts` 3/3 e TypeScript passaram. Relatório e índice canônico reconciliados; tally inalterado 121/11/19. QA visual não verificado.
PAY-038 bloqueado por contrato externo: código permite retry de `post_incerto` após 2 min; create Pix não envia chave ou external_id. Documentação oficial consultada via HTTPS não especifica suporte idempotente/reconciliação por chave; após timeout o UUID pode ser desconhecido. Não inventei header/campo nem travei permanentemente o cliente sem procedimento operacional. Próxima ação depende de contrato/sandbox AgPay. Tally: 121/12/18.
PAY-037 bloqueado por contrato do provider: ID externo é salvo, mas falta confirmar se consulta por UUID retorna QR quando o POST não o trouxe. Página oficial confirma campos na criação e menciona GET por UUID, sem schema de QR na resposta. Não inventei campo nem alterei código; aguardar sandbox/contrato. Tally 121/13/17.
PAY-001 parcialmente mitigado e bloqueado por definição de produto: Master não oferece mais controle de split, mas `agpay_split_status` ainda classifica recebíveis como `cartao`. Spec 004 trata recebimento de sinais; não define se flag habilita cartão em assinatura. Nenhum dado remoto ou gateway acessado. Tally 121/14/16; definir escopo antes de mudar o rótulo.
PAY-007 bloqueado por contrato: handler aceita nomes candidatos para refund/chargeback; docs públicas atuais não especificam esses eventos. Testes locais provam apenas lógica do alias assumido, não emissão real. Não alterei classificação financeira. Aguardar contrato ou payload sandbox. Tally 121/15/15.
PAY-008 bloqueado por escopo: checkout de sinal/assinatura observado oferece Pix; specs 003/004/008 não pedem cartão. A documentação AgPay atesta capacidade do gateway, não requisito do produto. Selector de assinatura testado 1/1. Aguardar decisão sobre jornada de cartão antes de integrar. Tally 121/16/14.
INT-009 parcialmente mitigado; falta definir destino autorizado. Implementado limite 3/10 min por business, validação/normalização de número brasileiro e texto fixo server-side. Endpoint/rate-limit 13/13; suíte completa 1.071/8 ignorados; TypeScript passou. Limiter em memória reinicia no restart e qualquer número válido ainda é aceito. Sem envio real. Tally 121/17/13.
DB-004 corrigido localmente: trigger valida associação tenant das referências do ledger e extrato filtra business nos detalhes. PostgreSQL efêmero: focal 2/2; DB completa 107/107; suíte geral 1.071/8 ignorados; TypeScript passou. Migration local não aplicada remotamente; dados legados sem validação. Tally 122/17/12.
BOOK-001 parcialmente mitigado: holds aguardando_sinal bloqueiam slots no app e nas constraints locais (business com/sem profissional). TDD RED/GREEN; DB 108/108; booking 117/117; suíte 1.071/8 ignorados; TypeScript passou. Migration/worker remotos não verificados; pagamento após expiração ainda pode virar pago_sem_agendamento e aguarda política financeira. Contabilizado como bloqueado residual; tally 122/17/12.
UI-032 revalidado: grade semanal usa cursor e teste 2/2 passou; já estava na lista de corrigidos, sem mudança de tally. QA visual pendente.
PAY-030 corrigido localmente: migration revoga escrita authenticated em subscription_payments; SELECT owner e escrita service_role preservados. Teste DB security-hardening 54/54. Migration remota não verificada. Tally 123/17/11.
SEC-012 revalidado: anon sem SELECT direto em time_blocks; owner lê e outro owner recebe zero linhas; teste security-hardening 54/54. Migration remota não verificada; item já contado. Tally 123/17/11.
SEC-013 revalidado: migration local exige membership para assets publicados e manage_appearance + UUID do uploader para staging. security-hardening 54/54; remoto e objetos reais não verificados. Item já contado como corrigido; tally 123/17/11.

SEC-015 corrigido localmente: migration revoga DELETE direto do owner; nova regressão DB confirma falha e preservação do negócio (security-hardening 55/55). Master/service_role mantém a via autorizada. Migration remota não verificada. Tally 124/17/10.

BOOK-011 revalidado corrigido: conversão `toIso` valida round-trip e rejeita horas DST inexistentes/ambíguas; booking.functions.test.ts 117/117. Configurações reais não verificadas. Tally 125/17/9.

UI-034 índice reconciliado: a janela histórica compartilhada de 120 dias é exibida na interface; estado já documentado na checklist de 14/11 e já contabilizado como corrigido. Sem histórico real ou validação de produção. Tally 125/17/9.

UI-031 índice reconciliado: KPI mensal usa `isInLocalMonth`, alinhado ao agrupamento local da grade; teste de fronteira 1/1. Item já constava como corrigido na checklist de 14/11. Tally permanece 125/17/9.

Índice de problemas reconciliado com evidências locais já registradas: PRO-001/SEC-008/DEP-004 corrigidos localmente; DEP-005 parcialmente mitigado (restart limitado a 3 tentativas, sem canal de alerta e sem validação de instalação). Tally sem alteração: 125/17/9.

API-003 revalidado corrigido localmente: mudanças de/para bloqueado exigem block_schedule antes do update privilegiado; teste appointments.functions.test.ts 6/6. Remoto não verificado. Tally 126/17/8.


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
## Atualização — DEP-001 — 2026-11-15

DEP-001 revalidado como corrigido localmente: Zod 4.6.7 e limites nos arrays dos schemas de profissional/serviço; testes focais passaram 50/50. Advisory oficial fixa correção a partir de 4.6.6. Produção não verificada. Nada foi alterado remotamente ou por payload de estresse. Tally 128/17/6 segue reportado, não reconciliado item a item.

### DEP-007 — revalidação de produção bloqueada — 2026-11-15

Tentativa de SSH somente leitura, não interativa, recusada por autenticação; sem alias SSH configurado. Resultado de 401 e divergência do segredo continua histórico de 13/11. Sem acesso atual a crons/filas/logs; nenhum worker executado. É necessário acesso SSH autorizado para confirmar correção e dimensionar fila. Seguir para achados locais enquanto isso.

### BOOK-003 — correção revalidada — 2026-11-15

As três leituras críticas falham fechadas; teste de `booking.functions.test.ts` passou 117/117. Produção não verificada. BOOK-003 já conta entre os corrigidos locais. Seguir nos P1/P2 locais seguros e manter DEP-007 pendente de acesso SSH.

### PAY-027 — correção local revalidada — 2026-11-15

O lifecycle considera pagamentos confirmados nas tabelas atual e histórica, e a RPC respeita a mesma exceção para contas originalmente criadas como trial. Hook 10/10 e DB 2/2 passaram. Migration não aplicada em produção. Seguir com outros P1 locais; rollout remoto segue não verificado.

### PAY-022 — paginação revalidada — 2026-11-15

O cron pagina e ordena os estabelecimentos; teste focal 1/1 com 1.001 linhas verificou total e segunda faixa. Falha de uma página não grava o run log. Produção continua não verificada. PAY-022 já está contabilizado como correção local.

### PAY-029 — correção local revalidada — 2026-11-15

Refund grava o estado da cobrança após o débito idempotente; os relatórios distinguem valor pago atual, bruto e estornado. Testes de cinco arquivos 86/86. Nome/semântica oficial do evento e retenção de comissão ainda dependem de decisão externa (PAY-007). Não houve webhook real; PAY-029 já consta como corrigido localmente.

### BOOK-005 — mitigação parcial e decisão de desenho pendente — 2026-11-15

A compensação de `reserveBooking` tenta cancelar o appointment quando a criação do intent falha, mas a falha dupla não tem reconciliação durável. Testes de booking passaram 117/117 e cobrem ambas as saídas. RPC transacional server-only foi proposta; aguardar alinhamento antes de trocar a fronteira de persistência. Seguir achados independentes enquanto isso.

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


## Atualizacao de continuidade ? 2026-11-15

- PAY-033 segue bloqueado: busca publica nao encontrou contrato do wrapper AgPay; erro continua sendo classificado genericamente sem mapear HTTP por analogia.
- DB-002 avancou parcialmente por conexao PostgreSQL read-only do `.env`: 62 migrations remotas ate `20261108122836`; 38 versoes locais ausentes no historico remoto e 9 remotas sem arquivo local. Nao aplicar migrations antes de reconciliar drift.
- RLS/policies confirmam o risco estrutural SEC-009/010: membros do business leem linhas completas de customers/appointments/services e profissional ativo le a linha completa de businesses. Nenhuma linha de negocio foi consultada.
- MCP negou leitura de migrations e advisors. Nao houve mutacao, deploy, pagamento ou leitura de segredos.


## Atualizacao de continuidade ? INT-007 (2026-11-15)

Snapshot de producao de 13/11 registrou Evolution e duas instancias desconectadas. `.env` local atual tem UazAPI configurada, `WHATSAPP_PROVIDER` ausente e sem URL/chave Evolution; o codigo local usa UazAPI por padrao. Isso nao demonstra provider atual em producao. SSH ao host foi negado; nenhum provider foi consultado ou mensagem enviada. INT-007 segue inconclusivo quanto ao runtime, estado atual e associacao business/instancia.


- PAY-005 revalidado localmente: contrato de headers do adaptador 14/14; GET read-only com/sem Client ID retornou 200 no registro anterior. Sandbox POST e runtime de producao continuam sem verificacao; nao criar cobranca.


- SEC-007: server handlers exigem super_admin/AAL2, mas nao PIN UI adicional. Teste da aprovacao 2/2 com mocks. Confirmar se PIN extra e requisito de autorizacao antes de desenhar step-up server-side.


- AgPay: busca oficial adicional por contratos de Pix/idempotencia/QR, cashout, refund e chargeback retornou vazia; contratos de PAY-007/017/032/033/035/037/038 seguem sem base para inferir estados/retries. Isso nao prova que nao existam docs; nenhuma chamada ou mutacao externa.


- DEP-007: tentativa de query_logs Supabase read-only (somente `source`, ultimas 24h) negada em 15/11; SSH tambem indisponivel. 401 de 13/11 permanece historico; nao chamar/reprocessar workers.


- DEP-007: SQL read-only agregado confirmou 2 eventos AgPay `pending` recebidos em 05-06/11, tentativas 0; lifecycle sem execucao registrada desde 03/11; lembretes e pos-atendimento sem linhas de log. Isso nao identifica causa. MCP logs/SSH negados; nao chamar workers/reprocessar.


- DEP-007: catalogo read-only confirmou sem pg_cron/pg_net instalados; cron externo segue desconhecido, SSH/logs sem acesso.

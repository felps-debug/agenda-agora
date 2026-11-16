# Checklist mestre ? auditoria Agenda Agora

> Consolida??o documental dos relat?rios existentes. N?o executa nem autoriza corre??es. Roteiros de teste abaixo n?o foram executados nesta consolida??o.

**Reposit?rio:** `C:\Users\Felps\code\agenda-agora`\
**?ndice-base:** [`problemas.md`](../docs/auditoria-agenda-agora/problemas.md)\
**Data:** 2026-11-15\
**Total:** 151 IDs can?nicos, sem duplica??o.

**Reconciliacao em 2026-11-15:** 123 corrigidos/mitigados ou resolvidos localmente/no runtime observado; 28 bloqueados/nao verificados; 0 sem triagem. O tally historico 128/17/6 foi substituido.

## Ordem de execu??o

1. P0; depois P1 confirmados, com prioridade a riscos financeiros, seguran?a, integridade e opera??es de produ??o.
2. P1 potenciais/inconclusivos: fechar evid?ncias externas e decis?es antes de qualquer mudan?a.
3. P2 confirmados; depois P2 potenciais e cobertura pendente.
4. P3 e P4 ap?s os riscos operacionais e requisitos essenciais.
5. Em cada bloco, seguir depend?ncias registradas. Nenhuma mudan?a de c?digo est? autorizada por este checklist.

## Regras de leitura

- Estado e gravidade foram preservados do ?ndice vigente; riscos suspeitos/inconclusivos n?o s?o falhas comprovadas.
- IDs repetidos s?o agrupados sob um ?nico ID can?nico; se??es e refer?ncias originais s?o preservadas abaixo.
- ?N?o explicitado? indica lacuna da fonte, n?o uma causa/requisito presumido.
- A evid?ncia PAY-003 n?o demonstra perda financeira.

## Cobertura e reconcilia??o dos relat?rios

| Relat?rio | Compara??o |
|---|---|
| [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md) | 13 achados/men??es BOOK-001?BOOK-013. |
| [`arquitetura.md`](../docs/auditoria-agenda-agora/arquitetura.md) | Mapa arquitetural e contexto; refer?ncias cruzadas mantidas. |
| [`backend.md`](../docs/auditoria-agenda-agora/backend.md) | 14 se??es; API-001 ? alias de BOOK-003. |
| [`banco-de-dados.md`](../docs/auditoria-agenda-agora/banco-de-dados.md) | DB-001 consolidado com BOOK-002; DB-003 veio de nota inline; DB-002/DB-005 mantidos. |
| [`checkpoint.md`](../docs/auditoria-agenda-agora/checkpoint.md) | Hist?rico de ciclos e testes anteriores lido; n?o tratado como cat?logo atual. |
| [`conformidade-spec.md`](../docs/auditoria-agenda-agora/conformidade-spec.md) | PAY-014/PAY-015 detalhados; DOC-001 veio da matriz T100. |
| [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md) | 39 se??es; API-009 consolidado com PAY-009. |
| [`infraestrutura.md`](../docs/auditoria-agenda-agora/infraestrutura.md) | 5 achados, incluindo DEP-007. |
| [`integracoes.md`](../docs/auditoria-agenda-agora/integracoes.md) | INT-001?INT-011. |
| [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md) | 39 se??es, incluindo PAY-* e SEC-004; duplicatas por ID. |
| [`problemas.md`](../docs/auditoria-agenda-agora/problemas.md) | ?ndice can?nico de 151 IDs ?nicos, comparado com se??es e notas inline. |
| [`relatorio-consolidado.md`](../docs/auditoria-agenda-agora/relatorio-consolidado.md) | Resumo cruzado; cobertura/limita??es comparadas sem duplicar achados. |
| [`riscos.md`](../docs/auditoria-agenda-agora/riscos.md) | 13 entradas de risco/duplicata comparadas com fonte prim?ria. |
| [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md) | 30 se??es; duplicatas mantidas pelo ID can?nico. |

**Reconcilia??o:** os 151 IDs ?nicos do ?ndice foram inclu?dos. DOC-001 e DB-003 foram integrados de trechos inline dos relat?rios prim?rios. API-001/BOOK-003, DB-001/BOOK-002 e API-009/PAY-009 s?o refer?ncias duplicadas, consolidadas nos IDs can?nicos BOOK-003, BOOK-002 e PAY-009. UI-012 consta somente como item hist?rico removido por falta de evid?ncia de defeito. FR-* s?o requisitos da spec, n?o achados; `SHA-256` ? termo t?cnico.

## Relato do cliente para a pr?xima sess?o ? WhatsApp e mensagens

> **Origem:** relato do cliente acompanhado da captura de conversa, recebido em 2026-11-14. **Ainda n?o validado tecnicamente** nesta auditoria. Isto complementa os achados relacionados sem criar um defeito confirmado nem alterar os 151 IDs can?nicos. Investigar e corrigir na pr?xima sess?o, ap?s confirmar a regra de neg?cio para reservas sem sinal pago.

**Relato observado pelo cliente:** a conex?o do WhatsApp/Evolution ? conclu?da, mas mensagens autom?ticas de sauda??o, confirma??o e lembrete n?o chegam em alguns fluxos. A confirma??o parece chegar quando o agendamento ? confirmado ou inclu?do manualmente pela agenda do Painel 2. O cliente relata tamb?m que a sauda??o ocorre na primeira mensagem e volta a ocorrer ap?s um intervalo de 30 minutos; lembretes usam a anteced?ncia configurada e salvar uma nova anteced?ncia nas prefer?ncias tamb?m atualiza a Evolution.

**Comportamento solicitado pelo cliente:** depois de integrar o WhatsApp, os textos padr?o de sauda??o, confirma??o e lembrete devem funcionar para os clientes sem depender de uma exce??o oculta por pagamento do sinal. O relato menciona explicitamente clientes que ainda n?o pagaram o sinal. Confirmar com o cliente/produto se isso significa enviar confirma??o e lembrete mesmo para reserva pendente de sinal, e qual status do agendamento deve ser comunicado; n?o alterar a regra financeira de confirma??o por infer?ncia.

**Refer?ncias existentes para investiga??o (podem se sobrepor, n?o s?o confirma??o do relato):** [INT-001](../docs/auditoria-agenda-agora/integracoes.md) (cooldown da sauda??o), [INT-004](../docs/auditoria-agenda-agora/integracoes.md) (retry de mensagem de pagamento), [INT-005](../docs/auditoria-agenda-agora/integracoes.md) e [INT-006](../docs/auditoria-agenda-agora/integracoes.md) (lembretes), [INT-008](../docs/auditoria-agenda-agora/integracoes.md) (fila p?s-atendimento), [BOOK-001](../docs/auditoria-agenda-agora/agendamentos.md) (reserva/sinal), al?m de `painel.lembretes.tsx` e dos handlers de WhatsApp/agendamento que a investiga??o localizar. Esses links indicam proximidade tem?tica; n?o afirmam causa-raiz comum.

### Checklist de diagn?stico e aceite para a pr?xima sess?o

- [ ] Reproduzir em ambiente isolado a integra??o bem-sucedida da Evolution com envio das mensagens padr?o habilitadas; confirmar qual evento inicia cada mensagem e quais registros ficam persistidos.
- [ ] Testar contato novo: primeira mensagem recebida deve produzir a sauda??o padr?o configurada, uma ?nica vez para aquele evento.
- [ ] Testar mensagens subsequentes do mesmo contato antes e depois de 30 minutos; registrar o cooldown atual e confirmar com o cliente se a sauda??o deve reaparecer ap?s 30 minutos ou se esse reset ? o comportamento a corrigir.
- [ ] Criar reserva pelo fluxo p?blico com sinal pago e verificar a confirma??o enviada, o conte?do, o destinat?rio e a associa??o ao neg?cio correto.
- [ ] Criar reserva pelo fluxo p?blico com sinal pendente/n?o pago; confirmar a pol?tica solicitada antes de concluir o aceite. Se aprovada, verificar a mensagem adequada ao estado pendente sem afirmar que o pagamento foi recebido.
- [ ] Confirmar e incluir manualmente agendamento pelo Painel 2; preservar a confirma??o que o cliente relata j? funcionar e verificar aus?ncia de mensagens duplicadas.
- [ ] Validar lembrete conforme a anteced?ncia efetivamente configurada para o neg?cio, inclusive mudan?a de hor?rio, salvamento e atualiza??o correspondente na Evolution.
- [ ] Testar limites temporais do lembrete (antes do hor?rio, no instante devido, reserva cancelada/remarcada e fuso hor?rio) e assegurar que s? a reserva eleg?vel recebe a mensagem.
- [ ] Simular falha tempor?ria do provedor e retry em ambiente isolado; comprovar entrega eventual, idempot?ncia e que erro n?o ? marcado como enviado.
- [ ] Testar dois neg?cios e dois contatos para verificar isolamento de templates, destinat?rios, cooldown e configura??es.
- [ ] Registrar evid?ncia de cada caminho, estado da reserva/sinal, evento de fila, resposta do provedor e mensagem final; manter inconclusivo se n?o for poss?vel distinguir falha de configura??o, fila ou regra de elegibilidade.

**Regress?o de escopo:** manter os templates edit?veis, a configura??o de anteced?ncia persistida e sincronizada com o provedor conforme o comportamento esperado; nenhuma mensagem real deve ser enviada durante testes. N?o executar esta lista nesta sess?o documental.

## Achados por prioridade e sequ?ncia

### P1 ? confirmado: primeiro bloco de execu??o (6)

#### BOOK-001 ? Reserva aguardando sinal não ocupa vaga; pagamento concorrente pode ficar sem agendamento.

- **M?dulo:** Agenda/Pagamento
- **Gravidade:** P1
- **Estado:** Partially mitigated locally: pending-deposit slots are held by current booking filters and exclusion constraints; late payment after expiry and remote rollout remain unresolved.
- **Revalidação atual:** `aguardando_sinal` permanece fora da consulta de disponibilidade e da exclusion constraint, e a confirmação pode creditar pagamento sem garantir a vaga. Incluir o status na constraint sem liberação automática pode prender vagas; processar pagamento tardio pode deixar cliente sem reserva. As specs existentes não definem o ciclo do hold nem o tratamento financeiro tardio. Nenhuma correção de comportamento foi aplicada; aguarda decisão de produto.
- **Revalidação atual:** `aguardando_sinal` permanece fora da consulta de disponibilidade e da exclusion constraint, e a confirmação pode creditar pagamento sem garantir a vaga. Incluir o status na constraint sem liberação automática pode prender vagas; processar pagamento tardio pode deixar cliente sem reserva. As specs existentes não definem o ciclo do hold nem o tratamento financeiro tardio. Nenhuma correção de comportamento foi aplicada; aguarda decisão de produto.

- **Evid?ncias:** - ** `reserveBooking` grava `status: "aguardando_sinal"` e expiração em 5 min (`src/lib/booking.functions.ts:872,899-915`). A consulta de disponibilidade ignora status `aguardando_sinal` (`:700-702`) e a checagem de conflito também o exclui (`:850-859`). A exclusion constraint exclui esse status (`supabase/migrations/20260916013512_e8a1f3d2-4c6b-4e91-9a5f-2b7c9d4e1a06.sql:14-19`). Quando o pagamento é confirmado, o código credita o ledger antes de atualizar o agendamento para `agendado` (`src/lib/agpay-events.server.ts:300-319`). Se a atualização conflitar, define `pago_sem_agendamento` mas mantém o crédito (`:320-329`). Além disso, `transaction.failed` pode expirar a linha local (`:545-555`), mas um `deposit.completed` posterior ainda entra em `confirmDepositPayment`; se a cobrança já não está pendente, a função a trata como pagamento tardio, credita e marca `pago_sem_agendamento` (`:281-305`).
- **Arquivos afetados/referenciados:** `src/lib/booking.functions.ts:872`, `supabase/migrations/20260916013512_e8a1f3d2-4c6b-4e91-9a5f-2b7c9d4e1a06.sql:14-19`, `src/lib/agpay-events.server.ts:300-319`
- **Causa:** - ** status de reserva pendente de sinal está deliberadamente fora da constraint e das consultas que ocupam horário; sequência de confirmação não reserva atomicamente a vaga antes do crédito.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** durante a janela de cobrança do sinal (5 min), reservar o horário de forma atômica ou impedir que outro cliente pague pela mesma vaga.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** durante a janela de cobrança do sinal (5 min), reservar o horário de forma atômica ou impedir que outro cliente pague pela mesma vaga.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [agendamentos.md](agendamentos.md); detalhe(s): [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md).
- **Registro original integral:**

<details><summary>agendamentos.md</summary>

### BOOK-001 — Reserva aguardando sinal não ocupa o horário

- **Status:** falha de fluxo confirmada no código; ocorrência em produção não medida.
- **Gravidade:** P1 (pagamento recebido sem reserva garantida).
- **Módulo:** reserva pública / sinal / webhook AgPay.
- **Esperado:** durante a janela de cobrança do sinal (5 min), reservar o horário de forma atômica ou impedir que outro cliente pague pela mesma vaga.
- **Observado:** `reserveBooking` grava `status: "aguardando_sinal"` e expiração em 5 min (`src/lib/booking.functions.ts:872,899-915`). A consulta de disponibilidade ignora status `aguardando_sinal` (`:700-702`) e a checagem de conflito também o exclui (`:850-859`). A exclusion constraint exclui esse status (`supabase/migrations/20260916013512_e8a1f3d2-4c6b-4e91-9a5f-2b7c9d4e1a06.sql:14-19`). Quando o pagamento é confirmado, o código credita o ledger antes de atualizar o agendamento para `agendado` (`src/lib/agpay-events.server.ts:300-319`). Se a atualização conflitar, define `pago_sem_agendamento` mas mantém o crédito (`:320-329`). Além disso, `transaction.failed` pode expirar a linha local (`:545-555`), mas um `deposit.completed` posterior ainda entra em `confirmDepositPayment`; se a cobrança já não está pendente, a função a trata como pagamento tardio, credita e marca `pago_sem_agendamento` (`:281-305`).
- **Impacto:** duas cobranças podem ser geradas para a mesma vaga; se ambas forem pagas, uma delas pode virar pagamento sem agendamento e ainda constar como crédito financeiro. Também pode chegar confirmação depois de um evento de falha/expiração local; o pagamento fica registrado como tardio sem restaurar automaticamente o horário.
- **Causa-raiz:** status de reserva pendente de sinal está deliberadamente fora da constraint e das consultas que ocupam horário; sequência de confirmação não reserva atomicamente a vaga antes do crédito.
- **Reprodução segura:** DB isolado e gateway mockado: duas reservas simultâneas para o mesmo negócio/profissional/horário com sinal; confirmar ambos os eventos; observar 2 cobranças associadas, uma única reserva `agendado`, segunda cobrança em `pago_sem_agendamento` e créditos idempotentes. Não usar gateway real.
- **Correção recomendada para spec:** decidir a regra de hold/expiração da vaga e tornar a transição para confirmada e alocação financeira consistente, incluindo tratamento operacional/reembolso para pagamento tardio/conflitante.
- **Regressão necessária:** reservas concorrentes com sinal; expiração do hold; sequências `transaction.failed`→`deposit.completed` e `deposit.completed`→`transaction.failed`; pagamento após expiração; segundo pagamento sem vaga; ledger e estado exibido ao cliente.

</details>


#### PAY-017 ? Modal pode ser reaberto e gerar novo Pix enquanto há outro pendente; schema não impõe unicidade por negócio/ciclo.

- **M?dulo:** Pagamentos/Assinatura
- **Gravidade:** P1 potencial
- **Estado:** Caminho duplicável confirmado; efeito financeiro não reproduzido
- **Evid?ncias:** - ** cada chamada a `createSubscriptionCharge` cria novo Pix AgPay e depois insere nova linha `pending` (`src/lib/subscription-charge.functions.ts:135-240`), sem consultar pendências, usar chave de idempotência ou persistir `expires_at`. O schema garante unicidade apenas de `provider_payment_id`, não de uma cobrança pendente por negócio/ciclo (`supabase/migrations/20261106120000_subscription_charges.sql:9-32`). Na UI, `start()` abre o modal e, havendo CPF, chama `pay.mutate()`; fechar o modal não limpa a cobrança pendente nem bloqueia o botão externo; reabrir chama `pay.mutate()` de novo (`src/components/painel/SubscriptionPixPayment.tsx:145-163, 275-280`).
- **Arquivos afetados/referenciados:** `src/lib/subscription-charge.functions.ts:135-240`, `supabase/migrations/20261106120000_subscription_charges.sql:9-32`, `src/components/painel/SubscriptionPixPayment.tsx:145-163`, `subscription-charge.functions.ts:206-219`, `src/lib/agpay-events.server.test.ts:574-605`
- **Causa:** - ** criação sem idempotência/consulta de pendência e ausência de chave de ciclo; botão continua disponível após fechar modal com pagamento ativo.

- **Revalidação em 2026-11-14:** fluxo e migration confirmam que cada requisição chama AgPay antes de inserir subscription_charges, não há verificação de pendências, e a UI reabrindo o modal chama a mutation novamente. A tabela não persiste QR/expiração; o webhook de falha também não encerra a cobrança (PAY-016). **Correção bloqueada por dependência de ciclo de vida:** bloquear ou reusar exige definir/persistir vencimento, recuperação após crash/timeout do provedor e tratar pagamentos tardios antes de impedir nova tentativa; não há regra completa nas specs existentes. Baseline:\
pm test -- src/lib/subscription-charge.functions.test.ts — 1 arquivo, 12 testes aprovados; nenhuma correção aplicada.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** repetição da ação deve reutilizar a cobrança pendente ou impedir outra até a expiração/encerramento da primeira, com idempotência por negócio e ciclo.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** repetição da ação deve reutilizar a cobrança pendente ou impedir outra até a expiração/encerramento da primeira, com idempotência por negócio e ciclo.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-017 — Uma nova cobrança Pix pode ser criada enquanto outra está pendente

- **Status:** caminho duplicável confirmado por inspeção estática; cobrança duplicada ou dupla liquidação não reproduzida.
- **Gravidade:** P1 potencial.
- **Módulo:** pagamentos / assinatura.
- **Esperado:** repetição da ação deve reutilizar a cobrança pendente ou impedir outra até a expiração/encerramento da primeira, com idempotência por negócio e ciclo.
- **Observado:** cada chamada a `createSubscriptionCharge` cria novo Pix AgPay e depois insere nova linha `pending` (`src/lib/subscription-charge.functions.ts:135-240`), sem consultar pendências, usar chave de idempotência ou persistir `expires_at`. O schema garante unicidade apenas de `provider_payment_id`, não de uma cobrança pendente por negócio/ciclo (`supabase/migrations/20261106120000_subscription_charges.sql:9-32`). Na UI, `start()` abre o modal e, havendo CPF, chama `pay.mutate()`; fechar o modal não limpa a cobrança pendente nem bloqueia o botão externo; reabrir chama `pay.mutate()` de novo (`src/components/painel/SubscriptionPixPayment.tsx:145-163, 275-280`).
- **Impacto:** o dono pode gerar dois Pix válidos para o mesmo período. `period_end` é congelado no momento da criação (`subscription-charge.functions.ts:206-219`); duas cobranças distintas criadas antes da atualização do acesso podem resultar em dois pagamentos para uma única extensão. A confirmação repetida do mesmo provider ID é idempotente e grava histórico uma vez (`src/lib/agpay-events.server.test.ts:574-605`), mas isso não impede que dois IDs diferentes sejam pagos e registrados. Não foi encontrada devolução automática do segundo pagamento.
- **Reprodução segura:** fake AgPay/DB: chamar a função duas vezes para o mesmo negócio antes de qualquer confirmação; verificar duas chamadas ao provedor e duas linhas `pending`, ambas potencialmente com o mesmo `period_end`. Simular pagamento de ambas apenas em memória e confirmar que cada cobrança gera histórico próprio, sem extensão cumulativa duplicada. O teste existente cobre retry do mesmo ID, não IDs distintos.
- **Causa-raiz:** criação sem idempotência/consulta de pendência e ausência de chave de ciclo; botão continua disponível após fechar modal com pagamento ativo.
- **Correção recomendada para spec:** definir identidade do ciclo de cobrança, reuso/expiração e política para pagamentos tardios/duplicados; impor idempotência no servidor/banco e oferecer reconciliação/estorno manual, sem assumir reversão automática.
- **Regressão:** chamadas concorrentes/repetidas não criam cobranças duplicadas; após expiração pode-se gerar nova cobrança; pagamento tardio/duplicado não estende acesso indevidamente e gera caso conciliável.

</details>


#### PAY-032 ? O webhook só correlaciona por essa referência; falha pós-payout pode deixar saque sem conciliação local.

- **M?dulo:** Pagamentos/Cashout
- **Gravidade:** P1 potencial
- **Estado:** Falha ao gravar resposta do provedor pode perder `provider_ref`
- **Revalidação em 2026-11-14:** código confirma que, após retorno do AgPay, falha ao persistir provider_ref cai no catch, que tenta gravar só status='processing', ignora o erro e retorna sucesso sem referência. A webhook correlaciona exclusivamente por provider_ref. Nenhum contrato, chave de idempotência ou endpoint de consulta por referência externa foi encontrado no repositório; nenhuma chamada ao AgPay foi feita. **Correção bloqueada por capacidade externa não comprovada:** não é seguro repetir cashout nem inferir correlação por valor/chave/horário. Retomar após confirmar mecanismo oficial de consulta/idempotência/reconciliação e criar armazenamento durável compatível. Nenhuma correção aplicada.

- **Evid?ncias:** - ** `createCashoutPix` retorna `providerRef` extraída de `withdrawal.uuid`/`id` (`src/lib/agpay.server.ts:184-232`). `createWithdrawal` tenta gravar `status='processing'`, `provider_ref` e taxa na primeira atualização; se essa atualização falha, lança erro genérico, que cai no catch ambíguo. Esse catch tenta atualizar somente `status='processing'`, ignora o resultado e retorna `{...inserted,status:'processing'}`, sem `provider_ref` (`src/lib/withdrawal.server.ts:91-153`). O webhook deriva a referência do evento e procura `withdrawals` exclusivamente por igualdade em `provider_ref`; sem linha correspondente, levanta `MissingLocalReferenceError` (`src/lib/agpay-events.server.ts:466-497`).
- **Arquivos afetados/referenciados:** `src/lib/agpay.server.ts:184-232`, `src/lib/withdrawal.server.ts:91-153`, `src/lib/agpay-events.server.ts:466-497`, `src/lib/agpay-events.server.ts:605-630`, `src/lib/admin.functions.ts:433-482`, `src/components/master/WithdrawalsAdmin.tsx:15-87`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** depois que o provedor aceita um cashout e devolve referência, o sistema deve persistir a referência em estado recuperável ou deixar uma operação durável para conciliação; falha de persistência não deve descartar a única chave de correlação.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** depois que o provedor aceita um cashout e devolve referência, o sistema deve persistir a referência em estado recuperável ou deixar uma operação durável para conciliação; falha de persistência não deve descartar a única chave de correlação.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-032 — falha ao salvar resposta do cashout perde a referência usada pelo webhook

- **Estado:** caminho de falha parcial confirmado por inspeção; ocorrência não reproduzida.
- **Gravidade:** P1 potencial, pois pode deixar payout externo sem conciliação local e saldo em estado inconsistente.
- **Módulo:** pagamentos / saque / AgPay / reconciliação.
- **Esperado:** depois que o provedor aceita um cashout e devolve referência, o sistema deve persistir a referência em estado recuperável ou deixar uma operação durável para conciliação; falha de persistência não deve descartar a única chave de correlação.
- **Observado:** `createCashoutPix` retorna `providerRef` extraída de `withdrawal.uuid`/`id` (`src/lib/agpay.server.ts:184-232`). `createWithdrawal` tenta gravar `status='processing'`, `provider_ref` e taxa na primeira atualização; se essa atualização falha, lança erro genérico, que cai no catch ambíguo. Esse catch tenta atualizar somente `status='processing'`, ignora o resultado e retorna `{...inserted,status:'processing'}`, sem `provider_ref` (`src/lib/withdrawal.server.ts:91-153`). O webhook deriva a referência do evento e procura `withdrawals` exclusivamente por igualdade em `provider_ref`; sem linha correspondente, levanta `MissingLocalReferenceError` (`src/lib/agpay-events.server.ts:466-497`).
- **Impacto:** se o cashout foi aceito e a gravação que contém a referência falhou, o saldo já pode ter sido debitado/reservado e o Pix externo pode ser executado, enquanto a aplicação perde sua correlação local para processar evento terminal. A inbox tenta novamente evento sem referência local com backoff e o move para `error` após 24 h (`src/lib/agpay-events.server.ts:605-630`); isso preserva o payload para triagem, mas não recupera o saque se nenhuma linha local adquirir a referência. A linha pode permanecer `requested` ou `processing` e o valor ficar bloqueado até reconciliação manual. Não há evidência de ocorrência real.
- **Recuperação manual observada:** `WithdrawalsAdmin` lista saques `requested`/`processing` e permite a superadmin marcar `paid` ou `failed` via RPC do ledger (`src/lib/admin.functions.ts:433-482`; `src/components/master/WithdrawalsAdmin.tsx:15-87`). A tabela não exibe `provider_ref`; o painel local não expõe a inbox `agpay_webhook_events` com status `error`. A decisão manual depende então de consultar o provedor por outra via e correlacionar com o saque, procedimento operacional não encontrado/verificado.
- **Causa-raiz confirmada no fluxo:** o efeito externo precede a persistência da referência; o tratamento de erro reduz o registro a status genérico e ignora falha secundária. O provider reference não tem armazenamento durável alternativo observado.
- **Reprodução segura:** harness local com banco mockado: `createCashoutPix` retorna `providerRef` sintética; a atualização que grava `provider_ref` retorna erro; observar que a chamada seguinte só grava status e a linha final não contém referência; chamar o processador do webhook com essa ref e confirmar que não encontra a linha. Não chamar o provedor nem tocar em ledger persistente.
- **Correção recomendada para spec:** persistir intenção/idempotency de cashout antes da chamada externa e criar reconciliação por referência em armazenamento durável; se o provider responder e DB falhar, reter a referência em retry seguro e não devolver sucesso sem registrar pendência operacional acionável.
- **Regressão:** falha na atualização principal não perde referência; webhook com referência retornada correlaciona saque; retries nunca criam segundo payout; pendência recuperável fica visível até confirmação/estorno.
- **Limitação:** efeito depende de erro na escrita pós-provider e o alcance depende do retry/alerta operacional da inbox; não foram feitos cashout, chamadas AgPay, teste com provider ou mutação de banco. O retry e transição a `error` têm cobertura unitária existente, mas não foi executado nesta rodada.

</details>


#### PAY-027 ? Cron/RPC tratam `trial_days` preenchido como trial mesmo após pagamento; cancelamento pode nunca ocorrer.

- **M?dulo:** Pagamentos/Lifecycle de assinatura
- **Gravidade:** P1 potencial
- **Estado:** Corrigido e validado em código e banco de ensaio
- **Revalidação em 2026-11-14:** confirmada divergência entre cron, Painel Master e RPC. Cron agora considera pagamentos confirmados em `subscription_payments` e `subscription_charges`; a RPC só mantém a exceção de trial quando não existe pagamento em nenhuma fonte. Nova migration `20261114120000_fix_paid_trial_lifecycle.sql`. Teste DB red antes da migration (trial pago recusado) e green depois. Testes do cron/ciclo: 22/22; `npm run test:db`: 3 arquivos, 70 testes aprovados; `npm test`: 80 arquivos, 807 aprovados, 8 ignorados; `npx tsc --noEmit` e `npm run build`: sucesso. Migration não aplicada em produção.

- **Evid?ncias:** - ** `sdrCreateBusiness` persiste `trial_days` para contas de teste (`src/lib/sdr.functions.ts:629-686`); `confirmSubscriptionCharge` registra `subscription_payments` e atualiza acesso, mas não limpa `trial_days` (`src/lib/agpay-events.server.ts:174-220`). Em contraste, telas Master em `lifecycle.functions.ts:158,400,457` e `platform-overview.functions.ts:268` tratam como trial apenas quando `trial_days != null && !everPaid`/sem pagamento. O cron `subscription-lifecycle.ts:52,66` usa apenas `business.trial_days != null`; portanto uma conta que pagou continua em branch de trial e não recebe categoria/avisos de assinante. Além disso, `shouldAutoCancel` recebe `isTrial` pelo mesmo critério (`:50-55`), e a RPC recusa qualquer negócio com `trial_days IS NOT NULL` (`supabase/migrations/20261103000000_security_hardening.sql:262-267`).
- **Arquivos afetados/referenciados:** `src/lib/sdr.functions.ts:629-686`, `src/lib/agpay-events.server.ts:174-220`, `lifecycle.functions.ts:158`, `platform-overview.functions.ts:268`, `subscription-lifecycle.ts:52`, `supabase/migrations/20261103000000_security_hardening.sql:262-267`
- **Causa:** - ** job e RPC inferem trial pela presença do campo histórico `trial_days`, enquanto outras telas verificam também se houve pagamento.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** após o primeiro pagamento, um estabelecimento deixa de ser trial para classificação de assinante, avisos de vencimento e regra de cancelamento.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** após o primeiro pagamento, um estabelecimento deixa de ser trial para classificação de assinante, avisos de vencimento e regra de cancelamento.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-027 — negócios que começaram em teste seguem tratados como trial pelo cron mesmo após pagar

- **Status:** divergência de critério confirmada entre lifecycle Master e job/RPC; negócios afetados em produção não identificados.
- **Gravidade:** P1 potencial.
- **Módulo:** pagamentos / assinatura / transição de trial para assinante.
- **Esperado:** após o primeiro pagamento, um estabelecimento deixa de ser trial para classificação de assinante, avisos de vencimento e regra de cancelamento.
- **Observado:** `sdrCreateBusiness` persiste `trial_days` para contas de teste (`src/lib/sdr.functions.ts:629-686`); `confirmSubscriptionCharge` registra `subscription_payments` e atualiza acesso, mas não limpa `trial_days` (`src/lib/agpay-events.server.ts:174-220`). Em contraste, telas Master em `lifecycle.functions.ts:158,400,457` e `platform-overview.functions.ts:268` tratam como trial apenas quando `trial_days != null && !everPaid`/sem pagamento. O cron `subscription-lifecycle.ts:52,66` usa apenas `business.trial_days != null`; portanto uma conta que pagou continua em branch de trial e não recebe categoria/avisos de assinante. Além disso, `shouldAutoCancel` recebe `isTrial` pelo mesmo critério (`:50-55`), e a RPC recusa qualquer negócio com `trial_days IS NOT NULL` (`supabase/migrations/20261103000000_security_hardening.sql:262-267`).
- **Impacto:** após acabar o acesso de um negócio que iniciou como trial e depois pagou, rotina diária pode deixar de enviar avisos de fatura/atraso e nunca auto-cancelar por inadimplência, contrariando FR-024. O tamanho do impacto depende da existência de contas desse tipo na produção.
- **Reprodução segura:** fixture fake com `trial_days=7`, `subscription_payments` contendo `status='pago'`, `access_until` expirado há 15 dias e setting ativo; comparar classificação Master com a do cron/RPC. Apenas mock; nenhuma conta real alterada.
- **Causa-raiz:** job e RPC inferem trial pela presença do campo histórico `trial_days`, enquanto outras telas verificam também se houve pagamento.
- **Correção recomendada para spec:** definir fonte canônica de “já pagou/assinante” e usá-la na classificação do cron e na pré-condição transacional de auto-cancelamento; não apagar história do teste sem política.
- **Regressão:** trial nunca pago continua fora da regra de cancelamento; trial que pagou passa a assinante, recebe avisos e pode entrar na política de inadimplência após 15 dias.

</details>


#### PAY-011 ? Cashout usa chave salva sem verificar aprovação manual vigente.

- **M?dulo:** Pagamentos/Recebedor
- **Gravidade:** P1
- **Estado:** Corrigido em 2026-11-14; aprovação vigente e correspondência de tipo/chave são verificadas server-side antes da reserva.
- **Evid?ncias:** - ** `createWithdrawal` lê somente `id, withdrawal_pix_key, agpay_withdrawal_blocked, agpay_access_blocked` (`src/lib/withdrawal.server.ts:28-40`) e envia a chave salva em `businesses` ao gateway (`:101-104`). `saveWithdrawalPixKeyForOwner` atualiza essa chave apenas após verificar `owner_id`, sem verificar status de aprovação (`:170-184`). A UI salva a chave antes de submetê-la à aprovação manual (`src/routes/_authenticated/painel.as-pay.tsx:1380-1393`). Além disso, `saveWithdrawalPixKeyForOwner` (`src/lib/withdrawal.server.ts:170-184`) continua atualizando livremente a chave do dono, sem invalidar/exigir aprovação nova; `requestWithdrawal` não consulta `pix_key_approvals`. Assim, uma chave alternativa pode ser gravada até depois de uma aprovação anterior, e o cashout usa o campo corrente. A validação está apenas na jornada visual.
- **Arquivos afetados/referenciados:** `src/lib/withdrawal.server.ts:28-40`, `src/routes/_authenticated/painel.as-pay.tsx:1380-1393`, `src/lib/withdrawal.server.ts:170-184`, `withdrawal.server.ts:28-40`, `painel.as-pay.tsx:1380-1393`, `pagamentos.md`
- **Causa:** - ** separação entre aprovação manual e endpoint financeiro sem guard server-side que relacione a chave aprovada ao `business_id`.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** somente chave aprovada deve ser elegível a cashout, validada no servidor no instante do saque.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** somente chave aprovada deve ser elegível a cashout, validada no servidor no instante do saque.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md), [`riscos.md`](../docs/auditoria-agenda-agora/riscos.md), [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-011 — Backend aceita saque para chave ainda sem aprovação

- **Status:** falha confirmada no controle server-side; nenhuma retirada foi realizada.
- **Gravidade:** P1.
- **Módulo:** pagamentos / onboarding do recebedor.
- **Esperado:** somente chave aprovada deve ser elegível a cashout, validada no servidor no instante do saque.
- **Observado:** `createWithdrawal` lê somente `id, withdrawal_pix_key, agpay_withdrawal_blocked, agpay_access_blocked` (`src/lib/withdrawal.server.ts:28-40`) e envia a chave salva em `businesses` ao gateway (`:101-104`). `saveWithdrawalPixKeyForOwner` atualiza essa chave apenas após verificar `owner_id`, sem verificar status de aprovação (`:170-184`). A UI salva a chave antes de submetê-la à aprovação manual (`src/routes/_authenticated/painel.as-pay.tsx:1380-1393`). Além disso, `saveWithdrawalPixKeyForOwner` (`src/lib/withdrawal.server.ts:170-184`) continua atualizando livremente a chave do dono, sem invalidar/exigir aprovação nova; `requestWithdrawal` não consulta `pix_key_approvals`. Assim, uma chave alternativa pode ser gravada até depois de uma aprovação anterior, e o cashout usa o campo corrente. A validação está apenas na jornada visual.
- **Impacto:** chamada direta autenticada pode contornar a espera de aprovação e direcionar cashout para uma chave inserida pelo dono antes da revisão operacional.
- **Reprodução segura:** fake DB com chave salva não aprovada, owner válido, saldo fake e `createCashoutPix` mockado; chamar endpoint de saque diretamente e confirmar que chega ao adapter sem consultar aprovação. Não chamar AgPay nem movimentar saldo real.
- **Causa-raiz:** separação entre aprovação manual e endpoint financeiro sem guard server-side que relacione a chave aprovada ao `business_id`.
- **Correção recomendada para spec:** antes da reserva, confirmar aprovação atual e correspondência exata entre tipo/chave aprovados e snapshot usado para o payout; rejeitar estados pendente/recusado/ausente.
- **Regressão:** sem aprovação não reserva saldo nem chama adapter; chave aprovada de negócio diferente não pode autorizar; troca de chave invalida a aprovação anterior.

</details>

<details><summary>riscos.md</summary>

### PAY-011 — cashout não revalida chave aprovada no servidor

Prioridade P1. A UI e o fluxo de onboarding não substituem verificação no endpoint financeiro. A chave é salva antes da aprovação manual e usada pelo cashout sem consultar `pix_key_approvals`; evidência em `withdrawal.server.ts:28-40,101-104`, `painel.as-pay.tsx:1380-1393`.

</details>

<details><summary>seguranca.md</summary>

## PAY-011 e SEC-004 — aprovação de chave e brute force do PIN

`PAY-011` (P1): o owner salva a chave em `businesses` antes da aprovação manual; `createWithdrawal` usa esse campo sem consultar `pix_key_approvals`. A UI aguarda aprovação, mas o servidor não impõe a regra. `SEC-004` (P2): PIN de saque agora tem lockout persistente por usuário/negócio: cinco falhas em 15 min bloqueiam por 30 min; o bucket de IP depende da origem ainda pendente em SEC-018, e o hash SHA-256 mantém risco offline. Ver evidências e limites em [pagamentos.md](pagamentos.md).

PAY-011 inclui também a alteração direta da chave após uma aprovação existente: o servidor permite ao owner gravar nova `withdrawal_pix_key` em rota própria, e o próximo cashout usa a chave corrente sem exigir revisão da nova chave. A jornada visual de aprovação não limita a chamada direta.

</details>


#### PAY-009 ? `requestWithdrawal` não exige PIN; validação está separada e só orquestrada pela UI.

- **M?dulo:** Pagamentos/Saque
- **Gravidade:** P1
- **Estado:** Corrigido em 2026-11-14; o comando server-side de saque valida o PIN antes de qualquer reserva ou chamada externa.
- **Evid?ncias:** - ** `src/lib/withdrawal.functions.ts:148-170` expõe `requestWithdrawal` autenticada e aceita apenas `businessId`, `amountCents` e `idempotencyKey`. Chama `createWithdrawal` sem PIN nem prova de verificação. `src/lib/withdrawal.server.ts:21-110` confirma propriedade, saldo e envia `createCashoutPix`. O PIN está em endpoint independente `verifyWithdrawalPin` (`withdrawal.functions.ts:190-203`), cujo resultado não cria sessão/ticket exigido pelo endpoint de saque. A UI chama verificação e depois saque (`src/routes/_authenticated/painel.as-pay.tsx:1228-1240`), mas essa sequência pode ser omitida ao chamar a Server Function diretamente.
- **Arquivos afetados/referenciados:** `src/lib/withdrawal.functions.ts:148-170`, `src/lib/withdrawal.server.ts:21-110`, `withdrawal.functions.ts:190-203`, `src/routes/_authenticated/painel.as-pay.tsx:1228-1240`, `withdrawal.functions.ts:148-170`, `withdrawal.server.ts:21-110`, `painel.as-pay.tsx:1228-1240`, `painel.as-pay.tsx`, `pagamentos.md`
- **Causa:** - ** a autorização do PIN está separada do comando de saque e só é orquestrada no cliente.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** o backend deve exigir uma prova de PIN válida e recente na própria autorização da operação financeira.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** o backend deve exigir uma prova de PIN válida e recente na própria autorização da operação financeira.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **IDs/refer?ncias consolidados:** API-009 (frontend.md) aponta para o mesmo PIN ausente na fronteira server-side.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md), [`riscos.md`](../docs/auditoria-agenda-agora/riscos.md), [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-009 — O servidor não exige PIN para iniciar saque

- **Status:** falha confirmada por leitura do fluxo; não foi feita chamada de saque real.
- **Gravidade:** P1.
- **Módulo:** pagamentos / segurança de saque.
- **Esperado:** o backend deve exigir uma prova de PIN válida e recente na própria autorização da operação financeira.
- **Observado:** `src/lib/withdrawal.functions.ts:148-170` expõe `requestWithdrawal` autenticada e aceita apenas `businessId`, `amountCents` e `idempotencyKey`. Chama `createWithdrawal` sem PIN nem prova de verificação. `src/lib/withdrawal.server.ts:21-110` confirma propriedade, saldo e envia `createCashoutPix`. O PIN está em endpoint independente `verifyWithdrawalPin` (`withdrawal.functions.ts:190-203`), cujo resultado não cria sessão/ticket exigido pelo endpoint de saque. A UI chama verificação e depois saque (`src/routes/_authenticated/painel.as-pay.tsx:1228-1240`), mas essa sequência pode ser omitida ao chamar a Server Function diretamente.
- **Impacto:** qualquer sessão válida do proprietário que alcance a Server Function pode solicitar saque sem conhecer o PIN; a proteção apresentada na UI não resiste a chamada direta. Uma sessão comprometida pode iniciar retirada de fundos.
- **Reprodução segura:** em teste unitário com negócio e saldo fake, chamar `requestWithdrawal` autenticado sem invocar `verifyWithdrawalPin`; mockar `createCashoutPix` para não fazer HTTP e verificar que a operação avança até o adaptador. Não executar contra Supabase ou AgPay real.
- **Causa-raiz:** a autorização do PIN está separada do comando de saque e só é orquestrada no cliente.
- **Correção recomendada para spec:** vincular a validação a prova server-side de curta duração, uso único, usuário/negócio e montante; ou validar o PIN dentro do mesmo comando. Aplicar rate limit para tentativas e não confiar em estado React.
- **Regressão:** chamada direta sem prova/PIN válido deve falhar antes de reservar saldo e chamar AgPay; PIN válido deve autorizar uma única operação; repetição e concorrência não duplicam cashout.

</details>

<details><summary>riscos.md</summary>

### PAY-009 — saque não valida PIN na fronteira server-side

Prioridade P1; sessão de dono pode chamar a Server Function autenticada sem invocar a verificação do PIN, e o backend pode alcançar o adaptador de cashout. Evidência: `withdrawal.functions.ts:148-170`, `withdrawal.server.ts:21-110`; o uso do PIN ocorre separadamente em `painel.as-pay.tsx:1228-1240`. Requer confirmação com harness mockado; nenhum dinheiro real foi movimentado.

</details>

<details><summary>seguranca.md</summary>

## PAY-009 e PAY-010 — controles do fluxo de saque

`PAY-009` (P1) registra que `requestWithdrawal` não verifica PIN nem exige prova do endpoint `verifyWithdrawalPin`; a checagem da tela em `painel.as-pay.tsx` é contornável por chamada direta. `PAY-010` (P2) registra que a busca de retry por `idempotency_key` devolve o saque sem filtro/validação de negócio. Ver o detalhe, reprodução mockada e regressões requeridas em [pagamentos.md](pagamentos.md).

Ainda não houve tentativa de invocar esses fluxos, nem em mocks; o comportamento é deduzido dos handlers e serviços. Esta lacuna de autorização do PIN deve permanecer prioridade P1 até uma reprodução segura em harness isolado.

</details>


### P1 ? potencial, suspeito ou bloqueado por evid?ncia (14)

#### PAY-006 ? Regras do dashboard podem aplicar split global apesar de payload sem `splits`.

- **M?dulo:** Pagamentos/Split
- **Gravidade:** P1 potencial
- **Estado:** Não verificado; inspeção somente leitura do Dashboard não ficou disponível nesta sessão.
- **Revalidação em 2026-11-14:** a codebase confirma que o payload Pix não envia `splits`; o risco depende da configuração externa do Dashboard. O helper Computer Use falhou duas vezes ao conectar ao Windows (`native pipe unavailable`), portanto nenhuma regra/destinatário foi lido ou alterado. Permanecer pendente até leitura somente leitura do Dashboard AgPay.
- **Evid?ncias:** - ** a documentação pública do AgPay diz que regras de split são configuradas no Dashboard e aplicadas automaticamente a novas transações PIX/cartão, sem parâmetros extras no payload. O adaptador não manda `splits` (`src/lib/agpay.server.ts:158-181`) e o código local não consegue provar que o painel AgPay está sem regras. Se regras externas estiverem ativas, o valor creditado no provedor pode divergir dos saldos/ledger que assumem recebimento integral.
- **Arquivos afetados/referenciados:** `src/lib/agpay.server.ts:158-181`
- **Causa:** - ** a configuração do dashboard não é representada/versionada pelo código e não foi inspecionada.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** o modelo da spec 004 assume que 100% do sinal entra na conta plataforma e que a carteira interna apura a parte do estabelecimento.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** o modelo da spec 004 assume que 100% do sinal entra na conta plataforma e que a carteira interna apura a parte do estabelecimento.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-006 — Split configurável no dashboard do provedor pode contradizer o ledger local

- **Status:** risco suspeito; configuração externa não verificada.
- **Gravidade:** P1 potencial, condicionado a regras ativas no AgPay.
- **Módulo:** destino dos valores / conciliação.
- **Esperado:** o modelo da spec 004 assume que 100% do sinal entra na conta plataforma e que a carteira interna apura a parte do estabelecimento.
- **Observado:** a documentação pública do AgPay diz que regras de split são configuradas no Dashboard e aplicadas automaticamente a novas transações PIX/cartão, sem parâmetros extras no payload. O adaptador não manda `splits` (`src/lib/agpay.server.ts:158-181`) e o código local não consegue provar que o painel AgPay está sem regras. Se regras externas estiverem ativas, o valor creditado no provedor pode divergir dos saldos/ledger que assumem recebimento integral.
- **Impacto:** recebimento parcial ou divisão para recebedor não pretendido, saldo contábil maior que o valor realmente disponível na plataforma, ou dupla alocação econômica. Nenhuma transação ou destino incorreto foi observado nesta auditoria.
- **Causa-raiz:** a configuração do dashboard não é representada/versionada pelo código e não foi inspecionada.
- **Validação segura:** inspeção de leitura das regras no Dashboard AgPay e revisão de recebedores, sem criar transação; conciliação dos contratos vigentes.
- **Correção recomendada para spec futura:** colocar regra de split como gate operacional explícito e reconciliado, documentar a fonte de verdade e alertar quando divergente do modelo de carteira.
- **Regressão necessária:** simulação de distribuição do provedor e conciliação ledger/extrato com split desligado e com split ligado, em ambiente de teste isolado.

</details>


#### DEP-001 ? Zod 3.25.76 está em faixa vulnerável; há arrays sem limite em validações server-side.

- **M?dulo:** Segurança/Zod
- **Gravidade:** P1 potencial
- **Estado:** Corrigido e validado no código; configuração/limites de produção não verificados
- **Revalidação em 2026-11-14:** instalado `zod@4.6.7` (advisory corrigido a partir de 4.6.6), limitado `workingDays` e `availableDays` a 7 itens e `serviceIds` a 1.000; substituídos validadores `.uuid()` por `.guid()` para manter a semântica permissiva da versão 3. Testes de limite observaram falha antes da correção e passaram depois. Evidências: `npm test` — 80 arquivos aprovados, 3 ignorados, 806 testes aprovados e 8 ignorados; `npx tsc --noEmit` — sucesso; `npm run build` — sucesso, com avisos de arquivos `*.test.tsx` encontrados como rotas. `npm audit` não lista mais Zod; permanecem 8 avisos de dependência (7 moderados e 1 alto, Vite/DEP-002). `npm run lint` falha globalmente com 3.647 erros e 34 avisos de formatação/outros arquivos; esse resultado foi registrado, sem correção fora deste achado.

- **Evid?ncias:** - ** `package-lock.json:7853-7856` resolve `zod@3.25.76`; `package.json` declara `^3.24.2`. O [advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) classifica High e afeta versões `<4.6.6`; descreve exaustão de memória ao validar arrays grandes sem limite de comprimento. Schemas `saveProfessionalInput` têm `workingDays` e `serviceIds` sem `.max()` (`src/lib/professionals.functions.ts:22-24`), e `saveServiceInput.availableDays` também não tem teto (`src/lib/services.functions.ts:34`). Essas funções pedem sessão; limite de body/proxy e elegibilidade para criação de conta não foram verificados.
- **Arquivos afetados/referenciados:** `package-lock.js`, `package.js`, `src/lib/professionals.functions.ts:22-24`, `src/lib/services.functions.ts:34`
- **Causa:** - ** dependência está abaixo da versão corrigida e pelo menos três schemas permitem arrays sem comprimento máximo.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** schemas que validam coleções devem usar versão corrigida e limites de tamanho adequados.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** schemas que validam coleções devem usar versão corrigida e limites de tamanho adequados.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [seguranca.md](seguranca.md); detalhe(s): [`riscos.md`](../docs/auditoria-agenda-agora/riscos.md), [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>riscos.md</summary>

### DEP-001 — Zod vulnerável em funções autenticadas

P1 potencial (advisory High, exposição ainda suspeita). Lockfile usa Zod 3.25.76; schemas de profissional e serviço aceitam arrays sem máximo. Não foi feito payload de estresse; limite HTTP e topologia desconhecidos.

</details>

<details><summary>seguranca.md</summary>

### DEP-001 — Versão de Zod vulnerável em validações server-side

- **Status:** versão vulnerável confirmada pelo lockfile e advisory; exploração contra esta instalação não executada. Exposição é risco suspeito devido a schemas sem limite de array.
- **Gravidade:** P1 potencial (CVE High; pré-condições do runtime ainda não avaliadas).
- **Módulo:** segurança / dependências / validação de entrada.
- **Esperado:** schemas que validam coleções devem usar versão corrigida e limites de tamanho adequados.
- **Observado:** `package-lock.json:7853-7856` resolve `zod@3.25.76`; `package.json` declara `^3.24.2`. O [advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) classifica High e afeta versões `<4.6.6`; descreve exaustão de memória ao validar arrays grandes sem limite de comprimento. Schemas `saveProfessionalInput` têm `workingDays` e `serviceIds` sem `.max()` (`src/lib/professionals.functions.ts:22-24`), e `saveServiceInput.availableDays` também não tem teto (`src/lib/services.functions.ts:34`). Essas funções pedem sessão; limite de body/proxy e elegibilidade para criação de conta não foram verificados.
- **Impacto:** requisições enormes com elementos inválidos podem consumir memória do processo e indisponibilizar a instância, dependendo dos limites externos e do ambiente.
- **Reprodução segura:** não enviar payload de exaustão; reproduzir apenas em ambiente descartável e com limites de memória controlados após atualizar o plano de teste.
- **Causa-raiz:** dependência está abaixo da versão corrigida e pelo menos três schemas permitem arrays sem comprimento máximo.
- **Correção recomendada para spec:** avaliar migração compatível para Zod corrigido, adicionar limites dimensionais e limites de corpo/concorrência no servidor.
- **Regressão:** payload acima do limite é rejeitado rapidamente sem acumular issues; todas as validações atuais continuam preservadas.

#### Verificação de exposição — ciclo 167

O lockfile identifica `zod@3.25.76` como dependência raiz; `package.json` declara `^3.24.2`. Os schemas de `workingDays`, `serviceIds` e `availableDays` são usados por Server Functions POST protegidas por `requireSupabaseAuth`. A advisory oficial classifica a falha como High, afeta versões anteriores a `4.6.6` e descreve alocação excessiva de memória ao validar arrays grandes sem limite; o vetor pressupõe que um atacante consiga enviar o array ao processo vulnerável ([GitHub Advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)).

**Conclusão refinada:** versão vulnerável e caminhos server-side confirmados; exploração pelo público anônimo não demonstrada, pois os handlers verificados exigem sessão. Permanece risco condicional para entradas autenticadas e não está demonstrado se produção usa este lockfile, limita tamanho do body ou possui controle compensatório. Nenhum payload foi enviado e nenhum processo Node, instalação ou teste foi executado neste ciclo.

</details>


#### DB-002 ? Projeto qagot indisponível para leitura pelo conector.

- **M?dulo:** Banco/Produção
- **Gravidade:** P1 cobertura
- **Estado:** Inconclusivo
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** `supabase/config.toml`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [banco-de-dados.md](banco-de-dados.md); detalhe(s): [`banco-de-dados.md`](../docs/auditoria-agenda-agora/banco-de-dados.md).
- **Registro original integral:**

<details><summary>banco-de-dados.md</summary>

### DB-002 — Estado do schema remoto e policies aplicadas não foram validados

- **Status:** inconclusivo, bloqueio de acesso.
- **Gravidade:** P1 para completude desta auditoria; não é achado de defeito do SaaS.
- `supabase/config.toml` aponta para `qagotnmdqjoodoudcikd`; MCP listou apenas projeto não relacionado e recusou `list_tables` para `qagot` com erro de permissão. Migrations locais e relatórios históricos não substituem leitura do catálogo/`schema_migrations` remoto.

</details>


#### PAY-004 ? Adaptador AgPay no código, runtime/credencial de produção não verificados.

- **M?dulo:** Pagamentos/Gateway
- **Gravidade:** P1 cobertura
- **Estado:** Inconclusivo
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** `src/lib/agpay.server.ts:11-13`, `src/routes/api/public/agpay-webhook.ts`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-004 — Identificação do gateway/documentação operacional

- **Status:** código confirmado como AgPay; configuração em runtime e gateway de produção inconclusivos.
- **Gravidade:** P1 para continuidade da investigação.
- **Evidência:** API base hardcoded em `src/lib/agpay.server.ts:11-13`; chamadas com bearer em `:36-56`; webhook em `src/routes/api/public/agpay-webhook.ts`. `ASAAS_*` e tabelas Asaas são históricas nas migrations antigas; spec 003 registra migração e a 004 decide recebimento integral e saque.
- **Limitação:** não houve credencial/consulta de ambiente, logs ou dashboard AgPay. Docs internas podem estar desatualizadas; contrato atual da API precisa ser conferido na documentação primária do provedor.

</details>


#### SEC-006 ? Role `super_admin` com claim sintética `aal1` é aceita nos testes; MFA de produção não verificado.

- **M?dulo:** Segurança/MFA Master
- **Gravidade:** P1 potencial
- **Estado:** Corrected locally: the central server-side guard requires both AAL2 and the current super_admin role; deployed Supabase MFA settings and real factors remain unverified.
- **Evid?ncias:** - ** `assertSuperAdmin` aceita sessão tipada com `claims.aal`, mas consulta apenas role `super_admin` em `user_roles` (`src/lib/auth/require-super-admin.ts:4-7,16-39`). Os testes explicitamente esperam `getSuperAdminStatus` autorizar role válida com `aal1` (`src/lib/auth/require-super-admin.test.ts:63-69`) e `requireMasterAccess` autorizar a rota com `aal1` (`src/lib/master.functions.test.ts:54-63`). Nenhum handler Master verificado acrescenta uma checagem de `aal2` na guarda central.
- **Arquivos afetados/referenciados:** `src/lib/auth/require-super-admin.ts:4-7`, `src/lib/auth/require-super-admin.test.ts:63-69`, `src/lib/master.functions.test.ts:54-63`
- **Causa:** - ** validação central de privilégio confere role e não avalia assurance level.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** ações privilegiadas devem exigir segundo fator conforme a política de segurança definida, além da role atual.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** ações privilegiadas devem exigir segundo fator conforme a política de segurança definida, além da role atual.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [seguranca.md](seguranca.md); detalhe(s): [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>seguranca.md</summary>

### SEC-006 — operações Master não exigem AAL2 na guarda server-side

- **Estado:** ausência de exigência no código confirmada; exposição em produção depende de configuração remota de MFA, não acessível nesta auditoria.
- **Gravidade:** P1 potencial até validar a política Supabase/deploy.
- **Módulo:** autenticação, autorização e operações Master.
- **Esperado:** ações privilegiadas devem exigir segundo fator conforme a política de segurança definida, além da role atual.
- **Observado:** `assertSuperAdmin` aceita sessão tipada com `claims.aal`, mas consulta apenas role `super_admin` em `user_roles` (`src/lib/auth/require-super-admin.ts:4-7,16-39`). Os testes explicitamente esperam `getSuperAdminStatus` autorizar role válida com `aal1` (`src/lib/auth/require-super-admin.test.ts:63-69`) e `requireMasterAccess` autorizar a rota com `aal1` (`src/lib/master.functions.test.ts:54-63`). Nenhum handler Master verificado acrescenta uma checagem de `aal2` na guarda central.
- **Impacto:** se MFA não for imposto globalmente pelo Supabase ou por outro controle confiável, uma sessão autenticada só com fator primário pode executar operações de suporte, reset, cobrança, acesso e cancelamento que estejam disponíveis à role Master.
- **Reprodução segura:** teste unitário já existente usa claims sintéticas `aal1` e role mock `super_admin`, retornando autorização; nenhum login/segundo fator real foi realizado.
- **Causa-raiz:** validação central de privilégio confere role e não avalia assurance level.
- **Correção recomendada para a especificação:** definir se todas as operações Master exigem `aal2` e impô-lo em guarda server-side; validar step-up/reautenticação e caminho de recuperação.
- **Regressão:** chamadas privilegiadas com role válida e `aal1` são rejeitadas; `aal2` com role válida funciona; `aal2` sem role é rejeitada; confirmar enforcement equivalente em configuração remota.
- **Limitação:** não consultamos auth settings, fatores cadastrados, claims de usuários reais nem configuração do projeto `qagot`.

</details>


#### SEC-002 ? Supabase qagot indisponível; RLS efetivo, secrets, backups e logs sem validação.

- **M?dulo:** Segurança/Produção
- **Gravidade:** P1 cobertura
- **Estado:** Inconclusivo
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** N?o listados explicitamente; consultar fontes vinculadas.
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [seguranca.md](seguranca.md); detalhe(s): [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>seguranca.md</summary>

### SEC-002 — Configuração, logs e advisors do Supabase de produção não foram acessíveis

- **Status:** limitação/inconclusivo.
- **Gravidade:** P1 para cobertura da auditoria, sem atribuir vulnerabilidade.
- Sem leitura de project ref `qagot`, não foram verificados advisors, policies efetivamente aplicadas, secrets configurados, auth settings, backups, logs ou estado de migrations.

</details>


#### BOOK-004 ? Cancelamento automático ou manual pode manter catálogo, disponibilidade e reserva ativos.

- **M?dulo:** Agenda/Lifecycle
- **Gravidade:** P1 potencial
- **Estado:** Corrigido em 2026-11-14; catálogo, profissionais, dias e chamadas públicas de reserva bloqueiam negócios não ativos ou com `cancelled_at`.
- **Revalidação em 2026-11-14 — corrigido:** `isPublicBookingEnabled` exige `status=ativo` e ausência de `cancelled_at`; aplicado ao catálogo, lista de profissionais, `loadContext` (reserva/PIX/horários) e `getOpenDays`. Testes cobrem cancelamento automático (`status=cancelado`), manual (`cancelled_at`) e business ativo. `npm test`: 80 arquivos, 820 aprovados/8 ignorados; tsc e build passaram. Nenhum serviço público ou pagamento real usado.
- **Evid?ncias:** - ** RPC `cancel_overdue_business` grava `status='cancelado'` (`supabase/migrations/20261103000000_security_hardening.sql:274-277`). A ação Master `setBusinessCancellation(action='efetivar')` grava apenas `cancelled_at` e preserva o `status` corrente (`src/lib/lifecycle.functions.ts:811-827`). O catálogo consulta `status`, mas não nega retorno para `cancelado` (`src/lib/booking.functions.ts:198-216`); `loadContext` e `getOpenDays` selecionam apenas `id,status` e bloqueiam somente `status === 'suspenso'` (`:418-427,761-774`), sem consultar `cancelled_at`. Assim, ambos caminhos de cancelamento podem deixar catálogo/dias públicos acessíveis; reservas, disponibilidade e Pix de sinal que chamam `loadContext` não recebem o marcador manual de cancelamento.
- **Arquivos afetados/referenciados:** `supabase/migrations/20261103000000_security_hardening.sql:274-277`, `src/lib/lifecycle.functions.ts:811-827`, `src/lib/booking.functions.ts:198-216`
- **Causa:** - ** regra de bloqueio público só considera `status='suspenso'`; o lifecycle usa `status` e `cancelled_at` por caminhos diferentes, mas não há guard compartilhado entre os estados e booking.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** cancelamento automático ou efetivado manualmente deve impedir que página pública ofereça/aceite novas reservas, conforme a regra de lifecycle e FR-024 da spec 010.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** cancelamento automático ou efetivado manualmente deve impedir que página pública ofereça/aceite novas reservas, conforme a regra de lifecycle e FR-024 da spec 010.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [agendamentos.md](agendamentos.md); detalhe(s): [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md).
- **Registro original integral:**

<details><summary>agendamentos.md</summary>

### BOOK-004 — estados de cancelamento não desativam o agendamento público

- **Status:** divergência de tratamento de estado confirmada no código; estabelecimento cancelado em produção não identificado.
- **Gravidade:** P1 potencial.
- **Módulo:** agendamentos públicos / ciclo de assinatura.
- **Esperado:** cancelamento automático ou efetivado manualmente deve impedir que página pública ofereça/aceite novas reservas, conforme a regra de lifecycle e FR-024 da spec 010.
- **Observado:** RPC `cancel_overdue_business` grava `status='cancelado'` (`supabase/migrations/20261103000000_security_hardening.sql:274-277`). A ação Master `setBusinessCancellation(action='efetivar')` grava apenas `cancelled_at` e preserva o `status` corrente (`src/lib/lifecycle.functions.ts:811-827`). O catálogo consulta `status`, mas não nega retorno para `cancelado` (`src/lib/booking.functions.ts:198-216`); `loadContext` e `getOpenDays` selecionam apenas `id,status` e bloqueiam somente `status === 'suspenso'` (`:418-427,761-774`), sem consultar `cancelled_at`. Assim, ambos caminhos de cancelamento podem deixar catálogo/dias públicos acessíveis; reservas, disponibilidade e Pix de sinal que chamam `loadContext` não recebem o marcador manual de cancelamento.
- **Impacto:** estabelecimento cancelado por inadimplência ou manualmente pode continuar anunciando disponibilidade e aceitando reservas/sinais. Não foi observada conta real nem pagamento.
- **Reprodução segura:** fixtures fakes separados para `status='cancelado'` e para `status='ativo'` com `cancelled_at` preenchido; verificar catálogo, open days e `loadContext` em harness sem provider. Sem dados reais nem Pix.
- **Causa-raiz:** regra de bloqueio público só considera `status='suspenso'`; o lifecycle usa `status` e `cancelled_at` por caminhos diferentes, mas não há guard compartilhado entre os estados e booking.
- **Correção recomendada para spec:** formalizar estados que bloqueiam painel, página pública, reservas e cobranças, e compartilhar um guard server-side nas jornadas públicas.
- **Regressão:** negócio ativo e suspenso mantêm comportamento definido; cancelado por inadimplência não lista agenda, não reserva e não gera cobrança pública.

</details>


#### DEP-007 ? Inspeção somente leitura registrou 72/72 execuções horárias de lembrete e 4.319 chamadas AgPay com HTTP 401 em 72h; fila/efeito por transação não consultados.

- **M?dulo:** Infra/Jobs financeiros e notificações
- **Gravidade:** P1 confirmado operacionalmente
- **Estado:** Historical production 401s were linked to secret mismatch; current correction/queue state remains blocked because non-interactive SSH access was denied and remote Supabase access is unavailable.
- **Evid?ncias:** - ** o registro da inspeção de produção informa que, na janela de 72 horas, 72/72 execuções identificadas do cron horário de lembretes retornaram HTTP 401 e o cron AgPay retornou 401 em 4.319 chamadas. A causa foi confirmada como divergência entre `AGENDA_CRON_SECRET` do cron e o valor configurado no app, sem segredo anterior coincidente (`C:\Users\Felps\segundo-cerebro\clientes\agenda-agora.md:485-490`). O código local confirma que ambos os handlers retornam imediatamente quando `authenticateCronRequest` falha; em AgPay isso ocorre antes de `processAgpayWebhookEvents(25)` e `expirePendingDeposits(25)` (`src/routes/api/public/hooks/agpay-events.ts:8-16`; `src/routes/api/public/hooks/whatsapp-reminders.ts:18-20`).
- **Arquivos afetados/referenciados:** `agenda-agora.md:485-490`, `src/routes/api/public/hooks/agpay-events.ts:8-16`, `src/routes/api/public/hooks/whatsapp-reminders.ts:18-20`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** cron autenticado com o segredo corrente deve alcançar os workers e concluir o ciclo previsto.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** cron autenticado com o segredo corrente deve alcançar os workers e concluir o ciclo previsto.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [infraestrutura.md](infraestrutura.md); detalhe(s): [`infraestrutura.md`](../docs/auditoria-agenda-agora/infraestrutura.md).
- **Registro original integral:**

<details><summary>infraestrutura.md</summary>

## DEP-007 — crons de lembretes e AgPay rejeitados em produção

- **Status:** falha operacional observada em inspeção somente leitura registrada em 13/11/2026; impacto por transação não verificado.
- **Gravidade:** P1 para disponibilidade do processamento de pagamentos e notificações; não há evidência de perda financeira individual.
- **Esperado:** cron autenticado com o segredo corrente deve alcançar os workers e concluir o ciclo previsto.
- **Observado:** o registro da inspeção de produção informa que, na janela de 72 horas, 72/72 execuções identificadas do cron horário de lembretes retornaram HTTP 401 e o cron AgPay retornou 401 em 4.319 chamadas. A causa foi confirmada como divergência entre `AGENDA_CRON_SECRET` do cron e o valor configurado no app, sem segredo anterior coincidente (`C:\Users\Felps\segundo-cerebro\clientes\agenda-agora.md:485-490`). O código local confirma que ambos os handlers retornam imediatamente quando `authenticateCronRequest` falha; em AgPay isso ocorre antes de `processAgpayWebhookEvents(25)` e `expirePendingDeposits(25)` (`src/routes/api/public/hooks/agpay-events.ts:8-16`; `src/routes/api/public/hooks/whatsapp-reminders.ts:18-20`).
- **Impacto observado/condicional:** cron de lembretes não alcançou o processamento durante as execuções observadas; worker AgPay tampouco processou/expirou registros via essas chamadas. O volume atual de eventos em espera, pagamentos atrasados, reservas afetadas, notificações perdidas e eventual processamento por outra via não foi consultado, pois o projeto Supabase alvo não aparece na conexão. Não declarar transação perdida sem conciliação.
- **Causa-raiz confirmada no registro operacional:** os valores secretos usados pelo cron e app não coincidem. Valores não foram copiados para o relatório.
- **Reprodução segura:** não repetir chamadas com segredo inválido. Confirmar a causa somente por comparação local segura de igualdade/versão, sem imprimir valores, e validar primeiro com execução controlada não financeira; reconciliar a fila antes de retomar processamento amplo.
- **Correção recomendada para spec/runbook:** procedimento seguro e observável de rotação sincronizada entre app e crons; readiness/alerta por 401 sustentado; antes de replay, inspecionar e planejar tratamento de eventos financeiros acumulados para evitar duplicidade.
- **Regressão:** segredo divergente gera alerta acionável; rotação não interrompe jobs; replay após indisponibilidade mantém idempotência e reconcilia depósitos, expirações e mensagens.
- **Limitação:** os números e a causa vêm do checkpoint de inspeção SSH somente leitura no vault, não de logs reobtidos nesta sessão; fila, runtime e estado financeiro não foram consultados novamente.

</details>


#### PAY-036 ? HTTP 5xx ou 2xx incompleto pode liberar saldo local após efeito externo possível.

- **M?dulo:** Pagamentos/Cashout
- **Gravidade:** P1 potencial
- **Estado:** Corrigido em 2026-11-14; somente HTTP 422 explícito estorna o saldo; 5xx e resposta incompleta mantêm a reserva em processamento.
- **Revalidação em 2026-11-14 — corrigido:** `AgpayApiError` 5xx já não é classificado como rejeição definitiva; `createCashoutPix` separa `success=false` (422 explícito) de 2xx sem saque/referência (`AgpayAmbiguousResponseError`). Os últimos deixam a reserva em `processing`, sem settlement e sem retry automático. Testes red/green em `agpay.server.test.ts` e `withdrawal.server.test.ts`; ambos focados: 45/45. `npm test`: 80 arquivos, 813 aprovados/8 ignorados; `npx tsc --noEmit` e `npm run build` passaram. Nenhum cashout real.
- **Evid?ncias:** - ** `agpayFetch` lança `AgpayApiError` para qualquer status HTTP não-2xx, incluindo 5xx (`src/lib/agpay.server.ts:93-110`). `createCashoutPix` também cria `AgpayApiError(422)` quando uma resposta não indica `success=false`, mas não contém `withdrawal` ou identificador (`:201-225`), embora o comentário local afirme que ausência de `withdrawal` não deve transformar saque aceito em falha. `createWithdrawal` classifica toda instância de `AgpayApiError` como falha definitiva e chama `settleWithdrawal(..., 'failed')` (`src/lib/withdrawal.server.ts:143-153`). A RPC de liquidação reverte o débito e libera saldo no resultado `failed` (`20260929120300_ledger_settle_withdrawal.sql:39-78`). Em contraste, timeout de rede vira `Error` genérico em `agpayFetch` e fica em `processing` pelo ramo ambíguo (`agpay.server.ts:60-79`; `withdrawal.server.ts:157-158`).
- **Arquivos afetados/referenciados:** `src/lib/agpay.server.ts:93-110`, `src/lib/withdrawal.server.ts:143-153`, `20260929120300_ledger_settle_withdrawal.sql:39-78`, `agpay.server.ts:60-79`, `withdrawal.server.ts:157-158`, `withdrawal.server.test.ts`
- **Causa:** - ** `AgpayApiError` mistura erro HTTP de qualquer status e falha de interpretação do corpo; `createWithdrawal` usa o tipo da classe, sem avaliar `status`, `success` ou certeza do efeito externo.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** somente rejeição documentada como definitiva deve estornar a reserva local; timeout, HTTP 5xx e resposta 2xx incompleta devem permanecer em estado conciliável sem liberar o saldo.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** somente rejeição documentada como definitiva deve estornar a reserva local; timeout, HTTP 5xx e resposta 2xx incompleta devem permanecer em estado conciliável sem liberar o saldo.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md).
- **Registro original integral:**

<details><summary>pagamentos.md</summary>

### PAY-036 — respostas AgPay ambíguas podem liberar saldo do cashout

- **Estado:** classificação incompatível confirmada no código; resposta real do gateway e ocorrência não verificadas.
- **Gravidade:** P1 potencial (se o cashout tiver sido aceito externamente, o saldo liberado pode financiar outro saque).
- **Módulo:** pagamentos / cashout / tratamento de respostas ambíguas.
- **Esperado:** somente rejeição documentada como definitiva deve estornar a reserva local; timeout, HTTP 5xx e resposta 2xx incompleta devem permanecer em estado conciliável sem liberar o saldo.
- **Observado:** `agpayFetch` lança `AgpayApiError` para qualquer status HTTP não-2xx, incluindo 5xx (`src/lib/agpay.server.ts:93-110`). `createCashoutPix` também cria `AgpayApiError(422)` quando uma resposta não indica `success=false`, mas não contém `withdrawal` ou identificador (`:201-225`), embora o comentário local afirme que ausência de `withdrawal` não deve transformar saque aceito em falha. `createWithdrawal` classifica toda instância de `AgpayApiError` como falha definitiva e chama `settleWithdrawal(..., 'failed')` (`src/lib/withdrawal.server.ts:143-153`). A RPC de liquidação reverte o débito e libera saldo no resultado `failed` (`20260929120300_ledger_settle_withdrawal.sql:39-78`). Em contraste, timeout de rede vira `Error` genérico em `agpayFetch` e fica em `processing` pelo ramo ambíguo (`agpay.server.ts:60-79`; `withdrawal.server.ts:157-158`).
- **Impacto condicional:** se o AgPay efetuar o cashout antes de responder 5xx, ou aceitar uma operação cuja resposta 2xx não tenha a forma/referência esperada, o sistema pode liberar o saldo local como failed. O webhook não terá `provider_ref` para correlacionar e um novo pedido pode consumir o saldo liberado. Não há evidência de que o AgPay faça esses retornos após aceitar payout.
- **Cobertura existente:** `withdrawal.server.test.ts` contém um caso sintético de timeout genérico em `processing` e um caso de `AgpayApiError(422)` que reverte o saldo; não localizei teste com status 5xx ou sucesso 2xx incompleto. Nenhum teste foi executado nesta rodada.
- **Causa-raiz:** `AgpayApiError` mistura erro HTTP de qualquer status e falha de interpretação do corpo; `createWithdrawal` usa o tipo da classe, sem avaliar `status`, `success` ou certeza do efeito externo.
- **Reprodução segura:** harness fake poderia fazer `createCashoutPix` lançar `AgpayApiError(500)` ou simular HTTP 2xx `success:true` sem referência, e observar a chamada de liquidação `failed`/reversão. Não foi executado; sem HTTP ou saldo real.
- **Correção recomendada para spec:** modelar explicitamente `rejeitado`, `aceito` e `resultado incerto`; não classificar 5xx ou resposta incompleta como rejeição sem garantia contratual; persistir idempotency/correlation antes do POST e encaminhar resultado incerto a reconciliação.
- **Regressão:** 4xx comprovadamente definitivo pode reverter; 5xx após possível side effect mantém reserva bloqueada; 2xx sem id/ref fica conciliável; timeout permanece sem retry automático duplicado; webhook posterior resolve uma única vez.
- **Limitação externa:** buscas na documentação pública AgPay não retornaram especificação verificável de semântica 5xx ou resposta 2xx sem referência. Contrato da conta e comportamento em sandbox permanecem desconhecidos.

</details>


#### PAY-014 ? `amount` do webhook não é comparado ao valor local antes de creditar/ativar.

- **M?dulo:** Pagamentos/Integridade
- **Gravidade:** P1 potencial
- **Estado:** corrigido localmente; documentação oficial consultada define `amount` em reais. Webhook e polling comparam o valor bruto antes de confirmar; divergências ficam na fila Master de revisão. Ocorrência divergente em produção não verificada.
- **Revalidação em 2026-11-14 — bloqueado:** `WebhookPayload` não tipa nem valida o valor; o worker confirma por transaction UUID/status, e a sincronização reduz `fetchPayment` a status. A integração cria pagamentos enviando `amountCents / 100` e o tipo local da resposta é `string`, mas não encontramos contrato oficial verificável que fixe unidade/arredondamento do webhook/consulta. A spec pede quarentena e revisão manual, porém o conjunto de estados/UI de revisão precisa ser definido. Não inferir unidade nem adicionar status sem esse contrato. Nenhuma confirmação externa foi chamada; nenhum pagamento real ocorreu.
- **Evid?ncias:** - ** `WebhookPayload` em `src/lib/agpay-events.server.ts:11-20` não tipa `data.amount`; a rota pública persiste o objeto recebido (`src/routes/api/public/agpay-webhook.ts:28-45`). No worker, `deposit.completed` chama `confirmDepositPayment(transactionUuid, "completed")` sem transmitir ou comparar o valor (`agpay-events.server.ts:535-540`). O caminho de consulta do cliente também confirma: `synchronizeDepositPayment` chama `fetchPaymentStatus`, que descarta os demais campos retornados por `fetchPayment`, e confirma quando só o status é `completed` (`agpay-events.server.ts:424-450`; `src/lib/agpay.server.ts:143-154,223-242`). O ledger calcula o crédito usando `deposit_payments.amount_cents` local (`agpay-events.server.ts:136-145`). Para assinatura, `confirmSubscriptionCharge` também recebe somente transaction ID e marca como pago/estende acesso com base na cobrança local (`:174-220`).
- **Arquivos afetados/referenciados:** `pagamentos.md`, `specs/005-ledger-financeiro-saldo/spec.md:147-149`, `src/lib/agpay-events.server.ts:11-20`, `src/routes/api/public/agpay-webhook.ts:28-45`, `agpay-events.server.ts:535-540`, `agpay-events.server.ts:424-450`, `src/lib/agpay.server.ts:143-154`, `agpay-events.server.ts:136-145`
- **Causa:** - ** o consumidor reduz o evento a UUID/status e descarta o valor reportado, sem validação financeira nem fila de revisão.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** spec 005, `specs/005-ledger-financeiro-saldo/spec.md:147-149`, exige marcar como suspeito, não creditar e sinalizar para revisão manual quando `amount` do webhook divergir do valor local.
- **Checklist detalhado de testes (executado; evidências no Ciclo 81):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** spec 005, `specs/005-ledger-financeiro-saldo/spec.md:147-149`, exige marcar como suspeito, não creditar e sinalizar para revisão manual quando `amount` do webhook divergir do valor local.
  - [x] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [x] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [pagamentos.md](pagamentos.md); detalhe(s): [`conformidade-spec.md`](../docs/auditoria-agenda-agora/conformidade-spec.md), [`pagamentos.md`](../docs/auditoria-agenda-agora/pagamentos.md).
- **Registro original integral:**

<details><summary>conformidade-spec.md</summary>

### PAY-014 — divergência de valor no webhook

Spec 005 determina rejeitar/segurar e sinalizar qualquer webhook cujo valor bruto divirja da cobrança local. A rota persiste o payload, mas o worker descarta `amount` e processa por transaction UUID; o ledger credita baseado no valor local. Nenhum cenário com discrepância está presente na suíte revisada. Veja PAY-014 em [pagamentos.md](pagamentos.md).

</details>

<details><summary>pagamentos.md</summary>

### PAY-014 — Valor bruto do webhook não é comparado à cobrança local

- **Status:** divergência com spec 005 e ausência de comparação confirmadas em código; discrepância real no gateway não verificada.
- **Gravidade:** P1 potencial.
- **Módulo:** pagamentos / integridade financeira / depósitos e assinatura.
- **Esperado:** spec 005, `specs/005-ledger-financeiro-saldo/spec.md:147-149`, exige marcar como suspeito, não creditar e sinalizar para revisão manual quando `amount` do webhook divergir do valor local.
- **Observado:** `WebhookPayload` em `src/lib/agpay-events.server.ts:11-20` não tipa `data.amount`; a rota pública persiste o objeto recebido (`src/routes/api/public/agpay-webhook.ts:28-45`). No worker, `deposit.completed` chama `confirmDepositPayment(transactionUuid, "completed")` sem transmitir ou comparar o valor (`agpay-events.server.ts:535-540`). O caminho de consulta do cliente também confirma: `synchronizeDepositPayment` chama `fetchPaymentStatus`, que descarta os demais campos retornados por `fetchPayment`, e confirma quando só o status é `completed` (`agpay-events.server.ts:424-450`; `src/lib/agpay.server.ts:143-154,223-242`). O ledger calcula o crédito usando `deposit_payments.amount_cents` local (`agpay-events.server.ts:136-145`). Para assinatura, `confirmSubscriptionCharge` também recebe somente transaction ID e marca como pago/estende acesso com base na cobrança local (`:174-220`).
- **Impacto:** um webhook assinado ou a consulta de status pode confirmar reserva, creditar o líquido do valor local ou estender assinatura sem revisão, mesmo se a quantia informada pelo provedor divergir; contraria a política financeira escrita. Também não se registra alerta de divergência por montante.
- **Reprodução segura:** harness fake com cobrança local de 10.000 centavos; testar webhook `deposit.completed` com valor R$ 1,00 e resposta de status `completed` com campo `amount` diferente; observar se ambos avançam sem comparação. Não executado nesta rodada; apenas harness/mock, sem gateway/banco real.
- **Causa-raiz:** o consumidor reduz o evento a UUID/status e descarta o valor reportado, sem validação financeira nem fila de revisão.
- **Correção recomendada para spec:** manter valor/quantia e moeda da cobrança congelados, normalizar a unidade reportada oficialmente pelo provedor e comparar antes de qualquer transição/ledger; incompatibilidade deve gerar status suspeito + alerta Master, sem crédito automático.
- **Regressão:** nos caminhos de webhook e consulta, valor idêntico confirma; valor menor/maior, ausente ou unidade ambígua não credita nem ativa e gera registro revisável; retry mantém o estado suspeito.

</details>


#### SEC-016 ? Grant/policy permitem INSERT por owner; hardening protege apenas UPDATE. Pode contornar criação Master e semear acesso/preço não autorizados. Migrations remotas não conferidas.

- **M?dulo:** Segurança/Autorização comercial
- **Gravidade:** P1 potencial
- **Estado:** Corrigido em 2026-11-14 por migration local; owner comum não consegue inserir/excluir businesses. Criação pelo serviço continua autorizada.
- **Revalidação em 2026-11-14 — corrigido:** o grant e a policy `FOR ALL` herdados permitiam INSERT pelo owner; reproduzido no Postgres efêmero. Migration local `20261114150000_restrict_business_owner_insert.sql` remove a policy ampla, mantém SELECT/UPDATE do próprio negócio e revoga INSERT/DELETE para `anon`/`authenticated`, preservando `service_role`. Regressão red antes da migration e green depois; `npm run test:db` — 3 arquivos, 72 testes aprovados. A migration não foi aplicada remotamente.
- **Evid?ncias:** - ** migration inicial concede INSERT em `businesses` a `authenticated` e `businesses_own FOR ALL` permite INSERT quando `owner_id = auth.uid()` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`). Não encontrei constraint única que limite `owner_id` a um business. O hardening recente só revoga UPDATE e concede colunas editáveis, não revoga INSERT (`20261103000000_security_hardening.sql:177-179`). O trigger `guard_business_control_columns` é `BEFORE UPDATE`, não INSERT (`:181-206`). `status` e `monthly_fee_cents` têm defaults na chain (`20260907051645_7c345a19-dd9e-4842-b72b-2181e762b4c8.sql:2-3`); `access_until` é nullable (`20261027160000_access_until.sql:1-7`) e não encontrei CHECK que limite valores inseridos por owner. O fluxo `createBusinessWithOwner` é Master-gated e define os campos via server (`src/lib/admin.functions.ts:92-146`); o contrato Master exige `super_admin` + AAL2 (`specs/002-correcoes-pos-teste-manual/contracts/server-functions.md:23`). `BusinessProvider` carrega negócios acessíveis para o usuário e os oferece para seleção (`src/lib/business.tsx:97-126`), então uma linha própria inserida aparece no estado local quando o cache revalida.
- **Arquivos afetados/referenciados:** `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`, `20261103000000_security_hardening.sql:177-179`, `20260907051645_7c345a19-dd9e-4842-b72b-2181e762b4c8.sql:2-3`, `20261027160000_access_until.sql:1-7`, `src/lib/admin.functions.ts:92-146`, `specs/002-correcoes-pos-teste-manual/contracts/server-functions.md:23`, `src/lib/business.tsx:97-126`, `src/lib/plan-state.ts:38-92`, `painel.tsx`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** criação de estabelecimento deve ocorrer via fluxo autorizado Master/SDR que define preço, status, trial e acesso; usuário owner comum não deve escrever campos de controle nem criar tenant sem aprovação.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** criação de estabelecimento deve ocorrer via fluxo autorizado Master/SDR que define preço, status, trial e acesso; usuário owner comum não deve escrever campos de controle nem criar tenant sem aprovação.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [seguranca.md](seguranca.md); detalhe(s): [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>seguranca.md</summary>

### SEC-016 — INSERT direto pode criar business com campos de controle escolhidos pelo owner

- **Estado:** INSERT do owner com valores comerciais escolhidos foi reproduzido na chain local efêmera; migration remota e regra de descoberta/acesso continuam não verificadas.
- **Gravidade:** P1 potencial (onboarding, acesso e faturamento podem ser contornados por owner autenticado).
- **Módulo:** segurança / autorização comercial / ciclo de assinatura.
- **Esperado:** criação de estabelecimento deve ocorrer via fluxo autorizado Master/SDR que define preço, status, trial e acesso; usuário owner comum não deve escrever campos de controle nem criar tenant sem aprovação.
- **Observado:** migration inicial concede INSERT em `businesses` a `authenticated` e `businesses_own FOR ALL` permite INSERT quando `owner_id = auth.uid()` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`). Não encontrei constraint única que limite `owner_id` a um business. O hardening recente só revoga UPDATE e concede colunas editáveis, não revoga INSERT (`20261103000000_security_hardening.sql:177-179`). O trigger `guard_business_control_columns` é `BEFORE UPDATE`, não INSERT (`:181-206`). `status` e `monthly_fee_cents` têm defaults na chain (`20260907051645_7c345a19-dd9e-4842-b72b-2181e762b4c8.sql:2-3`); `access_until` é nullable (`20261027160000_access_until.sql:1-7`) e não encontrei CHECK que limite valores inseridos por owner. O fluxo `createBusinessWithOwner` é Master-gated e define os campos via server (`src/lib/admin.functions.ts:92-146`); o contrato Master exige `super_admin` + AAL2 (`specs/002-correcoes-pos-teste-manual/contracts/server-functions.md:23`). `BusinessProvider` carrega negócios acessíveis para o usuário e os oferece para seleção (`src/lib/business.tsx:97-126`), então uma linha própria inserida aparece no estado local quando o cache revalida.
- **Impacto:** owner poderia potencialmente inserir negócio adicional próprio com `status='ativo'`, `monthly_fee_cents=0` e `access_until` futuro (ou outros valores de controle), sem passar pelo onboarding Master, alterando classificação/MRR. O estado visual de plano trata `access_until` futuro como ativo/teste (`src/lib/plan-state.ts:38-92`), e `painel.tsx` considera expirado somente negócio suspenso ou trial configurado e vencido (`:1234-1235`); isso cria um caminho plausível para habilitar o painel sem cobrança aprovada. Não foi demonstrado qual conjunto mínimo de serviços/profissionais libera cada jornada nem houve inserção real.
- **Reprodução segura realizada:** em transação do Postgres efêmero, usuário fictício com role `authenticated` e claim própria inseriu business com `status='ativo'`, `monthly_fee_cents=1` e `access_until='2000-01-01'`; RLS aceitou e devolveu esses valores. Depois a transação foi revertida e o database descartável removido. A UI/BusinessProvider não foi exercitada.
- **Causa-raiz local:** grant de INSERT e policy `FOR ALL` do template inicial continuaram após onboarding ser encapsulado em função Master; o hardening cobriu UPDATE, mas não insert-time protected fields.
- **Correção recomendada para spec:** revogar INSERT de authenticated em `businesses` e manter criação por service role/fluxo autorizado; adicionar defesa no banco para campos de controle em INSERT e validar automaticamente `owner_id`/status/trial/acesso.
- **Regressão:** owner comum não cria business via PostgREST; Master/SDR provisionam com preços e estados autorizados; alteração de campos protegidos em INSERT e UPDATE por cliente é rejeitada; provisionamento não gera duplicata.
- **Limitação:** reprodução é da chain local apenas; políticas remotas e regra de produto permanecem inconclusivas. Nenhuma conta/valor real foi consultado. Gravidade continua potencial em produção.

</details>


#### SEC-009 ? Policies usam somente membership; permissão `view_customer_phone` controla navegação/máscara de UI, não SELECT. Produção não verificada.

- **M?dulo:** Segurança/Privacidade de clientes
- **Gravidade:** P1 potencial
- **Estado:** Revalidado; correção bloqueada até definir projeção segura e mapa de campos/permissões.
- **Revalidação em 2026-11-14 — bloqueio de arquitetura:** `painel.clientes.tsx` ainda lê `customers.select(*)` e appointments com `customer_phone`; `painel.index.tsx` também consulta appointments diretamente e a UI mascara valores depois de recebê-los. `view_customer_phone` não é imposta no RLS. Como owner e profissional usam a mesma role Postgres `authenticated`, revogar colunas diretamente quebra leituras legítimas de ambos. É preciso definir projeção por papel/permissão e migrar leituras atrás de API/RPC/view segura; outras PII (CPF, e-mail, notas, nascimento) também precisam de regra. Nenhuma migration aplicada.
- **Evid?ncias:** - ** `customers` concede `SELECT` a `authenticated` e tem policy `customers_professional_read` que autoriza qualquer `is_business_member(business_id)` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:87-101`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:122-124`). `appointments` também concede SELECT e tem `appointments_professional_read` com a mesma condição ampla (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:104-122`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:107-108`). `is_business_member` retorna true para qualquer profissional ativo do negócio independentemente de `permissions` (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:30-43`). `customers` inclui `phone`, `email`, `notes`, e outra migration adiciona `birth_date` e `cpf` (`20261011000300_customer_documents.sql:1-5`); appointments armazenam `customer_phone`, `customer_name` e `notes`. Não encontrei revogação/row policy posterior que condicione leitura a `view_customer_phone`.
- **Arquivos afetados/referenciados:** `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:87-101`, `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:122-124`, `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:104-122`, `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:107-108`, `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:30-43`, `20261011000300_customer_documents.sql:1-5`, `src/routes/_authenticated/painel.tsx:345`, `src/lib/business.tsx:140-154`, `src/routes/_authenticated/painel.clientes.tsx:703`, `src/routes/_authenticated/painel.index.tsx:214-232`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** `view_customer_phone` e as permissões de dados do cliente devem ser impostas no banco/API para cada leitura protegida, não apenas no menu ou no componente.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** `view_customer_phone` e as permissões de dados do cliente devem ser impostas no banco/API para cada leitura protegida, não apenas no menu ou no componente.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [seguranca.md](seguranca.md); detalhe(s): [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>seguranca.md</summary>

### SEC-009 — profissionais conseguem ler dados pessoais de clientes sem a permissão específica de telefone

- **Estado:** profissional ativo sem `view_customer_phone` leu PII no replay isolado da chain local; permissões remotas e dados de produção não verificados.
- **Gravidade:** P1 potencial por exposição de dados pessoais.
- **Esperado:** `view_customer_phone` e as permissões de dados do cliente devem ser impostas no banco/API para cada leitura protegida, não apenas no menu ou no componente.
- **Observado:** `customers` concede `SELECT` a `authenticated` e tem policy `customers_professional_read` que autoriza qualquer `is_business_member(business_id)` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:87-101`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:122-124`). `appointments` também concede SELECT e tem `appointments_professional_read` com a mesma condição ampla (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:104-122`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:107-108`). `is_business_member` retorna true para qualquer profissional ativo do negócio independentemente de `permissions` (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:30-43`). `customers` inclui `phone`, `email`, `notes`, e outra migration adiciona `birth_date` e `cpf` (`20261011000300_customer_documents.sql:1-5`); appointments armazenam `customer_phone`, `customer_name` e `notes`. Não encontrei revogação/row policy posterior que condicione leitura a `view_customer_phone`.
- **Contraste de interface:** o menu só mostra `/painel/clientes` se `canOpen` reconhecer `view_customer_phone` (`src/routes/_authenticated/painel.tsx:345,1872-1881`), e o telefone é mascarado na UI quando a permissão não está confirmada (`src/lib/business.tsx:140-154`; `src/routes/_authenticated/painel.clientes.tsx:703`). A agenda busca appointments por client Supabase com `select("*")`, incluindo `customer_phone`, e mascara o campo somente na renderização (`src/routes/_authenticated/painel.index.tsx:214-232,748-752`). Um profissional autenticado com `view_agenda` pode receber os valores no browser e pode chamar as APIs Supabase diretamente. RLS retorna todas as colunas sob as policies de membership.
- **Impacto:** profissional sem a permissão de visualizar telefone pode ler números de clientes em appointments e na tabela `customers` via Supabase REST/SDK; e-mail, observações, data de nascimento e CPF também ficam acessíveis por SELECT amplo, embora a política esperada para esses campos não esteja definida. Mascaramento de tela não protege os dados já acessíveis pelo banco.
- **Causa-raiz confirmada na cadeia local:** policy foi escrita para membership amplo, enquanto a permissão granular existe somente como regra da interface; não há policy de coluna/SELECT que avalie `view_customer_phone`.
- **Reprodução segura realizada:** em Postgres efêmero, criou-se business, profissional ativo com `view_customer_phone=false`, cliente com PII sentinela e appointment fictício. Sob `SET LOCAL ROLE authenticated` com claim do profissional, SELECT de `customers(phone,email,notes)` e `appointments(customer_phone)` retornou os sentinelas. A transação foi revertida e o banco removido; nenhum dado real foi usado.
- **Correção recomendada para spec:** definir quais campos cada permissão protege e impor isso na API/RLS (por exemplo, views/RPCs com projeção segura ou permissions verificadas), além de testar acesso direto sem UI.
- **Regressão:** owner, profissional com permissão e sem permissão; leitura direta da API, export CSV, CPF, e-mail, telefone, notas e birth_date; usuários de outro negócio seguem isolados.
- **Limitação:** validação dinâmica confirma a chain local apenas; RLS remota e produção não foram consultadas. `birth_date`/CPF seguem risco estático e não foram incluídos no fixture dinâmico.

</details>


#### SEC-010 ? Grant autenticado permite SELECT integral e policy é membership; dados de produção e migration remota não conferidos.

- **M?dulo:** Segurança/Segredos do negócio
- **Gravidade:** P1 potencial
- **Estado:** Revalidado; correção bloqueada até mapear colunas por owner/profissional e migrar os consumidores diretos.
- **Revalidação em 2026-11-14 — bloqueio de arquitetura:** 42 arquivos não-testes mencionam `businesses`; o owner provider seleciona campos financeiros/de lifecycle e a UI possui leituras diretas. A role compartilhada `authenticated` não diferencia grant de coluna para owner e profissional; restringir SELECT sem uma projeção servida pelo backend quebra fluxos. É necessário separar campos sensíveis em tabelas privadas ou endpoints/RPCs e migrar os consumidores. Migration local nenhuma aplicada para este item.
- **Evid?ncias:** - ** a migration inicial concede `SELECT, INSERT, UPDATE, DELETE` em `businesses` a `authenticated` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`). A policy `businesses_professional_read` permite SELECT quando há profissional ativo para o negócio (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:70-75`), e `is_business_member` não testa permissões de campo (`:30-43`). O narrowing da migration `20260916012915` revoga SELECT de `anon` e concede colunas públicas restritas apenas a `anon`; não revoga SELECT de `authenticated`. Não encontrei grant column-level/revogação de SELECT para o papel autenticado.
- **Arquivos afetados/referenciados:** `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`, `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:70-75`, `src/integrations/supabase/types.ts:418-474`, `src/lib/withdrawal.server.ts:206-230`, `20261002150000_whatsapp_credentials_private.sql`, `src/lib/whatsapp-notify.server.ts:73-80`, `src/lib/whatsapp-greeting.server.ts:266`, `20261103000000_security_hardening.sql:177-206`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** `businesses` só deve expor para profissionais os campos operacionais necessários à sua função. Credenciais, destinos de repasse, hashes de PIN, CPF do proprietário e parâmetros comerciais devem ter acesso específico a owner/serviços privilegiados.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** `businesses` só deve expor para profissionais os campos operacionais necessários à sua função. Credenciais, destinos de repasse, hashes de PIN, CPF do proprietário e parâmetros comerciais devem ter acesso específico a owner/serviços privilegiados.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [seguranca.md](seguranca.md); detalhe(s): [`seguranca.md`](../docs/auditoria-agenda-agora/seguranca.md).
- **Registro original integral:**

<details><summary>seguranca.md</summary>

### SEC-010 — profissionais ativos têm SELECT de linha inteira em `businesses`

- **Estado:** autorização ampla confirmada na chain local; impacto de produção condicionado a migrations aplicadas e valores ainda preenchidos.
- **Gravidade:** P1 potencial (credenciais/destino financeiro e dados fiscais).
- **Esperado:** `businesses` só deve expor para profissionais os campos operacionais necessários à sua função. Credenciais, destinos de repasse, hashes de PIN, CPF do proprietário e parâmetros comerciais devem ter acesso específico a owner/serviços privilegiados.
- **Observado:** a migration inicial concede `SELECT, INSERT, UPDATE, DELETE` em `businesses` a `authenticated` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`). A policy `businesses_professional_read` permite SELECT quando há profissional ativo para o negócio (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:70-75`), e `is_business_member` não testa permissões de campo (`:30-43`). O narrowing da migration `20260916012915` revoga SELECT de `anon` e concede colunas públicas restritas apenas a `anon`; não revoga SELECT de `authenticated`. Não encontrei grant column-level/revogação de SELECT para o papel autenticado.
- **Colunas sensíveis presentes na chain/tipos:** `withdrawal_pix_key`, `withdrawal_pix_key_type`, `withdrawal_pin_hash`, `owner_cpf`, `agpay_commission_percent`, `agpay_split_email`, `agpay_split_status` e dados de acesso/lifecycle (`src/integrations/supabase/types.ts:418-474`; migrações correspondentes). O hash é SHA-256 determinístico de `businessId:PIN` de quatro dígitos (`src/lib/withdrawal.server.ts:206-230`), portanto sua exposição revela um verificador passível de enumeração offline; nenhuma tentativa foi feita.
- **Credencial WhatsApp legada:** `20261002150000_whatsapp_credentials_private.sql` cria tabela privada, revoga nela os grants de `anon`/`authenticated` e copia os dados da coluna antiga, mas declara o rollout como aditivo até uma migration posterior verificada que nulifique `businesses.whatsapp_instance_token` (`:1-38`). Não há migration de nulificação/remoção na chain local e o runtime ainda tem fallback para a coluna (`src/lib/whatsapp-notify.server.ts:73-80`, `src/lib/whatsapp-greeting.server.ts:266`). Não foi lido qualquer token.
- **Hardening observado:** `20261103000000_security_hardening.sql:177-206` revoga UPDATE e concede escrita de colunas específicas; não restringe SELECT. O controle de escrita não elimina esta leitura de linha inteira.
- **Impacto:** profissional ativo pode consultar pela API autenticada valores presentes na linha do próprio negócio fora do painel: chave de saque, hash do PIN, dados fiscais/comerciais e, se ainda preenchido, token WhatsApp legado. Possível enumeração de PIN e uso indevido de credencial dependem de conteúdo/configuração; não foram observados em produção.
- **Reprodução segura:** em Supabase local descartável, criar negócio e profissional fictícios, popular colunas sentinela não secretas e testar `businesses.select('withdrawal_pix_key,withdrawal_pin_hash,owner_cpf,whatsapp_instance_token')` com JWT do profissional. Não consultar produção nem imprimir valores reais.
- **Causa-raiz confirmada localmente:** a policy de membership foi adicionada sem reduzir o grant de SELECT da role `authenticated` nem separar colunas sensíveis em tabela privada; o hardening tratou UPDATE, não leitura.
- **Correção recomendada para spec:** definir contrato de colunas por papel, usar grants/visões/RPCs de projeção mínima e mover/remover definitivamente colunas secretas legadas após todos os workers suportarem o armazenamento privado.
- **Regressão:** profissional sem e com cada permissão só lê dados aprovados; REST/SDK direto não recupera credenciais/dados fiscais indevidos; owner e service role mantêm os fluxos legítimos; testar migração de nullificação após rollout completo.
- **Limitação:** o projeto Supabase de produção não está acessível. Não se confirmou policy ativa, migration aplicada, preenchimento dos campos ou credencial exposta; nenhum segredo foi lido.

</details>


#### INT-007 ? Evolution em uso e duas instâncias desconectadas na inspeção; associação a businesses e estado posterior não comprovados.

- **M?dulo:** WhatsApp/Produção
- **Gravidade:** P1 cobertura
- **Estado:** Evidência parcial de 13/11
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** `agenda-agora.md:485-490`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [integracoes.md](integracoes.md); detalhe(s): [`integracoes.md`](../docs/auditoria-agenda-agora/integracoes.md).
- **Registro original integral:**

<details><summary>integracoes.md</summary>

### INT-007 — Estado das instâncias WhatsApp observado; associação ao negócio inconclusiva

- **Status:** provedor e estado das instâncias observados em inspeção de produção de 13/11/2026; ligação entre instância e business/unidade não comprovada nesta árvore.
- **Gravidade:** P1 para completude operacional; não atribui a desconexão como causa de falhas anteriores a ela.
- **Evidência:** o registro de inspeção por SSH/Evolution informa que o app usava Evolution e duas instâncias estavam desconectadas. Uma não tinha webhook; a outra tinha webhook ativo e header compatível com o app, mas caiu em 12/11 às 21:02 (Fortaleza). Havia atividade de mensagens antes dessa queda; a desconexão posterior não explica por si só o relato anterior (`C:\Users\Felps\segundo-cerebro\clientes\agenda-agora.md:485-490`). Versão instalada, business correspondente e situação atual depois da inspeção não foram estabelecidos.
- **Validação segura:** correlacionar instâncias a negócios e capturar status/configuração em leitura somente; para teste de envio, usar número controlado e autorização explícita. Nenhuma mensagem foi enviada nesta auditoria.

</details>


### P2 ? confirmado: ap?s estabilizar P0/P1 (39)

#### BOOK-002 ? Horário sem profissional não tem proteção atômica contra overlap em criação e remarcação.

- **M?dulo:** Agenda/Concorrência
- **Gravidade:** P2
- **Estado:** Corrected locally in migration 20261115110000; remote rollout is unverified.
- **Evid?ncias:** - ** a constraint de exclusão só cobre `professional_id IS NOT NULL` (`supabase/migrations/20260916013512_e8a1f3d2-4c6b-4e91-9a5f-2b7c9d4e1a06.sql:14-19`). O próprio comentário da migration diz que o caso `NULL` fica sem essa defesa. `reserveBooking` usa SELECT antes do INSERT (`src/lib/booking.functions.ts:850-883`), que não serializa chamadas concorrentes. O caminho de remarcação também calcula disponibilidade antes de gravar (`rescheduleAppointmentPublic`, `src/lib/booking.functions.ts:559-619`); seu UPDATE não possui guarda contra uma alteração concorrente da agenda e a constraint não cobre reservas sem profissional.
- **Arquivos afetados/referenciados:** `supabase/migrations/20260916013512_e8a1f3d2-4c6b-4e91-9a5f-2b7c9d4e1a06.sql:14-19`, `src/lib/booking.functions.ts:850-883`, `src/lib/booking.functions.ts:559-619`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** impedir duas reservas simultâneas que ocupem o calendário único do negócio.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** impedir duas reservas simultâneas que ocupem o calendário único do negócio.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **IDs/refer?ncias consolidados:** DB-001 (banco-de-dados.md) ? formula??o anterior da lacuna de constraint de overlap.
- **Refer?ncias originais:** [agendamentos.md](agendamentos.md); detalhe(s): [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md).
- **Registro original integral:**

<details><summary>agendamentos.md</summary>

### BOOK-002 — Agendamentos sem profissional não têm proteção atômica contra sobreposição

- **Status:** lacuna confirmada na migration; ocorrência em produção não medida.
- **Gravidade:** P2 (integridade de agenda; pode elevar a P1 se ocorrer em volume).
- **Módulo:** agendamento sem profissional.
- **Esperado:** impedir duas reservas simultâneas que ocupem o calendário único do negócio.
- **Observado:** a constraint de exclusão só cobre `professional_id IS NOT NULL` (`supabase/migrations/20260916013512_e8a1f3d2-4c6b-4e91-9a5f-2b7c9d4e1a06.sql:14-19`). O próprio comentário da migration diz que o caso `NULL` fica sem essa defesa. `reserveBooking` usa SELECT antes do INSERT (`src/lib/booking.functions.ts:850-883`), que não serializa chamadas concorrentes. O caminho de remarcação também calcula disponibilidade antes de gravar (`rescheduleAppointmentPublic`, `src/lib/booking.functions.ts:559-619`); seu UPDATE não possui guarda contra uma alteração concorrente da agenda e a constraint não cobre reservas sem profissional.
- **Impacto:** duas reservas sem profissional podem ocupar a mesma agenda via criação ou remarcações concorrentes. Com sinal, criação também interage com BOOK-001. Não foi provado que a migration foi aplicada no banco remoto.
- **Reprodução segura:** DB de ensaio, duas transações sincronizadas em barreira, sem profissional e sem sinal; confirmar que dois INSERTs passam e que duas remarcações podem ocupar intervalo coincidente. Não executar em produção.
- **Correção recomendada para spec:** constraint/serialização para o calendário do negócio quando `professional_id` é nulo, junto com a regra de sinal.
- **Regressão necessária:** concorrência em criação e remarcação com/sem profissional, horários adjacentes sem sobreposição, cancelado e aguardar sinal.

</details>


#### BOOK-003 ? Erro nas consultas de bloqueios/agendamentos pode falhar aberto.

- **M?dulo:** Agenda/Resiliência
- **Gravidade:** P2
- **Estado:** Corrigido localmente em 2026-11-14; erros de consulta falham fechados antes da reserva.
- **Evid?ncias:** - ** em `computeAvailableSlots`, as consultas a `time_blocks` e `appointments` leem apenas `{ data }` e não verificam `{ error }` (`src/lib/booking.functions.ts:679-691`); o loop usa `blocks ?? []` e `appts ?? []` (`:694-726`). A reserva reutiliza o resultado para validar horário (`:816-831`). A consulta de conflito final também ignora `error` (`:850-859`). Se uma leitura falhar, parte do calendário pode ser tratada como livre.
- **Arquivos afetados/referenciados:** `src/lib/booking.functions.ts:679-691`
- **Causa:** - ** resultados Supabase de consultas críticas não são distinguidos de resposta vazia.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** se falhar leitura de bloqueios ou agendamentos, retornar erro e não criar a reserva.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** se falhar leitura de bloqueios ou agendamentos, retornar erro e não criar a reserva.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **IDs/refer?ncias consolidados:** API-001 (backend.md e riscos.md) referencia o mesmo erro de consulta de disponibilidade.
- **Refer?ncias originais:** [agendamentos.md](agendamentos.md); detalhe(s): [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md).
- **Registro original integral:**

<details><summary>agendamentos.md</summary>

### BOOK-003 — Erro de leitura de bloqueios/agendamentos pode ser tratado como disponibilidade vazia

- **Status:** comportamento fail-open confirmado; ocorrência concreta não vista.
- **Gravidade:** P2.
- **Módulo:** cálculo de disponibilidade e criação de reserva.
- **Esperado:** se falhar leitura de bloqueios ou agendamentos, retornar erro e não criar a reserva.
- **Observado:** em `computeAvailableSlots`, as consultas a `time_blocks` e `appointments` leem apenas `{ data }` e não verificam `{ error }` (`src/lib/booking.functions.ts:679-691`); o loop usa `blocks ?? []` e `appts ?? []` (`:694-726`). A reserva reutiliza o resultado para validar horário (`:816-831`). A consulta de conflito final também ignora `error` (`:850-859`). Se uma leitura falhar, parte do calendário pode ser tratada como livre.
- **Impacto:** reserva pode ser exibida/aceita em bloqueio ou horário já ocupado durante falha de leitura; a constraint só protege parte dos casos com profissional e exclui `aguardando_sinal`.
- **Causa-raiz:** resultados Supabase de consultas críticas não são distinguidos de resposta vazia.
- **Reprodução segura:** teste de unidade com erro de consulta em `time_blocks`/`appointments` e verificação de que `getAvailability` e `reserveBooking` recusam fail-closed; usar mocks, sem DB real.
- **Correção recomendada para spec:** verificar e propagar todo erro das consultas que autorizam reserva; fail-closed.
- **Regressão necessária:** erro em cada consulta; arrays vazios genuínos; rate limit; conflito; bloqueio recorrente e por data.

</details>



**Execucao 2026-11-14:** testes red/green reproduziram falha nas leituras de `time_blocks` e `appointments`; a checagem final de conflito tambem foi coberta. Em qualquer erro, a funcao rejeita antes de inserir appointment ou charge. `src/lib/booking.functions.test.ts`: 95/95; `npm test`: 80 arquivos aprovados, 3 ignorados; 823 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou. Sem acesso ou escrita em producao.
#### BOOK-006 ? Erros de leitura são convertidos em sucesso com `bookings: []`; cliente pode interpretar como ausência de reserva.

- **M?dulo:** Agendamentos/Consulta pública
- **Gravidade:** P2 potencial
- **Estado:** Corrigido localmente em 2026-11-14; erros de consulta nao retornam historico vazio.
- **Evid?ncias:** - ** `getMyBookings` desestrutura apenas `data` de `deposit_payments`, `appointments`, `services` e `professionals`, sem verificar `error` (`src/lib/booking.functions.ts:1177-1258`). Se as consultas retornarem erro e data nula, os arrays viram vazios e a função retorna sucesso `{ bookings: [] }`.
- **Arquivos afetados/referenciados:** `src/lib/booking.functions.ts:1177-1258`
- **Causa:** - ** resultado PostgREST é tratado somente pela propriedade `data`.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** erro ao consultar pagamentos, appointments, serviços ou profissionais deve ser diferenciado de “nenhuma reserva encontrada”, com mensagem recuperável para o cliente.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** erro ao consultar pagamentos, appointments, serviços ou profissionais deve ser diferenciado de “nenhuma reserva encontrada”, com mensagem recuperável para o cliente.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [agendamentos.md](agendamentos.md); detalhe(s): [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md).
- **Registro original integral:**

<details><summary>agendamentos.md</summary>

### BOOK-006 — consulta pública de reservas transforma erro de leitura em lista vazia

- **Gravidade:** P2 potencial; falha silenciosa no código confirmada, ocorrência e reação dos clientes desconhecidas.
- **Módulo:** jornada pública / consulta de reserva e sinal.
- **Esperado:** erro ao consultar pagamentos, appointments, serviços ou profissionais deve ser diferenciado de “nenhuma reserva encontrada”, com mensagem recuperável para o cliente.
- **Observado:** `getMyBookings` desestrutura apenas `data` de `deposit_payments`, `appointments`, `services` e `professionals`, sem verificar `error` (`src/lib/booking.functions.ts:1177-1258`). Se as consultas retornarem erro e data nula, os arrays viram vazios e a função retorna sucesso `{ bookings: [] }`.
- **Impacto:** cliente que tenta conferir um sinal/reserva durante indisponibilidade pode acreditar que nada existe e tentar reservar/pagar novamente; não há evidência de duplicidade real causada por esse caminho.
- **Reprodução segura:** mockar erro em cada consulta e confirmar se o handler devolve lista vazia sem erro; nenhum provedor ou dado real necessário.
- **Causa-raiz:** resultado PostgREST é tratado somente pela propriedade `data`.
- **Correção recomendada para spec:** propagar falha de leitura distinguível para UI e mostrar estado de erro/retry; não classificar falha como ausência de reserva.
- **Regressão:** erro em cada fonte não retorna `bookings: []` como resposta de sucesso; ausência real continua retornando array vazio.

</details>


**Execucao 2026-11-14:** teste red/green reproduziu sucesso `{bookings: []}` com erro na consulta da cobranca solicitada. `getMyBookings` agora propaga erros das consultas de cobrancas, appointments, services e professionals com falha explicita; `findAppointmentsByPublicCodes` ja tinha tratamento proprio. Teste focal booking: 100/100; `npm test`: 82 arquivos aprovados, 3 ignorados; 834 testes aprovados, 8 ignorados; tsc passou.

#### BOOK-007 ? Erro ou lista vazia de vínculos não valida `professionalId`; chamada direta pode associar reserva a profissional de outro negócio.

- **M?dulo:** Agendamentos/Profissional
- **Gravidade:** P2 potencial
- **Estado:** Corrigido localmente em 2026-11-14; leituras falhas e ID sem vinculo sao rejeitados.
- **Evid?ncias:** - ** `validateProfessional` lê `service_professionals` sem desestruturar `error` e retorna `null` sempre que `data` está nula/vazia (`src/lib/booking.functions.ts:621-640`). Isso acontece tanto em erro quanto em resposta válida sem vínculos. Mesmo se `professionalId` tiver sido fornecido, a função retorna sem validá-lo; `reserveBooking` então usa esse ID para disponibilidade e grava no appointment (`:810-839,866-884`). O schema de `appointments` tem FKs separadas em `business_id` e `professional_id` e não uma FK composta que exija que o profissional pertença ao mesmo business (`supabase/migrations/20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:103-109`). A consulta posterior de profissionais também ignora erro, mas só ocorre se `links` indicar vínculos.
- **Arquivos afetados/referenciados:** `src/lib/booking.functions.ts:621-640`, `supabase/migrations/20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:103-109`
- **Causa:** - ** apenas `data` é usada para distinguir serviço sem vínculos de consulta malsucedida.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** falha ao consultar vínculo ou cadastro de profissional deve interromper a reserva; somente serviço realmente sem vínculos pode aceitar profissional opcional.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** falha ao consultar vínculo ou cadastro de profissional deve interromper a reserva; somente serviço realmente sem vínculos pode aceitar profissional opcional.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [agendamentos.md](agendamentos.md); detalhe(s): [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md).
- **Registro original integral:**

<details><summary>agendamentos.md</summary>

### BOOK-007 — validação de profissional não rejeita ID sem vínculo

- **Gravidade:** P2 potencial; erro ignorado confirmado por leitura, incidente não reproduzido.
- **Módulo:** agendamentos públicos / profissional-serviço.
- **Esperado:** falha ao consultar vínculo ou cadastro de profissional deve interromper a reserva; somente serviço realmente sem vínculos pode aceitar profissional opcional.
- **Observado:** `validateProfessional` lê `service_professionals` sem desestruturar `error` e retorna `null` sempre que `data` está nula/vazia (`src/lib/booking.functions.ts:621-640`). Isso acontece tanto em erro quanto em resposta válida sem vínculos. Mesmo se `professionalId` tiver sido fornecido, a função retorna sem validá-lo; `reserveBooking` então usa esse ID para disponibilidade e grava no appointment (`:810-839,866-884`). O schema de `appointments` tem FKs separadas em `business_id` e `professional_id` e não uma FK composta que exija que o profissional pertença ao mesmo business (`supabase/migrations/20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:103-109`). A consulta posterior de profissionais também ignora erro, mas só ocorre se `links` indicar vínculos.
- **Impacto:** indisponibilidade transitória pode aceitar reserva sem profissional obrigatório. Além disso, serviço sem vínculo explícito aceita ID de profissional sem confirmar que pertence ao negócio, está ativo ou pode atender o serviço; IDs são visíveis na página pública de outros negócios. A linha de appointment pode ficar associada a profissional de outro estabelecimento. Não há evidência de ocorrência real.
- **Reprodução segura:** harness fake devolve erro na consulta `service_professionals` com dados nulos e chama `reserveBooking`; verificar se a execução prossegue. Sem DB ou provedor real.
- **Causa-raiz:** apenas `data` é usada para distinguir serviço sem vínculos de consulta malsucedida.
- **Correção recomendada para spec:** tratar erro de leitura como falha, preservar comportamento opcional somente para resposta válida sem vínculos.
- **Regressão:** erro em service_professionals/professionals nunca reserva; serviço sem vínculo só aceita `professionalId=null`; ID fornecido sempre pertence ao negócio, está ativo e é elegível para o serviço; vínculo existente continua validado.

</details>


**Execucao 2026-11-14:** regressao reproduziu reserva com professionalId mesmo com consulta de vinculos falha ou vazia, e erro de consulta do cadastro era tratado como profissional indisponivel. Agora erro de leitura interrompe, ID fornecido exige vinculo do servico e cadastro ativo do mesmo negocio; servico sem vinculo continua aceitando professionalId omitido. Teste focal booking: 99/99; `npm test`: 82 arquivos aprovados, 3 ignorados; 833 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou.

#### BOOK-005 ? Falha ao inserir cobrança retorna erro, mas mantém appointment `aguardando_sinal` sem cobrança vinculada.

- **M?dulo:** Agendamentos/Sinais
- **Gravidade:** P2
- **Estado:** Corrigido localmente em 2026-11-14; falha no INSERT da cobrança agora tenta cancelar a reserva com compare-and-set e informa estado parcial se a compensação falhar.
- **Revalidação atual:** causa original confirmada no histórico da sessão. O código atual cancela somente `aguardando_sinal` pelo ID e propaga erro de compensação. Testes específicos existentes cobrem falha no INSERT, compensação bem-sucedida e falha da compensação; `npm test -- src/lib/booking.functions.test.ts` passou, 117/117. O teste usa fake DB e não chama o provedor.
- **Evid?ncias:** - ** `bookAppointment` cria primeiro o appointment em `status="aguardando_sinal"` (`src/lib/booking.functions.ts:866-884`), depois insere `deposit_payments`; em `chargeError || !charge` apenas lança erro e não altera o appointment (`:905-917`). O job `expirePendingDeposits` recebe registros de `deposit_payments` e não encontra a reserva sem cobrança (`src/routes/api/public/hooks/agpay-events.ts:13-20`, `src/lib/agpay-events.server.ts`); não foi localizada rotina de reconciliação de `aguardando_sinal` sem `deposit_payments`.
- **Arquivos afetados/referenciados:** `src/lib/booking.functions.ts:866-884`, `src/routes/api/public/hooks/agpay-events.ts:13-20`, `src/lib/agpay-events.server.ts`, `booking.functions.ts:856`
- **Causa:** - ** duas inserções separadas sem transação/RPC ou compensação explícita após a segunda falhar.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** se a criação da cobrança falhar depois da reserva, o sistema deve compensar a reserva (cancelar/remover com segurança) ou persistir um estado recuperável claramente identificado.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Validar comportamento esperado: ** se a criação da cobrança falhar depois da reserva, o sistema deve compensar a reserva (cancelar/remover com segurança) ou persistir um estado recuperável claramente identificado.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [agendamentos.md](agendamentos.md); detalhe(s): [`agendamentos.md`](../docs/auditoria-agenda-agora/agendamentos.md).
- **Registro original integral:**

<details><summary>agendamentos.md</summary>

### BOOK-005 — falha ao criar cobrança de sinal deixa appointment órfão

- **Gravidade:** P2; caminho de persistência parcial confirmado por leitura, ocorrência não medida.
- **Esperado:** se a criação da cobrança falhar depois da reserva, o sistema deve compensar a reserva (cancelar/remover com segurança) ou persistir um estado recuperável claramente identificado.
- **Observado:** `bookAppointment` cria primeiro o appointment em `status="aguardando_sinal"` (`src/lib/booking.functions.ts:866-884`), depois insere `deposit_payments`; em `chargeError || !charge` apenas lança erro e não altera o appointment (`:905-917`). O job `expirePendingDeposits` recebe registros de `deposit_payments` e não encontra a reserva sem cobrança (`src/routes/api/public/hooks/agpay-events.ts:13-20`, `src/lib/agpay-events.server.ts`); não foi localizada rotina de reconciliação de `aguardando_sinal` sem `deposit_payments`.
- **Impacto:** cliente recebe erro apesar de existir registro de reserva sem cobrança associada; ficam dados órfãos sem expiração/reconciliação automática identificada. O estado `aguardando_sinal` é ignorado para conflitos de agenda (`booking.functions.ts:856`), portanto não há evidência de bloqueio permanente da vaga por este caso.
- **Reprodução segura:** fake DB em que insert de appointment retorna sucesso e insert de `deposit_payments` retorna erro; observar estado persistido fake sem compensação. Não usar banco de produção.
- **Causa-raiz:** duas inserções separadas sem transação/RPC ou compensação explícita após a segunda falhar.
- **Correção recomendada para spec:** tornar criação de appointment+cobrança atômica no banco, ou compensar a reserva e registrar o motivo de forma idempotente.
- **Regressão:** falha do insert da cobrança deixa estado final consistente; retry não duplica appointment/cobrança; expiração e reprocessamento tratam estados incompletos.

</details>


#### PRO-001 ? Erro/race da contagem ou INSERT direto sob policy owner podem ultrapassar teto; migrations remotas e regra comercial atual não verificadas.

- **M?dulo:** Backend/Equipe
- **Gravidade:** P2 potencial
- **Estado:** Corrected locally: database trigger serializes by business and enforces the limit on direct/concurrent writes; remote rollout is unverified.
- **Evid?ncias:** - ** ao criar profissional, `saveProfessional` consulta `count` do Supabase sem capturar/verificar `error`; `(count ?? 0) >= 10` (`src/lib/professionals.functions.ts:52-63`) permite seguir quando a consulta falha e `count` vem nulo. Além disso, a migration inicial dá INSERT a authenticated e policy `professionals_owner FOR ALL` permite DML do owner (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:54-66`); não encontrei constraint/trigger de teto nem revogação posterior de INSERT. Portanto, chamada direta ao Supabase não passa pela checagem de `saveProfessional`.
- **Arquivos afetados/referenciados:** `src/lib/professionals.functions.ts:52-63`, `20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:54-66`
- **Causa:** - ** resultado de erro do PostgREST não é verificado e limite está em check-then-insert na aplicação.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** a regra de no máximo 10 profissionais deve falhar fechada se não for possível ler a contagem.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** a regra de no máximo 10 profissionais deve falhar fechada se não for possível ler a contagem.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [backend.md](backend.md); detalhe(s): [`backend.md`](../docs/auditoria-agenda-agora/backend.md).
- **Registro original integral:**

<details><summary>backend.md</summary>

### PRO-001 — falha na contagem permite ultrapassar limite de profissionais

- **Gravidade:** P2 potencial.
- **Módulo:** backend / cadastro de profissionais.
- **Esperado:** a regra de no máximo 10 profissionais deve falhar fechada se não for possível ler a contagem.
- **Observado:** ao criar profissional, `saveProfessional` consulta `count` do Supabase sem capturar/verificar `error`; `(count ?? 0) >= 10` (`src/lib/professionals.functions.ts:52-63`) permite seguir quando a consulta falha e `count` vem nulo. Além disso, a migration inicial dá INSERT a authenticated e policy `professionals_owner FOR ALL` permite DML do owner (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:54-66`); não encontrei constraint/trigger de teto nem revogação posterior de INSERT. Portanto, chamada direta ao Supabase não passa pela checagem de `saveProfessional`.
- **Impacto:** owner pode ultrapassar o teto por falha transitória, corrida concorrente ou INSERT direto; impacto comercial depende de a regra de 10 profissionais continuar vigente no produto.
- **Reprodução segura:** mock da contagem retornando `{count:null,error:...}` ou banco descartável com 10 profissionais e tentativa de INSERT direto como owner; confirmar se ambos os caminhos continuam. Não usar negócio real.
- **Causa-raiz:** resultado de erro do PostgREST não é verificado e limite está em check-then-insert na aplicação.
- **Correção recomendada para spec:** impor limite atomicamente no banco/RPC ou bloquear criação quando contagem for inconclusiva.
- **Regressão:** erro de contagem não cria profissional; concorrência de criações nunca supera teto; atualização de existente continua permitida.

</details>


#### PRO-002 ? Criação/remoção de profissional cruza Auth, role, linha e vínculos sem compensação; erro de deleteUser é ignorado.

- **M?dulo:** Backend/Equipe/Auth
- **Gravidade:** P2
- **Estado:** Mitigated locally with compensating cleanup and explicit failure when cleanup is incomplete; cross-system Auth/Postgres atomicity remains impossible.
- **Evid?ncias:** - ** `saveProfessional` cria usuário Auth e role antes de inserir `professionals`; erro da gravação lança exceção sem remover usuário/role (`src/lib/professionals.functions.ts:91-149`). Após salvar profissional, erro no RPC de serviços também retorna falha deixando profissional e Auth criados (`:161-176`). Exclusão do profissional remove Auth depois de apagar a linha, mas ignora o erro retornado pelo `deleteUser` (`:191-216`).
- **Arquivos afetados/referenciados:** `src/lib/professionals.functions.ts:91-149`
- **Causa:** - ** provisionamento Auth/role, linha principal, vínculos e deleção não são atômicos e há erros retornados ignorados.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** se criação da linha profissional ou vínculos falhar após criar Auth/role, a operação deve compensar ou persistir estado recuperável.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** se criação da linha profissional ou vínculos falhar após criar Auth/role, a operação deve compensar ou persistir estado recuperável.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [backend.md](backend.md); detalhe(s): [`backend.md`](../docs/auditoria-agenda-agora/backend.md).
- **Registro original integral:**

<details><summary>backend.md</summary>

### PRO-002 — falha ao salvar profissional pode deixar usuário Auth órfão

- **Gravidade:** P2; estado parcial possível confirmado no fluxo, incidência desconhecida.
- **Módulo:** backend / identidade e cadastro de equipe.
- **Esperado:** se criação da linha profissional ou vínculos falhar após criar Auth/role, a operação deve compensar ou persistir estado recuperável.
- **Observado:** `saveProfessional` cria usuário Auth e role antes de inserir `professionals`; erro da gravação lança exceção sem remover usuário/role (`src/lib/professionals.functions.ts:91-149`). Após salvar profissional, erro no RPC de serviços também retorna falha deixando profissional e Auth criados (`:161-176`). Exclusão do profissional remove Auth depois de apagar a linha, mas ignora o erro retornado pelo `deleteUser` (`:191-216`).
- **Impacto:** login profissional pode ficar sem vínculo, tela pode indicar falha apesar de registro persistido ou Auth não removido; retry pode ser bloqueado por email existente ou criar estado diferente do pretendido.
- **Reprodução segura:** harness fake com erro em cada etapa posterior à criação, verificando efeitos e compensação; sem Auth/DB real.
- **Causa-raiz:** provisionamento Auth/role, linha principal, vínculos e deleção não são atômicos e há erros retornados ignorados.
- **Correção recomendada para spec:** definir saga de provisionamento/deleção idempotente com estado recuperável, compensação explícita e reconciliação.
- **Regressão:** simular falhas de insert, RPC e delete; estado final é consistente e retry não duplica identidade.

</details>


#### ADM-002 ? Auth é criado antes do negócio; erro posterior não compensa e erro de upsert da role é ignorado.

- **M?dulo:** Backend/Onboarding Master
- **Gravidade:** P2
- **Estado:** Mitigated locally: role/business write failures trigger cleanup and incomplete compensation is reported; Auth/Postgres are not one transaction.
- **Evid?ncias:** - ** `createBusinessWithOwner` cria usuário Auth, depois faz `user_roles.upsert` sem conferir `{ error }`, e por fim insere `businesses`; se este insert falhar, apenas lança erro, sem remover o Auth criado nem desfazer a role (`src/lib/admin.functions.ts:92-146`). Se o upsert da role falhar, o fluxo também continua como sucesso potencial. Não há teste específico do handler de criação Master encontrado na busca por seus símbolos em `src/lib/*.test.ts`.
- **Arquivos afetados/referenciados:** `src/lib/admin.functions.ts:92-146`, `.test.ts`
- **Causa:** - ** operações separadas entre Auth e Postgres sem transação/compensação e resultado de upsert não verificado.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** criação de Auth, role e negócio deve ser atômica ou compensar falhas; erro de role não deve ser ignorado.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** criação de Auth, role e negócio deve ser atômica ou compensar falhas; erro de role não deve ser ignorado.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [backend.md](backend.md); detalhe(s): [`backend.md`](../docs/auditoria-agenda-agora/backend.md).
- **Registro original integral:**

<details><summary>backend.md</summary>

### ADM-002 — criação Master de estabelecimento pode deixar conta Auth órfã

- **Gravidade:** P2; cenário de falha parcial confirmado no código, incidência real desconhecida.
- **Módulo:** backend, onboarding de estabelecimento e identidade.
- **Esperado:** criação de Auth, role e negócio deve ser atômica ou compensar falhas; erro de role não deve ser ignorado.
- **Observado:** `createBusinessWithOwner` cria usuário Auth, depois faz `user_roles.upsert` sem conferir `{ error }`, e por fim insere `businesses`; se este insert falhar, apenas lança erro, sem remover o Auth criado nem desfazer a role (`src/lib/admin.functions.ts:92-146`). Se o upsert da role falhar, o fluxo também continua como sucesso potencial. Não há teste específico do handler de criação Master encontrado na busca por seus símbolos em `src/lib/*.test.ts`.
- **Impacto:** tentativa que falha após a criação Auth pode reservar o telefone/login e impedir nova tentativa, apesar de não haver negócio correspondente; falha isolada da role pode criar estabelecimento com estado de autorização inconsistente.
- **Reprodução segura:** harness fake do client admin: `createUser` retorna ID, `user_roles.upsert` ou insert de `businesses` retorna erro; verificar se handler retorna erro/sucesso e se há compensação ou exclusão Auth. Sem banco ou Auth real.
- **Causa-raiz:** operações separadas entre Auth e Postgres sem transação/compensação e resultado de upsert não verificado.
- **Correção recomendada para spec:** desenhar fluxo idempotente de provisionamento com estado pendente e compensação/reconciliação; verificar erros de todas as etapas e não expor sucesso parcial.
- **Regressão:** cobrir erro de criação Auth, erro de role, erro de negócio e falha de compensação; retries não deixam telefone/role/negócio órfãos nem duplicam cadastro.

</details>


#### ADM-003 ? Auth é criado, erro de role é ignorado e erro ao inserir negócio não compensa a identidade criada.

- **M?dulo:** Backend/Onboarding SDR
- **Gravidade:** P2
- **Estado:** Mitigated locally: SDR onboarding compensates role/business failures and fails closed when cleanup is incomplete; Auth/Postgres are not one transaction.
- **Evid?ncias:** - ** `sdrCreateBusiness` cria usuário Auth (`src/lib/sdr.functions.ts:649-657`), tenta `user_roles.upsert` sem verificar o erro (`:659-661`) e depois insere `businesses` (`:671-687`). Se o upsert da role falhar, o fluxo segue; se o insert do negócio falhar, a função lança o erro sem remover o Auth/role. A senha inicial também é devolvida no resultado (`:688-693`), conforme o fluxo de onboarding do SDR.
- **Arquivos afetados/referenciados:** `src/lib/sdr.functions.ts:649-657`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** falha em qualquer etapa do cadastro deve deixar o SDR com resultado consistente e permitir recuperação ou nova tentativa sem identidade órfã.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** falha em qualquer etapa do cadastro deve deixar o SDR com resultado consistente e permitir recuperação ou nova tentativa sem identidade órfã.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [backend.md](backend.md); detalhe(s): [`backend.md`](../docs/auditoria-agenda-agora/backend.md).
- **Registro original integral:**

<details><summary>backend.md</summary>

### ADM-003 — cadastro de estabelecimento pelo SDR permite provisionamento parcial

- **Estado:** falha parcial confirmada no fluxo estático; incidência e estado remoto desconhecidos.
- **Gravidade:** P2.
- **Módulo:** backend / onboarding / identidade.
- **Esperado:** falha em qualquer etapa do cadastro deve deixar o SDR com resultado consistente e permitir recuperação ou nova tentativa sem identidade órfã.
- **Observado:** `sdrCreateBusiness` cria usuário Auth (`src/lib/sdr.functions.ts:649-657`), tenta `user_roles.upsert` sem verificar o erro (`:659-661`) e depois insere `businesses` (`:671-687`). Se o upsert da role falhar, o fluxo segue; se o insert do negócio falhar, a função lança o erro sem remover o Auth/role. A senha inicial também é devolvida no resultado (`:688-693`), conforme o fluxo de onboarding do SDR.
- **Impacto:** pode haver login reservado sem estabelecimento correspondente ou negócio provisionado sem a role esperada; a nova tentativa pode falhar por telefone já cadastrado. Não foi identificada tentativa real nem incidência no ambiente servido.
- **Reprodução segura:** harness com fake admin que injete erro em `user_roles.upsert` ou `businesses.insert`; verificar retorno e ausência de compensação sem chamar Auth ou banco reais.
- **Causa-raiz confirmada no código:** etapas não transacionais entre Auth e banco, sem compensação, e erro de upsert ignorado.
- **Correção recomendada para spec:** provisionamento idempotente e recuperável, com verificação de cada resultado e compensação/reconciliação quando a etapa seguinte falhar.
- **Regressão:** injetar falha em role e negócio, confirmar que nenhuma etapa retorna sucesso parcial e que retry com o mesmo telefone não fica bloqueado por estado órfão.
- **Limitação:** o handler SDR não foi reproduzido com fake Auth nesta rodada; o ensaio Postgres local valida migrations, mas não simula Supabase Auth. Migrations remotas e incidência real não foram verificadas.

</details>


#### API-004 ? Profissional autorizado por `block_schedule`/`block_agenda` alcança a tela, mas criação de bloqueio exige `owner_id`.

- **M?dulo:** Backend/Permissões de agenda
- **Gravidade:** P2 potencial
- **Estado:** Corrigido localmente em 2026-11-14; owner e profissionais autorizados passam pela mesma verifica??o server-side de permiss?o.
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** `src/routes/_authenticated/painel.tsx:345-348`, `supabase/migrations/20261011000200_block_agenda_permission.sql:1-14`, `src/lib/time-blocks.functions.ts:24-30`, `src/routes/_authenticated/painel.bloqueios.tsx:109-123`
- **Causa:** A Server Function usava filtro `owner_id` em vez de validar membership/permiss?o granular como rota e RLS.
- **Corre??o necess?ria:** Exigir `has_business_permission` para `block_schedule` ou legado `block_agenda`, preservando isolamento por neg?cio e falha fechada.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** Owner autorizado e profissional com qualquer uma das permiss?es podem criar; sem permiss?o, sem associa??o ou com erro na valida??o, n?o h? INSERT.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [ ] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [x] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [x] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [backend.md](backend.md); detalhe(s): [`backend.md`](../docs/auditoria-agenda-agora/backend.md).
- **Registro original integral:**

<details><summary>backend.md</summary>

### API-004 — Server Function de bloqueios exige proprietário apesar da permissão de equipe

- **Estado:** Corrigido localmente em 2026-11-14; owner e profissionais autorizados passam pela mesma verifica??o server-side de permiss?o.
- **Gravidade:** P2 potencial.
- A rota `/painel/bloqueios` é liberada no painel para `block_schedule` ou `block_agenda` (`src/routes/_authenticated/painel.tsx:345-348`), e as policies locais de `time_blocks` também permitem essas permissões (`supabase/migrations/20261011000200_block_agenda_permission.sql:1-14`). Porém `createTimeBlock` consulta `businesses` por `owner_id = context.userId` e rejeita quem não é dono (`src/lib/time-blocks.functions.ts:24-30`). A ação de criação da tela chama essa função (`src/routes/_authenticated/painel.bloqueios.tsx:109-123`).
- **Comportamento esperado/observado:** usuário profissional autorizado abre a tela, mas a criação falha na validação do negócio; não foi executado login nem escrita para reproduzir.
- **Causa confirmada:** a Server Function aplica regra de ownership mais restritiva que a permissão de equipe da rota e do RLS local.
- **Impacto:** profissionais autorizados não conseguem cumprir a tarefa de criar bloqueios pela interface; a lista de permissões da equipe fica incoerente com a operação disponível.
- **Reprodução segura:** com usuário de teste isolado ligado ao negócio e `block_schedule` ou `block_agenda`, abrir `/painel/bloqueios` e tentar criar bloqueio fictício; não usar produção.
- **Corre??o necess?ria:** Exigir `has_business_permission` para `block_schedule` ou legado `block_agenda`, preservando isolamento por neg?cio e falha fechada.
- **Regressão necessária:** owner sem permissão explícita, profissional com cada permissão, profissional sem permissão, usuário de outro negócio e erros de consulta devem ter resultados definidos.

</details>



**Execu??o 2026-11-14:** `createTimeBlock` agora valida acesso ao neg?cio via RLS e checa `block_schedule`, com fallback para `block_agenda`; erro/aus?ncia de permiss?o interrompe antes do INSERT. Testes em harness isolado cobrem ambas permiss?es e nega??o: 3/3. `git diff --check` sem erros. Nenhum dado real usado; TypeScript/su?te completa n?o repetidos durante baixa mem?ria. Contagem: 42 corrigidos localmente, 7 bloqueados/n?o verificados e 102 pendentes de 151.
#### UI-001 ? Formulário de cartão não chama backend; CTA diz “em breve”.

- **M?dulo:** Frontend/Checkout
- **Gravidade:** P2
- **Estado:** Corrected locally: card fields/CTA removed until hosted checkout exists; Pix remains available.
- **Evid?ncias:** - ** `painel.tsx:1562-1614` renderiza campos de cartão; botão `Pagar com cartão` mostra aviso “Checkout com cartão em breve. Fale com o suporte para assinar” (`:1663-1677`) e não chama backend. A documentação pública AgPay consultada descreve checkout hospedado VeoPag; UI atual é não funcional para cartão.
- **Arquivos afetados/referenciados:** `painel.tsx:1562-1614`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** não solicitar dados que o produto não processa; quando suportado, usar o checkout seguro hospedado do gateway.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** não solicitar dados que o produto não processa; quando suportado, usar o checkout seguro hospedado do gateway.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [frontend.md](frontend.md); detalhe(s): [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md).
- **Registro original integral:**

<details><summary>frontend.md</summary>

### UI-001 — Campos de cartão aparecem no checkout, mas a ação informa que checkout está indisponível

- **Status:** comportamento confirmado no código; reclamação de usuário não recebida.
- **Gravidade:** P2 (jornada incompleta e coleta enganosa de dados na tela).
- **Módulo:** assinatura / método de pagamento.
- **Esperado:** não solicitar dados que o produto não processa; quando suportado, usar o checkout seguro hospedado do gateway.
- **Observado:** `painel.tsx:1562-1614` renderiza campos de cartão; botão `Pagar com cartão` mostra aviso “Checkout com cartão em breve. Fale com o suporte para assinar” (`:1663-1677`) e não chama backend. A documentação pública AgPay consultada descreve checkout hospedado VeoPag; UI atual é não funcional para cartão.
- **Impacto:** dono pode preencher dados de cartão numa jornada sem cobrança; sistema não conclui a assinatura. Código sugere estado “em breve”, mas a presença dos campos pode gerar expectativa e coleta desnecessária na memória do navegador. Não há evidência de envio/armazenamento desses dados.
- **Correção recomendada para spec:** ocultar/desativar campos até existir fluxo; especificar redirecionamento hospedado e escopo de assinatura/cartão.
- **Regressão necessária:** nenhum PAN/CVV deve ir ao backend/local storage; mensagem clara; Pix continua independente.

</details>



**Revalida??o e corre??o local (2026-11-14):** causa confirmada no checkout da assinatura: os campos PAN/validade/CVV/nome/CPF mantinham dados em estado React e o CTA apenas apresentava o aviso de indisponibilidade. Removidos a op??o, os campos e a a??o de cart?o at? existir checkout hospedado integrado; PIX e cupom seguem no fluxo. O componente `SubscriptionPaymentMethodSelector` apresenta somente PIX. Teste do componente: RED antes da implementa??o (m?dulo ausente), GREEN depois; regress?o conjunta do seletor e do Pix: 2/2. `npx tsc --noEmit` e `git diff --check` passaram. Nenhuma cobran?a foi criada. Estado: corrigido localmente; sem deploy, migration, push ou commit. Total: 69 corrigidos, 7 bloqueados/n?o verificados, 75 pendentes de 151.

#### UI-002 ? Tipo/status não entram na lista derivada; “Aplicar filtros” só reinicia a página.

- **M?dulo:** Frontend/Master transações
- **Gravidade:** P2
- **Estado:** Corrected locally: applied filters now derive type/status results and reset pagination; Clear restores all rows.
- **Evid?ncias:** - ** `src/routes/_authenticated/painel.transacoes.tsx:52-54` mantém `type`, `depositStatus` e `withdrawalStatus`. As opções alteram estado nos selects (`:267-291`), mas `filteredDeposits` e `filteredWithdrawals` só aplicam o texto de busca (`:66-90`); a lista atual é derivada desses dois arrays. “Aplicar filtros” apenas executa `setPage(1)` (`:260-269`). O filtro de busca por texto é aplicado imediatamente.
- **Arquivos afetados/referenciados:** `src/routes/_authenticated/painel.transacoes.tsx:52-54`
- **Causa:** - ** estados dos controles não participam da derivação de `currentList` nem da query.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** controles de tipo e status e o botão “Aplicar filtros” devem restringir a lista visível e resetar a paginação; “Limpar” restaura a lista completa.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** controles de tipo e status e o botão “Aplicar filtros” devem restringir a lista visível e resetar a paginação; “Limpar” restaura a lista completa.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [frontend.md](frontend.md); detalhe(s): [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md).
- **Registro original integral:**

<details><summary>frontend.md</summary>

### UI-002 — filtros de tipo e status da tela de transações não afetam os resultados

- **Status:** comportamento confirmado por inspeção estática; QA browser pendente.
- **Gravidade:** P2.
- **Módulo:** frontend Master / transações.
- **Esperado:** controles de tipo e status e o botão “Aplicar filtros” devem restringir a lista visível e resetar a paginação; “Limpar” restaura a lista completa.
- **Observado:** `src/routes/_authenticated/painel.transacoes.tsx:52-54` mantém `type`, `depositStatus` e `withdrawalStatus`. As opções alteram estado nos selects (`:267-291`), mas `filteredDeposits` e `filteredWithdrawals` só aplicam o texto de busca (`:66-90`); a lista atual é derivada desses dois arrays. “Aplicar filtros” apenas executa `setPage(1)` (`:260-269`). O filtro de busca por texto é aplicado imediatamente.
- **Impacto:** usuário seleciona status/tipo, aplica e ainda vê a lista anterior, podendo acreditar que uma visão filtrada foi aplicada; navegação de página pode reiniciar sem efeito de filtro.
- **Reprodução segura:** fixture local em componente: montar depósitos/saques com estados distintos, selecionar “Falhou” ou “Concluído”, clicar Aplicar e observar a lista inalterada. Sem acesso a dados de produção.
- **Causa-raiz:** estados dos controles não participam da derivação de `currentList` nem da query.
- **Correção recomendada para spec:** definir se tipo/status são filtros locais ou server-side e conectá-los à lista, com rótulos/abas coerentes.
- **Regressão:** combinações de busca, tipo, status, abas e paginação produzem conjunto esperado; limpar restaura todos os registros.

</details>


**Current local verification (2026-11-14):** The reported missing behavior is already corrected in the current tree. `painel.transacoes.tsx` keeps draft select state separate, applies type/deposit-status/withdrawal-status only on Apply, resets pagination on Apply/Clear, and derives both lists through `filterTransactionRows`; search is applied to those rows. The utility handles PIX versus SAQUE and normalized status matching. Focused tests `src/lib/transactions-filter.test.ts`: 2/2, covering type, deposit status, pending withdrawals, search, and clearing. No production data or browser session used. State: fixed locally; no remote operation. Total: 70 fixed, 7 blocked/unverified, 74 pending of 151.

#### UI-029 — Cupom usado pelo servidor na próxima cobrança; UI tratava falha de leitura como desativado.

- **M?dulo:** Frontend/Master/Cupom de assinatura
- **Gravidade:** P2 potencial
- **Estado:** Corrigido localmente; nenhuma configuração de cupom foi gravada
- **Evid?ncias:** - ** `CouponCard` consulta `getBusinessCoupon` (`src/components/master/BusinessDossier.tsx:1837-1843`), mas não consome `coupon.isLoading` nem `coupon.isError`. `active` vira `null` quando `data` está ausente e o texto passa a dizer “Sempre desativado por padrão”; Switch/form ficam disponíveis e o botão depende somente de `saveDisabled || set.isPending` (`:1848-1850,1900-1948`). O handler Master substitui `coupon_code`, `coupon_percent` e `coupon_expires_at` (`src/lib/subscription.functions.ts:109-122`). A criação seguinte usa `coupon_percent` e `coupon_expires_at` para calcular `amountCents` (`src/lib/subscription-charge.functions.ts:174-180`).
- **Arquivos afetados/referenciados:** `src/components/master/BusinessDossier.tsx:1837-1843`, `src/lib/subscription.functions.ts:109-122`, `src/lib/subscription-charge.functions.ts:174-180`
- **Causa:** query sem tratamento visível de loading/erro e ausência de precondição na edição.
- **Correção aplicada:** switch e formulário ficam bloqueados até `getBusinessCoupon` devolver resultado válido; erro mostra aviso e retry, sem apresentar “desativado por padrão”.
- **Dependências:** QA visual permanece pendente; nenhum cupom foi salvo e nenhuma cobrança foi criada.
- **Crit?rios de aceite:** - ** mostrar loading/erro da configuração e impedir nova gravação até conhecer o cupom vigente, ou exigir confirmação explícita de substituição.
- **Validação local:** gate testado para loading, erro, falta de dados e leitura válida; 4/4 passaram. `npm test`: 89 arquivos aprovados, 3 ignorados; 865 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou.
- **Limite:** reprodução visual ainda pendente; nenhuma configuração/cobrança foi alterada.
- **Refer?ncias originais:** [frontend.md](frontend.md); detalhe(s): [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md).
- **Registro original integral:**

<details><summary>frontend.md</summary>

### UI-029 — falha ao carregar cupom deixa a edição Master disponível

- **Estado:** comportamento de query e gate de edição confirmados estaticamente; erro não foi injetado nem configuração salva.
- **Gravidade:** P2 potencial, pois cupom altera o valor da cobrança da assinatura.
- **Módulo:** frontend Master / dossiê / cobrança de assinatura.
- **Esperado:** mostrar loading/erro da configuração e impedir nova gravação até conhecer o cupom vigente, ou exigir confirmação explícita de substituição.
- **Observado:** `CouponCard` consulta `getBusinessCoupon` (`src/components/master/BusinessDossier.tsx:1837-1843`), mas não consome `coupon.isLoading` nem `coupon.isError`. `active` vira `null` quando `data` está ausente e o texto passa a dizer “Sempre desativado por padrão”; Switch/form ficam disponíveis e o botão depende somente de `saveDisabled || set.isPending` (`:1848-1850,1900-1948`). O handler Master substitui `coupon_code`, `coupon_percent` e `coupon_expires_at` (`src/lib/subscription.functions.ts:109-122`). A criação seguinte usa `coupon_percent` e `coupon_expires_at` para calcular `amountCents` (`src/lib/subscription-charge.functions.ts:174-180`).
- **Impacto:** se a leitura falhar com cupom ativo, operador pode acreditar que não há cupom e gravar outro; isso substitui a taxa anterior e altera o preço efetivamente cobrado em nova assinatura. Não há evidência de falha real ou sobrescrita em produção.
- **Reprodução segura:** mockar erro de `getBusinessCoupon`, conferir texto “Sempre desativado por padrão” e botão habilitado após preencher campos; não clicar em salvar nem chamar gateway.
- **Causa-raiz confirmada:** query sem tratamento visível de loading/erro e ausência de precondição na mutation de set.
- **Correção recomendada para spec:** distinguir erro de cupom desativado; bloquear edição até leitura válida, apresentar cupom vigente e confirmação ao substituir.
- **Regressão:** erro bloqueia save e exibe retry; cupom ativo não é apresentado como inexistente; novo valor só é aplicado após confirmação e permanece validado no backend.
- **Limitação:** nenhuma configuração ou cobrança foi criada; efeito real é inferido pelo uso do cupom no cálculo server-side.

</details>


#### UI-013 — Falhas de consulta de recebíveis apareciam como valores zerados; ambiente remoto não consultado.

- **M?dulo:** Frontend/Master/Recebíveis
- **Gravidade:** P2 potencial
- **Estado:** Corrigido localmente; dados do ambiente remoto não consultados
- **Evid?ncias:** - ** `calendarQuery` carrega `getReceivablesCalendar`, mas a tela nunca consulta `isLoading` ou `isError`; cálculos usam `calendarQuery.data?.… ?? []` ou `?? 0` (`src/routes/_authenticated/painel.recebiveis.tsx:48-52,89-144,359-361`). A Server Function valida cada leitura e lança erro ao falhar (`src/lib/lifecycle.functions.ts:327-347`), mas a interface mantém KPIs e calendário com aparência de valores reais zerados.
- **Arquivos afetados/referenciados:** `src/routes/_authenticated/painel.recebiveis.tsx:48-52`, `src/lib/lifecycle.functions.ts:327-347`
- **Causa:** estado da query não era projetado na UI, e valores ausentes usavam fallback numérico normal.
- **Correção aplicada:** a rota agora mostra carregamento e erro com ação de retry; KPIs e calendário só são renderizados após resposta válida. Uma resposta vazia válida ainda permite valores zero.
- **Dependências:** validação visual no navegador permanece pendente; ambiente remoto não consultado.
- **Crit?rios de aceite:** - ** mostrar carregamento e erro explícitos; zeros devem representar resultado consultado vazio, não falha/ausência de resposta.
- **Validação local:** testes cobrem loading sem dados, erro mesmo com cache anterior, e resposta válida vazia. Foco: 3/3; `npm test`: 87 arquivos aprovados, 3 ignorados; 857 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou.
- **Limite:** não foi feita QA visual no navegador nem consulta ao ambiente remoto.
- **Refer?ncias originais:** [frontend.md](frontend.md); detalhe(s): [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md).
- **Registro original integral:**

<details><summary>frontend.md</summary>

### UI-013 — falha de recebíveis é renderizada como valores zerados

- **Estado:** fallback da UI e erro propagado pelo servidor confirmados estaticamente.
- **Gravidade:** P2 potencial (painel financeiro Master).
- **Módulo:** frontend Master / agenda de recebíveis.
- **Esperado:** mostrar carregamento e erro explícitos; zeros devem representar resultado consultado vazio, não falha/ausência de resposta.
- **Observado:** `calendarQuery` carrega `getReceivablesCalendar`, mas a tela nunca consulta `isLoading` ou `isError`; cálculos usam `calendarQuery.data?.… ?? []` ou `?? 0` (`src/routes/_authenticated/painel.recebiveis.tsx:48-52,89-144,359-361`). A Server Function valida cada leitura e lança erro ao falhar (`src/lib/lifecycle.functions.ts:327-347`), mas a interface mantém KPIs e calendário com aparência de valores reais zerados.
- **Impacto:** durante carga ou indisponibilidade de dados, o Master pode interpretar que não há recebíveis, pagamentos do mês ou churn; não foi verificado uso operacional nem volume remoto.
- **Reprodução segura:** mockar query em loading, rejeição e resposta legítima vazia; o componente não tem estado diferenciado de loading/erro e os mesmos fallbacks numéricos permanecem.
- **Causa-raiz confirmada:** estado da query não é projetado na UI, e valores ausentes usam fallback numérico normal.
- **Correção recomendada para spec:** separar loading, erro/retry e vazio; impedir que KPIs com dados indisponíveis sejam apresentados como zero confirmado.
- **Regressão:** falha e loading nunca exibem números como dados confirmados; resposta vazia válida mostra zero; query recuperada recalcula métricas e calendário.
- **Limitação:** sem teste de browser ou consulta ao ambiente remoto.

</details>


#### UI-014 — Erros de query em serviços ou profissionais podiam produzir relatório parcial.

- **M?dulo:** Frontend/Relatório do estabelecimento
- **Gravidade:** P2 potencial
- **Estado:** Corrigido localmente; uso operacional não verificado
- **Evid?ncias:** - ** a query busca appointments, services e professionals em `Promise.all`, mas só propaga `appts.error` (`src/routes/_authenticated/painel.relatorio.tsx:52-74`). Erros de `services` e `professionals` deixam `data` nulo e viram `[]`. `completedReportMetrics` calcula revenue a partir do catálogo de serviços e rankings a partir de professionals (`src/lib/report-metrics.ts:7-31`); assim, falha na query de serviços transforma faturamento em zero, e falha de profissionais elimina o ranking sem estado de erro. A página consome apenas `data`, sem `isLoading/isError`.
- **Arquivos afetados/referenciados:** `src/routes/_authenticated/painel.relatorio.tsx:52-74`, `src/lib/report-metrics.ts:7-31`
- **Causa:** a query validava somente appointments; serviços e profissionais com erro eram reduzidos a ausência de linhas.
- **Correção aplicada:** qualquer falha das três fontes agora rejeita a query; a interface exibe erro com retry e oculta métricas até haver resposta válida. Arrays realmente vazios continuam aceitos.
- **Dependências:** QA visual no navegador permanece pendente; não houve consulta ao banco remoto.
- **Crit?rios de aceite:** - ** todos os datasets necessários para calcular o relatório devem ser válidos; caso contrário, a tela deve informar que o resultado está parcial ou indisponível.
- **Validação local:** teste cobre erro isolado de appointments, services e professionals, além de três respostas válidas vazias. Foco `report-datasets` + métricas: 5/5; `npm test`: 88 arquivos aprovados, 3 ignorados; 861 testes aprovados, 8 ignorados; `npx tsc --noEmit` passou.
- **Limite:** navegador e ambiente remoto não foram verificados.
- **Refer?ncias originais:** [frontend.md](frontend.md); detalhe(s): [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md).
- **Registro original integral:**

<details><summary>frontend.md</summary>

### UI-014 — erros em serviços/profissionais não interrompem o relatório

- **Estado:** tratamento parcial de erros confirmado estaticamente; falhas não foram injetadas.
- **Gravidade:** P2 potencial (métrica de receita e ranking).
- **Módulo:** frontend / relatório do estabelecimento.
- **Esperado:** todos os datasets necessários para calcular o relatório devem ser válidos; caso contrário, a tela deve informar que o resultado está parcial ou indisponível.
- **Observado:** a query busca appointments, services e professionals em `Promise.all`, mas só propaga `appts.error` (`src/routes/_authenticated/painel.relatorio.tsx:52-74`). Erros de `services` e `professionals` deixam `data` nulo e viram `[]`. `completedReportMetrics` calcula revenue a partir do catálogo de serviços e rankings a partir de professionals (`src/lib/report-metrics.ts:7-31`); assim, falha na query de serviços transforma faturamento em zero, e falha de profissionais elimina o ranking sem estado de erro. A página consome apenas `data`, sem `isLoading/isError`.
- **Impacto:** falha transitória/RLS pode apresentar receita concluída como R$ 0 e omitir linhas de serviços/profissionais enquanto os demais cards continuam preenchidos; o usuário não tem indicação de dados parciais.
- **Reprodução segura:** mocks com appointments válidos e erro alternado em `services`/`professionals`; observar relatório montado com array vazio e ausência de alerta.
- **Causa-raiz confirmada:** a query valida somente um dos três resultados; os dois demais erros são reduzidos a ausência de linhas.
- **Correção recomendada para spec:** propagar erro de qualquer dataset crítico e modelar loading/error/empty separados antes de calcular indicadores.
- **Regressão:** falha em cada fonte não produz KPI silenciosamente parcial; dataset realmente vazio mantém regra definida; retry bem-sucedido reconstrói todos os cartões e rankings.
- **Limitação:** sem execução de componente ou falha de consulta injetada.

</details>


#### UI-023 ? O código público é salvo best-effort, mas persistência do chargeId pode lançar antes de abrir o Pix/histórico.

- **M?dulo:** Frontend/Reserva pública/Pix
- **Gravidade:** P2 potencial
- **Estado:** Mitigated locally: a storage error keeps charge/code IDs in memory and the Pix flow continues; persistence after reload remains unavailable when browser storage is disabled.
- **Evid?ncias:** - ** `savePublicCode` captura exceção de `localStorage`, mas `saveCharge` chama `window.localStorage.setItem` sem `try/catch` (`src/routes/agendar.$slug.tsx:292-317`). Em sucesso de `reserveBooking`, a UI primeiro tenta salvar o código público e limpa o formulário; se houver `chargeId`, chama `saveCharge` antes de preencher `reservedAmount`, definir `activeCharge` e trocar para a aba de histórico (`:454-468`).
- **Arquivos afetados/referenciados:** `slug.tsx:292-317`
- **Causa:** - ** gravação obrigatória de estado de recuperação local não tem tratamento de exceção, embora a Server Function já tenha concluído a operação remota.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** após o servidor criar a reserva e a cobrança, falha de armazenamento local não deve interromper a apresentação do Pix ou a recuperação da reserva; oferecer alternativa com o código público.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** após o servidor criar a reserva e a cobrança, falha de armazenamento local não deve interromper a apresentação do Pix ou a recuperação da reserva; oferecer alternativa com o código público.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [frontend.md](frontend.md); detalhe(s): [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md).
- **Registro original integral:**

<details><summary>frontend.md</summary>

### UI-023 — exceção ao salvar cobrança no `localStorage` interrompe pós-reserva

- **Estado:** operação sem guarda confirmada estaticamente; falha de Storage não foi simulada.
- **Gravidade:** P2 potencial (reserva Pix criada sem abrir a etapa de pagamento/recuperação).
- **Módulo:** frontend público / reserva com sinal / persistência do navegador.
- **Esperado:** após o servidor criar a reserva e a cobrança, falha de armazenamento local não deve interromper a apresentação do Pix ou a recuperação da reserva; oferecer alternativa com o código público.
- **Observado:** `savePublicCode` captura exceção de `localStorage`, mas `saveCharge` chama `window.localStorage.setItem` sem `try/catch` (`src/routes/agendar.$slug.tsx:292-317`). Em sucesso de `reserveBooking`, a UI primeiro tenta salvar o código público e limpa o formulário; se houver `chargeId`, chama `saveCharge` antes de preencher `reservedAmount`, definir `activeCharge` e trocar para a aba de histórico (`:454-468`).
- **Impacto:** em navegador que bloqueia armazenamento ou quota excedida, o backend já pode ter criado appointment e Pix, enquanto a exceção interrompe a continuação que abriria o pagamento; se o código público também não puder ser persistido, o cliente pode não recuperar a cobrança nesse aparelho. Nenhuma reserva ou cobrança foi criada nesta auditoria.
- **Reprodução segura:** mockar `reserveBooking` com resposta de cobrança sintética e `localStorage.setItem` para falhar em `saveCharge`; verificar que o fluxo não chega a `setActiveCharge`/aba histórico. Sem endpoint ou gateway real.
- **Causa-raiz confirmada:** gravação obrigatória de estado de recuperação local não tem tratamento de exceção, embora a Server Function já tenha concluído a operação remota.
- **Correção recomendada para spec:** tratar persistência local como falível, manter o fluxo Pix visível e exibir/permitir copiar o código público independentemente do Storage.
- **Regressão:** storage normal persiste IDs; storage indisponível ainda mostra Pix e dados de recuperação em memória; reserva sem sinal mantém confirmação explícita.
- **Limitação:** exceção de navegador e callback de mutation não foram exercitados; provider/pagamento real não foi chamado.

</details>


#### UI-017 ? Erros de consulta são reduzidos a `[]`; lista e mensagens podem parecer sem registros.

- **M?dulo:** Frontend/Suporte Master
- **Gravidade:** P2 potencial
- **Estado:** Corrected locally: list and thread distinguish loading, query error, valid empty, and ready states; retry actions are exposed.
- **Evid?ncias:** - ** `listSupportConversations` usa `list.data?.conversations ?? []`; o JSX diferencia apenas `list.isPending` de lista vazia e não usa `list.isError` (`src/routes/_authenticated/painel.suporte.tsx:63-69,197-206`). A thread também usa `thread.data?.messages ?? []` e recebe `loading` baseado apenas em `thread.isPending`; qualquer falha após a carga inicial acaba no estado “Nenhuma mensagem nesta conversa” (`:74-78,271,380-391`).
- **Arquivos afetados/referenciados:** `src/routes/_authenticated/painel.suporte.tsx:63-69`
- **Causa:** - ** dados ausentes e erro da query são reduzidos ao mesmo fallback de array vazio.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - ** falhas ao carregar a lista ou a conversa devem aparecer como erro com opção de tentar novamente; lista ou thread vazia deve significar resposta válida sem registros.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Validar comportamento esperado: ** falhas ao carregar a lista ou a conversa devem aparecer como erro com opção de tentar novamente; lista ou thread vazia deve significar resposta válida sem registros.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [frontend.md](frontend.md); detalhe(s): [`frontend.md`](../docs/auditoria-agenda-agora/frontend.md).
- **Registro original integral:**

<details><summary>frontend.md</summary>

### UI-017 — falha na central de suporte aparece como conversa vazia

- **Estado:** fallback de consulta confirmado estaticamente; rejeições não foram injetadas.
- **Gravidade:** P2 potencial (operação de suporte Master).
- **Módulo:** frontend Master / suporte.
- **Esperado:** falhas ao carregar a lista ou a conversa devem aparecer como erro com opção de tentar novamente; lista ou thread vazia deve significar resposta válida sem registros.
- **Observado:** `listSupportConversations` usa `list.data?.conversations ?? []`; o JSX diferencia apenas `list.isPending` de lista vazia e não usa `list.isError` (`src/routes/_authenticated/painel.suporte.tsx:63-69,197-206`). A thread também usa `thread.data?.messages ?? []` e recebe `loading` baseado apenas em `thread.isPending`; qualquer falha após a carga inicial acaba no estado “Nenhuma mensagem nesta conversa” (`:74-78,271,380-391`).
- **Impacto:** falha transitória/RLS pode esconder conversas ou mensagens recebidas do operador e ser confundida com ausência real de solicitações; a central refaz polling, mas o polling não torna a falha visível.
- **Reprodução segura:** rejeitar queries mockadas de lista e thread; observar o estado vazio sem mensagem de erro/retry.
- **Causa-raiz confirmada:** dados ausentes e erro da query são reduzidos ao mesmo fallback de array vazio.
- **Correção recomendada para spec:** separar estados de carregamento, erro, vazio e sucesso; exibir retry sem apagar contexto da conversa selecionada.
- **Regressão:** falhas de lista/thread mostram erro; resposta vazia válida mostra vazio; retry bem-sucedido restaura conversas e mensagens.
- **Limitação:** sem consulta a suporte real, injeção de erro ou teste de browser.

</details>


#### DEP-004 ? Falha no health check após trocar current mantém a release nova selecionada.

- **M?dulo:** Infra/Deploy
- **Gravidade:** P2 potencial
- **Estado:** Corrected locally: release script restores the previous symlink and restarts after health-check or restart failure; VPS use is unverified.
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** `ops/vps/deploy-release.sh:32-46`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [infraestrutura.md](infraestrutura.md); detalhe(s): [`infraestrutura.md`](../docs/auditoria-agenda-agora/infraestrutura.md).
- **Registro original integral:**

<details><summary>infraestrutura.md</summary>

## DEP-004 — release defeituosa não é revertida pelo script

**P2 potencial, propriedade do script confirmada; uso/impacto em produção desconhecidos.** `ops/vps/deploy-release.sh:32-46` muda `/opt/agenda-agora/current` para a nova pasta antes de reiniciar e testar; se o health check falhar, imprime status e sai com erro sem restaurar o symlink anterior. Como o serviço está com `Restart=always`, a instância pode continuar tentando iniciar a release defeituosa. Nenhum deploy foi executado. Reprodução segura: simular o ciclo em diretório temporário com serviço/HTTP fake e forçar falha do health check; verificar que o link continua no novo diretório. Recomendação para spec: guardar alvo anterior, restaurá-lo em qualquer falha pós-switch e confirmar saúde do retorno; testar falha no build, restart e health check.

</details>


#### DEP-005 ? Falha do ciclo de assinatura pode deixar avisos/ações para a execução diária seguinte; schedule instalado desconhecido.

- **M?dulo:** Infra/Jobs
- **Gravidade:** P2 potencial
- **Estado:** Locally mitigated: oneshot service has bounded on-failure retry; installed VPS unit and operational alerting remain unverified.
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** `www.freedesktop.org/software/systemd/man/260/systemd.timer.html`
- **Causa:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Corre??o necess?ria:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Crit?rios de aceite:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Checklist detalhado de testes (n?o executado):**
  - [x] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [infraestrutura.md](infraestrutura.md); detalhe(s): [`infraestrutura.md`](../docs/auditoria-agenda-agora/infraestrutura.md).
- **Registro original integral:**

<details><summary>infraestrutura.md</summary>

## DEP-005 — falha do ciclo diário não tem retry configurado no mesmo dia

**P2 potencial; arquivos de timer/service confirmam frequência e ausência de Restart, mas instalação atual e falhas reais são desconhecidas.** `agenda-subscription-lifecycle.timer` agenda uma vez ao dia às 06:00 `America/Sao_Paulo`, `Persistent=true` (`ops/vps/agenda-subscription-lifecycle.timer:1-8`). O service é `Type=oneshot`, chama `agenda-cron subscription-lifecycle` e não declara `Restart=` (`ops/vps/agenda-subscription-lifecycle.service:1-7`). Se a invocação diária falhar depois de disparar, os arquivos não definem retry até o próximo disparo do calendário. `Persistent=true` guarda a última ativação e recupera execuções perdidas enquanto o timer estava inativo — por exemplo, durante período em que o host estava desligado — mas não configura nova tentativa imediata após falha do service, conforme a documentação oficial do [systemd.timer](https://www.freedesktop.org/software/systemd/man/260/systemd.timer.html). Impacto: um erro isolado pode atrasar avisos e ações de ciclo de assinatura até a janela seguinte; o efeito depende da lógica do job e de qualquer cron alternativo não verificado. Reprodução segura: executar unit de teste equivalente com comando que falha e observar que nenhuma segunda ativação é configurada antes do próximo OnCalendar; não disparar o timer real. Especificação de correção deve definir retry/backoff e alerta para falha, preservando idempotência. Nenhum timer foi iniciado nem alterado.

</details>


#### ADM-001 ? KPI e badge do dossiê mostram status `cancelado` como ativo; MRR usa regra distinta.

- **M?dulo:** Master/Visão geral e dossiê
- **Gravidade:** P2
- **Estado:** Corrigido localmente em 2026-11-14; somente `ativo` conta como ativo e labels distinguem cancelado.
- **Evid?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Arquivos afetados/referenciados:** `src/lib/master/platform-overview.functions.ts:206-208`, `src/components/master/PlatformOverview.tsx:346-354`, `src/components/master/BusinessDossier.tsx:367`, `platform-overview.functions.ts:286-295`, `src/lib/subscription-lifecycle.ts:70-73`
- **Causa:** As superficies usavam `status !== "suspenso"`, agrupando `cancelado` como ativo.
- **Correcao necessaria:** Contar explicitamente status `ativo` e preservar label proprio para `cancelado`.
- **Depend?ncias:** - N?o explicitado na fonte; manter como pend?ncia sem inferir.
- **Criterios de aceite:** `cancelado` e `suspenso` nao aumentam KPI de ativos; dossier/cartao nao os rotulam como ativos; MRR mantem regra propria de lifecycle.
- **Checklist detalhado de testes (n?o executado):**
  - [ ] Preparar fixture isolada para o caminho/estado descrito; validar pr?-condi??es, ator/tenant e estado inicial, sem escrita em produ??o.
  - [x] Definir resultado esperado pela regra de neg?cio/spec citada e comparar com resultado observado antes de implementar.
  - [ ] Cobrir caminho v?lido adjacente e falha/erro; verificar resultado, persist?ncia e mensagens sem efeitos externos reais.
  - [ ] Registrar evid?ncia reproduz?vel, estado anterior/posterior e resultado; manter inconclusivo se n?o houver confirma??o.
- **Refer?ncias originais:** [riscos.md](riscos.md); detalhe(s): [`riscos.md`](../docs/auditoria-agenda-agora/riscos.md).
- **Registro original integral:**

<details><summary>riscos.md</summary>

### ADM-001 - 2026-11-14

KPI conta somente negocios `ativo`; overview, dossier e cartao rapido distinguem cancelado de ativo. Teste focal 8/8. TypeScript e suite completa nao repetidos porque processo Node preexistente consumia cerca de 1.1 GB e restavam ~358 MB de memoria fisica. Sem dados remotos. Contagem: 41 corrigidos localmente, 7 bloqueados/nao verificados e 103 pendentes de 151.

## API-004 - 2026-11-14

`createTimeBlock` valida acesso ao negocio via RLS e checa `block_schedule`, com fallback para `block_agenda`; erro ou ausencia de permissao interrompe antes do INSERT. Harness isolado cobre ambas permissoes e negacao: 3/3. `git diff --check` sem erros. Nenhum dado real usado; TypeScript/suite completa nao repetidos por memoria limitada. Contagem: 42 corrigidos localmente, 7 bloqueados/nao verificados e 102 pendentes de 151.
`r`n`r`n## RECUPERACAO PENDENTE - 2026-11-14`r`n`r`nO checklist foi truncado acidentalmente durante atualizacao automatizada. O arquivo atual tem 199039 bytes; o snapshot original registrado anteriormente tinha 712746 bytes. O restante nao foi reconstruido por inferencia.`r`n`r`nCorrecoes validadas apos o ultimo resumo preservado: ADM-001, API-004, INT-002, API-008 e UI-004. Regressao focal combinada: 8 arquivos, 56/56; `git diff --check` sem erros. TypeScript e suite geral pendentes. Contagem atual registrada no vault: 45 corrigidos, 7 bloqueados/nao verificados, 99 pendentes de 151. Restaurar o original e reaplicar estes registros antes de continuar as atualizacoes deste arquivo.`r`n

Validacao posterior a este aviso: `npx tsc --noEmit` passou; `npm test` passou com 101 arquivos, 915 testes aprovados e 8 ignorados (3 arquivos ignorados). Contagem atual no vault: 45 corrigidos, 7 bloqueados/nao verificados e 99 pendentes.

## Continuidade - 2026-11-14 (INT-001)

- Corrigido localmente: cooldown da saudacao WhatsApp alinhado a 30 minutos; migration aditiva atualiza claim atomico sem tocar remoto.
- Teste DB red/green: bloqueia em 29:59 e permite novo claim em 30:00; testes WhatsApp 20/20, DB focal 5/5, suite 912/8 ignorados, DB completo 73/73 e TypeScript passou.
- Contagem atual no vault: 46 corrigidos, 7 bloqueados/nao verificados, 98 pendentes dos 151 IDs. Checklist segue incompleto e precisa ser restaurado antes de reaplicar o conteudo perdido; nao inferir secoes ausentes.

## Continuidade - 2026-11-14 (INT-005/006)

- Corrigidos localmente: tentativa com status erro permite retry; RPC de claim impede cron concorrente de enviar o mesmo canal ao mesmo tempo; falha de leitura de appointments retorna 500. Migration local aditiva adiciona lease de 15 minutos e RPCs restritas a `service_role`.
- Testes: rota 2/2; DB focal 4/4 (inclui seis claims concorrentes e ACL); suite completa 914/8 ignorados; DB completa 77/77; TypeScript passou.
- Contagem atual no vault: 48 corrigidos, 7 bloqueados/nao verificados e 96 pendentes dos 151 IDs. Checklist incompleto; restaurar o original antes de reaplicar conteudo perdido.

## Continuidade - 2026-11-14 (SEC-022)

- Corrigido localmente: senha temporaria exibida no Master e vinculada ao business que a gerou; fechar/trocar ficha limpa o estado, resposta atrasada nao revela segredo em outro business.
- Teste focal 1/1; `npm test` 915 aprovados/8 ignorados; TypeScript passou. Sem reset real ou alteracao de credenciais.
- Contagem atual no vault: 49 corrigidos, 7 bloqueados/nao verificados e 95 pendentes dos 151 IDs. Checklist permanece incompleto e aguarda restauracao.

## Continuidade - 2026-11-14 (SEC-005)

- Causa revalidada: os inserts de auditoria em `extendBusinessTrial`, `setBusinessAccessDays` e `setBusinessCancellation` ignoravam erros PostgREST; `recordEvent` no dossie tambem ignorava `{ error }`. A edicao de contato ja usa evento previo e valida o resultado, e foi preservada.
- Corrigido localmente: erros de auditoria agora impedem resposta de sucesso. Apos mutacao ja persistida, a funcao informa explicitamente que a alteracao foi aplicada sem auditoria; falha da auditoria do snapshot impede retornar os dados sensiveis.
- TDD: regressao de cancelamento falhou antes da correcao (retornava `{ ok: true }`), passou depois; regressao da edicao comercial tambem reproduziu sucesso silencioso antes e passou depois. Suite focal: 3 arquivos, 19/19; `npx tsc --noEmit` e `git diff --check` passaram.
- Arquivos: `src/lib/lifecycle.functions.ts`, `src/lib/lifecycle.cancellation.test.ts`, `src/lib/master/dossier.functions.ts`, `src/lib/master/dossier-mutations.test.ts`.
- Contagem no vault: 50 corrigidos, 7 bloqueados/nao verificados e 94 pendentes dos 151 IDs. Nenhuma escrita remota, deploy, push ou commit.
## Continuidade - 2026-11-14 (PRO-001)

- Reproducao red: owner autenticado conseguia inserir diretamente o 11o profissional; duas insercoes concorrentes tambem ultrapassavam o limite com uma vaga restante.
- Corrigido localmente: migration `20261114232004_enforce_professional_limit.sql` cria trigger invoker que trava a linha do negocio e aplica teto de dez em INSERT e transferencia de profissional. `saveProfessional` falha fechado quando a contagem retorna erro ou `null` e preserva a mensagem de limite ao atingir dez.
- Testes: rota `professionals.functions.test.ts` 15/15; DB focal `functions.test.ts` 24/24; DB completa 3 arquivos, 79/79; `npm test`: 103 arquivos passaram, 3 ignorados, 921 testes passaram e 8 ignorados; `npx tsc --noEmit` e `git diff --check` passaram.
- Arquivos: migration acima, `src/lib/professionals.functions.ts`, `src/lib/professionals.functions.test.ts`, `tests/db/functions.test.ts`.
- Contagem no vault: 51 corrigidos, 7 bloqueados/nao verificados e 93 pendentes dos 151 IDs. Migration local nao aplicada remotamente; sem deploy, push ou commit.
## Continuidade - 2026-11-14 (SEC-012)

- Reproduzido em Postgres efemero: `anon` conseguia ler `reason` de um bloqueio sentinela pela policy global `USING (true)`.
- Corrigido localmente: migration `20261114232840_restrict_anon_time_blocks.sql` revoga SELECT de `anon` e remove a policy `time_blocks_public_read`. A chain RLS autenticada foi preservada; owner le seu bloqueio e outro owner recebe zero linhas.
- O fluxo publico de disponibilidade nao dependia de consulta anonima direta: `getAvailability` usa `admin()` e filtra por `business_id`. Regressao `booking.functions.test.ts`: 116/116; teste DB de seguranca: 52/52; DB completa: 3 arquivos, 80/80; `npm test`: 103 arquivos aprovados, 3 ignorados; 921/8 ignorados; TypeScript e `git diff --check` passaram.
- Arquivos: `supabase/migrations/20261114232840_restrict_anon_time_blocks.sql`, `tests/db/security-hardening.test.ts`, `docs/auditoria-agenda-agora/seguranca.md`.
- Contagem no vault: 52 corrigidos, 7 bloqueados/nao verificados, 92 pendentes de 151. Migration somente local; nenhuma consulta ou escrita remota, deploy, push ou commit.
## Continuidade - 2026-11-14 (SEC-013)

- Reproduzido em Postgres efemero: owner de business A conseguia ler assets `logo-*`, `services/*`, `background/*` e `staging/*` de business B.
- Corrigido localmente: a migration `20261114233557_restrict_visual_asset_reads.sql` exige membership para imagens publicadas/legadas e exige `manage_appearance` mais `split_part(name, '/', 3) = auth.uid()` para staging. Policies anônimas para logos legados foram preservadas.
- Regressão: owner lê logo, serviço, background e staging próprios; profissional ativo com `manage_appearance` lê os objetos publicados do business e o staging próprio, não o staging do owner; outro business permanece isolado. DB focal 53/53; DB completa 3 arquivos, 81/81; `npm test` 921/8 ignorados; TypeScript e diff check passaram.
- Arquivos: migration acima, `tests/db/security-hardening.test.ts`, `docs/auditoria-agenda-agora/seguranca.md`.
- Contagem no vault: 53 corrigidos, 7 bloqueados/nao verificados e 91 pendentes de 151. Nenhuma migration remota, deploy, push ou commit.

## Continuidade - 2026-11-14 (SEC-025)

- Corrigido localmente o limite de corpo do webhook AgPay: 1 MiB, validando `Content-Length` quando presente e contando bytes durante leitura streaming; excedente retorna 413 antes do HMAC e cancela o stream.
- RED reproduziu aceite do tamanho declarado acima do teto e leitura/verificação do corpo sem `Content-Length`; green confirma 413, ausência de chamada HMAC e cancelamento do stream. Teste focal 8/8; suíte 103 arquivos aprovados, 3 ignorados, 923/8 testes; TypeScript e diff check passaram.
- Atualizados `src/routes/api/public/agpay-webhook.ts`, `src/routes/api/public/agpay-webhook.test.ts` e `docs/auditoria-agenda-agora/seguranca.md`. Borda e configuração de produção seguem desconhecidas; sem implantação, chamada ao provedor, commit ou push.
- Contagem no vault: 54 corrigidos, 7 bloqueados/não verificados e 90 pendentes de 151.

## Continuidade - 2026-11-14 (SEC-026)

- Corrigido localmente o validador de configuração: `NODE_ENV=production` exige HTTPS para URL pública e todas as origins permitidas; fora de produção, HTTP só é aceito para loopback.
- RED reproduziu aceite de origin HTTP em produção e de host remoto HTTP em desenvolvimento; green cobre rejeições e localhost autorizado. Teste focal 8/8 e TypeScript passaram após ajuste de tipo; suíte completa e diff check pendentes nesta atualização.
- Arquivos: `src/lib/production-config.ts`, `src/lib/production-config.test.ts`, `src/lib/env-security.server.ts` e documentação de segurança.
- Contagem de trabalho: 55 corrigidos, 7 bloqueados/não verificados e 89 pendentes de 151. Configuração implantada e terminação TLS não verificadas.



## SEC-006 local completion - 2026-11-14

- Corrected locally; deployed Supabase settings and real user factors remain unverified.
- `assertSuperAdmin` requires current role and `aal2`; AAL1 login reaches `/painel/master-auth` for TOTP setup/challenge; Master panel requires AAL2.
- Four focused files, 33/33 tests; `npx tsc --noEmit` and `git diff --check` passed. No remote action.
- Count at this point: 56 corrected locally, 6 blocked/unverified, 89 pending of 151.


## ADM-002 local completion - 2026-11-14

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

### PAY-029 — validação e correção local — 2026-11-14

O handler do estorno agora grava `deposit_payments.status='estornado'` e o `provider_status` recebido depois do débito idempotente no ledger; falha nessa gravação é propagada para retry. A confirmação tardia não regride um estorno já persistido. As visões Master e AgPay distinguem volume bruto, volume estornado e líquido. Comissão e taxa registradas no ledger permanecem na receita histórica porque `debitRefund` debita somente o líquido do estabelecimento; o total líquido do negócio exclui a cobrança estornada. Não houve migração ou acesso/escrita remota.

RED/GREEN: `agpay-events.server.test.ts` cobre estado persistido, reentrega e evento completed fora de ordem; testes de inteligência e performance cobrem volume bruto/estornado/líquido e comissão retida. Testes focados: 5 arquivos, 77/77; `npx tsc --noEmit` passou; `git diff --check` sem erros. O contrato oficial do nome de evento de estorno segue pendente em PAY-007; a correção cobre apenas eventos reconhecidos pelo handler atual. Contagem: 68 corrigidos localmente, 7 bloqueados/não verificados e 76 pendentes de 151.


### UI-003 local resolution (2026-11-14)


**Current local resolution (2026-11-14):** The report has no implemented data flow or product scope in the reviewed specs. The menu card remains visible but is now disabled, displays "Comparativo Evolutivo (em breve)", and exposes `aria-disabled`; the success toast was removed. Regression component tests cover unavailable and available menu options: 2/2. `npx tsc --noEmit` and `git diff --check` passed. No report data or external service was accessed. State: unavailable state made explicit locally; no deploy, migration, push, or commit. Total: 71 fixed, 7 blocked/unverified, 73 pending of 151.


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


### UI-030 fixed locally (2026-11-14)

The rejected-charge KPI no longer reports a literal zero. It now shows an em dash and "Metric unavailable" until a source/window is defined; no live charge data was inspected. Focused metric plus receivables-state tests: 4/4. `npx tsc --noEmit` and `git diff --check` passed. No external data or operation. Count: 72 fixed, 7 blocked/unverified, 72 pending of 151.


### UI-031/UI-032/UI-034 revalidated (2026-11-14)

Receivables now uses local month boundaries for the monthly KPI, computes the visible week from the selected cursor, and shares the 120-day history limit between the server query and a visible notice that older periods may be incomplete. Focused date/calendar/history tests: 4/4. No production buckets or remote data inspected. These items were already counted among local fixes; total remains 72/7/72 of 151.


### UI-033 fixed locally (2026-11-14)

The metric counted every request not yet finalized, regardless of `access_until`, so it could not support a "next 30 days" forecast. Changed its label to "Pedidos de cancelamento em aberto", shows the request count and associated monthly fee, and removed the unsupported churn percentage. No lifecycle rule or production data was inferred. Metric test plus receivables-state tests: 5/5; TypeScript and diff check passed. Count: 73 fixed, 7 blocked/unverified, 71 pending of 151.


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
### DEP-005 mitigação local parcial — 2026-11-15

O service `agenda-subscription-lifecycle` agora tenta reiniciar após falha, com intervalo de 5 minutos e limite de 3 partidas por hora (`Restart=on-failure`, `RestartSec=5min`, `StartLimitBurst=3`). O RED do teste PowerShell confirmou a ausência das diretivas; o teste passou após a alteração. `npm test`: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. `npx tsc --noEmit` e `git diff --check` passaram. A lógica da rota deduplica avisos e o cancelamento usa RPC idempotente. Ainda não há canal de alerta operacional identificado, e a instalação do unit no host não foi inspecionada. DEP-005 permanece pendente parcialmente mitigado; contagem inalterada: 90 corrigidos, 7 bloqueados/não verificados e 54 pendentes de 151. Nenhum timer/service foi iniciado ou alterado remotamente.
### BOOK-013 corrigido e validado localmente — 2026-11-15

RED reproduziu a corrida: a confirmação mudou a cobrança para `pago` e o agendamento para `agendado`, mas `cancelPendingDeposit` devolvia `expirado`. Agora, quando o UPDATE condicional de expiração não altera a linha, o handler relê e devolve o estado efetivo. A interface só confirma cancelamento para `expirado`; se recebe `pago`, mostra a confirmação, se recebe `pago_sem_agendamento` informa que o estabelecimento precisa conferir, e estado ainda pendente permanece recuperável. Teste de corrida + feedback: 32/32; `npm test`: 121 arquivos aprovados, 3 ignorados; 1001 aprovados, 8 ignorados. `npx tsc --noEmit` e `git diff --check` passaram. Nenhum gateway, dado ou banco remoto foi acessado. Contagem: 91 corrigidos localmente, 7 bloqueados/não verificados e 53 pendentes de 151.
### UI-038 corrigido localmente — 2026-11-15

`PaymentDialog` agora aguarda `navigator.clipboard.writeText` antes de marcar sucesso. Rejeição ou API indisponível mostra erro e mantém o QR/código visível. RED/GREEN no helper `copyPixCode`: resolução tardia só confirma depois de concluir, rejeição retorna falha (2/2). Suíte completa: 122 arquivos aprovados, 3 ignorados; 1003 testes aprovados, 8 ignorados. TypeScript e diff check passaram. Sem acesso de browser, clipboard ou pagamento real. Contagem: 92 corrigidos localmente, 7 bloqueados/não verificados e 52 pendentes de 151.
### UI-039 mitigado localmente — 2026-11-15

O polling de status Pix reduziu de 5s para 15s após a primeira consulta (até 4 chamadas/min por modal). O timer recursivo agenda a próxima leitura após a anterior concluir, impedindo sobreposição. Falhas ficam visíveis e acionam backoff de 30s, 60s até o teto de 60s; sucesso reseta o erro e a frequência. Teste do intervalo/backoff: 1/1; suíte completa: 123 arquivos aprovados, 3 ignorados; 1004 testes aprovados, 8 ignorados. TypeScript e diff check passaram. Cota por IP continua compartilhada e limite/proxy de produção não foram medidos; o feedback não é mais silencioso. Sem dado/produção. Contagem: 93 corrigidos localmente, 7 bloqueados/não verificados e 51 pendentes de 151.

### SEC-021 corrigido localmente — 2026-11-15

RED reproduziu vínculo de serviço A com categoria B. A nova migration verifica vínculos cruzados existentes e falha antes de modificar constraints se encontrar algum; caso esteja limpa, impõe FK composta de tenant e preserva `business_id` ao excluir categoria. Teste DB focal 2/2, cadeia DB 5 arquivos/87 testes, `npm test` 123 arquivos/1004 aprovados/8 ignorados e TypeScript passaram. Migration aplicada só no banco descartável; sem consulta ou escrita remota. Contagem: 94 corrigidos localmente, 7 bloqueados/não verificados e 50 pendentes de 151.

### DOC-001 corrigido localmente — 2026-11-15

A nota de mudanças agora separa o deploy documentado em 04/11 (`aa4a32e`) do HEAD de `main` observado em 15/11 (`323189d`, 24 commits depois) e resume as mudanças do commit `742114f` de 05/11. Produção posterior ao deploy não foi consultada; alterações não commitadas da auditoria foram excluídas do registro de versão. Validação por leitura da nota, `git log`, ancestralidade e estado de branch/worktree. Contagem: 95 corrigidos localmente, 7 bloqueados/não verificados e 49 pendentes de 151.

### PAY-033 corrigido localmente com documentação oficial AgPay — 2026-11-15

A documentação oficial AgPay lista HTTP 400/401/403/404/422 como erros de requisição, autenticação, autorização, recurso ou validação. O código local classifica esses casos como rejeitados; 3xx, 5xx e falhas sem resposta continuam ambíguos, sem novo POST imediato. `booking.functions.test.ts` passou 124/124 e `npx tsc --noEmit` passou. Nenhuma chamada autenticada, cobrança real ou alteração de produção foi feita. O acesso ao painel AgPay expirou, conforme informado pelo usuário; não será solicitado acesso ao cliente. A configuração específica da conta e as operações reais permanecem sem verificação.
### UI-002 revalidado corrigido localmente — 2026-11-15

A tela aplica `type`, `depositStatus` e `withdrawalStatus` por `filterTransactionRows`; “Aplicar filtros” registra os valores e zera a página, e “Limpar” restaura busca e filtros. Teste focal `src/lib/transactions-filter.test.ts`: 2/2. QA visual em browser não executado. UI-002 já consta no grupo corrigido localmente; tally reportado 128/17/6 sem alteração, item-level ainda não reconciliado.

### PAY-034 corrigido localmente — 2026-11-15

O UPDATE de renovação agora faz compare-and-set atômico com `access_until IS NULL OR access_until < target`; uma confirmação atrasada não encurta um acesso mais longo. RED/GREEN no teste de unidade; PostgreSQL descartável testou ambos os ordenamentos concorrentes e preservou o maior prazo. DB: 6 arquivos/88 testes aprovados; app: 123 arquivos/1005 aprovados/8 ignorados; TypeScript passou. Sem migration, webhook, pagamento ou consulta remota. Contagem: 96 corrigidos, 8 bloqueados/não verificados, 47 pendentes.

### UI-036 bloqueado por decisão de navegação — 2026-11-15

O botão segue sem ação no código-base; conteúdo explicativo já existe no mesmo hero. A proposta local é rolar até essa explicação por âncora, mas a preferência de destino foi solicitada e ainda não respondida. A skill brainstorming exige aprovação da descrição de uma mudança pequena antes de construí-la; nenhuma alteração foi feita. Contagem: 96 corrigidos, 9 bloqueados/não verificados, 46 pendentes.

### PAY-021/PAY-023 corrigidos localmente — 2026-11-15

Avisos do ciclo agora usam chave por vencimento (`access_until`) e estágio (`title`), com índice único por negócio e upsert que ignora conflito. Reruns concorrentes não duplicam e o mesmo título pode surgir no ciclo mensal seguinte. RED/GREEN comprovou antes a supressão a 30 dias; teste de rota e PostgreSQL concorrente passaram. App: 123 arquivos/1006 aprovados/8 ignorados; DB: 7 arquivos/89 testes; TypeScript passou. Migration apenas no ensaio descartável. Contagem: 98 corrigidos, 9 bloqueados/não verificados, 44 pendentes.


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

### UI-006 corrigido localmente — 2026-11-15

Revalidei que rótulos e a spec 001 descrevem “atendimentos”, enquanto reservas canceladas, futuras e aguardando sinal contaminavam contagem, gráfico e recência. A consulta agora inclui `status`; a lista ainda reconhece clientes de todas as reservas, mas `lastAppointmentAt`, comparativo mensal e distribuição diária usam somente `concluido`. Teste focal `src/lib/customer-list.test.ts`: 2/2; `npx tsc --noEmit` passou; suíte completa: 128 arquivos passaram, 3 ignorados, 1.020 testes passaram e 8 ignorados; `git diff --check` passou. Contagem: 104 corrigidos localmente, 10 bloqueados/não verificados e 37 pendentes de 151.

### UI-018 corrigido localmente — 2026-11-15

O chat Master aguarda confirmação de `mutateAsync` antes de limpar o rascunho; falha mantém o texto e sucesso só limpa se o campo ainda tiver o conteúdo submetido. RED: teste falhou porque o helper ainda não existia; GREEN: `src/lib/support-draft.test.ts` passou 2/2 cobrindo envio pendente, sucesso e falha. `npx tsc --noEmit` passou; suíte completa: 129 arquivos passaram, 3 ignorados, 1.022 testes passaram e 8 ignorados. O teste focal foi repetido após proteger edição mais recente: 2/2. Contagem: 105 corrigidos localmente, 10 bloqueados/não verificados e 36 pendentes de 151.

### UI-008 corrigido localmente — 2026-11-15

A query de categorias não converte erros em `[]`; erro de leitura tem aviso e retry, dados vazios só aparecem após resposta válida e “Nova categoria” fica desabilitado durante falha. Teste `ServiceCategoriesQueryNotice.test.tsx`: 3/3; teste de codificação: 1/1; TypeScript passou; suíte completa: 130 arquivos passaram, 3 ignorados, 1.025 testes passaram e 8 ignorados; diff check passou. API-006 mantém rastreada a atomicidade de gravações/vínculos, fora desta correção de leitura. Contagem: 106 corrigidos localmente, 10 bloqueados e 35 pendentes de 151.

### UI-020 corrigido localmente — 2026-11-15

Falha ao excluir serviço/cliente mostra `friendlyError` e mantém a confirmação; sucesso limpa somente o alvo do DELETE confirmado. RED: teste falhou antes do helper; GREEN: `src/lib/delete-confirmation.test.ts` passou 3/3 (falha, sucesso, alvo alterado durante espera). `npx tsc --noEmit` passou; regressão completa: 131 arquivos passaram, 3 ignorados, 1.028 testes passaram e 8 ignorados. Nenhuma exclusão real. Contagem: 107 corrigidos localmente, 10 bloqueados e 34 pendentes de 151.

### UI-021 corrigido localmente — 2026-11-15

A tela agora separa loading e erro do empty state, aguarda ambas as queries e oferece retry conjunto para clientes e visitas. Teste `CustomerListQueryNotice.test.tsx`: 3/3; TypeScript e diff check passaram; suíte completa: 132 arquivos passaram, 3 ignorados, 1.031 testes passaram e 8 ignorados. Contagem: 108 corrigidos localmente, 10 bloqueados e 33 pendentes de 151.

### UI-024 corrigido localmente — 2026-11-15

A gravação de referências fica desabilitada até consulta válida dos valores existentes e também durante mutation pendente. `src/lib/platform-fees-save-state.test.ts`: 2/2; TypeScript aprovado; regressão completa: 133 arquivos passaram, 3 ignorados, 1.033 testes passaram e 8 ignorados. Nenhuma taxa remota foi modificada. Contagem: 109 corrigidos localmente, 10 bloqueados e 32 pendentes de 151.

### UI-024 corrigido localmente — 2026-11-15

O botão de salvar as taxas de referência é bloqueado durante loading/erro e mutation pendente. Teste focal 2/2, TypeScript aprovado, suíte completa: 133 arquivos passaram, 3 ignorados, 1.033 testes passaram e 8 ignorados. Nenhuma taxa remota foi alterada. Contagem: 109 corrigidos localmente, 10 bloqueados, 32 pendentes de 151.

### UI-028 corrigido localmente — 2026-11-15

Empty state global aparece apenas após query válida e fila realmente vazia. Busca/filtro sem match agora recebe mensagem própria e botão “Limpar filtros”. Helper testado para global vazio, sem correspondência, resultados, loading/erro: 4/4. TypeScript e diff check passaram; suíte completa: 134 arquivos passaram, 3 ignorados, 1.037 testes passaram e 8 ignorados. Contagem: 110 corrigidos localmente, 10 bloqueados e 31 pendentes.

### UI-028 corrigido localmente — 2026-11-15

A tela distingue fila vazia de ausência de correspondência nos filtros, com ação para limpar; não mostra estado vazio durante loading/erro. Teste 4/4, TypeScript e diff check aprovados; suíte completa: 134 arquivos passaram, 3 ignorados, 1.037 testes passaram e 8 ignorados. Contagem: 110 corrigidos, 10 bloqueados e 31 pendentes.

### UI-022 corrigido localmente — 2026-11-15

Descrição do editor de aparência agora informa que Elegance é o modelo disponível, conforme specs 010 e lista de modelos. RED: SSR test falhou com o texto antigo; GREEN: `AppearanceEditor.test.tsx` passou 11/11. TypeScript aprovado e suíte completa: 134 arquivos aprovados, 3 ignorados, 1.037 testes aprovados e 8 ignorados. Contagem: 111 corrigidos, 10 bloqueados e 30 pendentes de 151.

### DB-003 corrigido localmente — 2026-11-15

JSDoc agora documenta `{url, pg, applied, failures, stop}`, como retorna `startEnsaio()`. `node --check scripts/ensaio/db.mjs` passou; nenhuma instância de ensaio foi iniciada. Sem alteração funcional. Contagem: 112 corrigidos, 10 bloqueados e 29 pendentes de 151.

### UI-022 corrigido localmente — 2026-11-15

Copy agora descreve que Elegance é o modelo disponível. `AppearanceEditor.test.tsx`: 11/11; TypeScript aprovado e suíte completa: 134 arquivos/1.037 testes, 3 arquivos/8 testes ignorados.

### DB-003 corrigido localmente — 2026-11-15

JSDoc de `startEnsaio()` agora documenta `{url, pg, applied, failures, stop}`, como o objeto retornado. `node --check` aprovado sem iniciar banco. Contagem: 112 corrigidos, 10 bloqueados e 29 pendentes de 151.

### DEP-003 revalidado e bloqueado — 2026-11-15

`npm audit --json`: 7 Moderate, zero High/Critical; `npm audit --omit=dev --json`: zero. `typescript-eslint@8.72.1` traz `minimatch@10.2.6` por faixa `^10`, enquanto o advisory GHSA-g3hv-75wg-m249 fixa em 11.0.1. Não apliquei override major nem alterei package/lockfile local já modificado; risco potencial de quebrar ESLint/parser. Aguardar suporte upstream ou revisão isolada da cadeia. Contagem: 112 corrigidos, 11 bloqueados, 28 pendentes.

### DEP-003 revalidado, sem correção segura nesta rodada — 2026-11-15

Há 7 Moderate somente em dependências de desenvolvimento e zero com `--omit=dev`. A cadeia usa `minimatch@10.2.6`; advisory fixa em 11.0.1, fora da faixa major 10 do parser. Não forcei override nem modifiquei o lockfile preexistente. Bloqueado até upstream compatível. Contagem: 112 corrigidos, 11 bloqueados e 28 pendentes.

### API-005 bloqueado aguardando aprovação do desenho — 2026-11-15

Causa confirmada: RLS permite owner inserir somente `sender='user'`, enquanto a seed da saudação tenta `sender='master'` e ignora a rejeição. Proposta: seed server-only com validação explícita de ownership e garantia idempotente via mudança aditiva; manter INSERT direto do owner restrito a `sender='user'`. A skill `brainstorming` exige aprovação do desenho antes de alterar comportamento; pergunta enviada, resposta pendente. Nenhum código, migration ou dado remoto alterado. Contagem: 112 corrigidos, 12 bloqueados e 27 pendentes de 151.

### API-005 bloqueado aguardando aprovação — 2026-11-15

A implementação atual tenta inserir `sender=master` com a sessão do owner, contrariando RLS que só permite `sender=user`. O desenho enviado propõe seed server-only, validação de ownership e idempotência aditiva sem ampliar INSERT do owner. Gate da skill brainstorming ainda não aprovado; não houve mudança. Contagem: 112 corrigidos, 12 bloqueados e 27 pendentes.

### PAY-005 corrigido localmente — 2026-11-15

Revalidei a causa no adaptador `agpayFetch`: ele fixava Bearer/Accept, ignorava `AGPAY_CLIENT_ID`, e o teste antigo afirmava que `X-Client-ID` deveria estar ausente. A documentação oficial atual (`https://agpay.services/documentacao`) mostra Bearer + Client ID nos exemplos de Pix e especifica GET `/transactions` com `limit`. Usando a credencial local sem exibi-la, `GET /api/v1/transactions?limit=1` retornou HTTP 200 e `success=true` com e sem `X-Client-ID`; nenhum dado de transação foi impresso. O adaptador agora encaminha o header quando a variável estiver configurada; `.env.example` e runbook foram alinhados e a observação histórica de 401 foi qualificada. RED: teste falhou porque o header não era enviado. GREEN: `src/lib/agpay.server.test.ts` 14/14; `npm test`: 134 arquivos passaram, 3 ignorados; 1.038 testes passaram, 8 ignorados; `npx tsc --noEmit` passou; `git diff --check` sem erros de whitespace (avisos LF/CRLF preexistentes). POST em sandbox e configuração de produção não foram verificados; nenhum pagamento, deploy, push ou commit. Contagem: 113 corrigidos, 12 bloqueados/não verificados, 26 pendentes de 151.
### API-006 revalidado — 2026-11-15 (continua pendente)

- **Causa confirmada no estado atual:** `src/routes/_authenticated/painel.servicos.tsx` chama `saveServiceFn` e, em seguida, faz `DELETE` de `service_professionals` por `service_id`, seguido de `INSERT` dos vínculos escolhidos. Uma falha após o DELETE deixa a edição parcialmente aplicada; em cadastro novo, o serviço pode permanecer sem os vínculos pretendidos. Nenhum erro foi injetado nesta rodada.
- **Limite de transação existente:** `supabase/migrations/20260924070503_professional_links_atomic.sql` define `replace_professional_services`, que troca os vínculos de um profissional numa RPC transacional, mas não inclui criar/atualizar a linha de `services`; não é substituto direto para salvar o catálogo.
- **Escopo relacionado:** operações de categoria também persistem categoria e `services.category_id` em chamadas separadas (`src/components/painel/ServiceCategories.tsx`); a correção integral do API-006 precisa cobrir os dois fluxos ou delimitar formalmente o aceite.
- **Estado:** causa revalidada; correção pendente. Para garantir atomicidade real é necessária uma nova operação transacional no Postgres e migração aditiva, mais alteração dos chamadores e testes de rollback em banco local descartável. Nenhuma migration ou escrita de banco foi executada.
- **Contagem:** permanece sem alteração; este item não foi contado como corrigido nem como testado.

### API-006 corrigido localmente — 2026-11-15

- **Causa revalidada:** a tela de serviços gravava a linha e depois apagava/inseria vínculos de profissionais em requests separados. O diálogo de categorias também gravava categoria e `services.category_id` em requests separados.
- **Correção:** `save_service_with_professionals` grava/upserta serviço, substitui vínculos e retorna o ID numa única função PostgreSQL; `save_service_category_with_services` grava categoria e associa serviços numa única função. Ambas são `SECURITY INVOKER`, verificam owner e escopo de negócio, e preservam RLS. A remoção de categoria continua atômica pelo `ON DELETE SET NULL` existente.
- **Arquivos:** `supabase/migrations/20261115060341_save_service_with_professionals.sql`, `src/lib/services.functions.ts`, `src/lib/services.functions.test.ts`, `src/routes/_authenticated/painel.servicos.tsx`, `src/components/painel/ServiceCategories.tsx`, `src/integrations/supabase/types.ts`, `tests/db/service-professionals-atomic.test.ts`, `tests/db/service-category-atomic.test.ts`.
- **RED/GREEN:** o teste de `saveServiceForOwner` falhou antes da RPC (2 assertions), depois passou. Teste focal de serviços: 30/30. DB focal: 6/6, incluindo falha de INSERT depois do DELETE e trigger que falha após atualizar associação de categoria; em ambos os casos estado original permanece. Regressão: `npm test` 134 arquivos aprovados, 3 ignorados, 1.039 testes aprovados, 8 ignorados; `npm run test:db` 10 arquivos/99 testes aprovados; `npx tsc --noEmit` passou.
- **Limites:** migration validada somente no Postgres embutido descartável; não aplicada a Supabase remoto. Sem deploy, push, commit ou alteração de dados de produção. Contagem antiga 113/12/26 não alterada porque a lista compacta de 151 IDs ainda diverge; API-006 fica registrada como item adicional concluído localmente.
### PAY-031 revalidado e corrigido localmente — 2026-11-15

A causa documentada (“ignora o erro”) não existe mais no estado atual: `setPixKeyApprovalStatus` valida `unblockError` e rejeita com mensagem explícita após falha parcial; a rota mostra erro e não o toast de sucesso. Teste focal `src/lib/pix-approvals.functions.test.ts`: 2/2 (falha no segundo write e sucesso completo). A expectativa original aceita atomicidade **ou** comunicação clara do estado parcial; foi atendida a segunda alternativa. Residual: as gravações seguem em requests distintos e não são atômicas. Nenhuma chave, carteira ou serviço remoto foi alterado; item já constava no tally anterior e não altera a contagem.
### Ciclo 81 — PAY-014 corrigido localmente (2026-11-15)

- **Causa revalidada:** o worker e a sincronização por consulta confirmavam pagamentos `completed` sem comparar o valor bruto reportado pelo AgPay com `amount_cents`; a divergência contrariava a regra em `specs/005-ledger-financeiro-saldo/spec.md:147-149`.
- **Contrato verificado:** documentação pública oficial em `https://agpay.services/documentacao` apresenta `data.amount` em reais, inclusive no exemplo de webhook. O adaptador `fetchPayment` já retorna o campo `amount` da consulta de transação.
- **Correção:** webhook e consulta agora normalizam reais para centavos e comparam com depósitos e cobranças de assinatura antes de creditar ou renovar acesso. Valor divergente, inválido ou ausente impede a confirmação; webhook divergente é retido como `error`. Divergência encontrada na consulta cria evento `payment.amount_mismatch` em `agpay_webhook_events`. A tela Master de erros lista até 30 eventos `error` com motivo, tipo, referência, horário e tentativas, sem expor o payload.
- **TDD/evidências:** teste RED reproduziu confirmação automática com valor divergente antes da correção. Testes cobrem valor menor, valor ausente, assinatura divergente, assinatura compatível e consulta de status divergente; `agpay-events.server.test.ts` + `agpay-amount.test.ts`: 50/50. Privacidade de marca: 1/1. `npm test`: 135 arquivos aprovados, 3 ignorados; 1.057 testes aprovados, 8 ignorados. `npm run test:db`: 10 arquivos/99 testes aprovados. `npx tsc --noEmit` passou; `git diff --check` sem erros (avisos LF/CRLF preexistentes).
- **Limites:** contrato de valor em reais confirmado pela documentação, mas não houve chamada ao gateway nem validação de produção. Sem migração remota, dados reais, deploy, push ou commit. Revisão manual fica disponível na tela Master de erros para usuários Master.
- **Contagem dos 151 IDs:** PAY-014 passou de bloqueado para corrigido localmente: 114 corrigidos, 11 bloqueados/não verificados, 26 pendentes. API-006 continua como correção local adicional fora da lista compacta, sem alterar esse tally.
### Revalidação de PAY-009/PAY-011 e PAY-017 — 2026-11-15

- **PAY-009:** revalidado corrigido localmente. O server function exige PIN numérico de quatro dígitos e `createWithdrawal` recebe o PIN, verifica lock persistente/hash com o Admin client antes de reservar saldo ou chamar o AgPay. Teste de saque cobre PIN incorreto sem efeitos e casos de sucesso. Não houve saque real.
- **PAY-011:** revalidado corrigido localmente. Antes de registrar saque ou chamar o provedor, `createWithdrawal` procura aprovação `aprovado` associada ao negócio, tipo e chave PIX atualmente salvos. Os testes cobrem chave não aprovada e divergência de chave; 75 testes de saque, aprovação e pagamentos passaram neste ciclo. Não houve mudança de chave nem saque real.
- **PAY-017:** causa revalidada no caminho atual: cada chamada `createSubscriptionCharge` cria Pix no provedor antes de inserir a linha `pending`, sem localizar/reutilizar pendência nem impor unicidade por negócio/ciclo. A tabela não armazena QR para reapresentar e o fechamento/reabertura do modal continua chamando a criação. Nenhuma cobrança foi criada. A solução requer decisão de UX para recuperar a cobrança aberta e política para expiração/pagamento tardio; aguardando resposta antes de escolher esse comportamento.
### Revalidação de DEP-001 e SEC-016 — 2026-11-15

DEP-001 foi revalidado corrigido localmente: `npm ls zod --depth=0` reporta Zod 4.6.7; os arrays públicos de `chargeIds` e `publicCodes` têm máximo 50; `npm audit --omit=dev` retornou zero vulnerabilidades. Auditoria de dependências de desenvolvimento permanece fora deste item (DEP-003). SEC-016 segue corrigido localmente pela migration `20261114150000_restrict_business_owner_insert.sql`, que revoga INSERT/DELETE para `PUBLIC`, `anon` e `authenticated` e concede DML a `service_role`; não foi aplicada nem validada remotamente.
### Revalidação de BOOK-001 — 2026-11-15

A lacuna segue presente no código atual: `aguardando_sinal` permanece excluído dos filtros de conflito do booking e da exclusion constraint. O teste DB `business-only-appointment-overlap.test.ts` ainda aceita reservar o intervalo quando já existe uma reserva nesse status (4/4); `booking.functions.test.ts` passou 117/117, sem cobrir hold temporário. `specs/003-migracao-asaas-agpay/quickstart.md` exige preservar `cancelado` após um `deposit.completed` tardio, mas não define ação financeira/refundo para o pagamento tardio. A implementação de hold de 5 minutos exige alinhar a checagem de disponibilidade, proteção transacional e liberação após expiração; não mudei comportamento enquanto esse desenho e a política de pagamento tardio não forem aprovados. Nenhuma reserva ou pagamento foi criado.
### Revalidação de PAY-032/PAY-036 — 2026-11-15

A documentação oficial pública (`https://agpay.services/documentacao`) descreve `POST /cashout/pix` e um identificador `withdrawal.id` na resposta, mas não documenta chave idempotente, consulta de saque por essa referência ou garantias de que erro HTTP/timeout implique ausência de payout. Portanto PAY-032 segue aberto: a referência ainda é persistida após a chamada externa; sua perda em falha de escrita não tem recuperação oficial comprovada.

PAY-036 foi mitigado localmente: somente HTTP 422 e o marcador explícito `success:false` são classificados como rejeição definitiva; HTTP 5xx e HTTP 2xx incompleto mantêm o saque `processing` e o saldo reservado. Testes em `withdrawal.server.test.ts` cobrem 5xx e resposta 2xx sem referência, e `agpay.server.test.ts` cobre mapeamento; os dois arquivos passaram (50/50). Limite residual: não há contrato acessível que confirme se todo 422/`success:false` prova ausência de payout externo; nenhuma chamada de saque foi feita.
### Revalidação de acesso Supabase — 2026-11-15

O conector Supabase não lista o projeto `qagotnmdqjoodoudcikd`; a consulta de advisors retornou `permission denied`. Para seguir a instrução de leitura apenas por GET, usei as variáveis locais sem imprimir valores e consultei `businesses?select=id&limit=0` no host Supabase configurado; HTTP 200, sem solicitar linhas. Isso confirma API REST alcançável, mas não expõe/valida policies, migrations aplicadas, secrets, backups, logs ou dados; DB-002 e SEC-002 continuam inconclusivos. A automação Windows também falhou ao listar apps após duas tentativas e reset; PAY-006/ambiente de dashboard e status visual das instâncias INT-007 seguem não verificados. Nenhuma escrita remota foi feita.
### Revalidação de PAY-027 e BOOK-004 — 2026-11-15

PAY-027 permanece corrigido localmente: classificação usa `trial_days != null && !everPaid`; hook coleta pagamentos históricos pagos e a RPC de expiração exclui negócios com pagamento histórico pago. Migration aditiva local `20261114120000_fix_paid_trial_lifecycle.sql`; não aplicada remotamente. BOOK-004 permanece corrigido localmente: `isBusinessBookable` exige `status === "ativo"` e `!cancelled_at`; consultas/caminhos de catálogo e reserva aplicam essa condição. Nenhum estado remoto foi alterado; os itens já estavam no tally de corrigidos.
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

### Ciclo 86 — PAY-018 mitigado localmente — 2026-11-15

Quando AgPay cria o Pix e o insert local de `subscription_charges` falha, o servidor agora grava `subscription.charge_persist_failed` na inbox `agpay_webhook_events`, com referência, negócio e valor, status `error` e hash determinístico. A fila já é exibida ao Master. A mensagem ao usuário avisa que o Pix pode existir e orienta não pagar novamente. O QR e dados pessoais não são copiados para o evento. TDD: os dois testes novos falharam antes da mudança; depois, `subscription-charge.functions.test.ts` passou 15/15. `npx tsc --noEmit` passou; `npm test`: 136 arquivos passaram, 3 ignorados; 1.060 testes passaram, 8 ignorados. Tally dos 151 IDs: 116 corrigidos, 11 bloqueados/não verificados e 24 pendentes. Limite: se a gravação da cobrança e a inbox falharem simultaneamente, resta apenas o log do servidor; sem cancelamento ou chamada remota ao gateway/banco.

### Ciclo 87 — reconciliação de SEC-022 — 2026-11-15

O código atual e `src/lib/master/temporary-secret-state.test.ts` confirmam correção local já registrada no histórico: segredo temporário é vinculado ao `businessId`, ocultado/descartado ao fechar ou trocar de ficha, e resposta atrasada de outro negócio não é aplicada. Teste focal 1/1. Corrigi o índice de problemas e o relatório de segurança, sem reset real. Item já incluído no tally; 116 corrigidos/mitigados, 11 bloqueados/não verificados, 24 pendentes.

### Ciclo 88 — PAY-032 mitigado localmente — 2026-11-15

PAY-032 reproduzido com provider e DB fakes: quando o update de `withdrawals.provider_ref` falha após resposta sintética do AgPay, o comportamento anterior não criava referência revisável. Agora há upsert deduplicado de `cashout.reference_persist_failed` na inbox AgPay, com `withdrawal_id`, negócio e valor; a tela Master existente mostra a referência externa e o ID interno no motivo. A chave de idempotência existente impede nova chamada de payout no retry. RED antes; testes `withdrawal.server.test.ts` + `agpay.server.test.ts`: 51/51; `npx tsc --noEmit` passou. Não rodei suíte completa: há processo Node preexistente usando ~1,55 GB. Nenhum cashout ou escrita remota. Limite: falha simultânea no update e na inbox deixa a referência apenas no log; sem conciliação automática. Tally: 117 corrigidos/mitigados, 11 bloqueados/não verificados, 23 pendentes.

### Ciclo 89 — INT-011 corrigido localmente — 2026-11-15

Docs oficiais UazAPI confirmam envelope raiz `EventType`/`token`/`message` e não documentam `headers` no corpo de POST `/webhook`. RED reproduziu parser retornando `null` e rota recusando com 401. Parser e roteamento agora suportam campos normalizados e token raiz; rota valida token contra credencial de instância registrada, sem logá-lo, mantendo header compartilhado para Evolution. Configuração do adaptador usa campos documentados. Testes `whatsapp-greeting.server.test.ts`, `whatsapp-incoming.test.ts`, `uazapi.server.test.ts`: 33/33; TypeScript passou. Sem chamada ao provider nem mensagem. Provider/configuração de produção seguem sem verificação. Tally: 118 corrigidos/mitigados, 11 bloqueados/não verificados, 22 pendentes.

### Ciclo 90 — INT-003 mitigado localmente — 2026-11-15

A documentação UazAPI confirma que falhas de entrega não são reenviadas automaticamente. O webhook agora persiste cada mensagem recebida em fila com chave única antes do ACK; falha de persistência responde 503. Falhas transitórias do provider ficam pendentes com retry exponencial (até 10 tentativas), processadas no recebimento e pelo cron horário. Adicionei RLS/grants restritos e teste de unicidade. Focais de rota/cron 18/18, DB isolado 3/3 e `npx tsc --noEmit` passou. Sem migration remota, mensagem, deploy, push ou commit. Limite: indisponibilidade simultânea do banco impede persistir a mensagem e UazAPI não redelivera; itens após 10 falhas precisam de revisão. Tally: 119 corrigidos/mitigados, 11 bloqueados/não verificados, 21 pendentes.

### Ciclo 91 — DEP-002 mitigado localmente — 2026-11-15

Vite instalado/lockfile em 8.1.7, acima dos patches dos advisories atuais; removi `allowedHosts: true`, preservando `host: true` para testes locais por IP enquanto o default do Vite recusa domínios arbitrários. RED/GREEN de `src/vite-config.test.ts`: 1/1; `npm audit` não aponta Vite, mas mantém 7 moderadas de minimatch (DEP-003); `npm audit --omit=dev` reporta zero. Sem PoC, servidor de rede ou alteração remota. Item já constava como corrigido localmente; tally permanece 119 corrigidos/mitigados, 11 bloqueados/não verificados, 21 pendentes.

### Ciclo 92 — SEC-005 revalidado como corrigido localmente — 2026-11-15

Helpers de auditoria do lifecycle e do dossiê inspecionam o campo `error` de PostgREST e rejeitam a operação quando não conseguem gravar evento. As rotas de extensão de teste, alteração de acesso/cancelamento, mutations do dossiê e consulta de suporte usam o helper obrigatório; falha pós-mutation informa explicitamente que a alteração foi aplicada sem auditoria. Testes `dossier.functions.test.ts`, `dossier-mutations.test.ts`, `lifecycle.cancellation.test.ts`: 19/19. Limite: estado e evento não são uma transação única; sem dados reais/deploy. Tally: 119 corrigidos/mitigados, 11 bloqueados, 21 pendentes.

### Ciclo 93 — PAY-021 revalidado como corrigido localmente — 2026-11-15

Reconciliei a descrição original do achado com a correção existente: `dedupe_key` deriva do ciclo de acesso e título, índice único `(business_id, dedupe_key)` e upsert com `ignoreDuplicates` resolvem a corrida em PostgreSQL; novo vencimento permite novo aviso. Evidência anterior de RED/GREEN, dois inserts concorrentes e ciclo seguinte está em `pagamentos.md` (7 arquivos/89 DB tests à época). Migration não verificada em produção. PAY-021 já constava no grupo corrigido; tally permanece 119/11/21.


### Ciclo 94 — SEC-006 revalidado — 2026-11-15

assertSuperAdmin exige aal2 e consulta a role super_admin atual; login em AAL1 segue para o fluxo de TOTP. Os testes atuais\
equire-super-admin.test.ts e master-mfa.test.ts passaram 15/15. A documentação Supabase confirma que aal2 representa verificação adicional de fator; changelog consultado não mostrou breaking change relevante para esse fluxo. O conector Supabase lista somente outro projeto, sem acesso ao qagot; MFA real, usuários/fatores e deployment permanecem não verificados. SEC-006 já constava entre os corrigidos localmente; tally permanece 119/11/21.

### INT-004 — recuperação do aviso WhatsApp do sinal (2026-11-15)

RED reproduziu perda do aviso: o primeiro envio falhava após pagamento/ledger confirmados e a redelivery retornava `already_paid`. Adicionei outbox `deposit_payment_whatsapp_confirmations`, separada de `deposit_payments`, com RLS/grants apenas para `service_role`, claim atômico com lease de cinco minutos e retry pela inbox AgPay existente. Fila sent/skipped não reenfileira, e o crédito permanece idempotente. Testes focados AgPay/WhatsApp/webhook: 60/60; PostgreSQL isolado: 3/3 (claim, retry, privilégios); `npx tsc --noEmit` passou. Limite: não existe transação entre provider WhatsApp e banco; sucesso externo seguido de falha ao finalizar pode duplicar envio após o lease. Migrations/deploy não aplicados remotamente. Contagem: 120 corrigidos/mitigados, 11 bloqueados/não verificados, 20 pendentes de 151.
### UI-029 — gate de edição de cupom após falha de leitura (2026-11-15)

Revalidei a causa: um cupom alterado pelo Master afeta o valor de novas cobranças; erro/ausência de dados não pode equivaler a cupom desativado. `canEditBusinessCoupon` mantém o formulário e Switch ocultos até query bem-sucedida, e a UI mostra erro com retry. Teste do gate: 4/4 (loading, erro, ausência de dados e sucesso); regressão completa: 137 arquivos aprovados/3 ignorados, 1.070 testes aprovados/8 ignorados; TypeScript passou. Não injetei erro no browser nem alterei cupom. Contagem: 121 corrigidos/mitigados, 11 bloqueados/não verificados, 19 pendentes de 151.
### UI-040 — revalidação da correção de remarcação Elegance (2026-11-15)

A causa-raiz está corrigida no código: a consulta usa o profissional da reserva e a UI distingue falha da consulta de disponibilidade vazia, com retry. Teste do helper: 3/3; TypeScript passou; regressão completa recente: 137 arquivos/1.070 testes aprovados, 3 arquivos/8 testes ignorados. Sem jornada visual ou dados reais. Atualizei `frontend.md` e `problemas.md`; UI-040 já constava no tally de corrigidos, que permanece 121/11/19.
### PAY-038 — bloqueado por contrato externo de idempotência (2026-11-15)

Revalidei a migration `20260924124620_pix_rejection_release.sql`: `mark_deposit_pix_post_started` permite novo POST em `post_incerto` após dois minutos, sem `external_id`/chave enviados por `createPixCharge`. Consultei a documentação oficial `https://agpay.services/documentacao` (HTTP 200); ela mostra criação Pix com UUID/status/QR, mas não documenta idempotency key ou busca por uma chave estável. GET por UUID não recupera uma tentativa cujo UUID foi perdido no timeout. Não alterei o retry nem inventei suporte: bloquear indefinidamente sem mecanismo de revisão também pode deixar cobrança sem recuperação. Sem sandbox/contrato autenticado, correção está bloqueada. Nenhuma chamada autenticada ou cobrança. Reclassificado de pendente para bloqueado. Contagem: 121 corrigidos/mitigados, 12 bloqueados/não verificados, 18 pendentes de 151.
### UI-001 — reconciliação do índice canônico (2026-11-15)

O código atual usa `SubscriptionPaymentMethodSelector`, que expõe somente Pix; o teste confirma ausência de Cartão, PAN/CVV, CPF e inputs. Teste focado: 1/1 (a cobertura integrada anterior seletor + Pix é 2/2, registrada acima). Atualizei o estado em `frontend.md` e `problemas.md`; UI-001 já estava contabilizado. Sem cobrança ou deploy; tally segue 121 corrigidos/mitigados, 12 bloqueados/não verificados e 18 pendentes.
### PAY-037 — bloqueado pelo schema de recuperação de QR do AgPay (2026-11-15)

Revalidei o caminho local: após POST, `provider_payment_id` é persistido antes da validação do QR; sem QR, a função falha, e tentativas seguintes não repetem POST. O adapter consulta a transação, mas não mapeia código Pix. A página oficial AgPay (HTTP 200) mostra `pix_code`/`qr_code` na criação e menciona consulta por UUID, sem definir os campos retornados pelo GET nem comportamento para resposta de criação sem QR. Não implementei uma suposição de schema que pode não recuperar o código. Necessário contrato/sandbox do provider; nenhuma chamada autenticada ou cobrança. Reclassificado pendente→bloqueado. Tally: 121 corrigidos/mitigados, 13 bloqueados/não verificados, 17 pendentes de 151.
### PAY-001 — revalidação do split legado e bloqueio de produto (2026-11-15)

A hipótese original precisava de ajuste: controles e leitura de email/status de split não aparecem mais no Master. Ainda assim, `lifecycle.functions.ts` lê `agpay_split_status` e classifica `aprovada` como `cartao`; spec 004 define sinais recebidos pela plataforma e saque posterior, mas não define esse flag para assinatura. Sem confirmar se o método cartão continua suportado para assinaturas, alterar a classificação pode esconder um método válido ou exibir método incorreto. Nenhum dado/AgPay remoto consultado. Reclassificado como parcialmente mitigado e bloqueado por definição comercial. Tally: 121 corrigidos/mitigados, 14 bloqueados/não verificados, 16 pendentes de 151.
### PAY-007 — bloqueado por contrato de evento de estorno (2026-11-15)

Revalidei `isRefundEvent`: reconhece aliases candidatos de evento/status, sem fonte contratual local. A página oficial AgPay (HTTP 200) lista eventos de cobrança e saque, sem refund/chargeback ou schema; isso não prova que eventos adicionais não existam. Testes atuais cobrem o alias `transaction.refunded` e idempotência local, não o nome oficial. Não alterei aliases para evitar débito financeiro baseado em hipótese. Aguardar contrato escrito ou payload sandbox; nenhuma chamada financeira. Reclassificado pendente→bloqueado. Tally 121 corrigidos/mitigados, 15 bloqueados/não verificados, 15 pendentes de 151.
### PAY-008 — escopo de cartão em pagamentos não definido (2026-11-15)

Revalidei os fluxos de sinal e assinatura: adaptador de sinal cria somente Pix; selector de assinatura expõe Pix sem campos de cartão. As specs 003, 004 e 008 não definem adicionar cartão a essas jornadas; docs AgPay descrevem capacidade do gateway, não requisito do produto. Teste do selector 1/1. Não vou construir integração financeira sem escopo explícito. Bloqueado até definir se cartão entra em sinal, assinatura ou nenhum dos dois. Contagem 121 corrigidos/mitigados, 16 bloqueados/não verificados, 14 pendentes de 151.
### INT-009 — mitigação parcial de mensagem de teste e bloqueio de destino (2026-11-15)

RED confirmou que o handler aceitava telefone sem normalização, template arbitrário e chamadas ilimitadas. GREEN: cota 3/10 min por business via limiter em memória do processo único; telefone aceita somente formatação brasileira válida e é normalizado antes do provider; mensagem fixa é definida no servidor. `whatsapp.functions.test.ts` + `rate-limit.server.test.ts`: 13/13; `npm test`: 137 arquivos aprovados/3 ignorados, 1.071 testes aprovados/8 ignorados; TypeScript passou. Residual: qualquer número brasileiro válido continua destino, pois não existe número verificado/política; aguarda definição de produto antes de restringir. Sem envio real. Reclassificado pendente→bloqueado parcialmente mitigado. Contagem: 121 corrigidos/mitigados, 17 bloqueados/não verificados, 13 pendentes.
### DB-004 corrigido localmente (2026-11-15)

RED no PostgreSQL efêmero reproduziu aceitação de payment_id/withdrawal_id de outro business. Migration aditiva instalou triggers para validar tenant nas referências e impedir mudança de tenant de pagamentos/saques já referenciados; extrato passou a filtrar business nas consultas de detalhe. Teste focal DB 2/2; suíte DB 13 arquivos/107 testes; suíte completa 137 arquivos/1.071 aprovados, 3 arquivos/8 ignorados; TypeScript passou. Não verifiquei dados existentes nem apliquei migration remotamente. Contagem: 122 corrigidos/mitigados, 17 bloqueados/não verificados, 12 pendentes de 151.

### BOOK-001 parcialmente mitigado localmente (2026-11-15)

RED confirmou que as constraints do PostgreSQL aceitavam sobreposição com aguardando_sinal tanto para business sem profissional quanto para profissional. GREEN: booking.functions.ts considera o hold ocupado; migration 20261115110000_hold_booking_slots_for_deposit.sql reconstrói as duas exclusion constraints para bloquear aguardando_sinal e preservar cancelado/adjacências. Teste focal 5/5; booking 117/117; suíte DB 13 arquivos/108 testes; suíte geral 137 arquivos/1.071 aprovados, 3/8 ignorados; TypeScript passou. Migration não aplicada remotamente. O worker reconcilia expiradas consultando AgPay, mas frequência/deploy não verificados. Pagamento tardio após cancelamento ainda pode virar pago_sem_agendamento; política financeira/reembolso pendente. Mantido entre os bloqueados: tally 122/17/12.

### UI-032 revalidado como já contabilizado entre os corrigidos (2026-11-15)

O código usa calendarWeekDays(cursor) na grade; o helper deriva o domingo inicial do cursor e retorna sete dias. moveCursor altera a semana e cabeçalho/totais derivam do mesmo cursor. Teste receivables-calendar.test.ts: 2/2 aprovados. Sem QA visual ou dados reais. UI-032 já estava na lista de corrigidos; tally naquele momento permaneceu 122/17/12.

### PAY-030 revalidado corrigido localmente (2026-11-15)

A chain inicial permitia CRUD ao owner. Migration 20261114204014_restrict_subscription_payment_writes.sql remove policy de escrita e preserva leitura autenticada e DML via service_role. Teste security-hardening.test.ts 54/54 cobre leitura, recusa de INSERT/UPDATE/DELETE do owner e INSERT service_role. Sem dados ou migration remota. Tally: 123 corrigidos/mitigados, 17 bloqueados/não verificados, 11 pendentes de 151.

### SEC-012 revalidado (2026-11-15)

Migration 20261114232840_restrict_anon_time_blocks.sql remove SELECT de anon e policy pública. Teste DB security-hardening.test.ts confirma anon recebe permission denied, owner lê e outro owner não vê a linha; suíte focal 54/54. Disponibilidade pública continua server-side por admin. Sem dados reais/migration remota. SEC-012 já estava contabilizado como corrigido; tally permanece 123/17/11.### SEC-013 revalidado (2026-11-15)

A chain local aplica a migration 20261114233557_restrict_visual_asset_reads.sql: leitura de assets publicados exige membership; staging exige manage_appearance e UUID de usuário do path igual a auth.uid(). security-hardening.test.ts cobre owner, outro negócio e profissional autorizado; suíte focal 54/54. Sem objetos reais nem migration remota. SEC-013 já estava contabilizado como corrigido; tally permanece 123/17/11.
### SEC-015 revalidado corrigido localmente (2026-11-15)

A migration 20261114150000_restrict_business_owner_insert.sql revoga DELETE de authenticated e mantém a exclusão pela via service_role/Master. Acrescentei regressão DB: tentativa do owner falha e a linha business permanece. security-hardening.test.ts 55/55. Nenhum negócio real alterado; migration remota não verificada. Tally: 124 corrigidos/mitigados, 17 bloqueados/não verificados, 10 pendentes de 151.

### BOOK-011 revalidado corrigido localmente (2026-11-15)

`toIso` calcula offsets candidatos e valida round-trip no fuso; horários inexistentes/ambíguos são rejeitados. `booking.functions.test.ts` cobre transições DST de entrada/saída e filtragem; 117/117 passaram. Sem configuração ou reserva real consultada. BOOK-011 contabilizado como corrigido. Tally: 125/151 corrigidos/mitigados, 17 bloqueados/não verificados, 9 pendentes.

### API-003 revalidado corrigido localmente (2026-11-15)

Transições de/para bloqueado exigem `block_schedule`; `setAppointmentStatus` checa `has_business_permission` antes da gravação service_role e atualiza condicionalmente ao status anterior. `appointments.functions.test.ts` 6/6 cobre bloqueio/reabertura. Nenhum uso real ou policy remota verificado. Tally: 126 corrigidos/mitigados, 17 bloqueados/não verificados, 8 pendentes de 151.


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
### DEP-001 corrigido localmente — revalidação 2026-11-15

Arquivos conferidos: `package.json`, `package-lock.json`, `node_modules/zod/package.json`, `src/lib/professionals.functions.ts`, `src/lib/services.functions.ts` e respectivos testes. Zod 4.6.7 excede o patch mínimo 4.6.6 do advisory oficial GHSA-mrhx-c7xc-m3w5; `workingDays`, `serviceIds` e `availableDays` têm limites, com regressões específicas. `npx vitest run src/lib/professionals.functions.test.ts src/lib/services.functions.test.ts`: 2 arquivos/50 testes passaram. Sem payload de exaustão ou alteração remota; versão implantada não verificada. DEP-001 já fazia parte da lista de corrigidos localmente; tally 128/17/6 sem alteração e ainda não reconciliado item a item.

### DEP-007 — estado de produção segue sem revalidação — 2026-11-15

Inspeção atual somente leitura via SSH em modo não interativo foi recusada (`Permission denied`); não existe alias SSH local. A evidência de 401 e divergência do segredo permanece limitada à inspeção de 13/11. Não consultei filas/logs atuais nem executei workers. DEP-007 permanece não verificado quanto à correção e impacto atual; já integra os bloqueados/não verificados. Tally reportado 128/17/6 sem alteração, ainda não reconciliado item a item.

### BOOK-003 revalidado corrigido localmente — 2026-11-15

`computeAvailableSlots` propaga erros nas consultas de `time_blocks` e `appointments`; a checagem final de conflito também falha fechada. `npx vitest run src/lib/booking.functions.test.ts`: 1 arquivo/117 testes aprovados, incluindo as três falhas e ausência de inserts de reserva/cobrança. Sem DB real ou versão implantada. BOOK-003 já estava contabilizado entre os corrigidos; tally reportado 128/17/6 não mudou e segue sem reconciliação item a item.

### PAY-027 revalidado corrigido localmente — 2026-11-15

O lifecycle usa `trial_days != null && !everPaid`; a RPC lê `subscription_payments` e `subscription_charges` pagos para não tratar trial histórico como trial atual. Testes: hook `subscription-lifecycle.test.ts` 10/10; casos DB direcionados a pagamentos pagos 2/2. Migration `20261114120000_fix_paid_trial_lifecycle.sql` permanece somente local. PAY-027 já constava entre corrigidos; tally reportado 128/17/6 sem mudança e ainda não reconciliado item a item.

### PAY-022 revalidado corrigido localmente — 2026-11-15

O cron `subscription-lifecycle` carrega negócios por `fetchAllPages`, ordena por `id` e usa páginas de 1.000; erros em página abortam antes do run log. Teste focal `subscription-lifecycle.test.ts -t 'paginates all businesses'`: passou 1/1; fixture de 1.001 negócios confirma a segunda faixa e `businesses_scanned: 1001`. O mesmo arquivo cobre página com erro, mas esse caso não foi repetido nesta rodada. Produção não verificada. PAY-022 já estava entre corrigidos; tally 128/17/6 sem alteração, ainda não reconciliado item a item.

### PAY-029 revalidado corrigido localmente — 2026-11-15

O handler grava `status='estornado'` e `provider_status` depois do débito idempotente do ledger; a atualização é condicional e verifica estado concorrente. Os agregadores separam pagos e estornados/volume bruto. Testes focais de `agpay-events.server.test.ts`, `business-intelligence.test.ts`, `agpay-performance.functions.test.ts`, `admin.functions.test.ts` e `transactions.functions.test.ts`: 5 arquivos/86 testes aprovados. Sem webhook real. Semântica oficial de evento/chargeback e retenção de comissão permanecem fora do escopo local e dependem de contrato/regra comercial (PAY-007). PAY-029 já estava contabilizado como corrigido; tally reportado 128/17/6 sem alteração, não reconciliado.

### BOOK-005 revalidado parcialmente mitigado — 2026-11-15

`reserveBooking` já tenta cancelar o appointment `aguardando_sinal` quando falha o INSERT de `deposit_payments`; se a compensação também falha, retorna erro explícito, mas deixa estado sem reconciliação durável. `booking.functions.test.ts` passou 117/117 nesta sessão e cobre compensação bem-sucedida e falha dupla. Fechamento recomendado: RPC transacional server-only para gravar appointment + intent de depósito atomicamente. Como altera a fronteira de persistência no banco, pedi alinhamento ao usuário; sem código/migration até resposta. Tally não alterado (128/17/6 reportado, não reconciliado).

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

The scoped npm override now resolves `minimatch@11.0.1` only beneath `@typescript-eslint/typescript-estree`; ESLint's separate `minimatch@3.1.5` remains unchanged. A new compatibility check failed against 10.2.6 before the override and passed after it, including the named matcher call used by typescript-estree. Targeted ESLint parsing passed with only the unrelated Prettier rule disabled; `npx tsc --noEmit` passed; `npm audit --json` reports zero vulnerabilities. The latest published `@typescript-eslint/typescript-estree@8.72.2` still declares `^10.2.2`, although upstream merged its 11.0.1 update on Nov 10. Keep the scoped override until a fixed upstream release is published, then remove it. No runtime dependency, production data, deploy, push, or commit changed. Global tally remains historical and unreconciled.

### PAY-033 revalidado e permanece bloqueado ? 2026-11-15

Flow review confirmed that `pixExternalStep` converts any `createPixCharge` error to generic `Error`, and the claim ends as `falhou`; the migration permits immediate retry only for `rejeitado`. Current public search for AgPay error/idempotency docs returned no results; known documentation URLs were inaccessible. No code change, gateway call, payment, production mutation, or external test.


### DB-002 revalidado por SQL read-only ? 2026-11-15

Arquivos: `docs/auditoria-agenda-agora/banco-de-dados.md`, `docs/auditoria-agenda-agora/seguranca.md`, `docs/auditoria-agenda-agora/problemas.md`, `docs/auditoria-agenda-agora/checkpoint.md`. Revalidei o acesso local indicado pelo HANDOFF: `DATABASE_URL` no `.env`, consulta em PostgreSQL com `default_transaction_read_only=on`, `BEGIN READ ONLY` e `ROLLBACK`. Obtidos 62 migrations remotas ate `20261108122836`, comparados com 90 arquivos SQL locais: 38 versoes locais ausentes do registro remoto e 9 versoes remotas sem arquivo local. Catalogo mostrou RLS nas 39 tabelas publicas consultadas. Nenhuma linha de negocio foi lida. MCP negou migrations e advisors. Resultado: schema/policies/migration history parcialmente verificados; advisors, logs e configuracao operacional continuam sem acesso. Nao aplicar migrations; reconciliar drift antes de qualquer rollout.

### SEC-009/SEC-010 revalidados contra policies remotas ? 2026-11-15

Policies atuais lidas em `pg_policies`: `customers_professional_read` e `appointments_professional_read` autorizam todas as colunas da linha por `is_business_member(business_id)`; `services_member_read` usa a mesma condicao; `businesses_professional_read` autoriza profissionais ativos a ler a linha completa. RLS nao limita projecao de colunas. Isso confirma o risco estrutural de acesso amplo descrito nos itens, mas nao define os campos que cada funcao/profissional deve receber. Mantidos bloqueados ate o contrato de campos/projecoes e migracao de consumers; nenhuma policy foi alterada. SQL read-only, sem linhas de negocio.


### SEC-002 advisors e SEC-009/010 policies remotas ? 2026-11-15

Acesso read-only ao catalogo confirmou RLS habilitado em 39 tabelas publicas. `customers_professional_read` e `appointments_professional_read` usam `is_business_member(business_id)`; `services_member_read` tambem, e `businesses_professional_read` permite leitura da linha inteira a profissional ativo. RLS nao projeta colunas, confirmando estruturalmente SEC-009/010. Nao foi lido conteudo de negocio. Ferramentas MCP continuam negando advisors e migrations; SEC-002 fica parcial. Nao alterei policies nem tentei aplicar as 38 migrations locais ausentes, pois existem 9 versoes remotas sem arquivo correspondente no repo.


### INT-007 revalidado ? provider runtime continua desconhecido ? 2026-11-15

Arquivos conferidos: `src/lib/whatsapp-provider.server.ts`, `src/lib/evolution.server.ts`, `.env` (somente nomes/estado das variaveis), `docs/auditoria-agenda-agora/integracoes.md`. O `.env` local tem `UAZAPI_BASE_URL`/token/admin token, mas nao define `WHATSAPP_PROVIDER`; codigo local seleciona UazAPI por padrao e nao tem URL/chave Evolution. O snapshot de producao de 13/11 registrava Evolution e duas instancias desconectadas. Isso revela divergencia entre configuracao local e historico de producao, sem provar o estado do processo atual. SSH ao host continua negado; nenhum endpoint de provider foi chamado e nenhuma mensagem enviada. INT-007 permanece bloqueado quanto ao estado atual e associacao business/instancia.


### Atualizacao do handoff ? continuidade 2026-11-15

- INT-007 segue inconclusivo: snapshot de 13/11 observou Evolution; `.env` local atual seleciona UazAPI por padrao, sem credenciais Evolution. Isso nao prova o provider de producao; SSH ao host negado e nenhum provider consultado.
- DB-002 teve metadata read-only parcial; drift remoto/local de migrations esta documentado. Nao aplicar migration ate reconciliar as 38 versoes locais ausentes e as 9 remotas sem arquivo local.


### PAY-005 revalidado ? contrato local de headers passou (2026-11-15)

Causa confirmada no historico: o adaptador omitia `X-Client-ID` mesmo configurado; spec 003 exige `Accept: application/json` e deixa `X-Client-ID` opcional ate confirmacao com o responsavel do gateway. Codigo atual encaminha Client ID quando presente, mantem modo Bearer sem ele, encaminha pelo proxy e trata 3xx como erro. `npx vitest run src/lib/agpay.server.test.ts`: 14/14. GET read-only anteriormente registrado respondeu 200 com e sem Client ID. Nenhum POST financeiro; sandbox e runtime de producao continuam nao verificados. PAY-005 corrigido localmente, sem alegar validacao externa.


### SEC-007 revalidado ? PIN server-side depende de politica aprovada (2026-11-15)

Arquivos: `src/lib/pix-approvals.functions.ts`, `src/lib/pix-approvals.functions.test.ts`, `src/routes/_authenticated/painel.pix-aprovacao.tsx`, `src/components/master/SecurityPinModal.tsx`. As tres Server Functions usam `assertSuperAdmin`, mas nao exigem proof do PIN da UI. SEC-006 exige AAL2 nesse guard; nao tratar como acesso sem autorizacao. `npx vitest run src/lib/pix-approvals.functions.test.ts`: 2/2 com mocks, sem PIN server-side na chamada de aprovacao. Nenhuma escrita real. Sem decisao de que o PIN adicional e requisito de autorizacao, nao adicionar token/step-up novo. SEC-007 permanece condicional e pendente dessa regra.


### AgPay ? busca adicional de contratos sem resultado verificavel (2026-11-15)

Pesquisei no dominio oficial os contratos de idempotencia/external_id de Pix, recuperacao de QR, erros de POST, cashout/withdrawal, refund e chargeback; a busca retornou vazia. As URLs de documentacao conhecidas tambem falharam ao abrir em tentativa anterior. Isso nao prova ausencia do contrato, mas nao fornece evidencias para mudar comportamento de retry/estados. Relaciona-se a PAY-007/017/032/033/035/037/038. Sem chamada externa ou mutacao; avancar para outros itens independentes.


### DEP-007 ? logs do Supabase continuam inacessiveis (2026-11-15)

Nova tentativa read-only via `supabase_query_logs` para listar somente `source` nos logs das ultimas 24h retornou `You do not have permission`. Com a negacao anterior de SSH nao interativo, nao foi possivel verificar cron, fila ou workers atuais. Evidencia de 401 em 13/11 continua historica. Sem leitura de segredo, chamada de worker, reprocessamento ou mutacao. DEP-007 permanece nao verificado.


### DEP-007 ? agregados atuais confirmam inbox antiga pendente (2026-11-15)

SQL PostgreSQL via `DATABASE_URL`, com `default_transaction_read_only=on`, `BEGIN READ ONLY` e `ROLLBACK`; somente agregados sem payload/IDs/linhas de negocio. Resultado: 2 eventos `agpay_webhook_events` em `pending`, recebidos 05/11 19:07Z a 06/11 00:14Z, max attempts 0; `post_service_message_queue` vazia; `reminder_logs` vazia; ultimo `subscription_lifecycle_runs` em 03/11 18:03Z, ~1s, 1 business, zero notices/cancellations. A evidencia confirma fila antiga sem tentativas e falta de registros recentes desses workers, mas nao estabelece causa. Supabase MCP logs e SSH permanecem negados. Nao executar worker nem reprocessar sem plano de reconciliacao; nenhuma mutacao.


Revalidacao complementar DEP-007: consulta read-only a `pg_extension` nao encontrou `pg_cron` nem `pg_net`; nao ha agenda via essas extensoes neste banco. Isso nao identifica cron externo em host/plataforma. Sem leitura de comando/segredo ou mutacao.

### SEC-014 corrigido localmente - 2026-11-15

RED confirmou SELECT anon em `business_hours`. A migration `20261115113000_restrict_anon_catalog_reads.sql` revoga grants anon de tabela/coluna em sete tabelas do catalogo e remove policies anon correspondentes. `/agendar/$slug` carrega o catalogo por slug via Server Function com `service_role`; nao ha rota de diretorio neste repo. GREEN: `security-hardening.test.ts` 57/57 e `booking.functions.test.ts` 117/117, no banco descartavel. Sem aplicacao remota, deploy, push ou commit. Tally legado 128/17/6 permanece nao reconciliado.


### SEC-021 revalidado - 2026-11-15

`npx vitest run -c vitest.db.config.ts tests/db/service-category-tenant-integrity.test.ts`: 2/2. Constraint composta `(category_id, business_id)` impede vinculo cruzado; excluir categoria de B nao altera servico de A, e excluir categoria propria limpa apenas `category_id`. A migration aborta antes de mudar constraints se houver vinculos cruzados legados. Ensaio descartavel; migration remota nao verificada.


### BOOK-010 revalidado - 2026-11-15

`getOpenDays` propaga falha de leitura de `businesses` e `business_hours` em vez de retornar agenda vazia. Teste focal `npx vitest run src/lib/booking.functions.test.ts -t 'getOpenDays: consulta indisponivel'`: 2/2. Sem acesso remoto; produ??o n?o verificada.


### DEP-007 - causa de producao confirmada por leitura (2026-11-15)

SSH read-only ao host `srv2024818` confirmou `agenda-agora_app` 1/1 healthy (up 3 dias) e `agenda-agora_cron` 1/1 running (up 4 semanas; zero reinicios no container atual). O cron invoca `/api/public/hooks/agpay-events` a cada minuto e `/api/public/hooks/whatsapp-reminders` a cada hora. Agregados dos ultimos 24 h: 1.440 respostas HTTP 401 em AgPay e 24 em lembretes; o cron registrou `FALHOU` em cada tentativa. A variavel `AGENDA_CRON_SECRET` existe nos dois containers, mas os valores diferem; o app nao tem `AGENDA_CRON_SECRET_PREVIOUS`. Comparacao feita sem imprimir nem registrar valores/hash. Causa confirmada: secret divergente entre cron e app. Nenhum secret/container foi alterado; correcao exige alinhar a configuracao no deploy e recriar/reimplantar o servico, depois validar respostas 2xx.


### PAY-033 corrigido localmente com contrato oficial (2026-11-15)

A pagina oficial `https://agpay.services/documentacao` responde HTTP 200 e lista 400 (Bad Request), 401 (nao autenticado), 403 (acesso negado), 404 (nao encontrado), 422 (erro de validacao) e 500 (erro interno). `pixExternalStep` agora preserva uma classificacao interna: 400/401/403/404/422 marcam a tentativa como `rejeitado`, permitindo retry controlado; 3xx, 5xx e falhas sem resposta permanecem `falhou`/`post_incerto`, sem novo POST imediato. RED: cinco casos documentados liberavam incorretamente como `falhou`; GREEN: `booking.functions.test.ts` 124/124, incluindo 302/500 ambiguos; `npx tsc --noEmit` passou. Nenhuma chamada autenticada ao gateway ou pagamento real. Sem validacao de runtime de producao.


### Reconciliacao item a item - 2026-11-15

Os 151 IDs canonicos da tabela `problemas.md` foram classificados a partir do estado/evidencia mais recente: 121 corrigidos, mitigados ou resolvidos localmente/no runtime observado; 30 bloqueados ou nao verificados; 0 sem triagem. O tally historico 128/17/6 foi substituido. Bloqueios restantes separam decisoes de produto, contrato AgPay ausente, drift de migrations, acesso ao painel expirado e remediacao DEP-007 que exige mudanca de configuracao/redeploy em producao. Nenhuma configuracao de producao foi alterada.


### Quatro IDs can?nicos ausentes da consolida??o inicial - 2026-11-15

- **PAY-002:** bloqueado por politica de comissao percentual/fixa; spec 005 define baseline 0%, PAY-015 deixa taxa fixa divergente.
- **PAY-035:** bloqueado por contrato de eventos/transicoes de saque ausente; docs AgPay listam `withdrawal.pending` e `withdrawal.completed`, sem `failed/rejected`.
- **SEC-001:** rate limit em memoria; runtime observado esta em 1 replica e processo ativo ha 3 dias. Mitigado na topologia atual; risco volta com escala horizontal ou reinicios frequentes.
- **UI-015:** bloqueado por regra contabil nao definida; relatorio usa preco atual do catalogo para receita historica.

Com esses registros, os 151 IDs canonicos do indice estao cobertos; os aliases historicos API-001/009, DB-001 e UI-012 continuam referencias, nao IDs adicionais. Tally atual permanece 121/30/0.

## Fechamento final — 2026-11-15

Este bloco substitui os diagnósticos anteriores de DEP-007, INT-007 e DB-002 neste checklist. A exclusão de PAY-006 é intencional, conforme instrução do usuário.

- **Tally:** 151 IDs canônicos; 122 corrigidos/mitigados ou resolvidos localmente/no runtime observado; 29 bloqueados/não verificados; 0 sem triagem. Todos os 151 IDs seguem cobertos.
- **DEP-007:** serviço Swarm cron 1/1, secret alinhada à do app e chamadas posteriores retornando 2xx. O worker reconciliou seis depósitos já vencidos como expirados (nenhum pago) e moveu dois eventos sem registro local para erro/revisão. Persistência da configuração após futuro redeploy EasyPanel não confirmada.
- **DB-002:** consulta read-only via CLI confirmou 62 migrations remotas e 100 arquivos locais. Foram recuperados os nove SQLs remotos ausentes; agora 0 versões remotas estão sem arquivo. Os 38 arquivos locais sem versão remota são 18 históricos/renumerados e 20 migrations novas, locais e não commitadas. Nenhuma migration foi aplicada; não executar `db push` enquanto os históricos antigos e o rollout das 20 novas não forem fechados.
- **INT-007:** API Evolution retornou 200; duas instâncias estão desconectadas (`close`), e só uma das duas credenciais privadas do banco corresponde a instância existente. Reconectar exige escanear QR no WhatsApp do negócio.
- **SEC-002/009/010:** consulta read-only confirmou as policies/grants amplos em `customers` e `businesses`; advisors do Supabase seguem sem permissão MCP. Não alterei policies.
- **AgPay:** a documentação pública confirma eventos `withdrawal.pending`/`withdrawal.completed`, mas não documenta idempotência, recuperação do QR por consulta, refund/chargeback nem transições `withdrawal.failed/rejected`. Regras comerciais/contábeis sem decisão registrada permanecem sem alteração.
- **Produção:** apenas a variável do serviço cron foi alinhada. Não houve alteração de app, schema Supabase, cobrança, commit ou push.

# Pagamentos, split e comissões

**Escopo:** primeiro ciclo de auditoria estática; produção ainda não foi verificada. Nenhuma operação financeira foi executada.

## Contrato encontrado e gateway ativo no código

A spec 003 descreve a migração Asaas → AgPay com criação de cobrança contendo `splits` por e-mail e percentual. A spec 004 muda o modelo: o sinal é recebido integralmente pela conta da plataforma e o saldo do estabelecimento é pago posteriormente por saque Pix. A spec 008 confirma que não se pretende trocar o gateway nesta fase. No código atual, `src/lib/agpay.server.ts:11-13` fixa a API AgPay e `:158-181` cria Pix sem enviar `splits`. O endpoint de webhook é AgPay (`src/routes/api/public/agpay-webhook.ts`).

Não foi encontrado adaptador ativo de Asaas ou RGPay na busca em `src/` e migrations atuais. Asaas aparece em migrations históricas (`20260918010000...`, `20260926100655...`) e em dados/modelos renomeados; isso não demonstra integração ativa. Nenhuma ocorrência operacional de RGPay foi encontrada no runtime pesquisado.

## Achados

### PAY-001 — Flag de split legado ainda classifica método de recebíveis

- **Status (2026-11-15):** parcialmente mitigado; decisão do significado de `agpay_split_status` na classificação de recebíveis aguarda definição de produto.
- **Gravidade:** P2 (risco de decisão/configuração financeira incorreta).
- **Módulo:** pagamentos / administração Master.
- **Esperado:** o painel e os estados apresentados devem representar o modelo financeiro vigente (recebimento pela plataforma e saque posterior), conforme spec 004.
- **Observado:** removidos do painel Master os controles e leituras de `agpay_split_email`/`agpay_split_status`; a consulta Master mantém a comissão percentual. O campo legado `agpay_split_status` ainda é lido em `src/lib/lifecycle.functions.ts:333-336,354` e mapeia `aprovada` para método `cartao` no calendário de recebíveis. `createPixCharge` não envia splits. A spec 004 documenta recebimento integral do sinal na plataforma e saque posterior, mas não define se a classificação de cartão para cobrança de assinatura ainda deve depender desse flag legado.
- **Impacto:** o estado antigo pode classificar recebíveis como cartão; sem regra atual para cartão em assinatura, não é possível afirmar se o rótulo está incorreto ou se representa disponibilidade legada de método.
- **Causa-raiz:** o controle de split foi removido do Master, mas o campo compartilhado continua usado para classificar método de recebimento; o escopo comercial dessa classificação não está definido nas specs encontradas.
- **Reprodução segura:** inspeção de leitura do formulário, função Master, adaptador Pix e migration; não requer gateway.
- **Bloqueio:** definir se `agpay_split_status` ainda habilita cartão em assinaturas ou se o calendário deve exibir apenas Pix/Pix automático. Não remover a leitura nem alterar o rótulo antes dessa definição; nenhum fluxo de cartão foi testado contra o AgPay.
- **Validação realizada:** leitura das migrations versionadas, `admin.functions.ts`, `painel.master.tsx`, `lifecycle.functions.ts` e spec 004. Nenhum dado, cobrança ou gateway remoto foi consultado nesta revalidação.
- **Referências:** [spec 004](../../specs/004-entrega-final-plataforma/spec.md), `src/lib/admin.functions.ts`, `src/lib/lifecycle.functions.ts:333-354`, `src/lib/agpay.server.ts:158-181`.

### PAY-002 — Comissão percentual pode permanecer em 0%

- **Status:** comportamento confirmado; registros atuais consultados. 0% consta como linha de base comercial na spec 005; aplicação de taxa fixa segue divergente/conflitante com PAY-015.
- **Gravidade:** P2 (risco de perda de receita da plataforma, se comissão percentual for devida).
- **Módulo:** ledger e configuração Master.
- **Esperado:** taxa configurada no negócio deve ser explícita, validada e refletida no ledger conforme contrato comercial.
- **Observado:** o fallback de listagem Master define `agpay_commission_percent: 0` quando a coluna está ausente (`src/lib/admin.functions.ts:42-57`); a criação de negócio também usa zero (`:47-52`); o formulário inicial usa "0" (`src/routes/_authenticated/painel.master.tsx:109-116`). Ao confirmar pagamento, `freezePaymentBreakdown` lê o percentual atual do negócio e congela snapshot (`src/lib/agpay-events.server.ts:77-120`). A spec 005 modela comissão no razão; a spec 004 afirma que saldo do dono desconta a comissão da plataforma.
- **Impacto:** com taxa percentual 0, a retenção percentual calculada é zero; se a comissão fixa de R$ 0,25 da spec 005 ainda valer, a implementação atual também não a cobra (PAY-015). O snapshot consultado dos quatro negócios não contém depósito pago, então não há comissão efetivamente perdida demonstrada para eles.
- **Causa-raiz:** a configuração e o código permitem zero percentual; spec 005 registra que 0% era o padrão comercial geral, enquanto a política fixa foi alterada/retirada em comentário de código posterior sem decisão formal conciliada.
- **Reprodução segura:** cálculo unitário/local com taxa zero e revisão do snapshot; nenhum acesso a negócio real.
- **Correção recomendada para spec futura:** explicitar política, defaults e guarda de ativação; exigir confirmação operacional antes de processar um negócio com taxa não configurada, se o contrato exigir comissão.
- **Regressão necessária:** cálculos com zero/positivo/limites, snapshot imutável, alteração posterior não reescreve pagamentos antigos.
- **Referências:** [admin.functions.ts](../../src/lib/admin.functions.ts:42), [painel.master.tsx](../../src/routes/_authenticated/painel.master.tsx:109), [agpay-events.server.ts](../../src/lib/agpay-events.server.ts:77), [spec 004](../../specs/004-entrega-final-plataforma/spec.md:17), [ledger migration](../../supabase/migrations/20260929120000_ledger_wallet.sql:85).

### PAY-003 — Quatro estabelecimentos ativos exibem split legado pendente e 0%

- **Status:** estado dos quatro registros confirmado por leitura somente; causa semântica esclarecida em parte; política da taxa fixa do produto continua em PAY-015.
- **Gravidade:** P2 para consistência/admin e política de cobrança; nenhum depósito pago nem comissão perdida foi encontrado nesses registros.
- **Módulo:** configuração financeira por estabelecimento.
- **Comportamento observado:** em 14/11/2026, GET somente de `businesses` via `.env` retornou exatamente quatro linhas (`Content-Range: 0-3/4`): as quatro têm `status=ativo`, `agpay_split_status=pendente`, `agpay_split_email` nulo e `agpay_commission_percent=0`. O relatório guarda apenas contagens; nenhum nome, ID ou e-mail foi exibido.
- **Histórico de pagamentos consultado:** as quatro linhas correspondem a 10 registros em `deposit_payments`: 6 `pendente`, 4 `expirado`, 0 pago; não há snapshot de comissão paga. A consulta por `business_id` em `ledger_entries` retornou zero lançamentos. A resposta completa indicou `0-3/4` para negócios, `0-9/10` para depósitos e `*/0` para ledger.
- **Impacto observado:** os dados confirmam o relato de configuração, mas não confirmam split financeiro quebrado nem perda de comissão realizada. Nesta arquitetura, split por negócio não é enviado na criação Pix (PAY-001); spec 004 diz que recebimento integral pela plataforma e saque posterior substituem split, e que e-mail de divisão deixou de ser requisito para cobrar. O `pendente`/e-mail nulo é, portanto, estado legado sem efeito de roteamento no código atual.
- **Comissão:** a spec 005 registra 0% como linha de base para todos os negócios; por isso 0% nesses quatro não demonstra onboarding incompleto por si só. A mesma spec registra comissão fixa de R$ 0,25, que diverge do cálculo atual (R$ 0,00 fixo; PAY-015). Como não há depósito pago nos 10 registros consultados, nenhum valor de comissão faltante foi demonstrado nesses quatro.
- **Conclusão:** o relato dos quatro casos é verdadeiro quanto aos campos exibidos, mas a interpretação de “split pendente = falha de repasse” é incompatível com o modelo 004 atual. O e-mail de split está ausente, porém já não é exigido pela spec 004. A única pendência financeira concreta relacionada é decidir/confirmar a política fixa do PAY-015 e consultar o Dashboard AgPay; não atribuir perda sem transação paga e regra comercial vigente.
- **Reprodução segura:** leitura REST GET somente, com chave `service_role` do `.env`; consultas selecionaram apenas status, comissão, split e e-mail para cálculo em memória, sem imprimir IDs/PII. Nenhum POST/UPDATE/DELETE, gateway ou dado foi alterado.
- **Próximo passo:** conferir com o responsável comercial se a comissão fixa do PAY-015 foi formalmente retirada e, quando houver novo depósito pago, validar o snapshot/ledger sem movimentar fundos nesta auditoria. Dashboard AgPay continua sem leitura.

### PAY-004 — Identificação do gateway/documentação operacional

- **Status:** código confirmado como AgPay; configuração em runtime e gateway de produção inconclusivos.
- **Gravidade:** P1 para continuidade da investigação.
- **Evidência:** API base hardcoded em `src/lib/agpay.server.ts:11-13`; chamadas com bearer em `:36-56`; webhook em `src/routes/api/public/agpay-webhook.ts`. `ASAAS_*` e tabelas Asaas são históricas nas migrations antigas; spec 003 registra migração e a 004 decide recebimento integral e saque.
- **Limitação:** não houve credencial/consulta de ambiente, logs ou dashboard AgPay. Docs internas podem estar desatualizadas; contrato atual da API precisa ser conferido na documentação primária do provedor.

## Fluxo financeiro estático mapeado

1. Adaptador cria cobrança Pix no AgPay; o corpo não inclui split.
2. Webhook recebido valida HMAC SHA-256 com `AGPAY_API_TOKEN`, usando comparação de tempo constante (`src/lib/agpay.server.ts:257-275`) e persiste inbox por SHA-256 do corpo (`agpay-events.server.ts:233-255`).
3. Worker processa lote de até 25; evento completed confirma depósito, congela breakdown e chama crédito do ledger (`agpay-events.server.ts:568-640`).
4. Saque cria linha local idempotente antes da chamada externa; estados são reconciliados por resposta/webhook (`src/lib/withdrawal.server.ts:21-160`).
5. Estado remoto, atrasos, eventos, filas e conciliação real não foram consultados.

## Lacunas de investigação

- Confirmar evento oficial de estorno: o código reconhece nomes candidatos e comenta que o nome precisa confirmação (`src/lib/agpay-events.server.ts:559-565`).
- Confirmar limites de corpo/timeout do webhook, assinatura atual do provedor e entrega/retry.
- Inspecionar concorrência do claim de eventos, transições de saque e casos de resposta ambígua.
- Verificar conciliação entre `deposit_payments`, `ledger_entries`, `wallets`, `withdrawals` e extrato remoto.
- Validar regra final da taxa de saque: a migration registra R$3 como taxa de plataforma, ao passo que há docs/runbook falando que o provedor desconta a taxa; confirmar sem inferir.
- Verificar se há reservas confirmadas sem cobrança válida e pagamentos órfãos, somente com acesso a dados de leitura.

### PAY-005 — Divergência entre cabeçalhos documentados e o adaptador Pix

- **Status:** cabeçalho implementado localmente; chamada POST em sandbox e configuração de produção ainda não verificadas.
- **Gravidade:** P2 até validar no ambiente autorizado.
- **Módulo:** autenticação da API AgPay.
- **Esperado:** requisições devem usar os cabeçalhos exigidos pela documentação vigente e pela credencial ativa.
- **Observado:** a documentação pública atual do AgPay (`https://agpay.services/documentacao`, consultada em 2026-11-15) exibe `Authorization: Bearer` e `X-Client-ID` nos exemplos de Pix, cartão e PHP/cURL. A versão local do adaptador não encaminhava `AGPAY_CLIENT_ID`. Com a credencial local atual, `GET /api/v1/transactions?limit=1` retornou HTTP 200 e `success=true` tanto sem quanto com `X-Client-ID`; resposta e dados de transação não foram exibidos. O runbook registrava uma observação histórica de 401 com esse header, que não se reproduziu com a credencial atual na consulta GET.
- **Impacto:** se o endpoint/credencial ativo exigir ambos, cobrança falha; se a observação histórica refletia uma peculiaridade real do token, adicionar o header também poderia falhar. Não foi feita chamada de criação de cobrança.
- **Causa-raiz:** o adaptador descartava o identificador de cliente disponível apesar dos exemplos atuais do provedor; o runbook tratava uma observação histórica como regra universal. O requisito de POST para a credencial atual permanece sem validação em sandbox.
- **Validação segura:** comparar um GET somente leitura da API com a credencial ativa, sem exibir credenciais; nenhuma chamada POST financeira.
- **Correção aplicada localmente:** o adaptador envia `X-Client-ID` quando `AGPAY_CLIENT_ID` está configurado; a variável foi incluída no `.env.example` e no runbook. Testes de contrato cobrem chamada direta, ausência opcional da variável e encaminhamento pelo proxy.
- **Regressão necessária:** contrato de headers; garantir que logs nunca mostrem token/Client ID; tratamento de 401 identificável sem expor corpo sensível.

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

### PAY-007 — Eventos de estorno reconhecidos por nomes não confirmados

- **Status (2026-11-15):** correção bloqueada por contrato de webhook de estorno/chargeback não publicado; nomes atuais continuam hipóteses.
- **Gravidade:** P2.
- **Módulo:** estornos/chargebacks.
- **Esperado:** cada evento oficial de estorno deve reduzir a carteira correta uma única vez e produzir estado auditável.
- **Observado:** `isRefundEvent` aceita `transaction.refunded`, `deposit.refunded`, `transaction.chargeback` e três status candidatos (`src/lib/agpay-events.server.ts:779-783`). A documentação oficial consultada hoje lista eventos de cobrança/saque e não define estorno/chargeback; ausência na página não prova ausência de eventos adicionais.
- **Impacto:** se o nome oficial não estiver entre os candidatos, o webhook pode ser armazenado como evento não reconhecido sem débito de refund. Não há evidência de estorno real perdido.
- **Causa-raiz:** contrato oficial de nomes e payloads de estorno/chargeback não está disponível nas evidências desta sessão.
- **Validação segura:** o teste local cobre o alias `transaction.refunded`, débito idempotente e exclusão de `transaction.failed`, mas não valida o nome que o gateway realmente emite.
- **Bloqueio:** aguardar tabela de eventos e payload oficial ou evento observado em sandbox. Não ampliar a lista de aliases por suposição, pois um nome genérico/status pode debitar saldo incorretamente.
- **Regressão necessária após confirmação:** payload oficial de refund/chargeback, duplicado, fora de ordem e referência local ausente, tudo em banco isolado.

### PAY-029 — Estorno debita o ledger, mas não muda o estado da cobrança

- **Status:** falha local de estado corrigida; ocorrência real e semântica remota de estorno não verificadas.
- **Gravidade:** P2.
- **Módulo:** estorno, reconciliação e relatórios financeiros.
- **Esperado:** após um evento oficial de estorno/chargeback processado, o ledger e o registro de cobrança devem apresentar estados compatíveis, e relatórios devem distinguir volume bruto pago de valor estornado/líquido.
- **Estado atual observado:** após `debitRefund`, o handler atualiza `deposit_payments.status='estornado'` e `provider_status`, com condição idempotente e releitura para resolver concorrência (`src/lib/agpay-events.server.ts:699-727`). O relatório de desempenho separa contagem/volume estornado; `summarizeDeposits` separa volume pago líquido de volume bruto/refundado, e a lista de transações mostra o status gravado. A conciliação Master mantém a comissão em pagamentos estornados ou com `paid_at`; a política de retenção dessa comissão depende do modelo comercial/provider e não é resolvida por este achado.
- **Evidência/spec:** a US3 da spec 005 exige débito do valor líquido no ledger após estorno total; a execução do débito existe, mas o estado financeiro da cobrança não acompanha o evento. As visões existentes usam status da cobrança para separar pagos e estornados.
- **Impacto:** telas de Master e desempenho podem continuar apresentando como pago/volume confirmado um pagamento cujo valor líquido já foi debitado por estorno; reconciliação entre ledger, cobrança e relatórios exige dedução manual e fica ambígua.
- **Causa-raiz histórica:** o handler gravava o lançamento compensatório sem gravar estado terminal da cobrança; corrigido com status `estornado`, preservando `paid_at` como evidência do pagamento original.
- **Reprodução segura:** executar o teste existente de webhook com fake DB, conferir que o ledger recebe `refund_debit` e que o fake de `deposit_payments` continua `pago`; depois invocar `summarizeDeposits`/agregador com esse registro e verificar que continua no total pago. Não usar evento, conta ou dinheiro real.
- **Validação — 2026-11-15:** testes de AgPay events, business intelligence, performance, admin e transações passaram 86/86. Cobrem atualização de status, idempotência, evento de pagamento antigo após estorno e separação de volumes. Sem webhook/dados reais.
- **Limitação externa:** o alias oficial e a semântica de chargeback/refund permanecem bloqueados em PAY-007; não inferir que os nomes atualmente reconhecidos coincidam com o contrato AgPay. O tratamento da comissão após refund também depende de regra comercial/contratual.

### PAY-008 — Documentação atual apresenta cartão hospedado, mas cobrança de sinais no código é só Pix

- **Status (2026-11-15):** escopo de produto bloqueado; o app anuncia e processa apenas Pix no fluxo de sinal/assinatura revalidado.
- **Gravidade:** P2 potencial somente se produto exigir cartão nas jornadas existentes.
- **Módulo:** meios de pagamento.
- **Esperado:** anunciar suporte somente quando o produto incluir uma jornada de cartão conectada ponta a ponta.
- **Observado:** o adaptador de sinal cria somente Pix; `SubscriptionPaymentMethodSelector` expõe apenas Pix e não renderiza campos de cartão (UI-001). As specs 003/004/008 pesquisadas não especificam habilitar cartão para sinal ou assinatura; a página AgPay descreve uma capacidade do provedor, não requisito do app.
- **Impacto:** não identifiquei promessa de cartão no fluxo atual do produto; ampliar para cartão sem escopo e fluxo hospedado definido criaria risco financeiro e de coleta de dados.
- **Validação:** busca nas specs 003, 004 e 008 e leitura dos seletores de assinatura e pagamento de sinal; teste `SubscriptionPaymentMethodSelector.test.tsx` confirma somente Pix (1/1).
- **Bloqueio:** decidir se cartão é requisito para sinal, assinatura ou nenhum deles; até essa definição, manter Pix como único método. A documentação do gateway não substitui escopo de produto.

## Fonte externa primária consultada

- Documentação pública AgPay v1: [agpay.services/documentacao](https://agpay.services/documentacao), consultada em 2026-11-13. A página documenta Pix, checkout hospedado VeoPag, regras de split no Dashboard, saques, eventos e assinatura HMAC. É a documentação pública visível, mas não foi possível confirmar se corresponde ao contrato/credencial específica da conta Agenda Agora.

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

### PAY-010 — Busca de idempotência de saque não está vinculada ao negócio

- **Status:** escopo ausente confirmado no código; exposição depende de colisão ou conhecimento da chave de outra retirada.
- **Gravidade:** P2.
- **Módulo:** pagamentos / isolamento entre negócios.
- **Esperado:** retry idempotente só deve retornar a operação pertencente ao mesmo negócio e usuário autorizado.
- **Observado:** `src/lib/withdrawal.server.ts:47-74` consulta `withdrawals` por `idempotency_key` e retorna `existing`/`duplicate` sem validar `business_id`; a tabela define chave globalmente única em `supabase/migrations/20260928190000_withdrawals.sql:1-9`. O objeto inteiro de saque é devolvido.
- **Impacto:** chamada autenticada por outro dono com a mesma chave conhecida pode receber dados da retirada alheia (inclusive `pix_key_snapshot` e `provider_ref`) e a operação solicitada no próprio negócio pode ser suprimida.
- **Reprodução segura:** dois negócios em fake DB; criar linha para A, chamar retry para B com a mesma UUID e observar a linha A devolvida. Sem chamada de gateway.
- **Causa-raiz:** chave global é tratada como autorização suficiente para repetir uma operação.
- **Correção recomendada para spec:** validar propriedade/negócio no retorno e definir semântica para reutilização de chave entre negócios; não expor linha não pertencente ao chamador.
- **Regressão:** mesmo negócio + mesma chave retorna resultado original; negócio diferente recebe erro sem dados da linha A.

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

### SEC-004 — PIN de saque agora tem lockout persistente por usuário/negócio

- **Estado:** mitigado localmente para brute force online; IP de origem e camada implantada não verificados.
- **Gravidade:** P2.
- **Módulo:** segurança / saque.
- **Causa-raiz:** `verifyWithdrawalPinForOwner` validava o PIN de quatro dígitos sem contador nem bloqueio server-side.
- **Correção local:** o handler consulta o lock persistente `auth_attempts` usando chave do usuário autenticado + negócio. Cinco falhas em 15 minutos bloqueiam por 30 minutos. Cada falha precisa ser persistida; erros de leitura/escrita falham fechado. PIN correto limpa o contador. O lock vale também quando o saque chama a mesma verificação server-side.
- **Regressão:** testes cobrem PIN incorreto registrado, lock ativo, tentativa que atinge o limite, falha persistente e PIN correto limpando o contador; sem chamada financeira real.
- **Validação (2026-11-14):** `src/lib/withdrawal.server.test.ts` 36/36; `npx tsc --noEmit` e `git diff --check` passaram.
- **Limitação:** cota persistente é por usuário/negócio; não inclui IP porque a origem confiável depende da cadeia de proxy ainda pendente em SEC-018. O hash de saque existente continua SHA-256, portanto exposição offline de uma cópia da tabela permanece fora desta correção. Nenhuma conta, tabela ou infraestrutura real foi consultada.


### PAY-012 — Período de desempenho usa `created_at`, apesar do comentário citar `paid_at`

- **Status:** divergência código/comentário confirmada; regra contábil que deveria governar o relatório não está explícita na spec revisada.
- **Gravidade:** P2 potencial.
- **Módulo:** pagamentos / métricas financeiras.
- **Esperado:** relatório deve definir e aplicar uma única data de reconhecimento (criação ou confirmação do pagamento) de forma consistente.
- **Observado:** `src/lib/agpay-performance.functions.ts:95-103` documenta “by paid_at or created_at”, mas aplica o filtro exclusivamente a `created_at`. A agregação conta como paga usando `status` ou `paid_at` (`:139`), só que uma cobrança criada fora do período e paga dentro dele nunca chega à agregação. O teste atual fornece `created_at` e `paid_at` no mesmo dia (`src/lib/agpay-performance.functions.test.ts:50-90`), então não cobre atraso de webhook.
- **Impacto:** mês/período do painel Master pode divergir para pagamentos confirmados depois da criação ou webhooks tardios; efeito depende de qual data a regra comercial define.
- **Reprodução segura:** teste fake com `created_at` anterior ao filtro e `paid_at` dentro do filtro; comparar o resultado com a política de reconhecimento definida pelo produto.
- **Causa-raiz:** filtro de período e condição de pagamento usam colunas de tempo distintas sem contrato explícito nem cenário de atraso.
- **Correção recomendada para spec:** fixar a data de referência financeira e documentar tratamento de cobranças sem `paid_at`; alinhar filtro, agrupamento diário e rótulos.
- **Regressão:** pagamento criado no fim de um mês e confirmado no começo do seguinte aparece apenas no período definido pela política.

### PAY-013 — Métricas financeiras podem retornar parciais sem aviso e truncar acima de 5.000 linhas

- **Status:** comportamento confirmado no código; ocorrência/volume em produção não verificados.
- **Gravidade:** P2.
- **Módulo:** pagamentos / reporting Master.
- **Esperado:** erro de leitura deve ser explícito e agregações completas devem paginar ou agregar no banco.
- **Observado:** `src/lib/agpay-performance.functions.ts:88-113` não inspeciona `error` das consultas de negócios, perfis, depósitos e saques. A lógica usa `businesses ?? []`, `deposits ?? []` e `withdrawals ?? []`, podendo apresentar zero/parcial como se fosse sucesso. Depósitos e saques são limitados a 5.000 linhas sem cursor/paginação (`:104,113`); além desse volume o resultado fica incompleto.
- **Impacto:** painel pode mostrar receita, lucro, saques pendentes e ranking incorretos sem sinalizar falha. Paginação máxima pode afetar contas/intervalos com mais de 5.000 registros (ou limite menor configurado pelo Supabase).
- **Reprodução segura:** fake DB que retorna erro em cada consulta e fixture com mais de 5.000 registros; nenhuma escrita/consulta de produção.
- **Causa-raiz:** caminho de reporting trata ausência de dados e falha como mesmo valor e consulta tem limite fixo sem paginação.
- **Correção recomendada para spec:** propagar erro claro; agregar no banco ou paginar com ordenação estável; informar janela/limite quando a consulta for incompleta.
- **Regressão:** erros nunca produzem KPIs de sucesso; dataset acima do limite preserva total/ordem; teste de limite de linha do Supabase.

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


### PAY-015 — Taxa fixa de comissão definida na spec 005 não aparece no cálculo atual

- **Status:** divergência spec/código confirmada; confirmação de substituição comercial posterior inconclusiva.
- **Gravidade:** P2.
- **Módulo:** pagamentos / comissionamento.
- **Esperado:** spec 005 registra 0% mais R$ 0,25 por cobrança (research e FR-001: linhas 31-33, 170-172); versões posteriores do escopo devem formalizar se essa política foi retirada.
- **Observado:** `src/lib/ledger.server.ts:5-11,17-29` calcula custo do gateway como R$ 0,75 fixos (comentário: R$ 0,25 AgPay + R$ 0,50 adquirente) e `PLATFORM_FLAT_FEE_CENTS = 0`; o comentário diz que a comissão fixa foi removida em 06/10/2026. FR-001 da spec 005 continua descrevendo taxa de gateway de 3,99% + R$ 0,49 e comissão fixa da plataforma de R$ 0,25. Spec 010 research/T055/T059 passa a nomear os R$ 0,75 como taxa de depósito inicial para simulação, não explicita a alteração da comissão de R$ 0,25. O teste `ledger.server.test.ts` cristaliza taxa de comissão zero e taxa de gateway fixa em R$ 0,75.
- **Impacto:** com percentual 0%, ledger registra comissão da plataforma de R$ 0,00 por sinal; o custo de gateway de R$ 0,75 continua descontado do líquido do estabelecimento. Se a decisão de cobrar R$ 0,25 de comissão fixa da spec 005 ainda valer, ela não está no cálculo atual. A política comercial posterior permanece sem fonte formal confirmada.
- **Reprodução segura:** comparar `computePaymentBreakdown(10000, 0)` com a política comercial vigente, sem transação real.
- **Causa-raiz:** regra de negócio posterior aparece em comentário/teste de código, mas não foi reconciliada com a spec versionada.
- **Correção recomendada para spec:** atualizar a decisão financeira com data/autor e separar taxa do provedor, custo do gateway e receita da plataforma em exemplos/telas.
- **Regressão:** cálculo e teste unitário correspondem à política comercial aprovada e a extratos/relatórios refletem a mesma decomposição.

### PAY-016 — Falhas de cobranças de assinatura não encerram o estado pendente

- **Status:** lacuna confirmada no roteamento local de eventos; ocorrência/impacto em produção não verificados.
- **Gravidade:** P2.
- **Módulo:** pagamentos / ciclo de assinatura / webhook.
- **Esperado:** evento de falha/expiração aplicável à assinatura deve atualizar a cobrança local para `failed`/`expired`, liberar nova tentativa e encerrar o polling da interface.
- **Observado:** `processWebhookEvent` trata `deposit.completed` tentando primeiro o depósito e depois `confirmSubscriptionCharge` (`src/lib/agpay-events.server.ts:535-543`). Já `transaction.failed` consulta somente `deposit_payments` por `provider_payment_id` (`:545-553`); se não encontrar, lança `MissingLocalReferenceError`, sem atualizar `subscription_charges`. A tabela aceita os estados `pending`, `paid`, `failed`, `expired`, mas não declara `expires_at` (`supabase/migrations/20261106120000_subscription_charges.sql:9-19`). `SubscriptionPixPayment` encerra o polling só ao receber `paid`, `failed` ou `expired` (`src/components/painel/SubscriptionPixPayment.tsx:106-132`).
- **Impacto:** uma cobrança de assinatura que falha no provedor pode permanecer `pending` e a interface continuar aguardando; retentativas do webhook podem ficar na fila até política de retry/dead-letter. O evento e o contrato do provedor precisam confirmar a semântica exata de falha/expiração.
- **Reprodução segura:** harness in-memory com evento `transaction.failed` vinculado a um `subscription_charges.provider_payment_id`; verificar que nenhum estado de assinatura muda e que o evento recebe erro de referência ausente. Não chamar AgPay nem banco real.
- **Causa-raiz:** o consumidor do evento foi implementado para depósitos e não possui fallback de busca/transição para cobranças de assinatura.
- **Correção recomendada para spec:** definir estados terminais, eventos oficiais e expiração para assinatura; reconciliar webhook e rotina de consulta, com tentativas e dead-letter observáveis.
- **Regressão:** falha/expiração de depósito e assinatura transicionam apenas a entidade correta; notificações duplicadas são idempotentes; UI deixa de aguardar após estado terminal.

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


### PAY-018 — Falha ao persistir a cobrança pode deixar Pix externo sem referência local

- **Status:** mitigado localmente; falha conjunta da gravação da cobrança e da inbox de revisão continua sem recuperação durável.
- **Gravidade:** P2 potencial.
- **Módulo:** pagamentos / resiliência / assinatura.
- **Esperado:** falha ao gravar a cobrança local deve permitir localizar e cancelar/reconciliar a cobrança externa, ou usar fluxo que não deixe uma transação pagável sem controle interno.
- **Observado:** `createSubscriptionCharge` chama `createPixCharge` antes do `insert` em `subscription_charges`. Se o insert retorna erro, o handler faz upsert de `subscription.charge_persist_failed` em `agpay_webhook_events` com a referência AgPay, negócio e valor, em status `error`, visível na fila do Master. Não persiste QR, CPF nem e-mail. A UI informa que o Pix pode ter sido criado e orienta não pagar novamente. Não foi verificada disponibilidade de API de cancelamento do gateway.
- **Impacto:** timeout/erro de banco depois da resposta de criação pode deixar QR Pix válido sem cobrança rastreável pela UI/webhook local. Se pago, reconciliação pode falhar até haver consulta manual no provedor.
- **Reprodução segura:** TDD no fake: antes da implementação, os dois casos falharam porque o erro original do insert era retornado e não havia evento de revisão. Depois, o caso de insert falho verifica referência/status/payload sem QR; outro verifica mensagem clara mesmo se o upsert da inbox falhar. `src/lib/subscription-charge.functions.test.ts`: 15/15.
- **Causa-raiz:** criação externa precede a persistência local; não há transação distribuída nem compensação confirmada. A inbox fornece trilha de revisão quando seu próprio upsert funciona.
- **Correção aplicada:** evento de revisão com dedupe hash determinístico por referência AgPay, sem dados pessoais; falha da inbox também é registrada no log do servidor. Não se presume que a cobrança externa foi cancelada.
- **Limite residual:** se a gravação da cobrança e a inbox falharem simultaneamente, a referência só permanece no log do servidor e a recuperação depende da observabilidade/consulta manual. Timeout ambíguo e cancelamento do provedor não foram testados nem verificados externamente.
- **Regressão:** falha de persistência depois da criação cria item de reconciliação sempre que o banco aceita a gravação da inbox; a interface orienta não repetir o pagamento.

### PAY-019 — listagem Master de transações pode exibir dataset vazio/parcial como completo

- **Status:** comportamento confirmado no handler; ocorrência/volume em produção não verificados.
- **Gravidade:** P2.
- **Módulo:** pagamentos / reporting Master.
- **Esperado:** falha em consulta deve aparecer como erro; lista e indicadores devem declarar paginação/recorte e calcular métricas sobre o conjunto completo correspondente.
- **Observado:** `getTransactions` em `src/lib/transactions.functions.ts:41-63` ignora `error` das consultas de depósitos, saques, negócios e perfis; usa `data ?? []`, apresenta sucesso vazio/parcial e limita cada lista a 2.000 linhas sem paginação (`:46-57`). As métricas são derivadas apenas das listas limitadas (`:91-105`).
- **Impacto:** falha transitória pode parecer ausência de transações; histórico acima de 2.000 linhas fica truncado e KPIs subcontam registros.
- **Reprodução segura:** fake DB retorna erro numa consulta e dataset acima de 2.000 itens; verificar retorno vazio/parcial sem erro visível e totais limitados. Não consultar produção.
- **Causa-raiz:** handler ignora erros do Supabase e aplica limites fixos antes de calcular KPIs.
- **Correção recomendada para spec:** propagar erros; paginar a tabela com ordenação estável e calcular KPIs por consulta agregada/intervalo completo; mostrar recorte quando aplicável.
- **Regressão:** falhas de cada consulta viram estado de erro; acima do limite as páginas e totais permanecem completos.

### PAY-020 — coluna “Lucro Ag Pay” exibe o líquido do estabelecimento

- **Status:** corrigido localmente: `netCents` permanece inalterado e sua coluna está rotulada como “Valor líquido”; sem alteração de cálculo ou dados.
- **Gravidade:** P2.
- **Módulo:** pagamentos / relatório Master / UI de transações.
- **Esperado:** lucro da plataforma deve corresponder ao ledger e estar separado de valor bruto, taxa do gateway e líquido do estabelecimento, conforme `specs/010-endurecimento-versao-cliente/spec.md:220-221` (FR-021).
- **Observado:** `getTransactions` define `netCents` como `deposit_payments.net_amount_cents` ou `amount_cents - fees` para depósitos (`src/lib/transactions.functions.ts:73-77`), e como saque menos taxas para saques (`:94-98`). A tabela renderiza `money(item.netCents)` sob cabeçalho “Lucro Ag Pay” (`src/routes/_authenticated/painel.transacoes.tsx:359,391-394`). A função também calcula `feeCents`, mas essa coluna não é renderizada.
- **Impacto:** Master pode interpretar como lucro da plataforma o valor líquido repassável ao negócio ou um saque líquido; relatórios e decisões podem partir de métricas semanticamente incorretas. Não há evidência de decisão tomada com base nesse número.
- **Reprodução segura:** fixture fake com bruto 10.000, taxas 100 e líquido 9.900; observar UI exibindo R$ 99,00 sob “Lucro Ag Pay”, sem consulta/alteração real.
- **Causa-raiz:** campo líquido de destino foi conectado a rótulo de lucro e a decomposição de taxa não é exibida.
- **Correção recomendada para spec:** definir cada métrica financeira, fonte ledger, sinal e entidade recebedora; alinhar nome/valor e separar lucro, taxas e líquido.
- **Regressão:** fixture com valores distintos de bruto, taxa, lucro e líquido confirma rótulos e fonte de cada coluna; lucro coincide com ledger.

### PAY-021 — execuções simultâneas do cron podem duplicar avisos de assinatura

- **Status:** corrigido localmente; migration remota não verificada.
- **Gravidade:** P2.
- **Módulo:** pagamentos / assinatura / jobs.
- **Esperado:** duas chamadas simultâneas do lifecycle devem criar no máximo um aviso por negócio e título dentro da janela de deduplicação, conforme a própria descrição do handler e FR-023 de spec 010.
- **Observado/correção:** a leitura seguida de insert foi substituída por `dedupe_key = access_until + title`, com índice único `(business_id, dedupe_key)` e `upsert(..., ignoreDuplicates: true)`. A restrição no PostgreSQL arbitra concorrência entre cron/reruns; o ciclo seguinte admite o mesmo título porque `access_until` muda.
- **Impacto:** avisos duplicados em timeline Master, métricas/notificações duplicadas e ruído operacional quando agendador sobrepõe execuções ou há retry concorrente. Cancelamento em si usa RPC com `FOR UPDATE` e proteção própria.
- **Reprodução segura:** mock DB com barreira entre leitura de eventos e insert; iniciar duas chamadas ao handler simultaneamente e contar registros. Apenas harness local, sem cron/DB real.
- **Causa-raiz:** corrigida localmente por identidade de ciclo e unicidade no banco.
- **Correção recomendada para spec:** especificar chave idempotente de aviso e gravá-la sob unicidade transacional; manter o cancelamento protegido pelo lock da RPC.
- **Regressão:** testes de rota validam rerun e novo ciclo; teste PostgreSQL descartável cobre transações concorrentes e chaves de ciclos distintos. Evidência e limites em “PAY-021/PAY-023 — disposição após correção local” abaixo. Migration ainda não aplicada em produção.

### PAY-022 — cron do ciclo de assinatura não pagina a lista de estabelecimentos

- **Status:** corrigido localmente; versão implantada não verificada.
- **Gravidade:** P2 potencial.
- **Módulo:** pagamentos / assinatura / infraestrutura de jobs.
- **Esperado:** rotina diária deve processar todos os estabelecimentos e registrar o total varrido.
- **Correção presente:** o hook usa `fetchAllPages` em `businesses`, ordenado por `id`, com faixas de 1.000; falha em qualquer página retorna HTTP 500 antes de gravar run log. O total completo alimenta `businesses_scanned`.
- **Impacto:** se o limite de linhas do endpoint estiver abaixo do total cadastrado, estabelecimentos fora do resultado não recebem avisos nem cancelamento diário e o run log não sinaliza incompletude.
- **Reprodução segura:** fake de PostgREST com limite configurável e fixture acima desse limite; verificar que a rotina só classifica a página retornada. Sem consulta/alteração real.
- **Causa-raiz histórica:** consulta única assumia que a resposta continha todos os negócios; corrigido por paginação estável e fail-closed.
- **Correção recomendada para spec:** definir paginação estável ou rotina por lote e comparar `businesses_scanned` com o total esperado.
- **Regressão — 2026-11-15:** teste `subscription-lifecycle.test.ts` com 1.001 negócios passou e verifica as duas faixas (`0–999`, `1000–1999`) e `businesses_scanned: 1001`; cenário de erro de página verifica HTTP 500 sem run log. Teste focal da paginação: 1/1. Produção não verificada.

### PAY-023 — deduplicação de avisos pode suprimir o mesmo aviso no ciclo mensal seguinte

- **Status:** comportamento confirmado por comparação do intervalo e da chave de deduplicação; incidência operacional não verificada.
- **Gravidade:** P2.
- **Módulo:** pagamentos / assinatura / notificações Master.
- **Esperado:** evitar duplicação por reexecução do mesmo ciclo e ainda emitir o mesmo tipo de aviso quando o estabelecimento inicia um novo ciclo de cobrança.
- **Observado:** `subscription-lifecycle.ts:116-127` busca eventos dos últimos 45 dias e considera existente qualquer evento com mesmo `business_id` e `title`. Os títulos são reutilizados em cada período (`:82-107`), e o modelo de acesso/cobrança renova em intervalos de 30 dias (`subscription-lifecycle.ts` comentário inicial; `subscription-charge.functions.ts:206-219`). Uma renovação seguida de nova cobrança pode trazer o mesmo aviso novamente antes de completar os 45 dias; o job o contará como `skipped`.
- **Impacto:** timeline/alertas do Master podem omitir avisos recorrentes de vencimento e atraso em ciclos consecutivos. A notificação visual do dono (`AvisoCobranca`) deriva do estágio do ciclo e é um fluxo distinto; esse achado não prova que o dono deixa de ver o banner.
- **Reprodução segura:** fake DB com evento do mesmo negócio/título criado há 30 dias e data de vencimento que gera aquele aviso; executar o handler e observar `skipped` sem insert. Sem DB/cron real.
- **Causa-raiz:** janela fixa de 45 dias é maior que o ciclo mensal, e chave de deduplicação não inclui ciclo, data de vencimento nem etapa temporal identificadora.
- **Correção recomendada para spec:** deduplicar pela identidade do ciclo e alerta (ex.: período de vencimento + estágio), não por título numa janela maior que a recorrência esperada.
- **Regressão:** reexecução no mesmo ciclo não duplica; ciclo mensal seguinte gera novo evento para o mesmo estágio/título; um aviso criado no ciclo anterior não suprime o atual.

### PAY-024 — pagamento posterior ao cancelamento não limpa estado de cancelamento

- **Status:** divergência de transição confirmada; impacto final no acesso do dono não reproduzido.
- **Gravidade:** P2.
- **Módulo:** pagamentos / ciclo de assinatura / lifecycle.
- **Esperado:** após regularização, o estado da assinatura deve refletir acesso restaurado e deixar a classificação de cancelado, conforme spec 010 US6/FR-024.
- **Observado:** a RPC `cancel_overdue_business` grava `cancelled_at` e `status = 'cancelado'` (`supabase/migrations/20261103000000_security_hardening.sql:249-286`). Quando chega pagamento, `confirmSubscriptionCharge` lê apenas `access_until` e atualiza apenas essa coluna (`src/lib/agpay-events.server.ts:174-204`); não limpa `cancelled_at` nem altera `status`. `classifyLifecycle` considera `cancelledAt` primeiro e retorna `reason: 'cancelado'` antes de olhar se o novo `access_until` está vigente (`src/lib/subscription-lifecycle.ts:53-68`). Há ação Master manual “reverter” que limpa marcadores, mas ela não é chamada pela confirmação do pagamento (`src/lib/lifecycle.functions.ts:805-824`).
- **Impacto:** após pagamento pós-cancelamento, dashboard Master pode continuar classificando o estabelecimento como cancelado, apesar do `access_until` no futuro. O acesso efetivo do owner, reserva pública e eventual reativação automática não foram simulados; não se declara bloqueio comprovado.
- **Reprodução segura:** fake DB inicia business com `status='cancelado'`, `cancelled_at` preenchido e `access_until` passado; processar confirmação mockada e conferir que somente `access_until` muda e que `classifyLifecycle` continua em `cancelado`. Sem webhook/gateway real.
- **Causa-raiz:** confirmação de cobrança e transição do estado de lifecycle atualizam campos diferentes; o classificador dá prioridade permanente ao marcador de cancelamento.
- **Correção recomendada para spec:** definir a máquina de estados pós-cancelamento pago; confirmar atomicamente status, timestamps, permissões de reserva e auditoria, preservando cancelamento voluntário quando aplicável.
- **Regressão:** pagar após cancelamento por inadimplência restaura lifecycle e acesso conforme regra; cancelamento voluntário não é removido sem decisão explícita; callback repetido segue idempotente.

### PAY-025 — erro ao contar profissionais pode reduzir silenciosamente o valor da assinatura

- **Status:** fallback confirmado no código; ocorrência em produção não verificada.
- **Gravidade:** P2.
- **Módulo:** pagamentos / preço da assinatura / backend.
- **Esperado:** erro ao calcular quantidade de profissionais deve interromper a emissão da cobrança ou mostrar erro; cobrança e resumo devem usar a mesma contagem validada.
- **Observado:** `createSubscriptionCharge` seleciona `count` da tabela `professionals` sem capturar `error`, depois passa `professionalsCount ?? 0` a `subscriptionChargeAmountCents` (`src/lib/subscription-charge.functions.ts:168-176`). `getBillingCycle` faz contagem equivalente e também usa `count ?? 0` (`src/lib/subscription.functions.ts:48-55,79`). O comentário documenta a regra base + R$ 10 por profissional adicional, primeiro incluído (`subscription.functions.ts:48`).
- **Impacto:** falha/transiente ou permissão de leitura pode emitir Pix só pelo preço-base mesmo com profissionais adicionais, divergindo do valor exibido/da regra. A margem depende do número de adicionais.
- **Reprodução segura:** mock DB retorna `count: null` e erro para negócio com profissionais adicionais; observar resumo em base e cobrança gerada na base. Não chamar gateway real; usar mock `createPixCharge`.
- **Causa-raiz:** destructuring descarta `error` e fallback `?? 0` trata falha como nenhuma linha.
- **Correção recomendada para spec:** falhar fechado na contagem; compartilhar um único cálculo/consulta validada entre resumo e emissão; definir regra para profissionais ativos/inativos.
- **Regressão:** erro de contagem impede preço reduzido; 1 profissional mantém base; cada adicional aplica valor definido e UI coincide com cobrança.

### PAY-026 — erro na leitura do histórico de assinatura vira histórico vazio

- **Status:** comportamento confirmado no handler; falha de query em produção não verificada.
- **Gravidade:** P2.
- **Módulo:** pagamentos / painel do dono / histórico.
- **Esperado:** indisponibilidade da consulta deve ser apresentada como erro ou histórico temporariamente indisponível, distinta de “nenhum pagamento”.
- **Observado:** `getBillingCycle` em `src/lib/subscription.functions.ts:38-46` consulta `subscription_payments` sem capturar/verificar `error` e mapeia `(payments ?? [])`. A UI usa `cycle.data?.pagoHistory ?? []` e não mostra mensagem de erro específica para histórico vazio (`src/routes/_authenticated/painel.tsx:1248,1415-1435`). A consulta do negócio também não verifica `error` e pode transformar erro em “Negócio não encontrado” (`subscription.functions.ts:23-34`).
- **Impacto:** falha transitória pode ocultar pagamentos anteriores; uma tela sem itens não distingue ausência real de histórico indisponível. Não há prova de perda de registro no banco.
- **Reprodução segura:** mock de `subscription_payments` retornando erro com linhas existentes e verificar sucesso da função com `pagoHistory: []`; sem consulta real.
- **Causa-raiz:** resposta de erro da consulta não é propagada, e a camada visual interpreta array vazio como ausência.
- **Correção recomendada para spec:** propagar erro da leitura ou expor estado parcial da seção; não conflar falha de disponibilidade com lista vazia.
- **Regressão:** erro em tabela exibe estado de erro próprio; zero linhas sem erro exibe vazio; histórico disponível lista pagamentos.

### PAY-027 — negócios que começaram em teste seguem tratados como trial pelo cron mesmo após pagar

- **Status:** corrigido localmente; migration não aplicada/validada em produção.
- **Gravidade:** P1 potencial.
- **Módulo:** pagamentos / assinatura / transição de trial para assinante.
- **Esperado:** após o primeiro pagamento, um estabelecimento deixa de ser trial para classificação de assinante, avisos de vencimento e regra de cancelamento.
- **Correção presente:** cron e classificação usam `isBusinessTrial(trial_days, everPaid)`; o hook coleta histórico confirmado de `subscription_payments` e `subscription_charges` antes de classificar. A migration `20261114120000_fix_paid_trial_lifecycle.sql` permite auto-cancelamento de negócio com `trial_days` somente quando existe pagamento confirmado em uma dessas fontes.
- **Impacto:** após acabar o acesso de um negócio que iniciou como trial e depois pagou, rotina diária pode deixar de enviar avisos de fatura/atraso e nunca auto-cancelar por inadimplência, contrariando FR-024. O tamanho do impacto depende da existência de contas desse tipo na produção.
- **Reprodução segura:** fixture fake com `trial_days=7`, `subscription_payments` contendo `status='pago'`, `access_until` expirado há 15 dias e setting ativo; comparar classificação Master com a do cron/RPC. Apenas mock; nenhuma conta real alterada.
- **Causa-raiz histórica:** job e RPC inferiam trial pela presença de `trial_days`; corrigido usando pagamento confirmado como encerramento do estado de trial, sem apagar o histórico.
- **Correção recomendada para spec:** definir fonte canônica de “já pagou/assinante” e usá-la na classificação do cron e na pré-condição transacional de auto-cancelamento; não apagar história do teste sem política.
- **Regressão — 2026-11-15:** `subscription-lifecycle.test.ts` passou 10/10, incluindo trial já pago; `tests/db/functions.test.ts -t 'trial|cobrança paga'` passou os dois casos DB com `subscription_payments.status='pago'` e `subscription_charges.status='paid'`. A versão/migration implantada não foi consultada.

### PAY-028 — lifecycle e agenda Master de recebíveis têm limites sem paginação completa

- **Status:** ausência de paginação/limites fixos confirmados; ocorrência de truncamento depende do volume e dos limites remotos.
- **Gravidade:** P2 potencial.
- **Módulo:** pagamentos / relatórios Master / onboarding.
- **Esperado:** todos os estabelecimentos, pagamentos e entidades usadas para agregação devem ser processados; quando houver limite, deve ser paginado ou sinalizado.
- **Observado:** `getSubscriptionLifecycle` consulta negócios, perfis e pagamentos sem paginação; appointments, services, professionals e business_hours usam `limit(20000)` (`src/lib/lifecycle.functions.ts:80-111`). `getReceivablesCalendar` também lê negócios, perfis e pagamentos sem paginação e profissionais com `limit(20000)` (`:331-351`). Essas coleções alimentam pagamentos por estabelecimento, receita esperada, contagem de agenda e setupPercent. A visão geral Master também consulta appointments/services/professionals/business_hours/customers com `limit(20000)`, subscription_payments e deposit_payments com `limit(5000)`, além de eventos/notas recentes limitados a 60 (`src/lib/master/platform-overview.functions.ts:108-130`); esses dados também alimentam KPIs e indicadores apresentados como visão da plataforma. A consulta verifica erros, mas não pagina os resultados. A ficha Master (`getBusinessDossier`) também deixa serviços, profissionais e `subscription_payments` sem limite/paginação explícitos, além de limitar appointments/customers a 20.000 e deposits a 2.000 (`src/lib/master/dossier.functions.ts:274-337`); não foi possível confirmar o limite padrão aplicado pelo projeto remoto.
- **Impacto:** se datasets passarem dos limites do projeto Supabase, linhas podem ser omitidas sem aviso, alterando KPIs, receitas projetadas, contagem de atividade e status derivado. Número real de linhas e `max_rows` remoto não foram consultados.
- **Reprodução segura:** fake PostgREST com limite configurável e fixtures em duas páginas/mais de 20.000 entidades; comparar com resultado do handler em ambiente isolado.
- **Causa-raiz:** agregações em memória assumem retorno integral e usam limites fixos sem cursor/paginação ou indicador de parcialidade.
- **Correção recomendada para spec:** agregar no banco ou paginar todas as fontes com ordenação estável; expor total/limites e registrar cobertura do job.
- **Regressão:** datasets acima de cada página/limite mantêm contagens e totais completos, sem respostas de sucesso que omitam linhas.

### PAY-030 — escrita direta no histórico de pagamentos de assinatura

- **Estado:** corrigido localmente; migration remota não verificada.
- **Gravidade:** P2.
- **Causa:** policy inicial permitia CRUD ao owner em `subscription_payments`, tabela usada para histórico derivado de confirmações.
- **Correção local:** `20261114204014_restrict_subscription_payment_writes.sql` remove a policy owner, revoga escrita para `authenticated` e preserva SELECT do owner e DML de `service_role`.
- **Regressão:** `tests/db/security-hardening.test.ts` verifica leitura do owner, recusa INSERT/UPDATE/DELETE autenticados e permite escrita `service_role`; suíte focal 54/54.
- **Limite:** sem dados de produção e sem aplicação remota da migration.
### PAY-031 — aprovação Pix pode retornar sucesso sem liberar o acesso AG Pay

- **Estado:** falha de tratamento de erro confirmada estaticamente; ocorrência depende de falha na segunda gravação e não foi reproduzida.
- **Gravidade:** P2 potencial.
- **Módulo:** pagamentos / aprovação de chave Pix / acesso à carteira.
- **Esperado:** aprovação da chave e remoção do bloqueio de acesso devem ser atômicas ou comunicar claramente quando só uma das operações foi concluída.
- **Observado:** `setPixKeyApprovalStatus` primeiro atualiza `pix_key_approvals.status` para `aprovado` e valida o erro dessa gravação (`src/lib/pix-approvals.functions.ts:180-193`). Em seguida, quando aprovado, tenta atualizar `businesses.agpay_access_blocked=false`, mas não inspeciona nem propaga o `{ error }` do Supabase (`:194-199`). A rota considera a Promise resolvida como sucesso e exibe “Chave Pix aprovada” (`src/routes/_authenticated/painel.pix-aprovacao.tsx:78-86`). O saque rejeita negócio com `agpay_access_blocked` (`src/lib/withdrawal.server.ts:31-37`), enquanto a lista Master deriva “Ag Pay liberado” do estado aprovado da chave.
- **Impacto:** se a atualização de `businesses` falhar depois de a aprovação persistir, Master verá a chave aprovada e sucesso, mas o bloqueio financeiro continuará; o estabelecimento não conseguirá solicitar saque até correção manual ou nova aprovação. Não há evidência de que isso tenha ocorrido.
- **Reprodução segura:** mockar a primeira atualização como sucesso e a segunda como `{ error }`; conferir retorno do handler e status observado pela UI. Usar mocks, sem alterar estado persistente nem chamar AgPay.
- **Causa-raiz confirmada:** a mutação de liberação do negócio ignora erro e não faz parte de transação junto com a aprovação.
- **Correção recomendada para spec:** executar ambas as mudanças numa RPC transacional ou tratar falha parcial com estado/erro recuperável e operação idempotente de reconciliação.
- **Regressão:** aprovação mais liberação são atômicas; erro na liberação não produz toast de sucesso e permite retry/reconciliação; recusa não remove bloqueio.
- **Limitação:** nenhum status de chave ou bloqueio foi alterado nesta auditoria; não houve leitura do estado de negócios remotos.

### PAY-032 — falha ao salvar resposta do cashout perde a referência usada pelo webhook

- **Estado:** mitigado localmente; conciliação manual nem resposta real do provedor foram exercitadas.
- **Gravidade:** P1 potencial, pois pode deixar payout externo sem conciliação local e saldo em estado inconsistente.
- **Módulo:** pagamentos / saque / AgPay / reconciliação.
- **Esperado:** depois que o provedor aceita um cashout e devolve referência, o sistema deve persistir a referência em estado recuperável ou deixar uma operação durável para conciliação; falha de persistência não deve descartar a única chave de correlação.
- **Observado após correção:** se o update de `provider_ref` retorna erro, `createWithdrawal` faz upsert de `cashout.reference_persist_failed` em `agpay_webhook_events`, com referência, `withdrawal_id`, negócio e valor, em status `error`. A fila existente de revisão do Master exibe referência e `last_error` (que inclui o ID interno). O saque permanece `processing`. Repetir com a mesma chave retorna a linha existente e não chama `createCashoutPix` outra vez.
- **Impacto:** se o cashout foi aceito e a gravação que contém a referência falhou, o saldo já pode ter sido debitado/reservado e o Pix externo pode ser executado, enquanto a aplicação perde sua correlação local para processar evento terminal. A inbox tenta novamente evento sem referência local com backoff e o move para `error` após 24 h (`src/lib/agpay-events.server.ts:605-630`); isso preserva o payload para triagem, mas não recupera o saque se nenhuma linha local adquirir a referência. A linha pode permanecer `requested` ou `processing` e o valor ficar bloqueado até reconciliação manual. Não há evidência de ocorrência real.
- **Recuperação manual:** evento é exibido na fila Master de erros AgPay, com referência externa e o ID interno no motivo. A decisão de `paid`/`failed` continua pela tela de saques/RPC já existente após conferir o provedor; nenhuma conciliação real foi tentada.
- **Causa-raiz:** efeito externo precede a persistência da referência. Corrigido localmente o descarte silencioso da única referência: agora existe uma operação de revisão durável sempre que a inbox do banco estiver disponível.
- **Reprodução segura:** TDD com AgPay mockado e banco em memória: `providerRef` sintética, update da referência falha, e a inbox recebe evento `error`; repetição com a mesma chave não repete o payout. Antes da implementação, o teste falhou porque a inbox não tinha evento. `src/lib/withdrawal.server.test.ts`: 37/37; `src/lib/agpay.server.test.ts` + teste de saque: 51/51.
- **Correção aplicada:** upsert deduplicado por hash do saque e da referência; falha do próprio upsert é registrada no log do servidor e não remove o estado `processing` nem dispara novo payout.
- **Regressão:** update falho cria evento de revisão; repetição idempotente não cria outro payout; fila existente deixa referência e ID do saque visíveis ao Master.
- **Limitação residual:** se a escrita da referência e a inbox falharem, a referência só permanece no log do servidor. A correção não faz reconciliação automática nem verifica o estado do cashout no provedor; nenhuma chamada, payout ou mutação remota ocorreu.

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

### PAY-037 — cobrança Pix sem QR persistido não tem caminho local de recuperação

- **Estado (2026-11-15):** causa local confirmada; recuperação automática bloqueada até o AgPay especificar o schema de consulta de Pix por UUID.
- **Gravidade:** P2 potencial.
- **Módulo:** pagamentos / geração de Pix de sinal.
- **Esperado:** depois de criar cobrança externa, o sistema deve recuperar o código Pix ou manter um estado de conciliação com ação operacional que permita entregá-lo/cancelá-lo sem duplicar a cobrança.
- **Observado:** `createPixCharge` permite `data.pix_code` ausente e devolve `qrCode: null` (`src/lib/agpay.server.ts:111-140,168-181`). `generateDepositPix` persiste `provider_payment_id` antes de validar que o QR existe (`src/lib/booking.functions.ts:1090-1115`); sem código, lança erro e `paymentRecorded` faz o claim ser liberado como `criado` (`:1018-1032,1144-1148`). Em uma chamada posterior, embora o QR local continue nulo, a presença de `current.provider_payment_id` faz o handler abortar com “aguarda conciliação” antes de outro POST (`:1069-1073`). O endpoint de status consulta situação financeira, mas não recupera nem grava `pix_code` (`src/lib/agpay-events.server.ts:424-460`; `fetchPayment` não mapeia esse campo, `agpay.server.ts:143-154,223-242`). Um erro na segunda gravação do QR após persistir o ID externo produz estado equivalente.
- **Impacto:** cliente pode não receber QR e não há retry local que recupere esse dado; a cobrança externa fica vinculada apenas por ID. A cobrança ainda pode ser paga por algum canal externo, mas isso não foi demonstrado.
- **Reprodução segura:** mockar `createPixCharge` para devolver ID/status sem `pixCode` (ou falhar a persistência do QR depois de salvar o ID); confirmar que a primeira tentativa retorna erro e tentativas posteriores não fazem novo POST nem devolvem o QR. Não executado neste ciclo.
- **Causa-raiz:** prevenção contra POST duplicado não é acompanhada por um mecanismo de reconciliação que restaure os dados de pagamento ao estado local.
- **Correção recomendada para spec:** definir contrato de resposta mínima do provedor e fluxo de recuperação pelo ID externo; separar cobrança externa criada sem QR de rejeição e disponibilizar reconciliação/compensação sem novo POST.
- **Regressão:** resposta válida devolve QR; resposta 2xx sem QR não cria POST duplicado em retry e se reconcilia por ID; falha ao persistir QR não perde o caminho de recuperação; timeout permanece protegido contra duplicidade.
- **Revalidação externa:** `https://agpay.services/documentacao` (HTTP 200, 2026-11-15) documenta resposta de criação Pix com `pix_code`/`qr_code` e menciona consulta por UUID em outra seção, mas não especifica que o GET retorna esses campos nem documenta a resposta parcial sem QR. O código persiste o UUID e impede outro POST, mas o adapter não mapeia QR na consulta.\n- **Bloqueio:** sem schema oficial ou sandbox não é seguro assumir que o GET devolve QR nem implementar recuperação que pode continuar falhando. Necessário contrato do provider para payload de consulta/recuperação de QR. Nenhuma chamada autenticada ou cobrança foi feita.

### PAY-038 — retry após timeout ambíguo pode criar outra cobrança AgPay

- **Estado (2026-11-15):** causa local revalidada; correção automática bloqueada até confirmar contrato de idempotência/reconciliação do AgPay. Aceitação de POST após timeout não demonstrada.
- **Gravidade:** P2 potencial.
- **Módulo:** pagamentos / criação de Pix de sinal / idempotência.
- **Esperado:** resultado ambíguo de criação deve permanecer conciliável sem emitir um segundo POST potencialmente duplicado, até se provar que a primeira tentativa não criou transação.
- **Observado:** `agpayFetch` aplica timeout de 8 segundos e transforma falhas de rede/timeout em `Error` genérico (`src/lib/agpay.server.ts:8,60-79`). `generateDepositPix` lança o POST por `pixExternalStep`; quando falha após `mark_deposit_pix_post_started`, `release_deposit_pix(..., 'falhou')` converte `post_enviado` em `post_incerto` (`src/lib/booking.functions.ts:941-954,1075-1084,1018-1032`; `supabase/migrations/20260924124620_pix_rejection_release.sql:64-87`). A função SQL permite novo `mark_deposit_pix_post_started` quando esse estado tem mais de dois minutos (`:8-45`). O POST `/payments/pix` não inclui chave de idempotência nem `external_id` (`src/lib/agpay.server.ts:168-181`); o comentário local afirma que AgPay não oferece busca por referência externa (`booking.functions.ts:1075-1076`).
- **Impacto:** se o primeiro POST tiver criado cobrança mas a resposta se perdeu, um retry após a carência pode criar uma segunda transação externa sem reconciliar a primeira. A primeira pode ficar sem vínculo local e sem QR entregue; status e expiração externos para esse caso não foram demonstrados.
- **Reprodução segura:** mock de transporte em que o AgPay aceita o primeiro POST, mas a conexão expira antes da resposta; avançar relógio além de dois minutos e repetir; observar se o adaptador emite segundo POST e se há correlação da primeira tentativa. Não executado nesta rodada.
- **Causa-raiz:** cooldown temporal substitui reconciliação por idempotency key ou referência consultável para resolver o efeito externo de uma tentativa ambígua.
- **Correção recomendada para spec:** formalizar estratégia de idempotência/reconciliação com o gateway; manter estado incerto sem novo POST até confirmar ausência da transação ou usar referência estável e única por charge.
- **Regressão:** timeout antes/depois de aceite externo não gera transação duplicada; resposta rejeitada comprovadamente não criada pode liberar retry; evento tardio da primeira tentativa associa-se à cobrança correta.
- **Revalidação externa:** consultei `https://agpay.services/documentacao` por HTTPS em 2026-11-15 (HTTP 200). A criação Pix documenta UUID, status e QR; a página não documenta chave de idempotência, `external_id` ou busca por chave que resolva uma resposta perdida. Um GET por UUID não ajuda quando o timeout perde esse próprio UUID. Ausência de documentação não prova que o recurso inexista, mas não autoriza assumir suporte.\n- **Bloqueio:** não alterei a janela de retry nem acrescentei um header/campo inventado. Bloquear indefinidamente `post_incerto` sem fluxo operacional também deixa cobranças sem recuperação. É necessário contrato escrito do AgPay ou comportamento confirmado em sandbox para escolher uma correção segura. Nenhuma chamada autenticada, cobrança ou dado de produção foi acessado.

### PAY-033 — rejeição definitiva do AgPay recebe cooldown de erro ambíguo

- **Estado:** divergência entre migration, chamador e teste confirmada localmente; ocorrência em produção desconhecida.
- **Gravidade:** P3 (pode atrasar nova tentativa em até dois minutos após rejeição definitiva).
- **Módulo:** pagamentos / geração e retry de Pix de sinal.
- **Esperado:** rejeições definitivas classificadas pelo adaptador como `rejeitado`, liberando retry imediato conforme a migration; timeouts e respostas ambíguas permanecem em cooldown para evitar POST duplicado.
- **Observado:** `20260924124620_pix_rejection_release.sql` permite `_outcome='rejeitado'` e `mark_deposit_pix_post_started` aceita esse estado sem espera. Porém `generateDepositPix` só escolhe esse outcome se o erro tiver `pixAttemptOutcome='rejeitado'` (`src/lib/booking.functions.ts:1018-1028`). `pixExternalStep` substitui qualquer erro de `createPixCharge` por um `Error` genérico (`:941-954`), enquanto `agpayFetch` expõe rejeições HTTP como `AgpayApiError` com status/errors (`src/lib/agpay.server.ts:18-27,93-109`). O teste mockado atual injeta erro com código e espera `release_deposit_pix(..., 'falhou')` (`src/lib/booking.functions.test.ts:462-473`). A migration mantém `post_enviado` como `post_incerto` no outcome `falhou`; retry é barrado até `pix_post_started_at` ter pelo menos dois minutos (`20260924124620_pix_rejection_release.sql:8-45,64-78`).
- **Impacto:** após rejeição definitiva que não criou cobrança, o cliente pode receber erro e não conseguir repetir imediatamente. A classificação conservadora é útil para timeout/5xx ambíguo, mas perde o caminho de retry imediato que a migration prevê para rejeição conhecida.
- **Causa-raiz:** a camada que sanitiza erros não preserva nem define a classificação consumida pelo release; o teste reforça `falhou` mesmo para rejeição com código.
- **Reprodução segura:** executei apenas `npx vitest run src/lib/booking.functions.test.ts -t "normaliza rejeição do AgPay e libera o claim como falhou"`; 1 teste passou, com mocks e sem chamada externa. O teste confirma a expectativa vigente; a divergência de cooldown foi inferida cruzando source, teste e migration, sem esperar dois minutos em DB.
- **Correção recomendada para spec:** definir classificação explícita por status/códigos documentados do AgPay, preservando somente rejeições realmente definitivas como `rejeitado`; manter timeout, conexão interrompida e respostas 5xx como incertas.
- **Regressão:** rejeição 4xx documentada permite nova tentativa imediata; timeout/5xx continua protegido contra POST duplicado; erro de release preserva claim/reconciliação; sem provider real no ensaio.
- **Limitação:** códigos/status efetivamente retornados pelo AgPay e frequência do cenário em produção não foram verificados.

### PAY-034 — confirmações concorrentes podem encurtar acesso de assinatura

- **Estado:** risco de concorrência confirmado pela estrutura do código; execução simultânea não reproduzida e ocorrência em produção desconhecida.
- **Gravidade:** P2 potencial (acesso pago pode ser reduzido para uma data de expiração anterior).
- **Módulo:** pagamentos / renovação de assinatura / webhook.
- **Esperado:** aplicar `max(access_until, period_end)` de forma atômica e monotônica, como exige T062 da spec local.
- **Observado:** `confirmSubscriptionCharge` lê `businesses.access_until`, compara em memória com `charge.period_end` e depois faz UPDATE sem condição de monotonicidade (`src/lib/agpay-events.server.ts:174-203`). Duas confirmações com alvos diferentes podem ler o mesmo valor vigente; se a de alvo maior gravar primeiro e a de alvo menor gravar depois, a segunda sobrescreve o vencimento maior. Não encontrei trigger/RPC de banco que aplique `GREATEST` a `access_until` nas migrations pesquisadas. A spec/task T062 descreve `via max`, “nunca encurta”. Os testes existentes verificam retries sequenciais e o caso em que o acesso já é maior (`src/lib/agpay-events.server.test.ts:574-630`), mas não sincronizam duas confirmações concorrentes.
- **Condição necessária:** duas cobranças pagas para o mesmo negócio com `period_end` distintos, processadas simultaneamente. PAY-017 registra que cobranças duplicadas podem ser criadas; essa duplicidade, isoladamente, costuma compartilhar o mesmo período e não demonstra este cenário. Sobreposição de execuções do worker ou outra chamada concorrente não foi confirmada na implantação.
- **Impacto:** um negócio pode perder parte do acesso que já havia sido concedido por outra cobrança, apesar de ambos os pagamentos estarem confirmados.
- **Causa-raiz:** verificação de monotonicidade e UPDATE são operações separadas sem lock por negócio ou operação atômica no banco.
- **Reprodução segura:** harness sintético poderia sincronizar duas chamadas antes do UPDATE, retornar o mesmo `access_until` para ambas e aplicar primeiro o alvo maior, depois o menor; nenhuma reprodução foi executada nesta rodada.
- **Correção recomendada para spec:** persistir o maior entre o acesso atual e o alvo numa única operação atômica (ou lock transacional por business), mantendo a idempotência da transição e do histórico.
- **Regressão:** cenários concorrentes com alvos iguais, diferentes em ordem crescente/decrescente, webhook repetido, acesso nulo e falha parcial; assertir que o valor final nunca diminui.
- **Limitação:** concorrência efetiva do worker, dados de cobrança e estado atual de acesso não foram consultados; nenhum evento ou pagamento foi processado nesta auditoria.

### PAY-035 — estados terminais conflitantes do webhook de saque não são reconciliados

- **Estado:** comportamento local confirmado; risco dependente de evento fora de ordem/estado revisado pelo provedor, sem evidência de que ocorra no AgPay.
- **Gravidade:** P2 potencial (se um saque liquidado como falho for depois confirmado como pago, o saldo liberado pode financiar outro saque).
- **Módulo:** pagamentos / saque / eventos AgPay.
- **Esperado:** um resultado terminal posterior que contradiga o primeiro deve disparar consulta/reconciliação confiável com o provedor, sem liberar novamente saldo já pago.
- **Observado:** `processWebhookEvent` mapeia `withdrawal.failed`/`withdrawal.rejected` a `failed` e `withdrawal.completed` a `paid` (`src/lib/agpay-events.server.ts:481-498`). `ledger_settle_withdrawal` só transiciona de `requested`/`processing`; qualquer estado terminal existente vira no-op (`supabase/migrations/20260929120300_ledger_settle_withdrawal.sql:39-48`). Assim, se um evento `failed` for liquidado primeiro, a RPC devolve o débito bloqueado e reverte para saldo disponível; uma confirmação `completed` posterior não atualiza status nem refaz o bloqueio.
- **Impacto condicional:** o negócio poderia solicitar novo saque com saldo já devolvido e, se o primeiro payout também tiver sido efetivamente pago, ocorrer duplicidade de saída. O código local não consulta status atual do saque no provedor antes de aplicar o primeiro evento terminal.
- **Causa-raiz estrutural:** transições terminais são irreversíveis na RPC e o worker trata nomes de eventos como verdade terminal, sem comparação de versão/tempo de estado do provedor.
- **Evidência externa:** a busca pública e a tentativa de abrir `https://agpay.services/documentacao` nesta rodada não forneceram contrato consultável sobre reordenação ou revisão de status; o documento público já revisado lista tipos de evento, mas não define essas transições. Não há payload de sandbox disponível.
- **Reprodução segura:** somente com fake DB e eventos sintéticos: processar `withdrawal.failed`, depois `withdrawal.completed` para mesma referência, e observar estado final `failed` e RPC sem mudança no segundo evento. Não foi executada nesta rodada e não representa comportamento real do gateway.
- **Correção recomendada para spec:** obter contrato oficial dos estados e ordenar/reconciliar transições terminais por consulta autenticada/versionamento, ou encaminhar conflito para revisão sem disponibilizar novamente saldo.
- **Regressão:** sequência failed→completed, completed→failed, duplicatas idênticas e `pending` tardio; validar status financeiro, locked/available e alertas de conflito, sempre com provider mockado.
- **Limitação:** possibilidade de reordenação/revisão pelo AgPay, entrega efetiva, saque afetado e configuração produtiva não foram verificados. Não classificar como falha confirmada.

## Consequência do estorno do sinal para a reserva — regra pendente

- **Comportamento observado:** o branch de refund em `src/lib/agpay-events.server.ts:518-530` lê o pagamento, assegura o crédito original e cria um débito idempotente no ledger; não atualiza `deposit_payments.status` nem `appointments.status`. A chave pública de cancelamento segue outro fluxo: `cancelAppointmentPublic` muda appointment para `cancelado` (`src/lib/booking.functions.ts:526-558`).
- **Contrato localizado:** spec 005 US3/FR-009 especifica o efeito financeiro no ledger (débito do líquido); spec 004 cenário de cancelamento especifica cancelar agendamento e liberar horário por ação do cliente, mas não associa esse ato a estorno automático. Os documentos revisados não estabelecem se um evento financeiro de refund deve também cancelar uma reserva ainda ativa.
- **Classificação:** inconclusivo quanto à regra de negócio, sem novo ID de defeito. Não assumir que todo estorno equivale a cancelamento: pode ser ajuste financeiro sem cancelar atendimento. Mas também não há evidência de que o cliente ou estabelecimento receba um fluxo para atualizar a reserva após um refund originado no gateway.
- **Verificação segura:** confirmar regra comercial e fluxo operacional do estabelecimento; em ambiente de ensaio, verificar separadamente refund de reserva ativa e refund de reserva já cancelada, ledger, status e disponibilidade. Nenhum evento, valor ou registro remoto foi consultado ou modificado.





#### PAY-033 — verificação documental de 2026-11-15

A documentação oficial da VeoPag para `POST /api/payments/deposit` descreve 422 como rejeição permanente de payload, 500 como `PROVIDER_UNAVAILABLE` e recomenda `external_id` estável para idempotência ([criação de cobrança PIX](https://veopag.readme.io/reference/createdeposit)). O código local chama o wrapper AgPay (`https://agpay.services/api/v1/payments/pix`), que é outro contrato e não oferece evidência de que repasse o status/código da VeoPag ou aceite a mesma referência externa. Os status diretos da VeoPag não são transferidos por suposição para o wrapper; o item fica bloqueado até obter o contrato aplicável.

Revalidação em 2026-11-15: tentei localizar o contrato AgPay oficial e verificar o painel somente leitura. A busca pública não retornou documentação oficial verificável para os códigos de rejeição desse wrapper; a sessão de automação do Windows falhou ao conectar ao pipe nativo, então o painel não foi acessado. A implementação local segue mostrando que `pixExternalStep` converte o erro do AgPay em `Error` genérico antes de `generateDepositPix`, e o outcome cai em `falhou`; no entanto, sem evidência contratual do AgPay não é seguro converter respostas HTTP específicas em `rejeitado` nem prometer retry imediato. Sem mudança de código ou chamada ao gateway. PAY-033 permanece bloqueado por contrato externo; ocorrência em produção desconhecida. A contagem geral reportada de 128/17/6 continua não reconciliada por item e não foi recalculada nesta verificação.

#### PAY-034 — disposição após correção local (2026-11-15)

`confirmSubscriptionCharge` agora condiciona o `UPDATE` a `access_until IS NULL OR access_until < period_end` na própria gravação. O filtro SQL preserva o maior alvo mesmo quando duas transações leram o mesmo prazo antes de disputar o lock da linha; não foi necessária migration. O teste unitário ficou vermelho sem o filtro e passou com ele. Regressão PostgreSQL local sincronizou duas transações nos dois ordenamentos (maior-primeiro e menor-primeiro) e confirmou o prazo final mais longo. Teste DB: 1/1; cadeia DB: 6 arquivos/88 testes; `npm test`: 123 arquivos/1005 aprovados/8 ignorados; TypeScript passou. Nenhuma cobrança/webhook ou dado remoto usado. Produção não verificada.

#### PAY-021/PAY-023 — disposição após correção local (2026-11-15)

A deduplicação de avisos saiu da consulta por título com janela fixa de 45 dias e passou para `dedupe_key = access_until + title`, com índice único `(business_id, dedupe_key)` e `upsert(..., ignoreDuplicates: true)`. A unicidade no PostgreSQL arbitra concorrência; um ciclo seguinte, com `access_until` diferente, aceita o mesmo título. RED reproduziu a supressão após 30 dias; teste de rota confirmou novo alerta no ciclo seguinte e deduplicação de reruns. PostgreSQL descartável testou duas transações concorrentes e uma segunda chave de ciclo. `npm test`: 123 arquivos, 1006 aprovados/8 ignorados; DB: 7 arquivos/89 testes; TypeScript passou. Migration só no ensaio local. Sem cron, evento ou dado de produção.


### PAY-028 corrigido localmente ? 2026-11-15

As agrega??es de lifecycle, receb?veis, vis?o geral Master e dossi? agora percorrem p?ginas de 1.000 linhas com `range` e ordena??o est?vel, falhando fechado se qualquer p?gina falhar. Eventos/notas limitados a 60/100 continuam como listas recentes de interface, sem alimentar totais agregados. Teste de lifecycle com 20.001 agendamentos reproduziu o corte anterior e agora retorna todos; testes de pagina??o e integra??o: 6 arquivos/22 testes passaram. Su?te completa: 128 arquivos, 1.019 testes aprovados, 3 arquivos e 8 testes ignorados; TypeScript e diff check passaram (avisos preexistentes LF/CRLF). Sem produ??o ou migration. Contagem: 101 corrigidos localmente, 9 bloqueados/n?o verificados e 41 pendentes de 151.

### PAY-031 revalidado — 2026-11-15

O handler atual inspeciona o erro da segunda gravação (`businesses.agpay_access_blocked=false`) e lança “Chave aprovada, mas não foi possível remover o bloqueio de acesso AG Pay.” A rota captura a rejeição e mostra `toast.error`; só mostra sucesso e invalida a lista quando o handler conclui. `src/lib/pix-approvals.functions.test.ts` injeta sucesso na aprovação seguido de erro no desbloqueio e verifica a rejeição explícita, além do caso de sucesso: 2/2. Isto satisfaz a alternativa documentada de comunicar claramente a conclusão parcial; as duas gravações continuam não atômicas e isso permanece risco residual de estado, sem mudança de chave/bloqueio remoto.
### PAY-014 corrigido localmente — 2026-11-15

O contrato oficial consultado documenta `data.amount` em reais. Webhook e polling agora comparam o valor bruto convertido em centavos com a cobrança local antes de qualquer crédito ou renovação de assinatura. Valor divergente, ausente ou inválido é retido para revisão; consulta divergente grava evento revisável. A tela Master lista esses eventos. Cobertura: discrepância menor, ausência do campo, assinatura divergente/compatível e consulta divergente. Teste RED reproduziu crédito indevido antes da correção; regressão completa e DB isolado passaram. Ver Ciclo 81 em `CHECKLIST-MESTRE.md`. Nenhuma chamada ao gateway ou alteração de produção.
### Revalidação de PAY-009, PAY-011 e PAY-017 — 2026-11-15

PAY-009/PAY-011 foram revalidados como corrigidos localmente: PIN e aprovação da chave são verificados no caminho server-side antes da reserva de saldo/solicitação AgPay; 75 testes relacionados passaram. PAY-017 permanece confirmado no código: a função cria nova cobrança Pix sem consultar pendências, e não há informação persistida de QR para reabrir a cobrança existente. A solução depende da experiência desejada ao voltar a uma janela fechada e da regra de expiração/pagamento tardio; nenhuma cobrança real foi criada.
### Revalidação de PAY-032/PAY-036 — 2026-11-15

A documentação oficial pública (`https://agpay.services/documentacao`) descreve `POST /cashout/pix` e um identificador `withdrawal.id` na resposta, mas não documenta chave idempotente, consulta de saque por essa referência ou garantias de que erro HTTP/timeout implique ausência de payout. Portanto PAY-032 segue aberto: a referência ainda é persistida após a chamada externa; sua perda em falha de escrita não tem recuperação oficial comprovada.

PAY-036 foi mitigado localmente: somente HTTP 422 e o marcador explícito `success:false` são classificados como rejeição definitiva; HTTP 5xx e HTTP 2xx incompleto mantêm o saque `processing` e o saldo reservado. Testes em `withdrawal.server.test.ts` cobrem 5xx e resposta 2xx sem referência, e `agpay.server.test.ts` cobre mapeamento; os dois arquivos passaram (50/50). Limite residual: não há contrato acessível que confirme se todo 422/`success:false` prova ausência de payout externo; nenhuma chamada de saque foi feita.
### Ciclo 82 — reconciliação dos P2 financeiros (2026-11-15)

Revalidei PAY-010, PAY-013, PAY-016, PAY-019, PAY-022, PAY-023, PAY-025, PAY-026, PAY-028 e PAY-029 no código e atualizei o índice canônico `problemas.md` e os estados dos achados. Cobertura dirigida: AgPay events, performance, transações, lifecycle, hook de lifecycle, assinatura e charges — 7 arquivos/86 testes aprovados. `npm test` completo no ciclo 81 passou com 1.057/8 ignorados; DB completo 99/99. Esses dez itens já constavam entre os corrigidos locais e não alteram o tally 114/11/26. Nenhum cron, webhook, cobrança, DB remoto ou saldo foi acionado.
### PAY-020 corrigido localmente — 2026-11-15

A coluna que renderiza `netCents` foi renomeada de “Lucro Ag Pay” para “Valor líquido”. A fórmula e o saldo continuam iguais; a UI não atribui lucro da plataforma ao valor líquido do recebedor. TDD: teste SSR falhou com o título antigo e passou com o novo. Focal 3/3; TypeScript passou; `npm test`: 136 arquivos aprovados, 3 ignorados; 1.058 testes aprovados, 8 ignorados; `git diff --check` sem erros (avisos LF/CRLF preexistentes). Sem escrita remota ou financeira. Contagem dos 151 IDs: 115 corrigidos, 11 bloqueados/não verificados e 25 pendentes; API-006 segue adicional fora do tally.

### PAY-017 — revalidação e bloqueio de correção segura (2026-11-15)

A causa foi confirmada novamente em src/lib/subscription-charge.functions.ts e src/lib/agpay.server.ts: cada chamada executa POST ao AgPay antes de gravar uma nova linha pending; a requisição não envia chave de idempotência, não consulta cobrança pendente e não persiste o QR nem expires_at. A UI também permite reabrir e chamar novamente. Uma trava apenas por business no banco não resolve a janela de crash entre o POST externo e a persistência, e não há contrato verificado que permita repetir o POST com chave estável ou consultar e reconciliar a cobrança pelo client reference. Também falta política para Pix vencido pago tardiamente ou dois IDs pagos. Por isso, não apliquei mitigação parcial que pudesse trocar duplicidade por cobrança órfã ou impedir recuperação. PAY-017 permanece bloqueado até confirmação do contrato do AgPay e decisão do produto sobre ciclo/expiração/pagamento tardio. Nenhuma chamada de gateway foi realizada.
### PAY-024 — causa e lacuna de semântica confirmadas (2026-11-15)

Revalidei a confirmação de cobrança: ela atualiza access_until e charge status/history; não limpa status nem cancelled_at do negócio. cancel_overdue_business grava status=cancelado e cancelled_at após a janela de atraso; ação Master efetivar também grava cancelled_at, enquanto reverter limpa ambos. Não há campo local que diferencie cancelamento por inadimplência de cancelamento voluntário/administrativo. Como a spec exige restaurar acesso em regularização, mas o evento de pagamento não prova que o cancelamento foi somente por atraso, limpar marcadores automaticamente pode reativar um cancelamento deliberado. Mantido bloqueado até separar causa/origem do cancelamento ou confirmar a regra do produto. Nenhum estado real foi alterado; tally 127/17/7.
### PAY-012 — janela temporal sem regra de reconhecimento (2026-11-15)

Revisei o filtro e o contrato local: getAgpayPerformance seleciona deposit_payments por created_at, inclui paid_at no payload e classifica pagamentos por status/paid_at. A spec revisada não define se a carteira agrupa tentativas criadas no período ou valores reconhecidos quando pagos; não há cenário de webhook tardio nos testes existentes. Não alterei o filtro nem reescrevi o comentário, pois isso escolheria política contábil sem evidência. Pendente definição da data de reconhecimento; tally não alterado (128/17/6).


### PAY-016 ? falha de Pix de assinatura encerra o estado pendente (revalidado em 2026-11-15)

O handler `transaction.failed` consulta primeiro `deposit_payments`; quando nao encontra referencia, procura `subscription_charges` por `provider_payment_id` e altera somente `pending` para `failed` com compare-and-set. Uma cobranca ja paga nao regride. O teste `npx vitest run src/lib/agpay-events.server.test.ts -t "transaction.failed encerra uma cobran?a pendente de assinatura sem regredir uma paga"` passou 1/1 (38 ignorados pelo filtro), com provider e DB simulados. Nenhum evento real foi processado. A observacao inicial de ausencia da transicao esta supersedida pelo handler/teste atual; o contrato do evento no AgPay e deploy continuam nao verificados.


### PAY-009/PAY-011 ? PIN e aprovacao de chave impostos no servidor (revalidado em 2026-11-15)

`createWithdrawal` valida o PIN contra o hash do negocio e confere se a chave e tipo atuais correspondem a um registro `pix_key_approvals` aprovado antes de inserir/reservar o saque. Os casos negativos confirmam que PIN incorreto ou aprovacao ausente/divergente impede criar withdrawal e nao chama o provider. Regressao completa do arquivo mockado: `npx vitest run src/lib/withdrawal.server.test.ts` passou 37/37. Nenhum saque real foi solicitado. Migration/deploy e chaves existentes em producao nao foram verificados; as descricoes iniciais de bypass estao supersedidas pela chain/codigo local atual.


### PAY-013/PAY-019/PAY-025/PAY-026 ? consultas financeiras falham fechadas e paginam (revalidado em 2026-11-15)

Revalidei os handlers e testes atuais: PAY-013 propaga erros e pagina agregados AgPay; PAY-019 propaga erros e pagina datasets da lista de transacoes; PAY-025 interrompe precificacao/emissao se a contagem de profissionais falhar; PAY-026 propaga erro de leitura do negocio/historico em vez de tratar como vazio. Lote focal: `npx vitest run src/lib/agpay-performance.functions.test.ts src/lib/transactions.functions.test.ts src/lib/subscription.functions.test.ts src/lib/subscription-charge.functions.test.ts` passou 4 arquivos/26 testes. Nenhum dado financeiro remoto, cron ou cobranca foi consultado/processado. Producao nao verificada; os estados originais de falha no codigo estao supersedidos pela chain local atual.


### Revalidacao da documentacao publica AgPay: PAY-007, PAY-037 e PAY-038 - 2026-11-15

Consultei https://agpay.services/documentacao por HTTPS (HTTP 200). O exemplo de criacao Pix documenta transaction_uuid, status, qr_code, pix_code, expires_at e expires_in_seconds. Isso confirma somente os dados da resposta inicial. A secao publica de consulta de transacoes lista status, page e limit, sem filtro por UUID ou schema de detalhe Pix. A rota /payments/{transaction_uuid} aparece na secao de cartao/VeoPag e nao comprova suporte de consulta Pix. A pagina nao documenta chave idempotente ou external_id. Tambem nao encontrei nomes/payloads publicos de eventos de estorno/chargeback; essa ausencia nao prova que os recursos nao existam.

PAY-037 segue bloqueado: a recuperacao do QR apos perda da resposta de criacao nao esta documentada. PAY-038 segue bloqueado: os docs nao comprovam retry idempotente ou conciliavel apos timeout. PAY-007 segue bloqueado: nomes/payloads oficiais de estorno nao estao disponiveis. Nao alterei comportamento nem inventei rota, campo ou evento. E necessario contrato oficial adicional ou confirmacao em sandbox autorizado. Nenhuma chamada autenticada, cobranca, consulta a dados privados ou escrita de producao foi feita.


### PAY-035 revalidado contra documentacao publica AgPay - 2026-11-15

A consulta HTTPS a https://agpay.services/documentacao (HTTP 200) lista os eventos withdrawal.completed (saque processado com sucesso) e withdrawal.pending (aguardando processamento). Nao lista withdrawal.failed nem withdrawal.rejected; tambem nao define revisao de estado, ordem de entrega, versao do evento ou consulta de reconciliacao. A implementacao local continua tratando failed/rejected como terminais: ledger_settle_withdrawal devolve o valor bloqueado e nao muda um saque que ja esteja terminal, portanto completed posterior ao failed nao restaura o status nem o bloqueio. Sem contrato dos eventos negativos e de estados conflitantes, nao alterei a regra: ignorar a falha pode prender saldo; liberar saldo com evento nao documentado pode permitir saque duplicado. PAY-035 segue bloqueado por contrato oficial ou confirmacao em sandbox autorizado. Nenhum webhook, saque ou dado privado foi acessado.


### Reconciliacao PAY-010/014/020/023/028/031/034/036 - 2026-11-15

Revalidacao focal atual: 9 arquivos/104 testes unitarios e 2 testes DB descartaveis aprovados. PAY-010 vincula idempotency key ao negocio; PAY-014 compara valor bruto do evento/consulta antes de creditar; PAY-020 corrige rotulo sem alterar calculo; PAY-023 deduplica por ciclo; PAY-028 pagina agregacoes com ordem estavel; PAY-034 aplica renovacao monotona; PAY-031 propaga falha da segunda gravacao sem reportar sucesso, mas segue nao atomico; PAY-036 mantem saque processing e saldo reservado em 5xx/2xx incompleto, mas contrato sobre 422/success:false continua sem confirmacao publica. Sem saque, webhook, cobranca ou dados remotos.


### Reconciliacao PAY-001/PAY-008 - 2026-11-15

PAY-001: modelo 004 recebe o sinal integral na plataforma e realiza saque posterior; flag split e email sao legados e nao roteiam o Pix local, mas agpay_split_status ainda mapeia cartao no lifecycle. Sem definicao se a flag ainda habilita metodo de assinatura, mantido parcialmente mitigado/bloqueado para decisao; nao removi leitura nem alterei rotulo. PAY-008: o produto local segue Pix-only nas jornadas de sinal e assinatura; nao encontrei requisito de cartao nas specs revisadas. SubscriptionPaymentMethodSelector.test.tsx revalidado no lote de 93 testes. Nenhuma chamada ao gateway ou mudanca de fluxo financeiro.


### Reconciliacao ADM-001/DB-003/DOC-001/PRO-001/PAY-022/PAY-027/PAY-029 - 2026-11-15

Regressao atual: 10 arquivos/144 testes unitarios aprovados e 1 ignorado; DB do limite de profissionais passou 2/2 filtrado; node --check scripts/ensaio/db.mjs passou. ADM-001: status cancelado e apresentado como Cancelado. DB-003: JSDoc bate com retorno. DOC-001: nota separa deploy aa4a32e do HEAD 323189d; git confirma 24 commits posteriores e ancestralidade do hash, sem confirmar producao. PRO-001: limite de 10 bloqueia cadastro acima do teto em DB e fluxo server-side. PAY-022: hook pagina todas as empresas. PAY-027: pagamentos anteriores impedem classificacao trial/cancelamento indevido. PAY-029: evento de refund sincroniza ledger, status e agregados; contrato oficial de refund e regra de retencao de comissao seguem nao verificados. Sem cron, webhook, conta, deploy ou dados remotos.


Additional PAY-033 revalidation (2026-11-15): public search for AgPay error/idempotency documentation returned no results and known documentation URLs were inaccessible. The local wrapper still discards the error class/status in `pixExternalStep`; the migration distinguishes `rejeitado` from `falhou`, but no safe evidence maps AgPay HTTP statuses. Remains blocked; no code change or external call.


PAY-005 revalidado (2026-11-15): `npx vitest run src/lib/agpay.server.test.ts` passou 14/14, cobrindo Bearer, `Accept`, `X-Client-ID` opcional, proxy e resposta 3xx. O GET read-only anterior respondeu 200 com e sem `X-Client-ID`; nenhum POST financeiro foi feito. Corre??o local validada; sandbox POST e runtime de produ??o permanecem sem evid?ncia.


### Busca oficial adicional por contratos AgPay ? 2026-11-15

Consultas ao dominio `agpay.services` para idempotencia/external_id de Pix, recuperacao de QR, erros do POST, cashout/withdrawal, refund e chargeback retornaram busca vazia; abrir as URLs conhecidas de documentacao tambem falhou em tentativa anterior. Isso e evidencia limitada de indisponibilidade de documentacao consultavel, nao prova de que o contrato inexista. PAY-007/017/032/033/035/037/038 permanecem sem base suficiente para inferir rejeicao definitiva, retry, recuperacao, refund ou transicao de saque. Nenhuma chamada ao gateway, pagamento ou mutacao foi feita.


### PAY-033 corrigido localmente com contrato oficial (2026-11-15)

A pagina oficial `https://agpay.services/documentacao` responde HTTP 200 e lista 400 (Bad Request), 401 (nao autenticado), 403 (acesso negado), 404 (nao encontrado), 422 (erro de validacao) e 500 (erro interno). `pixExternalStep` agora preserva uma classificacao interna: 400/401/403/404/422 marcam a tentativa como `rejeitado`, permitindo retry controlado; 3xx, 5xx e falhas sem resposta permanecem `falhou`/`post_incerto`, sem novo POST imediato. RED: cinco casos documentados liberavam incorretamente como `falhou`; GREEN: `booking.functions.test.ts` 124/124, incluindo 302/500 ambiguos; `npx tsc --noEmit` passou. Nenhuma chamada autenticada ao gateway ou pagamento real. Sem validacao de runtime de producao.

### PAY-015 — evidencia de taxa fixa encontrada no WhatsApp (2026-11-15)

Atualizacao 2026-11-15: o usuario confirmou a captura como regra vigente. O ledger local agora cobra R$ 0,20 de comissao da plataforma por pagamento de sinal, separada dos R$ 0,75 de custo de gateway (R$ 0,95 de descontos combinados); o percentual permanece em 0%. A taxa de saque de R$ 3,00 ja estava aplicada. PAY-015 esta resolvido localmente; nao houve deploy nem alteracao de pagamentos em producao. Esta decisao supersede a anotacao anterior de pendencia.


### PAY-007 - mitigacao do contrato ausente (2026-11-16)

Documentacao oficial retornou HTTP 200 e lista cinco eventos de pagamento/saque, sem contrato de refund/chargeback. Removi o debito automatico baseado em nomes especulativos. Marcadores de estorno/chargeback sao colocados em `error` para revisao Master, sem alterar saldo; testes cobrem `transaction.refunded` e `transaction.updated` com status `charged_back`. O processamento automatico de estorno continua pendente ate confirmacao oficial do evento/payload.

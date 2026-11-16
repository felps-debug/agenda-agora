# Frontend e jornadas — cobertura inicial

**Estado:** triagem estática, sem execução em browser nesta etapa.

## Mapa de rotas

- Público: `/`, `/agendar/$slug`, `/auth`, `/sdr`, `/painel-sdr`.
- Painel autenticado: agenda, clientes, serviços, profissionais/equipe, funcionamento/bloqueios, alertas, configurações, integrações, carteira, transações, recebíveis, relatórios, templates e suporte.
- Master: overview, negócios, assinantes, testes, erros, alertas, recebíveis/transações, carteira, aprovações Pix, equipe e suporte.
- APIs: webhooks AgPay/WhatsApp e hooks cron.

## Fluxos ligados ao código observados

- **Agendamento:** formulário público chama server functions para catálogo, disponibilidade, reserva e, quando há sinal, `PaymentDialog` gera Pix e consulta status; status de pagamento atualiza jornada.
- **Integrações:** página `painel.integracoes.tsx` usa funções reais de connect, refresh QR, status, disconnect e mensagem de teste; disponibilidade de mensagem depende de provider e permissões.
- **Assinatura:** `SubscriptionPixPayment.tsx` cria cobrança Pix de assinatura e exibe QR/polling; no checkout Master/owner, botão de cartão mostra “em breve” (`src/routes/_authenticated/painel.tsx:1663-1677`).
- **Carteira:** UI de recebíveis/saques e configuração de taxa usa server functions; estado real depende de migrations/ledger.

## Achados iniciais

### UI-030 — KPI “Recusado” exibe zero fixo sem consultar cobranças recusadas

- **Estado:** placeholder confirmado no código; existência e volume de cobranças recusadas não verificados.
- **Gravidade:** P2 potencial (indicador financeiro pode ocultar falhas de cobrança).
- **Módulo:** frontend / Master / recebíveis.
- **Esperado:** o KPI deve refletir cobranças recusadas do período, ou deixar explícito que a métrica não está disponível.
- **Observado:** o card renderiza `brl(0)` e `0 cobranças` constantes (`src/routes/_authenticated/painel.recebiveis.tsx:356`). A consulta `getReceivablesCalendar` carrega `subscription_payments`, mas devolve apenas recebidos e previsões; não agrega recusas (`src/lib/lifecycle.functions.ts:321-345,379-390`). A tabela `subscription_charges` admite status `failed` e `expired` no schema local (`supabase/migrations/20261106120000_subscription_charges.sql:18-19`), mas a rota não consulta essa fonte. O T076 da spec 010 pede inventário de dados fabricados nas telas Master, mas a página de recebíveis não consta no inventário consultado.
- **Impacto:** se houver falhas, Master vê zero recusas e pode subestimar problemas de cobrança. Nenhum registro real foi consultado; não há prova de ocorrência.
- **Reprodução segura:** inspeção estática já confirma o valor fixo. Em ambiente isolado, fixture sintética com uma cobrança falha deve continuar mostrando zero até que a fonte/métrica seja conectada.
- **Causa-raiz confirmada:** o card usa valores literais e o endpoint não retorna métrica de recusas.
- **Correção recomendada para spec:** definir fonte e janela temporal (incluindo se `failed` e `expired` contam) ou remover/substituir o KPI por estado indisponível.
- **Regressão:** fixture sem falhas retorna zero; fixture com falha/expiração retorna contagem e valor conforme regra; erro de consulta nunca se converte em zero apresentado como resultado válido.
- **Limitação:** estado/volume de produção, semântica da métrica e comportamento visual não foram verificados.



### UI-030 fixed locally (2026-11-14)

The rejected-charge KPI no longer reports a literal zero. It now shows an em dash and "Metric unavailable" until a source/window is defined; no live charge data was inspected. Focused metric plus receivables-state tests: 4/4. `npx tsc --noEmit` and `git diff --check` passed. No external data or operation. Count: 72 fixed, 7 blocked/unverified, 72 pending of 151.

### UI-031 — mês local no KPI mensal de recebimentos (revalidado em 2026-11-15)

- **Estado:** corrigido localmente; sem pagamento real ou QA visual.
- **Gravidade:** P2 potencial.
- **Correção presente:** `receivedThisMonth` usa `isInLocalMonth`, a mesma base local que o agrupamento diário da grade.
- **Regressão:** `receivables-month.test.ts` prova o caso de 2026-12-01T02:00Z, que ainda pertence a novembro em America/Fortaleza; teste 1/1. Já estava contabilizado como corrigido na checklist de 2026-11-14.
### UI-032 — navegação semanal de recebíveis (revalidado em 2026-11-15)

- **Estado:** corrigido localmente; sem validação visual no browser.
- **Gravidade:** P2.
- **Correção presente:** o grid semanal usa `calendarWeekDays(cursor)`; o helper ancora os sete dias no domingo da semana selecionada. `moveCursor` avança e volta sete dias, e cabeçalho/mês total também derivam de `cursor`.
- **Regressão:** `src/lib/receivables-calendar.test.ts` cobre a semana do cursor e mudança de semana; 2/2 aprovados. Sem interação no browser nem dados reais.
### UI-033 — métrica rotulada “próximos 30 dias” soma todos os cancelamentos pendentes

- **Estado:** ausência de filtro de horizonte confirmada no endpoint; semântica comercial do rótulo e impacto real pendentes.
- **Gravidade:** P2 potencial (previsão de churn pode estar incorreta).
- **Módulo:** frontend/backend / Master / recebíveis / churn.
- **Esperado:** o valor rotulado como cancelamentos nos próximos 30 dias deve considerar apenas cancelamentos cuja data efetiva esteja no horizonte definido, ou usar rótulo compatível com o cálculo.
- **Observado:** a interface chama a métrica de “Cancelamentos nos próximos 30 dias (churn)” (`src/routes/_authenticated/painel.recebiveis.tsx:358`). O endpoint soma qualquer negócio com `cancel_requested_at` preenchido e `cancelled_at` vazio (`src/lib/lifecycle.functions.ts:393-396`), sem comparar `access_until` ou outra data com `now`; `setBusinessCancellation(action="solicitar")` só grava o timestamp da solicitação (`:811-824`).
- **Impacto:** se pedido de cancelamento puder anteceder o fim do acesso, a métrica inclui negócios fora dos próximos 30 dias; o valor mensal e percentual podem superestimar churn iminente. Não se confirmou a regra de efetivação nem a ocorrência em produção.
- **Reprodução segura:** fixture sintética com cancelamento solicitado e `access_until` além de 30 dias; confirmar inclusão no contador atual sem alteração de estado.
- **Causa-raiz confirmada:** agregação testa somente presença do pedido e ausência de efetivação; não aplica o horizonte expresso no rótulo.
- **Correção recomendada para spec:** definir quando o cancelamento solicitado se torna efetivo e alinhar o filtro temporal e o nome da métrica a essa regra.
- **Regressão:** solicitações dentro/fora do horizonte e já efetivadas são contabilizadas conforme política aprovada; contador e denominador/percentual usam populações coerentes.
- **Limitação:** pode ser uma escolha intencional caso solicitação seja efetiva imediatamente; confirmar regra comercial antes de classificar como falha confirmada.



### UI-033 fixed locally (2026-11-14)

The metric counted every request not yet finalized, regardless of `access_until`, so it could not support a "next 30 days" forecast. Changed its label to "Pedidos de cancelamento em aberto", shows the request count and associated monthly fee, and removed the unsupported churn percentage. No lifecycle rule or production data was inferred. Metric test plus receivables-state tests: 5/5; TypeScript and diff check passed. Count: 73 fixed, 7 blocked/unverified, 71 pending of 151.

### UI-034 — limite histórico de recebimentos (revalidado em 2026-11-15)

- **Estado:** corrigido localmente; histórico real e produção não consultados.
- **Gravidade:** P2 potencial.
- **Correção presente:** servidor e interface compartilham `RECEIVABLES_HISTORY_LIMIT_DAYS` (120); a tela avisa que períodos anteriores podem estar incompletos em vez de apresentar o corte como histórico completo.
- **Regressão:** `receivables-history-limit.test.ts` e testes do estado/calendário cobrem a janela e o aviso; estes itens já estavam contabilizados como corrigidos na checklist de 2026-11-14.
### UI-001 — Campos de cartão aparecem no checkout, mas a ação informa que checkout está indisponível

- **Status:** corrigido localmente; checkout de cartão permanece indisponível até integração hospedada.
- **Gravidade:** P2 (jornada incompleta e coleta enganosa de dados na tela).
- **Módulo:** assinatura / método de pagamento.
- **Esperado:** não solicitar dados que o produto não processa; quando suportado, usar o checkout seguro hospedado do gateway.
- **Observado:** `painel.tsx:1562-1614` renderiza campos de cartão; botão `Pagar com cartão` mostra aviso “Checkout com cartão em breve. Fale com o suporte para assinar” (`:1663-1677`) e não chama backend. A documentação pública AgPay consultada descreve checkout hospedado VeoPag; UI atual é não funcional para cartão.
- **Impacto:** dono pode preencher dados de cartão numa jornada sem cobrança; sistema não conclui a assinatura. Código sugere estado “em breve”, mas a presença dos campos pode gerar expectativa e coleta desnecessária na memória do navegador. Não há evidência de envio/armazenamento desses dados.
- **Correção recomendada para spec:** ocultar/desativar campos até existir fluxo; especificar redirecionamento hospedado e escopo de assinatura/cartão.
- **Regressão necessária:** nenhum PAN/CVV deve ir ao backend/local storage; mensagem clara; Pix continua independente.

## Não coberto ainda

- Browser em desktop/mobile, telas de loading/error/empty e navegação completa.
- Acessibilidade de labels/foco/teclado/contraste.
- Atualização/cancelamento de dados e permissões por papel.
- Confirmar o contrato da permissão `create_appointment`: há checkbox na configuração do profissional (`src/routes/_authenticated/painel.profissionais.tsx:68,108`) e policy de INSERT no banco, mas não foi encontrada UI/formulário ou Server Function de criação manual, nem referência correspondente nas specs pesquisadas. Sem requisito explícito, manter como lacuna de cobertura/escopo, não como defeito confirmado.
- Todas as páginas do Master/SDR e responsividade.
- QA de checkout/painel com mock isolado após os commits 12/11; relatório anterior do vault usou commit `6b1aab8`, não o HEAD atual `323189d`, portanto não serve como prova desta revisão.

## Próximo ciclo

Auditar página por página com leitura de fonte e testes de componente mocked, sem chamadas de produção; produzir inventário de controles com estado: operacional por backend, decorativo, em breve ou inconclusivo.

### Ciclo 119 — varredura de stubs e copy de funcionalidade futura

- Busca por `TODO`, `FIXME`, “em breve”, placeholders e toasts de preparação encontrou referências já cobertas em UI-001 (campos/checkout de cartão), UI-003 (Comparativo Evolutivo) e UI-005 (campanhas de clientes apenas preparadas/copy toast). Texto residual “alternância de layout” permanece em UI-022.
- Os demais resultados da busca eram placeholders de inputs, labels “Todos”, nomes de campos ou comentários de desenho sem promessa de ação incompleta. Nenhum novo stub funcional foi confirmado nesta varredura.
- **Cobertura:** varredura textual não substitui inspeção de cada botão/formulário; inventário completo de 29 rotas, 97 componentes, QA browser e acessibilidade permanecem pendentes.

## Inventário de páginas autenticadas — cobertura atual

Foram mapeadas as páginas abaixo por arquivo de rota. A leitura detalhada feita até agora cobre checkout principal (`painel.tsx`), painel Master (`painel.master.tsx`) e carteira/AgPay (`painel.as-pay.tsx`). As demais estão inventariadas, mas ainda não revisadas controle a controle nem testadas em browser.

| Área | Arquivos de rota | Estado desta auditoria |
|---|---|---|
| Entrada e layout | `route.tsx`, `painel.index.tsx`, `painel.tsx`, `master.tsx`, `painel.master.tsx` | Parcial; painel principal e Master amostrados |
| Agenda e equipe | `painel.funcionamento.tsx`, `painel.bloqueios.tsx`, `painel.profissionais.tsx`, `painel.equipe-geral.tsx` | Funcionamento parcialmente revisado (UI-007); bloqueios/UI e API parciais (UI-016, API-003/004); profissionais/backend parcialmente revisados (UI-019, PRO-001/002, SEC-020); equipe SDR parcial (ADM-003, SEC-017) |
| Serviços e clientes | `painel.servicos.tsx`, `painel.clientes.tsx` | Serviços: catálogo e exclusão parcialmente revisados (API-006, UI-020); controles restantes pendentes. Clientes: loading inicial e exportação em revisão (UI-005/006/021; SEC-009); demais jornadas pendentes |
| Conta e aparência | `painel.configuracoes.tsx`, `painel.negocios.tsx`, `painel.aparencia-editor.tsx`, `editor-template.$id.tsx`, `painel.templates.tsx` | Negócios conferido contra FR-029a por inspeção estática; aparência parcialmente revisada (UI-009/010); demais rotas/componentes pendentes |
| Comunicação e suporte | `painel.integracoes.tsx`, `painel.lembretes.tsx`, `painel.notificacoes-alertas.tsx`, `painel.suporte.tsx` | Integrações/lembretes amostrados; alertas parcialmente revisados (UI-011); suporte e QA visual pendentes |
| Financeiro e operações Master | `painel.as-pay.tsx`, `painel.carteira-config.tsx`, `painel.carteira-desempenho.tsx`, `painel.recebiveis.tsx`, `painel.transacoes.tsx`, `painel.relatorio.tsx` | `as-pay` e modelos financeiros parciais; recebíveis Master e relatório parcialmente revisados (UI-013/014/015); restantes pendentes |
| Master — negócios e operações | `painel.negocios.tsx`, `painel.assinantes.tsx`, `painel.em-teste.tsx`, `painel.erros.tsx`, `painel.pix-aprovacao.tsx`, `painel.precisa-de-atencao.tsx` | Aprovação Pix revisada parcialmente (UI-026 para falha da query, SEC-007 para gate do PIN, PAY-031 para falha parcial na aprovação); demais páginas e ações pendentes |

Atualização dos ciclos 86–92: `painel.pix-aprovacao.tsx` teve amostra de query, autorização visual e mutation de aprovação (UI-026, SEC-007, PAY-031); as telas `painel.assinantes.tsx`, `painel.em-teste.tsx` e `painel.precisa-de-atencao.tsx` compartilharam a análise de lifecycle (UI-027), com filtro/empty state de atenção adicional em UI-028. `painel.erros.tsx` e o badge de status do dossiê tiveram amostras posteriores (ciclos 93–94). As demais páginas e ações desta linha seguem pendentes.

Atualização do ciclo 93: `painel.erros.tsx` foi amostrada quanto a filtro, retry, erro, paginação e renderização dos detalhes. Sem achado de UI adicional nesta amostra; sanitização e endpoint público estão documentados em `backend.md`/`seguranca.md`, com topologia do proxy ainda inconclusiva.

Atualização do ciclo 94: o badge de status do `BusinessDossier` foi cruzado com os estados usados pela visão geral; cancelado também é rotulado “Ativo” (ADM-001). As demais ações do dossiê ainda não foram auditadas controle a controle.

Atualização do ciclo 98: o segredo temporário de `resetOwnerPassword` permanece no estado de `BusinessDossier` quando o modal fecha ou o businessId muda; SEC-022 registra risco de reapresentação entre fichas. Não houve reset real.

Rotas públicas `/`, `/agendar/$slug`, `/auth`, `/sdr`, `/painel-sdr` também estão inventariadas; cobertura funcional é parcial (fluxo público de agendamento e webhook auth amostrados). Em `/agendar/$slug`, falhas de dias disponíveis e estados vazios de histórico/profissionais correlacionam com BOOK-006/007/010. Responsividade, navegação por teclado, acessibilidade e QA visual em ambiente isolado ainda não foram cobertos.

**Privacidade:** o menu e os componentes mascaram telefones com base em `view_customer_phone`, mas isso é somente proteção de interface; policies locais permitem leitura direta de `appointments` e `customers` por todo profissional ativo. Ver SEC-009 em [seguranca.md](seguranca.md).

**Dados do negócio:** campos financeiros e de controle em `businesses` também têm SELECT amplo para profissionais ativos na chain local; o hardening restringe UPDATE, não leitura (SEC-010 em [seguranca.md](seguranca.md)). Valores reais não foram inspecionados.

## Inventário objetivo das rotas nesta revisão

`src/routes` contém 29 rotas de interface (sem contar endpoints de API e arquivos de teste): 5 públicas (`/`, `/agendar/$slug`, `/auth`, `/sdr`, `/painel-sdr`) e 24 sob `_authenticated`. O diretório `src/components` contém 97 arquivos. O volume é apenas inventário de cobertura; não indica que todos os controles foram validados.

### UI-002 — filtros de tipo e status da tela de transações não afetam os resultados

- **Status:** corrigido localmente; QA browser permanece pendente.
- **Gravidade:** P2.
- **Módulo:** frontend Master / transações.
- **Esperado:** controles de tipo e status e o botão “Aplicar filtros” devem restringir a lista visível e resetar a paginação; “Limpar” restaura a lista completa.
- **Estado atual observado:** os controles mantêm filtros editáveis e filtros aplicados separadamente. “Aplicar filtros” copia tipo/status para `appliedFilters` e reinicia a página; `filterTransactionRows` deriva as listas exibidas por busca, tipo e status. “Limpar” zera os controles e os filtros aplicados. A tela ainda requer QA visual em browser.
- **Impacto:** usuário seleciona status/tipo, aplica e ainda vê a lista anterior, podendo acreditar que uma visão filtrada foi aplicada; navegação de página pode reiniciar sem efeito de filtro.
- **Reprodução segura:** fixture local em componente: montar depósitos/saques com estados distintos, selecionar “Falhou” ou “Concluído”, clicar Aplicar e observar a lista inalterada. Sem acesso a dados de produção.
- **Causa-raiz histórica:** estados dos controles não participavam da derivação de `currentList`; corrigido localmente pela função compartilhada `filterTransactionRows`.
- **Correção recomendada para spec:** definir se tipo/status são filtros locais ou server-side e conectá-los à lista, com rótulos/abas coerentes.
- **Regressão:** combinações de busca, tipo, status, abas e paginação produzem conjunto esperado; limpar restaura todos os registros.
- **Verificação local — 2026-11-15:** `src/lib/transactions-filter.test.ts` passou 2/2, cobrindo filtros de depósitos/saques, busca e restauração após limpar. Leitura da tela confirmou a ligação entre controles, aplicação e lista. Sem dados remotos; QA browser permanece pendente.

### UI-003 — relatório evolutivo indisponível

- **Status:** corrigido localmente por sinalização explícita; o relatório ainda não está implementado.
- **Gravidade:** P3 conforme índice canônico.
- **Módulo:** frontend / clientes / campanhas e relatórios.
- **Esperado:** ação apresentada como opção do menu deve abrir o relatório ou indicar indisponibilidade com estado visual claro e sem mensagem de sucesso.
- **Observado:** a opção `comparativo-evolutivo` não tem fluxo de relatório; agora aparece desabilitada e identificada como “em breve”, sem handler que sinalize sucesso.
- **Impacto:** usuário não recebe o relatório e o toast com estilo de sucesso comunica resultado positivo para uma funcionalidade que ainda não existe.
- **Reprodução segura:** abrir o menu local de relatórios de clientes e clicar “Comparativo Evolutivo”; observar apenas toast, sem navegação/resultado.
- **Causa-raiz:** opção está exposta antes da implementação do fluxo de dados/tela.
- **Correção:** componente `ClientReportMenuOption` desabilita a opção e inclui indicação de indisponibilidade. `ClientReportMenuOption.test.tsx` cobre indisponível e opção ativa; suíte completa em 2026-11-15 passou.
- **Regressão:** indisponível não aceita clique nem mostra sucesso; opção disponível permanece habilitada.
- UI-002 e UI-003 também divergem de `specs/010-endurecimento-versao-cliente/spec.md:230` (FR-028), que exige efeito real para todo controle visível e ocultação/conclusão dos itens sem função.



**Current local resolution (2026-11-14):** The report has no implemented data flow or product scope in the reviewed specs. The menu card remains visible but is now disabled, displays "Comparativo Evolutivo (em breve)", and exposes `aria-disabled`; the success toast was removed. Regression component tests cover unavailable and available menu options: 2/2. `npx tsc --noEmit` and `git diff --check` passed. No report data or external service was accessed. State: unavailable state made explicit locally; no deploy, migration, push, or commit. Total: 71 fixed, 7 blocked/unverified, 73 pending of 151.

### UI-004 — “Reverter cancelamento” confirma reativação sem restaurar o status do negócio

- **Status:** divergência entre mutação e feedback confirmada; efeito de acesso não verificado.
- **Gravidade:** P2 potencial.
- **Módulo:** frontend Master / ciclo de assinatura.
- **Esperado:** ação com mensagem “conta reativada” deve deixar os campos de lifecycle e o status operacional em estado coerente de ativo.
- **Observado:** `setBusinessCancellation(action='reverter')` atualiza somente `cancel_requested_at: null` e `cancelled_at: null` (`src/lib/lifecycle.functions.ts:805-824`). O auto-cancel do dia 15 também grava `status='cancelado'` (`supabase/migrations/20261103000000_security_hardening.sql:274-277`). O botão de `painel.precisa-de-atencao.tsx` chama `reverter` e mostra “Cancelamento revertido — conta reativada.” no sucesso (`:115-129,294-301`), mas não altera `status`. `planState` só trata `status==='suspenso'` como bloqueio e baseia o restante em `hasPaid`/`access_until`; não recebe `cancelled_at` (`src/lib/plan-state.ts:18-43,66-96`).
- **Impacto:** estabelecimento auto-cancelado pode manter `status='cancelado'` depois da reversão e o painel do dono ainda derivar “Renovar” se o acesso venceu; ao contrário, `cancelled_at` sozinho não participa da apresentação de plano. O toast promete reativação sem sincronizar todos os marcadores nem garantir acesso. Login/booking não foram exercitados; a exposição pública está relacionada separadamente em BOOK-004.
- **Reprodução segura:** fake de business com `status='cancelado'`, `cancelled_at` preenchido; executar handler simulado e conferir que só timestamps são limpos; verificar que UI exibe toast de reativação.
- **Causa-raiz:** o contrato de cancelamento/reversão e o estado de plano usam campos diferentes (`cancelled_at`/`status` versus `status`/`access_until`) sem uma transição operacional única.
- **Correção recomendada para spec:** definir transição única de reativação pós-cancelamento e alinhar status, timestamps, permissões e texto do feedback.
- **Regressão:** revertendo auto-cancel, conta retorna ao estado esperado e pode acessar os fluxos permitidos; cancelamento solicitado não é apagado fora da intenção.



### UI-004 revalidated (2026-11-14)

The current server mutation already sets `businesses.status` to `ativo` and clears `cancel_requested_at`/`cancelled_at`; `lifecycle.cancellation.test.ts` confirms the exact patch. `access_until` remains unchanged and continues to govern plan access. Updated the master success message so reverting cancellation does not claim that paid access was restored. Feedback tests plus cancellation mutation tests: 4/4; TypeScript and diff check passed. This UI message change does not add a new finding to the count. Total remains 71 fixed, 7 blocked/unverified, 73 pending of 151.

### UI-005 — botões “Enviar” de campanhas não enviam nem produzem conteúdo utilizável

- **Status:** incompletude do handler confirmada por inspeção; requisito comercial para campanhas não localizado nas specs revisadas.
- **Gravidade:** P3 potencial.
- **Módulo:** Clientes / campanhas de ausentes e aniversariantes.
- **Esperado:** o CTA “Enviar” deve enviar aos contatos selecionados ou produzir um resultado utilizável (por exemplo, texto personalizado/cópia/abertura de canal), ou deixar explícito que a função está indisponível.
- **Observado:** `sendCampaign` só valida `selectedClients.length` e chama `toast.success`; não lê `campaignMessage` nem usa IDs/telefones para preparar ou enviar conteúdo (`src/routes/_authenticated/painel.clientes.tsx:205-210`). `sendBirthdayCampaign` faz o mesmo com `selectedBirthdays` (`:261-266`). Os dois botões são rotulados “Enviar” (`:661`, `:950`); a mensagem editável fica apenas no state/textarea. Não há mutation, clipboard, deep link ou chamada de provider nesses handlers.
- **Evidência de escopo:** FR-002 da spec 001 exige preservar funcionalidades de clientes, mas não especifica campanhas; a implementação atual não tem contrato ou tela de confirmação de entrega.
- **Impacto:** usuário pode interpretar que uma ação de envio foi concluída quando nenhum destinatário recebeu mensagem e nenhum texto foi salvo/copiado. Nenhuma mensagem externa foi enviada nesta auditoria.
- **Causa provável:** scaffold da interface sem integração/composição de mensagem; a causa de produto não está confirmada.
- **Reprodução segura:** abrir a tela em ambiente local com dados fictícios, selecionar contato, editar o texto e acionar “Enviar”; o handler apenas exibe toast e não gera tráfego, arquivo, cópia ou alteração de estado.
- **Correção recomendada para spec:** definir se campanhas integram ao WhatsApp e qual mecanismo de consentimento/entrega; implementar fluxo rastreável ou rotular como indisponível, sem toast de sucesso de envio.
- **Regressão:** mensagem personalizada usa nome/destinatários selecionados; falhas/recusa ficam visíveis; modo indisponível não sinaliza sucesso; teste nunca envia mensagem real.

### UI-006 — comparativo de “atendimentos” conta reservas não concluídas

- **Status:** corrigido localmente e validado; os rótulos “atendimentos” seguem a semântica usada pelo relatório principal (`concluido`).
- **Gravidade:** P3 potencial.
- **Módulo:** Clientes / Comparativo Individual / Campanha de Ausentes.
- **Esperado:** métricas chamadas “atendimentos” e cálculo do último atendimento devem contar serviços efetivamente concluídos, ou a interface deve nomear explicitamente a métrica como reservas/agendamentos.
- **Observado:** a query `visitsQuery` carrega nome/telefone e datas de reservas de todos os estados operacionais, removendo somente `bloqueado`; os dados alimentavam `countInMonth`, `dailyInMonth` e `mergeAppointmentCustomers` sem separar reservas de atendimentos.
- **Contraste/spec:** o relatório principal chama atendimentos concluídos apenas quando `status === 'concluido'` (`src/lib/report-metrics.ts:10-13`); `specs/001-novo-layout-e-templates/spec.md:171` também chama os indicadores de “atendimentos”. A expectativa específica do comparativo de clientes não está definida.
- **Impacto:** comparativo e distribuição diária podem não representar serviços realizados; reservas canceladas/sem sinal podem impedir que cliente seja tratado como ausente, ou inflar o desempenho informado.
- **Reprodução segura:** fixture local de quatro reservas no mesmo mês com status `concluido`, `cancelado`, `aguardando_sinal` e `agendado`; comparar contagem mostrada no modal com a métrica concluída. Nenhum banco real é necessário.
- **Causa:** a tela reaproveita todas as linhas de appointments como histórico de visitas e só exclui registros técnicos de bloqueio.
- **Correção:** a spec 001 e o relatório principal já definem “atendimentos” como concluídos. A query inclui `status`; `mergeAppointmentCustomers` mantém reservas de qualquer estado para descobrir clientes, mas atualiza `lastAppointmentAt` somente com `concluido`. Comparativo mensal e série diária aplicam o mesmo filtro.
- **Regressão:** `src/lib/customer-list.test.ts` cobre concluído, agendado e cancelado para a data do último atendimento; TypeScript e suíte completa aprovados em 2026-11-15. O teste não consulta banco nem envia mensagens.

### UI-007 — funcionamento aceita horário final anterior ao inicial

- **Estado:** caminho de configuração confirmado estaticamente; ocorrência depende de escolha do owner.
- **Gravidade:** P2 potencial (pode remover disponibilidade de um dia inteiro).
- **Módulo:** painel do estabelecimento / configuração da agenda.
- **Esperado:** bloquear salvamento quando `ends_at <= starts_at` para o modelo de intervalo diário usado pela reserva; informar o erro junto aos campos.
- **Observado:** a tela usa dois `<input type="time">` independentes e o mutation faz upsert sem comparação entre os valores (`src/routes/_authenticated/painel.funcionamento.tsx:76-89,174-202`). A migration só verifica weekday e unicidade; não tem `CHECK` para relação entre horas (`supabase/migrations/20260902060129_a03cc3ea-196e-47eb-b342-4887bad7ed4d.sql:2-10`). `computeSlots` gera slot somente enquanto `t + durationMinutes <= to`; com `to <= from`, não gera nenhum (`src/lib/booking.functions.ts:384-400`). O fluxo não modela intervalo que cruza meia-noite.
- **Impacto:** um fechamento antes/igual à abertura é persistido sem erro e o dia aparenta estar fechado para o agendamento público; owner pode não perceber a causa até receber relato de indisponibilidade.
- **Reprodução segura:** em business fictício/fixture, salvar abre 19:00 e fecha 08:30 (ou mesmo horário); chamar cálculo puro com serviço de 30 min; resultado é lista vazia. Nenhuma reserva real necessária.
- **Causa-raiz:** limite de campo valida formato `time`, mas invariantes entre os dois valores não são validados na UI, backend ou banco.
- **Correção recomendada para spec:** definir se intervalos overnight são suportados. Para o contrato diário atual, rejeitar `fim <= início` no cliente e no servidor/DB com mensagem clara.
- **Regressão:** intervalos comuns geram slots; `fim = início` e `fim < início` são rejeitados ou tratados por regra overnight explícita; dia vizinho não perde disponibilidade.
- **Limitação:** não foi persistida fixture nem executado teste nesta passagem; comportamento deriva do código de cálculo e do schema local.

### UI-008 — falha ao carregar categorias aparece como lista vazia

- **Estado:** falha geral deixou de ser convertida em lista vazia; corrigido localmente e validado.
- **Gravidade:** P3 potencial.
- **Módulo:** frontend / catálogo de serviços / categorias.
- **Esperado:** distinguir ausência real de categorias de erro de rede, autorização ou schema, oferecendo estado de erro e opção de tentar novamente; a tolerância a migration ausente deve ser específica e identificável.
- **Observado:** a query `service-categories` capturava qualquer erro e retornava `[]`; assim, falhas transitórias/RLS pareciam uma resposta válida sem categorias.
- **Impacto:** categorias existentes podem sumir visualmente durante falha de consulta; usuário pode concluir que não há configuração ou tentar recriar dados. Não foi observado se há constraint que evite duplicatas nem feito write em ambiente real.
- **Reprodução segura:** mockar a query com erro RLS/rede e com resultado vazio; ambos produzem a mesma tela vazia no estado atual.
- **Causa-raiz confirmada:** `catch` converte erro em resultado válido vazio e a UI não mantém estado de erro.
- **Correção:** a query agora propaga a falha. Loading, erro com retry e vazio após resposta válida têm estados distintos; a ação de criar categoria é bloqueada enquanto a leitura está em erro. Se havia dados em cache, eles continuam visíveis junto ao aviso de retry. O problema de gravação não atômica permanece rastreado em API-006.
- **Regressão:** `src/components/painel/ServiceCategoriesQueryNotice.test.tsx` cobre loading, erro com retry e sucesso (3/3); teste de codificação também passou. Suíte completa: 130 arquivos aprovados, 3 ignorados, 1.025 testes aprovados e 8 ignorados; TypeScript e `git diff --check` passaram.
- **Escopo da spec:** as specs localizadas nesta revisão não descrevem detalhadamente o CRUD de categorias do catálogo; tratar o contrato esperado como decisão de produto ainda pendente.
- **Limitação:** sem teste de componente nem leitura de configuração remota, não se sabe se alguma falha concreta já ocorreu.

### UI-009 — substituição de imagens pode apagar o asset atual antes de salvar a configuração

- **Estado:** sequência de operações confirmada estaticamente; falha do save e sucesso de remoção não foram injetados.
- **Gravidade:** P2 potencial.
- **Módulo:** frontend / editor de aparência / Storage.
- **Esperado:** a imagem atualmente publicada deve continuar disponível até a nova configuração ser persistida; falha de publicação deve preservar o rascunho e a experiência pública funcional.
- **Observado:** ao salvar um logo ou fundo novo, `save` envia o novo arquivo e em seguida tenta remover o path anterior antes de persistir a nova configuração (`src/routes/_authenticated/painel.aparencia-editor.tsx:362-377`). Só depois monta `nextVisual`, atualiza o state e inicia `saveFn` em paralelo com eventual `updateProfileFn` (`:379-393`). Se a remoção do objeto antigo tiver sucesso e a gravação da configuração falhar, o banco pode continuar apontando ao objeto removido. A chamada `remove(...).catch(() => {})` também ignora erros retornados como `{error}` pelo cliente, embora isso resulte em órfão em vez de perda do atual.
- **Impacto:** falha em rede/RLS durante save pode quebrar logo/fundo já publicado; o resultado depende do comportamento efetivo da policy de Storage e de qual das gravações paralelas conclui. Também pode haver estado divergente entre `business_visual_settings` e os campos `businesses` se só uma chamada paralela persistir.
- **Conformidade:** `specs/008-finalizacao-experiencia-integracoes/spec.md:260` determina que falha ao salvar/publicar não apague o rascunho; esse fluxo não foi validado contra o cenário de falha parcial.
- **Reprodução segura:** mockar Storage para aceitar upload e remover o objeto antigo, depois rejeitar `saveFn`; conferir que o objeto antigo foi removido, o banco permanece com o path anterior e o rascunho continua editável. Simular também sucesso de `saveFn` e falha de `updateProfileFn`; sem Storage real.
- **Causa-raiz provável:** remoção do recurso publicado precede a persistência transacional do apontador e os writes de configuração são independentes.
- **Correção recomendada para spec:** publicar primeiro o novo path em estado consistente, manter o asset anterior até confirmar a troca e executar limpeza posterior recuperável; definir reconciliação para gravações paralelas parcialmente concluídas.
- **Regressão:** falhas em upload, troca do ponteiro, atualização de background e limpeza posterior mantêm um asset publicado válido e preservam rascunho; reexecução é idempotente e não acumula órfãos.
- **Limitação:** não houve upload/remoção real, acesso a Storage remoto ou injeção de falha.

### UI-010 — falha ou latência do perfil deixa o editor aceitar rascunhos que não consegue salvar

- **Estado:** comportamento confirmado estaticamente; falha/latência não foi injetada.
- **Gravidade:** P2 potencial.
- **Módulo:** frontend / editor de aparência / perfil do negócio.
- **Esperado:** bloquear a edição dependente do perfil até que logo e fundo estejam carregados, ou mostrar erro recuperável; nenhuma alteração de fundo deve aparentar estar disponível sem conseguir persistir.
- **Observado:** a página aguarda apenas `config.isLoading` e `config.isError`; a query `profile` tem estados próprios, mas eles não controlam o render do editor (`src/routes/_authenticated/painel.aparencia-editor.tsx:61-82,412-424`). `dirty` só considera cor de fundo quando `profile.data` existe (`:216-229`), e `backgroundChanged` também exige esse dado (`:356`). Assim, se a query falhar, mudança apenas na cor de fundo não habilita publicação e não chega a `updateProfileFn`; o usuário vê os controles sem mensagem de erro. Se o usuário mudar a cor antes do carregamento terminar, o efeito de `profile.data` pode substituir a escolha pelo valor recebido (`:81-82`).
- **Impacto:** alteração de cor pode não ser salva ou ser sobrescrita após load; logo/fundo do preview também podem aparecer ausentes. A UI não diferencia o caso de indisponibilidade de perfil.
- **Reprodução segura:** mockar `profile` com erro após `config` sucesso, alterar apenas a cor e observar `dirty=false`/publicação desabilitada; em teste separado, atrasar `profile`, alterar cor e resolver query para observar reset pela resposta.
- **Causa-raiz confirmada:** dependência de `profile.data` não é incluída na condição de loading/erro e a mudança de estado local depende dessa data para ser considerada dirty.
- **Correção recomendada para spec:** modelar carregamento/erro do perfil como precondição da edição e permitir retry; evitar reset de edição local depois de interação.
- **Regressão:** latência mostra loading sem controles editáveis; falha explica e permite retry; seleção feita após load é marcada dirty e persistida; chegada tardia não apaga interação.
- **Limitação:** reprodução foi descrita para mocks, sem teste de componente nem acesso a backend remoto.

### UI-011 — estados da tabela de alertas

- **Estado:** corrigido localmente, com teste dos estados e retry.
- **Gravidade:** P3 potencial.
- **Módulo:** frontend Master / notificações e alertas.
- **Esperado:** apresentar loading, erro com retry e empty state distinto, evitando induzir novo envio quando a consulta falha.
- **Correção:** a lista Master separa loading, falha com retry e empty state após resposta válida; o convite de primeira notificação só aparece em empty state legítimo. Teste unitário dos estados passou 3/3; QA visual e backend remoto permanecem fora da validação.
- **Impacto:** falha transitória de leitura pode ocultar avisos já publicados e sugerir ao Master que crie novamente; o usuário não recebe indicação de indisponibilidade da lista.
- **Reprodução segura:** query mocked em loading, erro e lista vazia; os três estados atuais renderizam a linha de vazio quando `data` está indefinido.
- **Causa-raiz confirmada:** fallback de `data` para array vazio é usado como único discriminador de estado.
- **Correção recomendada para spec:** implementar estados separados de carregamento/erro/vazio e retry, preservando a ação de criar apenas quando adequada.
- **Regressão:** teste de UI para os três estados; erro não se apresenta como ausência de registros e retry atualiza a tabela.
- **Limitação:** sem QA visual em browser ou falha de backend reproduzida.

### UI-026 — falha de consulta de aprovação Pix aparece como fila vazia

- **Estado:** comportamento confirmado estaticamente; erro de leitura não foi injetado.
- **Gravidade:** P2 potencial, porque a lista controla revisão de chaves Pix necessárias para saque.
- **Módulo:** frontend Master / aprovações Pix.
- **Esperado:** separar carregamento, erro recuperável e fila vazia, mantendo claro quando há solicitações que ainda não puderam ser verificadas.
- **Observado:** `listPixKeyApprovals` alimenta `const { data: list = [] }` sem uso de `isLoading` ou `isError` (`src/routes/_authenticated/painel.pix-aprovacao.tsx:74-77`). A lista pendente é filtrada do fallback vazio (`:401-407`), e o JSX exibe “Nenhum Pix pendente” quando `!pending.length` (`:454-466`). Se a consulta falhar, a Master não vê a falha nem distingue ausência de solicitações; o histórico de aprovadas também usa a mesma lista.
- **Impacto:** pedido de aprovação pode permanecer sem análise enquanto o Master acredita que não há chaves pendentes; a operação do saque já depende de aprovação/revisão (ver PAY-011). Ocorrência remota desconhecida.
- **Reprodução segura:** mockar `listPixKeyApprovals` com loading, erro e lista vazia; no estado atual, erro e vazio produzem a mesma mensagem. Nenhuma chave real precisa ser consultada ou alterada.
- **Causa-raiz confirmada:** estado da query não participa da seleção do empty state.
- **Correção recomendada para spec:** estados separados com retry e badge de pendências que não converta erro em zero.
- **Regressão:** erro não afirma ausência de solicitações; retry carrega fila e contagem; lista vazia real mantém o empty state.
- **Limitação:** nenhuma solicitação ou dado remoto foi lido; QA de componente/browser pendente.

### UI-027 — erro de lifecycle aparece como MRR zero ou lista vazia no Master

- **Estado:** fallback de dados e empty state confirmados estaticamente; erro não foi injetado.
- **Gravidade:** P2 potencial, pois o resumo financeiro pode ser interpretado como receita recorrente nula.
- **Módulo:** frontend Master / assinantes, contas em teste e contas que precisam de atenção.
- **Esperado:** exibir erro recuperável e manter MRR não disponível até obter dados válidos; diferenciar falha de consulta de ausência real de assinantes.
- **Observado:** a query chama `getSubscriptionLifecycle`, que propaga erros das consultas base (`src/lib/lifecycle.functions.ts:65-105`). Na rota de assinantes, `rows` deriva de `lifecycle.data?.items ?? []` e alimenta `mrrTotal` (`src/routes/_authenticated/painel.assinantes.tsx:27-38`); o MRR é renderizado sem condicionar a erro (`:63-66`) e empty state não testa `isError` (`:145-153`). “Em teste” repete fallback e empty state sem `isError` (`src/routes/_authenticated/painel.em-teste.tsx:66-71,215-222`). “Precisa de atenção” deriva contagens e filtros de `data?.items ?? []` (`src/routes/_authenticated/painel.precisa-de-atencao.tsx:77-99`) e mostra “Nenhum cliente precisando de atenção” em `!filtered.length` sem distinguir erro ou loading (`:210-216`).
- **Impacto:** falha transitória pode mostrar MRR zero e listas/contadores vazios nas três áreas Master, ocultando clientes pagantes, trials e contas em risco. Nenhuma medição de produção foi feita.
- **Reprodução segura:** mockar `getSubscriptionLifecycle` como rejeição e observar KPI, contadores e empty states nas três páginas; sem conexão a banco real.
- **Causa-raiz confirmada:** a tela usa lista vazia como fallback e não renderiza `isError`.
- **Correção recomendada para spec:** separar loading, erro/retry e sucesso; não emitir zero financeiro como valor confirmado quando a origem não carregou.
- **Regressão:** erro mostra indisponibilidade, MRR não é apresentado como zero e retry preenche as três visões; retorno válido vazio continua informando ausência real.
- **Limitação:** inspeção estática, sem estado remoto ou teste visual.

### UI-028 — filtros sem correspondência mostram mensagem de fila global vazia

- **Estado:** corrigido localmente e validado para fila global vazia, filtro sem resultado e resultado presente.
- **Gravidade:** P3 potencial.
- **Módulo:** frontend Master / contas que precisam de atenção.
- **Esperado:** distinguir ausência global de registros de ausência de resultados para busca/filtro ativos.
- **Observado:** a rota cria `filtered` por `reasonFilter` e `search` (`src/routes/_authenticated/painel.precisa-de-atencao.tsx:93-99`), mas a linha empty state é exibida sempre que `!filtered.length` e diz “Nenhum cliente precisando de atenção no momento” (`:210-216`). Quando `all` possui itens e os filtros não encontram nenhum, a mensagem ainda afirma que a fila global está vazia.
- **Impacto:** Master pode interpretar uma busca sem resultado como ausência de contas em atenção e deixar de limpar filtros para localizar outros estabelecimentos. Nenhuma alteração de conta acontece por esse estado.
- **Reprodução segura:** usar fixtures fictícias de duas razões, selecionar uma razão sem registros (ou busca sem correspondências) e observar a mensagem global de vazio.
- **Causa-raiz confirmada:** empty state usa somente o tamanho filtrado e não verifica filtros/search nem o total da fila.
- **Correção:** helper `attentionEmptyState` só mostra vazio global após query bem-sucedida e quando `all.length === 0`; quando há itens na fila mas filtros/busca não retornam nada, a mensagem esclarece que não há correspondências e oferece limpar os filtros.
- **Regressão:** `src/lib/attention-empty-state.test.ts` cobre loading/erro, fila global vazia, filtro sem correspondência e resultados presentes (4/4); TypeScript e diff check passaram; suíte completa: 134 arquivos aprovados, 3 ignorados, 1.037 testes aprovados e 8 ignorados.
- **Limitação:** inspeção estática; sem screenshot ou QA em browser.

### UI-029 — falha ao carregar cupom deixa a edição Master disponível

- **Estado:** mitigado localmente; edição bloqueada até leitura válida e erro tem retry visível. Sem configuração salva ou acesso remoto.
- **Gravidade:** P2 potencial, pois cupom altera o valor da cobrança da assinatura.
- **Módulo:** frontend Master / dossiê / cobrança de assinatura.
- **Esperado:** mostrar loading/erro da configuração e impedir nova gravação até conhecer o cupom vigente, ou exigir confirmação explícita de substituição.
- **Observado:** a query agora distingue loading, erro e leitura válida via `canEditBusinessCoupon`; sem dados válidos Switch e formulário não são exibidos, erro informa que a edição está bloqueada e oferece retry (`src/components/master/BusinessDossier.tsx:1854-1946`). Após leitura válida, o handler Master substitui os campos de cupom (`src/lib/subscription.functions.ts:109-122`) e a próxima cobrança usa o percentual/expiração persistidos (`src/lib/subscription-charge.functions.ts:174-180`).
- **Impacto:** se a leitura falhar com cupom ativo, operador pode acreditar que não há cupom e gravar outro; isso substitui a taxa anterior e altera o preço efetivamente cobrado em nova assinatura. Não há evidência de falha real ou sobrescrita em produção.
- **Reprodução segura:** mockar erro de `getBusinessCoupon`, conferir texto “Sempre desativado por padrão” e botão habilitado após preencher campos; não clicar em salvar nem chamar gateway.
- **Causa-raiz corrigida localmente:** o estado da leitura é uma precondição para expor a edição, então erro não se converte em cupom ausente/desativado.
- **Validação:** `coupon-edit-state.test.ts` cobre loading, erro, ausência de dados e sucesso (4/4); suíte completa de regressão após esta auditoria: 137 arquivos aprovados, 3 ignorados; 1.070 testes aprovados, 8 ignorados; TypeScript passou.
- **Limitação:** não foi injetada falha de query no browser nem salva configuração; a proteção do componente é comprovada pelo gate testado e integração estática.

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

### UI-015 — faturamento histórico do relatório usa preço atual do catálogo

- **Estado:** dependência de preço atual confirmada; se isso contraria a semântica comercial do relatório, permanece por confirmar.
- **Gravidade:** P2 potencial (métrica financeira).
- **Módulo:** relatório / modelo de preço por atendimento.
- **Esperado:** a métrica intitulada “Faturamento” deve representar valor histórico do atendimento ou explicitar que é uma estimativa recalculada com preços atuais.
- **Observado:** `completedReportMetrics` soma `services.price_cents` atual para cada appointment concluído, associado por `service_id` (`src/lib/report-metrics.ts:10-20,29-34`); a consulta da tela carrega `id, name, price_cents` da tabela de catálogo no momento da leitura (`src/routes/_authenticated/painel.relatorio.tsx:59-68`). A tabela `appointments` criada na migration contém `service_id`, `deposit_cents` e `deposit_paid_at` em migrations aditivas, mas não snapshot do valor total do serviço (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:104-117`; `20260902060129_a03cc3ea-196e-47eb-b342-4887bad7ed4d.sql:69-70`).
- **Impacto:** se o preço de um serviço for alterado após atendimentos concluídos, relatórios de períodos anteriores podem mudar retroativamente; não existe neste modelo valor histórico total para calcular o montante efetivamente cobrado.
- **Conformidade:** FR-017 da spec 001 exige manter a métrica de faturamento, mas a semântica (preço na data do atendimento versus preço atual) não é definida. Classificação como risco suspeito até validação com produto e fluxo operacional.
- **Reprodução segura:** calcular fixture de appointment concluído contra service de preço A, alterar preço em fixture para B e recalcular período passado; verificar a métrica, sem writes em banco real.
- **Causa-raiz confirmada no cálculo:** valor deriva do catálogo atual e não de snapshot do appointment/pagamento integral. Causa de produto e expectativa do cliente não confirmadas.
- **Correção recomendada para spec:** definir claramente receita bruta versus recebimentos/sinais; se histórica, persistir e usar snapshot do preço no momento da reserva/conclusão e definir cancelamento/desconto.
- **Regressão:** alterar preço do catálogo não muda relatório histórico; atendimentos futuros usam novo preço; sinal recebido e faturamento bruto permanecem métricas distintas.
- **Limitação:** nenhuma alteração de preço real ou valor de produção foi consultado; definição comercial está pendente.

### UI-016 — erro ao listar profissionais oculta seleção e torna bloqueio global

- **Estado:** fallback de UI e payload enviado confirmados estaticamente; erro não foi injetado no componente.
- **Gravidade:** P2 potencial (bloqueio pode fechar agenda de todos os profissionais).
- **Módulo:** frontend / bloqueios / carregamento de equipe.
- **Esperado:** se há vários profissionais no negócio, a tela deve exigir seleção válida de escopo e não oferecer “todos” por falha de leitura; erro deve aparecer e bloquear a criação até retry.
- **Observado:** `professionalsQuery` falha com rejeição, porém a tela usa `professionalsQuery.data ?? []`, e `hasMultipleProfessionals` depende apenas do comprimento (`src/routes/_authenticated/painel.bloqueios.tsx:96-111`). A seleção de profissional só renderiza quando `hasMultipleProfessionals` (`:225`); o formulário começa com `professionalId: null` e envia esse valor para `createTimeBlock` (`:66-70,115-126`). No handler, `professionalId=null` é aceito e grava bloqueio global (`src/lib/time-blocks.functions.ts:6-14,34-47`). O componente não consome `professionalsQuery.isError`.
- **Impacto:** se a consulta de profissionais falhar num negócio com equipe, dono pode criar sem perceber um bloqueio que vale para todos, em vez de um bloqueio individual.
- **Reprodução segura:** mockar `professionals` com erro em fixture que representa dois profissionais; o componente deriva array vazio, esconde a seleção e submete `professionalId=null`. Não salvar bloqueio real.
- **Causa-raiz confirmada:** erro de query é confundido com lista legitimamente vazia; null também é valor de negócio válido que significa escopo global.
- **Correção recomendada para spec:** representar loading/erro/vazio separados e fail closed quando o escopo depende de contagem/equipe; permitir global somente por escolha explícita.
- **Regressão:** falha na query bloqueia a criação e mostra retry; negócio com um profissional permite escopo previsto; negócio com múltiplos requer escolha clara entre global e individual.
- **Limitação:** sem teste de componente; o endpoint createTimeBlock exige dono (API-004), portanto o caminho de impacto aqui é owner e produção permanece desconhecida.

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

### UI-018 — mensagem de suporte é apagada do rascunho antes da confirmação

- **Estado:** corrigido localmente e validado com envio pendente, sucesso e falha.
- **Gravidade:** P3 potencial (perda de texto digitado no painel Master).
- **Módulo:** frontend Master / suporte.
- **Esperado:** manter a mensagem no rascunho até o servidor confirmar o envio, ou restaurá-la quando a operação falhar.
- **Observado:** `ChatPanel.send` iniciava `onSend(value)` e imediatamente chamava `setDraft("")`; a mutation do pai só depois chamava `replySupportAsMaster`.
- **Impacto:** em falha de rede/servidor o operador recebe erro, mas perde o conteúdo já digitado e precisa reescrevê-lo. Não há evidência de mensagem duplicada ou envio real nesta auditoria.
- **Reprodução segura:** mockar rejeição de `replySupportAsMaster`, digitar uma mensagem e enviar; verificar toast e rascunho vazio.
- **Causa-raiz confirmada:** o estado do draft é limpo no evento de envio, sem aguardar resultado da mutation.
- **Correção:** `submitSupportDraft` aguarda `mutateAsync`, limpa somente após sucesso e só quando o texto atual ainda é o mesmo submetido. A falha mantém o texto editável e o toast existente comunica o erro.
- **Regressão:** `src/lib/support-draft.test.ts` cobre promessa pendente, confirmação e falha (2/2). Suíte completa: 129 arquivos passaram, 3 ignorados; 1.022 testes passaram, 8 ignorados. TypeScript passou; teste focal reapós proteção contra apagar edição mais recente: 2/2.
- **Limitação:** envio de resposta real não foi executado.

### UI-019 — erro ao carregar equipe mostra primeiro profissional grátis e permite continuar

- **Estado:** estado derivado e botão habilitado confirmados estaticamente; falha de query não foi injetada.
- **Gravidade:** P2 potencial (decisão comercial/limite de equipe).
- **Módulo:** frontend / profissionais / preço de adicional.
- **Esperado:** quando a quantidade de profissionais é desconhecida por erro de leitura, a interface deve bloquear nova criação ou identificar que preço/limite não pôde ser verificado.
- **Observado:** `peopleQuery.data ?? []` vira lista vazia quando não há dados; `firstProfessionalFree` fica true e `atLimit` false (`src/routes/_authenticated/painel.profissionais.tsx:184-193`). O botão de cadastro só é desabilitado por `atLimit` e abre direto o formulário quando `firstProfessionalFree` (`:661-672`), embora a área inferior simultaneamente mostre `peopleQuery.isError` (`:680-686`). Assim, erro de leitura permite prosseguir e o texto indica que o primeiro profissional é grátis mesmo com contagem desconhecida.
- **Impacto:** em negócio com equipe já existente, o proprietário pode iniciar cadastro adicional sem ver aviso de +R$ 10/mês; falha da consulta de profissionais também pode permitir cadastro duplicado/ultrapassar o teto quando combinada à validação server-side falha aberta PRO-001. Não foi confirmada cobrança nem ocorrência real.
- **Reprodução segura:** rejeitar mock da query `professionals` com fixture de negócio que já tenha equipe; verificar erro visível, botão ativo, copy de primeiro profissional grátis e abertura do formulário. Não salvar.
- **Causa-raiz confirmada:** a UI deriva preço/limite do comprimento do array com fallback de erro para vazio e não inclui `peopleQuery.isError` na condição de habilitação.
- **Correção recomendada para spec:** distinguir estado desconhecido de lista vazia e exigir contagem válida antes de oferecer o fluxo gratuito; manter aviso de preço adicional antes de qualquer criação paga.
- **Regressão:** erro mantém criação desabilitada e não afirma preço; consulta válida vazia abre fluxo grátis; uma ou mais pessoas mostram aviso correto e limite conforme regra confirmada.
- **Limitação:** regra comercial atual, cobrança do adicional e estado de produção ainda não foram conferidos; sem teste de componente/browser.

### UI-020 — falhas ao excluir serviço ou cliente não são apresentadas ao operador

- **Estado:** corrigido localmente e validado para erro, sucesso e resposta atrasada.
- **Gravidade:** P3 potencial (feedback de operação administrativa).
- **Módulo:** frontend / serviços e clientes / exclusão.
- **Esperado:** se DELETE falhar, manter contexto e informar que o serviço continua cadastrado, com opção de tentar novamente.
- **Observado:** as duas mutations não tinham `onError`; o callback local `onSettled` fechava o diálogo mesmo quando DELETE falhava.
- **Impacto:** em falha de permissão, integridade ou rede, o diálogo fecha e o item permanece na lista sem explicação, levando o operador a repetir ou interpretar incorretamente o resultado.
- **Reprodução segura:** mockar DELETE com erro em cada tela; observar ausência de toast de erro e fechamento do diálogo após `onSettled`. Sem exclusão real.
- **Causa-raiz confirmada:** mutation de exclusão não define `onError` nem mensagem de falha; o handler de `onSettled` apaga contexto de confirmação.
- **Correção:** ambas exibem `friendlyError` em `onError` e mantêm o alvo da confirmação. `onSuccess` fecha apenas o diálogo que corresponde ao ID removido; resposta atrasada não fecha outro alvo escolhido depois.
- **Regressão:** `src/lib/delete-confirmation.test.ts` cobre falha, sucesso e alvo trocado durante a espera (3/3). TypeScript passou; suíte completa: 131 arquivos aprovados, 3 ignorados, 1.028 testes aprovados e 8 ignorados.
- **Limitação:** nenhum erro foi injetado em runtime e nenhuma exclusão foi realizada.

### UI-021 — lista de clientes exibe estado vazio durante carregamento inicial

- **Estado:** corrigido localmente e validado para loading, falha, retry e resposta vazia.
- **Gravidade:** P3 potencial (feedback inicial e interpretação de estado).
- **Módulo:** frontend / clientes / consulta.
- **Esperado:** enquanto clientes e visitas carregam, mostrar loading/skeleton; só apresentar vazio depois de respostas bem-sucedidas sem registros.
- **Observado:** `customersQuery` e `visitsQuery` iniciam independentemente; antes, o render reduzia dados ainda não resolvidos a lista vazia e mostrava “Nenhum cliente encontrado”.
- **Impacto:** ao entrar na página, pode haver breve indicação falsa de ausência; usuários podem repetir navegação ou achar que seus cadastros sumiram. Não há alteração de dados por esse estado.
- **Reprodução segura:** componente com ambas queries pendentes e sem cache; observar branch de lista vazia antes de resolver as promises.
- **Causa-raiz confirmada:** dados ausentes durante loading são reduzidos a arrays vazios, sem estado separado.
- **Correção:** loading fica separado do vazio; ambas as consultas precisam concluir sem erro antes de renderizar lista vazia. Erros oferecem retry conjunto das duas fontes e não exibem lista incompleta.
- **Regressão:** `src/components/painel/CustomerListQueryNotice.test.tsx` cobre loading, erro/retry e resposta pronta (3/3); TypeScript e diff check passaram. Suíte completa: 132 arquivos aprovados, 3 ignorados, 1.031 testes aprovados e 8 ignorados.
- **Limitação:** não executado em browser/component test; duração do flash depende de cache e latência.

**Nota de privacidade — SEC-009:** `exportCsv` mascara telefone quando `canViewCustomerPhone` é falso, mas inclui `email` e `notes` sem gate, e o botão de exportação não é condicionado a essa permissão (`src/routes/_authenticated/painel.clientes.tsx:330-338,590-600`). O schema/permissões não definem um gate separado para e-mail/observações; manter a expectativa de autorização desses campos como questão aberta dentro de SEC-009, não como novo achado.

### UI-022 — texto do editor promete alternância, mas só há o modelo Elegance

- **Estado:** corrigido localmente e coberto pelo SSR test do editor.
- **Gravidade:** P4 (texto residual sem impacto funcional material demonstrado).
- **Módulo:** frontend / aparência / seletor de layout.
- **Especificação aplicável:** `specs/009-modelo-vitrine-substitui-liquid-glass/spec.md` está marcado como rascunho; a história 9 posterior de `specs/010-endurecimento-versao-cliente/spec.md` diz que Elegance substitui Minimalista, Liquid Glass e Vitrine.
- **Esperado:** texto deve refletir a opção realmente oferecida e o modelo fixo descrito pela spec 010.
- **Observado:** `AppearanceEditor` mostra a descrição “Escolha o visual do painel público e alterne quando quiser”, mas `PANEL_LAYOUT_MODELS` tem apenas um item (`Elegance`, `src/lib/visual-presets.ts:72-80`). O cartão sempre fica selecionado pois `selected` verifica apenas se o item é Elegance (`src/components/painel/AppearanceEditor.tsx:318-332`). A normalização também força `elegance` para valores antigos como `classic`/`vitrine` (`src/lib/panel1-config.ts:593-596`); teste existente verifica essa migração (`src/lib/panel1-config.test.ts:125-131`).
- **Impacto:** copy promete alternância que o usuário não pode realizar. Nenhuma falha no preview ou perda de configuração foi demonstrada; o modelo fixo alinha-se à decisão 010.
- **Reprodução segura:** inspecionar a lista `PANEL_LAYOUT_MODELS` e o texto renderizado; não é necessário clicar ou salvar configuração.
- **Causa-raiz confirmada:** texto introdutório residual de um fluxo anterior de modelos múltiplos não foi atualizado quando Elegance passou a ser único.
- **Correção:** descrição alterada para “Modelo Elegance disponível para o painel público.”
- **Regressão:** `AppearanceEditor.test.tsx` verifica a nova descrição e a ausência da promessa de alternância; arquivo passou 11/11. TypeScript aprovado; suíte completa: 134 arquivos/1.037 testes aprovados (3 arquivos/8 testes ignorados).
- **Limitação:** não foi executado teste visual em browser; a divergência é de copy e prioridade baixa.

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

### UI-024 — erro ao carregar taxas de referência deixa valores padrão salváveis

- **Estado:** gate corrigido localmente e validado para loading, erro e sucesso.
- **Gravidade:** P3 potencial (configuração Master somente de referência/simulação).
- **Módulo:** frontend Master / taxas de carteira.
- **Esperado:** após falha de leitura, manter salvar desabilitado até carregar valor atual ou exigir confirmação explícita de sobrescrita dos padrões.
- **Observado:** query `platform-fees` mostra mensagem `fees.isError`, mas os estados começam em `0,75` e `3,00`; o botão desabilita apenas enquanto `mutation.isPending || fees.isLoading`, não em erro (`src/routes/_authenticated/painel.carteira-config.tsx:20-24,52-58,85-96`). `saveAgpayFees` persiste os valores recebidos em `platform_settings` (`src/lib/agpay-fees.functions.ts:24-29`). O próprio texto da tela diz que são referências e que custos realizados vêm do ledger; não encontrei uso runtime desses dois números fora da tela/API de configuração.
- **Impacto:** Master pode substituir referências previamente salvas pelos valores padrão após uma falha visível de leitura se enviar o formulário; impacto em movimentação real não foi observado, e os dados são usados como simulação/referência.
- **Reprodução segura:** rejeitar `getAgpayFees`, confirmar alerta, inputs padrão e botão habilitado; não salvar.
- **Causa-raiz confirmada:** erro de consulta não bloqueia mutation e os inputs têm defaults válidos antes de carregar configuração.
- **Correção:** botão usa helper `isPlatformFeesSaveDisabled`, que bloqueia gravação enquanto mutation está pendente, consulta carrega ou consulta falhou. A nova configuração só pode ser salva após leitura bem-sucedida.
- **Regressão:** `src/lib/platform-fees-save-state.test.ts` cobre erro/loading, mutation pendente e estado pronto (2/2); TypeScript passou; suíte completa: 133 arquivos aprovados, 3 ignorados, 1.033 testes aprovados e 8 ignorados.
- **Limitação:** não houve alteração da configuração Master; relevância comercial dessas referências não está formalizada.

### UI-035 — rótulos diários da performance Ag Pay recuam um dia em fusos a oeste de UTC

- **Estado:** transformação confirmada estaticamente e reproduzida com formatador nativo; os valores dos buckets não foram consultados em produção.
- **Gravidade:** P2 potencial para leitura temporal de relatório financeiro (os totais não são alterados, mas o dia exibido fica incorreto).
- **Módulo:** frontend Master / carteira-desempenho / datas.
- **Esperado:** datas de calendário de agregação diária devem ser exibidas como o mesmo dia da chave `YYYY-MM-DD`, sob fuso explicitamente escolhido.
- **Observado:** `getAgpayPerformance` gera `daily.date` usando `d.created_at.slice(0,10)` e o cálculo de lucros de saque também usa a parte UTC da ISO (`src/lib/agpay-performance.functions.ts:145-150`; `src/routes/_authenticated/painel/carteira-desempenho.tsx:129-131`). O gráfico recebe essa data e formata `new Date(v)` com `date-fns` (`:261,266`); strings ISO sem hora são interpretadas como meia-noite UTC e renderizadas no fuso local. Em `America/Fortaleza`, a reprodução `new Date('2026-11-13')` formatada como data local retornou `12/11/2026`.
- **Impacto:** pontos de volume, receita e lucro de saque são rotulados com o dia anterior para navegadores em fusos a oeste de UTC. A agregação e o valor permanecem no bucket UTC; a inconsistência é da apresentação de data. Não há registro real sendo afirmado.
- **Causa-raiz confirmada:** uma data civil (sem hora) é convertida em instante UTC e depois formatada no fuso local.
- **Reprodução segura:** fixar `daily.date = '2026-11-13'`, formatar com o fuso America/Fortaleza e observar `12/11/2026`; verificar tooltip e eixo sem dados remotos.
- **Correção recomendada para spec:** definir se o dashboard agrupa por UTC ou fuso do negócio e tratar a chave como data civil ao renderizar; alinhar agregação de depósito e saque.
- **Regressão:** mesmas chaves são exibidas na mesma data em fusos negativos, UTC e positivos; teste separa `YYYY-MM-DD` de timestamps com hora.
- **Limitação:** a política esperada de fuso para relatórios Master não está formalizada; a mudança de um dia na renderização local está reproduzida.

### UI-025 — confirmação de saque não bloqueia cliques enquanto verifica o PIN

- **Estado:** condição do botão e geração de idempotency key confirmadas estaticamente; repetição de cliques não foi simulada.
- **Gravidade:** P2 potencial (pode submeter mais de um saque intencionalmente idêntico).
- **Módulo:** frontend do estabelecimento / carteira / saques.
- **Esperado:** durante verificação do PIN e início do saque, impedir nova submissão; uma ação de confirmação do usuário deve produzir no máximo uma chamada de saque.
- **Observado:** `confirmSaque` chama `verifyWithdrawalPin` e, em cada `onSuccess`, chama `withdraw.mutate()` (`src/routes/_authenticated/painel.as-pay.tsx:1227-1241`). O handler `withdraw.mutationFn` gera um `crypto.randomUUID()` novo por chamada (`:1197-1205`). O botão da etapa de PIN é desabilitado por `saqueVerifying`, `withdraw.isPending` e validação local, mas não por `confirmSaque.isPending` (`:2070-2076`). `saqueVerifying` inicia false e as atribuições visíveis no fluxo só retornam a false; não é colocado em true antes da verificação (`:1212,1227,1234,1238`).
- **Impacto:** cliques repetidos enquanto a verificação assíncrona está pendente podem iniciar múltiplas mutations com chaves distintas e criar mais de uma solicitação. Reserva do ledger rejeita valor acima do saldo agregado, mas dois saques podem ser aceitos se houver saldo suficiente; a segunda chamada ao payout não seria duplicata idempotente da primeira. Nenhuma solicitação real foi feita.
- **Reprodução segura:** mockar `verifyWithdrawalPin` com promise pendente, clicar duas vezes no botão habilitado e contar chamadas `requestWithdrawal`; cada uma recebe UUID distinto. Não executar em provider.
- **Causa-raiz confirmada:** gate visual não acompanha o estado pendente da mutation que verifica PIN e a idempotency key é criada dentro de cada submissão.
- **Correção recomendada para spec:** desabilitar enquanto `confirmSaque.isPending` e usar trava síncrona por submissão; manter idempotência da mesma intenção entre retries ambíguos.
- **Regressão:** double click durante PIN pendente produz um único saque; erro de PIN permite correção/retry; timeout do request não cria intenção com nova chave sem reconciliação.
- **Limitação:** concorrência de UI e payout não foram executados; ocorrência em produção desconhecida. API-009/PAY-009 registra separadamente que PIN não é exigido pelo próprio handler de saque.


## Inventário de E2E versionado e limite de QA

### Suporte ao cliente — saudação inicial

O handler que alimenta a conversa tenta inserir a saudação como `sender=master` usando sessão autenticada do owner, enquanto RLS permite ao owner inserir apenas `sender=user`. Quando a thread está vazia, o erro desse seed é ignorado e a resposta retorna lista vazia; o detalhe está registrado como API-005 em [backend.md](backend.md). A inspeção é estática, sem teste visual ou sessão de produção.

## Inventário de E2E versionado e limite de QA

`tests/e2e/` contém seis specs. `sidebar-nav.spec.ts` percorre quatro telas do painel; `service-image-upload.spec.ts` cobre rejeição de PDF e recorte de JPEG; `rebrand-agpay.spec.ts`, `aviso-once.spec.ts` e `templates.spec.ts` cobrem comportamentos específicos; `app-hosts.spec.ts` é smoke opcional de três domínios de produção e só roda com `SMOKE_PRODUCTION=true`. Os testes autenticados dependem de `OWNER_STORAGE_STATE`. Playwright executa desktop Chrome e viewport de iPhone, mas isso não equivale a cobertura de todas as 29 rotas nem acessibilidade automatizada.

Nenhuma suíte Playwright foi executada nesta auditoria. O smoke explicitamente configurável consulta hosts reais de produção; os fluxos autenticados executam ações como upload, e o backend local pode herdar integrações configuradas. Para manter a auditoria somente leitura e sem efeitos externos, a validação das jornadas permanece pendente de ambiente de teste isolado. Os 320 testes citados no checkpoint são testes unitários/integrados com mocks, não E2E.

### UI-036 — botão “Como Funciona” da vitrine de templates sem ação

- **Estado:** controle sem ação confirmado por inspeção estática; comportamento de foco/clique em browser não exercitado.
- **Gravidade:** P3 (affordance sem efeito; texto equivalente já está visível abaixo no mesmo hero).
- **Módulo:** frontend autenticado / vitrine de templates.
- **Esperado:** botão que anuncia uma ação deve navegar ou rolar até a explicação, ou ser apresentado como texto sem semântica de botão.
- **Observado:** o botão “Como Funciona” em `src/routes/_authenticated/painel.templates.tsx:351-357` tem `type="button"` e `aria-label`, mas não possui `onClick`, `href` ou destino associado. O texto “Como funciona” e a explicação estão renderizados logo abaixo em `:359-383`.
- **Impacto:** clique ou ativação por teclado não produz resposta, podendo sugerir que a página não reagiu. A informação permanece disponível no fluxo de rolagem.
- **Reprodução segura:** abrir a tela em ambiente de teste e ativar o botão por mouse/teclado; conferir que não há navegação ou rolagem iniciada pelo controle. A leitura da fonte já confirma a ausência de handler.
- **Causa-raiz confirmada:** botão renderizado sem manipulador ou destino.
- **Correção recomendada para spec:** dar ao controle destino de âncora/rolagem coerente com a explicação ou renderizá-lo como elemento não interativo.
- **Regressão:** ativação por mouse/teclado leva à explicação; se for apenas decorativo, não é exposto como botão no accessibility tree.
- **Limitação:** nenhuma sessão browser foi iniciada; não foi feita avaliação de foco, contraste ou acessibilidade da rota inteira.

### UI-037 — vitrine atual não oferece entrada para o editor visual

- **Estado:** ausência de ligação de navegação confirmada no source percorrido; fluxo autenticado não foi exercitado em browser.
- **Gravidade:** P2 (uma jornada de edição fica inalcançável pela navegação documentada; rota/ID direto ainda podem funcionar).
- **Módulo:** frontend autenticado / templates / editor visual.
- **Esperado:** FR-010 da spec 007 e T030 pedem escolher uma arte na tela Templates e abrir o editor com preview e controles prontos.
- **Observado:** `src/routes/_authenticated/painel.templates.tsx:161-186,348-357` implementa seleção de nicho e abertura de grade de assets para download, sem link `/editor-template`. A rota do editor existe em `src/routes/_authenticated/editor-template.$id.tsx` (caminho verificado via `rg` sobre o diretório), e a única UI com link de edição encontrada está em `src/components/template-editor/MasterTemplatesTab.tsx:11-35`. `rg` encontrou uso de `MasterTemplatesTab` apenas na própria declaração, sem import/montagem em `src/`. O editor permite modo business, mas o fluxo atual não oferece ao dono uma lista/link para chegar a essa branch.
- **Impacto:** dono que segue o menu Templates não consegue iniciar a edição visual pela jornada prevista; o acesso exige uma rota e ID obtidos por outro meio. Isso deixa a funcionalidade de edição customizada sem descoberta normal pela UI.
- **Reprodução segura:** leitura estática do `routeTree` confirma a rota Templates; busca no source por `/editor-template` e `MasterTemplatesTab` confirma que a vitrine não aponta ao editor e que a tab com link não está montada. Teste browser pendente.
- **Causa-raiz confirmada:** tela atual de Templates foi implementada como vitrine de assets para download; o componente com links para editor é isolado e sem ponto de montagem.
- **Correção recomendada para spec:** decidir e documentar qual superfície é a entrada de edição para negócios; conectar a lista de templates/arte ao editor e validar autorização owner no fluxo completo.
- **Regressão:** owner consegue selecionar uma arte a partir da superfície Templates vigente, abrir editor com ID correto e salvar/reabrir override; usuário sem permissão continua rejeitado no servidor.
- **Limitação:** a busca é sobre source local; não se verificou menu dinâmico, feature flag remota, sessão de negócio nem conteúdo real do banco.



### UI-037 fixed locally (2026-11-14)

Added an owner-scoped "Suas artes para editar" section to Templates. It lists active visual outreach templates with their effective business design and opens the selected template at `/editor-template/<id>`; the server list function validates business ownership. The existing editor then loads preview and layer controls. Focused component + server-function tests: 5/5; `npx tsc --noEmit` and `git diff --check` passed. No live business or database changes. Count: 74 fixed, 7 blocked/unverified, 70 pending of 151.

### UI-038 — botão de copiar Pix confirma sucesso antes da cópia terminar

- **Estado:** corrigido localmente e validado por sucesso/rejeição da clipboard mockada.
- **Gravidade:** P3.
- **Módulo:** frontend público / pagamento Pix.
- **Esperado:** informar que o código foi copiado somente após `navigator.clipboard.writeText` resolver; em caso de rejeição, manter o estado como não copiado e comunicar falha ou oferecer alternativa.
- **Observado:** `src/components/public-booking/PaymentDialog.tsx:116-121` descarta a Promise com `void`, define `copied` como `true` e mostra toast de sucesso imediatamente. A tela mantém o QR e o código Pix visíveis (`:239-247`), mesmo se a escrita na clipboard rejeitar.
- **Impacto:** usuário pode acreditar que copiou o Pix e sair sem o código na área de transferência; o QR visível continua sendo uma alternativa, então não há evidência de bloqueio do pagamento.
- **Reprodução segura:** em harness de componente isolado, substituir `navigator.clipboard.writeText` por uma Promise rejeitada e clicar em “Copiar código pix”; verificar que hoje a UI ainda confirma sucesso. Não executado para evitar iniciar Node/browser neste ciclo.
- **Causa-raiz confirmada:** atualização otimista de estado e toast sem aguardar nem capturar o resultado assíncrono.
- **Correção recomendada para spec:** aguardar a Promise, só então marcar sucesso; capturar rejeições e mostrar mensagem de falha sem esconder QR/código.
- **Regressão:** cobrir resolução e rejeição da clipboard; sucesso apenas no primeiro caso, falha comunicada no segundo, QR e código continuam disponíveis.
- **Limitação:** permissões e comportamento da clipboard variam por browser/origem segura e não foram exercitados.

### UI-039 — limite por IP pode atrasar atualização do pagamento em sessões simultâneas

- **Estado:** mitigado localmente; configuração por IP e topologia de produção permanecem sem verificação.
- **Gravidade:** P3 potencial.
- **Módulo:** frontend público / polling de pagamento Pix.
- **Esperado:** polling de sessões distintas não deve impedir temporariamente que clientes recebam confirmação do próprio pagamento; falhas por limite devem ficar visíveis ou ser tratadas com retentativa controlada.
- **Observado:** `PaymentDialog.tsx:60-76` consulta `getDepositStatus` a cada 5 segundos por diálogo (até 12 chamadas/minuto) e ignora qualquer erro no `catch`. `booking.functions.ts:1266-1271` aplica ao endpoint `PUBLIC_RATE_LIMITS.depositStatus`, configurado em `rate-limit.server.ts:112` com 120 chamadas/minuto. `enforceRateLimit` cria a chave por escopo e IP (`rate-limit.server.ts:116-127`), e o contador fica em memória por processo (`:17-24`). Assim, dez diálogos contínuos no mesmo IP podem consumir a cota teórica; chamadas adicionais desse IP recebem erro e o cliente não mostra falha. Uma única sessão consome aproximadamente 12/min e não alcança o limite.
- **Impacto:** com tráfego concorrente suficiente atrás do mesmo IP, o modal pode continuar em estado pendente apesar de o pagamento já estar confirmado, até uma chamada subsequente passar; o webhook e o estado persistido não são afetados por esse limite de leitura. Não há evidência de que tal volume tenha ocorrido.
- **Reprodução segura:** inspecionar configuração e simular conceitualmente dez ou mais pollers com IP compartilhado em harness isolado; verificar a resposta de limite e a apresentação de erro. Não executado para evitar iniciar processos após a solicitação do usuário.
- **Causa-raiz:** quota por IP compartilhada entre clientes concorrentes combinada com polling sem controle de erros visível.
- **Correção recomendada para spec:** avaliar a quota com concorrência realista e adotar política que não atrase confirmação (quota dimensionada/particionada com segurança ou backoff/retry observável); manter proteção contra abuso.
- **Regressão:** sessões paralelas atrás do mesmo IP não perdem feedback de pagamento; respostas de limite são tratadas sem loops excessivos nem falso estado de sucesso.
- **Limitação:** volume, proxy efetivo, contadores do processo e frequência real de usuários não foram observados; `clientIp` também depende dos cabeçalhos de proxy já discutidos em SEC-018.

**Revisão de integração com a rota:** `src/routes/agendar.$slug.tsx:376-386` atualiza o histórico a cada 15 segundos enquanto há sinal pendente e passa ao modal um `onClose` inline (`:1096-1099`); o efeito de polling inclui `onClose` nas dependências (`PaymentDialog.tsx:60-75`), então renders da rota reiniciam o timer de 5 segundos. A frequência estática observada é menor que o próprio intervalo de polling e não demonstra starvation ou falha de confirmação. Não abri achado adicional; comportamento sob renderizações frequentes/tempo de rede continua sem teste de browser.

### UI-040 — remarcação Elegance consulta disponibilidade sem profissional

- **Estado:** corrigido localmente; jornada visual continua não exercitada.
- **Gravidade:** P3.
- **Módulo:** frontend público / histórico Elegance / remarcação.
- **Esperado:** sugerir horários disponíveis para o mesmo profissional associado à reserva, pois o fluxo de remarcação mantém esse profissional.
- **Observado:** o helper `getRescheduleAvailabilityInput` passa o `professionalId` associado à reserva e `EleganceHistoryActions` usa esse input na consulta (`src/lib/elegance-reschedule.ts`, `elegance-history.tsx`). O seletor desabilita enquanto carrega ou falha; mensagem distingue erro de lista vazia e apresenta retry.
- **Impacto:** em serviços vinculados a profissionais, o histórico Elegance não consegue carregar horários para a remarcação; a interface apresenta ausência de disponibilidade em vez do erro de validação. Para serviços sem vínculos de profissionais, esse caminho de erro não se aplica.
- **Reprodução segura:** em fixture isolada, associar profissional ao serviço e consultar `getAvailability` pelo componente com `professionalId: null`; confirmar rejeição de `validateProfessional` e placeholder sem horários. Não executado neste ciclo.
- **Causa-raiz corrigida localmente:** consulta agora preserva o profissional original da reserva; erro da Server Function não é mais apresentado como calendário sem horários.
- **Validação:** `elegance-reschedule.test.ts` verifica profissional original, serviço sem profissional e distinção entre erro e agenda vazia (3/3); `npx tsc --noEmit` passou. Suíte completa recente: 137 arquivos aprovados/3 ignorados e 1.070 testes aprovados/8 ignorados.
- **Limitação:** sem QA visual, serviço ou agendamento real; comportamento da jornada visual permanece não exercitado.

### UI-016 corrigido localmente (2026-11-14)

A tela confundia erro/carregamento da consulta de profissionais com lista vazia e iniciava o escopo como global; em negócios com múltiplos profissionais, isso permitia criar bloqueio para todos sem escolha explícita. Agora erro mostra retry e erro/carregamento bloqueiam a submissão; com mais de um profissional o owner precisa escolher “Todos” ou um profissional. Consulta válida com zero ou um profissional mantém o escopo global compatível. Testes do helper de escopo e da Server Function: 6/6; `npx tsc --noEmit` e `git diff --check` passaram. Sem bloqueio salvo em dados reais. Contagem: 76 corrigidos localmente, 7 bloqueados/não verificados, 68 pendentes dos 151.

### UI-007 corrigido localmente (2026-11-14)

O formulário de funcionamento agora rejeita horário inválido e `fim <= início`, mostra o erro junto aos campos e desabilita Salvar. Migration aditiva `20261115010000_business_hours_end_after_start.sql` impõe `CHECK (ends_at > starts_at) NOT VALID` para novas escritas, sem validar ou alterar linhas antigas; intervalo overnight segue fora do modelo diário documentado. Testes unitários: 2/2; DB isolado: 3/3; TypeScript, diff check, `npm test` (115 arquivos, 988 aprovados/8 ignorados) e `npm run test:db` (85/85) passaram. Migration não foi aplicada remotamente. Contagem: 77 corrigidos localmente, 7 bloqueados/não verificados, 67 pendentes de 151.

### UI-019 corrigido localmente (2026-11-14)

A tela tratava `data ?? []` como uma contagem confirmada: erro de query indicava “1º profissional grátis” e liberava cadastro. Agora estados de loading e erro não mostram preço estimado e desabilitam a ação; erro oferece retry. Só uma lista carregada permite derivar gratuidade, custo adicional e limite de dez. Teste do estado de contagem: 3/3; `npx tsc --noEmit` e `git diff --check` passaram. Nenhum profissional foi criado e regra de cobrança não foi alterada. Contagem: 78 corrigidos localmente, 7 bloqueados/não verificados e 66 pendentes de 151.

### UI-010 corrigido localmente (2026-11-14)

O editor de aparência agora aguarda configuração e perfil do negócio antes de expor controles. Loading fica explícito; falha sem dados mostra erro e retry para ambas as queries. Uma falha de refetch com dados previamente carregados preserva o editor e não desmonta o rascunho. Testes do gate: 4/4; `npx tsc --noEmit`, `git diff --check` e regressão completa passaram: 117 arquivos, 995 testes aprovados, 8 ignorados. Não houve escrita no negócio nem acesso ao Storage remoto. Contagem: 79 corrigidos localmente, 7 bloqueados/não verificados, 65 pendentes dos 151.

### UI-009 corrigido localmente (2026-11-14)

O editor agora conclui `saveFn` e `updateProfileFn` antes de limpar paths antigos de logo/fundo. Qualquer falha de persistência impede a limpeza; falha ao remover depois de persistir só deixa asset órfão e é registrada, sem reverter a publicação. Teste da sequência: persistência precede limpeza e, em erro, cleanup não é chamado (2/2). `npx tsc --noEmit`, `git diff --check` e regressão completa passaram: 118 arquivos, 997 aprovados/8 ignorados. Nenhum upload ou remoção real no Storage. Contagem: 80 corrigidos localmente, 7 bloqueados/não verificados, 64 pendentes de 151.

### UI-009 corrigido localmente (2026-11-14)

O editor agora conclui `saveFn` e `updateProfileFn` antes de limpar paths antigos de logo/fundo. Qualquer falha de persistência impede a limpeza; falha ao remover depois de persistir só deixa asset órfão e é registrada, sem reverter a publicação. Teste da sequência: persistência precede limpeza e, em erro, cleanup não é chamado (2/2). `npx tsc --noEmit`, `git diff --check` e regressão completa passaram: 118 arquivos, 997 aprovados/8 ignorados. Nenhum upload ou remoção real no Storage. Contagem: 80 corrigidos localmente, 7 bloqueados/não verificados, 64 pendentes de 151.

### UI-023 validado corrigido localmente (2026-11-14)

A falha de `localStorage` durante a reserva com sinal agora retorna IDs atualizados em memória, mostra aviso de persistência e não interrompe a configuração do Pix/histórico; a lista de códigos públicos também permanece em memória mesmo se a gravação falhar. Testes de storage indisponível/leitura falha: 2/2. TypeScript e suíte completa recentes passaram: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. Limitação: sem Storage local funcional, a recuperação após recarregar a página não é persistida. Nenhuma cobrança real. Contagem: 83 corrigidos/validados localmente, 7 bloqueados/não verificados, 61 pendentes de 151.
### UI-017 validado corrigido localmente (2026-11-14)

A central Master distingue loading, erro, lista vazia válida e conteúdo carregado para lista e thread; falhas exibem retry e não parecem ausência de conversas. Teste dos estados: 2/2; TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Consultas remotas não foram executadas. Contagem: 86 corrigidos/validados localmente, 7 bloqueados/não verificados, 58 pendentes de 151.
### UI-035 validado corrigido localmente (2026-11-14)

O eixo e o tooltip agora interpretam `YYYY-MM-DD` como data civil via `parseCivilDate`, sem converter a chave UTC para meia-noite local e recuar um dia. Teste sob `America/Fortaleza` confirma que a chave `2026-11-13` continua no dia 13. Focal 1/1; TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Política de agregação UTC vs. fuso do negócio continua não documentada; esta correção alinha a etiqueta à chave retornada. Contagem: 87 corrigidos/validados localmente, 7 bloqueados/não verificados, 57 pendentes de 151.
### UI-025 validado corrigido localmente (2026-11-14)

A confirmação de saque combina lock síncrono antes da verificação do PIN e botão desabilitado durante verificação/saque; o lock é liberado em sucesso ou erro. Isso impede dois cliques de gerar intenções/UUIDs distintos enquanto a primeira submissão está pendente. Testes do lock: 2/2. TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Nenhum saque real. Contagem: 88 corrigidos/validados localmente, 7 bloqueados/não verificados, 56 pendentes de 151.
### UI-026/UI-027 validados corrigidos localmente (2026-11-14)

UI-026: aprovação Pix separa loading, erro com retry, fila vazia válida e fila pendente. UI-027: telas Master de assinantes, testes e atenção distinguem erro/loading de sucesso; MRR mostra indisponível, contadores usam travessão e estados vazios só aparecem com resposta válida. Testes dos estados: 7/7; TypeScript e regressão completa recentes passaram (120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados). Sem leitura remota. Contagem: 90 corrigidos/validados localmente, 7 bloqueados/não verificados, 54 pendentes de 151.
### UI-038 corrigido localmente — 2026-11-15

O botão de cópia aguarda `navigator.clipboard.writeText`; somente resolução marca “Código copiado” e mostra sucesso. Rejeição ou API indisponível mostra erro sem ocultar QR nem código Pix. `copy-pix-code.test.ts`: 2/2; `npm test`: 122 arquivos aprovados, 3 ignorados; 1003 testes aprovados, 8 ignorados; TypeScript e diff check passaram. Sem pagamento ou clipboard real. Contagem: 92 corrigidos localmente, 7 bloqueados/não verificados, 52 pendentes de 151.
### UI-039 mitigado localmente — 2026-11-15

`PaymentDialog` consulta status a cada 15 segundos após a primeira leitura, sem chamadas simultâneas. Falhas mostram aviso e o backoff aumenta até 60 segundos; uma resposta válida limpa o erro e volta à frequência normal. Teste focal 1/1; suíte completa: 123 arquivos, 1004 aprovados e 8 ignorados; TypeScript e diff check passaram. Limite por IP permanece compartilhado; produção/proxy e concorrência real não foram consultados. Contagem: 93 corrigidos/validados localmente, 7 bloqueados/não verificados e 51 pendentes de 151.
#### UI-036 — encaminhamento decidido para o achado (2026-11-15)

O texto de “Como Funciona” já está renderizado no hero; a correção proposta é fazer o controle rolar até essa explicação por âncora. A escolha entre rolagem até a explicação e outro destino foi perguntada ao usuário, mas nenhuma resposta chegou nesta janela. Pelo gate da skill brainstorming, nenhuma alteração de interface foi feita; UI-036 fica bloqueado até a decisão.


### UI-011 corrigido localmente ? 2026-11-15

A lista Master de notifica??es agora distingue carregamento, falha de consulta e vazio confirmado; falha oferece ?Tentar novamente? e n?o mostra o convite para criar a primeira notifica??o. O teste unit?rio dos quatro estados passou (3/3) e `npx tsc --noEmit` passou. Sem browser ou backend remoto; QA visual permanece pendente. Contagem: 99 corrigidos localmente, 9 bloqueados/n?o verificados e 43 pendentes de 151.

**Atualização de API-006 (2026-11-15):** os salvamentos de serviço+profissionais e categoria+serviços agora usam RPCs transacionais `SECURITY INVOKER`; testes de rollback passaram em banco descartável. A migration não foi aplicada remotamente. Os demais controles do catálogo continuam na cobertura parcial indicada acima.
### Ciclo 83 — reconciliação BOOK/UI P2 — 2026-11-15

Revalidei e atualizei o índice de BOOK-002/003/005/006/007/010/012/013 e UI-002/007/009/010/016/019/021/028/037 com correções locais documentadas nas fichas. Suíte geral recente: 136 arquivos passaram, 3 ignorados; 1.058 testes passaram, 8 ignorados. DB: 10 arquivos/99 testes. TypeScript e diff check passaram no ciclo. Migrations apenas locais; sem escrita de agenda/Storage em produção, deploy ou publicação. Os itens já estavam no conjunto de corrigidos; tally 115/11/25 inalterado.
### Ciclo 85 — reconciliação UI/Admin P2 — 2026-11-15

Índice atualizado para UI-003/004/013/014/030/033 e ADM-001/002/003/API-004 conforme correções locais já registradas no histórico. `npm test` corrente: 136 arquivos/1.058 testes aprovados, 3/8 ignorados; TypeScript e `git diff --check` passaram. Policies remotas, produção e uso real não foram alterados ou confirmados. Tally permanece 115/11/25.


### UI-013 ? recebiveis escondem KPIs durante carga e erro (revalidado em 2026-11-15)

A rota atual deriva loading/error/ready de `calendarQuery` e renderiza KPIs/calendario somente em ready; o estado de erro exibe alerta e retry, sem numeros parciais como confirmados. Resposta vazia valida continua em ready e representa zeros calculados. Revalidacao: `receivables-view-state.test.ts` 3/3; tambem coberta pelo novo teste SSR da rota em `painel.recebiveis.test.tsx`. Nenhuma consulta remota foi feita; QA visual em browser segue pendente. A descricao inicial de fallback numerico da UI esta supersedida pelo codigo/teste atual.

### UI-030 ? KPI Recusado marca metrica nao disponivel (corrigido localmente em 2026-11-15)

A revalidacao encontrou que o helper `unavailableRejectedChargesMetric` existia, mas o JSX continuava renderizando `R$ 0` literal. Conectei o card da rota ao helper e adicionei teste SSR que renderiza a rota real. O teste RED falhou com `R$ 0,00`/`0 cobrancas`; apos a correcao, loading/erro/vazio validos passaram 3/3, junto com os dois testes de estado/metrica: 7/7. `npx tsc --noEmit` passou. Nao ha fonte nem janela temporal definida para contar recusas; o KPI agora explicita indisponibilidade em vez de inventar zero. Nenhum dado financeiro real foi consultado e QA visual em browser permanece pendente.


### UI-014 ? relatorio interrompe calculos quando qualquer dataset falha (revalidado em 2026-11-15)

A query da rota `painel.relatorio.tsx` passa appointments, services e professionals a `requireReportDatasets`; a funcao propaga erro de qualquer fonte antes de montar metricas. A interface mostra loading, erro com retry e so renderiza cards/graficos quando ha data sem erro. `npx vitest run src/lib/report-datasets.test.ts`: 4/4, cobrindo cada dataset critico com erro e resposta vazia valida. `npx tsc --noEmit` passou nesta retomada. Nao houve leitura de dados reais; producao e QA visual seguem sem verificacao. A descricao inicial de erro parcial e supersedida pelo estado atual.


### UI-026 ? fila de aprovacao Pix distingue erro, carregamento e vazio (revalidado em 2026-11-15)

A rota expoe `isLoading`, `isError`, `isFetching` e `refetch`; erro mostra alerta com retry, loading nao apresenta fila vazia, e a mensagem ?Nenhum Pix pendente? ocorre apenas no estado empty depois de resposta valida. O estado ready preserva a fila pendente. `npx vitest run src/lib/pix-approval-list-state.test.ts`: 4/4 (loading, erro, vazio valido, fila pronta). Nenhuma chave real foi consultada ou alterada; backend remoto e QA visual continuam sem verificacao. A descricao inicial de erro indistinto de vazio esta supersedida pelo codigo atual.


### UI-015 revalidado - semantica de faturamento pendente (2026-11-15)

O calculo atual em src/lib/report-metrics.ts soma price_cents vigente do servico associado a cada appointment concluido; a rota carrega esse catalogo na consulta. A spec 001, FR-017, exige manter a metrica de faturamento existente, sem definir se o valor deve refletir o preco atual ou o preco na data do atendimento. O modelo atual de appointment tambem nao guarda snapshot do preco integral. Alterar agora o calculo ou o schema escolheria uma regra cont?bil/comercial sem respaldo, entao UI-015 permanece bloqueado ate decisao de produto. Nenhum dado ou preco real foi acessado e nenhum codigo foi alterado.


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


### Reconciliacao ADM-001/DB-003/DOC-001/PRO-001/PAY-022/PAY-027/PAY-029 - 2026-11-15

Regressao atual: 10 arquivos/144 testes unitarios aprovados e 1 ignorado; DB do limite de profissionais passou 2/2 filtrado; node --check scripts/ensaio/db.mjs passou. ADM-001: status cancelado e apresentado como Cancelado. DB-003: JSDoc bate com retorno. DOC-001: nota separa deploy aa4a32e do HEAD 323189d; git confirma 24 commits posteriores e ancestralidade do hash, sem confirmar producao. PRO-001: limite de 10 bloqueia cadastro acima do teto em DB e fluxo server-side. PAY-022: hook pagina todas as empresas. PAY-027: pagamentos anteriores impedem classificacao trial/cancelamento indevido. PAY-029: evento de refund sincroniza ledger, status e agregados; contrato oficial de refund e regra de retencao de comissao seguem nao verificados. Sem cron, webhook, conta, deploy ou dados remotos.


### Revalidacao UI-018/UI-022 - 2026-11-15

`support-draft.test.ts` confirma que texto e preservado enquanto o envio esta pendente e em erro, e limpo somente apos sucesso. O SSR de `AppearanceEditor.test.tsx` confirma que o texto descreve apenas o modelo disponivel. Os dois arquivos passaram, 13/13 testes. Nenhuma mensagem foi enviada.


### UI-023 current validation - 2026-11-15

ppendRecoveryId catches storage access/read/write failures and returns updated IDs in memory; route continues to show Pix/history after saving memory state. ooking-recovery-storage.test.ts passed 2/2; ooking.functions.test.ts passed 117/117 earlier in this session. Reload still cannot recover IDs when browser storage is disabled; warning remains. No live reservation or payment.


### UI-001 current validation - 2026-11-15

The subscription selector renders only PIX and no card fields/input controls; SSR regression passed 1/1. PAY-008 still tracks whether hosted card payments belong in product scope. No payment created.


### UI-002 current validation - 2026-11-15

Applied filters now drive type/status filtering and pagination resets; Clear restores full results. 	ransactions-filter.test.ts and route SSR test passed, 3 tests across 2 files. No production transactions read.


### UI-017 current validation - 2026-11-15

Support list/thread distinguish loading, error, ready/empty, and show retry on failures. support-query-state.test.ts passed 2/2, including error with cached data. No live support data or replies.

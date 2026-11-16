# Conformidade com especificações — triagem inicial

As specs estão presentes localmente em `specs/` mas são ignoradas pelo Git por `.git/info/exclude`; devem ser preservadas como artefatos de auditoria e correlacionadas com o código da mesma árvore. Matriz parcial, ainda sem declarar conformidade global:

| Tema | Especificação | Evidência no código | Estado inicial |
|---|---|---|---|
| Gateway de sinal | Spec 003 migra Asaas para AgPay com split por cobrança | adaptador ativo AgPay, mas `createPixCharge` não envia `splits` | A spec 003 foi superada por decisão posterior |
| Destino do sinal | Spec 004 diz que a plataforma recebe integralmente e repassa via carteira/saque | cobrança sem split no payload; ledger interno calcula crédito | Parcial: falta verificar regra global no dashboard AgPay e produção |
| Commissionamento | Spec 004 prevê comissão da plataforma deduzida do saldo do dono | percentual configurável, default/fallback 0; congelado no pagamento | Risco de política; valor comercial/default não esclarecido |
| Cartão | Página AgPay documenta checkout VeoPag; spec 010 inclui method `card`; UI registrada como “em breve” | percurso completo de cartão ainda não mapeado | Pendente, sem conclusão de escopo |
| Webhooks | Spec 004 exige confirmação e deduplicação; AgPay documenta HMAC | HMAC raw body, inbox hash e ledger idempotente no código | Parcialmente coberto; refund event name e carga máxima pendentes |
| Privacidade Asaas | Spec 004 FR-047 remove resíduos do nome anterior | migrations históricas mantêm nomes `asaas`; runtime ainda precisa varredura refinada | Não declarar violação sem distinguir histórico de runtime/schema |

## Regras

- Especificações anteriores não devem ser aplicadas quando uma spec posterior substitui o modelo; registrar a cadeia 003 → 004 → 008 e decisões locais posteriores.
- Cobertura item a item de requisitos e tarefas pendentes será completada após os ciclos de backend/frontend/agendamento.
- Migrations remotas não foram comparadas porque o projeto Supabase correto está inacessível no conector.

| Valor financeiro reportado pelo webhook | Spec 005 exige valor divergente em revisão; o código atual processa só UUID/status | PAY-014: divergência com spec e risco P1 potencial |
| Comissão fixa por cobrança | Spec 005 indica R$ 0,25; cálculo atual `PLATFORM_FLAT_FEE_CENTS = 0`; decisão posterior só aparece em comentário de código | PAY-015: divergência documental; política a confirmar |

### PAY-014 — divergência de valor no webhook

Spec 005 determina rejeitar/segurar e sinalizar qualquer webhook cujo valor bruto divirja da cobrança local. A rota persiste o payload, mas o worker descarta `amount` e processa por transaction UUID; o ledger credita baseado no valor local. Nenhum cenário com discrepância está presente na suíte revisada. Veja PAY-014 em [pagamentos.md](pagamentos.md).

### PAY-015 — comissão fixa não reconciliada entre specs e implementação

Spec 005 definiu R$ 0,25 fixos além do percentual. A implementação atual usa taxa fixa zero; há comentário que cita remoção posterior em 06/10, sem spec posterior explícita encontrada durante esta triagem. Ver PAY-015 em [pagamentos.md](pagamentos.md).

## Validação específica da spec 005

- **Valor bruto do webhook:** a spec exige colocar divergência entre valor do webhook e cobrança local em revisão sem crédito automático. O código processa por UUID/status e não compara o montante (PAY-014).
- **Comissão por sinal:** a spec define 0% + R$ 0,25; o código fixa componente da plataforma em zero. Um comentário atribui a remoção a 06/10/2026, mas não foi encontrada formalização da substituição em spec posterior (PAY-015).

## Revisão complementar — FR-021 e FR-028 (spec 010)

- **FR-021:** `painel.transacoes.tsx` rotula como “Lucro Ag Pay” o `netCents`; `transactions.functions.ts` constrói esse campo como líquido da cobrança/saque, não como lucro ledger. Divergência documentada como PAY-020. O relatório `agpay-performance.functions.ts` calcula lucro a partir do ledger, mas isso não corrige o rótulo/valor de outra tela Master.
- **FR-028:** os filtros de tipo/status da tela de transações não afetam a lista (UI-002), e “Comparativo Evolutivo” só exibe toast “em breve” (UI-003). Ambos contradizem a exigência de efeito real/ocultação dos controles sem função; validação de browser ainda pendente.
- **FR-017 (spec 001):** a tela mantém a métrica de faturamento, mas calcula o valor com preço atual do serviço, sem snapshot do preço total no appointment. A expectativa de receita histórica não está explícita; risco UI-015 pendente de decisão de produto.
- **FR-029a (spec 001):** `painel.negocios.tsx` apresenta edição de nome, link público/slug, categoria, telefone e endereço. A mutation usa `updateBusinessProfile`, que consulta ownership antes do update administrativo; inspeção estática compatível com o requisito. Não foi feito fluxo E2E, edição real ou confirmação da reflexão no painel público.

## Revisão complementar — preferências e antecedência do WhatsApp (spec 001)

- **FR-026 / cenário de aceitação 4:** nesta revisão, somente `/painel/lembretes` expõe o controle visual da antecedência principal (`reminder_hours_before`). `/painel/configuracoes` carrega e persiste o campo para preservação/compatibilidade, mas o bloco “Avisar Clientes” oferece `extra_reminder_minutes` e seu template (não uma segunda edição das horas principais). Não foi comprovada duplicação de controle para a mesma configuração.
- O comportamento de salvamento da tela de preferências continua necessitando validação isolada para garantir que valores principais preservados não sejam sobrescritos por valor inicial; nenhuma alteração/causa foi comprovada nesta inspeção.

## Revisão complementar — ciclo diário de assinatura (spec 010, FR-023/FR-024)

- A rotina registra cada execução e o cancelamento usa RPC idempotente/row lock. Entretanto, os avisos usam read-before-insert sem unicidade (PAY-021), e a varredura de negócios não pagina (PAY-022, truncamento condicional ao limite remoto).
- O cancelamento automático de inadimplência no dia 15 existe por RPC, mas é opt-in e default `false`; tela Master informa que a ativação depende de confirmação. Essa escolha está documentada no runbook local; cron e setting atuais de produção não foram consultados. Não declarar FR-024 atendida em produção até verificar schedule/setting e notificação.
- A deduplicação Master usa `business_id + title` nos últimos 45 dias, mas títulos de aviso se repetem em ciclos de acesso de 30 dias; há risco de suprimir alertas de ciclo posterior (PAY-023), apesar da idempotência em reexecução diária no mesmo ciclo.
- **FR-024:** confirmação de assinatura atualiza apenas `access_until`; não desfaz `cancelled_at/status` que o auto-cancel gravou. O classificador Master continua em `cancelado` (PAY-024). A restauração de acesso efetivo ainda exige validação isolada.
- **FR-024:** job/RPC diferem das telas Master na detecção de trial: elas consultam pagamentos, enquanto cron/RPC só olham `trial_days`; trial convertido em assinante pode não receber avisos nem cancelamento (PAY-027).
- **FR-024 / booking:** auto-cancel grava `status='cancelado'`, mas catálogo/disponibilidade/reserva pública só tratam `suspenso` como bloqueio (BOOK-004). Assim, o bloqueio das novas reservas não está aplicado no caminho público.

## Inventário de pacotes de especificação

| Pasta | Artefatos encontrados | Estado de comparação nesta auditoria |
|---|---|---|
| `001-corrige-regressoes-cliente` | spec, plan, tasks, research, data-model, parity-matrix, split-review, quickstart, merge-notes | Parcial; temas de popup, relatórios e pagamento aparecem em achados relacionados |
| `001-novo-layout-e-templates` | spec, plan, tasks, research, data-model, quickstart, release-checklist, perf-baseline | Parcial; layout/jornadas e regras de cadastro amostradas |
| `002-correcao-regressoes-qa` | spec, plan, tasks, research, data-model, quickstart | Pendente de comparação item a item |
| `002-correcoes-pos-teste-manual` | spec, plan, tasks, research, data-model, quickstart e relatórios QA visual/public link | Parcial; vínculos de profissionais e fluxos de edição selecionados |
| `003-migracao-asaas-agpay` | spec, plan, tasks, research, data-model, quickstart | Parcial; migração para AgPay confrontada com decisão/spec posterior |
| `004-entrega-final-plataforma` | spec, plan, tasks, research, data-model, quickstart, QA/deploy/migration/mobile artefacts | Parcial; split e lifecycle comparados com código atual |
| `005-ledger-financeiro-saldo` | spec, plan, tasks, research, data-model, quickstart | Parcial; valores de webhook e comissão têm divergências/riscos registrados |
| `006-editor-aparencia-wysiwyg` | spec, plan, tasks, research, data-model, quickstart | Parcial; editor e persistência de mídia analisados seletivamente |
| `007-editor-templates-wysiwyg` | spec, plan, tasks, research, data-model, quickstart | Pendente de comparação item a item |
| `008-finalizacao-experiencia-integracoes` | spec, plan, tasks, research, data-model, quickstart | Parcial; WhatsApp, aparência e experiência de booking selecionados |
| `009-modelo-vitrine-substitui-liquid-glass` | somente spec | Substituída para o estado atual pela decisão posterior da spec 010; comparação histórica seletiva registrada em UI-022 |
| `010-endurecimento-versao-cliente` | spec, plan, tasks, research, data-model, quickstart, validação final e artefactos de baseline/DB/policies/deploy | Parcial; pagamentos, RLS, lifecycle e estado de algumas tasks verificados |

**Risco de referência:** há dois pacotes iniciados em `001-` e dois em `002-`. Ao citar requisitos, usar sempre o nome completo da pasta e arquivo; número isolado é ambíguo. Foram identificadas 12 pastas. Os artefatos `specs/` estão no `.git/info/exclude`; este inventário foi somente leitura e nenhuma spec foi modificada.

### Checkboxes registrados em `tasks.md`

Contagem literal dos itens marcados, útil para orientar verificação de aceite; `[ ]` pendente no documento não prova que a funcionalidade esteja ausente, pois pode representar deploy, QA manual ou atualização documental. Pastas sem `tasks.md` ou sem checklist padrão permanecem sem contagem.

| Pasta | `[X]` | `[ ]` | Observação |
|---|---:|---:|---|
| `001-corrige-regressoes-cliente` | 55 | 9 | QA/estado de parte dos itens ainda requer confronto |
| `001-novo-layout-e-templates` | 42 | 2 | — |
| `002-correcao-regressoes-qa` | 0 | 0 | Arquivo não contém caixas de checklist reconhecíveis |
| `002-correcoes-pos-teste-manual` | 47 | 16 | QA manual e artefatos precisam comparação com a versão atual |
| `003-migracao-asaas-agpay` | 0 | 1 | Itens marcados como pendentes no arquivo |
| `004-entrega-final-plataforma` | 0 | 9 | Itens marcados como pendentes no arquivo |
| `005-ledger-financeiro-saldo` | 0 | 39 | Itens marcados como pendentes no arquivo |
| `006-editor-aparencia-wysiwyg` | 0 | 31 | Itens marcados como pendentes no arquivo |
| `007-editor-templates-wysiwyg` | 0 | 0 | Arquivo não contém caixas de checklist reconhecíveis |
| `008-finalizacao-experiencia-integracoes` | 18 | 57 | O próprio arquivo inclui itens `partial` e validação externa pendente |
| `010-endurecimento-versao-cliente` | 84 | 18 | Há tarefas de integração/produção e documentação explicitamente abertas |

As contagens foram feitas por leitura dos arquivos locais e não alteram o estado oficial das specs.

### Pacote 009 — precedência do pacote 010

O pacote 009 está em estado `Rascunho` e propõe Vitrine + Clássico. A história 9 da spec 010 posterior registra decisão diferente: Elegance substitui Minimalista, Liquid Glass e Vitrine. A implementação normaliza layouts legados para Elegance, alinhada a essa decisão; a interface lista somente Elegance, mas manteve o texto residual “alterne quando quiser” (UI-022). Portanto os requisitos visuais específicos do antigo Vitrine não são critério vigente sem nova decisão.

## Questão aberta — dias de trabalho individual da equipe

- `professionals.working_days` e o schema de `saveProfessional` aceitam todos os dias `0..6` (`src/lib/professionals.functions.ts:22`), mas `WeekdayLinks` só apresenta segunda a sábado (`src/routes/_authenticated/painel.profissionais.tsx:111-134`). A seleção de dias do estabelecimento suporta domingo, e specs 010 descrevem padrão de segunda a sábado para serviços, sem definir dias individuais de profissional.
- **Estado:** inconclusivo; não classificar como defeito até confirmar se o produto deve permitir que profissional trabalhe no domingo quando o estabelecimento atende nesse dia. Nenhuma alteração de configuração foi feita.

## Questão aberta — semântica da página de assinantes e do MRR

- A rota `painel.assinantes.tsx` descreve estabelecimentos “com a fatura do ciclo atual paga” e contabiliza MRR para `category_ === 'assinante'` (`src/routes/_authenticated/painel.assinantes.tsx:26-38,63-66`). O backend deriva essa categoria de `access_until` futuro, status não suspenso, ausência de cancelamento e histórico de ao menos um pagamento para não classificar como teste (`src/lib/lifecycle.functions.ts:146-164`; `src/lib/subscription-lifecycle.ts:64-88`). Não exige pagamento em um mês calendário atual.
- No modelo de vencimento rolante da documentação local, acesso válido após pagamento confirmado pode ser uma representação suficiente do ciclo pago. Porém, não está definido na spec revisada se contas com acesso concedido/manual ou outro estado com `access_until` futuro devem constar como assinantes pagantes e entrar no MRR exibido.
- **Estado:** semântica inconclusiva, não contabilizada como achado de defeito. Confirmar a regra de negócio de MRR e quais grants/isenções são incluídos antes de afirmar divergência; nenhum dado comercial foi consultado.

## Recebíveis — cobertura do inventário de controles (spec 010)

- T076 da pasta `specs/010-endurecimento-versao-cliente` inclui recebíveis entre as telas Master cujos controles devem ser inventariados em `inventario-ui.md` e dados fabricados identificados.
- A leitura estática da rota encontrou o KPI “Recusado” como valor literal zero sem métrica correspondente no retorno de `getReceivablesCalendar` (UI-030). Esse controle não aparece no inventário de UI consultado.
- **Estado:** gap documental local confirmado; o preenchimento do inventário não prova ausência de outras verificações, mas a tabela atual não registra este placeholder. Specs ignoradas pelo Git e ambiente remoto não foram alterados.

## Spec 010 — itens de convergência ainda abertos

Leitura de `specs/010-endurecimento-versao-cliente/tasks.md` e notas relacionadas confirmou que várias caixas permanecem abertas. Isso é estado documental da spec e não prova por si só falha do produto:

| Tarefas | Requisito/validação | Estado nesta auditoria |
|---|---|---|
| T039/T093 | FR-012, logos/imagens reais após restrição de Storage | Política local parcialmente exercitada; falta evidência visual com imagem real. Produção não consultada. |
| T048 | T014, remover referências a colunas removidas e provar tipos | Busca em `src/` encontrou somente sentinelas no `reset-password.test.ts`; nota 04/11 registra types/tsc, mas a validação não foi repetida nesta auditoria. |
| T061/T096 | FR-022, sinal percentual até geração do Pix em mobile/desktop | QA browser pendente; nota da spec registra erro de conexão VeoPag em 04/11, não revalidado nem pago. |
| T073/T094 | FR-027, configurar webhook Evolution em instância temporária e receber evento | Implementação e testes locais não substituem validação com instância real; nenhuma mensagem foi enviada nesta auditoria. |
| T074/T095 | FR-025, confirmar nome oficial do evento de estorno AgPay | Código e eventos candidatos revisados; contrato do evento permanece inconclusivo, apesar da consulta documental registrada no checkpoint. |
| T080/T097 | FR-028, revisão visual Master/SDR/booking em mobile e desktop | Inspeção estática parcial; QA de browser e acessibilidade ainda pendentes. |
| T085/T099 | FR-014, quickstart completo e smoke autenticado publicado | Não executados nesta auditoria; nenhum host de produção foi acessado. |
| T086/T098 | revisão formal de segurança do merge/main | A auditoria técnica em andamento oferece revisão própria, mas não altera a caixa da tarefa nem prova a execução de `/code-review`. |
| T100 | FR-033, atualizar nota de mudanças para refletir merge/deploy e alterações posteriores | **Corrigido localmente — DOC-001:** nota agora distingue o deploy registrado em `aa4a32e` (04/11) do HEAD `323189d` em `main` (12/11), registra as mudanças do commit `742114f` (05/11) e deixa explícito que a produção posterior ao deploy não foi verificada. Nenhuma consulta a dados do cliente foi feita. |
| T101 | FR-031, migration idempotente Elegance preservando mídia | Migração ainda marcada aberta; implementação força o layout na leitura. Nenhuma migration foi executada ou escrita nesta auditoria. |
| T102 | registrar decisões fora do escopo/testes posteriores de 05/11 | Tarefa aberta; efeitos aparecem no código/spec posterior, mas registro de decisão e testes de conformidade ainda requerem validação. |

**Conclusão parcial:** a cobertura da spec 010 não pode ser declarada completa. Tarefas browser/provedor/produção estão limitadas por ausência de serviço real e pelo requisito de não enviar mensagens/pagamentos; tarefas de migration e testes permanecem fora do escopo de escrita desta auditoria.

## Spec 007 — editor visual de templates

| Requisito | Evidência atual | Estado da auditoria |
|---|---|---|
| FR-010 / T030: abrir edição a partir da tela Templates | `painel.templates.tsx` atual abre assets por nicho para download e não contém ligação para `/editor-template`. `MasterTemplatesTab` contém link de edição, mas a busca de referências no source encontrou somente sua declaração, sem montagem. | **Divergência confirmada — UI-037.** O quickstart relata abrir diretamente a URL, o que não prova a entrada de navegação exigida. |
| FR-001–009, FR-011–014 | Implementação e testes de `TemplateCanvas`, `EditorPanel`, interação por camadas e rota estão descritos nas tarefas marcadas como concluídas e no quickstart datado de 30/09. | Não reexecutados; comportamento real e acessibilidade continuam sem verificação independente nesta auditoria. |

A spec 007 está marcada `Draft`; a caixa de T030 está marcada concluída, mas a superfície de navegação indicada por essa tarefa diverge do source atual. A comparação deste ciclo foi restrita ao requisito de entrada do editor; não declara conformidade integral dos outros requisitos.


### Reconciliacao ADM-001/DB-003/DOC-001/PRO-001/PAY-022/PAY-027/PAY-029 - 2026-11-15

Regressao atual: 10 arquivos/144 testes unitarios aprovados e 1 ignorado; DB do limite de profissionais passou 2/2 filtrado; node --check scripts/ensaio/db.mjs passou. ADM-001: status cancelado e apresentado como Cancelado. DB-003: JSDoc bate com retorno. DOC-001: nota separa deploy aa4a32e do HEAD 323189d; git confirma 24 commits posteriores e ancestralidade do hash, sem confirmar producao. PRO-001: limite de 10 bloqueia cadastro acima do teto em DB e fluxo server-side. PAY-022: hook pagina todas as empresas. PAY-027: pagamentos anteriores impedem classificacao trial/cancelamento indevido. PAY-029: evento de refund sincroniza ledger, status e agregados; contrato oficial de refund e regra de retencao de comissao seguem nao verificados. Sem cron, webhook, conta, deploy ou dados remotos.

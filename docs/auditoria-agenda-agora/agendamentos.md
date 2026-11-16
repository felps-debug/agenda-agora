# Agendamentos e horários

**Estado:** análise estática parcial. Nenhuma reserva de produção foi criada ou alterada.

## Achados

### BOOK-001 — Reserva aguardando sinal não ocupa o horário

- **Status:** parcialmente mitigado localmente; política de pagamento tardio e migration remota permanecem pendentes.
- **Gravidade:** P1 (pagamento recebido sem reserva garantida).
- **Módulo:** reserva pública / sinal / webhook AgPay.
- **Regra aplicada:** reserva com sinal ocupa o horário até a cobrança deixar de estar ativa e seu estado ser reconciliado pelo worker AgPay; `cancelado` libera a vaga.
- **Causa revalidada:** as consultas de disponibilidade e as exclusion constraints excluíam `aguardando_sinal`, permitindo duas cobranças para o mesmo horário.
- **Correção local:** `booking.functions.ts` agora trata `aguardando_sinal` como ocupado. Migration `20261115110000_hold_booking_slots_for_deposit.sql` reconstrói as constraints de sobreposição para ambos os tipos de agenda e valida os registros existentes ao aplicá-la; se encontrar conflitos históricos, a migration falha integralmente para reconciliação, sem apagar reservas.
- **RED/GREEN:** `business-only-appointment-overlap.test.ts` falhou antes da migration em agendas com e sem profissional; depois passou. Testes booking 117/117, DB 13 arquivos/108 testes, suite geral 137 arquivos/1.071 aprovados/8 ignorados, TypeScript passou.
- **Limite residual:** confirmação após expiração/cancelamento ainda pode resultar em `pago_sem_agendamento` e crédito registrado, conforme o fluxo existente; a política operacional/financeira (incluindo eventual reembolso) não foi definida. Worker consulta o provider para reconciliar expiradas. Migration não aplicada remotamente e frequência/deploy do worker não verificados.
- **Regressão adicional necessária:** eventos tardios `transaction.failed`→`deposit.completed` e `deposit.completed`→`transaction.failed`, confirmação após hold cancelado e UX/ação financeira de `pago_sem_agendamento`. Não usar gateway real.
### BOOK-002 ? Agendamentos sem profissional n?o tinham prote??o at?mica contra sobreposi??o

- **Status:** corrigido localmente em 2026-11-15; n?o aplicado em produ??o.
- **Gravidade:** P2 (integridade de agenda; pode elevar a P1 se ocorrer em volume).
- **Causa-raiz:** a exclusion constraint existente s? considera `professional_id IS NOT NULL`; checagens da aplica??o antes do INSERT/UPDATE n?o serializam chamadas concorrentes.
- **Corre??o local:** a migration aditiva `20261115030000_prevent_business_only_appointment_overlap.sql` cria uma exclusion constraint por `business_id` para reservas sem profissional. Usa intervalo `[)` para aceitar hor?rios adjacentes e mant?m canceladas/aguardando sinal fora do bloqueio conforme a regra atual. A constraint de reservas com profissional foi preservada.
- **Regress?o:** `tests/db/business-only-appointment-overlap.test.ts` prova com duas conex?es concorrentes que s? uma cria??o e s? uma remarca??o para o mesmo hor?rio s?o aceitas; cobre tamb?m agenda com profissional, hor?rios adjacentes, cancelada e aguardando sinal.
- **Valida??o:** banco descart?vel, todas as migrations e su?te DB (8 arquivos/93 testes aprovados); su?te app (128 arquivos/1.019 testes aprovados, 3 arquivos/8 testes ignorados); `npx tsc --noEmit` passou.
- **Limita??o:** a migration n?o foi aplicada fora do banco descart?vel; n?o se mediu incid?ncia em produ??o.

### BOOK-003 — Erro de leitura de bloqueios/agendamentos pode ser tratado como disponibilidade vazia

- **Status:** corrigido localmente; não foi verificada a versão implantada.
- **Gravidade:** P2.
- **Módulo:** cálculo de disponibilidade e criação de reserva.
- **Esperado:** se falhar leitura de bloqueios ou agendamentos, retornar erro e não criar a reserva.
- **Correção presente:** `computeAvailableSlots` verifica erros de `time_blocks` e `appointments`, e a checagem final de conflito interrompe a reserva se falhar (`src/lib/booking.functions.ts:755-769,939-941`).
- **Impacto:** reserva pode ser exibida/aceita em bloqueio ou horário já ocupado durante falha de leitura; a constraint só protege parte dos casos com profissional e exclui `aguardando_sinal`.
- **Causa-raiz histórica:** erros Supabase eram confundidos com respostas vazias; corrigido por propagação explícita dos erros nas três leituras críticas.
- **Reprodução segura:** teste de unidade com erro de consulta em `time_blocks`/`appointments` e verificação de que `getAvailability` e `reserveBooking` recusam fail-closed; usar mocks, sem DB real.
- **Correção recomendada para spec:** verificar e propagar todo erro das consultas que autorizam reserva; fail-closed.
- **Regressão necessária:** erro em cada consulta; arrays vazios genuínos; rate limit; conflito; bloqueio recorrente e por data.
- **Verificação local — 2026-11-15:** `src/lib/booking.functions.test.ts` passou 117/117; os casos de falha em `time_blocks`, `appointments` e conflito final verificam ausência de reserva/cobrança. Nenhuma leitura/escrita real foi usada; produção não verificada.

## Controles observados

- Regras de negócio são rechecadas no servidor, incluindo expediente, bloqueios, antecedência, profissional, dias do serviço e valor do sinal (`booking.functions.ts:812-843`).
- Horários são convertidos com timezone do negócio; a revisão de DST e bordas de data ainda está pendente.
- Código público de reserva é UUID aleatório e tem índice único em migration (`20260928210100_appointment_public_code.sql`). Cancelamento/remarcação exigem esse código e respeitam prazo/status (`booking.functions.ts:526-619`).
- Rate limit protege leitura e mutações públicas, mas está em memória do processo; ambiente implantado ainda não verificado.

## Pendente

- Concluir revisão de expiração/consulta ao AgPay, cancelamento e remarcação de reservas com sinal.
- Verificar timezone/DST, expediente noturno, intervalo entre serviços e janela mínima.
- Validar banco de ensaio isolado para reprodução concorrente, sem usar dados de produção.

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

### BOOK-005 — falha ao criar cobrança de sinal deixa appointment órfão

- **Status atual:** parcialmente mitigado localmente; fechamento depende de aprovação do desenho transacional. Ocorrência real não medida.
- **Gravidade:** P2; caminho de persistência parcial confirmado por leitura.
- **Esperado:** se a criação da cobrança falhar depois da reserva, o sistema deve compensar a reserva (cancelar/remover com segurança) ou persistir um estado recuperável claramente identificado.
- **Observado agora:** em `reserveBooking`, a reserva `aguardando_sinal` é criada antes da linha `deposit_payments`; se a segunda gravação falha, o código tenta atualizar condicionalmente a reserva para `cancelado`. Se essa compensação falhar, retorna erro explícito de persistência parcial, mas não cria uma pendência durável para retry/revisão (`src/lib/booking.functions.ts:979-1007`). O worker de expiração continua baseado nas linhas de `deposit_payments`, sem reconciliar esse caso.
- **Impacto residual:** normalmente a falha da cobrança cancela a reserva; se também falhar a compensação, resta appointment sem cobrança. A mensagem orienta contato com o estabelecimento, mas não há fila/registro operacional que garanta recuperação.
- **Reprodução segura:** fake DB em que insert de appointment retorna sucesso e insert de `deposit_payments` retorna erro; observar estado persistido fake sem compensação. Não usar banco de produção.
- **Causa-raiz:** dois writes separados e compensação best-effort; a falha dupla não é atomicamente impossível nem registrada em mecanismo durável de recuperação.
- **Correção recomendada para spec:** tornar criação de appointment+cobrança atômica no banco, ou compensar a reserva e registrar o motivo de forma idempotente.
- **Regressão atual:** testes cobrem cancelamento quando o INSERT da cobrança falha e erro explícito quando a atualização compensatória também falha; `booking.functions.test.ts` passou 117/117 nesta sessão. Ainda não provam recuperação durável da falha dupla.
- **Próximo passo:** usuário foi consultado sobre substituir os dois INSERTs por RPC transacional server-only. Sem aprovação do desenho, não alterei código nem migration.

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

### BOOK-008 — policy de INSERT aceita campos de agendamento sem as validações do fluxo de reserva

- **Estado:** INSERT direto como owner foi reproduzido em Postgres efêmero; path de profissional e produção continuam não verificados.
- **Gravidade:** P2 potencial por integridade da agenda e sinal; exige sessão profissional com `create_appointment` ou owner do negócio.
- **Módulo:** agendamentos / RLS / integridade financeira.
- **Esperado:** criação autenticada deve impor as mesmas regras server-side da reserva: business ativo, serviço/profissional pertencentes ao mesmo business e elegíveis, horários coerentes e disponibilidade; estado e campos de sinal não devem representar pagamento confirmado sem cobrança válida.
- **Observado:** migration inicial concede INSERT em `appointments` a authenticated (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:120-123`). Policy posterior `appointments_professional_create` tem `WITH CHECK (has_business_permission(business_id, 'create_appointment'))` sem validar demais campos/FKs (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:109-111`); não encontrei revogação do INSERT em migrations posteriores. O banco usa FKs separadas, sem constraint composta entre appointment.business_id e service/professional (`20260822051036...:103-109`); status é texto sem CHECK local e `deposit_paid_at`/`deposit_cents` são colunas da própria reserva (`20260902060129...:69-70` e migrations seguintes). O fluxo real da reserva usa `reserveBooking` server-side e valida catálogo, serviço, horários, disponibilidade e sinal (`src/lib/booking.functions.ts:620-690,800-917`). Não encontrei função de criação manual de appointment em `src`; a permissão existe na configuração de profissionais. No ensaio efêmero, um owner `authenticated` conseguiu inserir appointment com `status='audit_invalid_status'` e `deposit_paid_at` futuro sintético, confirmando ausência de validação equivalente nesse caminho; a transação foi revertida.
- **Impacto:** profissional autorizado pode potencialmente gravar pela API direta reservas fora do fluxo controlado, relacionar IDs de serviço/profissional de outro negócio ou forjar `status`/`deposit_paid_at` e valores exibidos como sinal pago. A constraint de overlap pode bloquear parte de conflitos com profissional definido, mas não substitui validações do fluxo e exclui `professional_id NULL`; relatórios/UI usam `deposit_paid_at` como indicador de sinal (`src/routes/_authenticated/painel.index.tsx:696-723`; `painel.relatorio.tsx:60,86-87`). Não há evidência de uso malicioso ou linha inconsistente.
- **Reprodução segura realizada parcialmente:** owner fictício inseriu status não previsto e `deposit_paid_at` sintético em banco isolado, depois a transação foi revertida. A reprodução com profissional e vínculos cross-business permanece pendente; nenhum registro real foi gravado.
- **Causa-raiz local:** policy permite a linha com base apenas na permissão do business e não centraliza os invariantes de reserva/sinal no banco. O runtime atual não oferece handler manual conhecido que valide a permissão e os campos.
- **Correção recomendada para spec:** definir se staff pode criar reserva manual; se sim, fazê-lo por Server Function/RPC que valide ownership, disponibilidade e cobrança, e restringir INSERT direto da tabela. Separar estado de sinal financeiro da reserva e derivá-lo de `deposit_payments`/ledger.
- **Regressão:** usuário sem permissão não insere; autorizado só cria horário disponível no business correto; refs cross-business e estados/campos de sinal forjados são rejeitados; reserva com sinal só aparece paga após confirmação ligada ao pagamento; owner e fluxo público legítimos seguem operacionais.
- **Limitação:** reprodução confirma apenas owner e chain local; permissões remotas, path de profissional, relações cross-business e efeito em telas/relatórios permanecem pendentes.

### BOOK-009 - Invalid time zones are rejected before persistence

- State: corrected locally.
- Root cause: `preferencesPatch.timezone` previously accepted any non-empty string while availability/reservation formatters pass the value to `Intl.DateTimeFormat`.
- Correction present in the local tree: `preferencesPatch` now uses the supported `PANEL1_TIMEZONES` enum, and config normalization maps legacy unsupported values to the default timezone.
- Regression: `src/lib/panel1-config.functions.test.ts` verifies invalid timezone rejection and supported timezone acceptance; 9/9 tests pass.
- Limitation: local validation only; deployed configuration was not inspected.

### BOOK-010 — `getOpenDays` ignora falhas na consulta de expediente

- **Estado:** corrigido localmente e revalidado em 2026-11-15; comportamento implantado nao verificado.
- **Gravidade:** P2 potencial (bloqueia a entrada da jornada pública de reserva).
- **Módulo:** agendamentos públicos / calendário de dias.
- **Esperado:** erro ao consultar negócio ou `business_hours` deve ser propagado como falha recuperável; só resposta válida sem expediente deve significar que não há dias disponíveis.
- **Observado antes da correcao:** `getOpenDays` lê `businesses` e `business_hours` usando somente `data`, sem verificar `error` (`src/lib/booking.functions.ts:373-395`). Se a leitura de negócio falhar ou retornar `null`, devolve `days: []`; se a leitura de expediente falhar, `(hours ?? [])` vira conjunto vazio e `computeOpenDays` retorna nenhum dia. A página também usa `openDays?.days ?? []` e exibe “Nenhum dia de atendimento está disponível no momento” (`src/routes/agendar.$slug.tsx:352-355,857-862`).
- **Impacto:** falha transitória de banco/RLS pode bloquear novas reservas e parecer configuração comercial de fechamento. Não houve validação de efeito em produção.
- **Reprodução segura:** fake de PostgREST retorna erro/nulo para leitura de business ou `business_hours`; o handler devolve lista vazia sem erro e a UI renderiza a mensagem de ausência.
- **Causa-raiz confirmada no código:** consultas de negócio/expediente não inspecionam `error`; ausência e falha são tratadas como mesmo resultado.
- **Correção recomendada para spec:** propagar erro de consulta e dar à UI estados separados de loading, erro/retry e calendário legitimamente vazio.
- **Regressão:** erro em qualquer fonte não retorna `days: []` como sucesso; expediente válido vazio mostra calendário fechado; retry bem-sucedido lista os dias calculados.
- **Limitacao:** producao e volume de reservas nao verificados.

- **Revalidacao (2026-11-15):** `getOpenDays` agora propaga erro tanto da consulta de `businesses` quanto de `business_hours`; somente negocio ausente/despublicado ou expediente realmente vazio retorna dias vazios. Teste focal `npx vitest run src/lib/booking.functions.test.ts -t 'getOpenDays: consulta indisponivel'`: 2/2. Nenhum acesso remoto.
### BOOK-011 — conversão de horário local em transições de DST

- **Estado:** corrigido localmente; sem fusos ou reservas reais consultados.
- **Gravidade:** P2 potencial.
- **Correção presente:** `toIso` calcula offsets candidatos para a data pretendida e exige round-trip para o mesmo dia/hora no fuso. Horários inexistentes ou ambíguos são rejeitados com erro claro.
- **Regressão:** `booking.functions.test.ts` cobre hora válida após início do DST, hora inexistente, hora ambígua na saída do DST e filtragem da grade; 117/117 testes do arquivo passaram.
- **Limite:** UI oferece fusos brasileiros sem DST, mas API/config legado pode indicar outros fusos. Configurações reais não foram verificadas.
### BOOK-012 — data impossível é normalizada e pode contornar bloqueio por data

- **Estado:** validação de calendário ausente confirmada no schema e comparação divergente confirmada no código; reserva com bloqueio não foi executada.
- **Gravidade:** P2 potencial (reserva pode ser gravada em dia diferente e durante bloqueio do dia efetivo).
- **Módulo:** agendamentos / validação pública / bloqueio por data.
- **Esperado:** API deve rejeitar datas inexistentes antes de disponibilidade, criação ou remarcação; todos os filtros temporais devem usar uma data canônica validada.
- **Observado:** `slugSchema.date` exige apenas regex `YYYY-MM-DD` (`src/lib/booking.functions.ts:8-13`), que aceita `2026-02-31`. `weekdayInTimezone` e `toIso` constroem `Date` com esse texto; o runtime normaliza o dia inválido. Reproduzi com a mesma lógica de offset para `2026-02-31 10:00 America/Sao_Paulo`: o instante foi `2026-03-03T13:00:00.000Z`, correspondente a 03/03 local. `computeAvailableSlots` usa `weekdayInTimezone` e converte início/fim do dia via `toIso` (`:668-685`), mas compara bloqueio de data por igualdade literal `b.block_date === params.date` (`:694-700`). Assim, um bloqueio de 03/03 não corresponde à entrada `2026-02-31`, enquanto a reserva pode ser gravada em 03/03 por `toIso` (`:845-846`). O mesmo schema é usado para disponibilidade e remarcação.
- **Impacto:** chamada pública direta com data inválida pode reservar/remarcar para outro dia normalizado e não reconhecer `time_block` associado ao dia efetivo. A UI usa datas de `computeOpenDays`, portanto o caminho identificado requer chamada direta ou outro cliente. Nenhuma reserva real foi criada.
- **Reprodução segura realizada:** avaliação local Node da regex e da conversão de data/offset, sem DB ou provider: formato aceito; entrada 31/02 normalizou para 03/03 local; comparação literal com `block_date='2026-03-03'` não coincide. Nenhum teste persistente ou escrita foi feito.
- **Causa-raiz:** validação sintática é confundida com existência de data civil; a data original e o instante normalizado são usados em pontos diferentes.
- **Correção recomendada para spec:** validar calendário gregoriano e round-trip de data antes da lógica de horário; substituir `params.date` pela data canônica validada na checagem de bloqueios, appointments e gravação.
- **Regressão:** 29/02 válido em ano bissexto passa; 29/02 inválido e 31 de mês curto são rejeitados; disponibilidade, reserva e remarcação nunca mudam a data e bloqueios da data efetiva sempre se aplicam.
- **Limitação:** não executei o handler completo com DB sintético; efeito de bloqueio/reserva estático e condicional a existir bloqueio na data normalizada.

**Complemento de UI a BOOK-006/BOOK-007:** `/agendar/$slug` não consome `isError` da query de profissionais e a query de reservas é passada a `EleganceHistoryList` apenas como array opcional. A lista histórica renderiza “Nenhum agendamento por aqui ainda” para array vazio (`src/routes/agendar.$slug.tsx:345-381,571`; `src/components/public-booking/elegance-history.tsx:197-211`). O estado ausente/erro pode ser confundido com nenhum profissional/reserva; BOOK-007 costuma rejeitar a submissão nula quando sua própria leitura funciona, mas erro simultâneo mantém o caminho fail-open já documentado.

## Estorno financeiro e estado da reserva — regra não definida

O processador de refund do AgPay em `src/lib/agpay-events.server.ts:518-530` cria o débito compensatório no ledger, sem alterar o status do pagamento ou do appointment. O cancelamento público, em `src/lib/booking.functions.ts:526-558`, é uma ação separada que muda o appointment para `cancelado`; a tela do histórico oferece cancelar/remarcar quando `appointmentStatus === 'agendado'` (`src/components/public-booking/elegance-history.tsx:534-565`).

A spec 005 FR-009 cobre somente o débito financeiro e a spec 004 cenário de cancelamento cobre a liberação do horário pelo fluxo de cancelamento. Não foi encontrada regra que diga que refund do gateway precisa cancelar a reserva, nem evidência de um fluxo para sincronizar esses estados após refund externo. **Estado: inconclusivo, sem achado adicional**, até confirmar se refund pode ocorrer sem cancelar o atendimento e quem deve executar a transição da reserva. Não houve consulta de dados, refund ou alteração de disponibilidade real.


### Cruzamento com UI-007 — expediente sem intervalo diário válido

O achado [UI-007](frontend.md) também afeta a disponibilidade pública: `business_hours` não impõe relação `ends_at > starts_at`, a tela não valida os dois campos em conjunto e `computeSlots` percorre apenas enquanto o início mais a duração cabe até o fim. Assim, uma configuração `fim <= início` não gera slots para aquele weekday; o cálculo não interpreta esses valores como expediente atravessando a meia-noite. A disponibilidade pública depende das linhas desse dia e pode parecer fechada sem erro explícito. Trata-se do mesmo problema de configuração já registrado em UI-007, sem novo ID.

### BOOK-013 — cancelamento local pode informar sucesso após confirmação concorrente do sinal

- **Estado:** falha estrutural da resposta confirmada no código; sequência concorrente não reproduzida e ocorrência em produção desconhecida.
- **Gravidade:** P2 potencial (divergência entre estado financeiro/reserva e o que o cliente acredita ter cancelado).
- **Módulo:** agendamentos / pagamento de sinal / concorrência de webhook.
- **Esperado:** cancelamento só deve retornar sucesso e ser apresentado como concluído se a transição condicional `pendente → expirado` realmente alterou a cobrança e cancelou a reserva; se a confirmação já venceu a corrida, o cliente deve receber estado pago/confirmado ou um conflito para atualizar.
- **Observado:** `cancelPendingDeposit` adquire claim, relê a cobrança e chama `expireLocalCharge(...)`, mas ignora seu retorno booleano e retorna `{status: "expirado"}` incondicionalmente (`src/lib/agpay-events.server.ts:393-411`). `expireLocalCharge` só altera a cobrança se ainda estiver `status='pendente'` (e, quando informado, com o mesmo claim token); quando nenhuma linha é atualizada, retorna `false` e não chama `markAppointmentCancelled` (`:337-351`). A confirmação do webhook não participa do claim Pix: pode mudar a cobrança de `pendente` para `pago`, creditar e confirmar o appointment em paralelo (`:265-336`). Se essa gravação vencer antes da expiração, o UPDATE de expiração retorna sem linha, mas o cancelador ainda responde sucesso. A Server Function só propaga esse status (`src/lib/booking.functions.ts:1163-1174`), enquanto `PaymentDialog` mostra sempre “Agendamento cancelado” e fecha no `onSuccess`, sem inspecionar o status (`src/components/public-booking/PaymentDialog.tsx:123-129`).
- **Impacto:** sob essa ordem de corrida, o sinal pode estar pago e o appointment confirmado, embora o cliente receba confirmação visual de cancelamento e feche o fluxo; ele pode deixar de comparecer acreditando que a reserva foi cancelada. O código não prova que esse interleaving ocorreu em produção.
- **Reprodução segura:** em harness fake, iniciar cancelamento e pausar após a releitura/claim; executar `confirmDepositPayment` para a mesma cobrança antes de `expireLocalCharge`; liberar o cancelamento e verificar status final `pago`/`agendado` contra resposta `{status:"expirado"}` e mensagem de sucesso na UI. Usar só dados sintéticos, sem gateway ou banco real.
- **Causa-raiz confirmada no código:** o helper de expiração expõe se a atualização condicional ocorreu, mas o chamador descarta o resultado; a interface trata todo retorno sem erro como cancelamento efetivo.
- **Correção recomendada para spec:** tornar a decisão cancelamento/expiração e confirmação mutuamente consistente; retornar status efetivo após o UPDATE, relendo o estado quando zero linhas forem afetadas, e apresentar feedback específico para corrida com pagamento.
- **Regressão necessária:** confirmação vence antes da expiração; expiração vence antes da confirmação; claim ocupado/perdido; pagamento sem provider ID; UI só mostra cancelamento quando appointment efetivamente cancelado e responde como pago/confirmado se a confirmação venceu.
- **Limitação:** nenhum teste dinâmico foi executado nesta rodada; produção, webhook real e concorrência runtime não foram observados.

### UI-007 corrigido localmente (2026-11-14)

O formulário de funcionamento agora rejeita horário inválido e `fim <= início`, mostra o erro junto aos campos e desabilita Salvar. Migration aditiva `20261115010000_business_hours_end_after_start.sql` impõe `CHECK (ends_at > starts_at) NOT VALID` para novas escritas, sem validar ou alterar linhas antigas; intervalo overnight segue fora do modelo diário documentado. Testes unitários: 2/2; DB isolado: 3/3; TypeScript, diff check, `npm test` (115 arquivos, 988 aprovados/8 ignorados) e `npm run test:db` (85/85) passaram. Migration não foi aplicada remotamente. Contagem: 77 corrigidos localmente, 7 bloqueados/não verificados, 67 pendentes de 151.

### BOOK-010 validado corrigido localmente (2026-11-14)

`getOpenDays` agora propaga falhas nas leituras de negócio e expediente, distinguindo indisponibilidade do banco de uma agenda sem dias abertos. Testes injetando erro nas duas fontes: arquivo `booking.functions.test.ts` passou 117/117. TypeScript e regressão completa recentes passaram: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. Nenhuma consulta remota. Contagem: 84 corrigidos/validados localmente, 7 bloqueados/não verificados, 60 pendentes de 151.
### BOOK-012 validado corrigido localmente (2026-11-14)

O schema compartilhado `civilDateSchema` agora exige forma `YYYY-MM-DD` e round-trip real no calendário gregoriano; criação, disponibilidade e remarcação usam essa validação antes das consultas/escritas. Teste `booking.functions.test.ts` inclui datas válidas e impossíveis; arquivo passou 117/117. TypeScript e regressão completa recentes passaram: 120 arquivos aprovados, 3 ignorados; 999 testes aprovados, 8 ignorados. Contagem: 85 corrigidos/validados localmente, 7 bloqueados/não verificados, 59 pendentes de 151.
### BOOK-013 corrigido localmente — 2026-11-15

RED/GREEN: `agpay-events.server.test.ts` pausa o UPDATE de expiração, confirma o pagamento, então libera o cancelamento. Antes da correção, a cobrança terminava `pago` e o agendamento `agendado`, mas a função retornava `expirado`; após a correção, devolve `pago`. A interface de `PaymentDialog` mostra cancelamento concluído somente com estado `expirado` e trata separadamente pagamento confirmado, pagamento sem reserva e cancelamento ainda pendente. Testes focados: 32/32; suíte completa: 121 arquivos, 1001 aprovados/8 ignorados; TypeScript e diff check passaram. Sem banco/gateway remoto. Total: 91 corrigidos localmente, 7 bloqueados/não verificados e 53 pendentes de 151.
### Revalidação de BOOK-001 — 2026-11-15

A lacuna segue presente no código atual: `aguardando_sinal` permanece excluído dos filtros de conflito do booking e da exclusion constraint. O teste DB `business-only-appointment-overlap.test.ts` ainda aceita reservar o intervalo quando já existe uma reserva nesse status (4/4); `booking.functions.test.ts` passou 117/117, sem cobrir hold temporário. `specs/003-migracao-asaas-agpay/quickstart.md` exige preservar `cancelado` após um `deposit.completed` tardio, mas não define ação financeira/refundo para o pagamento tardio. A implementação de hold de 5 minutos exige alinhar a checagem de disponibilidade, proteção transacional e liberação após expiração; não mudei comportamento enquanto esse desenho e a política de pagamento tardio não forem aprovados. Nenhuma reserva ou pagamento foi criado.
### Ciclo 83 — reconciliação BOOK/UI P2 — 2026-11-15

Revalidei e atualizei o índice de BOOK-002/003/005/006/007/010/012/013 e UI-002/007/009/010/016/019/021/028/037 com correções locais documentadas nas fichas. Suíte geral recente: 136 arquivos passaram, 3 ignorados; 1.058 testes passaram, 8 ignorados. DB: 10 arquivos/99 testes. TypeScript e diff check passaram no ciclo. Migrations apenas locais; sem escrita de agenda/Storage em produção, deploy ou publicação. Os itens já estavam no conjunto de corrigidos; tally 115/11/25 inalterado.

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


### BOOK-004 ? cancelamentos bloqueiam o booking publico (revalidado em 2026-11-15)

A guarda `isPublicBookingEnabled` exige `status === "ativo"` e `cancelled_at` ausente. O catalogo publico a aplica; a selecao de servico filtra status ativo e `cancelled_at IS NULL`; `loadContext` impede reserva e geracao de sinal; `getOpenDays` devolve dias vazios para negocio encerrado. `npx vitest run src/lib/booking.functions.test.ts -t "cancelamento|cancelado|cancelled_at|booking disabled|isPublicBookingEnabled"`: 8 testes passaram, 109 ignorados pelo filtro. Nenhum provider, dado real ou producao foi acessado. A observacao original acima esta supersedida por esta revalidacao; migration/deploy e estados existentes em producao nao foram verificados.


### BOOK-008 revalidado - INSERT manual ainda depende de definicao de produto (2026-11-15)

Revisei a policy appointments_professional_create da migration 20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql: o WITH CHECK valida apenas has_business_permission(business_id, create_appointment). A grant INSERT da migration inicial continua presente, e nao localizei handler manual em src; o fluxo publico usa reserveBooking com validacoes server-side. A reproducao previa em Postgres efemero provou que owner authenticated consegue gravar status nao previsto e deposit_paid_at sintetico, com rollback da transacao. O caminho de profissional, referencias cross-business e producao continuam nao verificados.

A correcao depende de decidir se staff pode criar reservas manuais e, se sim, qual fluxo autorizado deve substituir o INSERT direto. Revogar INSERT sem esse alinhamento pode quebrar operacao legitima; manter como esta preserva a lacuna. Mantido bloqueado para decisao de produto/desenho, sem migration ou alteracao de dados. Nenhuma escrita real foi feita.


### Reconciliacao BOOK-001/BOOK-013 - 2026-11-15

BOOK-001 segue como risco local reproduzido: awaiting_sinal nao esta nos filtros de conflito nem na exclusion constraint; tests/db/business-only-appointment-overlap.test.ts passou 5/5, incluindo sobreposicao nesse estado. A correcao exige hold/liberacao de slot e regra de pagamento tardio; nao mudei a migration nem a policy financeira. BOOK-013 segue corrigido: a regressao do agpay-events.server.test.ts foi aprovada dentro do lote backend/booking de 89 testes e confirma a corrida de pagamento/cancelamento sem retorno falso de expiracao. Nenhuma reserva ou cobranca real.


### BOOK-001/BOOK-002 revalidation - 2026-11-15

Current migration 20261115110000_hold_booking_slots_for_deposit.sql now includes guardando_sinal in both professional and business-only exclusion constraints. This supersedes the older note in this report that pending deposits did not block overlaps. 	ests/db/business-only-appointment-overlap.test.ts: 5/5; full DB suite: 13 files/110 tests; src/lib/booking.functions.test.ts: 117/117. BOOK-002 is locally corrected. BOOK-001 is partially mitigated: payment arriving after expiry/cancellation may still result in pago_sem_agendamento, whose financial/refund policy is undefined. No production migration or payment was run.

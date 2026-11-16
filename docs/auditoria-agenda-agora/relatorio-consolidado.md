# Relatório consolidado — auditoria Agenda Agora

**Estado: PARCIAL — a auditoria não está concluída.** Este documento consolida a evidência local e os registros de inspeção somente leitura de produção disponíveis até o ciclo 169; o inventário contém 151 IDs únicos. Não atesta a configuração/saúde atual de todos os serviços e não afirma ausência de outros problemas.

## Adendo de fechamento atualizado — 2026-11-15

O inventário reconciliado contém 151 IDs: **123 corrigidos/mitigados ou resolvidos localmente/no runtime observado; 28 bloqueados ou não verificados; 0 sem triagem**. O tally 122/29 anterior foi atualizado após a resolução local de PAY-015.

O cron Swarm agora usa a mesma secret do app; após a alteração, as chamadas verificadas retornaram 2xx, sem reiniciar o app. O worker consultou a AgPay e expirou seis depósitos vencidos (nenhum estava pago); dois eventos antigos sem referência local foram encerrados para revisão manual. A configuração futura no painel de deploy não foi conferida.

A história de migrations foi consultada em modo read-only: 62 versões remotas, 100 arquivos locais, 0 remotas sem arquivo após recuperar nove SQLs da tabela de histórico. Permanecem 38 arquivos locais sem versão remota: 18 históricos/renumerados e 20 migrations locais novas, ainda não commitadas. Nenhuma migration foi aplicada.

O Evolution respondeu HTTP 200: duas instâncias estão `close`; das duas credenciais privadas no Supabase, uma corresponde a uma instância existente e outra não. A reconexão depende de QR no WhatsApp do negócio. Consulta SQL read-only confirmou policies/grants amplos em `customers` e `businesses`; a correção de SEC-009/010 ainda requer alterar código e migrations, portanto não foi aplicada.

O painel master AgPay expirado (PAY-006) foi excluído por instrução do usuário. A documentação oficial ainda não define idempotência, recuperação de QR por consulta, refund/chargeback nem eventos de falha de saque. Decisões comerciais/contábeis sem regra escrita seguem sem alteração. Não houve schema remoto, deploy do app, cobrança, commit ou push.
## Escopo e base examinada

- Repositório principal: `C:\Users\Felps\code\agenda-agora`, branch `main`, referência local registrada no checkpoint. Árvores de trabalho diferentes foram identificadas e não tiveram suas evidências misturadas.
- Evidência: source, migrations, specs locais 001–010, relatórios internos e documentação pública dos providers quando citada. Findings descrevem exatamente o alcance indicado em cada módulo; “confirmado” pode significar comportamento confirmado no código/chain local, sem provar que a mesma versão está aplicada em produção.
- Inventário em `problemas.md`: **151 IDs únicos**. O conjunto inclui defeitos de código confirmados, falhas operacionais observadas, riscos condicionais, divergências de spec e lacunas de cobertura/produção. Gravidade e classificação detalhadas estão no índice e em `riscos.md`.
- As correções desta rodada foram locais e documentadas nos registros posteriores; não houve operações financeiras, envios externos, deploy, commit ou escrita em produção.

## Diagnóstico executivo

1. **Gateway local:** o adaptador de pagamento presente é AgPay; as referências a RGPay e Asaas aparecem em histórico/specs, não como adapters financeiros de runtime encontrados na revisão. A criação Pix local não envia split por cobrança; comissão é calculada no ledger local. As regras configuradas no dashboard AgPay e o projeto de produção não foram verificados.
2. **Relato de quatro negócios:** consulta somente de leitura ao projeto correto via credencial local confirmou 4/4 negócios ativos com `agpay_split_status=pendente`, email de split nulo e comissão percentual 0%. Os 10 registros de depósito vinculados estão 6 `pendente` e 4 `expirado`, sem depósitos pagos ou lançamentos de ledger. O split é legado e não é enviado no fluxo de cobrança da spec 004; email de divisão não é requisito nesse modelo. Assim, o relato dos campos está confirmado, mas a interpretação de falha de repasse está incorreta para o fluxo atual. Dashboard AgPay segue sem consulta e a divergência de comissão fixa da spec 005 continua separada em PAY-015.
3. **Riscos financeiros:** existem caminhos locais que permitem operação de saque sem validação server-side do PIN e cashout sem revalidar aprovação vigente da chave; webhook/polling não comparam montante recebido com snapshot local antes da confirmação; falhas e concorrência podem produzir desacordo entre gateway, ledger, saldo e estado de reserva. Os detalhes, condições e limitações estão em `pagamentos.md`.
4. **Agendamentos:** o hold de reserva aguardando sinal não ocupa a vaga atomicamente; há exposição a conflito/pagamento sem reserva, falhas de leitura que podem falhar aberto, e concorrência de cancelamento/confirmacão com mensagem divergente ao cliente. A disponibilidade também depende de timezone, validade de data, expediente e regras de profissional, com riscos descritos em `agendamentos.md`.
5. **Segurança e isolamento:** migrations locais habilitam RLS nas 40 tabelas `public` encontradas; isso não garante escopo correto de cada policy. Foram identificadas policies locais com leituras mais amplas do que os fluxos aparentam exigir (ex.: dados de cliente, campos sensíveis de `businesses`, `time_blocks`, assets de Storage) e controles de autorização que dependem de runtime/configuração externa.
6. **Integrações:** os adaptadores UazAPI/Evolution, webhook de mensagem, filas e jobs foram lidos estaticamente. Registro de inspeção por SSH/Evolution de 13/11 confirma que o runtime usava Evolution e que duas instâncias estavam desconectadas; uma estava sem webhook. A mesma inspeção registra 72/72 crons horários de lembretes e 4.319 chamadas AgPay respondendo 401 por divergência de `AGENDA_CRON_SECRET` (DEP-007). O parser descarta `@lid` mesmo com `remoteJidAlt`, e havia tais eventos nos logs; não se correlacionou nenhuma falha a mensagem individual. Versão, associação instância-business e estado após a inspeção seguem desconhecidos.
7. **Cobertura de produto:** 29 rotas e 97 componentes foram mapeados; continuam faltando exercício integral das jornadas, acessibilidade, teste isolado de várias hipóteses e revisão completa de todos os handlers.

## Itens P1 para priorização da futura especificação

A classificação abaixo separa achados de código de riscos condicionais e lacunas de evidência. Não é uma afirmação de que todos estejam ocorrendo em produção.

### Caminhos locais confirmados ou divergências de implementação

- **PAY-009 / PAY-011:** validação do PIN de saque e aprovação de recebedor não são impostas no caminho server-side que envia o cashout; ver `pagamentos.md`.
- **BOOK-001:** reserva aguardando sinal não segura a vaga durante a cobrança; confirmação tardia/conflito pode gerar crédito sem booking confirmado; ver `agendamentos.md`.
- **PAY-014:** comparação do montante do evento/status remoto com o valor local não foi encontrada antes de confirmar crédito/assinatura; ocorrência financeira divergente não foi comprovada.
- **DEP-007:** crons AgPay e lembretes foram rejeitados por divergência de segredo em observação de produção; o bloqueio do worker é confirmado, a dimensão da fila e efeito em pagamentos/notificações individuais não foi consultada.

### Riscos P1 condicionais

- **PAY-006:** split global eventualmente configurado na conta AgPay pode divergir do modelo local de recebimento integral.
- **PAY-017:** cobranças Pix de assinatura podem ser duplicadas para o mesmo ciclo.
- **PAY-027:** condição `trial_days` pode isentar de ciclo de cancelamento negócios que já pagaram.
- **BOOK-004:** estados/timestamps de cancelamento de business não bloqueiam uniformemente o booking público.
- **PAY-032 / PAY-036:** falha após operação de cashout ou resposta AgPay ambígua pode perder referência ou liberar saldo indevidamente.
- **SEC-006 / SEC-009 / SEC-010 / SEC-016 / DEP-001:** MFA/AAL2, exposição por RLS, INSERT direto de business e risco de dependência/build exigem confirmar estado aplicado, exposição e configuração antes de estimar impacto real.

### Lacunas P1 de cobertura/produção

- **PAY-004 / DB-002 / INT-007 / SEC-002:** um GET REST previamente retornou HTTP 200 apenas para o catálogo de metadados (62 endpoints), sem leitura de linhas, migrations ou policies; o conector atual lista somente um projeto de peptídeos e nega acesso ao ref qagotnmdqjoodoudcikd. Dashboard AgPay, fila após os 401, políticas/RLS efetivas, versão de schema e associação das instâncias Evolution a negócios ainda não foram consultados. O estado dos quatro negócios no banco foi confirmado; estado atual posterior das instâncias também não foi conferido.

## Cobertura por módulo

| Módulo | Estado atual | Artefato detalhado | Lacunas principais |
|---|---|---|---|
| Reconhecimento e arquitetura | Parcial | [arquitetura.md](arquitetura.md) | runtime/topologia e dependências de produção não confirmados |
| Conformidade com especificações | Parcial | [conformidade-spec.md](conformidade-spec.md) | specs locais ignoradas pelo Git; contrato comercial vigente e release ativo precisam confirmação |
| Pagamentos, split e ledger | Parcial, prioridade máxima | [pagamentos.md](pagamentos.md) | quatro cadastros e 10 depósitos consultados; dashboard AgPay, fila após 401, conciliação externa e montantes remotos indisponíveis |
| Backend e APIs | Parcial | [backend.md](backend.md) | censo amplo existente, mas revisão por handler e cross-tenant não completa |
| Banco de dados e RLS | Parcial | [banco-de-dados.md](banco-de-dados.md) | migrations locais analisadas; schema, grants e policies remotas desconhecidos |
| Agendamentos | Parcial | [agendamentos.md](agendamentos.md) | concorrência e temporalidade precisam reproduções isoladas; timezone/estado real não verificados |
| Frontend e jornadas | Parcial | [frontend.md](frontend.md) | fluxos não exercitados integralmente em browser; acessibilidade incompleta |
| Segurança | Parcial | [seguranca.md](seguranca.md) | Auth/MFA, policies aplicadas, secrets, logs e ativos remotos sem verificação |
| Infraestrutura | Parcial | [infraestrutura.md](infraestrutura.md) | deploy e crons foram observados pontualmente em 13/11; proxy/CDN, backups/restauração, firewall, fila e estado atual ainda desconhecidos |
| Integrações | Parcial | [integracoes.md](integracoes.md) | Evolution e instâncias foram observadas em 13/11; versão, mapeamento das instâncias, fila/entrega por business e saúde posterior indisponíveis |
| Consolidação de achados e riscos | Em andamento | [problemas.md](problemas.md) · [riscos.md](riscos.md) | IDs requerem revisão de severidade/duplicidade ao fechar cobertura |

## Limitações que impedem conclusão

- O conector MCP não lista o projeto, mas a URL/ID/chave `service_role` do `.env` correspondem ao projeto correto e GET via REST funcionou em 14/11. Foram consultadas somente as colunas de split/comissão/status em `businesses`, depósitos dos quatro IDs e tipos/quantidade de `ledger_entries`; não foram consultados logs de fila, credenciais, linha por linha com PII, policies efetivas, migrations remotas nem dados de outros negócios. O efeito financeiro dos 401 e o dashboard AgPay continuam sem verificação.
- O registro de produção de 13/11/2026 foi incorporado com sua origem e limites; permanece como snapshot dessa inspeção, não como estado atual contínuo.
- A conta/dashboard AgPay não foi consultada; configuração detalhada do webhook Evolution, associação das instâncias a negócios e o estado posterior a 13/11 permanecem desconhecidos. Documentação pública pode não refletir as versões contratadas/implantadas.
- Reproduções de corrida, integração e jornada que constam como propostas ainda não foram executadas. Processos/testes Node não foram iniciados nos ciclos recentes.
- O diagnóstico é estático e baseado na árvore principal; não é certificação operacional nem afirma que o SaaS está livre de outros problemas.

## Próximos passos para concluir a auditoria

1. Consultar, por leitura somente, a fila AgPay após os 401 e o dashboard AgPay; confirmar a regra comercial vigente da taxa fixa PAY-015. Os quatro registros já foram revalidados. Qualquer retomada do worker exige tratamento idempotente da fila acumulada.
2. Executar reproduções não destrutivas em ambiente descartável para BOOK-013, BOOK-001/002, PAY-014/032/036 e controles RLS/Storage prioritários, sem conectar gateways reais.
3. Completar revisão handler por handler, jornadas frontend, jobs, expiração/concorrência e cobertura das especificações.
4. Revisar todos os achados por duplicidade, nível de evidência e gravidade; reconciliar `problemas.md` e `riscos.md`.
5. Atualizar este consolidado com cobertura fechada, evidências reproduzidas, limitações remanescentes e próximos passos para escrever a spec de correção.

## Navegação

- [Checkpoint](checkpoint.md)
- [Índice de achados](problemas.md)
- [Riscos priorizados](riscos.md)
- [Especificações e conformidade](conformidade-spec.md)

# MISSÃO: AUDITORIA FORENSE INTEGRAL — AGENDA AGORA

Você deverá atuar como uma equipe de especialistas sêniores em arquitetura, backend, frontend, banco de dados, segurança, pagamentos, integrações, infraestrutura e QA.

Seu objetivo será realizar uma auditoria exaustiva do SaaS Agenda Agora, descobrindo problemas reais, funcionalidades incompletas, inconsistências, vulnerabilidades, divergências da especificação e riscos de produção.

Não implemente correções durante essa auditoria.

## 1. RECONHECIMENTO

Mapeie toda a arquitetura, módulos, serviços, bancos, integrações, endpoints, componentes, jornadas e regras de negócio.

Localize todas as especificações disponíveis e compare os requisitos com a implementação real.

Existem múltiplas cópias ou árvores de trabalho do projeto. Identifique o repositório ativo, diferencie as cópias, preserve alterações locais e não misture evidências de versões diferentes.

## 2. PAGAMENTOS — PRIORIDADE MÁXIMA

Investigue todas as integrações financeiras existentes.

Há referências históricas ou atuais a RGPay, AgPay e Asaas. Não presuma que representam o mesmo serviço nem que todos estejam ativos.

Determine qual gateway é efetivamente utilizado, quais integrações são legadas, qual documentação é aplicável e se existe divergência entre especificação, implementação e configuração.

Audite:

- Split de pagamentos e contas recebedoras.
- Vinculação financeira de cada estabelecimento.
- Comissões, taxas e repasses.
- Criação e confirmação de cobranças.
- Webhooks, assinaturas e idempotência.
- Duplicidade de eventos e transações.
- Cancelamentos, estornos e conciliação.
- Reservas confirmadas sem pagamento válido.
- Pagamentos sem reserva confirmada.
- Valores destinados a estabelecimentos incorretos.
- Falhas, timeouts, retentativas e recuperação.

Investigue especialmente o relato de quatro negócios com split pendente e comissão de 0%. Determine se isso representa falha real, configuração ausente, onboarding incompleto ou interpretação incorreta.

Nunca execute operações financeiras reais.

## 3. BACKEND E BANCO DE DADOS

Audite integralmente APIs, autenticação, autorização, isolamento entre estabelecimentos, regras de negócio, consultas, integridade dos dados, transações, concorrência, validações, tratamento de erros, jobs, serviços e dependências.

Investigue falhas silenciosas, código incompleto, duplicações, funcionalidades descontinuadas e inconsistências entre camadas.

## 4. FRONTEND

Audite todas as páginas, componentes e jornadas identificadas.

Verifique botões, formulários, navegação, responsividade, estados de carregamento, erros, validações, atualização de dados, permissões, mensagens, experiência do usuário e integração com o backend.

Não considere uma funcionalidade operacional apenas porque sua interface renderiza.

## 5. AGENDAMENTOS

Investigue o ciclo completo de reservas, disponibilidade, conflitos de horários, agendamentos simultâneos, cancelamentos, remarcações, pagamentos de sinais, confirmação de reservas e notificações.

Verifique também fuso horário, expiração de cobranças e consistência dos estados.

## 6. SEGURANÇA E INFRAESTRUTURA

Audite permissões, isolamento de dados, proteção de credenciais, exposição de informações, dependências, banco de dados, configurações, logs, backups, migrações, implantação e riscos operacionais.

Não execute testes intrusivos ou destrutivos em produção.

## 7. INTEGRAÇÕES EXTERNAS

Investigue WhatsApp e quaisquer outras integrações descobertas.

Valide configurações, contratos, autenticação, entrega de eventos, tratamento de falhas e compatibilidade com a documentação.

Não envie mensagens reais.

## 8. INVESTIGAÇÃO EM CICLOS

Execute ciclos sucessivos de:

1. Descoberta e mapeamento.
2. Inspeção técnica.
3. Formulação de hipóteses.
4. Validação com evidências.
5. Testes seguros e não destrutivos.
6. Investigação de consequências em outros módulos.
7. Documentação.
8. Revisão da cobertura e identificação de lacunas.

Continue aprofundando áreas ainda não verificadas, evitando repetir análises sem novas evidências.

Use checkpoints persistentes para permitir continuidade entre execuções.

## 9. EVIDÊNCIAS OBRIGATÓRIAS

Para cada achado, registre:

- Identificador único.
- Módulo afetado.
- Descrição.
- Gravidade P0 a P4.
- Comportamento esperado e observado.
- Arquivos, linhas e evidências.
- Reprodução segura.
- Impacto.
- Causa-raiz confirmada ou hipótese.
- Correção recomendada.
- Testes de regressão necessários.

Diferencie rigorosamente falhas confirmadas, riscos suspeitos e verificações inconclusivas.

## 10. DOCUMENTAÇÃO

Registre os resultados em `docs/auditoria-agenda-agora/`.

Produza documentação específica para arquitetura, conformidade com a spec, pagamentos, backend, frontend, agendamentos, banco de dados, segurança, integrações, riscos e problemas consolidados.

Mantenha um checkpoint com módulos concluídos, módulos pendentes, testes realizados, limitações e próximos passos.

Priorize problemas financeiros, de segurança, integridade de dados e funcionalidades essenciais.

## 11. RESTRIÇÕES

Durante a auditoria:

- Não corrija código.
- Não modifique dados reais.
- Não execute migrações.
- Não faça deploy, push, merge ou commit.
- Não realize cobranças ou repasses reais.
- Não envie mensagens externas.
- Preserve todas as alterações locais.
- Não exponha credenciais.
- Use ambiente isolado para testes que alterem estado.
- Não invente defeitos nem declare conformidade sem evidências.

A única escrita autorizada é a documentação da própria auditoria.

## 12. CRITÉRIOS DE CONCLUSÃO

A auditoria deverá produzir um diagnóstico consolidado de todos os módulos identificados, com cobertura explícita, achados comprovados, riscos, limitações e prioridades.

Não encerre prematuramente após localizar alguns bugs.

Não afirme que o SaaS está 100% livre de problemas.

O objetivo final é fornecer evidências suficientes para elaborar uma especificação técnica abrangente de correção do Agenda Agora.

# Research — 002 Correção de regressões + rede de QA

Nenhum `NEEDS CLARIFICATION` pendente (resolvidos em `/speckit-clarify`). Este documento registra as decisões técnicas por área, com base na investigação já feita no código.

## R1 — Persistência de dispensa dos avisos (US1)

- **Decision**: Generalizar o padrão já usado pelo aviso de broadcast (`notifications-store.ts` + `broadcast.ts`) para um store único de dispensa de avisos (`avisos-store.ts`), chaveado por `tipo + estágio + dia (YYYY-MM-DD)`, persistido em `localStorage`. O `AvisoCobranca` passa a consultar/gravar nesse store em vez de usar apenas estado local `fechado`.
- **Rationale**: O broadcast já resolve exatamente esse problema de forma testada; reusar o mesmo mecanismo garante comportamento consistente entre TODOS os avisos (requisito central da feature). Chave por dia implementa "reaparece 1x/dia" (Clarifications Q5) sem spam no mesmo dia.
- **Alternatives considered**:
  - Persistir no servidor/Supabase por usuário — rejeitado: o broadcast já é por-dispositivo (localStorage) e o cliente aceitou esse modelo; servidor adicionaria latência e complexidade sem ganho claro.
  - Apenas mover `fechado` para um contexto React que sobrevive à navegação — rejeitado: não resolve o F5 (reload), que é o gatilho real confirmado.

## R2 — Impersonação "Abrir Painel 2" funcional em produção (US2)

- **Decision**: (a) Garantir `ALLOWED_APP_ORIGINS` correto via healthcheck de boot (ver R6); (b) alinhar os PINs de ambiente da VPS para `41410070` (Q2), mantendo-os env-only em `env-security.server.ts`; (c) reduzir a lentidão da entrada no Painel 2 investigando o estado `loading` de `AuthenticatedContent` após `setSession`+`window.location.href="/painel"` — priorizar carregar a sessão/negócio sem a tela preta prolongada (ex.: evitar refetch desnecessário no boot da rota, aproveitar sessão recém-setada).
- **Rationale**: O fluxo já funciona (confirmado em dev com origin liberado e PIN correto: entra no Painel 2, FAB aparece, retorno com PIN volta). As falhas são de configuração (origin/PIN) e de performance de carregamento, não de lógica.
- **Alternatives considered**:
  - Reescrever a impersonação — rejeitado: o backend (auditoria, sessão, tokens) está correto e testado (`lifecycle.impersonation.test.ts`).
  - Tornar PIN editável por UI — rejeitado em Q3/Q2 (mantém env-only).

## R3 — Navegação sem "recarrega tudo" (US3)

- **Decision**: Aplicar `staleTime` adequado às queries de rota/loaders que hoje refazem busca a cada navegação, e revisar o uso do `RoutePendingSkeleton`/`resolvedPathname` para só exibir carregamento quando há busca realmente pendente (não quando os dados estão em cache). Medir com a suíte (sem skeleton ao navegar entre telas já visitadas).
- **Rationale**: A navegação já é SPA (sem reload — confirmado). A sensação de "recarrega tudo" vem de refetch com `staleTime` curto + skeleton de rota. `staleTime` é o ajuste mínimo e seguro no React Query.
- **Alternatives considered**:
  - Remover o skeleton por completo — rejeitado: ele é útil na 1ª carga real; a correção é não exibi-lo quando há cache fresco.
  - Prefetch agressivo de todas as rotas — rejeitado: aumenta carga no banco sem necessidade.

## R4 — Edição inline na ficha + senha com auditoria (US4)

- **Decision**: Adicionar controles de edição inline (lápis) no `BusinessDossier` para telefone de login, nome do estabelecimento e nome do responsável (estendendo o fluxo `updateBusinessCommercial`/`Salvar dados comerciais` já existente). Para **senha**, criar/estender uma server function que define a senha digitada via Supabase Admin (`auth.admin.updateUserById`), com **validação de força mínima** e **registro de auditoria** em `master_business_events` (ou tabela de auditoria equivalente já usada pela impersonação).
- **Rationale**: Reusa a ficha e os eventos de auditoria já existentes; senha digitada foi a decisão (Q3). Força mínima + auditoria mitigam o risco de senha fraca e dão rastreabilidade (quem/quando).
- **Alternatives considered**:
  - Gerar senha temporária (reuso do "Redefinir senha") — rejeitado em Q3.
  - Edição direta no cliente sem server function — rejeitado: alterar auth/dados exige privilégio admin no servidor.

## R5 — Ajustes de UI (US5)

- **Decision**: Mover o botão de pagar assinatura para dentro do card/pop-up em `painel.tsx` (seção de assinatura/`PagamentosView`); adicionar `<h1>` em `painel.servicos.tsx`; corrigir o array sem `key` que dispara o warning em `painel.funcionamento.tsx`.
- **Rationale**: Ajustes pontuais e de baixo risco; o warning de key e o `<h1>` são correções triviais já localizadas.
- **Alternatives considered**: N/A (mudanças mínimas).

## R6 — Healthcheck de configuração de produção (US6/FR-015)

- **Decision**: Adicionar uma verificação de boot (server) que valida as envs obrigatórias usando os helpers de `env-security.server.ts` (`getAllowedAppOrigins`, `getMasterSecurityPin`, `getMasterReturnPin`, `getPublicAppUrl`) e confirma que `ALLOWED_APP_ORIGINS` contém a origem efetiva de acesso (`PUBLIC_APP_URL`). Falhar o boot (ou logar erro fatal visível) quando faltar/incoerente.
- **Rationale**: Os bugs de produção (origin/PIN) são silenciosos hoje; uma checagem no boot transforma erro de config em falha visível no deploy, não em bug para o cliente achar.
- **Alternatives considered**:
  - Checar só em runtime no primeiro uso — rejeitado: tarde demais (o cliente já encontrou).
  - Script externo de deploy — rejeitado: acopla ao pipeline da VPS; checagem no próprio boot é portável.

## R7 — Suíte de QA consolidada + seed (US6/FR-012..014)

- **Decision**: Consolidar os scripts `qa-*.mjs` numa suíte Playwright única (`scripts/qa/`, exposta por `npm run qa`) com asserts (não só logs): login dono+master, varredura de rotas (dono/master/públicas) checando console errors, imagens quebradas e textos inválidos; reprodução dos fluxos corrigidos (persistência de aviso, impersonação, agendamento público). Seed idempotente de um negócio de teste dedicado (ex.: "Teste sdr") com serviços+fotos, agendamentos e estágios de cobrança — usando dados reais/produção, restrito a negócios de teste (Q1), nunca mutando dados do cliente.
- **Rationale**: Os scripts já existem e provaram valor nesta investigação; falta transformá-los em asserts que falham no CI/pré-deploy. Seed idempotente evita duplicar dados a cada execução.
- **Alternatives considered**:
  - Ambiente de banco isolado para o seed — rejeitado em Q1 (pode usar dados reais; escrita restrita a negócios de teste).
  - Só testes unitários (Vitest) — rejeitado: a classe de bug do cliente é de integração/UI, que só E2E pega.

## R8 — Monitoramento de erro em produção (US6/FR-016)

- **Decision**: Criar uma tabela Supabase (`client_error_log`) e um coletor client-side (error boundary + handler de `window.onerror`/`unhandledrejection` + interceptação de respostas de fetch com erro) que grava os eventos, e um painel simples no Painel 3 (master) para consulta. Dados ficam na infra Supabase existente (Q4).
- **Rationale**: Sem fornecedor novo nem custo; suficiente para capturar bugs que só vivem em produção (ex.: a foto, fora de escopo de correção até haver evidência). Reusa RLS/Supabase já em uso.
- **Alternatives considered**:
  - Sentry/serviço externo — rejeitado em Q4 (fornecedor/custo/dados fora).
  - Só alerta no WhatsApp — rejeitado: sem histórico consultável para diagnóstico.

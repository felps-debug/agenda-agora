# Implementation Plan: Correção de regressões do cliente + rede de QA

**Branch**: `002-correcao-regressoes-qa` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-correcao-regressoes-qa/spec.md`

## Summary

Corrigir um conjunto de regressões reportadas pelo cliente (avisos que reaparecem, impersonação Painel 3→2 quebrada em produção, lentidão/"recarrega tudo" na navegação, edição de dados na ficha, ajustes de UI) e montar uma rede de QA (suíte automatizada Playwright + seed de dados de teste + healthcheck de config no boot + monitoramento de erro em produção no Supabase) para evitar que o cliente continue encontrando bugs. A abordagem reusa padrões já existentes no código (ex.: persistência de dispensa do aviso de broadcast em `localStorage`, fluxos de impersonação já implementados em `lifecycle.functions.ts`, validação de PIN env-only) e estende-os de forma consistente para a classe inteira de cada problema.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19.2

**Primary Dependencies**: TanStack Start 1.168 (SSR) + TanStack Router 1.170 + TanStack React Query 5.101; Radix UI + Tailwind CSS v4; Supabase JS 2.112; Vite 8 (Rolldown) + Nitro (server output)

**Storage**: Supabase (PostgreSQL + Storage privado `business-logos` + Auth). Projeto único `qagotnmdqjoodoudcikd` também usado em dev (sem ambiente isolado — ver Clarifications Q1)

**Testing**: Vitest (unit, 732 testes existentes passando) + Playwright (E2E/QA; Chromium instalado). Scripts exploratórios já criados em `scripts/qa-*.mjs`

**Target Platform**: Web app SSR servida por Node (`.output/server/index.mjs`) em VPS EasyPanel (host único em produção — `VITE_SPLIT_PANELS=false`)

**Project Type**: Web application (full-stack single project — TanStack Start com rotas de UI + server functions)

**Performance Goals**: Navegação entre telas já visitadas sem skeleton nem refetch completo (SC-003); entrada no Painel 2 em modo suporte em ≤3s (SC-004)

**Constraints**: Operações de escrita da suíte de QA restritas a negócios de teste dedicados; nunca alterar/apagar dados reais do cliente (Clarifications Q1). PINs permanecem env-only (Q2). Edição de senha exige força mínima + auditoria (Q3)

**Scale/Scope**: ~28 rotas autenticadas (dono + master) + rotas públicas; base de usuários pequena/média (SaaS de agendamento por estabelecimento). Escopo da feature: ~6 user stories, sem novos serviços externos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

O arquivo `.specify/memory/constitution.md` está como template não preenchido (placeholders), portanto **não há princípios/governança formais definidos**. Na ausência de gates explícitos, aplicam-se as práticas gerais já observadas no repositório:

- **Reuso antes de reinvenção**: estender padrões existentes (persistência do broadcast, fluxos de impersonação, `env-security.server.ts`) em vez de criar mecanismos novos. ✅
- **Testabilidade**: cada correção tem critério de aceite verificável e deve ser coberta pela suíte de QA/Vitest. ✅
- **Superfície mínima**: sem novos fornecedores externos (monitoramento fica no Supabase — Q4). ✅
- **Segurança**: PINs env-only; edição de senha com validação + auditoria. ✅

**Resultado do gate: PASS** (sem violações a justificar).

## Project Structure

### Documentation (this feature)

```text
specs/002-correcao-regressoes-qa/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas por user story
├── data-model.md        # Fase 1 — entidades/tabelas novas e alteradas
├── quickstart.md        # Fase 1 — como validar (suíte de QA)
├── contracts/           # Fase 1 — contratos das server functions novas/alteradas
│   └── server-functions.md
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Projeto único TanStack Start (UI + server functions no mesmo pacote). Arquivos-alvo por área:

```text
src/
├── components/
│   ├── painel/
│   │   ├── AvisoCobranca.tsx          # US1: passar a persistir dispensa
│   │   ├── AvisoPop.tsx               # US1: base compartilhada dos avisos
│   │   └── ...
│   └── master/
│       └── BusinessDossier.tsx        # US4: lápis de edição inline + US2 "Abrir Painel 2"
├── lib/
│   ├── notifications-store.ts         # US1: padrão de persistência a generalizar
│   ├── broadcast.ts                   # US1: regra pura shouldShowPopup (referência)
│   ├── avisos-store.ts                # US1 (novo): store genérico de dispensa por tipo/estágio/dia
│   ├── billing-cycle.ts              # US1: estágios de cobrança (fonte do aviso)
│   ├── lifecycle.functions.ts         # US2: impersonação (origin + PIN + perf)
│   ├── env-security.server.ts         # US2/US6: PINs + healthcheck de config
│   ├── master/dossier.functions.ts    # US4: updateBusinessContact (estende updateBusinessCommercial)
│   ├── reset-password.functions.ts    # US4: setOwnerPassword (senha digitada + força + auditoria)
│   └── error-log.functions.ts         # US6 (novo): registrar erro de produção no Supabase
├── routes/
│   └── _authenticated/
│       ├── painel.tsx                 # US1/US3: avisos, skeleton, botão assinatura (US5)
│       ├── painel.funcionamento.tsx   # US5: corrigir key do React
│       └── painel.servicos.tsx        # US5: adicionar <h1>
scripts/
└── qa/                                # US6: suíte consolidada (npm run qa) + seed
supabase/
└── migrations/                        # US4 (auditoria), US6 (tabela de error log)
tests/                                 # Vitest (unit) existente
```

**Structure Decision**: Mantém a estrutura atual do projeto (single TanStack Start). Nenhuma reorganização; as mudanças são cirúrgicas nos arquivos listados, mais um novo módulo de store de avisos (`avisos-store.ts`), um módulo de error-log, a suíte de QA consolidada em `scripts/qa/`, e migrações Supabase para auditoria e tabela de erros.

## Complexity Tracking

> Sem violações de constituição a justificar (constitution é template vazio; gate PASS). Seção não aplicável.

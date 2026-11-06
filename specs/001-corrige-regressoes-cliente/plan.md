# Implementation Plan: Reconciliação do frontend do cliente com o backend + correção de regressões

**Branch**: `001-corrige-regressoes-cliente` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-corrige-regressoes-cliente/spec.md`

## Summary

Casar o frontend entregue pelo cliente (visual "Ag Pay", telas redesenhadas) com o backend da versão de referência (`felps-debug/agenda-agora`), deixando todas as telas funcionais e corrigindo as regressões. Abordagem: trabalhar sobre a base de referência (backend completo + 548 assets), portar as mudanças de frontend do cliente, e fechar os gaps com correções pontuais de backend (autorização ampla para alterar o backend onde faltar/estiver errado). Entregas acompanhadas de testes automatizados.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19, Node 24
**Primary Dependencies**: TanStack Start/Router/Query, Supabase JS, Zod, Tailwind 4 + Radix, Vite 8 + Nitro
**Storage**: Supabase (PostgreSQL + RLS, Auth, Storage buckets, Cron); armazenamento local do navegador (localStorage) para cache de contexto
**Testing**: Vitest (unit + `vitest.db.config` para testes de banco), Playwright (e2e)
**Target Platform**: Web (SSR via TanStack Start/Nitro), deploy Vercel; painel desktop + mobile
**Project Type**: Web app full-stack (single project, server functions co-localizadas em `src/lib/*.functions.ts` / `*.server.ts`)
**Performance Goals**: Troca de tela no painel sem recarregar o estabelecimento (navegação SPA instantânea após 1º load)
**Constraints**: Manter versões TanStack fixadas (README); segredos só em `.env.local`/ambiente; RLS respeitado no cliente, service role só no servidor
**Scale/Scope**: ~296 arquivos TS/TSX, 8 user stories, ~15 telas de painel + master + agendamento público

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

A constituição do projeto (`.specify/memory/constitution.md`) está **não ratificada** (ainda é o template). Na ausência de princípios formais, aplicam-se os padrões de-facto do repositório como gates:

- **Testes (não-negociável aqui por pedido do usuário)**: toda entrega acompanha teste automatizado (Vitest unit/integration; Playwright quando for fluxo de tela). — *GATE*
- **Separação server/client**: lógica sensível em `*.server.ts`/server functions; nada de service role no cliente. — *GATE*
- **Compatibilidade TanStack**: não atualizar/trocar versões fixadas. — *GATE*
- **Validação de entrada**: toda server function valida entrada com Zod. — *GATE*
- **Sem regressão**: mudanças não quebram funcionalidades que já operam (FR-012). — *GATE*

Nenhuma violação prevista. Complexidade adicional (US7) justificada abaixo.

## Project Structure

### Documentation (this feature)

```text
specs/001-corrige-regressoes-cliente/
├── plan.md              # Este arquivo
├── research.md          # Decisões técnicas por história (Phase 0)
├── data-model.md        # Entidades/tabelas afetadas (Phase 1)
├── quickstart.md        # Roteiro de validação por história (Phase 1)
├── contracts/           # Contratos das server functions afetadas (Phase 1)
└── tasks.md             # (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

```text
src/
├── routes/_authenticated/      # painel.*.tsx (telas do dono/master) + route.tsx (BusinessProvider)
│   └── api/public/             # webhooks AgPay, crons, whatsapp
├── components/painel/          # AvisoPop, PageHeader, sidebar widgets
├── components/public-booking/  # agendamento público (elegance, CookieBanner)
├── lib/                        # *.functions.ts (server fns) / *.server.ts / utilitários
│   ├── business.tsx            # BusinessProvider (cache de contexto)  → US2
│   ├── logo.ts                 # validateLogoFile / decode             → US4
│   ├── niche-assets.server.ts  # leitura das artes por nicho           → US1
│   ├── agpay.server.ts         # gateway (hoje só Pix)                 → US7
│   ├── subscription*.ts        # ciclo de assinatura                   → US7
│   └── whatsapp-notify.server.ts / evolution.server.ts                 → US6
public/templates/<nicho>/{templates-prontos,fotos-de-servicos}/        # assets → US1
supabase/migrations/            # schema (se US7 exigir tabelas de cobrança)
tests/ + *.test.ts(x)           # Vitest; tests e2e Playwright
```

**Structure Decision**: Single project full-stack TanStack Start. As server functions ficam co-localizadas em `src/lib`. O trabalho altera principalmente `src/routes/_authenticated`, `src/components`, `src/lib` e `public/templates`, com possíveis migrations para US7.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| US7: adicionar meio de pagamento por cartão ao AgPay (hoje só Pix) | Pedido explícito do cliente (assinatura por cartão e Pix) | Manter só Pix não atende o requisito; depende de o AgPay expor API de cartão (ver research.md) |

# Arquitetura — mapa inicial

**Versão:** repositório `C:\Users\Felps\code\agenda-agora`, branch `main`, commit `323189d` em 2026-11-13. Não confundir com três clones/branches locais mais antigos.

## Stack observada

- React 19 e TypeScript; TanStack Start/Router e TanStack Query.
- Vite para desenvolvimento/build e Nitro como runtime/deploy Node.
- Supabase PostgreSQL/Auth/Storage via `@supabase/supabase-js`.
- Aplicação possui server functions em `src/lib/*` e rotas de API em `src/routes/api/public/*`.
- Testes configurados com Vitest, Playwright e conjunto DB separado (`package.json`).
- Integrações de pagamento observadas: AgPay em `src/lib/agpay.server.ts`; legado Asaas nas migrations e nomes históricos.
- WhatsApp: módulos UazAPI e Evolution, com seleção em `src/lib/whatsapp-provider.server.ts`; pendente validar configuração implantada.

## Camadas e jornadas

1. Rotas públicas: `/`, `/agendar/$slug`, autenticação e páginas de suporte/SDR.
2. Painel autenticado: páginas em `src/routes/_authenticated/` para agenda, clientes, profissionais, serviços, funcionamento, integrações, carteira, transações, relatórios e Master.
3. Server functions: módulos `*.functions.ts` e `*.server.ts` acessam Supabase; guardas compartilhadas em `src/integrations/supabase/auth-middleware.ts` e `src/lib/auth/`.
4. API/hooks: webhook AgPay, webhook WhatsApp e hooks de cron para eventos financeiros, ciclo de assinatura e lembretes.
5. Persistência: migrations imperativas em `supabase/migrations/`; types gerados em `src/integrations/supabase/types.ts`.
6. Efeitos externos: chamadas AgPay, Evolution/UazAPI, auth/Supabase Storage.

## Fronteiras da evidência

- O arquivo `.env` não foi lido nem seus valores exibidos.
- `supabase/config.toml` aponta para project ref `qagotnmdqjoodoudcikd`; o conector Supabase negou acesso de leitura a esse projeto. A listagem disponível mostra somente projeto de outra finalidade.
- Não há confirmação atual de qual commit está implantado no VPS, qual provedor WhatsApp está selecionado, nem quais variáveis estão configuradas.
- `specs/` está ignorada via `.git/info/exclude`, mas contém artefatos locais e relevantes; isso é uma fronteira de disponibilidade/versionamento a considerar em continuidade da equipe.

## Inventário inicial de áreas

- Agendamento público e horários: `src/routes/agendar.$slug.tsx`, `src/lib/booking.functions.ts`, `src/lib/appointments.functions.ts`, `src/lib/time-blocks*`, migrations de overlap.
- Pagamentos e saldo: `src/lib/agpay.server.ts`, `agpay-events.server.ts`, `ledger*.ts`, `withdrawal.server.ts`, rotas AgPay e migrations AgPay/ledger.
- Autenticação/roles: `auth-middleware.ts`, `src/lib/auth/`, login/SDR, rotas `_authenticated`.
- WhatsApp: `whatsapp-provider.server.ts`, `evolution.server.ts`, `uazapi.server.ts`, greeting/notify/reminders e webhook incoming.
- Master/support: `admin.functions.ts`, `master.functions.ts`, support e carteira.

## Próxima revisão arquitetural

Conferir grafo de chamadas, autenticação por função, schemas de tabelas/relacionamentos, jobs ativos na infra, configuração de domínios e diferença entre migrations locais e aplicadas. A inspeção remota do schema permanece bloqueada pelo acesso atual.

## Dependências (consulta 13/11/2026)

`npm audit` reportou 2 High e 7 Moderate no lockfile completo. Os achados DEP-001/002/003 estão detalhados em [seguranca.md](seguranca.md), junto de versões, escopo dev/runtime e limitações. O resultado não é equivalente a exploração; nenhuma vulnerabilidade foi testada por payload.

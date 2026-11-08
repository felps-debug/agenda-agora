# Data Model — 002 Correção de regressões + rede de QA

Mudanças de dados são mínimas e aditivas. A maior parte da feature é de comportamento (UI/queries), não de novas estruturas.

## 1. Estado de dispensa de avisos (client-side — localStorage)

Não é tabela de banco; é persistência local por dispositivo (mesmo modelo do broadcast). Novo módulo `src/lib/avisos-store.ts`.

- **Chave de storage**: `agenda-agora:avisos-dismissed`
- **Formato**: mapa de `tipo` → conjunto de marcadores de dispensa.
- **Marcador de dispensa**: string determinística `"{tipo}:{estágio}:{YYYY-MM-DD}"`.
  - `tipo`: `broadcast` | `cobranca` | `trial` (extensível)
  - `estágio`: identificador do estado que originou o aviso (ex.: estágio de cobrança `amanha|venceu_hoje|atrasado|urgente`); para broadcast, o `id` do aviso.
  - `YYYY-MM-DD`: dia local da dispensa (implementa "reaparece 1x/dia" — Q5).
- **Regra de exibição** (`shouldShowAviso`, pura): mostrar se o marcador do aviso atual **não** está no conjunto de dispensados. Mudou o estágio ou virou o dia → novo marcador → reaparece.
- **Limite defensivo**: manter no máximo N marcadores recentes (ex.: 200), como já faz `notifications-store.ts`.
- **Degradação**: storage indisponível (modo privado/quota) → funções não lançam; o aviso pode reaparecer, nada trava (Edge Case da spec).

> O store existente de broadcast (`notifications-store.ts`/`broadcast.ts`) é absorvido/alinhado a este padrão para manter um único mecanismo.

## 2. `client_error_log` (NOVA tabela Supabase) — US6/FR-016

Registro de erros capturados em produção.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid (pk) | default gen_random_uuid() |
| `occurred_at` | timestamptz | default now() |
| `kind` | text | `ui_error` \| `unhandled_rejection` \| `request_failed` |
| `message` | text | mensagem sanitizada (sem segredos) |
| `source` | text | rota/URL onde ocorreu |
| `detail` | jsonb | stack resumido, status HTTP, URL da requisição (truncados) |
| `business_id` | uuid (nullable) | contexto, se disponível |
| `user_id` | uuid (nullable) | contexto, se disponível |
| `app_version` | text (nullable) | build/commit, se disponível |

- **RLS**: INSERT permitido para sessões autenticadas (coletor client-side); SELECT restrito a `super_admin` (painel master). Nunca expor detail a não-master.
- **Retenção**: limpeza periódica (ex.: manter 30–90 dias) — detalhe operacional, fora do caminho crítico.
- **Privacidade**: `message`/`detail` sanitizados (sem tokens/PII sensível).

## 3. Auditoria de edição da ficha (US4/FR-009) — estende tabela existente

Reusar `master_business_events` (já usada pela impersonação) para registrar alterações feitas pela equipe na ficha.

- Novo(s) `type`: `edicao_ficha` (telefone/nome/responsável) e `troca_senha_dono`.
- Campos reutilizados: `business_id`, `actor_id` (quem alterou), `title`, `description`, timestamp.
- **Senha**: registrar apenas o evento (quem/quando), **nunca** o valor da senha.

## 4. Entidades existentes referenciadas (sem mudança estrutural)

- **`businesses`**: telefone de login (`phone`) e nome (`name`), editados via server function; estrutura inalterada.
- **`profiles` do dono**: o responsável é `full_name`; `email` acompanha a alteração do telefone de login. Não se confunde com `sales_owner`, responsável comercial da equipe.
- **Usuário Auth do dono**: senha e e-mail sintético de login alterados via Supabase Admin (`auth.admin.updateUserById`); sem mudança de schema. A alteração do telefone sincroniza Auth, perfil e negócio, com compensação se a gravação do cadastro falhar.
- **`master_impersonation_sessions`**: fluxo de impersonação (US2) — sem mudança de schema; apenas correções de config/perf.
- **`subscription_payments` / `access_until`**: fonte do `billingStage` (US1) — sem mudança.

## Regras de validação (derivadas dos requisitos)

- **Senha (US4)**: força mínima antes de persistir — **≥8 caracteres, ao menos uma letra e ao menos um número** — validada no servidor; rejeitar fracas com mensagem clara.
- **Aviso (US1)**: marcador de dispensa deve ser estável para o mesmo (tipo, estágio, dia) e distinto ao mudar qualquer um dos três.
- **Error log (US6)**: `kind` restrito ao enum; `message`/`detail` truncados e sanitizados.
- **Config boot (US6)**: `ALLOWED_APP_ORIGINS` deve conter a origem de `PUBLIC_APP_URL`; PINs presentes e no formato esperado.

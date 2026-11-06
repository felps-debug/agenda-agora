# Merge Notes — base mesclada (T004)

**Data**: 2026-11-06 · **Branch de trabalho**: `main` (a base já é o resultado do merge frontend-do-cliente × backend-de-referência, consolidado na rodada anterior — Spec 010).

## Situação da base

Ao iniciar esta feature, o repositório **já estava mesclado**: os últimos commits são da Spec 010 ("endurece a versão do cliente: segurança, testes, banco de ensaio"), que fez a reconciliação frontend/backend e o endurecimento. Portanto o T004 não é um grande merge arquivo-a-arquivo novo, e sim a **verificação** de que a base mesclada está íntegra. Critério aplicado: confiar na base consolidada e corrigir pontualmente onde a verificação por história apontar gap.

### Evidências coletadas

- **Assets de template (US1)**: 548 arquivos rastreados no git sob `public/templates/`; 526 arquivos de imagem em 11 nichos (+ pasta `nichos/` de capas). Todos os 11 ids de `TEMPLATE_CATEGORIES` casam 1:1 com pastas. → bug "nenhuma arte" **não presente** nesta base.
- **Backend por tela (US8)**: os 36 módulos `@/lib/*` referenciados pelas 27 telas do painel/master **existem** (ver `parity-matrix.md`). Nenhum import quebrado em nível de módulo.
- **Credenciais (T003)**: `.env.local` tem Supabase (service role + publishable), `AGPAY_API_TOKEN`, UAZAPI (token/admin/base), `LEDGER_TEST_BUSINESS_ID`, `AGENDA_CRON_SECRET`. **Falta** `VEOPAG_CLIENT_ID`/`VEOPAG_CLIENT_SECRET` → cartão (T041–T046) adiado, sem bloqueio para o restante.

## Baseline de testes (T001)

`npm test` antes de qualquer alteração: **3 falhas / 695 passam / 6 skip** (70 arquivos). Falhas pré-existentes (não introduzidas por esta feature):

1. `src/lib/ledger.refund.test.ts` — cenário de saldo/refund. **Relevante para US9** (revisão de split/ledger); candidato a correção na Phase 11.
2. `src/lib/panel1-config.storage.test.ts` — teste espera `layout_key: "classic"`, código retorna `"elegance"` (mudança da Spec 010 — layout Elegance fixo). Teste desatualizado vs. decisão de produto; avaliar atualização do teste na Phase 12.

Qualquer falha **nova** além dessas 3 é regressão desta feature (FR-012/SC-009).

## Riscos registrados

- **US1 em produção (deploy)**: `niche-assets.server.ts` faz `readdirSync(process.cwd()/public/templates)` em runtime. Em ambiente serverless (Vercel/Nitro), arquivos de `public/` são servidos estaticamente mas podem **não** estar acessíveis via FS da função. `.vercelignore` **não** exclui `public/templates` (só `.env*`, `.specify/`, `specs/`), então os arquivos vão para o deploy; resta confirmar que a função SSR os enxerga no FS. Não testável localmente — validar no primeiro deploy; se falhar, mover leitura para build-time (glob import) ou Supabase Storage.

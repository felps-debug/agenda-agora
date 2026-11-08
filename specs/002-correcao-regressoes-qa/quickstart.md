# Quickstart / Validação — 002 Correção de regressões + rede de QA

Guia para validar que cada user story funciona de ponta a ponta. Detalhes de entidades e contratos: ver [data-model.md](./data-model.md) e [contracts/server-functions.md](./contracts/server-functions.md).

## Pré-requisitos

As instruções executáveis, o modo de baixa memória e o estado das migrations estão em [docs/qa-regressions.md](../../docs/qa-regressions.md). `npm test` agora usa um worker. Rode Vitest, QA e verificação de regressões em sequência.

1. Dev no ar com env carregada no `process.env` (SSR):
   ```bash
   set -a; . ./.env.local; set +a; npm run dev
   ```
   (Para testar impersonação local, `.env.local` deve ter `ALLOWED_APP_ORIGINS=http://localhost:3002`.)
2. Playwright Chromium instalado (`npx playwright install chromium`).
3. Contas de teste (credenciais no histórico da sessão): dono e master (`super_admin`).
4. Rodar o seed idempotente antes dos cenários que precisam de dados: `node scripts/qa/seed.mjs`.

## Validação por User Story

### US1 — Avisos não reaparecem após fechados
1. Logar com um dono cujo plano esteja vencido (aviso de cobrança visível).
2. Fechar o aviso no "X".
3. Navegar entre telas e recarregar (F5).
4. **Esperado**: o aviso não reaparece no mesmo dia/estágio; reaparece só ao mudar o estágio ou virar o dia.
5. Automatizado: `scripts/qa/` cobre fechar → navegar → F5 para todos os tipos de aviso.

### US2 — Impersonação Painel 3 → Painel 2 e retorno
1. Logar como master; abrir a ficha de um estabelecimento; clicar "Abrir Painel 2".
2. **Esperado**: entra na conta em modo suporte em ≤3s, FAB laranja visível.
3. Acionar "Voltar ao Painel Master" e digitar o PIN de retorno (`41410070` após ajuste da env).
4. **Esperado**: retorna ao Painel 3.
5. Config: o healthcheck de boot acusa se `ALLOWED_APP_ORIGINS`/PINs estiverem errados (ver US6).

### US3 — Navegação sem "recarrega tudo"
1. Logar como dono; abrir uma tela; navegar para outra e voltar.
2. **Esperado**: ao voltar com dados frescos, não aparece o esqueleto "Carregando" nem refetch completo; imagens não piscam.
3. Automatizado: a suíte verifica ausência de `.owner-route-skeleton` ao navegar entre telas já visitadas.

### US4 — Edição inline na ficha
1. Master abre a ficha; clica no lápis de cada campo (telefone de login, nome, responsável) e edita; salva.
2. Editar senha: digitar uma senha; **senha fraca é rejeitada**; senha válida persiste.
3. **Esperado**: valores persistem; eventos `edicao_ficha`/`troca_senha_dono` registrados em `master_business_events` (sem o valor da senha).

### US5 — Ajustes de UI
1. Tela de assinatura: o botão de pagar está dentro do card/pop-up.
2. Página de Serviços tem `<h1>`.
3. Página de Funcionamento não emite warning de "key" no console.

### US6 — Rede de QA
1. Suíte: `npm run qa` → sai com código 0 quando tudo ok; ≠ 0 ao detectar console error, imagem quebrada, texto inválido ou regressão dos fluxos corrigidos.
2. Regressão proposital (ex.: reverter a persistência do aviso) → a suíte **falha** apontando o problema.
3. Healthcheck: subir com uma env obrigatória ausente/incoerente → boot **avisa/recusa** de forma visível.
4. Monitoramento: provocar um erro de interface → evento aparece em `client_error_log` e no painel de erros do Painel 3.

## Critérios de aceite mapeados

| User Story | Success Criteria |
|-----------|------------------|
| US1 | SC-001 |
| US2 | SC-002, SC-004 |
| US3 | SC-003 |
| US4 | SC-005 |
| US5 | (acceptance scenarios US5) |
| US6 | SC-006, SC-007, SC-008 |

## Fora de escopo (não validar como correção)

- Foto do serviço "não carrega/pisca": **não reproduz em dev** (URL assinada em cache, sem flicker). Validação aqui é apenas confirmar que o **monitoramento (US6)** capturaria evidência em produção; a correção fica para quando houver evidência real.

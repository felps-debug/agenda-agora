# Phase 0 — Research & Decisões

Decisões técnicas por história. Base: trabalhar sobre `felps-debug/agenda-agora` (referência, backend completo) portando o frontend do cliente.

## US1 — Artes/templates por nicho

- **Decisão**: Restaurar os arquivos de arte em `public/templates/<nicho>/{templates-prontos,fotos-de-servicos}/` (loader em `niche-assets.server.ts` já lê do disco). A referência já tem 548 arquivos; garantir que o nicho exibido no frontend do cliente casa com os ids de pasta.
- **Rationale**: O bug é 100% asset ausente no repo do cliente; a lógica funciona.
- **Verificar**: (a) mapeamento id-de-nicho do frontend ↔ nome da pasta (acento/maiúscula, ex.: "Sobrancelha" → `sobrancelha`); (b) se o deploy (Vercel) publica `public/templates` no artefato — confirmar que não há `.vercelignore`/glob excluindo.
- **Alternativas**: servir artes do Supabase Storage (rejeitado agora — muda arquitetura sem necessidade).

## US2 — Navegação sem recarregar + cache localStorage

- **Decisão**: (1) Garantir que o `BusinessProvider` (em `_authenticated/route.tsx`, acima do layout) não seja remontado na navegação entre telas-filhas; (2) persistir o contexto estável do negócio no `localStorage` e hidratar o estado inicial a partir dele (cache-first), revalidando via React Query em background (`staleTime` + `initialData` do cache local). Assim o "Carregando estabelecimento..." não reaparece.
- **Rationale**: `business.tsx`/`PageHeader.tsx` são idênticos à referência e usam React Query; o sintoma "carrega do zero" vem de remontagem/estado inicial sem cache. Cache em localStorage foi decisão do responsável.
- **Verificar**: por que o cliente percebe reload — se o layout `painel.tsx` remonta (checar `key`/estrutura de rotas) ou se é só o `seenAt`/queries reinicializando. Medir com React Query devtools.
- **Alternativas**: só `staleTime` sem localStorage (rejeitado — não acelera 1º paint entre sessões).

## US3 — Aviso exibido uma única vez

- **Decisão**: Persistir o estado "visto/fechado" **por aviso** no `localStorage` (ex.: set de ids dispensados), não via `useRef` em memória. Carregar `seenAt`/dispensados **sincronamente** no estado inicial (lazy initializer), e **marcar como visto ao fechar o popup (X)** — não só ao abrir o sino.
- **Rationale (causa-raiz confirmada)**: em `painel.tsx` o popup usa `shownRef` (useRef, zera na remontagem) e `seenAt` carrega em `useEffect` (inicia 0 → mostra). Fechar o popup não persiste nada; só abrir o sino grava `broadcasts-seen`. Por isso reaparece a cada navegação.
- **Verificar**: manter compatibilidade com a lógica de público-alvo/prazo (`broadcastVisibleTo`) e com o contador de não-lidos.
- **Alternativas**: marcar "visto" no servidor por usuário (mais robusto, porém exige tabela/coluna; manter localStorage por ora, alinhado ao pedido).

## US4 — Upload de imagem aceita tudo + converte

- **Decisão**: Estender `validateLogoFile`/`decodeBusinessImageFile` (`src/lib/logo.ts`) para (a) aceitar mais tipos de imagem; (b) quando o navegador não decodifica o formato (ex.: **HEIC/HEIF**), converter no cliente antes do upload. Reaproveitar o pipeline do cropper (canvas → `toBlob` png/jpeg) como normalizador; para HEIC usar `heic2any` (ou decode via `createImageBitmap` quando suportado) e então passar pelo canvas.
- **Rationale**: canvas já re-encoda png/jpeg no cropper, mas não decodifica HEIC na maioria dos browsers; precisa de conversão dedicada. A validação atual por assinatura (magic bytes) restringe a png/jpeg/webp.
- **Decisão (confirmada)**: instalar `heic2any` e carregá-la via **import dinâmico só quando o arquivo for HEIC/HEIF** — quem envia PNG/JPEG/WebP nunca baixa a lib (sem impacto no bundle normal). Limite de 5 MB aplicado **após** conversão.
- **Alternativas**: conversão no servidor (Supabase Edge/sharp) — rejeitado agora por latência/complexidade; manter conversão client-side lazy.

## US5 — Rebrand "Carteira" → "Ag Pay"

- **Decisão**: Substituir a nomenclatura de interface "Carteira" por "Ag Pay" na sidebar, topo, Negócios/Recebíveis e telas de pagamento; alinhar classes de tema CSS (`.carteira-theme` → `.agpay-theme`, já feito no frontend do cliente) e rotas de exibição. Preferir o frontend do cliente como fonte do rebrand.
- **Rationale**: pedido direto do cliente (áudio 1); o frontend do cliente já traz "Ag Pay".
- **Decisão (confirmada)**: **renomear a rota** `/painel/carteira-desempenho` → `/painel/agpay-performance` (o frontend do cliente já usa `agpay-performance`). Adicionar redirect da rota antiga para não quebrar links salvos. Limpar resquícios de "Carteira" em títulos de página (`head`), tooltips e textos de ajuda.

## US6 — Reativar teste do WhatsApp em Integrações

- **Decisão**: Repor na tela `painel.integracoes.tsx` o acionador "Enviar teste" e a server function de envio (presentes na referência: `evolution.server.ts`/`whatsapp-notify.server.ts`). Portar do backend de referência para o frontend do cliente.
- **Rationale**: ressalva explícita; o backend já existe na referência, foi o frontend do cliente que removeu o botão.
- **Verificar**: credenciais UAZAPI/Evolution no ambiente; enviar só para número autorizado (aviso já existe na doc).

## US7 — Ag Pay com cartão e Pix na assinatura (30 dias)

- **Decisão (após leitura da doc https://agpay.services/documentacao em 2026-11-06)**:
  - **Pix na assinatura — FAZER AGORA**: `createPixCharge` → `/api/v1/payments/pix` já existe. Adicionar o fluxo de **cobrança da assinatura** (criar cobrança no vencimento/renovação por Pix), reusando a inbox/webhook idempotente (`/api/public/agpay-webhook`, eventos `deposit.completed`, HMAC-SHA256) e o ledger. Renovar `access_until` +30d ao `paid`.
  - **Cartão — VIÁVEL via VeoPag (adquirente do AgPay)**: a doc da VeoPag/VenoPag (`venopagments.com/docs`) expõe cartão: `POST /api/cashin` com `payment_method:"credit_card"` → devolve `checkout_url` (página hospedada; o nº do cartão **não passa pela API**), com **parcelamento** (juros do comprador); webhook com `refunded`/`chargedback`. Auth `X-Client-Id` + `X-Client-Secret`; checar sempre o campo `ok` (HTTP sempre 200). **Caminho**: integrar a VeoPag **direto** para cartão (fluxo redirect/checkout), separado do endpoint Pix do AgPay que já existe.
  - **⚠️ Pendências do cartão**: (a) obter **credenciais VeoPag** (`X-Client-Id`/`X-Client-Secret`); (b) confirmar que **VenoPag (venopagments.com) == VeoPag** que o Guilherme citou (nome difere); (c) mapear o **webhook de `paid`/aprovado do cartão** para renovar `access_until`; (d) tokenização/recorrência **não** documentadas → cobrança one-off por ciclo (igual Pix).
  - **Recorrência**: a API **não** tem assinatura/recorrência nativa. O **ciclo de 30 dias é controlado pelo nosso backend** (cria uma cobrança one-off por ciclo; renova no webhook). Confirmado pela doc.
- **Rationale**: é a maior incógnita; a doc resolve Pix e descarta cartão por ora.
- **Verificar**: ciclo de 30 dias em `subscription*.ts` (hoje só computa status, não cria cobrança); migration `subscription_charges`; renovação de `access_until` ao confirmar pagamento. Auth AgPay: a doc cita `X-Client-ID`, mas o histórico do projeto (roadmap, 2026-09-29) diz que `AGPAY_CLIENT_ID` não é usado pela API real — seguir o código que já funciona.

## US8 — Backend funcional em todas as telas (paridade)

- **Decisão**: Religar/portar os módulos que o repo do cliente perdeu da referência, revisando o que já existe antes de reimplementar. Inventário inicial (24 itens só na referência): `env-security.server`, `login-attempts.server`, `security-pin.functions`, `reset-password.functions`, `sdr.*`, `lifecycle-settings.functions`, `platform-settings.server`, `agpay-fees.functions`, `agpay-performance.functions`, `carteira-config/desempenho`, `test-support`.
- **Rationale**: objetivo central; a referência é a fonte do backend bom.
- **Verificar**: para cada tela do frontend do cliente, qual server function ela chama e se existe/funciona; produzir uma matriz tela → função → status (ok/faltando/quebrado) na fase de tasks.

## US9 — Split de pagamentos (DB + backend)

- **Situação atual (referência)**: split **interno no ledger** (`ledger.server.ts`). A plataforma recebe 100% na conta AgPay e o razão aloca: `platformCommissionCents` = % configurável (hoje 0%) + R$0,25 fixo; taxa do gateway (3,99% + R$0,49) descontada; `netAmountCents = bruto − gateway − comissão`. Estabelecimento saca o saldo (RPC `FOR UPDATE`). Tabelas `ledger_entries`/`wallets` (migrations `20260929120*`, `20261005120000_withdrawal_platform_fee`).
- **AgPay nativo (doc 2026-11-06)**: split existe mas é **configurado no Dashboard** (Central de Splits), por **email** do recebedor, regra global aplicada a transações futuras (valor fixo primeiro, % sobre o líquido); crédito instantâneo na carteira do recebedor após `paid`. **Sem API de split por transação; sem subconta/marketplace.**
- **Decisão (preliminar, a confirmar)**: **manter o split interno no ledger** — o split nativo do AgPay (dashboard, regra global por email) não encaixa bem num SaaS multi-tenant onde cada estabelecimento é um recebedor distinto por transação. Entregável da US9: parecer comparativo + auditoria dos cálculos/tabelas + confirmação de que não há divergência entre crédito do provedor e razão.
- **Verificar**: se a conta AgPay tiver alguma regra de split configurada no dashboard, ela pode conflitar com o ledger (dupla contagem) — auditar o dashboard; coerência das taxas do gateway (hardcoded em `ledger.server.ts` vs cobradas pelo AgPay); `agpay-fees.functions.ts` (taxas em `platform-settings`).
- **Alternativas**: split nativo AgPay (rejeitado prelim. — falta API por transação); híbrido (rejeitado — complexidade/dupla fonte de verdade).

## Decisões transversais

- **Testes**: cada história recebe teste automatizado (Vitest unit para lógica pura: dedupe de aviso, validação/conversão de imagem, mapeamento de nicho, cobrança; Vitest db para fluxos de banco; Playwright para navegação/sidebar e upload). Pedido explícito do usuário.
- **Dependências novas** (`heic2any` para US4) só após confirmação — não atualizar pacotes TanStack fixados.
- **Autorização**: alterar backend da referência livremente onde faltar/estiver errado (autorizado).

## Pendências — status (resolvidas em 2026-11-06)

1. ✅ AgPay cartão (US7): **não há endpoint na doc pública** → assinatura por **Pix agora**; **cartão bloqueado** até o AgPay fornecer a doc/endpoint de cartão (ou usar outro provedor). Recorrência controlada pelo nosso backend.
2. ✅ `heic2any` (US4): **aprovado**, com **import dinâmico** (só carrega ao enviar HEIC).
3. ✅ Rota (US5): **renomear** `carteira-desempenho`→`agpay-performance` + redirect da antiga.

### Bloqueio remanescente
- **US7-cartão** depende de doc/endpoint de cartão do AgPay (ação externa: pedir ao AgPay). Na fase de tasks, o cartão fica como tarefa **bloqueada**; Pix segue normalmente.

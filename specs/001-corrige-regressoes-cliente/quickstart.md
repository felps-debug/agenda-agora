# Quickstart — Roteiro de validação

Pré-requisitos: `.env.local` com Supabase (incl. `SUPABASE_SERVICE_ROLE_KEY` para telas de dados), dev server `npm run dev` (localhost:3000). Login do dono e do master.

## Como validar cada história

### US1 — Templates
1. Login do dono → painel → **Modelos/Templates** → abrir cada nicho.
2. ✅ Esperado: "Templates prontos" e "Fotos de serviços" exibem artes; estado vazio só em nicho sem conteúdo.

### US2 — Navegação sem reload
1. No painel, clicar em várias opções da sidebar em sequência.
2. ✅ Esperado: troca imediata, **sem** "Carregando estabelecimento..." após o 1º load; sem recarregar do zero.

### US3 — Aviso uma vez
1. Master dispara um aviso → dono visualiza o popup → fecha no X → navega entre telas e troca de aba.
2. ✅ Esperado: o popup **não** reaparece; um aviso novo/distinto aparece uma vez.

### US4 — Upload de imagem
1. Editar serviço → aba Imagem → enviar PNG, JPEG, WebP e **HEIC** (foto de iPhone).
2. ✅ Esperado: todos aceitos (HEIC convertido); PDF/arquivo não-imagem recusado com mensagem clara; > 5 MB informa limite.

### US5 — Rebrand Ag Pay
1. Percorrer sidebar, topo, Negócios/Recebíveis, tela de pagamento.
2. ✅ Esperado: aparece "Ag Pay"; nenhuma ocorrência de "Carteira" visível.

### US6 — Teste WhatsApp
1. Integrações → "Enviar teste" para um número **autorizado**.
2. ✅ Esperado: mensagem enviada + retorno de sucesso; sem conexão → erro claro.

### US7 — Ag Pay assinatura (Pix + cartão)
1. Conta com assinatura a renovar (30 dias) → pagar por **Pix** e por **cartão**.
2. ✅ Esperado: cobrança criada/processada pelo Ag Pay; ao pagar, `access_until` +30d; falha → erro claro sem renovar.
   *(Depende da confirmação de cartão no AgPay — ver research.md.)*

### US8 — Backend funcional
1. Para cada tela do painel/master, executar a ação principal.
2. ✅ Esperado: lê/grava dados reais sem erro; nada em placeholder.

## Testes automatizados
```sh
npm test            # Vitest unit (dedupe aviso, validação/conversão imagem, nicho, cobrança)
npm run test:db     # Vitest com Postgres de dev (cobrança + webhook + renovação)
npm run test:e2e    # Playwright (navegação sidebar, upload HEIC, popup único)
```
✅ Critério de pronto: suíte verde + sem regressões (FR-012/FR-013/SC-009).

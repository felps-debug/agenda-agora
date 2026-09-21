# Roadmap

## Em andamento
- [x] Aplicar General Sans e as proporções tipográficas da referência em todo o SaaS e no Android
- [x] Reproduzir as proporções desktop/Android da barra lateral ScaleReels e o carregamento curto entre tópicos
- [x] Remover Produtos e Assinatura e consolidar o painel em azul, preto e cinza com navegação animada
- [x] Organizar a barra lateral em seções e criar Serviços/Profissionais completos com vínculos, imagens, login e permissões
- [x] Redesenhar o painel do comércio fiel à referência ScaleReels, usando a logo Agenda Agora enviada e sem alterar tópicos ou funções
- WhatsApp automático via UazAPI (QR Code no painel do dono + mensagem automática na confirmação) — aguardando credenciais UAZAPI_BASE_URL/UAZAPI_TOKEN

## Em andamento (pagamento)
- Trocada a integração de Pix: Mercado Pago → Asaas (split de pagamento com subconta por negócio).
  `src/lib/mercadopago.server.ts` removido, `src/lib/asaas.server.ts` no lugar.
  Motivo: Mercado Pago não automatiza saque pra terceiro (CPF diferente do dono da conta);
  Asaas resolve com subconta não-BaaS (o dono do negócio saca direto no dashboard do Asaas).
- [x] Cobrança criada pela subconta do estabelecimento; somente a comissão opcional é dividida com a wallet master.
- [x] Criação da subconta e conclusão manual do onboarding disponíveis no painel Master; o webhook é cadastrado no próprio `POST /accounts`.
- [x] Webhook idempotente com inbox privada, resposta rápida e processamento assíncrono em `/api/public/hooks/asaas-events`.
- [x] Expiração/cancelamento local apaga a cobrança Pix pendente no Asaas.
- [x] CPF/CNPJ temporário, sem acesso do cliente, apagado após vincular o customer ou expirar.
- [ ] Preencher as variáveis Asaas no `.env.local`/deploy e testar uma cobrança Pix no Sandbox.
- [ ] Aplicar a migration `20260918010000_...` (subcontas, credenciais cifradas, pagamentos e inbox de Webhook).
- [ ] Definir com o Guilherme o `asaas_commission_percent` de cada negócio (0 por padrão: sem comissão, 100% fica na subconta do estabelecimento).
- [ ] Configurar o cron autenticado para chamar `POST /api/public/hooks/asaas-events` a cada minuto.
- [ ] Criar uma subconta de Sandbox pelo painel Master, concluir o onboarding e marcá-la como aprovada.
- Campo de CPF/CNPJ adicionado no formulário público de agendamento (`agendar.$slug.tsx`) — obrigatório porque o Asaas exige documento pra criar o customer da cobrança (Mercado Pago não exigia).

## Próximos
- Definir próximo foco com o usuário
- [x] Mensagens automáticas WhatsApp: confirmação após sinal pago + lembrete X horas antes (cron de hora em hora)
- [ ] Vincular credenciais do provedor WhatsApp (UazAPI) para ativar o envio real

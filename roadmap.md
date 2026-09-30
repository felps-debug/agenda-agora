# Roadmap

## Em andamento

- [x] Aplicar General Sans e as proporções tipográficas da referência em todo o SaaS e no Android
- [x] Reproduzir as proporções desktop/Android da barra lateral ScaleReels e o carregamento curto entre tópicos
- [x] Remover Produtos e Assinatura e consolidar o painel em azul, preto e cinza com navegação animada
- [x] Organizar a barra lateral em seções e criar Serviços/Profissionais completos com vínculos, imagens, login e permissões
- [x] Redesenhar o painel do comércio fiel à referência ScaleReels, usando a logo Agenda Agora enviada e sem alterar tópicos ou funções
- WhatsApp automático via UazAPI (QR Code no painel do dono + mensagem automática na confirmação) — aguardando credenciais UAZAPI_BASE_URL/UAZAPI_TOKEN

## Pagamentos

- [x] Gateway Pix ativo: AgPay, autenticado por um token único da plataforma (`AGPAY_API_TOKEN`; `AGPAY_CLIENT_ID` não é usado pela API real — corrigido em 2026-09-29, causava 401 mesmo com token válido).
- [x] Cobranças Pix processadas pela conta da plataforma.
- [x] Webhook AgPay validado por HMAC e processado de forma idempotente pela inbox em `/api/public/agpay-webhook` e pelo cron `/api/public/hooks/agpay-events`.
- [x] Cancelamento de reserva com Pix pendente tratado localmente; a cobrança externa expira sem chamada de cancelamento ao provedor.
- [x] US4/US5: corrigida a fidelidade visual do Painel 1 público, aplicando as 17 cores configuradas pelo estabelecimento.
- [x] Spec 005: ledger financeiro (`ledger_entries`/`wallets`), substituindo o cálculo de saldo
      on-the-fly (`computeBalance`) por um razão contábil imutável e auditável. Comissão da
      plataforma = percentual configurável (hoje 0%) + R$ 0,25 fixos por transação; taxa do AgPay
      (3,99% + R$ 0,49) repassada ao estabelecimento. Saque protegido contra double-spending por RPC
      com `FOR UPDATE` (validado com concorrência real contra o Postgres de dev). Estorno pode deixar
      saldo negativo e bloqueia novos saques até revisão do Master. Painel de conciliação e saques
      presos (>24h) em `/painel/master`.
- [x] Spec 006: editor de aparência do Painel 1 (`/painel/aparencia-editor`) reconstruído para
      mostrar a página pública real (fundo + cabeçalho + cards de serviço) como uma única prévia
      clicável — clicar no fundo, no cabeçalho ou em um card abre o popover de cor correspondente,
      sem widgets soltos ou textos de mockup. Adicionado campo `brand_background` (cor de fundo da
      página), que antes não tinha UI de edição nenhuma.
- [x] Spec 007: editor visual (WYSIWYG) das artes de divulgação (`/editor-template/$id`) — mover e
      redimensionar texto/ícone/forma por arrasto, toque ou teclado (setas = 1px, Shift+setas =
      resize) com guia de alinhamento por snap a 8px; edição de cor/fonte/tamanho/texto com
      atualização imediata na prévia; seletor de ícones ampliado de 8 para 20 chaves (aditivo,
      compatível com artes antigas) com busca; fundo da arte editável sem afetar as camadas; aviso
      de saída com alterações não salvas também na navegação "Voltar" (antes só cobria fechar
      aba/recarregar). Validado manualmente em desktop e mobile — resultado completo em
      `specs/007-editor-templates-wysiwyg/quickstart.md`.

## Próximos

- Definir próximo foco com o usuário
- [x] Mensagens automáticas WhatsApp: confirmação após sinal pago + lembrete X horas antes (cron de hora em hora)
- [ ] Vincular credenciais do provedor WhatsApp (UazAPI) para ativar o envio real

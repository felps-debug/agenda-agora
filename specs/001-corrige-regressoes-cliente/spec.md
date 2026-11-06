# Feature Specification: Reconciliação do frontend do cliente com o backend + correção de regressões

**Feature Branch**: `001-corrige-regressoes-cliente`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Casar o frontend novo entregue pelo cliente (Guilherme) com o backend existente, deixando tudo funcional, corrigindo as regressões e aplicando o feedback do cliente (áudios e mensagens). Manter o visual/decisões do cliente, com ressalvas: reativar o envio de teste do WhatsApp em Integrações; reverter 'Carteira' para 'Ag Pay' em todo o painel; ligar o Ag Pay no pagamento de assinatura (30 dias) e cartão. As tarefas devem incluir testes, não só desenvolvimento."

## Contexto

A versão original do produto (com backend completo) foi entregue ao cliente. O cliente alterou o **frontend** (rebrand, telas redesenhadas, novos componentes) e devolveu uma nova versão, que deve ser a **aparência final**, mas que (a) perdeu parte do backend/endurecimento e assets da versão original e (b) introduziu regressões. O objetivo é **casar o frontend do cliente com o backend existente**, revisar o que já está feito, deixar todas as telas funcionais e aplicar o feedback do cliente.

Materiais de referência:
- **Versão de referência** (backend completo + 548 assets de artes): base de comparação e origem do backend.
- **Versão do cliente** (frontend novo "Ag Pay", com regressões e faltando backend/assets).
- **Backup do projeto padrão** (assets originais das artes por nicho).
- **Feedback do cliente**: 2 áudios (rebrand Ag Pay; Ag Pay em assinatura/cartão) + mensagens (navegação recarrega tudo / spam de popup).

## Clarifications

### Session 2026-11-06

- Q: Qual é o valor da assinatura mensal (30 dias) a ser cobrado por Pix — e já está definido no sistema? → A: Já configurado no sistema (reusar o valor/plano existente; não hard-codar novo).
- Q: O rebrand "Carteira"→"Ag Pay" vale só no painel do dono ou também nas telas do cliente final? → A: Em todo lugar que aparecer (painel do dono + telas vistas pelo cliente final).
- Q: A paridade de backend (US8) cobre dono E Master agora, ou só o dono primeiro? → A: Dono + Master agora (escopo completo nesta entrega).
- Q: O "aviso já visto" pode ficar só no navegador (localStorage) ou precisa valer por usuário em qualquer dispositivo? → A: localStorage (por navegador) é aceitável; limpar o navegador/outro device pode reexibir uma vez.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Artes de divulgação voltam a aparecer por nicho (Priority: P1)

O dono abre a área de modelos/templates, escolhe o nicho do seu negócio e vê as artes prontas e as fotos de serviço. Hoje a versão do cliente mostra "Nenhuma arte disponível ainda para este nicho" em todos os nichos (os arquivos de arte não vieram).

**Why this priority**: Funcionalidade de valor que ficou totalmente vazia; o conteúdo já existe na referência/backup.

**Independent Test**: Abrir cada nicho e confirmar que "Templates prontos" e "Fotos de serviços" exibem as artes; o estado vazio só aparece em nicho realmente sem conteúdo.

**Acceptance Scenarios**:

1. **Given** um nicho com artes na referência, **When** o dono abre esse nicho, **Then** as artes aparecem nas abas correspondentes.
2. **Given** um nicho sem nenhuma arte, **When** o dono o abre, **Then** o estado vazio é exibido só nesse caso.
3. **Given** o ambiente publicado (não só local), **When** o dono acessa os modelos, **Then** as artes aparecem (os arquivos fazem parte do que é publicado).

---

### User Story 2 - Navegar na barra lateral não recarrega tudo do zero (Priority: P1)

Ao clicar nas opções da barra lateral, o dono muda de tela sem que o estabelecimento seja recarregado do zero a cada clique (hoje aparece "Carregando estabelecimento..." e, junto, o popup de aviso reaparece toda vez).

**Why this priority**: Feedback explícito do cliente; afeta todo o uso do painel e é a origem do "spam de popup".

**Independent Test**: Logar no painel, clicar em várias opções da sidebar em sequência e confirmar que a troca de tela é imediata, sem recarregar o estabelecimento e sem repetir o popup.

**Acceptance Scenarios**:

1. **Given** o dono já no painel com o estabelecimento carregado, **When** ele clica em outra opção da sidebar, **Then** a tela troca sem reexibir "Carregando estabelecimento...".
2. **Given** a navegação entre telas do painel, **When** o dono alterna entre elas, **Then** o contexto do estabelecimento é reaproveitado (não refaz o carregamento inicial).

---

### User Story 3 - Aviso/notificação é exibido apenas uma vez (Priority: P1)

Depois de visualizar/fechar um aviso uma vez, ele não reaparece ao trocar de aba ou navegar. Hoje o mesmo aviso reaparece toda vez.

**Why this priority**: Feedback explícito do cliente ("spam de pop up toda vez"); passa impressão de produto quebrado.

**Independent Test**: Disparar um aviso de uso único, visualizá-lo, navegar várias vezes e confirmar que não reaparece; um aviso novo e distinto ainda aparece uma vez.

**Acceptance Scenarios**:

1. **Given** um aviso de uso único já exibido, **When** o dono troca de aba/navega, **Then** o mesmo aviso não é exibido de novo.
2. **Given** um aviso já visto, **When** o dono recarrega/reabre o painel na mesma sessão, **Then** o aviso permanece não repetido.
3. **Given** um aviso novo e distinto, **When** disparado, **Then** é exibido normalmente uma vez (o controle é por aviso).

---

### User Story 4 - Upload de imagem do serviço aceita qualquer imagem válida (Priority: P2)

Ao trocar a imagem de um serviço, o dono envia uma imagem de qualquer formato comum (incluindo de celular) e ela é aceita. Hoje recusa com "O arquivo não contém uma imagem PNG, JPEG ou WebP válida."

**Why this priority**: Impede tarefa cotidiana; limitação presente desde a versão original (não é exclusiva do cliente), vale corrigir junto.

**Independent Test**: Enviar imagens de formatos variados (PNG, JPEG, WebP, HEIC/HEIF) e confirmar aceitação/conversão; não-imagens são recusadas com mensagem clara.

**Acceptance Scenarios**:

1. **Given** uma imagem em formato amplamente usado, **When** o dono a envia, **Then** é aceita e salva.
2. **Given** um formato não exibível diretamente (ex.: HEIC), **When** o dono o envia, **Then** o sistema converte para um formato suportado em vez de recusar.
3. **Given** um arquivo que não é imagem, **When** o dono tenta enviar, **Then** é recusado com mensagem de erro clara.
4. **Given** uma imagem acima do limite, **When** enviada, **Then** o limite é comunicado com clareza (e/ou a imagem é reduzida conforme a regra).

---

### User Story 5 - Área de pagamento volta a se chamar "Ag Pay" (Priority: P2)

Onde hoje aparece "Carteira", deve aparecer "Ag Pay" — na barra lateral e no topo/Negócios/Recebíveis — conforme o cliente pediu (áudio 1).

**Why this priority**: Pedido direto do cliente; é rebrand de baixo risco porém visível em todo o painel.

**Independent Test**: Percorrer sidebar, topo e telas de pagamento/recebíveis e confirmar que a marca exibida é "Ag Pay" de forma consistente.

**Acceptance Scenarios**:

1. **Given** o painel do dono, **When** ele olha a barra lateral, **Then** o item de pagamento aparece como "Ag Pay".
2. **Given** as telas de Negócios/Recebíveis e pagamento, **When** exibidas, **Then** a nomenclatura é "Ag Pay" (sem resquícios de "Carteira").
3. **Given** as telas vistas pelo cliente final (ex.: pagamento do sinal no agendamento público), **When** exibidas, **Then** a nomenclatura também é "Ag Pay".

---

### User Story 6 - Reativar envio de mensagem de teste do WhatsApp (Priority: P2)

Na tela de Integrações, o dono pode enviar uma mensagem de teste para confirmar que o WhatsApp está conectado. Essa função existia na referência e foi removida na versão do cliente.

**Why this priority**: Ressalva explícita do usuário ("a parte de enviar teste de integrações vamos voltar").

**Independent Test**: Em Integrações, acionar "Enviar teste" para um número autorizado e confirmar o envio e o retorno de sucesso/erro.

**Acceptance Scenarios**:

1. **Given** um WhatsApp conectado, **When** o dono aciona "Enviar teste", **Then** uma mensagem de teste é enviada e o resultado é informado.
2. **Given** WhatsApp não conectado, **When** o dono tenta enviar teste, **Then** uma mensagem de erro clara é exibida.

---

### User Story 7 - Ag Pay com cartão e Pix funcionando para assinatura (30 dias) (Priority: P2)

O pagamento da assinatura (ciclo de 30 dias) deve funcionar pelo Ag Pay, com **cartão e Pix** ambos configurados e operando corretamente (confirmado pelo cliente — áudio 2 + ressalva do usuário).

**Why this priority**: Pedido do cliente; é o fluxo de cobrança da plataforma — precisa estar redondo nos dois meios de pagamento.

**Independent Test**: Executar o pagamento da assinatura (30 dias) por cartão e por Pix e confirmar, em cada caso, que a cobrança é criada, processada e o acesso do dono é renovado.

**Acceptance Scenarios**:

1. **Given** uma assinatura a vencer/renovar (30 dias), **When** o dono paga por **Pix**, **Then** a cobrança é processada pelo Ag Pay e a assinatura é renovada.
2. **Given** a mesma situação, **When** o dono paga por **cartão**, **Then** a cobrança é processada pelo Ag Pay e a assinatura é renovada.
3. **Given** uma falha/recusa no pagamento (cartão ou Pix), **When** ocorre, **Then** o dono recebe retorno claro e a assinatura não é renovada indevidamente.

> **Status (2026-11-06, atualizado)**: **Pix** via AgPay (`/payments/pix`) implementado agora; ciclo de 30 dias controlado pelo nosso backend (sem recorrência nativa). **Cartão agora é VIÁVEL via VeoPag** — a adquirente por trás do AgPay — usando `POST /api/cashin` (`payment_method:"credit_card"`) com checkout hospedado e parcelamento. Depende de obter **credenciais VeoPag** e confirmar o nome (VenoPag/VeoPag). Não bloqueia mais; vira integração de um segundo fluxo de pagamento (redirect).

---

### User Story 8 - Todas as telas do frontend do cliente têm backend funcional (Priority: P2)

Cada tela do frontend entregue pelo cliente deve ter o backend correspondente funcionando (religando o que a versão do cliente perdeu da referência: endurecimento, telas de carteira/pagamento, lifecycle, SDR, etc.), revisando o que já está feito para não refazer. **Escopo desta entrega: painel do dono E painel Master**, ambos nesta rodada.

**Why this priority**: É o objetivo central ("deixar o backend tudo certinho"); depende de revisão item a item.

**Independent Test**: Para cada tela do painel/master, exercitar a ação principal e confirmar que lê/grava dados reais sem erro.

**Acceptance Scenarios**:

1. **Given** uma tela do frontend do cliente, **When** o dono/master executa a ação principal, **Then** a operação completa com dados reais (sem placeholder/erro).
2. **Given** uma funcionalidade já presente na referência, **When** revisada, **Then** é reaproveitada em vez de reimplementada.

### User Story 9 - Revisão do split de pagamentos (DB + backend) (Priority: P2)

Revisar como o valor de uma cobrança é dividido entre plataforma (comissão + taxa fixa), taxa do gateway e estabelecimento, confrontando o modelo atual (split interno no ledger) com o split nativo do AgPay, e alinhar banco de dados e backend à decisão.

**Why this priority**: Pedido do responsável após ler a doc do AgPay; mexe no núcleo financeiro (ledger/wallets) — precisa estar correto e auditável antes de ampliar cobranças (US7).

**Independent Test**: Produzir o parecer comparativo (ledger interno × split nativo AgPay), auditar os cálculos e as tabelas `ledger_entries`/`wallets`, e validar que uma cobrança real é dividida exatamente conforme a regra decidida.

**Acceptance Scenarios**:

1. **Given** uma cobrança paga, **When** o split é aplicado, **Then** os valores de comissão da plataforma, taxa do gateway e líquido do estabelecimento batem com a regra configurada e com o razão (ledger).
2. **Given** o modelo atual e o split nativo do AgPay, **When** comparados, **Then** existe uma decisão registrada (manter ledger interno / migrar / híbrido) com justificativa.
3. **Given** a decisão, **When** aplicada, **Then** DB e backend ficam consistentes (sem cálculo duplicado nem divergência entre o que o AgPay credita e o que o ledger registra).

### Edge Cases

- Nicho cujo identificador no frontend não casa com a pasta de artes (acento/maiúsculas) — artes não devem sumir por nomenclatura.
- Ambiente publicado sem os arquivos de artes — o conteúdo precisa ir no artefato publicado.
- Imagem de celular (HEIC/HEIF) e imagens muito grandes — converter/ajustar, não recusar.
- Arquivo com extensão de imagem mas conteúdo inválido — recusar com mensagem clara, sem travar.
- Vários avisos distintos em sequência — controle de "visto" por aviso, não global.
- Troca de usuário/estabelecimento na mesma sessão — estado de "aviso visto" e contexto não devem vazar entre contas.
- Resquícios de "Carteira" em lugares menos óbvios (tooltips, títulos de página, rotas) durante o rebrand.
- Pagamento de assinatura/cartão quando o Ag Pay está indisponível — tratar erro sem deixar o dono em estado ambíguo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exibir as artes (prontas e fotos de serviço) de cada nicho que possua esse conteúdo na referência, incluindo os arquivos no artefato publicado.
- **FR-002**: O sistema MUST exibir o estado vazio de um nicho apenas quando ele realmente não tiver artes.
- **FR-003**: Ao navegar pela barra lateral, o sistema MUST reaproveitar o contexto do estabelecimento já carregado, sem recarregá-lo do zero a cada clique; dados estáveis MAY ser persistidos no armazenamento local do navegador para acelerar o carregamento entre telas e sessões.
- **FR-004**: O sistema MUST exibir um aviso de uso único no máximo uma vez por usuário/sessão, sem reexibi-lo ao trocar de aba ou navegar; o controle MUST ser por aviso individual. A persistência do estado "visto" pode ser **local ao navegador** (localStorage) — aceita-se que limpar o navegador ou usar outro dispositivo reexiba o aviso uma vez.
- **FR-005**: Usuários MUST conseguir enviar a imagem de um serviço em formatos de imagem amplamente usados, incluindo os de celular.
- **FR-006**: Quando o formato enviado não for diretamente exibível, o sistema MUST convertê-lo para um formato suportado em vez de recusar.
- **FR-007**: O sistema MUST recusar, com mensagem clara, apenas arquivos que não sejam imagens válidas; e MUST comunicar o limite de tamanho (e/ou reduzir conforme a regra).
- **FR-008**: O sistema MUST exibir a área de pagamento como "Ag Pay" (não "Carteira") em **qualquer tela onde apareça** — painel do dono (barra lateral, topo, Negócios/Recebíveis, telas de pagamento) **e** telas vistas pelo cliente final (ex.: pagamento do sinal no agendamento público).
- **FR-009**: O sistema MUST permitir o envio de uma mensagem de teste do WhatsApp na tela de Integrações, informando sucesso ou erro.
- **FR-010**: O sistema MUST processar o pagamento de assinatura (ciclo de 30 dias) através do Ag Pay, usando o **valor/plano de assinatura já configurado no sistema** (não hard-codar novo), com **Pix** funcionando agora e **cartão** via VeoPag quando a credencial existir, tratando falha/recusa com retorno claro.
- **FR-011**: Cada tela do frontend entregue pelo cliente MUST ter o backend correspondente funcional, reaproveitando as funcionalidades já existentes na referência.
- **FR-012**: As correções e integrações MUST NOT introduzir novas regressões em funcionalidades que já operam.
- **FR-013**: Cada item entregue MUST ser coberto por testes automatizados (unidade/integração conforme aplicável) além de verificação manual nas telas afetadas.
- **FR-014**: O split de pagamento (comissão da plataforma + taxa do gateway + líquido do estabelecimento) MUST ser revisado e consistente entre o que o provedor credita e o que o razão (ledger) registra, sem cálculo duplicado; a escolha entre split interno (ledger) e split nativo do AgPay MUST ser decidida e documentada.

### Key Entities *(include if feature involves data)*

- **Arte de divulgação (template/foto de serviço)**: conteúdo visual por nicho; tipos arte pronta e foto de serviço; título e imagem.
- **Nicho**: categoria de negócio que agrupa artes e é escolhida pelo dono.
- **Imagem de serviço**: imagem associada a um serviço; sujeita a regras de formato/tamanho.
- **Aviso/Notificação**: comunicado ao dono; possui identidade própria e estado de "visto" por usuário/sessão.
- **Contexto do estabelecimento**: dados do negócio carregados uma vez e compartilhados entre as telas do painel.
- **Ag Pay (gateway de pagamento)**: processa sinais, assinatura (30 dias) e cartão; marca exibida no painel.
- **Assinatura**: ciclo de cobrança (30 dias) do dono junto à plataforma.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos nichos com artes na referência passam a exibi-las; estado vazio só em nichos sem conteúdo.
- **SC-002**: Navegar entre telas da sidebar não exibe "Carregando estabelecimento..." após o primeiro carregamento; troca de tela é imediata.
- **SC-003**: Um aviso de uso único é exibido no máximo uma vez e não reaparece em nenhuma tela durante a sessão.
- **SC-004**: Todo formato de imagem comum testado (incl. celular) é aceito ou convertido; apenas não-imagens são recusadas, sempre com mensagem clara.
- **SC-005**: Nenhuma ocorrência de "Carteira" permanece na interface do dono; a área aparece como "Ag Pay".
- **SC-006**: O envio de teste do WhatsApp funciona em Integrações (sucesso e erro tratados).
- **SC-007**: Pagamento de assinatura (30 dias) por cartão e por Pix são processados pelo Ag Pay, renovando o acesso; falhas retornam erro claro sem renovar indevidamente.
- **SC-008**: Todas as telas do frontend do cliente executam sua ação principal com dados reais, sem erro.
- **SC-009**: As entregas são acompanhadas de testes automatizados verdes e não introduzem regressões.
- **SC-010**: Para toda cobrança paga, a soma (comissão plataforma + taxa gateway + líquido estabelecimento) = valor bruto, e os lançamentos do ledger conferem com o crédito do provedor; a decisão sobre o modelo de split está documentada.

## Assumptions

- O resultado final usa o **frontend do cliente** (visual "Ag Pay" e decisões dele) casado com o **backend da versão de referência** (`felps-debug/agenda-agora`, o ambiente onde trabalhamos). A varredura comparativa entre as duas versões é pré-trabalho já iniciado (fora do escopo da spec).
- Parte do backend provavelmente já está pronta na referência; o trabalho inclui **revisar antes de reimplementar**.
- Os assets das artes estão disponíveis no backup/referência e podem ser restaurados sem recriação.
- "Formatos amplamente usados" inclui ao menos PNG, JPEG, WebP (já suportados) + HEIC/HEIF (via conversão); limite atual de 5 MB mantido salvo decisão em contrário.
- O gateway de pagamento é o Ag Pay (AgPay, Pix) já integrado; o **cartão** sai pela VeoPag (adquirente) e está **adiado** até haver credencial VeoPag. O **valor da assinatura (30 dias) já está configurado no sistema** e deve ser reusado (localizar o plano/valor existente, não criar novo).
- As ressalvas explícitas são: reativar o teste do WhatsApp (US6) e o rebrand Ag Pay (US5); demais decisões de frontend do cliente são preservadas.
- **Autorização ampla no backend**: o responsável autoriza corrigir/alterar o backend da referência livremente onde estiver faltando ou errado (foi exatamente o que o cliente contratou — implementar o backend do frontend dele).
- O ponto "animação no github / tem o prompt" (mensagem do cliente) é interpretado como carregamento/animação das telas; a decisão é **usar o armazenamento local do navegador (localStorage) para carregar mais rápido** (ver FR-003/US2), sem depender de recarregar tudo do zero.

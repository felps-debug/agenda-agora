# Feature Specification: Correção de regressões do cliente + rede de QA

**Feature Branch**: `002-correcao-regressoes-qa`

**Created**: 2026-11-08

**Status**: Implementada e validada

**Input**: User description: feedback do cliente (dono de estabelecimento) após deploy na VPS, investigado reproduzindo o app com automação (Playwright) nas contas de dono e master. Escopo dividido em CORRIGIR, PREVENIR e FORA DE ESCOPO.

## Clarifications

### Session 2026-11-08

- Q: Onde a suíte de QA e o seed realista rodam, dado que o dev aponta para o banco de produção? → A: Pode usar dados reais (projeto/banco de produção). Sem ambiente isolado. As escritas/seed ficam restritas a negócios de teste dedicados (ex.: "Teste sdr"); a suíte não altera/destrói os dados reais do cliente.
- Q: Como resolver a divergência do PIN de suporte (cliente usa 41410070; VPS tem 42299893/46888682)? → A: Trocar a env da VPS para `41410070` (valor que a equipe já usa), mantendo env-only. Padrão: ajustar ambos os PINs (acesso e retorno) para `41410070`, salvo indicação de mantê-los distintos.
- Q: Ao editar a senha do estabelecimento pelo lápis, definir senha digitada ou gerar temporária? → A: Definir senha específica digitada pela equipe, com validação de força mínima e registro de auditoria da alteração.
- Q: Como o monitoramento de erro em produção deve capturar e entregar os erros? → A: Solução própria no Supabase — registrar erros de interface e requisições falhas numa tabela, com um painel simples para a equipe consultar.
- Q: Aviso de cobrança no mesmo estágio por vários dias — reaparece a cada dia ou fica dispensado até mudar o estágio? → A: Reaparece uma vez por novo dia (a dispensa vale apenas para o dia corrente); não espama dentro do mesmo dia.
- Q: Qual a regra concreta de "força mínima" da senha editada na ficha (US4)? → A: No mínimo 8 caracteres, com ao menos uma letra e ao menos um número; senhas que não atendam são rejeitadas com mensagem clara.
- Q: Qual o negócio de teste dedicado usado pelo seed/QA? → A: O estabelecimento de teste "Teste sdr" (slug público `teste-sdr-g1jw`); as escritas do seed/QA ficam restritas a ele.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Avisos não "espamam" nem reaparecem depois de fechados (Priority: P1)

O dono do estabelecimento fecha um aviso automático (ex.: aviso de vencimento da assinatura) e ele **não volta a aparecer** enquanto navega ou recarrega a página, até que a situação mude (novo estágio de cobrança ou novo dia). Hoje, apenas o aviso de notificação do admin (broadcast) "lembra" que foi fechado; o aviso de cobrança reaparece a cada recarga de página, dando a sensação de spam.

**Why this priority**: É a reclamação mais alta e repetida do cliente (aparece em 2 vídeos). Afeta a percepção de qualidade a cada uso.

**Independent Test**: Entrar com uma conta cujo plano esteja vencido, fechar o aviso de cobrança, navegar entre telas e recarregar a página — o aviso não deve reaparecer no mesmo dia/estágio.

**Acceptance Scenarios**:

1. **Given** um dono com aviso de cobrança visível, **When** ele fecha o aviso no "X", **Then** o aviso some e não reaparece ao navegar entre telas.
2. **Given** o aviso de cobrança já foi fechado, **When** o dono recarrega a página (F5), **Then** o aviso continua sem aparecer (até mudar o estágio ou o dia).
3. **Given** qualquer tipo de aviso automático (cobrança, broadcast, teste/trial), **When** o dono o fecha, **Then** o comportamento de "não reaparecer" é idêntico para todos os tipos.

---

### User Story 2 - Suporte entra no Painel 2 do estabelecimento e volta ao Painel 3 com segurança (Priority: P1)

A equipe (no Painel 3 / master) abre a ficha de um estabelecimento, clica em "Abrir Painel 2" e entra na conta do dono em modo suporte, sem fazer logout/login. Um indicador de sessão de suporte fica visível e permite voltar ao Painel 3 digitando o PIN de retorno correto. O acesso precisa ser rápido (sem travar vários segundos numa tela de carregamento).

**Why this priority**: A equipe cria/configura vários estabelecimentos por dia; sem isso, precisa sair e entrar de conta o tempo todo. Hoje o recurso falha em produção por configuração de ambiente e por confusão de PIN.

**Independent Test**: No Painel 3, abrir a ficha de um estabelecimento, clicar "Abrir Painel 2", confirmar que entra na conta em modo suporte, e voltar ao Painel 3 com o PIN de retorno correto.

**Acceptance Scenarios**:

1. **Given** um membro da equipe no Painel 3, **When** clica "Abrir Painel 2" na ficha de um estabelecimento, **Then** entra na conta do dono em modo suporte em poucos segundos, com indicador de suporte visível.
2. **Given** a sessão de suporte ativa no Painel 2, **When** o membro aciona "Voltar ao Painel Master" e digita o PIN de retorno correto, **Then** retorna ao Painel 3.
3. **Given** a origem de acesso não autorizada ou PIN incorreto, **When** a ação é tentada, **Then** o sistema recusa com mensagem clara, sem deixar a pessoa presa numa tela de carregamento.

---

### User Story 3 - Navegar entre telas é instantâneo e não "recarrega tudo" (Priority: P2)

Ao clicar nas opções da barra lateral, a tela nova abre rapidamente sem reexibir uma tela de "Carregando" nem refazer a busca de dados já carregados recentemente. Imagens e cartões não "piscam" a cada navegação.

**Why this priority**: É a causa-mãe percebida por trás de várias reclamações ("recarrega o banco de dados tudo de novo", "foto piscando", "lentidão"). Resolver melhora múltiplos sintomas de uma vez.

**Independent Test**: Navegar repetidamente entre telas do painel com dados já carregados e verificar que não aparece a tela de carregamento intermediária nem recarregamento visível de imagens.

**Acceptance Scenarios**:

1. **Given** um dono que já abriu uma tela recentemente, **When** navega para outra e volta, **Then** a tela reabre sem exibir o esqueleto de "Carregando" e sem refazer a busca completa.
2. **Given** imagens já carregadas, **When** o dono navega entre telas, **Then** as imagens permanecem exibidas sem piscar/recarregar.

---

### User Story 4 - Equipe edita os dados de login do estabelecimento direto pela ficha (Priority: P2)

Na ficha do estabelecimento (Painel 3), a equipe pode editar, pelo ícone de lápis, os campos: telefone de login, senha, nome do estabelecimento e nome do responsável, salvando a alteração ali mesmo.

**Why this priority**: É um pedido explícito do cliente e agiliza o suporte/correção de cadastro.

**Independent Test**: Abrir a ficha de um estabelecimento, editar cada um dos quatro campos pelo lápis, salvar e confirmar que os valores persistem.

**Acceptance Scenarios**:

1. **Given** a ficha de um estabelecimento aberta, **When** a equipe clica no lápis ao lado de um campo editável, **Then** o campo entra em modo de edição.
2. **Given** um campo editado, **When** a equipe salva, **Then** o novo valor é persistido e exibido.

---

### User Story 5 - Ajustes de interface e correções pontuais (Priority: P3)

O botão de pagar assinatura aparece dentro do card/pop-up da assinatura (não solto na tela). Páginas sem título principal passam a ter título, e avisos técnicos de desenvolvimento (lista sem chave única) são eliminados.

**Why this priority**: Polimento; impacto menor, mas elimina atritos visuais e ruído técnico.

**Independent Test**: Verificar que o botão de pagar está dentro do card da assinatura, que a página de Serviços tem título, e que não há avisos de "key" no console na página de Funcionamento.

**Acceptance Scenarios**:

1. **Given** a tela de assinatura, **When** o dono visualiza o card do plano, **Then** o botão de pagar está dentro do card/pop-up.
2. **Given** a página de Funcionamento, **When** carregada, **Then** não há aviso técnico de item de lista sem chave.

---

### User Story 6 - Rede de QA evita que o cliente ache bugs novos (Priority: P2)

Antes de cada entrega, uma verificação automatizada percorre as telas principais (dono, master e públicas), reproduz os fluxos críticos (avisos, suporte/impersonação, agendamento público) e falha se encontrar erros de console, imagens quebradas, textos inválidos (ex.: "NaN", "undefined", data inválida) ou regressões nos comportamentos corrigidos. Um conjunto de dados de teste realista (serviços com foto, agendamentos, estágios de cobrança) alimenta esses testes. A configuração de produção é validada no boot, e erros em produção são reportados para a equipe.

**Why this priority**: É o que impede o ciclo "corrige → cliente acha outro bug". Cobre o ponto cego de testar com dados vazios e de bugs que só existem em produção.

**Independent Test**: Rodar a verificação de QA e confirmar que ela detecta uma regressão proposital (ex.: reintroduzir o aviso que reaparece) e que o boot recusa/avisa quando uma configuração obrigatória está ausente.

**Acceptance Scenarios**:

1. **Given** uma regressão introduzida de propósito, **When** a verificação de QA roda, **Then** ela falha apontando o problema.
2. **Given** uma configuração de produção obrigatória ausente, **When** a aplicação inicia, **Then** o sistema avisa/recusa de forma visível.
3. **Given** um erro ocorrendo em produção, **When** ele acontece, **Then** a equipe recebe o registro do erro sem depender do cliente reportar.

---

### Edge Cases

- Armazenamento local indisponível (navegação privada/quota): a dispensa do aviso não deve quebrar a aplicação; comportamento degrada com segurança (o aviso pode reaparecer, mas nada trava).
- Virada de dia / mudança de estágio de cobrança: um aviso previamente dispensado **deve** reaparecer quando a situação realmente muda.
- Sessão de suporte expirada ou PIN digitado errado várias vezes: a sessão é encerrada por segurança e a equipe é informada.
- Estabelecimento sem serviços ou sem foto: telas públicas e de serviços mostram estado vazio gracioso, sem erro.
- Perda de conexão durante navegação: exibir carregamento somente quando realmente há busca pendente, não em dados já em cache.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST persistir a dispensa de **todos** os tipos de aviso automático (cobrança, broadcast, teste/trial) por identificador/estágio/dia, de forma que um aviso fechado não reapareça em navegação nem em recarga de página até a situação mudar.
- **FR-002**: O sistema MUST reexibir um aviso previamente dispensado quando o estágio/situação que o originou mudar (ex.: "vence amanhã" → "venceu hoje") ou em um novo dia, conforme a regra de cada aviso.
- **FR-003**: A equipe MUST conseguir, a partir da ficha de um estabelecimento no Painel 3, entrar no Painel 2 do estabelecimento em modo suporte sem efetuar logout/login.
- **FR-004**: Durante a sessão de suporte, o sistema MUST exibir um indicador visível e permitir retornar ao Painel 3 mediante o PIN de retorno correto.
- **FR-005**: O sistema MUST validar a origem de acesso e o PIN no fluxo de suporte, recusando com mensagem clara quando inválidos, sem deixar o usuário preso em tela de carregamento.
- **FR-006**: A entrada no Painel 2 em modo suporte MUST concluir rapidamente (ver SC-004), sem exibir uma tela de carregamento prolongada.
- **FR-007**: A navegação entre telas já visitadas recentemente MUST NOT reexibir a tela intermediária de carregamento nem refazer a busca completa de dados ainda "frescos".
- **FR-008**: Imagens já carregadas MUST permanecer exibidas durante a navegação, sem recarregar/piscar.
- **FR-009**: A equipe MUST conseguir editar, pela ficha do estabelecimento, os campos telefone de login, senha, nome do estabelecimento e nome do responsável, com persistência da alteração. Para o campo **senha**, a equipe define uma senha digitada (não gera temporária), sujeita a **validação de força mínima — no mínimo 8 caracteres, contendo ao menos uma letra e ao menos um número** (senhas que não atendam são rejeitadas com mensagem clara), e a alteração MUST ser registrada em auditoria (quem alterou e quando).
- **FR-010**: O botão de pagamento da assinatura MUST ser exibido dentro do card/pop-up da assinatura.
- **FR-011**: As páginas principais MUST ter um título principal e não emitir avisos técnicos de lista sem chave única.
- **FR-012**: Uma verificação de QA automatizada MUST percorrer as telas de dono, master e públicas e falhar ao detectar erros de console, imagens quebradas ou textos inválidos ("NaN", "undefined", data inválida).
- **FR-013**: A verificação de QA MUST exercitar os fluxos corrigidos (persistência de avisos, suporte/impersonação, agendamento público) e falhar em caso de regressão.
- **FR-014**: MUST existir um conjunto de dados de teste realista (serviços com foto, agendamentos, os estágios de cobrança) utilizável pelos testes.
- **FR-015**: Na inicialização, o sistema MUST validar as configurações obrigatórias de produção (origens de acesso permitidas e PINs de segurança/retorno definidos) e avisar/recusar de forma visível quando ausentes ou inconsistentes.
- **FR-016**: Erros ocorridos em produção (falhas de interface e requisições com erro) MUST ser registrados em uma tabela no Supabase e acessíveis à equipe por um painel simples de consulta, sem depender de o cliente reportar.
- **FR-017**: As configurações de PIN de produção (acesso e retorno) MUST ser ajustadas na VPS para o valor que a equipe utiliza (`41410070`), mantidas como configuração de ambiente (não alteráveis pela interface). A documentação operacional MUST registrar esse valor e o fato de ser env-only. Por padrão ambos os PINs assumem `41410070`, salvo decisão explícita de mantê-los distintos.

### Key Entities *(include if feature involves data)*

- **Aviso automático**: Mensagem exibida ao dono por uma condição do sistema (cobrança por estágio, broadcast do admin, teste/trial). Atributos relevantes: tipo, identificador/estágio, momento de criação, estado de dispensa (persistido por dispositivo).
- **Sessão de suporte (impersonação)**: Vínculo temporário entre um membro master e um estabelecimento, permitindo acesso ao Painel 2 e retorno controlado por PIN. Atributos: estabelecimento, membro, validade, tentativas de retorno.
- **Ficha do estabelecimento**: Visão do Painel 3 com dados do estabelecimento, incluindo campos editáveis (telefone de login, senha, nome do estabelecimento, nome do responsável).
- **Configuração de produção**: Conjunto de parâmetros obrigatórios (origens permitidas, PINs) validados no boot.
- **Registro de erro de produção**: Evento capturado em produção (erro de interface ou requisição falha) disponibilizado à equipe.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos tipos de aviso automático permanecem dispensados após navegação e recarga de página, até mudança de estágio/dia (verificado por teste automatizado).
- **SC-002**: A equipe consegue entrar no Painel 2 em modo suporte e retornar ao Painel 3 em 100% das tentativas com PIN correto, sem logout/login manual.
- **SC-003**: A navegação entre telas já visitadas não exibe a tela intermediária de carregamento em nenhuma das telas principais (verificado por teste automatizado).
- **SC-004**: A entrada no Painel 2 em modo suporte conclui em até 3 segundos em condições normais.
- **SC-005**: Os quatro campos da ficha (telefone de login, senha, nome do estabelecimento, nome do responsável) são editáveis e persistem em 100% dos casos testados.
- **SC-006**: A verificação de QA detecta uma regressão proposital em cada fluxo corrigido (taxa de detecção de 100% nos cenários cobertos).
- **SC-007**: O boot recusa/avisa em 100% dos casos em que uma configuração obrigatória de produção está ausente ou inconsistente.
- **SC-008**: Redução significativa de bugs reportados pelo cliente após a entrega (meta: nenhum bug novo nas telas e fluxos cobertos pela rede de QA).

## Assumptions

- A validação de produção confirmou os três hosts ativos: `app.agendagora.company`, `painel.agendagora.company` e `admin.agendagora.company`. A sessão de suporte permanece na origem em que foi iniciada, inclusive durante navegação, F5 e retorno ao Master.
- O estado de dispensa de avisos é por dispositivo/navegador (armazenamento local), coerente com o comportamento já existente do aviso de broadcast.
- Os PINs de segurança e de retorno são configuração de ambiente e não são alteráveis pela interface; alinhar com a equipe os valores vigentes.
- A verificação de QA roda contra o projeto/banco **real** (não há ambiente isolado separado). As operações de escrita (seed realista) ficam restritas a **negócios de teste dedicados** (ex.: "Teste sdr"); a suíte é **não-destrutiva** para os dados reais do cliente (leitura livre, nunca alterar/apagar registros reais).
- O bug de "foto do serviço não carrega/pisca" NÃO reproduz em desenvolvimento, nem com os dados reais do cliente, e por isso fica **fora de escopo** de correção direta nesta feature; será investigado com base em evidência de produção capturada pelo monitoramento (FR-016) antes de qualquer mudança.

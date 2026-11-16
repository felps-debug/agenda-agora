# Segurança e infraestrutura — triagem estática

## Controles observados

- Server auth exige Bearer JWT de formato esperado e valida claims via Supabase (`src/integrations/supabase/auth-middleware.ts`).
- Master valida `super_admin` diretamente em `user_roles` e não confia no papel informado pelo cliente/JWT (`src/lib/auth/require-super-admin.ts`).
- Rotas do painel restringem navegação, e funções servidor também têm middleware; a lista completa ainda está sendo revisada.
- `AGPAY_API_TOKEN` e credencial service role são carregadas por módulo server-only; não foi lido `.env` e nenhuma credencial foi reproduzida nos relatórios.
- Migration de hardening aplica RLS/revoga acessos de tabelas internas, restringe update de campos de controle de negócios e limita execute de várias RPCs privilegiadas a service role (`20261103000000_security_hardening.sql`).

### Revisão dos sinks HTML encontrados — sem XSS confirmado nesta amostra

- Busca estática localizou quatro usos de `dangerouslySetInnerHTML`: previews de WhatsApp em `painel.lembretes.tsx:410` e `painel.configuracoes.tsx:1079`, script inline de tema em `__root.tsx:143` e stylesheet dinâmico em `components/ui/chart.tsx:73`.
- Os dois previews passam texto por `escapeHtml`, que codifica `&`, `<` e `>` antes de converter quebras de linha e, no preview de lembretes, aplicar apenas tags de formatação (`strong`, `em`, `s`). O template de pós-atendimento também passa por esse escape antes da conversão de newline. Não foi identificado caminho de markup bruto nesses dois sinks.
- O script do tema contém somente código literal e aceita dois valores enumerados de `localStorage`; não concatena o valor armazenado ao HTML/script. A busca de uso de `ChartContainer` não encontrou consumidor em `src` fora do próprio componente, então o stylesheet dinâmico não está ativo em uma jornada identificada nesta versão. O componente aceita cores/keys arbitrárias em seu contrato, o que merece revisão se for introduzido em tela com configuração controlável por usuário.
- **Resultado:** nenhum XSS foi confirmado nesses sinks locais. Isso não equivale a revisão completa de todos os fluxos de saída, dependências ou HTML produzido fora da busca efetuada.
- **Limitação:** não foram executados payloads no navegador nem testadas jornadas em runtime; conclusão baseada no fluxo de dados e escaping estáticos encontrados.

### Sessão Supabase no navegador e autorização server-side — revisão estática

- O cliente de navegador persiste sessão e habilita renovação automática (`src/integrations/supabase/client.ts:32`). O middleware cliente lê o access token da sessão Supabase e o encaminha como Bearer para Server Functions (`src/integrations/supabase/auth-attacher.ts:14-28`); o token fica sob a persistência padrão do `supabase-js` no armazenamento do navegador.
- O middleware de função exige Bearer JWT, valida claims com `supabase.auth.getClaims`, rejeita token sem `sub` e entrega cliente Supabase vinculado ao token (`src/integrations/supabase/auth-middleware.ts:34-102`). Não usa o perfil fornecido pelo browser como identidade verificada. O cliente admin/service role está em módulo server-side separado e documentado para uso exclusivo no servidor (`client.server.ts:1-3`).
- O layout `/_authenticated` faz o bloqueio/redirect no cliente (`src/routes/_authenticated/route.tsx:6-34`), portanto não serve por si só como fronteira de segurança; a proteção efetiva de cada chamada depende do middleware de função e das policies/checagens de autorização do handler, já auditadas por amostra e ainda pendentes para cobertura completa. Conteúdo HTML autenticado pode ser renderizado antes da navegação/redirect dependendo da SSR, sem que isso conceda acesso a funções protegidas.
- **Resultado:** nenhum bypass de sessão foi confirmado pela leitura dos pontos comuns. Persistência no armazenamento do browser aumenta o impacto potencial de XSS, mas não foi classificada como defeito isolado sem evidência de XSS explorável. Não foi possível verificar configuração remota de sessão, validade/rotação em produção, CSP ou comportamento do host implantado.

### Login owner/profissional, PIN Master e recuperação — reconciliação de cobertura

- Login owner/profissional aceita a senha legada `agendaagora:<PIN de 4 dígitos>` como fallback para credenciais digitadas (`src/routes/auth.tsx:114-127`; regra documentada em `src/lib/password-strength.ts:12-20`). A tela limita o PIN legado a quatro dígitos e a verificação final de credenciais ocorre no Supabase Auth. Não foi localizado rate limit da aplicação nesse handler; o controle de tentativas e configurações de Auth do projeto implantado são externos e seguem sem evidência por indisponibilidade do projeto correto.
- A recuperação Master não revela senha existente: `resetOwnerPassword` gera credencial temporária aleatória e registra evento antes da chamada Auth; `setOwnerPassword` valida PIN legado e registra a ação sem salvar o valor (`src/lib/reset-password.functions.ts:9-52`). A senha temporária pode permanecer no estado de UI ao fechar/trocar ficha, já documentado em SEC-022.
- O PIN Master de segurança exige 6–12 dígitos, verifica com comparação de tempo constante e usa lock persistido (`auth_attempts`/RPC), cinco falhas em 15 min e bloqueio de 30 min (`src/lib/security-pin.functions.ts:8-34`; migration `20261103000000_security_hardening.sql:6-53`). O erro de `checkLock`/registro falha fechado. SEC-004, sobre o PIN de saque do owner, também aplica lockout persistente por usuário/negócio; a limitação de IP depende da origem confiável registrada em SEC-018.
- **Resultado:** não há evidência local suficiente para afirmar bypass do Supabase Auth ou ausência de limite efetivo no login owner; a proteção do provedor precisa ser verificada no projeto e versão corretos. A aceitação de credencial legada de quatro dígitos é confirmada e deve permanecer como risco de autenticação condicionado à configuração do Auth, sem duplicar SEC-004.

### Revisão CSRF das Server Functions — sem achado local nesta rodada

- `src/start.ts` registra explicitamente `createCsrfMiddleware` no `requestMiddleware` global e filtra `ctx.handlerType === "serverFn"`. A observação do pacote instalado (`node_modules/@tanstack/start-client-core/src/createCsrfMiddleware.ts`) mostra a ordem de decisão: se houver `Sec-Fetch-Site`, compara com `same-origin`; caso contrário valida `Origin` contra a origem da URL da requisição; como fallback, valida `Referer`; sem nenhum desses sinais, o padrão `allowRequestsWithoutOriginCheck` é `false` e a requisição não passa.
- A fonte instalada de `start-server-core` confirma que, quando há `startInstance`, o handler usa `startOptions.requestMiddleware` informado pela aplicação em lugar do middleware default implícito. Portanto, o registro explícito em `src/start.ts` é necessário e foi encontrado.
- Server Functions com `requireSupabaseAuth` ainda exigem Bearer JWT no middleware da função (`src/integrations/supabase/auth-middleware.ts`); CSRF não foi tratado como substituto de autorização.
- **Resultado:** não foi identificado caminho de bypass nesta revisão estática da configuração local. Nenhuma solicitação foi enviada ou falsificada.
- **Limitação:** versão efetivamente implantada, comportamento do proxy/CDN, host/origin vistos em runtime e eventual customização do handler de produção não foram validados. Ausência de achado local não prova proteção operacional em produção.

## Riscos suspeitos

### SEC-001 — Rate limiting de endpoints públicos é volátil e por processo

- **Status:** propriedade confirmada do código; exposição operacional depende da topologia atual.
- **Gravidade:** P2 se houver múltiplas réplicas ou reinícios frequentes; P3 no serviço único estável documentado.
- `src/lib/rate-limit.server.ts:3-10,15,23,101-129` guarda buckets em memória; restart zera cota e múltiplos processos não compartilham limite. O comentário assume uma instância. Topologia atual não foi verificada.
- Impacto possível: abuso distribuído de reservas, status e geração de Pix; controles de gateway/idempotência ainda limitam duplicidade financeira.
- Validar topologia e cabeçalhos de IP confiáveis antes de classificar como defeito ativo.

### SEC-002 — Configuração, logs e advisors do Supabase de produção não foram acessíveis

- **Status:** limitação/inconclusivo.
- **Gravidade:** P1 para cobertura da auditoria, sem atribuir vulnerabilidade.
- Sem leitura de project ref `qagot`, não foram verificados advisors, policies efetivamente aplicadas, secrets configurados, auth settings, backups, logs ou estado de migrations.

## Pendente

- Checagem completa de segredo em código/histórico (sem imprimir valores), variáveis permitidas e bundle client compilado. A revisão estática local abaixo cobre apenas referências de ambiente no source e regras do Docker.
- Revisão parcial de origem/CSRF, sessão browser, reset de senha/PIN, MFA, impersonação e rate limits; CORS explícito não aparece nas rotas verificadas. Deploy e headers de runtime seguem sem validação.
- Verificar deploy ativo, TLS/proxy, firewall, backups/restauração, retenção de logs, dependências e CVEs com método que não altere lockfiles.
- Confirmar no remoto as policies e objetos Storage, sobretudo paths visuais e credenciais legadas; a revisão estática local foi registrada em SEC-013.
- Revisar uso direto das RPCs de role: `has_role(user_id, role)` é concedida a authenticated e retorna boolean para o UUID fornecido; não se confirmou se IDs alheios podem ser obtidos por outra superfície nem foi demonstrada escalada de privilégio.
- Nenhum teste intrusivo ou alteração de produção foi executado.

### Source e contexto Docker de variáveis — revisão estática, sem achado confirmado

- No source client, `import.meta.env` é usado para `PROD`, `VITE_SPLIT_PANELS` e configuração pública Supabase. `vite.config.ts` define somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; o Dockerfile recebe essas duas variáveis públicas e `VITE_SPLIT_PANELS` como build args. Nenhuma chave service role, AgPay, cron, WhatsApp, SDR ou PIN é referenciada com `import.meta.env`.
- Segredos observados (`SUPABASE_SERVICE_ROLE_KEY`, `AGPAY_API_TOKEN`, segredos de cron/WhatsApp/SDR e PINs) aparecem em módulos server-side e são lidos via `process.env`. `.dockerignore` exclui `.env`/`.env.*` e arquivos locais; a imagem runtime copia somente `.output` do estágio de build. `.env.example` contém placeholders e é explicitamente incluído.
- **Resultado:** configuração local não mostra injeção de segredos privados em define público nem inclusão de `.env` no contexto Docker. Não foram lidos valores de ambiente nem construído/inspecionado um bundle nesta rodada; dependências/plugins, source maps publicados, histórico Git e imagem realmente publicada seguem fora da comprovação.

### Triagem de funções `SECURITY DEFINER`

Varredura da chain local encontrou 10 definições distintas de função `SECURITY DEFINER`; todas fixam `search_path` (`public` ou schema qualified conforme a rotina). Helpers de membership/role têm execução concedida a `authenticated` conforme necessário; rotinas de escrita financeira e workers revogam `EXECUTE` de PUBLIC/anon/authenticated e concedem a `service_role`. Os parsers de path do Storage também fixam `search_path = ''`, mas são funções `SECURITY INVOKER`, não entram na contagem. `replace_professional_services` é `SECURITY INVOKER`, usa `owns_business`, valida que profissional/serviços pertencem ao business e é executável apenas por authenticated, conforme `20260924070503_professional_links_atomic.sql:9-72`. Esta triagem não verifica o catálogo efetivo remoto.

**Limite de autorização observado:** `has_role(_user_id, _role)` é SECURITY DEFINER e executável por authenticated; recebe UUID arbitrário e retorna boolean (`20260907045316_856b1ad9-ac27-4eca-a1de-d2ebce788209.sql:20-35`, ACL em `20260914061139_fd193e2a-a656-422c-be9f-e9adccb68a92.sql:1-2`). No source da aplicação, não encontrei chamada RPC direta a `has_role`; as policies usam `auth.uid()`. Um chamador direto ainda pode testar role para UUID conhecido; a existência de superfície que revele UUIDs alheios e o impacto de enumeração não foram demonstrados. Mantido como lacuna de validação, sem novo achado.

### Busca limitada por credenciais hardcoded

Busca estática por padrões comuns de chaves privadas, bearer tokens e URLs PostgreSQL foi feita somente em `src/`, `ops/` e `supabase/`, sem imprimir valores e excluindo arquivos de teste/documentação. Nenhum arquivo correspondeu aos padrões usados. Isto não cobre todas as classes de segredo, histórico Git, arquivos excluídos/ocultos fora dessas pastas, bundles compilados ou variáveis configuradas no deploy; `.env` não foi aberto.

### SEC-014 — leitura anônima permite enumeração global do catálogo

- **Estado:** corrigido localmente; migration remota n?o aplicada. N?o h? rota local de diret?rio; o cat?logo da agenda p?blica carrega por slug em Server Function.
- **Gravidade:** P3 potencial.
- **Módulo:** segurança / privacidade comercial / catálogo público.
- **Esperado:** se a experiência pública é por slug, as linhas anônimas devem corresponder ao estabelecimento consultado e estar no estado publicável; diretório global deve ser uma decisão de produto explícita.
- **Observado:** `businesses_public_read` permite anon SELECT em todas as linhas com `USING (true)` (`20260902053903...:5`); migration posterior reduziu as colunas a `id,name,category,phone,address,logo_url,status,brand_primary,brand_background`, sem estreitar linhas (`20260916012915...:10-12`). `professionals_public_read` deixa anon ler linhas ativas (`20260902053903...:7`) e colunas foram reduzidas a `id,name,role,active` (`20260916012915...:15-17`); serviços ativos, categorias ativas, vínculos e horários também têm policies públicas em migrations locais. A rota pública observada chama `getPublicBookingCatalog` por slug, e essa Server Function consulta o catálogo via admin (`src/routes/agendar.$slug.tsx:38,65`; `src/lib/booking.functions.ts:198-215`), não depende de SELECT direto anon.
- **Impacto:** cliente com anon key pode enumerar negócios, telefones/endereços de contato, status, profissionais e catálogo ativo além de conhecer um slug. Campos de businesses/professionals foram limitados, e parte das informações é a mesma exibida nas páginas públicas; o risco concentra-se em estabelecimentos de teste, suspensos, não publicados ou na ausência de consentimento para indexação/listagem.
- **Reprodução segura:** no projeto local descartável, inserir negócios fictícios com slugs não divulgados e estados ativo/suspenso; fazer SELECT anon nas tabelas públicas e comparar com resposta do endpoint por slug. Sem chamada a produção.
- **Causa-raiz local:** grants anônimos protegem a projeção de colunas, mas policies não escopam linhas pelo business/slug nem estado de publicação.
- **Correção recomendada para spec:** confirmar se o produto oferece diretório público; se não, retirar SELECT anon direto e servir dados apenas por endpoint limitado ao slug/estado publicável, preservando os campos necessários na página.
- **Regressão:** anon não enumera tenants fora do contrato público; estabelecimento suspenso/não publicado não aparece além do comportamento previsto; catálogo por slug segue funcional.
- **Limitação:** sem spec de diretório, políticas remotas ou linhas reais, não é possível separar exposição indevida de visibilidade pública intencional. Não foi usada anon key.

### SEC-015 — DELETE direto de estabelecimento pelo owner mantém-se autorizado

- **Estado:** corrigido localmente; migration remota não verificada.
- **Gravidade:** P2 potencial por exclusão em cascata de dados do tenant e bypass da trilha administrativa.
- **Módulo:** segurança / autorização / retenção de dados.
- **Esperado:** se exclusão é operação administrativa, só Server Function Master protegida deve executá-la; se owner puder excluir a conta, deve haver fluxo explícito, confirmação forte e política de retenção/cancelamento, sem deixar cascatas financeiras inesperadas.
- **Observado:** migration inicial concede `SELECT, INSERT, UPDATE, DELETE` em `businesses` a `authenticated` e policy `businesses_own FOR ALL` permite todas as operações quando `owner_id = auth.uid()` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`). Hardening revoga somente `UPDATE` e reabre atualização de colunas selecionadas, sem revogar DELETE (`20261103000000_security_hardening.sql:177-179`). Não encontrei `REVOKE DELETE ON public.businesses` posterior. Em contraste, `deleteBusiness` é Server Function Master com `assertSuperAdmin` (`src/lib/admin.functions.ts:181-194`) e o contrato da spec 002 lista essa operação entre as funções que exigem Master + AAL2 (`specs/002-correcoes-pos-teste-manual/contracts/server-functions.md:23`). A FK de `ledger_entries.business_id` é `ON DELETE RESTRICT` (`20260929120100_ledger_entries_restrict_business_delete.sql:1-10`), porém várias relações de negócio usam `ON DELETE CASCADE`, incluindo profissionais, serviços, clientes, appointments, horários, bloqueios, pagamentos de sinais, histórico de assinatura, carteira, categorias e credenciais (`20260822051036...`, `20260902060129...`, `20260907032606...`, `20260929120000...`, `20261002150000...`, `20261011000000...`).
- **Impacto:** owner autenticado pode potencialmente chamar REST DELETE diretamente e remover o próprio business com todas as relações em cascata quando não há ledger_entries que acionem RESTRICT; registros do ledger impediriam a operação, mas não a disponibilidade antes do primeiro lançamento. O fluxo pode apagar appointments/PII/histórico não protegido pelo RESTRICT e deixar usuário Auth sem negócio. Nenhum dado foi apagado.
- **Reprodução segura realizada:** no ensaio Postgres isolado, foi criado auth user fictício e, sob `SET LOCAL ROLE authenticated` + claim `auth.uid()` correspondente, foi inserido business próprio e executado `DELETE ... RETURNING`; o DELETE passou. Havia appointment filho fictício, que foi removido pela cascata. A transação inteira foi revertida e o database temporário foi removido. Não foi testado cenário com ledger para confirmar RESTRICT.
- **Causa-raiz local:** policy `FOR ALL` e grants de CRUD do template inicial não foram reduzidos para DELETE quando a exclusão foi encapsulada em operação Master; hardening recente restringiu somente UPDATE.
- **Correção recomendada para spec:** decidir formalmente se owner pode solicitar exclusão; se não, revogar DELETE direto e preservar a operação Master/retention; se sim, criar fluxo servidor com reautenticação, confirmação, política de retenção e auditoria consistente.
- **Regressão:** owner não apaga via PostgREST quando a regra reservar exclusão a Master; Master autorizado mantém comportamento/documentação; não pode existir cascata silenciosa que elimine dados protegidos; business com e sem ledger recebe resultado definido.
- **Limitação:** a reprodução confirma apenas a chain local; migrations/FKs remotas, negócios sem ledger e comportamento de produção não foram verificados. A spec exige proteção Master/AAL2 para `deleteBusiness`, mas não foi encontrado requisito de autoexclusão do owner.

**Validação da correção (2026-11-15):** a migration `20261114150000_restrict_business_owner_insert.sql` revoga INSERT/DELETE de `authenticated` e concede a escrita ao `service_role`. O teste `security-hardening.test.ts` tenta DELETE autenticado no business sintético e confirma que a operação falha e a linha permanece. Teste focal atualizado: 55/55. Nenhum negócio real foi alterado; migration remota não verificada.
### SEC-016 — INSERT direto pode criar business com campos de controle escolhidos pelo owner

- **Estado:** INSERT do owner com valores comerciais escolhidos foi reproduzido na chain local efêmera; migration remota e regra de descoberta/acesso continuam não verificadas.
- **Gravidade:** P1 potencial (onboarding, acesso e faturamento podem ser contornados por owner autenticado).
- **Módulo:** segurança / autorização comercial / ciclo de assinatura.
- **Esperado:** criação de estabelecimento deve ocorrer via fluxo autorizado Master/SDR que define preço, status, trial e acesso; usuário owner comum não deve escrever campos de controle nem criar tenant sem aprovação.
- **Observado:** migration inicial concede INSERT em `businesses` a `authenticated` e `businesses_own FOR ALL` permite INSERT quando `owner_id = auth.uid()` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`). Não encontrei constraint única que limite `owner_id` a um business. O hardening recente só revoga UPDATE e concede colunas editáveis, não revoga INSERT (`20261103000000_security_hardening.sql:177-179`). O trigger `guard_business_control_columns` é `BEFORE UPDATE`, não INSERT (`:181-206`). `status` e `monthly_fee_cents` têm defaults na chain (`20260907051645_7c345a19-dd9e-4842-b72b-2181e762b4c8.sql:2-3`); `access_until` é nullable (`20261027160000_access_until.sql:1-7`) e não encontrei CHECK que limite valores inseridos por owner. O fluxo `createBusinessWithOwner` é Master-gated e define os campos via server (`src/lib/admin.functions.ts:92-146`); o contrato Master exige `super_admin` + AAL2 (`specs/002-correcoes-pos-teste-manual/contracts/server-functions.md:23`). `BusinessProvider` carrega negócios acessíveis para o usuário e os oferece para seleção (`src/lib/business.tsx:97-126`), então uma linha própria inserida aparece no estado local quando o cache revalida.
- **Impacto:** owner poderia potencialmente inserir negócio adicional próprio com `status='ativo'`, `monthly_fee_cents=0` e `access_until` futuro (ou outros valores de controle), sem passar pelo onboarding Master, alterando classificação/MRR. O estado visual de plano trata `access_until` futuro como ativo/teste (`src/lib/plan-state.ts:38-92`), e `painel.tsx` considera expirado somente negócio suspenso ou trial configurado e vencido (`:1234-1235`); isso cria um caminho plausível para habilitar o painel sem cobrança aprovada. Não foi demonstrado qual conjunto mínimo de serviços/profissionais libera cada jornada nem houve inserção real.
- **Reprodução segura realizada:** em transação do Postgres efêmero, usuário fictício com role `authenticated` e claim própria inseriu business com `status='ativo'`, `monthly_fee_cents=1` e `access_until='2000-01-01'`; RLS aceitou e devolveu esses valores. Depois a transação foi revertida e o database descartável removido. A UI/BusinessProvider não foi exercitada.
- **Causa-raiz local:** grant de INSERT e policy `FOR ALL` do template inicial continuaram após onboarding ser encapsulado em função Master; o hardening cobriu UPDATE, mas não insert-time protected fields.
- **Correção recomendada para spec:** revogar INSERT de authenticated em `businesses` e manter criação por service role/fluxo autorizado; adicionar defesa no banco para campos de controle em INSERT e validar automaticamente `owner_id`/status/trial/acesso.
- **Regressão:** owner comum não cria business via PostgREST; Master/SDR provisionam com preços e estados autorizados; alteração de campos protegidos em INSERT e UPDATE por cliente é rejeitada; provisionamento não gera duplicata.
- **Limitação:** reprodução é da chain local apenas; políticas remotas e regra de produto permanecem inconclusivas. Nenhuma conta/valor real foi consultado. Gravidade continua potencial em produção.

## PAY-009 e PAY-010 — controles do fluxo de saque

`PAY-009` (P1) registra que `requestWithdrawal` não verifica PIN nem exige prova do endpoint `verifyWithdrawalPin`; a checagem da tela em `painel.as-pay.tsx` é contornável por chamada direta. `PAY-010` (P2) registra que a busca de retry por `idempotency_key` devolve o saque sem filtro/validação de negócio. Ver o detalhe, reprodução mockada e regressões requeridas em [pagamentos.md](pagamentos.md).

Ainda não houve tentativa de invocar esses fluxos, nem em mocks; o comportamento é deduzido dos handlers e serviços. Esta lacuna de autorização do PIN deve permanecer prioridade P1 até uma reprodução segura em harness isolado.

## PAY-011 e SEC-004 — aprovação de chave e brute force do PIN

`PAY-011` (P1): o owner salva a chave em `businesses` antes da aprovação manual; `createWithdrawal` usa esse campo sem consultar `pix_key_approvals`. A UI aguarda aprovação, mas o servidor não impõe a regra. `SEC-004` (P2): PIN de saque agora tem lockout persistente por usuário/negócio: cinco falhas em 15 min bloqueiam por 30 min; o bucket de IP depende da origem ainda pendente em SEC-018, e o hash SHA-256 mantém risco offline. Ver evidências e limites em [pagamentos.md](pagamentos.md).

PAY-011 inclui também a alteração direta da chave após uma aprovação existente: o servidor permite ao owner gravar nova `withdrawal_pix_key` em rota própria, e o próximo cashout usa a chave corrente sem exigir revisão da nova chave. A jornada visual de aprovação não limita a chamada direta.

### DEP-001 — Versão de Zod vulnerável em validações server-side

- **Status:** corrigido localmente; lockfile e instalação resolvem `zod@4.6.7`, acima da versão corrigida `4.6.6` indicada no [advisory oficial GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Aplicação/versão implantada em produção não verificada.
- **Gravidade original:** P1 potencial (CVE High; exposição efetiva dependia da versão e de arrays sem limite).
- **Observado agora:** `workingDays` limita a sete elementos e `serviceIds` a 1.000 (`src/lib/professionals.functions.ts`); `availableDays` limita a sete e `professionalIds` a dez (`src/lib/services.functions.ts`). O advisory descreve exaustão de memória em versões anteriores a 4.6.6 quando grandes arrays sem limite são validados.
- **Regressão:** `professionals.functions.test.ts` verifica rejeição de `workingDays` acima de sete e `serviceIds` acima de 1.000; `services.functions.test.ts` verifica rejeição de `availableDays` acima de sete.
- **Verificação — 2026-11-15:** versão instalada e lockfile conferidos; suíte focal dos dois arquivos passou, 50/50. Nenhum payload de exaustão, alteração remota ou processo de produção foi executado. Estado local corrigido; produção permanece sem verificação.

### DEP-002 — Vite de desenvolvimento vulnerável e exposto à rede local

- **Status:** mitigado localmente; versão e validação de hosts corrigidas, servidor de desenvolvimento ainda escuta interfaces de rede por necessidade de acesso local.
- **Gravidade:** P2 (risco em execução do servidor de desenvolvimento; não evidência de exposição no build de produção).
- **Módulo:** segurança / dependências / ambiente de desenvolvimento.
- **Esperado:** servidor de desenvolvimento não deve depender de versão vulnerável quando está acessível por rede.
- **Observado:** `package-lock.json` resolve `vite@8.1.5`; `vite.config.ts` define `server.host: true` e `allowedHosts: true` no modo dev. `npm audit` retornou Vite High, com vários avisos relacionados a `launch-editor`; o [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) afeta Vite até 8.1.5 e descreve bypass de validação de caminho no Windows. O advisory requer o servidor de desenvolvimento/contexto de editor; isso não demonstra vulnerabilidade no build publicado.
- **Impacto:** um servidor local iniciado por um desenvolvedor pode ficar acessível na LAN e expor o caminho do editor/host segundo as pré-condições do advisory.
- **Reprodução segura:** não invocar editor nem enviar payload; confirmar reachability e versões apenas em ambiente de desenvolvimento controlado.
- **Causa-raiz:** versão no lockfile afetada junto de host aberto a interfaces da máquina.
- **Correção recomendada para spec:** atualizar Vite para versão corrigida compatível e rever se host/allowedHosts devem ficar abertos em todos os usos locais.
- **Regressão:** `npm audit` sem avisos aplicáveis; servidor dev escuta apenas nas interfaces autorizadas e build/deploy não depende do handler do editor.

#### Revalidação e mitigação local — 2026-11-15

`npm ls vite --depth=0` e o lockfile confirmam Vite 8.1.7, corrigido para GHSA-587h-7wmj-h5pm (limite afetado 8.1.5) e GHSA-p4f5-76q4-ffq7 (limite afetado 8.1.6; patch 8.1.7). A configuração mantém `host: true` para acesso por IP na rede local, mas removi `allowedHosts: true`: o padrão do Vite aceita IPs/localhost e recusa domínios arbitrários, mitigando DNS rebinding. O teste `src/vite-config.test.ts` falhou antes da mudança e passou depois (1/1); `npm audit` não lista Vite entre vulnerabilidades. Permanecem 7 alertas moderados do minimatch na cadeia typescript-eslint (DEP-003); `npm audit --omit=dev` continua zerado. Não executei PoC nem iniciei servidor acessível pela rede.

### DEP-003 — Alertas moderados transitivos e de lint

- **Status:** corrigido localmente em 2026-11-15 por override escopado para minimatch 11.0.1; remover quando houver release upstream corrigida. Uso somente em ferramenta de desenvolvimento.
- **Gravidade:** P3.
- **Módulo:** segurança / dependências de desenvolvimento.
- **Esperado:** alertas moderados de dev devem ter triagem de atualização e escopo.
- **Observado:** `npm audit --json` em 2026-11-15 reportou 7 Moderate e zero High; `npm audit --omit=dev --json` reportou zero vulnerabilidades. O lockfile resolve `minimatch@10.2.6` via `@typescript-eslint/typescript-estree@8.72.1`. A [advisory GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) marca versões anteriores a 11.0.1 como afetadas e 11.0.1 como corrigida. A faixa declarada pelo parser é `^10.0.0`, portanto override para 11 cruza major.
- **Impacto:** risco para pipeline e ferramentas de desenvolvimento, conforme o uso de padrões controlados por atacante.
- **Reprodução segura:** não necessária; manter avaliação de lockfile e advisory.
- **Causa-raiz:** release publicada do parser ainda declara minimatch ^10.2.2; a atualização upstream para ^11.0.1 foi mesclada, mas ainda não publicada no registry consultado.
- **Estado da correção:** override local restrito a `@typescript-eslint/typescript-estree` fixa minimatch em 11.0.1; o teste de API do consumidor passou. `npm audit` agora reporta zero vulnerabilidades. Atualização dos arquivos locais de package/lock preserva Vite 8.1.7 e Zod 4.6.7.
- **Próximo passo:** ao publicar release upstream com `minimatch@11`, remover o override e atualizar normalmente. Revalidado com script de compatibilidade, lint pontual (regra Prettier desligada devido a erro preexistente no arquivo escolhido), typecheck e audit.

### Registro da consulta de dependências

Em 15/11/2026: `npm audit --json` informa 7 Moderate e zero High/Critical; `npm audit --omit=dev --json` informa zero. Nenhum pacote/lockfile foi alterado nesta triagem. Resolução local detectada: `minimatch@10.2.6` via `typescript-eslint@8.72.1`; advisory atual fixa em 11.0.1, fora da faixa do parser.

### Cabeçalhos de IP no endpoint público de log — cobertura inconclusiva

`logClientError` usa o primeiro `x-forwarded-for` como chave do limite local (`src/lib/error-log.functions.ts:34-76`). O Caddyfile local encaminha pelo `reverse_proxy` padrão e não declara `trusted_proxies` (`ops/vps/Caddyfile:1-3`). A documentação oficial do [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) diz que, por padrão, o Caddy ignora os valores `X-Forwarded-*` recebidos para evitar spoofing; quando há CDN/proxy anterior, é necessário configurar proxies confiáveis. Como a topologia implantada e a possibilidade de acesso direto à aplicação não foram verificadas, não há achado de falsificação confirmado. Validar qual IP efetivo chega ao handler e se a cota é por cliente ou compartilhada pela borda.

### Ciclo de revisão — login e reset de senha

Auth do painel exige JWT validado por Supabase; papéis são lidos de `user_roles`, e Master tem check de role no servidor por chamada. Reset Master e SDR registram evento antes da alteração, e a senha temporária não é gravada na auditoria. Não houve mutação de senha. A política remota de rate limit para login de owner/profissional, MFA/aal, sessão, logs e retenção não pôde ser confirmada sem acesso ao projeto/configuração implantados.

### SEC-022 — senha temporária de reset permanece no estado do dossiê e pode reaparecer noutra ficha

- **Estado:** corrigido localmente; sem reset real nem teste de browser.
- **Gravidade:** P2 potencial (credencial temporária pode ser reapresentada no contexto de outro estabelecimento ao mesmo operador Master).
- **Módulo:** segurança / credenciais / dossiê Master.
- **Esperado:** credencial revelada uma única vez deve ser removida quando a ficha fecha ou o businessId muda; não deve surgir no contexto de outro estabelecimento.
- **Observado após correção:** estado guarda `{ businessId, value }`; renderização chama `visibleTemporaryPassword` para exibir somente no mesmo negócio e um efeito descarta o segredo quando `businessId` muda para outro negócio ou `null`. O `onSuccess` compara a ficha atual àquela que iniciou o reset e ignora resposta atrasada de outra ficha. O reset exibido permanece texto selecionável apenas na ficha que o gerou.
- **Impacto:** Master pode confundir a senha temporária de um proprietário com a de outro e repassá-la ao destinatário errado. Não foi gerada ou visualizada credencial nesta auditoria.
- **Reprodução segura:** harness de UI com `resetOwnerPassword` mockado retornando uma string sintética; concluir reset fictício de A, fechar e reabrir ficha B sem desmontar `BusinessDossier`; conferir que o texto de A persiste. Não chamar Auth/Supabase.
- **Causa-raiz:** corrigida localmente: estado secreto agora está vinculado ao `businessId`, oculto em contexto diferente e limpo pelo efeito ao fechar/alternar.
- **Regressão:** `src/lib/master/temporary-secret-state.test.ts` verifica visibilidade somente no negócio que gerou o segredo e descarte ao mudar para outro ou para `null` (1/1).
- **Limitação:** impacto é potencial e restrito ao contexto Master; não houve reset real, screenshot ou compartilhamento externo.

### SEC-005 — operações Master podem ignorar falha ao gravar auditoria

- **Status:** corrigido localmente; atomicidade entre mutação e trilha não implementada, produção não verificada.
- **Gravidade:** P2.
- **Módulo:** segurança / trilha de auditoria Master / ciclo de assinatura e dossiê.
- **Esperado:** alteração administrativa sensível deve registrar ator/ação; se a auditoria for obrigatória, falha deve tornar a operação claramente incompleta ou exigir transação atômica.
- **Observado/revalidado:** `recordRequiredMasterEvent` no lifecycle e `recordEvent` no dossiê agora verificam `{ error }` além de exceções e propagam erro legível. As rotas de estender teste, alterar dias de acesso e alterar cancelamento chamam o helper obrigatório. Criação de nota, alteração comercial e consulta de suporte também falham explicitamente quando o evento não é gravado. O padrão já existente em `setOwnerPassword` permanece.
- **Impacto:** mudança de teste/vencimento/cancelamento ou alteração/consulta no dossiê pode ficar sem trilha de ator/ação. Em particular, uma consulta do modo suporte pode devolver snapshot sem deixar evento que permita atribuir a leitura. Não há prova de que inserts tenham falhado em produção.
- **Reprodução segura:** fakes retornando `{ error: ... }` cobertos em `dossier-mutations.test.ts`; falha é propagada e a resposta identifica quando a alteração principal já foi aplicada. Apenas mock em memória.
- **Causa-raiz:** corrigida localmente: helpers agora verificam o objeto de erro retornado pelo client em vez de esperar apenas exceções.
- **Correção recomendada para spec:** decidir se a trilha é transacional/obrigatória; verificar `error` retornado e comunicar falha ou usar uma RPC que grave estado e evento atomicamente.
- **Regressão:** `dossier.functions.test.ts`, `dossier-mutations.test.ts` e `lifecycle.cancellation.test.ts`: 19/19. Não há transação atômica entre atualização de negócio e evento; falha pós-update informa que a mutação foi aplicada sem auditoria e requer revisão. Sem migration, estado real ou deploy.

### SEC-006 - Master operations require AAL2 server-side

- State: corrected locally; deployed Supabase policy and real-user factors remain unverified.
- Severity: potential P1 until MFA is validated in the deployed environment.
- Root cause: the central guard checked the role only; login sent Master directly to the panel and no local TOTP setup/challenge route existed.
- Local correction: `assertSuperAdmin` requires current `super_admin` role and `aal2`; `getSuperAdminStatus` exposes the minimum pre-MFA state (`aal2`, `needsMfa`). AAL1 login routes to `/painel/master-auth` for TOTP enrollment/challenge, and the Master panel redirects sessions without AAL2.
- Regression: tests cover missing/AAL1 denial, role and AAL2 authorization, pre-MFA state, enrollment, challenge/verify, and failure to reach AAL2. Four focused files, 33/33; TypeScript and diff check passed.
- Limit: auth settings, real users, factors, and deployed project configuration were not inspected; no remote action.

### SEC-007 — PIN adicional da aprovação Pix é aplicado apenas na interface

- **Estado:** bypass do gate visual confirmado no fluxo; intenção/política do PIN e risco de produção dependem de confirmação do responsável.
- **Gravidade:** P2 potencial.
- **Módulo:** segurança / aprovação de chave Pix / controles financeiros Master.
- **Esperado:** se o PIN Master adicional for requisito de autorização dessas ações, a prova deve ser verificada no servidor a cada operação protegida, com validade e vínculo de usuário/ação.
- **Observado:** a rota `painel.pix-aprovacao.tsx` lê `authorized` do `sessionStorage` e retorna a tela/modal até validação do PIN (`:63-79,374-391`). Após sucesso, grava validade apenas no browser (`SecurityPinModal.tsx:37-46`). Já `setPixKeyApprovalStatus`, `updatePixKeyApprovalEntry` e `updateBusinessTransferPin` verificam `assertSuperAdmin`, sem exigir prova de `verifySecurityPin` (`src/lib/pix-approvals.functions.ts:104-196`). A autorização visual não pode proteger chamadas diretas às Server Functions.
- **Impacto:** sessão Master roubada ou outro caller com role pode aprovar/rejeitar chave, editar destino aprovado e alterar PIN de transferência sem o passo adicional oferecido pela UI. O PIN não substitui a role; é um controle adicional anunciado para esta tela.
- **Reprodução segura:** invocar cada handler com contexto Master sintético, sem chamar `verifySecurityPin`, usando mocks para qualquer escrita e verificar se chega ao update; sem mudar dados reais.
- **Causa-raiz:** o estado de autorização do PIN fica em `sessionStorage` e não é assinado nem enviado/verificado no servidor.
- **Correção recomendada para spec:** confirmar se esse PIN é requisito de segurança; se for, criar autorização server-side curta, vinculada a identidade/ação e protegida contra replay, ou exigir step-up de Auth adequado.
- **Regressão:** requests sem proof server-side são negados; proof expirado/reutilizado não autoriza; role ausente continua negada; ações legítimas com step-up válido funcionam.
- **Limitação:** não se verificou a intenção do PIN, MFA externo nem configuração de produção.


### SEC-008 — script de release expunha o ambiente de runtime aos hooks de dependências/build

- **Estado:** corrigido localmente em 2026-11-15; não confirmado como caminho ativo de deploy e não implantado.
- **Gravidade:** P2 potencial de cadeia de suprimentos/segredos.
- **Causa-raiz:** `ops/vps/deploy-release.sh` carregava `/etc/agenda-agora.env` no shell antes de `npm ci --include=dev` e `npm run build`, herdando credenciais de runtime.
- **Correção local:** ambos os comandos agora rodam sob `env -i`, com `PATH`, `HOME` e somente os valores públicos `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_SPLIT_PANELS`. O serviço segue lendo sua configuração de runtime pelo gerenciador de serviço.
- **Regressão:** `ops/vps/deploy-release.test.sh` usa sentinelas para segredo de Supabase e AgPay e confirma que nenhum dos dois chega a `npm ci` ou `npm run build`, enquanto as três variáveis públicas chegam. Rollback, falha de restart e release saudável também passam.
- **Validação:** teste shell isolado, suíte completa (128 arquivos/1.019 testes aprovados, 3 arquivos/8 testes ignorados), `npx tsc --noEmit` e `git diff --check` passaram.
- **Limitação:** não confirmamos se este script ainda é o caminho de deploy ativo. Nenhum segredo real foi lido; não houve deploy nem execução em servidor.
### Revisão estática adicional — enumeração de roles e trigger de negócios

- `user_roles` concede SELECT a authenticated com policies para a própria role e leitura Master; não concede INSERT/UPDATE/DELETE a authenticated na migration inicial (`20260907045316_856b1ad9-ac27-4eca-a1de-d2ebce788209.sql:3-17,33-35`). A função SECURITY DEFINER `has_role(user_id, role)` foi depois restringida por `REVOKE ALL FROM PUBLIC, anon` e concedida a authenticated/service_role (`20260914061139_fd193e2a-a656-422c-be9f-e9adccb68a92.sql:1-2`); não presumir que migrations locais foram aplicadas em produção.
- A migration de hardening limita colunas de UPDATE concedidas diretamente a authenticated e acrescenta trigger que rejeita alteração de campos de controle por ator que não seja service_role ou super_admin (`20261103000000_security_hardening.sql:177-206`). O trigger é SECURITY INVOKER e busca role atual; o caminho privilegia consistência, mas ainda depende de versão remota aplicada.

### SEC-009 — profissionais conseguem ler dados pessoais de clientes sem a permissão específica de telefone

- **Estado:** profissional ativo sem `view_customer_phone` leu PII no replay isolado da chain local; permissões remotas e dados de produção não verificados.
- **Gravidade:** P1 potencial por exposição de dados pessoais.
- **Esperado:** `view_customer_phone` e as permissões de dados do cliente devem ser impostas no banco/API para cada leitura protegida, não apenas no menu ou no componente.
- **Observado:** `customers` concede `SELECT` a `authenticated` e tem policy `customers_professional_read` que autoriza qualquer `is_business_member(business_id)` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:87-101`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:122-124`). `appointments` também concede SELECT e tem `appointments_professional_read` com a mesma condição ampla (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:104-122`; `20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:107-108`). `is_business_member` retorna true para qualquer profissional ativo do negócio independentemente de `permissions` (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:30-43`). `customers` inclui `phone`, `email`, `notes`, e outra migration adiciona `birth_date` e `cpf` (`20261011000300_customer_documents.sql:1-5`); appointments armazenam `customer_phone`, `customer_name` e `notes`. Não encontrei revogação/row policy posterior que condicione leitura a `view_customer_phone`.
- **Contraste de interface:** o menu só mostra `/painel/clientes` se `canOpen` reconhecer `view_customer_phone` (`src/routes/_authenticated/painel.tsx:345,1872-1881`), e o telefone é mascarado na UI quando a permissão não está confirmada (`src/lib/business.tsx:140-154`; `src/routes/_authenticated/painel.clientes.tsx:703`). A agenda busca appointments por client Supabase com `select("*")`, incluindo `customer_phone`, e mascara o campo somente na renderização (`src/routes/_authenticated/painel.index.tsx:214-232,748-752`). Um profissional autenticado com `view_agenda` pode receber os valores no browser e pode chamar as APIs Supabase diretamente. RLS retorna todas as colunas sob as policies de membership.
- **Impacto:** profissional sem a permissão de visualizar telefone pode ler números de clientes em appointments e na tabela `customers` via Supabase REST/SDK; e-mail, observações, data de nascimento e CPF também ficam acessíveis por SELECT amplo, embora a política esperada para esses campos não esteja definida. Mascaramento de tela não protege os dados já acessíveis pelo banco.
- **Causa-raiz confirmada na cadeia local:** policy foi escrita para membership amplo, enquanto a permissão granular existe somente como regra da interface; não há policy de coluna/SELECT que avalie `view_customer_phone`.
- **Reprodução segura realizada:** em Postgres efêmero, criou-se business, profissional ativo com `view_customer_phone=false`, cliente com PII sentinela e appointment fictício. Sob `SET LOCAL ROLE authenticated` com claim do profissional, SELECT de `customers(phone,email,notes)` e `appointments(customer_phone)` retornou os sentinelas. A transação foi revertida e o banco removido; nenhum dado real foi usado.
- **Correção recomendada para spec:** definir quais campos cada permissão protege e impor isso na API/RLS (por exemplo, views/RPCs com projeção segura ou permissions verificadas), além de testar acesso direto sem UI.
- **Regressão:** owner, profissional com permissão e sem permissão; leitura direta da API, export CSV, CPF, e-mail, telefone, notas e birth_date; usuários de outro negócio seguem isolados.
- **Limitação:** validação dinâmica confirma a chain local apenas; RLS remota e produção não foram consultadas. `birth_date`/CPF seguem risco estático e não foram incluídos no fixture dinâmico.

### SEC-010 — profissionais ativos têm SELECT de linha inteira em `businesses`

- **Estado:** autorização ampla confirmada na chain local; impacto de produção condicionado a migrations aplicadas e valores ainda preenchidos.
- **Gravidade:** P1 potencial (credenciais/destino financeiro e dados fiscais).
- **Esperado:** `businesses` só deve expor para profissionais os campos operacionais necessários à sua função. Credenciais, destinos de repasse, hashes de PIN, CPF do proprietário e parâmetros comerciais devem ter acesso específico a owner/serviços privilegiados.
- **Observado:** a migration inicial concede `SELECT, INSERT, UPDATE, DELETE` em `businesses` a `authenticated` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:30-44`). A policy `businesses_professional_read` permite SELECT quando há profissional ativo para o negócio (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:70-75`), e `is_business_member` não testa permissões de campo (`:30-43`). O narrowing da migration `20260916012915` revoga SELECT de `anon` e concede colunas públicas restritas apenas a `anon`; não revoga SELECT de `authenticated`. Não encontrei grant column-level/revogação de SELECT para o papel autenticado.
- **Colunas sensíveis presentes na chain/tipos:** `withdrawal_pix_key`, `withdrawal_pix_key_type`, `withdrawal_pin_hash`, `owner_cpf`, `agpay_commission_percent`, `agpay_split_email`, `agpay_split_status` e dados de acesso/lifecycle (`src/integrations/supabase/types.ts:418-474`; migrações correspondentes). O hash é SHA-256 determinístico de `businessId:PIN` de quatro dígitos (`src/lib/withdrawal.server.ts:206-230`), portanto sua exposição revela um verificador passível de enumeração offline; nenhuma tentativa foi feita.
- **Credencial WhatsApp legada:** `20261002150000_whatsapp_credentials_private.sql` cria tabela privada, revoga nela os grants de `anon`/`authenticated` e copia os dados da coluna antiga, mas declara o rollout como aditivo até uma migration posterior verificada que nulifique `businesses.whatsapp_instance_token` (`:1-38`). Não há migration de nulificação/remoção na chain local e o runtime ainda tem fallback para a coluna (`src/lib/whatsapp-notify.server.ts:73-80`, `src/lib/whatsapp-greeting.server.ts:266`). Não foi lido qualquer token.
- **Hardening observado:** `20261103000000_security_hardening.sql:177-206` revoga UPDATE e concede escrita de colunas específicas; não restringe SELECT. O controle de escrita não elimina esta leitura de linha inteira.
- **Impacto:** profissional ativo pode consultar pela API autenticada valores presentes na linha do próprio negócio fora do painel: chave de saque, hash do PIN, dados fiscais/comerciais e, se ainda preenchido, token WhatsApp legado. Possível enumeração de PIN e uso indevido de credencial dependem de conteúdo/configuração; não foram observados em produção.
- **Reprodução segura:** em Supabase local descartável, criar negócio e profissional fictícios, popular colunas sentinela não secretas e testar `businesses.select('withdrawal_pix_key,withdrawal_pin_hash,owner_cpf,whatsapp_instance_token')` com JWT do profissional. Não consultar produção nem imprimir valores reais.
- **Causa-raiz confirmada localmente:** a policy de membership foi adicionada sem reduzir o grant de SELECT da role `authenticated` nem separar colunas sensíveis em tabela privada; o hardening tratou UPDATE, não leitura.
- **Correção recomendada para spec:** definir contrato de colunas por papel, usar grants/visões/RPCs de projeção mínima e mover/remover definitivamente colunas secretas legadas após todos os workers suportarem o armazenamento privado.
- **Regressão:** profissional sem e com cada permissão só lê dados aprovados; REST/SDK direto não recupera credenciais/dados fiscais indevidos; owner e service role mantêm os fluxos legítimos; testar migração de nullificação após rollout completo.
- **Limitação:** o projeto Supabase de produção não está acessível. Não se confirmou policy ativa, migration aplicada, preenchimento dos campos ou credencial exposta; nenhum segredo foi lido.

### SEC-011 — profissionais ativos podem consultar o histórico de pagamentos da assinatura

- **Estado:** profissional ativo fictício consultou payment sintético no replay da chain local; intenção do produto e policies remotas continuam desconhecidas.
- **Gravidade:** P2 potencial (confidencialidade de valores e situação comercial do estabelecimento).
- **Módulo:** RLS / dados financeiros de assinatura.
- **Esperado:** definir se membros profissionais precisam consultar mensalidade, status e histórico de pagamento da conta do estabelecimento; caso seja dado exclusivo do proprietário, restringir a leitura no banco/API.
- **Observado:** `subscription_payments` concede `SELECT` a `authenticated` e tem policy inicial `subscription_payments_owner` baseada em `owns_business(business_id)` (`20260902060129_a03cc3ea-196e-47eb-b342-4887bad7ed4d.sql:47-62`). Migração posterior adiciona policy SELECT `subscription_payments_member_read` cujo `USING` é `is_business_member(business_id)` (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:130-132`). Em RLS permissiva, policies SELECT aplicáveis se combinam por OR; assim o profissional ativo passa pela policy de membro, sem ser owner. O tipo local contém `business_id`, `reference_month`, `amount_cents`, `status`, `paid_at`, `created_at` (`src/integrations/supabase/types.ts:1561-1591`). A tela/função de assinatura é owner-oriented (`src/lib/subscription.functions.ts:30-43`), embora contadores internos consultem pagamentos via função servidor. Não foi encontrada justificativa explícita para disponibilizar esse histórico aos profissionais.
- **Impacto:** um profissional autenticado pode potencialmente consultar valores, meses e estados do pagamento da assinatura do negócio por API direta, obtendo informação comercial sem depender da interface de owner. Não há evidência de acesso ou vazamento real.
- **Reprodução segura realizada:** no Postgres efêmero, profissional ativo de outro usuário consultou amount/status/reference_month do pagamento sintético do business. A mesma fixture demonstrou que o owner altera e remove a linha; transação revertida e banco removido.
- **Causa-raiz:** policy de leitura de member foi ampliada para tabela que o schema identifica como pagamentos da assinatura do dono; ausência de contrato de permissão explícito nesta chain.
- **Correção recomendada para spec:** confirmar a intenção funcional com o produto; se histórico for reservado ao owner, remover acesso de member e preservar consultas via service role nas telas administrativas apropriadas.
- **Regressão:** owner lê sua conta; profissional ativo não lê pagamentos por REST/SDK se não tiver permissão apropriada; membro de outro business continua isolado; consultas administrativas autorizadas seguem operacionais.
- **Limitação:** reproduzido só no replay local; policies/grants remotos, valores existentes e intenção de negócio não foram verificados. Classificação permanece potencial em produção.

### Revisão RLS do chat de suporte

A migration de hardening revoga UPDATE geral de `support_messages` para authenticated e concede UPDATE somente em `read_by_user` (`20261103000000_security_hardening.sql:221-223`), mitigando alteração de `sender`/conteúdo via update. O INSERT da saudação inicial continua conflitando com `support_owner_insert_user`, detalhado como API-005 em [backend.md](backend.md). Esta inspeção não demonstra que demais grants de tabela ou policies estejam ativos remotamente.

### SEC-012 — leitura anônima integral de `time_blocks`

- **Estado:** corrigido localmente em 2026-11-14; grant `SELECT` de `anon` e policy pública foram removidos por migration aditiva. Estado remoto e presença/configuração de registros reais continuam desconhecidos.
- **Gravidade:** P2 potencial.
- **Módulo:** segurança / privacidade de agenda / RLS.
- **Esperado:** público deve consultar apenas disponibilidade agregada necessária à reserva de um estabelecimento; bloqueios internos e motivos não precisam ser expostos diretamente pela REST API global.
- **Observado:** migration inicial concede `SELECT` em `public.time_blocks` para `anon` e cria policy `time_blocks_public_read ... USING (true)` (`20260902060129_a03cc3ea-196e-47eb-b342-4887bad7ed4d.sql:26-42`). A tabela contém `business_id`, `professional_id`, `recurring`, `weekday`, `block_date`, `starts_at`, `ends_at` e `reason`. A migration posterior `20260914061103...` acrescenta policy de leitura para membros, mas não revoga o grant anônimo; buscas na chain local não encontraram revogação posterior. O fluxo de catálogo/disponibilidade pública já usa `admin()` em `src/lib/booking.functions.ts:620-690`, portanto não depende da leitura anônima direta.
- **Impacto:** qualquer cliente com a anon key pública pode potencialmente enumerar linhas de bloqueio de todos os estabelecimentos e obter padrões/horários e o campo livre `reason`. A interface permite texto opcional e dá como exemplo “Almoço, compromisso pessoal...” (`src/routes/_authenticated/painel.bloqueios.tsx:345-353`), então pode revelar ausência ou compromissos pessoais. Nenhum registro real foi consultado.
- **Reprodução segura realizada:** em Postgres efêmero, foi criado business/profissional/bloqueio com motivo `PRIVATE_REASON_SENTINEL`; após `SET LOCAL ROLE anon`, SELECT do bloqueio retornou esse motivo. Não foram criadas linhas em mais de um business neste teste; o escopo global vem da policy `USING (true)`. Transação revertida e banco removido.
- **Causa-raiz local:** leitura pública criada sem filtro por estabelecimento e sem projeção de colunas; rota pública já tem caminho server-side que poderia manter a consulta restrita.
- **Correção recomendada para spec:** remover acesso anon direto e manter leitura pública de slots estritamente necessários por endpoint/RPC limitado ao slug, sem retornar `reason` ou identificadores internos desnecessários.
- **Regressão:** anon não consegue SELECT direto em `time_blocks`; endpoint público retorna apenas disponibilidade do business solicitado; owner/profissional autorizado conserva gestão e leitura operacional.
- **Limitação:** replay confirma somente a chain local; policy/volume/conteúdo remotos seguem desconhecidos. Risco potencial em produção.

**Validação da correção (2026-11-14):** `20261114232840_restrict_anon_time_blocks.sql` revoga `SELECT` de `anon` e remove `time_blocks_public_read`. No Postgres efêmero, `anon` recebe permission denied; owner lê seu bloqueio e outro owner recebe zero linhas. O fluxo público de disponibilidade permanece server-side por `admin()` e a suíte `booking.functions.test.ts` passou 116/116. `npm run test:db`: 3 arquivos, 80/80; `npm test`: 103 arquivos aprovados, 3 ignorados, 921/8 ignorados; TypeScript e `git diff --check` passaram. A migration não foi aplicada ao projeto remoto.

### SEC-013 — SELECT de storage visual não confere membership do business

- **Estado:** corrigido localmente em 2026-11-14; policies de leitura autenticada agora exigem membership do business e staging fica restrito ao usuário que enviou o objeto. Policies remotas e conteúdo real não verificados.
- **Gravidade:** P2 potencial (isolamento multi-tenant e confidencialidade de assets ainda não publicados).
- **Módulo:** segurança / Supabase Storage / editor de aparência.
- **Esperado:** SELECT de arquivo deve ser público somente para assets publicados necessários ao catálogo; staging deve ser legível apenas por autor/membro autorizado do business ou por função privilegiada.
- **Observado:** `business_visual_asset_business_id(name)` aceita paths `<business>/logo/*`, `background/*`, `service/*` e `staging/<uuid>/<...>` (`20261002153000_visual_assets_storage_policies.sql:2-8`). A policy `visual_assets_images_read` inicialmente aplica só `bucket_id` e `business_visual_asset_business_id(name) IS NOT NULL`, sem verificar user, membership ou publicação (`20261019140000_visual_assets_read_policy.sql:10-16`). A migration de hardening substitui-a por policy de SELECT para `authenticated` com a mesma validação de formato (`20261103000000_security_hardening.sql:309-323`); policy anônima foi estreitada a logo legada, mas qualquer usuário autenticado mantém leitura/listagem de qualquer path visual que case com a função, incluindo staging. As policies de escrita verificam `manage_appearance` (`20261002153000...:14-29`), mas não restringem leitura. O caminho de staging está definido em `src/lib/visual-assets.server.ts:10-14`; helper não tem callers no `src` atual, então objetos atuais em staging são desconhecidos.
- **Impacto:** usuário autenticado de um tenant pode potencialmente listar e criar URL assinada para ativos de outros negócios; caso haja staging populado, pode acessar rascunhos não publicados. Paths não devem ser tratados como controle de acesso. Nenhum objeto foi listado/baixado.
- **Reprodução segura:** em Supabase local descartável, criar dois businesses e asset visual (incluindo staging) sentinela em cada; autenticar um usuário de um business e chamar Storage list/download apontando ao outro. Confirmar se SELECT permite descobrir/assinar os paths. Nenhuma consulta de produção.
- **Causa-raiz local:** policy de SELECT usa validação sintática de path como substituta da autorização por business e inclui staging na mesma função usada para assets publicados.
- **Correção recomendada para spec:** definir assets realmente públicos e paths staging; restringir SELECT de staging ao autor/membro habilitado, aplicar membership para leitura autenticada e emitir signed URLs por servidor somente após validação de publicação/permissão.
- **Regressão:** usuários de tenant A não listam nem assinam assets de B; staging não é acessível anon nem por authenticated externo; published asset segue visível pela jornada pública autorizada; bucket mantém acesso privado por padrão.
- **Limitação:** nenhuma policy/linha remota foi examinada; helpers de staging não têm uso encontrado no código-fonte atual. Risco potencial, sem ocorrência de acesso comprovada.

**Validação da correção (2026-11-14):** migration `20261114233557_restrict_visual_asset_reads.sql` restringe leitura dos caminhos legados de logo/serviço e das mídias publicadas a membros do business; staging exige `manage_appearance` e que o UUID de usuário no caminho seja `auth.uid()`. No Postgres efêmero, um owner leu quatro objetos do próprio negócio, um profissional ativo com `manage_appearance` leu os objetos publicados e seu próprio staging, e outro negócio permaneceu isolado. A tentativa anterior reproduziu leitura cruzada dos três tipos de path. DB focal: 53/53; DB completa: 3 arquivos, 81/81; `npm test`: 103 arquivos aprovados, 3 ignorados, 921/8 ignorados; TypeScript e `git diff --check` passaram. Migration local, não aplicada remotamente.

### SEC-017 — tokens SDR revogáveis por versão de sessão

- **Estado:** corrigido localmente; aplicação da migration e comportamento implantado não verificados.
- **Gravidade:** P2.
- **Causa-raiz:** tokens HMAC stateless não tinham vínculo com estado revogável; logout removia somente o token do navegador e alterações de PIN/email não invalidavam cópias existentes.
- **Correção local:** tokens agora assinam `sv` (versão de sessão), e `requireSdr` compara o claim com `sdrs.session_version`. A migration adiciona a coluna com valor inicial `1` para SDRs existentes, invalidando tokens legados (sem claim, tratados como versão `0`), e define default `0` para novos SDRs. Troca de PIN/email, ativação/desativação e logout incrementam a versão com compare-and-set; logout limpa a sessão do navegador somente após revogação confirmada.
- **Regressão:** login assina a versão lida do banco; tokens antigos falham após mudança de versão, troca de credencial ou logout; desativação incrementa a versão. O teste de schema valida default `0` e bloqueio de valores negativos.
- **Validação (2026-11-14):** `src/lib/sdr.functions.test.ts` 17/17; `src/lib/sdr-token.test.ts` 5/5; teste de DB `security-hardening.test.ts` 54/54; TypeScript passou anteriormente nesta implementação. Revalidar TypeScript, regressão conjunta e `git diff --check` antes de concluir.
- **Limitação:** migration `20261115003617_sdr_session_version.sql` está apenas no repositório local; aplicar a migration antes de implantar o código. Nenhum banco remoto, sessão real, deploy, push ou commit foi acessado/feito.

### SEC-018 - Rate limit IP source depends on the proxy chain

- State: blocked pending confirmation of the deployed proxy chain.
- Local cause: `clientIp()` prioritizes `CF-Connecting-IP` and `X-Real-IP`; the versioned Caddyfile passes these through. Caddy's official documentation says it passes incoming headers by default except for X-Forwarded-* headers, which it sanitizes when no trusted proxy is configured.
- Why blocked: if Caddy is directly exposed, a local fix can use Caddy's sanitized X-Forwarded-For. If a CDN sits in front, correct client IP parsing requires an explicit trusted-proxy policy and CIDR/source configuration; trusting or discarding that layer without confirmation can produce spoofable or shared rate-limit keys. Direct upstream access also depends on the deployed bind/firewall.
- Required to close: confirm whether a CDN/proxy is in front of Caddy and whether the app upstream is loopback-only; then configure one canonical trusted IP source and test it. No live infrastructure was inspected.
- Evidence: [Caddy reverse_proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), defaults and trusted proxy behavior.

### SEC-019 - Impersonation return fails closed on persistence errors

- State: corrected locally.
- Root cause: the PIN-failure counter UPDATE and one-time token DELETE ignored returned database errors.
- Correction: failed-attempt writes must succeed before the handler reports a PIN failure; the third-attempt DELETE must succeed before claiming the session was ended; successful PIN return must consume the token before generating a Master magic link.
- Regression: tests inject UPDATE and DELETE failures and confirm no false counter result or Master session issuance. `src/lib/lifecycle.impersonation.test.ts` passes 11/11; `npx tsc --noEmit` passed.
- Limitation: no production session or database was accessed.

### SEC-020 — avatar profissional limitado ao próprio negócio

- **Estado:** corrigido localmente; dados existentes e comportamento implantado não verificados.
- **Gravidade:** P2 potencial.
- **Causa-raiz:** `saveProfessional` aceitava qualquer `avatar_path`, e o catálogo público usava service role para assinar qualquer caminho salvo, contornando as policies do Storage.
- **Correção local:** validação de servidor aceita somente `<business_id>/professional/<arquivo>.(png|jpg|jpeg|webp)` no cadastro/edição. A função pública aplica a mesma validação contra o `business_id` do serviço antes de gerar URL assinada; valores antigos inválidos retornam `avatar_url: null`.
- **Regressão:** teste prova rejeição de path de outro negócio antes de qualquer gravação; casos cobrem `staging`, traversal, subpastas e extensões não publicadas. Paths válidos PNG/JPG/JPEG/WebP são aceitos.
- **Validação (2026-11-14):** testes combinados de professionals, validador de avatar e SDR: 4 arquivos, 51/51; teste de agendamento público 116/116; `npx tsc --noEmit` e `git diff --check` passaram.
- **Limitação:** nenhum objeto existente foi lido ou assinado; os registros salvos e o endpoint implantado não foram consultados. Não foi necessária migration.

### SEC-021 — `category_id` pode ligar serviço a categoria de outro negócio e cascade altera serviço alheio

- **Estado:** corrigido localmente; teste Postgres revalidado 2/2 em 2026-11-15; migration remota desconhecida.
- **Gravidade:** P3 potencial por integridade referencial entre tenants; sem evidência de leitura de dados privados ou alteração de serviço de vítima.
- **Módulo:** segurança / RLS / integridade de catálogo.
- **Esperado:** `services.category_id` só pode referenciar categoria pertencente ao mesmo `business_id` do serviço; alterações e remoções de uma categoria não devem modificar linhas de outro estabelecimento.
- **Observado antes da correção:** migration declarava apenas FK global `services.category_id -> service_categories.id ON DELETE SET NULL`, sem chave composta/trigger que confira `business_id` (`supabase/migrations/20261011000000_service_categories.sql:13-15`). Policy `services_owner` conferia ownership da linha do serviço, sem comparar categoria referenciada (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:83`). Em ensaio Postgres local com a chain original, owner A autenticado atualizou seu serviço apontando para categoria B; depois owner B apagou a categoria própria e a FK limpou `category_id` da linha de A. As duas mudanças e fixtures foram revertidas.
- **Impacto observado no baseline:** um dono podia criar vínculo de catálogo cross-tenant por chamada direta à API; a exclusão posterior alterava `category_id` do serviço vinculado. Não houve evidência de leitura de dados privados nem alteração de serviço sem esse vínculo. A UI filtra categorias por `business_id`, mas antes da correção a regra não era imposta pelo banco.
- **Reprodução segura:** já executada somente na chain local descartável: duas empresas/categorias fictícias, `SET LOCAL ROLE authenticated`, update com JWT A e delete com JWT B; `UPDATE` e `DELETE` retornaram uma linha e o serviço A terminou com `category_id=NULL`; `ROLLBACK` e remoção do banco após o ensaio.
- **Causa-raiz confirmada localmente:** integridade referencial garante apenas que o UUID exista; RLS em `services` não valida tenant da categoria e a ação `ON DELETE SET NULL` é cross-row.
- **Correção local:** migration `20261115020000_enforce_service_category_business_scope.sql` verifica antes se há vínculo cruzado legado e aborta sem alterar dados quando encontra algum. Sem inconsistência, substitui a FK simples por FK composta `(category_id, business_id) -> service_categories(id, business_id)` com `ON DELETE SET NULL (category_id)`, preservando `business_id`.
- **Regressão:** RED reproduziu que owner A conseguia apontar serviço para categoria B. GREEN confirma que o banco rejeita o vínculo; a exclusão da categoria B não altera o serviço A e excluir categoria própria limpa somente `category_id`. Testes DB focados 2/2; cadeia completa DB 5 arquivos/87 testes aprovados.
- **Validação (2026-11-15):** `npm test` 123 arquivos, 1004 aprovados/8 ignorados; `npx tsc --noEmit` passou. Migration executada somente no banco local descartável. Nenhum dado real foi lido ou modificado.
- **Limitação:** deploy e estado remoto não foram consultados. Se a migration encontrar vínculos cruzados legados, ela aborta antes de substituir constraints; a correção desses registros precisa de inspeção e decisão explícita.

### SEC-023 — catálogo público expõe somente a configuração necessária

- **Estado:** corrigido localmente; conteúdo de configurações reais e endpoint implantado não verificados.
- **Gravidade:** P2 potencial.
- **Causa-raiz:** a Server Function pública retornava os objetos `preferences` e `visual` completos.
- **Correção local:** `preferences` agora contém somente `timezone`, `cancellations_enabled` e `reschedule_enabled`, campos usados pela jornada pública. `visual` contém somente `layout_key`, necessário à prévia interna de aparência; paths de `layout_media`, templates de mensagem, destinatários e IDs selecionados não são serializados na resposta.
- **Regressão:** teste usa templates, UUID sentinela e path de mídia sintético e confirma que nenhum deles aparece; os três campos públicos e `visual.layout_key` permanecem disponíveis.
- **Validação (2026-11-14):** `src/lib/booking.functions.test.ts` 117/117; `npx tsc --noEmit` e `git diff --check` passaram.
- **Limitação:** nenhum conteúdo real nem endpoint publicado foi consultado; templates e IDs reais não foram lidos.

### SEC-024 — configuração de proxy versionada não define CSP nem bloqueio de framing

- **Estado:** ausência confirmada nos arquivos de deployment verificados; exposição nos hosts atuais inconclusiva.
- **Gravidade:** P2 potencial, como proteção de defesa em profundidade contra injeção e framing/clickjacking.
- **Módulo:** segurança / infraestrutura / headers HTTP.
- **Esperado:** política efetiva de segurança do conteúdo e restrição de framing devem ser explícitas para a aplicação autenticada, ajustadas aos scripts/estilos necessários.
- **Observado:** o bloco compartilhado do Caddyfile versionado define HSTS, `X-Content-Type-Options`, `Referrer-Policy` e remove `Server`, mas não CSP ou `X-Frame-Options` (`ops/vps/Caddyfile:1-10`). `vercel.json` contém somente framework `tanstack-start`, sem regras de headers. Busca no código e infraestrutura versionados não encontrou `Content-Security-Policy`, `frame-ancestors` ou `X-Frame-Options`.
- **Impacto:** se não houver camada externa acrescentando essas políticas, o browser não terá uma política da aplicação para restringir fontes de script/objetos nem impedimento explícito para enquadrar páginas autenticadas em origem externa. O risco de clickjacking depende de fluxo sensível acessível e interação do usuário; CSP também é mitigação em profundidade, não evidência de XSS atual.
- **Causa-raiz:** configuração local conhecida não estabelece as políticas e o estado efetivo da borda/deploy não é auditável nesta execução.
- **Correção recomendada para spec:** confirmar host/plataforma ativos e cabeçalhos reais; definir CSP compatível com scripts/estilos inline e integrações existentes, além de `frame-ancestors 'none'` ou allowlist deliberada (ou `X-Frame-Options` compatível).
- **Regressão:** resposta HTML de todos os hosts relevantes inclui políticas esperadas; fluxos Supabase, pagamentos, editor e reservas continuam funcionando sem abrir fontes amplas desnecessárias; framing externo é recusado conforme requisito.
- **Limitação:** não houve requisição a produção nem validação no browser; camadas externas podem adicionar os headers.

### Coleta de erros do cliente — revisão de minimização e acesso

- `ClientErrorMonitor` só instala o coletor em build de produção (`src/components/ClientErrorMonitor.tsx:7-14`). O coletor deduplica e limita fila/envio localmente, normaliza mensagens/URLs e só envia status, stack, method, URL ou imagem (`src/lib/error-collector.ts:31-136`; `src/lib/client-error-data.ts:30-81`). `safeErrorSource` retira query/fragment e `safeErrorText` aplica redação a padrões comuns de tokens, emails, telefones e números longos.
- A Server Function aplica allowlist de origens, limita payload por Zod, deriva `user_id` de token validado pelo Supabase quando presente e grava via service role; consultas exigem `assertSuperAdmin` (`src/lib/error-log.functions.ts:38-108`). A migration local habilita RLS e restringe SELECT a superadmin; INSERT direto autenticado requer identidade e eventual business próprios (`20261108122836_qa_client_error_log.sql:16-31`).
- **Resultado:** não foi identificado acesso de leitura indevido nem envio deliberado de headers/body/cookies no coletor revisado. A redação é baseada em padrões e não garante remover qualquer segredo arbitrário em mensagem/stack. O limitador servidor usa primeiro `X-Forwarded-For` e é em memória (`error-log.functions.ts:16-27,48-55`); se o proxy ativo não sobrescrever esse header, cotas podem ser manipuladas. O Caddy versionado normaliza `X-Forwarded-*` por padrão, mas runtime e acesso direto ao upstream não foram verificados.
- **Cobertura:** SEC-018 já registra a confiança em cabeçalhos de IP do cliente para rate limiting. Esta revisão não cria ID separado; retenção, limpeza periódica e volume dos registros reais não foram verificados.

### SEC-025 — corpo do webhook AgPay não tinha limite antes de leitura e HMAC

- **Estado:** corrigido localmente em 2026-11-14; limite efetivo da plataforma em produção continua desconhecido.
- **Gravidade:** P2 potencial por consumo excessivo de memória/CPU em endpoint HTTP público.
- **Módulo:** segurança / infraestrutura / webhook financeiro.
- **Esperado:** validar `Content-Length` e impor limite durante leitura em streaming antes de carregar o corpo inteiro e calcular HMAC/parsear JSON.
- **Observado antes da correção:** a rota chamava `request.text()` sem limite antes de verificar `x-webhook-signature`; os proxies versionados não declaravam limite para essa rota. O proxy relay em `ops/agpay-relay/server.mjs` tem limites próprios, mas não é usado pela rota pública observada.
- **Impacto:** se a borda encaminhar corpo arbitrariamente grande, tráfego não autenticado pode consumir memória no processo antes do HMAC rejeitar a requisição. Não houve requisição grande nem evidência de exploração; limites do host, CDN ou runtime ativo podem reduzir o risco.
- **Causa-raiz confirmada localmente:** verificação criptográfica dependia do corpo integral sem pré-limite explícito.
- **Correção local:** `agpay-webhook.ts` limita o corpo a 1 MiB, rejeita tamanho declarado inválido com 400 e payload acima do teto com 413. A leitura incremental também conta bytes quando `Content-Length` falta ou não representa o tamanho real; HMAC e JSON só são processados após leitura dentro do limite.
- **Regressão:** testes cobrem `Content-Length` acima de 1 MiB, stream de 17 blocos de 64 KiB sem cabeçalho (cancelado ao exceder o teto), validação da assinatura sobre o texto bruto e persistência. Focal 8/8; suíte completa 103 arquivos aprovados, 3 ignorados; 923 testes aprovados e 8 ignorados; `npx tsc --noEmit` e `git diff --check` passaram.
- **Comparação:** `whatsapp-incoming.ts` verifica `X-Webhook-Secret` antes de chamar `request.json()`, portanto não compartilha exatamente esta ordem de leitura.
- **Limitação:** borda/limites de request da implantação não foram consultados. O handler local impõe o teto independentemente desses controles; configuração externa e payloads reais do provedor não foram verificados.

### SEC-026 — validação de produção aceitava URL e origins HTTP

- **Estado:** corrigido localmente em 2026-11-14; configuração remota e terminação TLS continuam desconhecidas.

- **Estado:** divergência entre documentação operacional e validação local confirmada; configuração real desconhecida.
- **Gravidade:** P2 potencial, condicionada a configurar URL/origem sem TLS efetivo.
- **Módulo:** segurança / configuração de origem / transporte.
- **Esperado:** em produção, `PUBLIC_APP_URL` e origens autorizadas devem exigir HTTPS; HTTP deve ficar limitado a desenvolvimento local.
- **Observado:** `validateProductionConfig` aceita protocolos `https:` e `http:` para ambos `PUBLIC_APP_URL` e cada entrada de `ALLOWED_APP_ORIGINS` (`src/lib/production-config.ts:10-28`). A origem de `PUBLIC_APP_URL` precisa apenas existir na allowlist. Documentação chama `PUBLIC_APP_URL` de URL pública HTTPS (`docs/master-access.md:12`), e a configuração versionada Caddy habilita hosts públicos com HTTPS automático, mas não prova a configuração real de env/proxy.
- **Impacto:** configuração inadvertida HTTP pode permitir tráfego de autenticação/impersonação ou chamadas destinadas a origem autorizada sem TLS, expondo tokens/credenciais em trânsito se a borda não forçar redirecionamento/HTTPS de ponta a ponta. Não foi verificado valor de produção nem tráfego.
- **Causa-raiz confirmada:** a validação de protocolo não diferenciava produção de desenvolvimento.
- **Correção local:** `validateProductionConfig` agora exige HTTPS em `PUBLIC_APP_URL` e em cada origem quando `NODE_ENV=production`. Fora de produção, HTTP fica permitido somente para `localhost`, `127.0.0.1` e `::1`; origins HTTP remotas são rejeitadas.
- **Regressão:** testes cobrem URL pública HTTP em produção, origem HTTP em allowlist de produção, localhost HTTP em desenvolvimento e host remoto HTTP em desenvolvimento.
- **Limitação:** configuração do EasyPanel/CDN e redirect efetivo não foram consultados; risco pode estar mitigado fora do código.

### SEC-027 — login SDR rejeita hashes legados de PIN

- **Estado:** corrigido localmente; inventário de contas reais e implantação não verificados.
- **Gravidade:** P2 potencial.
- **Causa-raiz:** SHA-256 legado era aceito indefinidamente, e contas sem login mantinham um verificador de quatro dígitos fácil de enumerar offline.
- **Correção local:** login agora aceita somente hashes `scrypt$`; qualquer hash antigo é recusado com orientação para pedir redefinição ao Master. A edição do SDR exige um PIN novo enquanto o hash salvo não é scrypt; a gravação usa salt novo e incrementa `session_version`, revogando tokens anteriores. A verificação SHA-256 foi removida do caminho de autenticação.
- **Regressão:** testes confirmam que PIN legado não autentica nem é migrado no login, que o Master não salva alterações sem PIN novo e que uma redefinição substitui o hash por scrypt e avança a versão da sessão.
- **Validação (2026-11-14):** `src/lib/sdr.functions.test.ts` e `src/lib/sdr-token.test.ts`: 2 arquivos, 25/25; `npx tsc --noEmit` e `git diff --check` passaram.
- **Limitação:** nenhum hash, conta ou backup real foi lido. Contas existentes com SHA-256 precisam de ação do Master para definir PIN novo; não houve migration ou operação remota.

## Ciclo 142 — integridade das permissões de profissionais

- A função `has_business_permission` usa as flags JSONB da linha de profissional, mas a policy `professionals_owner` autoriza INSERT/UPDATE/DELETE somente quando `owns_business(business_id)` (`20260822051036_65ff9c55-e6e8-494e-a12b-1e0769efdae6.sql:63-67`). A policy `professionals_self_read` concede ao profissional leitura da própria linha, sem policy correspondente de escrita (`20260914061103_47477866-82bb-429c-a497-d79b6fe31b18.sql:77-80`).
- A mutation server-side que grava `permissions` verifica o `businessId` e o `owner_id=context.userId` antes do uso de service role; consulta/atualização do profissional também filtram pelo business fornecido (`src/lib/professionals.functions.ts:36-44,116-138`).
- **Resultado:** não foi encontrado caminho de autoelevação por profissional alterar as próprias flags diretamente nas policies locais nem na função de gerenciamento inspecionada. A busca não demonstra que todas as migrations foram aplicadas em produção; a role pode ler suas permissões próprias, e o controle efetivo remoto não foi testado.
- Nenhum usuário ou permissão foi alterado; nenhuma chamada ao banco remoto ou processo Node foi executado. Sem novo ID de achado.

## Ciclo 143 — inventário de RLS por tabela nas migrations locais

- Varredura estática das migrations encontrou 40 nomes únicos de `CREATE TABLE` em `public`; os mesmos 40 têm `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` na chain local.
- 27 dessas tabelas têm policy declarada nas migrations. As outras 13 — `agpay_webhook_events`, `asaas_business_credentials`, `asaas_webhook_events`, `auth_attempts`, `business_whatsapp_credentials`, `master_impersonation_sessions`, `platform_settings`, `post_service_message_queue`, `sdr_config`, `sdr_ideas`, `sdrs`, `subscription_lifecycle_runs` e `whatsapp_greeting_replies` — não têm policy de linha; as migrations encontradas revogam acesso de `anon`/`authenticated` e concedem operações a `service_role`, modelo de acesso exclusivo pelo backend.
- **Resultado:** não encontrei tabela criada nessas migrations sem ativação explícita de RLS nem tabela sem policy sem revogação de papéis cliente na chain local. Isso não prova grants/default privileges efetivos, schema remoto, objetos criados fora da chain, nem integridade de toda sequência aplicada; o projeto de produção segue inacessível.
- Contagem feita por regex sobre DDL/ACL dos arquivos SQL, sem CLI, conexão remota ou execução de migrations. Sem novo achado ou alteração de dado.

## Ciclo 144 — revisão de ACL para funções privilegiadas

- Revi as 10 definições `SECURITY DEFINER` distintas da migration chain, seus `SET search_path`, `REVOKE`/`GRANT EXECUTE` e usos no source; também confirmei que os dois parsers de path do Storage são `SECURITY INVOKER` com path vazio.
- Não encontrei função `SECURITY DEFINER` sem `search_path` nem worker financeiro executável por roles cliente na chain local. Mantive como inconclusiva a possibilidade de enumeração via chamada direta autenticada de `has_role` com UUID de terceiro; policies chamam com `auth.uid()` e o source não contém chamada client-side direta.
- Sem conexão/consulta Supabase, CLI, execução SQL ou teste; sem novo achado. Catálogo remoto e acesso a RPC em produção continuam sem verificação.

#### Resolução local SEC-024 — 2026-11-15

O Caddy compartilhado e os headers globais do Vercel agora enviam X-Frame-Options DENY e CSP frame-ancestors 'none'. Isso impede framing sem acrescentar restrições de script/style/conexão. O teste src/security-headers.test.ts verifica ambas as configurações (1/1). A efetividade nos hosts, em proxy/CDN externo e após deploy não foi verificada.
#### SEC-011 resolvido localmente — 2026-11-15

A migration 20261115120000_subscription_payments_owner_read.sql remove subscription_payments_member_read e cria SELECT owner-only por owns_business(business_id). A chamada da assinatura já valida owner/super admin; escrita administrativa/webhook segue em service_role. Teste security-hardening passou 56/56; suíte DB 13 arquivos/110 testes, app 138 arquivos/1.072 aprovados e 8 ignorados, TypeScript e diff-check passaram. Nenhuma migration remota aplicada.

### SEC-018 — proxy chain público continua inconclusivo (2026-11-15)

Revalidei os três hosts documentados por DNS/HEAD somente leitura: os três resolvem para o mesmo registro A público; não há CNAME observado. HEAD segue 307 para `/auth` e 200 após redirect; não foram retornados `Via`, `CF-Ray`, `X-Cache` ou `Server` nos cabeçalhos coletados. Comparei sem exibir valores o IP A público do app com o host VPS definido localmente em `.env`: ambos resolvem, mas não coincidem. Esses sinais não identificam o equipamento/proxy ativo nem provam ausência de CDN ou proxy intermediário, e o backend pode ser acessível por outro caminho. Não alterei Caddy nem a seleção de IP em `clientIp()`. SEC-018 permanece bloqueado até confirmar a cadeia e bind/firewall do upstream; sem tráfego com headers falsificados e sem alteração remota.

### SEC-019 — retorno de impersonação falha fechado (2026-11-15)

Revalidei `returnToMasterSession` em `src/lib/lifecycle.functions.ts`: erros ao atualizar tentativas de PIN ou consumir o token único encerram a função antes de emitir sessão Master; no terceiro erro, o handler só afirma encerramento depois de confirmar o DELETE. `npx vitest run src/lib/lifecycle.impersonation.test.ts`: 11/11. Nenhuma sessão real ou banco remoto acessado; nenhum código alterado nesta revalidação. SEC-019 já constava corrigido localmente; tally histórico 128/17/6 permanece sem reconciliação.


### SEC-016 ? INSERT direto por owner bloqueado localmente (revalidado em 2026-11-15)

A migration aditiva `20261114150000_restrict_business_owner_insert.sql` revoga INSERT/DELETE autenticados em `businesses` e mant?m provisionamento no fluxo `service_role`. No Postgres isolado, a regressao confirmou que owner nao cria business com campos comerciais e que `service_role` continua criando: `npx vitest run -c vitest.db.config.ts tests/db/security-hardening.test.ts -t "cria??o de businesses autorizada"` passou 3/3 (53 ignorados). Nenhuma migration foi aplicada remotamente. A regra de descoberta/acesso de tenants e o deploy ainda nao foram verificados; a evid?ncia original de vulnerabilidade na chain sem a migration fica supersedida pela chain local atual.


### PAY-009/PAY-011 ? PIN e aprovacao de chave impostos no servidor (revalidado em 2026-11-15)

`createWithdrawal` valida o PIN contra o hash do negocio e confere se a chave e tipo atuais correspondem a um registro `pix_key_approvals` aprovado antes de inserir/reservar o saque. Os casos negativos confirmam que PIN incorreto ou aprovacao ausente/divergente impede criar withdrawal e nao chama o provider. Regressao completa do arquivo mockado: `npx vitest run src/lib/withdrawal.server.test.ts` passou 37/37. Nenhum saque real foi solicitado. Migration/deploy e chaves existentes em producao nao foram verificados; as descricoes iniciais de bypass estao supersedidas pela chain/codigo local atual.


### Reconciliacao SEC-004/SEC-006 - 2026-11-15

SEC-004: PIN de saque tem lockout persistente por user/business apos cinco falhas em 15 minutos por 30 minutos; o bucket de IP ainda depende de identificacao confiavel da origem em SEC-018, e o hash SHA-256 mantem risco offline se houver vazamento. SEC-006: assertSuperAdmin exige role super_admin/AAL2; login Master encaminha sessao AAL1 para enrollment/challenge e bloqueia o painel sem AAL2. Regressao focal security-pin, withdrawal, require-super-admin, master-mfa e auth passou no lote de 7 arquivos/93 testes. Fatores, Auth settings e projeto remoto nao foram consultados.


Complemento SEC-002 (2026-11-15): o conector Supabase lista apenas um projeto de peptídeos e retorna falta de permissão ao consultar o ref qagotnmdqjoodoudcikd configurado localmente. Não foram consultados outros projetos, dados, advisors ou tabelas. O GET REST anterior respondeu apenas com metadados do catálogo e não valida RLS/Auth/migrations remotos.


### SEC-006 revalidation - 2026-11-15

Current central guard requires claims.aal === aal2 before checking the current super_admin role; login routes AAL1 sessions to the Master enrollment/challenge route, and MFA verification confirms current assurance. Focused tests: require-super-admin.test.ts, master.functions.test.ts, master-mfa.test.ts, 19/19 across 3 files. Supabase project/Auth settings and real factors remain unverified. No real login or MFA factor used.

Revalidacao DEP-003 (2026-11-15): npm registry reporta typescript-estree 8.72.2 ainda com minimatch ^10.2.2; upstream PR #13145 foi merged em 10/11 para ^11.0.1. Override restrito aplicado localmente com teste TDD (RED em 10.2.6, GREEN em 11.0.1), smoke lint passou com prettier/prettier desligado para isolar compatibilidade, TypeScript passou e npm audit total zerou. Manter override somente ate release upstream e remove-lo apos atualizacao. Fontes: https://github.com/typescript-eslint/typescript-eslint/pull/13145 e https://github.com/advisories/GHSA-g3hv-75wg-m249.

### DB-002 / SEC-002 ? metadata remota e policies lidas, advisors sem acesso (2026-11-15)

Conexao local por `DATABASE_URL` executou somente consultas a `pg_policies`, catalogo de tabelas e `supabase_migrations.schema_migrations`, em transacao `READ ONLY`, com `default_transaction_read_only=on`, finalizada por `ROLLBACK`. O banco retornou 62 migrations aplicadas ate `20261108122836`; das 90 migrations locais, 38 nao estao no historico remoto e ha 9 versoes remotas sem arquivo local. Nao aplicar a cadeia automaticamente: a divergencia exige reconciliacao. As policies atuais confirmam `customers_professional_read` e `appointments_professional_read` por `is_business_member(business_id)` e `services_member_read` pelo mesmo membership; `businesses_professional_read` exp?e a linha completa para profissional ativo. Como RLS controla linhas e nao projecao de colunas, isso confirma o risco estrutural de SEC-009/010, sem ler valores de clientes. O conector MCP negou migrations e advisors de seguranca/performance/health. Nenhuma linha de negocio, log ou segredo foi lido; nenhuma mutacao remota foi executada.


### SEC-007 revalidado ? PIN adicional permanece decisao de produto (2026-11-15)

Leitura atual confirma que `setPixKeyApprovalStatus`, `updatePixKeyApprovalEntry` e `updateBusinessTransferPin` usam `assertSuperAdmin`, mas nao recebem nem exigem prova do PIN exibido pela tela. Esse guard tambem exige AAL2 conforme SEC-006; portanto, a evid?ncia confirma ausencia do PIN adicional no servidor, nao ausencia de autorizacao Master/MFA. `npx vitest run src/lib/pix-approvals.functions.test.ts`: 2/2 para sucesso e falha parcial da aprovacao; teste usa mocks e chama handler sem PIN. Nao houve escrita real. SEC-007 continua condicional ate confirmar se o PIN e requisito server-side ou apenas gate visual; se for requisito, step-up curto, vinculado a usuario/acao, precisa ser validado no servidor.

### SEC-014 - correcao local (2026-11-15)

A migration `20261115113000_restrict_anon_catalog_reads.sql` revoga SELECT anon de tabela e coluna em sete tabelas do catalogo e remove as policies anon correspondentes. A rota publica `/agendar/$slug` usa Server Function com `service_role`; nao ha rota de diretorio neste repo. RED confirmou SELECT anon em `business_hours`; GREEN confirmou ausencia de privilegios anon e preservacao dos grants de `authenticated` e `service_role`. Banco descartavel; migration remota nao aplicada.

### SEC-002/009/010 — evidência direta read-only (2026-11-15)

A conexão `DATABASE_URL` local autenticou no projeto configurado. Em transação read-only, a consulta a `pg_policies`, `information_schema.role_table_grants` e `column_privileges` confirmou `customers_professional_read` por membership e `businesses_professional_read` para profissional ativo, além de grants SELECT amplos. Isso confirma a exposição estrutural indicada em SEC-009/010, sem ler linhas de clientes ou segredos. O MCP ainda nega advisors do Supabase. Não alterei policy/grant, pois as rotas atuais da agenda fazem `select(*)` de appointments e uma restrição exige migrar os consumers antes para evitar falha do painel.
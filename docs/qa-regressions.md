# Regressões e QA — spec 002

O runner usa um Chromium, com páginas/contextos sequenciais. A varredura autenticada usa navegação SPA; os estágios de cobrança usam contextos curtos, transferindo apenas as dispensas, para limitar a memória. `npm test` também usa um único worker por padrão.

## Ambiente local

Use o servidor existente em `http://localhost:3002`. Para iniciar quando a porta estiver livre:

```powershell
node --env-file=.env.local --max-old-space-size=768 node_modules/vite/bin/vite.js --port 3002 --strictPort
```

O `--env-file` disponibiliza as variáveis também ao SSR. Configure `ALLOWED_APP_ORIGINS=http://localhost:3002` no `.env.local`. Execute as verificações em sequência:

```powershell
node scripts/qa/images.mjs
node scripts/qa/seed.mjs
npm test
npm run qa
node scripts/qa/verify-regression.mjs
```

As credenciais ficam somente no `.env.local`, ignorado pelo Git:

| Variável                                | Uso                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `QA_OWNER_PHONE`, `QA_OWNER_PASSWORD`   | Login do dono de **Teste sdr**                                                                               |
| `QA_TEST_OWNER_PASSWORD`                | Opcional: define a senha forte desse dono no seed; use o mesmo valor de `QA_OWNER_PASSWORD`                  |
| `QA_MASTER_EMAIL`, `QA_MASTER_PASSWORD` | Login da equipe Master                                                                                       |
| `QA_BASE_URL`                           | URL do servidor; padrão `http://localhost:3002`                                                              |
| `QA_SCENARIOS`                          | Subconjunto separado por vírgulas: `avisos,navegacao,impersonacao,agendamento,ficha,monitoramento,varredura` |
| `QA_PRODUCTION=1`                       | Usa o coletor instalado no build de produção, sem importar módulos do Vite no cenário de monitoramento       |

O seed só escreve no estabelecimento **Teste sdr**, slug `teste-sdr-g1jw`. Nome/slug/ID são validados antes da escrita. Alterações de credenciais exigem também que o dono pertença exclusivamente a esse negócio. IDs determinísticos tornam serviços, profissional e agendamentos idempotentes. A fixture recebe acesso ativo de sete dias, sem trial, com o valor padrão de R$ 89,90, evitando expiração do cadastro de teste entre entregas; não há geração de pagamento. O helper de estágios restaura `access_until` e `status` em `finally`.

O cenário de ficha restaura nome, responsável, telefone e senha de teste. O agendamento público remove apenas a reserva com nome único criada pelo cenário; o teste de catálogo vazio restaura a ativação anterior dos serviços. Nenhum cenário gera cobrança Pix.

Broadcasts são lidos do cadastro existente; a suíte não publica avisos globais para clientes. Trial não possui popup dispensável na interface atual: o tipo é coberto pelos testes do store comum.

## Evidência e falhas

O runner grava `test-results/qa/latest.json`, com resultado e duração de cada cenário, e retorna código diferente de zero quando qualquer cenário falha. Verifica console, HTTP com erro, imagens quebradas, placeholders inválidos, estados de erro e os fluxos de regressão. Aguarda a rota resolvida, além da URL otimista, antes de verificar a tela. Mensagens/stack traces do painel de diagnóstico são conteúdo técnico intencional, excluído somente da busca de placeholders.

`verify-regression.mjs` injeta falhas apenas no navegador de teste e exige a detecção específica de persistência desativada, indicador de suporte ausente, skeleton na navegação e confirmação de agendamento interrompida. Evidências ficam em `test-results/qa/regression-*.log`.

Os exploratórios substituídos foram retirados de `scripts/`; cópias locais reversíveis estão em `test-results/qa/legacy-scripts/`. `qa-fotos.mjs` e `qa-flicker-real.mjs` permanecem como diagnósticos específicos de imagens com dados reais, fora da correção desta spec.

## Validação com os três domínios

O caso de suporte precisa também do build com `VITE_SPLIT_PANELS=true`. Com o dev parado para poupar memória, execute:

```powershell
node --env-file=.env.local scripts/qa/verify-split-panels.mjs
```

O comando compila com heap de 768 MB, inicia o artefato com heap de 512 MB e sobe um proxy HTTPS em `127.0.0.1:443`. Requer essa porta livre e OpenSSL no PATH ou na instalação do Git para Windows. O certificado de teste fica na pasta ignorada `test-results/qa/`. Os três nomes públicos são resolvidos para o loopback apenas no Chromium do teste; as chamadas Supabase usam o projeto autorizado.

O cenário confirma entrada em até 3 segundos, navegação até Serviços, F5, permanência na origem inicial, retorno com PIN, encerramento de sessão expirada no F5 e encerramento após três PINs incorretos. Logs e resultado ficam em `test-results/qa/qa-split-panels.log` e `test-results/qa/split-panels.json`. O comando encerra seu navegador, proxy e servidor ao terminar.

## Configuração e aplicação no servidor

Em produção são obrigatórios `PUBLIC_APP_URL`, `ALLOWED_APP_ORIGINS`, `MASTER_SECURITY_PIN` e `MASTER_RETURN_PIN`. A lista de origens deve incluir a origem de `PUBLIC_APP_URL`; os PINs devem conter de 6 a 12 dígitos. O servidor recusa configuração inconsistente na inicialização.

Os PINs são **env-only**, sem edição pela interface. O valor operacional acordado para ambos é `41410070`. A tarefa **T011** exige alteração e verificação no EasyPanel/VPS; mudar `.env.example` não executa essa ação.

As duas migrations abaixo foram aplicadas no projeto **`qagotnmdqjoodoudcikd`** em 2026-11-08:

- `supabase/migrations/20261108122833_qa_dossier_audit.sql`: permite `edicao_ficha` e `troca_senha_dono` na auditoria.
- `supabase/migrations/20261108122836_qa_client_error_log.sql`: cria a tabela, índices, grants e RLS dos erros.

A aplicação usou a API de gerenciamento, com uma transação para as duas migrations e seus registros no histórico, preservando as versões dos arquivos. A verificação posterior comparou o SQL registrado com os arquivos e confirmou a constraint de auditoria, a tabela, os índices, RLS e as duas policies. Recibo e verificação estão em `test-results/qa/migrations-applied.json` e `test-results/qa/migration-verification.json`. Não reaplique os arquivos já registrados.

O coletor de produção captura erros de UI, rejeições não tratadas, imagens quebradas e falhas HTTP/rede. Deduplica, limita o volume e remove segredos/PII antes de enviar. Relatos públicos passam pelo servidor com validação de origem e limite por minuto; não há INSERT anônimo direto na tabela. A consulta em `/painel/erros` exige `super_admin`, inclusive no servidor.

## Estado verificado nesta execução

O token de gerenciamento fornecido foi salvo apenas no `.env.local`, ignorado pelo Git, e permitiu concluir a aplicação das duas migrations. Os erros anteriores `PGRST205` e de constraint de auditoria foram resolvidos. Ficha, nova credencial de login, auditoria, gravação/deduplicação de erro anônimo e painel do Master passaram na validação integrada. O cenário de monitoramento também verifica RLS pela API: nega INSERT anônimo, permite INSERT do dono no negócio de teste, oculta o feed do dono, permite leitura pelo Master e nega ator falsificado; os registros temporários são removidos.

Na rodada final, **779 testes passaram, 8 foram ignorados**, e **7/7 cenários da QA passaram**, incluindo a varredura de **27 telas/rotas**. O acesso de suporte levou **1956 ms**. Os PINs locais foram padronizados para o valor acordado e o dev da porta 3002 foi reiniciado com heap limitado a 768 MB. Resultados em `test-results/qa/latest.json` e `test-results/qa/qa-support-final.log`.

A rota `/painel/erros` permanece explicitamente no subdomínio `admin`, e o modal de acesso informa a faixa correta de 6 a 12 dígitos. A verificação de produção fez uma tentativa com o PIN operacional acordado no acesso protegido, que não foi aceita. A verificação do retorno ficou inconclusiva porque o FAB não apareceu na tentativa de suporte. Evidência em `test-results/qa/production-pins.json`; isso não substitui a execução de T011 na VPS. T036/T037 estão concluídas pela validação local; T011 permanece aberta.

A tarefa **T011** continua dependendo de acesso SSH/EasyPanel à VPS; o token do Supabase não dá acesso a esse servidor. Os advisors foram executados antes e depois das migrations: nenhum novo achado de segurança; os quatro índices recém-criados geraram apenas avisos informativos de uso ainda não observado. A checagem de TypeScript dos módulos alterados passou com heap limitado; a checagem do projeto inteiro excedeu o limite de memória e não está certificada por este resultado.

Após o usuário informar o deploy com os dois PINs, o acesso protegido aceitou o valor acordado. Na verificação anterior ao envio do código desta spec, a main remota ainda estava no commit `ae0cac2`; o site não apresentava os controles novos de edição da ficha nem o link do painel de erros, e o retorno não pôde ser validado porque o FAB não apareceu nessa versão antiga. O aceite local e a aplicação das migrations não representam um deploy da aplicação na VPS.

O build de produção foi validado localmente com heap de 768 MB e o dev pausado temporariamente. Um smoke no artefato compilado confirmou o coletor automático de produção, sua deduplicação, RLS e o painel do Master, sem importar módulos do Vite. A checagem dos 765 arquivos públicos não encontrou credenciais privadas. Resultados em `test-results/qa/build-production.log` e `test-results/qa/production-build.json`; o dev foi restaurado na porta 3002.

Após salvar as variáveis corretas no EasyPanel, o monitoramento público passou em produção: registro, deduplicação e consulta pelo Master, com limpeza do evento de teste. O suporte entrou em menos de um segundo, mas a navegação de domínio ainda enviava o dono de `admin` para `painel`, onde a sessão não existia. A correção usa o valor `isMaster`, separa o cache de status por usuário e preserva a origem durante suporte e sua validação. Se a validação após F5 recusar a sessão, o acesso gerado é encerrado localmente com mensagem clara e retorno ao login. O build com os três domínios passou: entrada em 1933 ms, navegação/F5, retorno, expiração e três PINs errados. Os testes unitários passaram com 779 aprovados e 8 ignorados. A publicação dessa correção e a validação final do retorno em produção ficam registradas em tasks.md.

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

Entrega validada em produção em 2026-11-08, com o código do commit `592fcbc`. O usuário configurou e publicou os PINs e as origens no EasyPanel. Os dois PINs foram aceitos; o suporte entrou em **938 ms**, manteve a origem administrativa e retornou ao Master com o modal fechado e o token de suporte removido. A ficha apresenta os controles de edição e o painel de erros está acessível pelo menu. Evidência em `test-results/qa/production-pins.json`.

O monitoramento público passou na versão publicada: o erro sintético foi registrado uma única vez, apareceu no painel do Master e foi removido ao final. Evidência em `test-results/qa/production-monitor.json`.

Validação automatizada: **779 testes aprovados, 8 ignorados**, **7/7 cenários de QA** e **27 telas/rotas**. O cenário de suporte inclui navegação, F5, sessão expirada e três PINs errados. O gate HTTPS com os três domínios compilou o artefato e passou com entrada em **1933 ms**. Resultados em `test-results/qa/latest.json`, `qa-support-final.log`, `qa-split-panels.log` e `split-panels.json`.

As duas migrations foram aplicadas e conferidas no projeto correto. A QA também confirmou RLS pela API: INSERT anônimo negado, INSERT do dono com identidade própria permitido, feed oculto do dono/visitante, leitura do Master permitida e ator falsificado negado. Os advisors executados antes/depois não apresentaram novos achados de segurança; os índices novos geraram somente INFO de uso ainda não observado. O token de gerenciamento está apenas no `.env.local` ignorado pelo Git.

O build passou com heap limitado e os arquivos públicos foram verificados sem credenciais privadas. A checagem TypeScript dos módulos alterados passou; o projeto inteiro excedeu o limite de heap e não está certificado por esse resultado. O dev permanece na porta 3002 com heap de 768 MB.

**T001–T039 concluídas**, incluindo a operação T011 confirmada em produção. A origem do suporte é preservada e o cache de status Master é separado por usuário. A correção direta de fotos continua fora do escopo; o monitoramento publicado fornece a evidência necessária para investigar esse relato.

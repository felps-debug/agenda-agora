# Atualização do Agenda Agora — novembro de 2026

Esta nota registra as mudanças de novembro e a revisão local da versão. A linha do tempo de publicação está atualizada na seção final; o estado de produção posterior ao deploy de 04/11 não foi verificado nesta revisão.

## O que está sendo ajustado

- A área de pagamentos passa a aparecer como **Carteira**. Os valores de taxa ficam salvos na plataforma e deixam de depender do navegador do Master.
- O acesso de SDR e Master recebe limites para tentativas inválidas, PINs configurados no ambiente seguro e opção para gerar uma senha temporária quando um dono perde o acesso.
- A conclusão de um atendimento pode agendar uma mensagem de pós-atendimento no WhatsApp. A tela de Integrações também oferece uma mensagem de teste para um número informado.
- O ciclo de assinatura pode cancelar negócios inadimplentes a partir do dia 15. Essa opção nasce desligada; nenhum cancelamento automático será ativado sem decisão do Welison.
- A tela de pagamento permite configurar sinal fixo ou percentual. O valor mínimo precisa ser confirmado com a AgPay antes de liberar percentuais que possam gerar um sinal abaixo do piso do provedor.
- A agenda pública segue no layout Elegance e permite dias por serviço. Nenhum dia já salvo será alterado até revisar os dados e decidir a regra para negócios abertos no domingo.
- Ações antigas do Master sem tela em uso foram retiradas. O catálogo e o editor de artes que aparecem na área de modelos continuam disponíveis.

## O que continua pendente

- As telas do Master, SDR, AS Pay e WhatsApp ainda precisam de uma revisão de controles para separar funções operacionais de itens apenas visuais. A lista de revisão será compartilhada antes de pedir qualquer aprovação ao Guilherme.
- Depois dessa revisão, o Guilherme deve aprovar a lista concreta de controles que serão ocultados ou removidos. Não há uma lista final para aprovação nesta versão do documento.
- A consulta sobre serviços que podem atender aos domingos depende de leitura do banco de produção. Nenhum dia de atendimento existente será alterado até essa consulta e a decisão do Welison.
- A mensagem de teste do WhatsApp envia uma mensagem real para o número informado; use apenas um número autorizado durante a revisão.
- O reset de senha gera uma senha temporária exibida uma vez. O responsável deve entregá-la ao dono pelo canal combinado e orientar a troca depois do primeiro acesso.

## Situação

A branch main contém os commits publicados no repositório. Na consulta local de 15/11, HEAD era 323189d (12/11), 24 commits à frente do hash aa4a32e registrado no deploy de 04/11. Isso não confirma que os commits posteriores chegaram à produção. O worktree atual também contém alterações locais de auditoria sem commit ou push; elas não fazem parte do HEAD.

## Atualização em 15/11/2026 — histórico e escopo

- O registro de 04/11 documenta publicação no Easypanel a partir de `main`, no hash `aa4a32e`. A consulta de Git desta revisão confirmou que esse hash é ancestral de `main`; o HEAD local é `323189d` (12/11), com 24 commits posteriores. O estado de produção após o deploy registrado não foi consultado.
- O commit `742114f` (05/11) registra: layout Elegance fixo, com ajustes de cor e fonte; mensagens Resumo/Avisar editáveis com novos textos padrão; cupom de assinatura exibido somente quando ativado pelo Master; e novo visual do pop-up de aviso. Esses são fatos do código/commit, não confirmação de disponibilidade atual em produção.
- As correções locais desta auditoria estão sem commit/push e não estão incluídas no hash de `main` acima.

## Decisões complementares de produto — 05/11

Além do escopo inicial, ficaram registradas estas decisões: o cupom de assinatura só aparece enquanto estiver ativo pelo Master; os textos de Resumo e Avisar podem ser editados e têm novos padrões; e o pop-up de aviso mantém uma identidade visual fixa. Os testes locais cobrem a validade do cupom, os textos enviados e a estrutura visual do aviso.

## Publicação EasyPanel — 2026-11-16

O servidor usa EasyPanel/Docker Swarm, diferente do caminho systemd do script `ops/vps/deploy-release.sh`. Há `Dockerfile` local para a imagem. A documentação oficial descreve deploy autenticado do App Service pela API (`deployAppService`) ou CLI, com token de usuário. Não existe credencial EasyPanel configurada no `.env` local. O SSH root fornecido permite atualizar o serviço Swarm sem token do painel: 1 réplica, política `start-first` e configuração de rollback já existentes. Fallback possível após build com tag imutável, `--update-failure-action rollback`, smoke HTTP nos três domínios e rollback registrado; não atualiza o histórico de deploy do EasyPanel. Ainda não executado. Próximos passos: reconciliar as 18 migrations legadas/renumeradas no histórico remoto, revisar as 22 migrations pendentes, aplicar com janela de compatibilidade código/schema e publicar pelo fluxo EasyPanel.
## Supabase produção — reconciliação e preflight — 16/11/2026

O `supabase db push --dry-run` oficial apontou 18 versões locais anteriores à última versão remota. A inspeção PostgreSQL em transação `READ ONLY` confirmou os efeitos estruturais esperados dessas versões: 6/6 tabelas, 23/23 colunas, 6/6 tabelas com RLS, três funções, valor `professional` no enum e constraint de sobreposição. As duas migrations com timestamps alternativos foram comparadas ao SQL já registrado remotamente e têm DDL efetivo equivalente.

Reparei **somente o histórico** com `supabase migration repair --status applied` para as 18 versões ausentes; não executei os SQLs antigos nem alterei schema/dados nessa operação. Um novo `db push --dry-run` lista exclusivamente as 22 migrations de 14–16/11. Preflight remoto read-only antes delas: 0 horários inválidos, 0 categorias de outro negócio, 0 sobreposições de agenda com/sem profissional e 0 referências de ledger para outro negócio. A migration adiciona `master_business_events.dedupe_key`, coluna ausente em produção; o índice unique pode ser criado sem colisões porque a coluna ainda não existe e os registros antigos receberão NULL.

As 22 migrations ainda **não foram aplicadas**. O próximo passo é revisar compatibilidade do app e publicar em fases; a correção AAL2/grants continua pendente na produção até a migration final. Nenhuma escrita em dados de negócio, deploy ou commit/push ocorreu.
T036 da spec 005 foi fechado em 16/11: `npm run lint` passou (0 erros, 34 avisos) e `npx tsc --noEmit` passou. Formatei os arquivos reportados pelo ESLint e corrigi os dois erros restantes; `git diff --check` sem erros de whitespace. Não rodei suíte de testes nesta limpeza de lint.
Build local pós-formatação — 16/11: `npm run build` passou; warnings do route generator sobre `*.test.tsx` e chunks acima do limite continuam, sem falha.
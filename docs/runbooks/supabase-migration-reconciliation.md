# Reconciliação de migrations Supabase — produção

Data da conferência: 2026-11-16. Projeto: Agenda Agora. Todas as consultas de dados abaixo foram executadas em transação `READ ONLY`.

## Estado confirmado

- Histórico antes da reconciliação: 62 versões remotas; 102 arquivos locais; 40 local-only.
- `supabase db push --dry-run` encontrou 18 arquivos anteriores ao último timestamp remoto. Os efeitos estruturais foram conferidos no remoto. As duas versões com timestamps diferentes (`20261103000100`/`20261104102146` e `20261106120000`/`20261106154639`) têm DDL efetivo equivalente.
- Ação realizada: `supabase migration repair --status applied` para as 18 versões abaixo. Esse comando só registra versões em `supabase_migrations.schema_migrations`; não executa o conteúdo SQL.
- Após a ação, `supabase db push --dry-run --skip-vault` lista somente as 22 migrations de 14–16/11. Não executar `--include-all`.
- Preflight read-only de dados para as constraints: horários inválidos 0; categorias entre negócios 0; sobreposições com profissional 0; sobreposições sem profissional 0; referências de pagamento/saque cruzadas no ledger 0.
- `master_business_events.dedupe_key` ainda não existe; a migration pendente o adiciona como NULL para linhas atuais e cria índice unique.

## Versões registradas como aplicadas

```text
20260822051036
20260822051050
20260902053903
20260902060129
20260907032606
20260907041401
20260907045316
20260907051645
20260907052710
20260907062041
20260907161213
20260914061103
20260914061139
20260916012915
20260916013512
20260916020000
20261103000100
20261106120000
```

## Migrations ainda pendentes

A lista autoritativa está no output do último `supabase db push --dry-run --skip-vault`: 22 arquivos com prefixos `20261114` a `20261116`. Antes de aplicá-los, revisar a ordem de compatibilidade com a versão do app em produção (imagem de 12/11) e fazer rollout por fases, especialmente as policies/grants que podem afetar a versão antiga.

## Estado de produção

O reparo de histórico é a única mutação feita nesta etapa. Não houve mudança de schema, dados de negócio, deploy, commit ou push. Em produção ainda faltam `has_super_admin_aal2()` e a restrição de leitura direta das colunas privadas de `businesses`; a migration `20261116060100` continua pendente.
## Faseamento validado em dry-run

- Fase 1 (15 migrations de suporte e integridade): `20261114120000`, `20261114210000`, `20261114220000`, `20261114232004`, `20261115003617`, `20261115010000`, `20261115020000`, `20261115025000`, `20261115030000`, `20261115060341`, `20261115070000`, `20261115080000`, `20261115100000`, `20261115110000`, `20261116044100`.
- Fase 2 (7 policies/grants restritivos): `20261114150000`, `20261114204014`, `20261114232840`, `20261114233557`, `20261115113000`, `20261115120000`, `20261116060100` — somente após publicar e verificar a nova imagem.
- Dry-run da Fase 1 validou a lista de 15 arquivos; não houve aplicação. A Fase 2 permanece pendente.

## Acesso ao banco suspenso até rotação

`supabase db dump --dry-run` imprime `PGPASSWORD` no script de execução e exibiu o valor do `DATABASE_URL` na saída da ferramenta. O comando não criou dump/backup. Rotacionar a senha do banco no Supabase e atualizar o `.env` antes de qualquer nova conexão; não repetir a senha atual. As credenciais não foram registradas neste runbook.
## Rotação da senha PostgreSQL

A documentação oficial do Supabase orienta redefinir a senha do banco em **Database → Settings** (ou Management API), e não com `ALTER ROLE`; a rotação gerenciada não causa downtime. A inspeção de nomes de variáveis dos serviços EasyPanel confirmou que nem `agenda-agora_app` nem `agenda-agora_cron` usam `DATABASE_URL`; eles usam a API Supabase. Portanto a rotação da senha usada pelo CLI/ensaios não exige alterar os serviços em execução. O PAT local não autenticou a rota de backup; o reset precisa ser feito na sessão do painel ou com token Management API válido.
## Publicação no VPS sem API do EasyPanel

Acesso SSH root já funciona e o serviço `agenda-agora_app` tem uma réplica, atualização `start-first` e rollback configurável. Isso permite publicar uma imagem com tag imutável por `docker service update` sem token do painel, preservando o serviço e sua configuração de ambiente. O comando precisa ativar `--update-failure-action rollback`; após o update, validar `docker service ps` e `/auth` nos três domínios. `docker service rollback agenda-agora_app` restaura a spec anterior. Esse caminho não registra a execução na aba Deployments do EasyPanel e não foi usado ainda; o código local continua sem commit/push conforme instrução do projeto.
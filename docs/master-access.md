# Acesso Master: administradores da plataforma

> **Atualização — 2026-09-28 (T098)**: a entrada em `/painel/master`, o menu e
> as funções Master dependem somente da role `super_admin` atual no banco,
> consultada em cada chamada. O login por e-mail e senha segue funcionando em
> `aal1`; MFA seria um endurecimento opcional futuro, fora desta entrega.

## Registro local de T098 — 2026-09-28

- `getSuperAdminStatus` e `assertSuperAdmin` consultam a role atual em
  `user_roles`; donos, contas sem a role e papeis revogados não recebem acesso.
  Claims/metadados do JWT não substituem a linha do banco. Funções
  administrativas e `requireMasterAccess` usam essa guarda; `/master` redireciona.
- Testes locais cobrem sessão `aal1` autorizada, dois IDs de administradores,
  revogação entre chamadas, donos distintos, role forjada, menu, função Master
  e guarda da URL. `auth.tsx` não foi alterado.
- Nao houve acesso a banco remoto nem validacao com duas contas reais. A conta
  sintetica legada nao pode iniciar sessao por codigo: `masterLogin` e o fluxo
  publico antigo nao existem no codigo; a presenca ou desativacao da conta no
  Supabase precisa ser confirmada pelo responsavel no ambiente autorizado.
- Um usuario `super_admin` tem acesso global aos negocios por desenho. Dados de
  negocio nao sao expostos a uma sessao de dono por esse painel: a guarda recusa
  a chamada antes de obter o cliente administrativo. A validacao cruzada com
  dados reais continua pendente em ambiente isolado.

> **Nota histórica — 2026-09-25**: o TOTP/MFA deixou de ser exigido no login
> Master. Os procedimentos e desenhos antigos com `aal2` mais abaixo não são
> requisitos desta entrega; MFA fica como recomendação opcional futura.

## Estado da implementação local — 2026-09-24

T052, T053, T054, T055 e T057 foram implementadas localmente. A guarda atual de
`/painel/master` exige a role atual; o caminho legado `/master-login`
foi removido e `/master` redireciona para `/painel/master`.

Continuam pendentes, em ambiente autorizado com contas de teste, as validações manuais:

- **T056**: validar dois administradores provisionados antes do corte, incluindo login,
  tarefas Master, revogação/reconcessão e dono sem acesso.
- **T058**: localizar, revogar e desativar a conta sintética legada; confirmar que não autentica.
- **T059**: executar o cenário P8 completo descrito abaixo/no `quickstart.md`, cobrindo admins
  simultâneos, dono comum, role revogada, isolamento e uso no shell comum.

Nenhuma conta ou banco remoto foi acessado nesta implementação. Registrar os resultados dessas
validações neste documento e no `quickstart.md` após executá-las.

Procedimento para dar, usar e retirar o acesso de administrador da plataforma
(Master) com contas Supabase normais, e para desativar a conta legada de código
fixo. Atende FR-016, FR-017 e FR-018 da spec
[`002-correcoes-pos-teste-manual`](../specs/002-correcoes-pos-teste-manual/spec.md)
(US8, tarefas T048–T059).

> Este documento não contém e-mails, senhas, códigos TOTP nem chaves. Quem
> executa preenche os marcadores `<...>` na hora, em canal privado. Nenhuma
> etapa daqui foi executada contra o projeto remoto ao escrever este documento.

## Modelo de acesso

| Requisito                     | Como é atendido                                                                                                                                                                                                                      | Fonte                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Role por conta, várias contas | Linha `(user_id, 'super_admin')` em `public.user_roles`, com `UNIQUE (user_id, role)`. Vale para quantas contas forem necessárias.                                                                                                   | migration `20260907045316_...sql`                                           |
| Ninguém se promove sozinho    | `authenticated` só tem `SELECT` em `user_roles` (políticas `user_roles_select_own` e `user_roles_admin_read`); `INSERT/UPDATE/DELETE` só para `service_role`.                                                                        | mesma migration                                                             |
| Login                         | E-mail + senha forte na mesma tela `/auth` dos donos (dono continua com telefone + PIN).                                                                                                                                             | `plan.md` (P8), `contracts/server-functions.md`; implementação em T051      |
| Segundo fator                 | Não exigido nesta entrega. MFA pode ser avaliado como endurecimento opcional futuro, sem alterar o fluxo atual de login.                                                                                                             | Fora do escopo desta entrega                                                |
| Checagem no servidor          | Cada função Master exige role atual no banco, consultada por `assertSuperAdmin`. Role em metadados do JWT não conta.                                                                                                                 | `src/lib/auth/require-super-admin.ts`, testes `require-super-admin.test.ts` |
| Revogação imediata            | Como a role é consultada no banco a cada chamada, apagar a linha em `user_roles` bloqueia a próxima chamada, sem esperar o token expirar. As políticas RLS com `has_role(auth.uid(), 'super_admin')` também deixam de valer na hora. | T048/T053; `has_role` na migration acima                                    |

### Pontos de autorização que devem usar a guarda central (T053)

Toda leitura ou escrita Master deve chamar `assertSuperAdmin` de `src/lib/auth/require-super-admin.ts` (role atual no banco). Nenhum arquivo pode manter uma checagem própria de `user_roles`.

| Arquivo                                   | Situação hoje                                                                                    | O que T053 precisa fazer                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `src/lib/admin.functions.ts`              | Usa `assertSuperAdmin(context.userId)`, só role. `getMasterStatus` consulta `user_roles` direto. | Passar o `context` da sessão para a guarda; `getMasterStatus` também por ela. |
| `src/lib/outreach-templates.functions.ts` | Usa `assertSuperAdmin`, só role.                                                                 | Passar o `context` da sessão.                                                 |
| `src/lib/master.functions.ts`             | Hoje só um placeholder vazio (`export {}`), listado em T053.                                     | Aplicar a guarda em leituras e escritas.                                      |
| `src/lib/whatsapp.functions.ts`           | A autorização Master deve usar a guarda central de role atual.                                   | Evitar consulta local de `user_roles`.                                        |

### Estado histórico do código em 2026-09-24 (antes de T051–T057)

- Naquele estado anterior, `assertSuperAdmin(userId)` conferia só a role; as decisões posteriores mantiveram essa regra.
- `src/routes/auth.tsx` recusa contas `super_admin` no login normal ("Use o acesso exclusivo do Master"). T051 remove essa recusa.
- Não há tela TOTP. T052 cria `src/routes/_authenticated/painel.master-auth.tsx`.
- Acesso legado ativo: `src/routes/master-login.tsx` + `masterLogin` em `src/lib/admin.functions.ts`. Essa função pública compara um código fixo de 8 dígitos (a mesma string é a senha), **cria ou promove** uma conta sintética `<código fixo>@agenda.local` com `user_metadata.master_access = true`, faz `upsert` da role `super_admin` e devolve uma sessão. É o único caminho do código que concede `super_admin`, e é público. Sai em T057.
- `claimMaster` já só lança erro; sai em T057.
- `src/lib/whatsapp.functions.ts` tinha uma checagem própria `isSuperAdmin`; a autorização Master atual deve centralizar a conferência da role.
- Os outros pontos que escrevem em `user_roles` gravam só `owner` (`createBusinessWithOwner`) e `professional` (`professionals.functions.ts`). Nenhum aceita a role vinda do cliente.

## Regras

1. Conceder e revogar `super_admin` **só** por operação administrativa: SQL executado por um operador com credencial `service_role`/dono do projeto (SQL Editor do Supabase ou `psql` com a `DATABASE_URL` do `.env` do projeto certo). Nunca por função de servidor, formulário, parâmetro de URL ou entrada do cliente.
2. Não criar endpoint para conceder role. Depois de T057, `masterLogin` deixa de existir e nenhum código concede `super_admin`.
3. Toda concessão e revogação é registrada fora do repositório (data, quem executou, `user_id`, motivo). O repositório guarda só este procedimento.
4. Cada administrador tem a própria conta nominal. Nada de conta compartilhada.
5. Ensaiar tudo primeiro no ambiente isolado (T004); produção só depois de T056 aprovado.

## Requisitos do Supabase Auth (painel do projeto)

Conferir no painel do projeto certo antes de provisionar. O `supabase/config.toml` do repositório não versiona essas opções.

- **Provedor Email habilitado**, com confirmação de e-mail ligada.
- **Senha forte**: tamanho mínimo de pelo menos 12 caracteres e exigência de letras maiúsculas, minúsculas, números e símbolos. Ligar a proteção contra senhas vazadas se o plano permitir.
- **MFA TOTP**: opcional; não habilitar como pré-requisito desta entrega. Pode ser avaliado futuramente sem mudar o requisito atual de acesso.
- **Cadastro público**: não abrir cadastro por e-mail só por causa dos admins. As contas admin são criadas pelo operador (convite ou "Add user").

## Provisionar um administrador

Pré-requisito: publicar a guarda e o login atuais no ambiente em que se provisiona. O acesso depende da role `super_admin` atual no banco; MFA não é exigido.

1. **Conta**: o dono do produto informa o e-mail real do administrador. O operador cria o usuário no painel Supabase (Authentication → Users → Invite/Add user). O administrador define a própria senha forte pelo link de convite ou recuperação. O operador não escolhe nem conhece a senha.
2. **Conferir identidade**: anotar o `user_id` (uuid) da conta criada.
3. **Conceder a role** (operador, SQL):

   ```sql
   insert into public.user_roles (user_id, role)
   values ('<uuid-do-admin>', 'super_admin')
   on conflict (user_id, role) do nothing;
   ```

4. **Acesso do administrador**: entra em `/auth` com e-mail e senha e abre `/painel/master`. A role é conferida no servidor em cada chamada.
5. **Conferir**: o administrador conclui uma tarefa de leitura em `/painel/master`; uma conta sem a role deve ser negada por URL e função.

## Revogar um administrador

1. **Tirar a role** (efeito na próxima chamada ao servidor):

   ```sql
   delete from public.user_roles
   where user_id = '<uuid-do-admin>' and role = 'super_admin';
   ```

2. **Se a conta também deve perder o acesso ao produto**: bloquear o usuário no painel (Authentication → Users → Ban) ou apagar a conta. O bloqueio impede novo login e a renovação da sessão. Um access token já emitido continua válido até expirar, mas as funções Master já recusam pelo passo 1.
3. **MFA futuro opcional**: se vier a ser habilitado por decisão posterior e um fator for comprometido, remover o fator do usuário e exigir nova inscrição; isso não altera a regra de autorização desta entrega.
4. Conferir que `/painel/master` e uma função Master direta são negadas para essa conta, e registrar a revogação.

## Ordem segura de corte do acesso legado

O acesso legado é explorável pelo bundle, porque o código fixo está no JavaScript público e no histórico do Git. Por isso ele não pode conviver em produção com o acesso novo, e também não pode sair antes de existirem pelo menos dois administradores funcionando.

1. **Ambiente isolado (T004/T056)**:
   - aplicar T051–T055;
   - provisionar **dois** administradores pelo procedimento acima;
   - validar para ambos: login, tarefa em `/painel/master`, role revogada e nova concessão;
   - validar também que o dono comum não vê a navegação Master nem acessa por URL ou função.
2. **Remover o legado no código (T057)**: `masterLogin`, `claimMaster`, a constante do código fixo, `src/routes/master-login.tsx` e o redirecionamento de `src/routes/_authenticated/master.tsx` para `/painel/master`. Repetir no isolado o passo 1, para ambos os admins, com o build sem legado.
3. **Produção, antes do deploy**:
   - criar as contas dos dois administradores e conceder a role pelo SQL acima;
   - aplicar a política de senha definida pelo responsável; MFA permanece opcional e fora desta entrega;
   - o código antigo ainda em produção recusa essas contas no login normal, o que é esperado.
4. **Deploy único P8**: acesso novo e remoção do legado juntos (`plan.md`, "Um único deploy P8").
5. **Validar dois administradores em produção**: cada um faz login e conclui uma tarefa. Só seguir com **os dois** validados; se um falhar, corrigir antes de mexer na conta legada.
6. **Desativar a conta sintética legada (T058)**, só depois do passo 5:
   1. Identificar a conta:

      ```sql
      select id, email, created_at
      from auth.users
      where raw_user_meta_data ->> 'master_access' = 'true';
      ```

   2. Tirar a role: `delete from public.user_roles where user_id = '<uuid-legado>' and role = 'super_admin';`
   3. Bloquear ou apagar o usuário no painel, o que também encerra as sessões e a renovação delas.
   4. Confirmar que o código antigo não autentica: a rota `/master-login` não existe mais e um login com o e-mail sintético falha.
   5. Registrar data e resultado.
7. **Se precisar voltar atrás**: não reintroduzir o código fixo. Em caso de problema, revogar e conceder roles pelas seções acima, com pelo menos um administrador validado sempre ativo.

## Testes

- **Automatizados locais (sem rede)**:
  - `src/lib/auth/require-super-admin.test.ts`: role atual, sessão `aal1` autorizada com role, role revogada, dono comum, role forjada no JWT, falha fechada;
  - T049 cobre o login admin e a ausência do código fixo.
- **End-to-end (P8/T059) dependem de ambiente isolado autorizado** (T004): dois administradores simultâneos, dono comum sem navegação/URL/função, role revogada, isolamento de negócio e tarefa Master concluída sem sair do shell. Ainda não executados; registrar o resultado aqui (T056) e no `quickstart.md`.

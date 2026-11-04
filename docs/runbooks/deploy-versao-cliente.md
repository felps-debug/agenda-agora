# Deploy do endurecimento da versão do cliente

Este roteiro prepara a publicação da branch `endurecimento-010`. **Não faça o deploy de produção até o Welison aprovar e cadastrar os PINs/segredos.** Estado em 03/11/2026: as migrations até `20261103000000_security_hardening.sql` já foram aplicadas no projeto Supabase alvo (`qagotnmdqjoodoudcikd`); o deploy de produção e a migration destrutiva **não** foram executados.

## Pré-requisitos

- Revisar o diff completo e aprovar a migration `20261103000000_security_hardening.sql` após aplicá-la e inspecioná-la em banco de ensaio.
- Corrigir/registrar os itens pendentes em `specs/010-endurecimento-versao-cliente/tasks.md` (tests, typecheck/build, QA de navegador, banco de ensaio e compatibilidade de schema).
- Escolher novos valores para `MASTER_RETURN_PIN` e `MASTER_SECURITY_PIN`; cadastrar também `SDR_TOKEN_SECRET` e `ALLOWED_APP_ORIGINS` na VPS. Os valores ficam apenas no gerenciador de ambiente da VPS, nunca neste repositório.
- Confirmar o comportamento desejado para cancelamento automático no dia 15. O default da aplicação é desligado.
- Confirmar que o endpoint diário `/api/public/hooks/subscription-lifecycle` será agendado no serviço de cron da infraestrutura.
- Para a remoção das colunas `access_password` e `withdrawal_pin_plain`: a migration `20261103000100_drop_plaintext_secrets.sql` **existe** e foi exercitada no banco de ensaio. Só aplicar depois do deploy do código sem uso dessas colunas (já verificado: nenhuma referência fora de `types.ts`) e com novo backup lógico.

## Ordem de publicação

1. Fazer backup lógico do banco e guardar o artefato em local protegido com acesso restrito. Registrar data, tamanho e resultado do backup sem copiar credenciais para logs.
2. Cadastrar as variáveis de ambiente exigidas pelo código, sem reiniciar ainda. Não cadastrar os novos PINs até confirmar que o deploy contém o leitor dessas variáveis.
3. Aplicar `supabase/migrations/20261103000000_security_hardening.sql` somente depois de ensaiá-la em uma cópia local limpa e validar as policies/grants reais de produção em modo somente leitura.
4. Publicar a imagem da branch `endurecimento-010` pelo processo normal da VPS. Não fazer push ou deploy a partir deste runbook.
5. Fazer smoke checks: login Master e SDR; bloqueio após tentativas inválidas; reset de senha temporária; edição de perfil do negócio; aprovação de chave Pix; mensagens de suporte; Pix/carteira; cron de assinatura desligado e logado; webhook WhatsApp com cabeçalho; fila pós-atendimento; páginas públicas de agendamento.
6. Confirmar logs e saúde do serviço, sem acionar pagamento real ou ligar cancelamento automático. Confirmar separadamente com o Welison se o dia 15 deve ser ligado.
7. Somente depois do deploy verificado: novo backup lógico, aplicar `20261103000100_drop_plaintext_secrets.sql`, regenerar `src/integrations/supabase/types.ts` (MCP `generate_typescript_types` ou CLI com token válido), rodar `npx tsc --noEmit` e `npm test` (o teste `reset-password.test.ts` procura as colunas no código) e registrar o resultado.

## Rollback

- **Antes da migration:** reverter a imagem para o release anterior e remover variáveis novas apenas se o release anterior não as usar.
- **Após a migration de endurecimento:** interromper o rollout e reverter a imagem se necessário. Não restaurar grants/policies manualmente sem revisar o schema real. Manter as tabelas auxiliares (`auth_attempts`, `platform_settings`, filas e logs) até uma migration de rollback revisada; a migration principal inclui um comentário de rollback, não um mecanismo de downgrade executável.
- **Após T046:** não há rollback de código que recupere o texto apagado. Recuperação de dados depende do backup protegido, da aprovação do Welison e de procedimento controlado. Não restaurar o backup inteiro sobre produção sem avaliar gravações posteriores.

## Registro pós-publicação

Registrar release, horário, resultado dos smoke checks, estado da chave de cancelamento automático e migrations aplicadas. Não registrar PINs, tokens, URLs de conexão ou conteúdo de mensagens de clientes.

## Como ensaiar antes (sem Docker)

```bash
npm run db:ensaio:check   # 68 migrations do zero em um Postgres descartável (5 a 11 s)
npm run test:db           # 68 testes de contrato de banco
```

Detalhes e limites em `specs/010-endurecimento-versao-cliente/banco-de-ensaio.md`.

## Variáveis obrigatórias no ambiente de produção (nomes, sem valores)

`MASTER_RETURN_PIN`, `MASTER_SECURITY_PIN` (6 a 12 dígitos), `SDR_TOKEN_SECRET` (mínimo 32 caracteres), `ALLOWED_APP_ORIGINS` (origens separadas por vírgula),
`WHATSAPP_WEBHOOK_SECRET` (mínimo 32), `PUBLIC_APP_URL`, `AGENDA_CRON_SECRET`. Sem elas, as funções que dependem de cada uma falham com mensagem clara em produção.
Os PINs antigos estiveram no histórico do Git: **trocar** por valores novos escolhidos pelo Welison.

## Aviso: migration aplicada antes do deploy

No projeto alvo, as migrations novas revogam escritas diretas do dono em `businesses`, fecham tabelas internas e trocam o limite de tentativas de login.
Qualquer versão **antiga** do app ainda ligada a esse banco passa a falhar nesses pontos. Use somente a versão desta branch com esse banco.


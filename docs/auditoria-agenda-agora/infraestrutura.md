# Infraestrutura e implantação — evidência local

## Artefatos revisados

- `Dockerfile`: build multi-stage Node 22; argumentos `VITE_*` no estágio build; runtime recebe apenas `.output`, executa como usuário `node`, expõe porta 3000 e healthcheck HTTP em `/auth`.
- `ops/vps/agenda-agora.service`: serviço sob usuário `agenda`, `EnvironmentFile=/etc/agenda-agora.env`, restart automático e hardening de systemd (NoNewPrivileges, PrivateTmp, ProtectSystem=full, ProtectHome e restrições de kernel/SUID).
- `ops/vps/Caddyfile`: reverse proxy para loopback 3000, redirect por subdomínio, HSTS, `nosniff`, Referrer-Policy; não declara trusted proxies. O padrão Caddy não confia headers forwarded recebidos, mas proxy/CDN anterior e topologia de produção não foram validados.
- Três systemd timers: AgPay events cada minuto, ciclo assinatura 06:00 America/Sao_Paulo e lembretes WhatsApp por hora; todos `Persistent=true` e com atraso aleatório. São arquivos versionados, não prova de instalação/estado enabled na VPS.
- `ops/vps/agenda-cron.sh`: chama loopback por curl com segredo Bearer do arquivo de ambiente; os handlers validam `AGENDA_CRON_SECRET` conforme revisão de código. Nenhum cron foi disparado.
- `ops/vps/deploy-release.sh`: build isolado de secrets de runtime, troca symlink `current`, reinicia systemd e verifica `/auth`; falhas de restart/health check acionam rollback de release (DEP-004/SEC-008).

## DEP-004 — rollback de release em falha (corrigido localmente em 2026-11-14)

**P2 potencial, propriedade do script confirmada; uso/impacto em produção desconhecidos.** `ops/vps/deploy-release.sh:32-46` muda `/opt/agenda-agora/current` para a nova pasta antes de reiniciar e testar; se o health check falhar, imprime status e sai com erro sem restaurar o symlink anterior. Como o serviço está com `Restart=always`, a instância pode continuar tentando iniciar a release defeituosa. Nenhum deploy foi executado. Reprodução segura: simular o ciclo em diretório temporário com serviço/HTTP fake e forçar falha do health check; verificar que o link continua no novo diretório. Recomendação para spec: guardar alvo anterior, restaurá-lo em qualquer falha pós-switch e confirmar saúde do retorno; testar falha no build, restart e health check.

## Limites

A configuração de runtime, sistema operacional, firewall, backup, disponibilidade dos timers, logs, versão realmente implantada, DNS/CDN e provedores não foi consultada. Não se leu arquivo de ambiente nem se executou script/deploy.

## DEP-006 — boot não valida todos os segredos declarados obrigatórios

**P2 potencial; diferença entre validação de inicialização e uso local confirmada, configuração efetiva desconhecida.** `src/server.ts:1-6` chama `assertProductionConfig()` antes de iniciar o servidor, mas `validateProductionConfig` verifica somente `PUBLIC_APP_URL`, `ALLOWED_APP_ORIGINS`, `MASTER_SECURITY_PIN` e `MASTER_RETURN_PIN` (`src/lib/production-config.ts:1-31`). `SDR_TOKEN_SECRET` e `WHATSAPP_WEBHOOK_SECRET` têm schema `optional()` em `src/lib/env-security.server.ts:5-19`, e `AGENDA_CRON_SECRET` não participa da validação de boot; os getters/handler os exigem no uso (`env-security.server.ts:49-61`; `src/integrations/supabase/cron-auth.ts:2-8`). Os runbooks listam esses nomes como obrigatórios (`docs/runbooks/deploy-versao-cliente.md:43-46`). Assim, ausência pode não impedir o processo de iniciar e o health check `/auth` de responder, mas as rotas/funções correspondentes falham quando acionadas; o cron responde HTTP 500 sem `AGENDA_CRON_SECRET`. Não se afirma que algum segredo esteja ausente na produção.

**Reprodução segura:** chamar `validateProductionConfig` com apenas as quatro variáveis atualmente consideradas válidas e omitir cada segredo adicional; a configuração permanece `ok`, enquanto teste isolado do `authenticateCronRequest` sem secret retorna 500. Não iniciar o serviço real nem imprimir variáveis. **Recomendação:** decidir quais segredos são requisitos de boot e validá-los sem mostrar valores, ou incluir readiness por capacidade com estado não sensível; cobrir ausência/valor malformado e garantir mensagem sem segredo. Nenhuma variável de ambiente foi lida nesta auditoria.

## Backup e recuperação — evidência documental parcial

- O runbook `docs/runbooks/deploy-versao-cliente.md` exige backup lógico prévio e pós-deploy e determina armazenamento protegido, registro de data/tamanho/resultado e cautela para não restaurar um dump completo sobre produção com gravações posteriores.
- Os artefatos versionados da spec 010 (`prod-policies.md` e `tasks.md`, notas datadas de 03/11/2026) registram historicamente um backup lógico do projeto então identificado como `qagotnmdqjoodoudcikd`, de 13 tabelas, guardado fora do Git. A mesma nota afirma que a migration destrutiva de remoção de colunas ainda não havia sido aplicada naquele registro.
- O artefato local excluído do Git não foi aberto, copiado ou validado. Este registro documental não confirma integridade, completude, cifragem, ACL/retention do armazenamento, execução de backups recorrentes nem capacidade de restore atual; também não prova o estado de produção em 13/11/2026.
- **Resultado:** existe evidência histórica de backup lógico específico e um procedimento de deploy que o exige; nenhum teste de restauração ou mecanismo contínuo de backup foi encontrado nos arquivos operacionais revisados (`ops/vps/`, `docs/runbooks/`). Isso é lacuna de evidência, não prova de inexistência de backups gerenciados pelo Supabase/VPS.
- **Próxima validação somente leitura:** consultar o projeto correto e o provedor de hospedagem para políticas/último backup, retenção e opções de PITR; restore deve ocorrer em projeto isolado sem sobrescrever produção. Não consultar nem exportar segredos em backup.

## DEP-005 — falha do ciclo diário não tem retry configurado no mesmo dia

**P2 potencial; arquivos de timer/service confirmam frequência e ausência de Restart, mas instalação atual e falhas reais são desconhecidas.** `agenda-subscription-lifecycle.timer` agenda uma vez ao dia às 06:00 `America/Sao_Paulo`, `Persistent=true` (`ops/vps/agenda-subscription-lifecycle.timer:1-8`). O service é `Type=oneshot`, chama `agenda-cron subscription-lifecycle` e não declara `Restart=` (`ops/vps/agenda-subscription-lifecycle.service:1-7`). Se a invocação diária falhar depois de disparar, os arquivos não definem retry até o próximo disparo do calendário. `Persistent=true` guarda a última ativação e recupera execuções perdidas enquanto o timer estava inativo — por exemplo, durante período em que o host estava desligado — mas não configura nova tentativa imediata após falha do service, conforme a documentação oficial do [systemd.timer](https://www.freedesktop.org/software/systemd/man/260/systemd.timer.html). Impacto: um erro isolado pode atrasar avisos e ações de ciclo de assinatura até a janela seguinte; o efeito depende da lógica do job e de qualquer cron alternativo não verificado. Reprodução segura: executar unit de teste equivalente com comando que falha e observar que nenhuma segunda ativação é configurada antes do próximo OnCalendar; não disparar o timer real. Especificação de correção deve definir retry/backoff e alerta para falha, preservando idempotência. Nenhum timer foi iniciado nem alterado.

## SEC-018 — bind do serviço e exposição do upstream não confirmados

O runbook da VPS declara a aplicação em `127.0.0.1:3000` (`docs/runbooks/vps-deployment.md:36`) e o Caddyfile versionado encaminha para esse endereço (`ops/vps/Caddyfile:1-3`). Porém, `ops/vps/agenda-agora.service` inicia o servidor Node sem definir `HOST` ou `NITRO_HOST`; ele importa apenas `/etc/agenda-agora.env`, cujo conteúdo não foi lido. O runtime Node do Nitro instalado nesta cópia deriva hostname dessas variáveis e, sem valor, deixa o host sem especificação. A documentação do Node.js descreve que `server.listen()` sem host pode aceitar conexões em endereço não especificado (`::` ou `0.0.0.0`, conforme o sistema operacional), em vez de loopback ([Node.js Net API](https://nodejs.org/api/net.html#serverlisten)).

Isso não confirma exposição ativa: o arquivo de ambiente pode definir o host e regras de firewall podem restringir a porta. A VPS, o socket em escuta, as regras efetivas de firewall e o acesso de rede ao upstream não foram consultados. O valor `HOST=0.0.0.0` no estágio de build do Dockerfile (`Dockerfile:32-37`) não demonstra o valor de runtime do unit systemd. Classificação permanece inconclusiva/condicional e integrada ao SEC-018, sem novo ID.

**Validação segura pendente:** confirmar por leitura no host implantado se `HOST`/`NITRO_HOST` estão definidos sem exibir valores de outras variáveis; inspecionar apenas endereço/porta do socket e regras de firewall, e verificar se o upstream é acessível fora do loopback em ambiente controlado. **Recomendação para a spec:** declarar explicitamente o bind de loopback no unit ou demonstrar controles equivalentes, e incluir verificação de implantação que confirme a exposição pretendida. Nenhuma configuração local ou do host foi alterada.

## Ciclo 143 — autenticação e janela de rotação dos crons

- `authenticateCronRequest` rejeita configuração sem segredo atual com HTTP 500, exige cabeçalho Bearer exato e retorna 401 quando não encontra token válido (`src/integrations/supabase/cron-auth.ts:2-23`). Compara digests SHA-256 usando `timingSafeEqual`; os três hooks (AgPay, lembretes e ciclo de assinatura) chamam a função antes do processamento (`src/routes/api/public/hooks/agpay-events.ts:8-10`, `whatsapp-reminders.ts:18-20`, `subscription-lifecycle.ts:28-30`). Não encontrei bypass de autenticação por rota nesta leitura estática.
- Se `AGENDA_CRON_SECRET_PREVIOUS` estiver definido, o valor permanece aceito sem expiração no código (`cron-auth.ts:3-22`). A busca nos runbooks/specs não encontrou procedimento para remover o anterior ao concluir a rotação. `ops/vps/bootstrap-cron-secret.sh:8-11` sobrescreve ambos com o mesmo valor recém-gerado; por si só não documenta uma troca sobreposta entre chave antiga e nova.
- **Resultado:** controle atual não apresenta falha local confirmada. A ausência de expiração automática e de instrução de limpeza é uma lacuna operacional condicional, não novo defeito: o impacto exige que um segredo anterior permaneça configurado após a janela de troca e seja conhecido por terceiro. Nenhum ID separado foi criado para evitar transformar ausência documental em incidente confirmado.
- **Validação pendente:** confirmar sem revelar valores se o env efetivo usa `AGENDA_CRON_SECRET_PREVIOUS`, por quanto tempo, e qual rotação é praticada; definir no runbook quando removê-lo e reiniciar/recarregar o serviço.
- Nenhuma variável foi lida, cron chamado, serviço reiniciado ou processo Node executado.

## DEP-007 — crons de lembretes e AgPay rejeitados em produção

- **Status:** falha operacional observada em inspeção somente leitura registrada em 13/11/2026; impacto por transação não verificado.
- **Gravidade:** P1 para disponibilidade do processamento de pagamentos e notificações; não há evidência de perda financeira individual.
- **Esperado:** cron autenticado com o segredo corrente deve alcançar os workers e concluir o ciclo previsto.
- **Observado:** o registro da inspeção de produção informa que, na janela de 72 horas, 72/72 execuções identificadas do cron horário de lembretes retornaram HTTP 401 e o cron AgPay retornou 401 em 4.319 chamadas. A causa foi confirmada como divergência entre `AGENDA_CRON_SECRET` do cron e o valor configurado no app, sem segredo anterior coincidente (`C:\Users\Felps\segundo-cerebro\clientes\agenda-agora.md:485-490`). O código local confirma que ambos os handlers retornam imediatamente quando `authenticateCronRequest` falha; em AgPay isso ocorre antes de `processAgpayWebhookEvents(25)` e `expirePendingDeposits(25)` (`src/routes/api/public/hooks/agpay-events.ts:8-16`; `src/routes/api/public/hooks/whatsapp-reminders.ts:18-20`).
- **Impacto observado/condicional:** cron de lembretes não alcançou o processamento durante as execuções observadas; worker AgPay tampouco processou/expirou registros via essas chamadas. O volume atual de eventos em espera, pagamentos atrasados, reservas afetadas, notificações perdidas e eventual processamento por outra via não foi consultado, pois o projeto Supabase alvo não aparece na conexão. Não declarar transação perdida sem conciliação.
- **Causa-raiz confirmada no registro operacional:** os valores secretos usados pelo cron e app não coincidem. Valores não foram copiados para o relatório.
- **Reprodução segura:** não repetir chamadas com segredo inválido. Confirmar a causa somente por comparação local segura de igualdade/versão, sem imprimir valores, e validar primeiro com execução controlada não financeira; reconciliar a fila antes de retomar processamento amplo.
- **Correção recomendada para spec/runbook:** procedimento seguro e observável de rotação sincronizada entre app e crons; readiness/alerta por 401 sustentado; antes de replay, inspecionar e planejar tratamento de eventos financeiros acumulados para evitar duplicidade.
- **Regressão:** segredo divergente gera alerta acionável; rotação não interrompe jobs; replay após indisponibilidade mantém idempotência e reconcilia depósitos, expirações e mensagens.
- **Limitação:** os números e a causa vêm do checkpoint de inspeção SSH somente leitura no vault, não de logs reobtidos nesta sessão; fila, runtime e estado financeiro não foram consultados novamente.
- **Revalidação — 2026-11-15:** tentei obter estado atual com SSH em modo não interativo e comando exclusivamente de leitura; a autenticação foi recusada (`Permission denied`). Não há alias SSH local configurado. Portanto, os 401 e a divergência do segredo continuam evidência histórica de 13/11; correção posterior, fila atual e impacto continuam sem verificação. Nenhum segredo foi impresso e nenhum serviço/comando de processamento foi executado.

### DEP-004 — corrigido localmente em 2026-11-14

`ops/vps/deploy-release.sh` agora registra a release anterior antes de trocar `current`. Falha de restart ou health check executa rollback do symlink e tenta reiniciar o serviço; sem release anterior, remove o link recém-criado. `ops/vps/deploy-release.test.sh` passou em harness temporário nos casos de falha do health check, falha de restart e release saudável. RED reproduziu o problema antes da correção. `bash -n`, `npx tsc --noEmit` e `git diff --check` passaram. Nenhum deploy, serviço ou host foi acionado. Limitação: o harness usa wrappers para simular operações de filesystem/systemd; estado da VPS não foi consultado.

### DEP-006 — boot exige segredos obrigatórios do runbook (2026-11-15)

Revalidei causa e requisito: `assertProductionConfig` só recebe `process.env` em produção; o runbook marca `SDR_TOKEN_SECRET`, `WHATSAPP_WEBHOOK_SECRET` e `AGENDA_CRON_SECRET` obrigatórios. A validação ignorava os três, embora as funções falhassem ao usá-los; o schema de runtime já exige 32 caracteres para SDR/WhatsApp quando presentes. Atualizei `src/lib/production-config.ts` para exigir os três em produção e rejeitar SDR/WhatsApp abaixo de 32, com erros sem valores secretos. `production-config.test.ts`: RED 5 falhas específicas antes do fix; GREEN 14/14. `npx tsc --noEmit` e `git diff --check` focado passaram. `.env` não foi lido; nenhuma configuração remota alterada. Produção ainda não verificada. Tally histórico permanece reportado 128/17/6, não reconciliado item a item.


### Revalidacao DEP-004/DEP-005 - 2026-11-15

DEP-004: executei ops/vps/deploy-release.test.sh com Git Bash. Harness aprovou rollback da release anterior quando health-check falha e quando restart falha, alem do caminho de sucesso. Nenhum deploy real foi feito. DEP-005: a unit local atual difere do snapshot anterior: agenda-subscription-lifecycle.service define Type=oneshot, Restart=on-failure, RestartSec=5min, StartLimitIntervalSec=1h e StartLimitBurst=3. A documentacao oficial systemd.service confirma restart em saida nao zero para on-failure e permite a combinacao com oneshot; systemd.timer Persistent=true recupera execucoes perdidas durante inatividade, nao substitui o retry do service. O timer/service instalados na VPS e a existencia de cron alternativo seguem sem verificacao. Fontes: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html e https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html.


### DEP-007 current-state check - 2026-11-15

The recorded historic 401 cause remains a cron/app secret mismatch. Current non-interactive SSH access was refused, and the Supabase connector does not provide access to the Agenda Agora project. No secret was read, cron called, or worker restarted. The version currently running on the host and the queue state remain unknown; keep blocked pending authorized read-only access and queue reconciliation before replay.


### DEP-004/DEP-005 current validation - 2026-11-15

DEP-004 harness passed rollback on failed health check/restart and the healthy path using temporary files plus mocked systemctl/curl/npm; no deployment. DEP-005 PowerShell test passed assertions for bounded on-failure retry (5-minute interval, maximum three starts/hour). Versioned unit verified; VPS installation and alert channel remain unverified.


### DEP-007 ? tentativa read-only de consultar logs negada (2026-11-15)

Tentei consultar o stream agregado de logs do Supabase para as ultimas 24h, com query limitada a `select distinct source from logs`; o MCP retornou `You do not have permission`. SSH nao interativo ao host tambem foi negado no registro anterior. O snapshot de 13/11 (401s em lembretes e AgPay) permanece historico e nao confirma a condicao atual nem efeitos na fila. Nenhum worker foi chamado, segredo lido, fila consultada ou dado alterado. DEP-007 segue nao verificado.


### DEP-007 ? estado agregado das filas acessado somente para leitura (2026-11-15)

Via `DATABASE_URL`, em transacao `READ ONLY` e `default_transaction_read_only=on`, consultei somente agregacoes sem payload, IDs ou dados de negocio: `agpay_webhook_events` tem 2 linhas `pending`, recebidas entre 2026-11-05 19:07Z e 2026-11-06 00:14Z, ambas com 0 tentativas; `post_service_message_queue` e `reminder_logs` nao retornaram linhas; ultimo `subscription_lifecycle_runs` registrado iniciou em 2026-11-03 18:03Z e concluiu em ~1s, com 1 business escaneado e zero notices/cancellations. Isso confirma inbox antiga sem tentativa e ausencia de execucao recente registrada do lifecycle; nao prova a causa nem o estado de cada cron. MCP logs e SSH permanecem negados. Nenhum payload lido, worker chamado, fila alterada, reprocessamento executado ou segredo exibido.


Revalidacao complementar DEP-007 (2026-11-15): catalogo `pg_extension` nao lista `pg_cron` nem `pg_net`; portanto, esses workers nao estao agendados por essas extensoes neste banco. Isso nao exclui cron externo em host/plataforma. Nao consultei comandos de jobs, e SSH/logs externos permanecem inacessiveis.


### DEP-007 - causa de producao confirmada por leitura (2026-11-15)

SSH read-only ao host `srv2024818` confirmou `agenda-agora_app` 1/1 healthy (up 3 dias) e `agenda-agora_cron` 1/1 running (up 4 semanas; zero reinicios no container atual). O cron invoca `/api/public/hooks/agpay-events` a cada minuto e `/api/public/hooks/whatsapp-reminders` a cada hora. Agregados dos ultimos 24 h: 1.440 respostas HTTP 401 em AgPay e 24 em lembretes; o cron registrou `FALHOU` em cada tentativa. A variavel `AGENDA_CRON_SECRET` existe nos dois containers, mas os valores diferem; o app nao tem `AGENDA_CRON_SECRET_PREVIOUS`. Comparacao feita sem imprimir nem registrar valores/hash. Causa confirmada: secret divergente entre cron e app. Nenhum secret/container foi alterado; correcao exige alinhar a configuracao no deploy e recriar/reimplantar o servico, depois validar respostas 2xx.

### DEP-007 — remediado no runtime atual (2026-11-15)

Via SSH read-only, hashes/lengths confirmaram secrets diferentes no serviço app e cron. Atualizei somente `AGENDA_CRON_SECRET` do serviço Swarm `agenda-agora_cron` para igualar a secret já ativa no app; não expus valores nem reiniciei o app. A tarefa ficou 1/1 running. Chamadas posteriores de AgPay e lembretes retornaram 2xx. O worker consultou a AgPay e expirou seis depósitos vencidos (0 pagos); dois eventos pendentes antigos sem referência local foram para erro/revisão manual. Nenhuma cobrança foi criada. A permanência após um redeploy gerenciado pelo EasyPanel não foi verificada.
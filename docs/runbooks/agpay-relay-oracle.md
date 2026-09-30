# Retransmissor de pagamentos na Oracle Cloud Always Free

Este guia prepara uma VM gratuita com IPv4 reservado para que as chamadas do Agenda Agora saiam por um IP fixo. **Não ative a URL do retransmissor antes de concluir o teste de ponta a ponta.** O aplicativo continua com saída direta enquanto `AGPAY_EGRESS_PROXY_URL` estiver vazia.

## 1. Conta, região e VM

1. Crie uma conta em [Oracle Cloud Free Tier](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm). O cartão verifica a identidade. Mantenha a conta no plano gratuito e não aceite uma atualização para conta paga.
2. Escolha com cuidado a **região inicial**: as VMs Always Free só podem ser criadas nela. No console, confira o selo **Always Free eligible** e os limites antes de confirmar qualquer recurso.
3. Em **Compute → Instances → Create instance**, selecione Ubuntu e uma forma gratuita: `VM.Standard.E2.1.Micro` ou `VM.Standard.A1.Flex` dentro da cota gratuita. Gere ou importe uma chave SSH e salve a chave privada em local seguro. Escolha uma sub-rede pública. [Limites oficiais de Compute Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
4. Em **Networking → IP management → Reserved public IPs**, escolha **Reserve public IP address** no mesmo compartimento. Na VM, abra **Attached VNICs → Primary VNIC → IP addresses → Edit** e associe o IP reservado ao IP privado principal. Se a VM recebeu um IP efêmero, desassocie-o antes. Anote o novo IPv4 e confirme no console que ele permanece associado. [Procedimento oficial para reservar IP](https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/reserved-public-ip-create.htm) e [associar à instância](https://docs.oracle.com/en/learn/reserved-pub-ip/index.html).

## 2. Rede, domínio e programas

1. Na lista de segurança da sub-rede ou no Network Security Group da VM, crie regras **de entrada TCP** para portas **22, 80 e 443**. Restrinja 22 ao seu IP de administração quando possível. Não abra a porta 8787 à internet.
2. Conecte por SSH (`ssh -i SUA_CHAVE ubuntu@IP_RESERVADO`). No Ubuntu, rode:

   ```sh
   sudo apt update
   sudo apt install -y curl ca-certificates ufw
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. Instale Node.js LTS. Para Ubuntu, use o repositório NodeSource e confirme a versão:

   ```sh
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   node --version
   ```

4. Instale Caddy conforme o [guia oficial](https://caddyserver.com/docs/install):

   ```sh
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
   sudo apt update
   sudo apt install -y caddy
   ```

5. Crie um subdomínio gratuito em [DuckDNS](https://www.duckdns.org/) e faça o registro IPv4 apontar ao IP reservado. Aguarde `dig +short SEU_NOME.duckdns.org` mostrar esse IP. O Caddy obtém HTTPS automaticamente quando DNS e portas 80/443 estão prontos, conforme a [documentação de HTTPS](https://caddyserver.com/docs/quick-starts/https).

## 3. Código, segredo e serviço

1. No computador do projeto, copie `ops/agpay-relay/server.mjs` à VM, por exemplo com `scp -i SUA_CHAVE ops/agpay-relay/server.mjs ubuntu@IP_RESERVADO:/tmp/server.mjs`. Na VM:

   ```sh
   sudo mkdir -p /opt/agpay-relay
   sudo mv /tmp/server.mjs /opt/agpay-relay/server.mjs
   sudo useradd --system --home /opt/agpay-relay --shell /usr/sbin/nologin agpay-relay
   sudo chown -R root:root /opt/agpay-relay
   sudo chmod 755 /opt/agpay-relay/server.mjs
   ```

2. O `.env` local já contém `AGPAY_EGRESS_PROXY_SECRET`. Abra esse arquivo **num editor gráfico privado** e copie somente o valor dessa variável. Não use `cat`, `echo`, captura de tela ou mensagem em terminal compartilhado. Na sessão SSH privada, use o comando abaixo: o `read -s` oculta o valor digitado ou colado, e o arquivo só pode ser lido por root.

   ```sh
   read -r -s -p 'Cole o segredo e pressione Enter: ' RELAY_SECRET; printf '\n'
   printf 'AGPAY_EGRESS_PROXY_SECRET=%s\nAGPAY_RELAY_PORT=8787\n' "$RELAY_SECRET" | sudo tee /etc/agpay-relay.env >/dev/null
   unset RELAY_SECRET
   sudo chmod 600 /etc/agpay-relay.env
   ```

3. Crie `/etc/systemd/system/agpay-relay.service` com o conteúdo abaixo:

   ```ini
   [Unit]
   Description=Retransmissor privado de pagamentos
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   User=agpay-relay
   Group=agpay-relay
   EnvironmentFile=/etc/agpay-relay.env
   ExecStart=/usr/bin/node /opt/agpay-relay/server.mjs
   Restart=always
   RestartSec=5
   NoNewPrivileges=true
   ProtectSystem=strict
   ProtectHome=true

   [Install]
   WantedBy=multi-user.target
   ```

   Depois execute `sudo systemctl daemon-reload`, `sudo systemctl enable --now agpay-relay` e `sudo systemctl status agpay-relay`. O serviço reinicia sozinho se cair. Confirme localmente com `curl -fsS http://127.0.0.1:8787/health`: a resposta deve ser `ok`.

4. Configure `/etc/caddy/Caddyfile`:

   ```caddyfile
   SEU_NOME.duckdns.org {
       @relay path /api/v1/relay /health
       handle @relay {
           reverse_proxy 127.0.0.1:8787
       }
       respond 404
   }
   ```

   Troque o nome, rode `sudo systemctl reload caddy` e, de outro computador, teste `curl -fsS https://SEU_NOME.duckdns.org/health`. Deve responder `ok`. A porta 8787 permanece ligada apenas a `127.0.0.1`.

## 4. Credencial e ativação

1. Verifique o IPv4 reservado visto pela saída da VM com `curl -4fsS https://api.ipify.org` em uma sessão privada. Ele deve ser o mesmo IP associado no console. No formulário do provedor de pagamentos, escolha **Gerar Nova Credencial**, modo **Manual**, e cadastre **esse IP fixo**. Aguarde a aprovação. Copie a nova credencial e o identificador do cliente para `AGPAY_API_TOKEN` e `AGPAY_CLIENT_ID` no `.env` local e nas variáveis do projeto na Vercel. Não coloque esses valores no relay.
2. Na Vercel, configure `AGPAY_EGRESS_PROXY_URL=https://SEU_NOME.duckdns.org/api/v1/relay` e `AGPAY_EGRESS_PROXY_SECRET` com o mesmo segredo da VM. Configure as mesmas duas variáveis no `.env` local apenas quando for testar a saída via VM. Salve segredos exclusivamente no gerenciador de variáveis, nunca no Git, em capturas de tela ou em logs. Um novo deploy da Vercel é necessário para usar as variáveis novas.
3. Antes da ativação, teste o relay pelo aplicativo com uma consulta de leitura à API de pagamentos; confirme resposta e, no `journalctl -u agpay-relay`, apenas método, caminho sem query e status. Depois, se necessário, crie **uma** cobrança Pix mínima de teste sem pagá-la e consulte o status pendente. Confira que erros de credencial não expõem o provedor ao cliente. Se falhar, esvazie `AGPAY_EGRESS_PROXY_URL` para voltar à saída direta aprovada anteriormente e investigue DNS, certificado, serviço e IP cadastrado.

## 5. Verificação periódica e custos

No usuário `ubuntu`, rode `crontab -e` e adicione:

```cron
0 */12 * * * /usr/bin/curl -fsS --max-time 10 http://127.0.0.1:8787/health >/dev/null || /usr/bin/logger -t agpay-relay-health 'Health falhou'
```

Isso verifica o serviço a cada 12 horas. **A chamada leve não garante impedir a retomada de uma VM ociosa:** a Oracle avalia, numa janela de 7 dias, limites de CPU, rede e, para A1, memória. Monitore a instância no console e mantenha uma cópia do procedimento e do código para recriá-la se necessário. [Critérios oficiais de retomada](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm#compute). Confira o selo Always Free de cada recurso e nunca aceite uma opção paga por engano.

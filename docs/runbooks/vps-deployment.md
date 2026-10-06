# Produção na VPS

## Endereços

- Painel 1 (agendamento do cliente): `https://app.agendagora.company`
- Painel 2 (estabelecimento): `https://painel.agendagora.company`
- Painel 3 (administração): `https://admin.agendagora.company`
- VPS: `179.236.231.178`

Os três painéis estão ativos, com DNS e HTTPS próprios.

## DNS configurado na Hostinger

Os registros do tipo `A` apontam para `179.236.231.178`:

| Nome     | Valor             | TTL               |
| -------- | ----------------- | ----------------- |
| `painel` | `179.236.231.178` | `300` ou o padrão |
| `admin`  | `179.236.231.178` | `300` ou o padrão |

O registro `app` também deve continuar apontando para a mesma VPS.

## Se for necessário refazer a ativação

1. Confirme que os três hosts resolvem para a VPS.
2. Mantenha `VITE_SPLIT_PANELS=true` no ambiente usado no build.
3. Faça um novo build e deploy.
4. Instale `ops/vps/Caddyfile` em `/etc/caddy/Caddyfile` e recarregue o Caddy.
5. Teste login de estabelecimento em `painel` e login de super admin em `admin`.
6. No Supabase Auth, mantenha os três hosts nas URLs de redirecionamento permitidas.

Se a chave estiver ausente ou como `false`, o sistema volta ao modo de host único.

## Serviços

- `agenda-agora.service`: aplicação web em `127.0.0.1:3000`.
- `caddy.service`: HTTPS e proxy reverso.
- `agenda-agpay-events.timer`: reconcilia eventos AgPay a cada minuto.
- `agenda-whatsapp-reminders.timer`: processa lembretes a cada hora.
- `fail2ban.service`, UFW e atualizações automáticas protegem a VPS.

## Pendências externas

- AgPay: liberar/autorizar o IP `179.236.231.178`, confirmar KYC e permissão de saque, e cadastrar o webhook `https://app.agendagora.company/api/public/agpay-webhook`.
- Supabase Auth: Site URL `https://app.agendagora.company` e redirects para `app`, `painel` e `admin`.
- Trocar as senhas que foram compartilhadas em conversa. A VPS já usa chave SSH e não aceita login SSH por senha.

Nunca registre tokens, senhas ou o conteúdo de `/etc/agenda-agora.env` neste repositório.

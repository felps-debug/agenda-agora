# Agenda Agora

SaaS de agendamento para comercios e prestadores de servicos, com painel de
agenda, profissionais, servicos, clientes, cobranca via Asaas e notificacoes.

## Stack

- TanStack Start e React
- Supabase (PostgreSQL, Auth e Cron)
- Asaas
- UAZAPI
- Nitro

## Desenvolvimento local

Instale as dependencias e inicie o servidor:

```sh
bun install
bun run dev
```

As configuracoes locais ficam em `.env.local`. Nunca coloque chaves privadas
no `.env`, pois ele e apenas o template versionado.

## Producao

```sh
bun run build
bun run start
```

Configure os segredos diretamente no ambiente da hospedagem.

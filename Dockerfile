# Imagem de produção do Agenda Agora (EasyPanel). Substitui o deploy por release da VPS.
# Os VITE_* são públicos e entram no bundle em tempo de build; segredos NUNCA vão aqui,
# só nas variáveis de ambiente do serviço no EasyPanel.

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SPLIT_PANELS=true
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SPLIT_PANELS=$VITE_SPLIT_PANELS

COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app

# curl: usado pelos Cron Jobs do EasyPanel (eventos AgPay e lembretes de WhatsApp).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.output ./.output

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --output /dev/null http://127.0.0.1:3000/auth || exit 1

CMD ["node", ".output/server/index.mjs"]

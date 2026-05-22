FROM node:22-bookworm-slim

ARG INSTALL_DEV_DEPS=true

WORKDIR /app

RUN apt-get update && apt-get install -y \
    dos2unix \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

RUN npm ci

COPY . .

ENV DATABASE_URL="postgresql://localhost:5432/dummy_db?schema=public"

RUN dos2unix /app/server/docker-entrypoint.sh \
    && chmod +x /app/server/docker-entrypoint.sh \
    && cd /app/server && npx prisma generate \
    && if [ "$INSTALL_DEV_DEPS" = "false" ]; then npm prune --omit=dev; fi \
    && mkdir -p /app/server/uploads/avatars \
    && chown -R node:node /app/server/uploads

WORKDIR /app/server

EXPOSE 5000

USER node

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "index.js"]
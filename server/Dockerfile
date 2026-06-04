
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    dos2unix \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

RUN npm ci

COPY server ./server

ENV DATABASE_URL="postgresql://localhost:5432/dummy_db?schema=public"
RUN dos2unix /app/server/docker-entrypoint.sh \
    && chmod +x /app/server/docker-entrypoint.sh \
    && cd /app/server && npx prisma generate

RUN cd /app/server && npm prune --omit=dev && cd /app && npm prune --omit=dev

FROM node:22-bookworm-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server

RUN mkdir -p /app/server/uploads/avatars \
    && chown -R node:node /app/server/uploads \
    && chown -R node:node /app/server

WORKDIR /app/server

EXPOSE 5000

USER node

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "index.js"]
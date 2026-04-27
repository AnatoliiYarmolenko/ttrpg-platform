FROM node:22-alpine

ARG INSTALL_DEV_DEPS=true

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

RUN apk add --no-cache su-exec dos2unix && npm ci

COPY . .

# 1. Оголошуємо змінну оточення ДО того, як запускати команди
# Це "заглушка", щоб npx prisma generate не падала під час білда
ENV DATABASE_URL="postgresql://localhost:5432/dummy_db?schema=public"

# 2. Об'єднуємо всі дії в ОДИН великий RUN
RUN dos2unix /app/server/docker-entrypoint.sh \
    && chmod +x /app/server/docker-entrypoint.sh \
    && cd /app/server && npx prisma generate \
    && if [ "$INSTALL_DEV_DEPS" = "false" ]; then npm prune --omit=dev; fi

WORKDIR /app/server

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "index.js"]
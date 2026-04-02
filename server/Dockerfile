FROM node:22-alpine

ARG INSTALL_DEV_DEPS=true

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN apk add --no-cache su-exec && npm ci

COPY . .

RUN chmod +x /app/docker-entrypoint.sh

# --- ДОДАЄМО ЦЕЙ РЯДОК ---
# Prisma вимагає, щоб змінна існувала під час білда, навіть якщо вона не правильна.
# Це просто "заглушка", щоб npx prisma generate не падала.
ENV DATABASE_URL="postgresql://localhost:5432/dummy_db?schema=public"

# Генеруємо Prisma Client
RUN npx prisma generate && \
    if [ "$INSTALL_DEV_DEPS" = "false" ]; then npm prune --omit=dev; fi
EXPOSE 5000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "index.js"]
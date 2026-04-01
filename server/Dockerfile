FROM node:22-alpine

ARG INSTALL_DEV_DEPS=true

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# --- ДОДАЄМО ЦЕЙ РЯДОК ---
# Prisma вимагає, щоб змінна існувала під час білда, навіть якщо вона не правильна.
# Це просто "заглушка", щоб npx prisma generate не падала.
ENV DATABASE_URL="postgresql://localhost:5432/dummy_db?schema=public"

# Генеруємо Prisma Client
RUN npx prisma generate && \
    if [ "$INSTALL_DEV_DEPS" = "false" ]; then npm prune --omit=dev; fi
USER node
EXPOSE 5000

CMD ["node", "index.js"]
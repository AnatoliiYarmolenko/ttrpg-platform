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
ENV DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"

# Генеруємо Prisma Client
RUN npx prisma generate

# Опційно видаляємо dev-залежності для production image.
# Для локального docker-compose (dev) залишаємо їх, щоб працював pino-pretty.
RUN if [ "$INSTALL_DEV_DEPS" = "false" ]; then npm prune --omit=dev; fi

EXPOSE 5000

CMD ["node", "index.js"]
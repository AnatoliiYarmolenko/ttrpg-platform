FROM node:22-alpine

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

EXPOSE 5000

CMD ["npm", "run", "dev"]
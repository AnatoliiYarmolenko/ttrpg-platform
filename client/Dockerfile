FROM node:22-alpine

WORKDIR /app

# Copy root package files for workspaces
COPY package*.json ./
COPY client/package*.json ./client/

RUN npm ci

COPY . .

WORKDIR /app/client

# Vite за замовчуванням використовує 5173
EXPOSE 5173

# Важливо: --host потрібен, щоб достукатися до сайту з браузера
# Використовуємо npx vite напряму з кореневого node_modules
CMD ["npx", "vite", "--host"]
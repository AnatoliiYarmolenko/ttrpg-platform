FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Vite за замовчуванням використовує 5173
EXPOSE 5173

# Важливо: --host потрібен, щоб достукатися до сайту з браузера
CMD ["npm", "run", "dev", "--", "--host"]
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/

RUN npm ci

COPY . .

WORKDIR /app/client

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine AS production

COPY --from=builder /app/client/dist /usr/share/nginx/html

COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

FROM node:22-alpine AS development

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/

RUN npm ci

COPY . .

WORKDIR /app/client

EXPOSE 5173

CMD ["npx", "vite", "--host"]
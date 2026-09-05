# =======================================
# Stage 1: Build (Vite)
# =======================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npm run build

# =======================================
# Stage 2: Serve via Nginx
# =======================================
FROM nginx:alpine AS runtime

# Self-contained nginx config (SPA fallback to index.html)
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

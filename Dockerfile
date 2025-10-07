# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Production build (Vite)
RUN npm run build

# ---------- Runtime ----------
FROM nginx:1.27-alpine

# Copy template and entrypoint to inject API_URL at runtime
COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
# Copy build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Create a tiny entrypoint that env-substs API_URL into nginx.conf
RUN apk add --no-cache bash gettext
RUN printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'if [ -z "${API_URL:-}" ]; then API_URL="http://localhost:8000"; fi' \
  'envsubst '\''$API_URL'\'' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf' \
  'exec nginx -g "daemon off;"' \
  > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/ || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]

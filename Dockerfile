# Один контейнер для безкоштовного Render: вітрина (Next.js, публічний PORT) + API (NestJS, 127.0.0.1:4000).
# Один сервіс = один холодний старт і вкладаємось у 750 год/міс, щоб тримати його активним 24/7.
# Окремі образи для docker compose — apps/api/Dockerfile і apps/web/Dockerfile.
FROM node:22-alpine AS api
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS web
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
# rewrites у next.config читають API_URL під час збірки (Render передає env як build args)
ARG SITE_URL=http://localhost:3000
ENV API_URL=http://127.0.0.1:4000/api/v1 SITE_URL=$SITE_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run typecheck && npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production API_URL=http://127.0.0.1:4000/api/v1 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=api /app/node_modules ./api/node_modules
COPY --from=api /app/dist ./api/dist
COPY apps/api/migrations ./api/migrations
COPY apps/api/package.json ./api/package.json
COPY --from=web --chown=app:app /app/.next ./web/.next
COPY --from=web /app/node_modules ./web/node_modules
COPY --from=web /app/package.json /app/next.config.mjs ./web/
COPY deploy/start.mjs ./start.mjs
USER app
EXPOSE 10000
CMD ["node", "start.mjs"]

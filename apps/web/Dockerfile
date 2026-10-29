FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# rewrites у next.config читають API_URL під час збірки (Render передає env як build args)
ARG API_URL=http://api:4000/api/v1
ARG SITE_URL=http://localhost:3000
ENV API_URL=$API_URL SITE_URL=$SITE_URL NEXT_TELEMETRY_DISABLED=1
# У CI/Docker обмеження пісочниці відсутні; workerThreads/cpus з next.config можна прибрати
RUN npm run typecheck && npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
USER app
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]

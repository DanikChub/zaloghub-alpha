# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
RUN npm install -g pnpm@10.34.9
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/collector/package.json apps/collector/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build-api
COPY apps/api apps/api
RUN DATABASE_URL=postgresql://build:build@localhost/build pnpm --dir apps/api db:generate \
    && pnpm build:api

FROM build-api AS api
ENV NODE_ENV=production PORT=3000 NODE_OPTIONS=--max-old-space-size=192
WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM dependencies AS collector
COPY --chown=node:node apps/collector apps/collector
RUN mkdir -p /var/lib/collector && chown node:node /var/lib/collector
ENV NODE_ENV=production NODE_OPTIONS=--max-old-space-size=128 COLLECTOR_STORAGE=/var/lib/collector
WORKDIR /app/apps/collector
USER node
CMD ["node", "src/index.mjs"]

FROM dependencies AS build-web
COPY apps/web apps/web
ENV VITE_API_URL=/api
RUN pnpm build:web

FROM nginx:stable-alpine AS web
COPY deploy/nginx-container.conf /etc/nginx/conf.d/default.conf
COPY --from=build-web /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

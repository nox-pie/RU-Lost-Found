# syntax=docker/dockerfile:1
# Web image: the built single-page app behind nginx, which also forwards /api to the API
# (like the Vercel rewrite in production). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t ru-lost-found-web .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @ru-lost-found/web --ignore-scripts
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG VITE_SENTRY_DSN=
ARG VITE_RELEASE=
RUN npm run build --workspace @ru-lost-found/web

FROM nginx:1.27-alpine AS runtime
# Templates in this folder get environment variables (API_UPSTREAM) substituted at start-up.
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://api:5001
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

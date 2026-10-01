# syntax=docker/dockerfile:1
# API image. Build from the repository root (npm workspaces):
#   docker build -f apps/api/Dockerfile -t ru-lost-found-api .

FROM node:22-bookworm-slim AS build
WORKDIR /app
# The test database package would download MongoDB (~100 MB) on install; not needed to build.
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @ru-lost-found/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @ru-lost-found/api

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# Production dependencies only (sharp brings its own libvips for this platform).
RUN npm ci --omit=dev --workspace @ru-lost-found/api && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/seed apps/api/seed

WORKDIR /app/apps/api
# Local image storage (used only when Cloudinary isn't configured) must be writable by `node`.
RUN mkdir -p .uploads && chown node:node .uploads
USER node
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Other entry points: dist/worker.js, dist/scripts/seed.js, dist/scripts/set-role.js,
# dist/scripts/migrate-legacy.js
CMD ["node", "dist/main.js"]

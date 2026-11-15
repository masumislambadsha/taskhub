# syntax=docker/dockerfile:1
#
# Targets:
#   web     Next.js standalone server (port 3000)
#   worker  background worker (health on port 4100)
# The realtime Socket.io server has its own Dockerfile in ./server.

ARG NODE_IMAGE=node:22-slim

# ── deps: install all dependencies from the lockfile ────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── prod-deps: production-only node_modules for the worker ──────────────────
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ── build: next build (standalone) and the worker bundle ────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
# NEXT_PUBLIC_* values are baked into the client bundle at build time.
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_IMGBB_API_KEY=
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_IMGBB_API_KEY=$NEXT_PUBLIC_IMGBB_API_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_TELEMETRY_DISABLED=1 \
    BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:worker

# ── worker: runtime image for the background worker ─────────────────────────
FROM ${NODE_IMAGE} AS worker
WORKDIR /app
ARG GIT_SHA=
ENV NODE_ENV=production \
    WORKER_HEALTH_PORT=4100 \
    GIT_SHA=$GIT_SHA
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist/worker ./dist/worker
USER node
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.WORKER_HEALTH_PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/worker/index.js"]

# ── web: runtime image for the Next.js app (last, so it is the default) ─────
FROM ${NODE_IMAGE} AS web
WORKDIR /app
ARG GIT_SHA=
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    GIT_SHA=$GIT_SHA
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

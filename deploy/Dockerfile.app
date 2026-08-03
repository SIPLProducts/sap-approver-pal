# syntax=docker/dockerfile:1
# Builds the RESL Approval app (frontend + TanStack Start server) and runs the
# built worker locally with workerd via wrangler. No Cloudflare account needed.
#
# Build context: the repository root.
#   docker build -f deploy/Dockerfile.app --build-arg VITE_SUPABASE_URL=... -t resl-app .

FROM oven/bun:1 AS build
WORKDIR /app

# VITE_* values are compiled into the browser bundle, so they must be present at
# build time. Changing them requires a rebuild, not just a restart.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    NODE_ENV=production

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---------------------------------------------------------------------------

FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# wrangler ships workerd, the same runtime the app is built for.
RUN npm install -g wrangler@4 && npm cache clean --force

COPY --from=build /app/dist ./dist

ENV NODE_ENV=production \
    PORT=3000 \
    WRANGLER_SEND_METRICS=false \
    CI=1

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/login" > /dev/null || exit 1

# Server-only env (SUPABASE_*, MIDDLEWARE_SHARED_SECRET, VAPID_*) is injected by
# docker compose and forwarded to the worker with --var.
CMD ["sh", "-c", "exec wrangler dev -c dist/server/wrangler.json --ip 0.0.0.0 --port ${PORT} --local \
  --var SUPABASE_URL:\"$SUPABASE_URL\" \
  --var SUPABASE_PUBLISHABLE_KEY:\"$SUPABASE_PUBLISHABLE_KEY\" \
  --var SUPABASE_ANON_KEY:\"$SUPABASE_ANON_KEY\" \
  --var SUPABASE_SERVICE_ROLE_KEY:\"$SUPABASE_SERVICE_ROLE_KEY\" \
  --var MIDDLEWARE_SHARED_SECRET:\"$MIDDLEWARE_SHARED_SECRET\" \
  --var VAPID_PUBLIC_KEY:\"$VAPID_PUBLIC_KEY\" \
  --var VAPID_PRIVATE_KEY:\"$VAPID_PRIVATE_KEY\" \
  --var VAPID_SUBJECT:\"$VAPID_SUBJECT\""]

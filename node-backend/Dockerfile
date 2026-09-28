# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Maitri Node backend — multi-stage build.
#
# Produces one image that runs three ways (chosen by the container command):
#   - API server   : node dist/server.js   (default)
#   - Job worker   : node dist/worker.js
#   - Migrate/seed : uses the `migrate` target below (keeps dev deps + tsx)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# Be resilient to slow/flaky registry connections during install.
ENV npm_config_fetch_timeout=600000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=120000
RUN corepack enable
WORKDIR /app

# ---- deps: every dependency, incl. dev ------------------------------------
FROM base AS deps
# argon2 (the only native dep) ships prebuilt binaries for Node 22 on linux
# x64/arm64, so no compiler toolchain is needed here.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

# ---- build: compile TypeScript -> dist -----------------------------------
FROM deps AS build
COPY . .
RUN pnpm build

# ---- prod-deps: production-only node_modules ------------------------------
FROM deps AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm prune --prod

# ---- migrate: run migrations & seeds (needs node-pg-migrate + tsx) --------
# Target this stage for the one-shot migrate/seed container.
FROM deps AS migrate
COPY . .
# Reads DATABASE_URL from the environment (not a .env file). node-pg-migrate
# loads the .ts migrations via the tsx loader present in the dev deps.
CMD ["pnpm", "exec", "node-pg-migrate", "up", "--migrations-dir", "migrations"]

# ---- runtime: lean image for API + worker ---------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Run as the built-in non-root user.
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "dist/server.js"]

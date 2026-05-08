# syntax=docker/dockerfile:1.7
# Multi-stage build for @docnotes/backend (Hono + tRPC).
# Build context MUST be the repo root, not apps/backend.
#   docker build -f apps/backend/Dockerfile -t docnotes-backend .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

# ---- deps: install everything once, cached on lockfile ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/api/package.json packages/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: compile backend + workspace deps, then prune ----
FROM deps AS build
COPY apps/backend apps/backend
COPY packages packages
RUN pnpm --filter @docnotes/backend... run build
RUN pnpm --filter @docnotes/backend deploy --prod /out

# ---- runner: minimal image, non-root, healthchecked ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /out/dist ./dist
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]

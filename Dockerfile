# Multi-stage build for Sipher — Agent + Web Chat + REST API
# Serves agent on port 5006 with web chat UI and API endpoints

# ── Stage 1: Build ───────────────────────────────────────────────────────────

FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm via corepack (built into Node 22)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config and all package.json files first (cache deps layer)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/agent/package.json packages/agent/
COPY app/package.json app/

RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build all packages in dependency order:
# 1. Root REST API (tsup)
# 2. SDK (tsc) — no deps on other workspace packages
# 3. Agent (tsc) — depends on @sipher/sdk
# 4. Web chat app (vite) — standalone React build
RUN pnpm build \
  && cd packages/sdk && pnpm build \
  && cd ../agent && pnpm build \
  && cd ../../app && pnpm build

# ── Stage 2: Production ─────────────────────────────────────────────────────

FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config for pnpm to resolve workspace deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/agent/package.json packages/agent/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/agent/dist ./packages/agent/dist
COPY --from=builder /app/app/dist ./app/dist

# Copy native modules built in builder stage (better-sqlite3)
COPY --from=builder /app/node_modules/.pnpm/better-sqlite3*/node_modules/better-sqlite3/build ./node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3/build

# Copy runtime files needed by the old REST API
COPY --from=builder /app/skill.md ./

ENV NODE_ENV=production
ENV PORT=5006

EXPOSE 5006

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5006/api/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "packages/agent/dist/index.js"]

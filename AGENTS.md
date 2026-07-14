<!-- Satellite context file — extends the global hub (~/.claude/CLAUDE.md | ~/.pi/agent/AGENTS.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# Sipher

> Privacy-as-a-Skill for multi-chain agents. REST API + agent skill enabling any autonomous agent to add transaction privacy via SIP Protocol. Live at https://sipher.sip-protocol.org.

**Ecosystem hub:** See [sip-protocol/sip-protocol/AGENTS.md](https://github.com/sip-protocol/sip-protocol/blob/main/AGENTS.md) for full ecosystem context.

**Stats:** 66 REST endpoints · 555 REST + 1300 agent tests · 22 SIPHER tools · 14 SENTINEL tools · 9 HERALD X tools · 17 chains · Command Center UI (2,079 lines, 24 files) · 4 client SDKs (TS, Python, Rust, Go) · Eliza plugin.

**Origin:** Colosseum Agent Hackathon (Feb 2-13, 2026, $100K USDC). Agent ID 274, ranked #9 of 50. Credentials at `~/.claude/sip-protocol/sipher/CREDENTIALS.md` (never commit).

## Architecture

```
Inbound Message (HTTP POST /api/chat, X mention, DM, …)
  → MsgContext (platform-agnostic envelope: user, text, metadata, wallet, conversationId, replyFn)
  → AgentCore (LLM reasoning)  ←── SentinelAdapter (preflight gate) ← guardianBus subscriber
  → adapters:
      Web Adapter (SIPHER)  — Express /api/chat, /chat/stream
      X Adapter (HERALD)    — poller → mentions/DMs
  → SentinelCore (Pi SDK LLM risk analyst) — circuit breaker, SENTINEL_MODE=yolo|advisory|off
```

**AgentCore** is the shared LLM reasoning engine; each adapter wires a persona (SIPHER web / HERALD X) with platform-specific I/O. **SentinelCore** is the LLM-backed security analyst; **SentinelAdapter** subscribes to the guardianBus and applies preflight risk assessment (β static rules + γ LLM hybrid) before any fund-moving tool executes.

## Tech Stack

Node.js 22 (LTS) · Express 5 · TypeScript (strict) · `@sip-protocol/sdk` v0.7.4 · `@solana/web3.js` v1 · `@mariozechner/pi-agent-core` + `@mariozechner/pi-ai` (replaces `@anthropic-ai/sdk`) · LLM via Pi SDK routing through OpenRouter (default `anthropic/claude-sonnet-4.6`, config in `packages/agent/src/pi/provider.ts`) · Zod v3 · Pino v9 (structured JSON, audit logs) · swagger-ui-express (OpenAPI 3.1) · Redis 7 (rate limiting, idempotency, in-memory fallback) · Vitest + Supertest · Docker + GHCR → VPS port 5006 · Frontend: React 19, Vite 6, Tailwind 4, Zustand 5, Phosphor Icons.

## Common Commands

```bash
pnpm install
pnpm dev                # localhost:5006
pnpm build
pnpm test -- --run      # 555 REST (35 suites) + 1300 agent (104 suites)
pnpm typecheck
pnpm demo              # full-flow demo (requires dev server running)
pnpm openapi:export    # export static OpenAPI spec to dist/openapi.json
pnpm sdks:generate     # generate 4 client SDKs (requires Java)

# Template-Based Engagement (scripts/colosseum.ts)
pnpm colosseum heartbeat | engage | leaderboard | status | posts

# LLM-Powered Agent (scripts/sipher-agent.ts) — requires OPENROUTER_API_KEY
npx tsx scripts/sipher-agent.ts run | heartbeat | status

# Privacy Demo Agent (scripts/privacy-demo-agent.ts) — 20-step flow, 34 endpoints
npx tsx scripts/privacy-demo-agent.ts
SIPHER_URL=https://sipher.sip-protocol.org npx tsx scripts/privacy-demo-agent.ts   # against production

# Devnet Shielded Transfer (scripts/devnet-shielded-transfer.ts)
SOLANA_RPC_URL=https://api.devnet.solana.com pnpm dev   # start on devnet (separate terminal)
pnpm devnet-demo                                          # real on-chain shielded transfer
```

## SIPHER Autonomous Agent

Two engagement systems: **template-based** (`scripts/colosseum.ts` — fast, low-cost, no LLM, category-based comments, auto-votes) and **LLM-powered** (`scripts/sipher-agent.ts` — OpenRouter Claude Haiku, state-first design: check local state before LLM call to save tokens, evaluates projects individually, contextual comments). Cost ~$0.10/cycle. State file `scripts/.sipher-agent-state.json`.

**Agent tools (11):** `get_projects` · `check_voted` · `vote_for_project` · `skip_voting` · `get_forum_posts` · `check_commented` · `post_comment` · `get_our_posts` · `check_engaged_with_us` · `get_leaderboard` · `done`.

## Command Center UI (app/)

Privacy command center frontend — adaptive dashboard with persistent chat sidebar, role-based admin views, dark professional design.

- **Desktop (≥1024px):** top header + main content + 300px persistent chat sidebar
- **Tablet (768-1023px):** top header + tabs (incl. Chat) + main content
- **Mobile (<768px):** bottom nav (Home, Vault, Chat, More) + full-screen views

| View | Access | Purpose |
|------|--------|---------|
| Dashboard | All | metric cards (SOL, privacy score, deposits, budget), activity stream, agent panel |
| Vault | All | real on-chain balances (SOL + SPL), quick actions, tx history |
| Herald | Admin | X agent: budget bar, approval queue, DM log, activity timeline |
| Squad | Admin | agent grid, stats, coordination log, kill switch |
| Chat | All | SIPHER agent chat with SSE streaming |

Role-based access: Admin tabs gated by `isAdmin` in `POST /api/auth/verify` (checks `AUTHORIZED_WALLETS` env var).

**Key files:** `app/src/stores/app.ts` (Zustand) · `app/src/components/{ChatSidebar,Header,BottomNav}.tsx` · `app/src/views/DashboardView.tsx`. Dev: `cd app && pnpm dev` (localhost:5173, proxies /api to :3000) · `pnpm build` · `npx tsc --noEmit`.

## Project Structure

```
sipher/
├── app/                  # Command Center UI (React 19 + Vite + Tailwind 4)
│   └── src/{api,components,hooks,lib,stores,styles,views}/
├── src/
│   ├── app.ts            # Express app + middleware stack + Swagger UI
│   ├── server.ts · config.ts · logger.ts · shutdown.ts · constants.ts
│   ├── errors/codes.ts   # ErrorCode enum + ERROR_CATALOG
│   ├── openapi/spec.ts   # OpenAPI 3.1 spec (all endpoints)
│   ├── middleware/       # auth (X-API-Key timing-safe), cors, rate-limit, validation (Zod),
│   │                       error-handler, request-id, audit-log (redaction), idempotency (LRU),
│   │                       metering (quota), require-tier (enterprise), session
│   ├── routes/           # health, demo, errors, stealth, transfer, private-transfer, scan,
│   │                       commitment, viewing-key, privacy, rpc, backends, private-swap,
│   │                       session, governance, compliance, jito, billing, admin, cspl
│   ├── services/         # solana, rpc-provider, transaction-builder, chain-transfer-builder,
│   │                       helius-provider, jupiter-provider (real lite-api.jup.ag), private-swap-builder,
│   │                       backend-comparison, session-provider, governance-provider,
│   │                       compliance-provider, jito-provider, stripe-provider (mock), usage-provider, backend-registry
│   └── types/api.ts      # ApiResponse<T>, HealthResponse
├── skill.md              # OpenClaw skill file (GET /skill.md)
├── sdks/                 # generated TS/Python/Rust/Go clients (openapi-generator) + configs/readmes
├── integrations/eliza/   # @sip-protocol/plugin-eliza (5 privacy actions)
├── scripts/              # export-openapi, colosseum, sipher-agent, privacy-demo-agent,
│                          devnet-shielded-transfer, eliza-plugin-demo, demo-flow
├── packages/agent/       # @sipher/agent — platform-abstracted agent brain
│   └── src/{agent.ts, pi/, db.ts, session.ts, crank.ts, core/, adapters/, herald/, sentinel/, tools/, routes/}
└── tests/                # 555 REST tests across 35 suites
```

## API Endpoints (66)

All return `ApiResponse<T>`: `{ success, data?, error? }`. Categories: service info, skill/docs, health/ready, errors catalog, demo (25 steps, real crypto), stealth (generate/derive/check/batch), transfer (shield/claim/private — idempotent), scan (payments/batch/assets), commitment (create/verify/add/subtract/batch), viewing-key (generate/derive/verify-hierarchy/disclose/decrypt), backends (list/health/select/compare), privacy/score, rpc/providers, swap/private (real Jupiter DEX), compliance (disclose/report — enterprise), sessions (CRUD — pro+), governance (ballot encrypt/submit/tally — Pedersen commitment + nullifier, homomorphic tally), jito (relay/bundle — real Block Engine or mock), billing (usage/subscription/subscribe/invoices/portal/webhook), sentinel (assess/blacklist/pending/cancel/decisions/status).

**Idempotency:** mutation endpoints marked ✓ accept `Idempotency-Key` header (UUID v4). Duplicate requests return cached response with `Idempotency-Replayed: true`. In-memory LRU, 10K entries, 24h TTL.

**Audit logging:** all requests audit-logged (requestId, method, path, status, latency, sanitized body). Sensitive fields (private keys, blinding factors, viewing keys) auto-redacted to `[REDACTED]`.

## Middleware Stack (execution order)

shutdown → requestId → helmet → secureCors → rateLimiter (100/min) → authenticate (X-API-Key/Bearer, skip public) → metering (daily quota + usage) → express.json (1MB) → compression → requestLogger (pino-http) → auditLog (redaction) → session (X-Session-Id defaults) → route handlers → notFoundHandler → errorHandler (ErrorCode enum).

## Error Codes

Centralized in `src/errors/codes.ts` (ErrorCode enum). Full catalog at `GET /v1/errors`. Categories: 400 validation/json/hex/amount/address · 401 unauthorized/api-key · 404 not-found · 429 rate-limited/quota · 500 internal/stealth/commitment/transfer/scan/viewing-key/encryption/swap/compliance/session/governance/jito/billing · 403 tier-access · 410 session-expired · 409 governance-double-vote · 503 service-unavailable/solana-rpc.

## SENTINEL Docs Mirror Policy

`docs/sentinel/*.md` is the source of truth. Public mirror at `docs.sip-protocol.org/sipher/sentinel/*` (Astro Starlight, repo `docs-sip`). **Sync rule:** any PR editing `docs/sentinel/*.md` MUST also update the corresponding `.mdx` in `docs-sip/src/content/docs/sipher/sentinel/` in the same logical change. Update "Last synced: YYYY-MM-DD" in both. See docs-sip AGENTS.md "SENTINEL Mirror" for the six transform rules.

## Multi-Chain Support

Stealth endpoints support 17 chains across 6 families (curve auto-detected by `chain` param, default `solana`):

| Family | Chains | Curve |
|--------|--------|-------|
| Solana | solana | ed25519 |
| NEAR | near | ed25519 |
| Move | aptos, sui | ed25519 |
| EVM | ethereum, polygon, arbitrum, optimism, base | secp256k1 |
| Cosmos | cosmos, osmosis, injective, celestia, sei, dydx | secp256k1 |
| Bitcoin | bitcoin, zcash | secp256k1 |

## VPS Deployment

Host 176.222.53.185 (reclabs3), user `sip`, port 5006, domain sipher.sip-protocol.org. Containers: `sipher` (API), `sipher-redis`. Compose `~/sipher/docker-compose.yml`.

```bash
ssh sip@176.222.53.185 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep sipher"   # health
ssh sip@176.222.53.185 "cd ~/sipher && docker compose up -d"                                # restart
ssh sip@176.222.53.185 "docker logs sipher --tail 50"                                       # logs
```

**Note:** after VPS migrations, containers need manual `docker compose up -d` — `unless-stopped` only survives Docker daemon restarts, not host migrations.

## Guidelines

**DO:** run `pnpm test -- --run` (555 REST + 1300 agent must pass) + `pnpm typecheck` before commit; use `@sip-protocol/sdk` for all crypto (never roll your own); keep API responses `{ success, data?, error? }`; use ErrorCode enum for errors (never string literals); add tests for every new endpoint/middleware.
**DON'T:** commit credentials/API keys; expose private keys through the API (exception: claim endpoint derives stealth key); skip input validation on public endpoints; break OpenClaw skill format compatibility; log sensitive fields unredacted.

## Roadmap

38 issues across 6 phases — all complete: 1 Hackathon Polish · 2 Production Hardening · 3 Advanced Privacy · 4 Multi-Chain · 5 Backend Aggregation · 6 Enterprise. Quick check: `gh issue list -R sip-protocol/sipher --state open`.

**Devnet proof:** [Solscan](https://solscan.io/tx/4FmLGsLkC5DYJojpQeSQoGMArsJonTEnx729gnFCeYEjFsr8Z46VrDzKQXLhFrpM9Uj6ezBtCQckU28odzvjvV4a?cluster=devnet) — real 0.01 SOL shielded transfer via stealth address.
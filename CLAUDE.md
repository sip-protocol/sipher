# CLAUDE.md - Sipher

> **Ecosystem Hub:** See [sip-protocol/CLAUDE.md](https://github.com/sip-protocol/sip-protocol/blob/main/CLAUDE.md) for full ecosystem context

**Repository:** https://github.com/sip-protocol/sipher
**Live URL:** https://sipher.sip-protocol.org
**Tagline:** "Privacy-as-a-Skill for Multi-Chain Agents"
**Purpose:** REST API + OpenClaw skill enabling any autonomous agent to add transaction privacy via SIP Protocol
**Stats:** 66 REST endpoints | 1300 agent + 555 REST tests | 22 SIPHER tools | 14 SENTINEL tools | 9 HERALD X tools | 17 chains | Command Center UI (2,079 lines, 24 files) | 4 client SDKs (TS, Python, Rust, Go) | Eliza plugin

---

## PRODUCT POSITIONING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP ECOSYSTEM                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @sip-protocol/sdk — THE PRIVACY STANDARD                                  │
│  "Any app can add privacy with one line of code"                            │
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │  sip-app     │ │  sip-mobile  │ │  sip-website │ │  SIPHER      │       │
│  │  Web App     │ │  Native App  │ │  Marketing   │ │  Agent API   │       │
│  │  Humans      │ │  Consumers   │ │  Awareness   │ │  AI Agents   │       │
│  │              │ │              │ │              │ │  ← YOU ARE   │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│  Sipher is SIP's agent-facing interface — the same privacy primitives       │
│  (stealth addresses, Pedersen commitments, viewing keys) exposed as a       │
│  REST API and OpenClaw-compatible skill for autonomous agents.              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────┐
│  Inbound Message                                                      │
│  (HTTP POST /api/chat, X mention, DM, ...)                            │
└──────────────────┬───────────────────────────────────────────────────┘
                   ▼
         ┌─────────────────┐
         │   MsgContext     │  ← Platform-agnostic message envelope
         │  (user, text,    │     (wallet, conversationId, replyFn)
         │   metadata)      │
         └────────┬────────┘
                  ▼
         ┌─────────────────┐       ┌─────────────────┐
         │   AgentCore      │  ←── │  SentinelAdapter │  ← guardianBus subscriber
         │  (LLM reasoning) │      │  (preflight gate)│    (SENTINEL_MODE env)
         └────────┬────────┘       └────────┬────────┘
                  ▼                          │
    ┌─────────────┴─────────────┐            ▼
    ▼                           ▼   ┌─────────────────┐
┌──────────────┐      ┌──────────────┐   │  SentinelCore   │  ← Pi SDK LLM analyst
│ Web Adapter  │      │  X Adapter   │   │  (risk engine)  │    circuit breaker
│ (SIPHER)     │      │  (HERALD)    │   └─────────────────┘
│ Express /api │      │  Poller →    │
│ /chat,       │      │  mentions,   │
│ /chat/stream │      │  DMs         │
└──────────────┘      └──────────────┘
```

**AgentCore** is the shared LLM reasoning engine. Each adapter wires a persona (SIPHER for web, HERALD for X) with platform-specific I/O. HERALD subscribes to the X poller and routes events through AgentCore with its own identity and X-specific tools (9 tools: post, reply, like, read-mentions, read-user, search-posts, read-dms, send-dm, schedule-post).

**SentinelCore** is the LLM-backed security analyst (Pi SDK). **SentinelAdapter** subscribes to the guardianBus and applies preflight risk assessment (β static rules + γ LLM hybrid) before any fund-moving tool executes. Circuit breaker fires above threshold. Operator-driven rollout via `SENTINEL_MODE=yolo|advisory|off`.

---

## COMMAND CENTER UI (app/)

Privacy command center frontend — adaptive dashboard with persistent chat sidebar, role-based admin views, and dark professional design system.

**Stats:** 2,079 lines | 24 files | 4 views | Zustand state | SSE streaming chat

**Layout:**
- **Desktop (≥1024px):** Top header with tabs + main content + 300px persistent chat sidebar
- **Tablet (768-1023px):** Top header with tabs (incl. Chat tab) + main content
- **Mobile (<768px):** Bottom nav (Home, Vault, Chat, More) + full-screen views

**Views:**
| View | Access | Purpose |
|------|--------|---------|
| Dashboard | All | Metric cards (SOL, privacy score, deposits, budget), activity stream, agent panel |
| Vault | All | Real on-chain balances (SOL + SPL), quick actions, transaction history |
| Herald | Admin | X agent: budget bar, approval queue, DM log, activity timeline |
| Squad | Admin | Agent grid, stats, coordination log, kill switch toggle |
| Chat | All | SIPHER agent chat with SSE streaming (persistent sidebar on desktop) |

**Role-based access:** Admin tabs (Herald, Squad) gated by `isAdmin` in `POST /api/auth/verify` response (checks `AUTHORIZED_WALLETS` env var).

**Key files:**
- `app/src/stores/app.ts` — Zustand store (navigation, auth, chat)
- `app/src/components/ChatSidebar.tsx` — SSE streaming chat (192 lines)
- `app/src/components/Header.tsx` — Desktop/tablet top nav with agent dots
- `app/src/components/BottomNav.tsx` — Mobile bottom nav with More sheet
- `app/src/views/DashboardView.tsx` — Home dashboard (206 lines)

**Dev commands:**
```bash
cd app && pnpm dev        # Dev server (localhost:5173, proxies /api to :3000)
cd app && pnpm build      # Build for production
cd app && npx tsc --noEmit # Type check
```

---

## CONTEXT

**Origin:** Colosseum Agent Hackathon (Feb 2-13, 2026) — $100K USDC prize pool
**Agent ID:** 274 | **Status:** completed (hackathon ended Feb 13, 2026)
**Credentials:** `~/.claude/sip-protocol/sipher/CREDENTIALS.md` (never commit)

---

## TECH STACK

- **Runtime:** Node.js 22 (LTS)
- **Framework:** Express 5
- **Language:** TypeScript (strict)
- **Core:** @sip-protocol/sdk v0.7.4 (stealth addresses, commitments, XChaCha20-Poly1305 encryption, multi-chain)
- **Solana:** @solana/web3.js v1 (transactions, RPC)
- **Agent SDK:** @mariozechner/pi-agent-core + @mariozechner/pi-ai (replaces @anthropic-ai/sdk)
- **LLM:** Pi SDK routing through OpenRouter (default `anthropic/claude-sonnet-4.6`). Provider config in `packages/agent/src/pi/provider.ts`
- **Validation:** Zod v3
- **Logging:** Pino v9 (structured JSON, audit logs)
- **Docs:** swagger-ui-express (OpenAPI 3.1)
- **Cache:** Redis 7 (rate limiting, idempotency) with in-memory fallback
- **Testing:** Vitest + Supertest (555 REST + 1300 agent tests)
- **Deployment:** Docker + GHCR → VPS (port 5006)
- **Domain:** sipher.sip-protocol.org
- **Frontend:** React 19, Vite 6, Tailwind CSS 4, Zustand 5, Phosphor Icons React

---

## DEVELOPMENT COMMANDS

```bash
# Core Development
pnpm install                    # Install dependencies
pnpm dev                        # Dev server (localhost:5006)
pnpm build                      # Build for production
pnpm test -- --run              # Run REST tests (555 tests, 35 suites) + agent tests (1300 tests, 104 suites)
pnpm typecheck                  # Type check
pnpm demo                       # Full-flow demo (requires dev server running)
pnpm openapi:export              # Export static OpenAPI spec to dist/openapi.json
pnpm sdks:generate               # Generate all 4 client SDKs (requires Java)

# Template-Based Engagement (scripts/colosseum.ts)
pnpm colosseum heartbeat        # Autonomous loop (engage every 30 min)
pnpm colosseum engage           # Single engagement cycle
pnpm colosseum leaderboard      # Check vote leaderboard
pnpm colosseum status           # Engagement stats
pnpm colosseum posts            # List forum posts

# LLM-Powered Agent (scripts/sipher-agent.ts) — requires OPENROUTER_API_KEY
npx tsx scripts/sipher-agent.ts run        # Run one LLM-powered engagement cycle
npx tsx scripts/sipher-agent.ts heartbeat  # Continuous LLM loop
npx tsx scripts/sipher-agent.ts status     # Show agent state + engaged agents

# Privacy Demo Agent (scripts/privacy-demo-agent.ts)
npx tsx scripts/privacy-demo-agent.ts      # Full 20-step privacy flow (34 endpoints)
SIPHER_URL=https://sipher.sip-protocol.org npx tsx scripts/privacy-demo-agent.ts  # Against production

# Devnet Shielded Transfer (scripts/devnet-shielded-transfer.ts)
# Prerequisites: funded devnet keypair + server running on devnet RPC
SOLANA_RPC_URL=https://api.devnet.solana.com pnpm dev  # Start server on devnet (separate terminal)
pnpm devnet-demo                           # Execute real on-chain shielded transfer
```

---

## SIPHER AUTONOMOUS AGENT

Two engagement systems available:

### 1. Template-Based (`scripts/colosseum.ts`)
- **Fast, low-cost** — no LLM calls
- Comments use category-based templates
- Votes for all projects automatically
- Good for baseline engagement

### 2. LLM-Powered (`scripts/sipher-agent.ts`)
- **Autonomous reasoning** — thinks before acting
- Uses OpenRouter (Claude Haiku) for decisions
- State-first design: checks local state before LLM call (saves tokens)
- Evaluates projects individually, records decisions
- Generates contextual comments

```
┌─────────────────────────────────────────────────────────────┐
│  STATE-FIRST DESIGN                                         │
│                                                             │
│  1. Load state → check_voted/check_commented (no LLM)       │
│  2. Only NEW items → ask LLM to reason                      │
│  3. Save decision → never reconsider same item              │
└─────────────────────────────────────────────────────────────┘
```

**Agent Tools:**
| Tool | Purpose |
|------|---------|
| `get_projects` | Fetch all hackathon projects |
| `check_voted` | Check state before LLM evaluation |
| `vote_for_project` | Vote with reason |
| `skip_voting` | Record "no" decision (avoid re-evaluation) |
| `get_forum_posts` | Fetch recent posts |
| `check_commented` | Check state before commenting |
| `post_comment` | Post contextual comment |
| `get_our_posts` | See who engaged with us |
| `check_engaged_with_us` | Prioritize reciprocity |
| `get_leaderboard` | Check ranking |
| `done` | Signal cycle complete |

**Cost:** ~$0.10/cycle (Haiku), decreases as state fills up

**State file:** `scripts/.sipher-agent-state.json`

---

## COLOSSEUM HACKATHON (ARCHIVED)

**Status:** Completed (Feb 2-13, 2026) | Ranked #9 of 50 | 25 agent votes, 6 human votes
**Project:** https://colosseum.com/agent-hackathon/projects/sipher-privacy-as-a-skill-for-solana-agents
**Agent ID:** 274 | **Project ID:** 148

---

## PROJECT STRUCTURE

```
sipher/
├── app/                            # Command Center UI (React 19 + Vite + Tailwind 4)
│   ├── src/
│   │   ├── api/                    # API client (auth, SSE, fetch wrapper)
│   │   ├── components/             # UI components (Header, BottomNav, ChatSidebar, MetricCard, ...)
│   │   ├── hooks/                  # React hooks (useAuth, useSSE, useIsAdmin, useTransactionSigner)
│   │   ├── lib/                    # Utilities (agents config, format helpers)
│   │   ├── stores/                 # Zustand store (navigation, auth, chat state)
│   │   ├── styles/                 # theme.css (Tailwind @theme tokens)
│   │   ├── views/                  # DashboardView, VaultView, HeraldView, SquadView
│   │   └── App.tsx                 # Adaptive layout shell (Solana wallet providers)
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── src/
│   ├── app.ts                      # Express app + middleware stack + Swagger UI
│   ├── server.ts                   # HTTP server bootstrap
│   ├── config.ts                   # envalid env validation
│   ├── logger.ts                   # pino structured logger
│   ├── shutdown.ts                 # Graceful shutdown + readiness passthrough
│   ├── constants.ts                # Shared cache sizes + TTL constants
│   ├── errors/
│   │   └── codes.ts                # ErrorCode enum + ERROR_CATALOG
│   ├── openapi/
│   │   └── spec.ts                 # OpenAPI 3.1 spec (all endpoints)
│   ├── middleware/
│   │   ├── auth.ts                 # X-API-Key (timing-safe)
│   │   ├── cors.ts                 # Helmet + CORS
│   │   ├── rate-limit.ts           # express-rate-limit (memory)
│   │   ├── validation.ts           # Zod + validateRequest
│   │   ├── error-handler.ts        # Global error + 404 (uses ErrorCode enum)
│   │   ├── request-id.ts           # X-Request-Id correlation
│   │   ├── audit-log.ts            # Structured audit logging (sensitive field redaction)
│   │   ├── idempotency.ts          # Idempotency-Key header (LRU cache)
│   │   ├── metering.ts            # Daily quota metering (path → category, quota check)
│   │   ├── require-tier.ts          # Enterprise tier gating middleware
│   │   ├── session.ts              # X-Session-Id middleware (merge defaults into req.body)
│   │   └── index.ts                # Barrel exports
│   ├── routes/
│   │   ├── health.ts               # GET /v1/health (extended), GET /v1/ready
│   │   ├── demo.ts                 # GET /v1/demo (live crypto demo, 25 steps)
│   │   ├── errors.ts               # GET /v1/errors (error catalog)
│   │   ├── stealth.ts              # generate, derive, check, generate/batch
│   │   ├── transfer.ts             # shield, claim (+ idempotency)
│   │   ├── private-transfer.ts     # unified chain-agnostic private transfer
│   │   ├── scan.ts                 # payments, payments/batch
│   │   ├── commitment.ts           # create (+ idempotency), verify, add, subtract, create/batch
│   │   ├── viewing-key.ts          # generate, derive, verify-hierarchy, disclose, decrypt
│   │   ├── privacy.ts              # score (surveillance/privacy analysis)
│   │   ├── rpc.ts                  # GET /v1/rpc/providers (provider info)
│   │   ├── backends.ts             # Privacy backend registry (list, health, select)
│   │   ├── private-swap.ts         # Private swap (real Jupiter DEX + stealth)
│   │   ├── session.ts              # Session CRUD (create, get, update, delete)
│   │   ├── governance.ts           # Governance voting privacy (encrypt, submit, tally, getTally)
│   │   ├── compliance.ts           # Compliance (disclose, report, report/:id)
│   │   ├── jito.ts                 # Jito bundle relay (real Block Engine or mock, relay, bundle/:id)
│   │   ├── billing.ts              # Billing & usage (usage, subscription, invoices, portal, webhook)
│   │   ├── admin.ts                # Admin dashboard routes
│   │   ├── cspl.ts                 # C-SPL (confidential SPL token) operations
│   │   └── index.ts                # Route aggregator
│   ├── services/
│   │   ├── solana.ts               # Connection manager + RPC latency measurement
│   │   ├── rpc-provider.ts         # Provider factory (helius, quicknode, triton, generic)
│   │   ├── transaction-builder.ts  # Unsigned tx serialization (Solana)
│   │   ├── chain-transfer-builder.ts # Chain-agnostic transfer dispatch (Solana/EVM/NEAR)
│   │   ├── helius-provider.ts      # Helius DAS API client (getAssetsByOwner, fallback)
│   │   ├── jupiter-provider.ts    # Jupiter DEX provider (real lite-api.jup.ag quotes + swaps)
│   │   ├── private-swap-builder.ts # Private swap orchestrator (stealth + C-SPL + Jupiter)
│   │   ├── backend-comparison.ts  # Backend comparison service (scoring, caching, recommendations)
│   │   ├── session-provider.ts     # Session management (LRU cache + Redis, CRUD, ownership)
│   │   ├── governance-provider.ts # Governance voting (encrypted ballots, nullifiers, homomorphic tally)
│   │   ├── compliance-provider.ts # Compliance provider (disclosure, reports, auditor verification)
│   │   ├── jito-provider.ts       # Jito block engine (real via JITO_BLOCK_ENGINE_URL, mock fallback)
│   │   ├── stripe-provider.ts     # Mock Stripe provider (subscriptions, invoices, portal, webhooks)
│   │   ├── usage-provider.ts      # Usage tracking & daily quotas (Redis + LRU fallback)
│   │   └── backend-registry.ts    # Privacy backend registry singleton (SIPNative)
│   └── types/
│       └── api.ts                  # ApiResponse<T>, HealthResponse
├── skill.md                        # OpenClaw skill file (GET /skill.md)
├── sdks/
│   ├── generator/
│   │   ├── configs/                # Per-language openapi-generator configs
│   │   ├── readmes/                # Custom READMEs per SDK
│   │   └── generate.sh             # Master generation script
│   ├── typescript/                  # Generated (typescript-fetch, native fetch)
│   ├── python/                      # Generated (urllib3)
│   ├── rust/                        # Generated (reqwest, async)
│   └── go/                          # Generated (net/http)
├── integrations/
│   └── eliza/                       # @sip-protocol/plugin-eliza (Eliza agent framework)
│       ├── package.json             # Plugin package (peerDep: @elizaos/core)
│       ├── tsconfig.json
│       ├── README.md
│       └── src/
│           ├── index.ts             # Plugin export (sipherPlugin)
│           ├── client.ts            # SipherClient + createClient factory
│           ├── actions/             # 5 privacy actions
│           │   ├── stealthGenerate  # Stealth keypair generation
│           │   ├── transferShield   # Shielded transfer building
│           │   ├── scanPayments     # Payment detection
│           │   ├── privacyScore     # Wallet privacy analysis
│           │   └── commitmentCreate # Pedersen commitments
│           └── providers/
│               └── sipherStatus     # Health/status context provider
├── scripts/
│   ├── export-openapi.ts            # Export static OpenAPI spec to dist/
│   ├── colosseum.ts                # Template-based engagement (LLM for comments/posts)
│   ├── sipher-agent.ts             # LLM-powered autonomous agent (ReAct loop)
│   ├── privacy-demo-agent.ts      # Privacy demo: 20-step flow, 34 endpoints (judge demo)
│   ├── devnet-shielded-transfer.ts # Real on-chain devnet transfer (7 steps, sign+submit)
│   ├── eliza-plugin-demo.ts       # Eliza plugin demo (5 actions, no runtime needed)
│   └── demo-flow.ts                # Quick-start E2E demo (21 endpoints)
├── packages/
│   └── agent/                      # @sipher/agent — Platform-abstracted agent brain
│       ├── src/
│       │   ├── agent.ts            # Agent loop (Pi SDK via OpenRouter)
│       │   ├── pi/                  # Pi SDK integration: tool-adapter, provider, sipher-agent, stream-bridge
│       │   ├── db.ts               # SQLite persistence (better-sqlite3)
│       │   ├── session.ts          # Conversation session manager
│       │   ├── crank.ts            # Scheduled ops engine (60s interval)
│       │   ├── core/
│       │   │   ├── agent-core.ts   # AgentCore — configurable identity/tools
│       │   │   └── types.ts        # MsgContext interface
│       │   ├── adapters/
│       │   │   ├── web.ts          # Web adapter (SIPHER identity → Express routes)
│       │   │   └── x.ts           # X adapter (HERALD identity → poller events)
│       │   ├── herald/
│       │   │   ├── herald.ts       # HERALD LLM brain (X persona)
│       │   │   ├── poller.ts       # X mention/DM poller
│       │   │   ├── x-client.ts     # X API v2 client
│       │   │   ├── budget.ts       # Daily action budget
│       │   │   ├── approval.ts     # Human-in-the-loop approval
│       │   │   ├── intent.ts       # Intent classification
│       │   │   └── tools/          # 9 X tools (post, reply, like, read-mentions, ...)
│       │   ├── sentinel/           # SENTINEL security layer
│       │   │   ├── sentinel-core.ts    # SentinelCore — Pi SDK LLM risk analyst
│       │   │   ├── sentinel-adapter.ts # SentinelAdapter — guardianBus subscriber + preflight gate
│       │   │   ├── db.ts               # 4 SQLite tables (blacklist, risk_history, pending, decisions)
│       │   │   └── tools/              # 14 SENTINEL tools (7 read + 7 action)
│       │   ├── tools/              # 22 SIPHER agent tools (deposit, send, swap, scan, assessRisk, ...)
│       │   └── routes/             # Agent-specific Express routes (incl. /sentinel/*)
│       └── tests/                  # 1300 agent tests (104 suites)
├── tests/                          # 555 REST tests across 35 suites
│   ├── health.test.ts
│   ├── stealth.test.ts
│   ├── commitment.test.ts
│   ├── transfer-shield.test.ts
│   ├── transfer-claim.test.ts
│   ├── scan.test.ts
│   ├── scan-assets.test.ts
│   ├── viewing-key.test.ts
│   ├── middleware.test.ts
│   ├── error-codes.test.ts
│   ├── openapi.test.ts
│   ├── audit-log.test.ts
│   ├── idempotency.test.ts
│   ├── batch.test.ts
│   ├── privacy-score.test.ts
│   ├── viewing-key-hierarchy.test.ts
│   ├── rpc-provider.test.ts
│   ├── private-transfer.test.ts
│   ├── backends.test.ts
│   ├── private-swap.test.ts
│   ├── backend-comparison.test.ts
│   ├── session.test.ts
│   ├── governance.test.ts
│   ├── compliance.test.ts
│   ├── jito.test.ts
│   ├── billing.test.ts
│   └── demo.test.ts
├── Dockerfile                      # Multi-stage Alpine
├── docker-compose.yml              # name: sipher, port 5006
├── .github/workflows/deploy.yml    # GHCR → VPS
├── .github/workflows/generate-sdks.yml # Auto-regenerate SDKs on spec changes
├── .env.example
├── LICENSE                         # MIT
├── SECURITY.md                     # Vulnerability reporting + security model
├── CHANGELOG.md                    # Phase 1-6 changelog
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## API ENDPOINTS (66 endpoints)

All return `ApiResponse<T>`: `{ success, data?, error? }`

| Method | Path | Description | Auth | Idempotent |
|--------|------|-------------|------|------------|
| GET | `/` | Service info + endpoint directory | No | — |
| GET | `/skill.md` | OpenClaw skill file | No | — |
| GET | `/docs` | Interactive Swagger UI | No | — |
| GET | `/v1/openapi.json` | OpenAPI 3.1 specification | No | — |
| GET | `/v1/health` | Health + Solana RPC latency + memory usage | No | — |
| GET | `/v1/ready` | Readiness probe (200/503) | No | — |
| GET | `/v1/errors` | Error code catalog (code → status → description → retry) | No | — |
| GET | `/v1/demo` | Live crypto demo (25 steps, 35+ endpoints, real crypto) | No | — |
| POST | `/v1/stealth/generate` | Generate stealth meta-address keypair | Yes | — |
| POST | `/v1/stealth/derive` | Derive one-time stealth address | Yes | — |
| POST | `/v1/stealth/check` | Check stealth address ownership | Yes | — |
| POST | `/v1/stealth/generate/batch` | Batch generate stealth keypairs (max 100) | Yes | — |
| POST | `/v1/transfer/shield` | Build unsigned shielded transfer (SOL/SPL) | Yes | ✓ |
| POST | `/v1/transfer/claim` | Build signed claim tx (stealth key derived server-side) | Yes | ✓ |
| POST | `/v1/transfer/private` | Unified chain-agnostic private transfer (7 chains) | Yes | ✓ |
| POST | `/v1/scan/payments` | Scan for incoming stealth payments | Yes | — |
| POST | `/v1/scan/payments/batch` | Batch scan across multiple key pairs (max 100) | Yes | — |
| POST | `/v1/scan/assets` | Query assets at stealth address (Helius DAS + fallback) | Yes | — |
| POST | `/v1/commitment/create` | Create Pedersen commitment | Yes | ✓ |
| POST | `/v1/commitment/verify` | Verify commitment opening | Yes | — |
| POST | `/v1/commitment/add` | Add two commitments (homomorphic) | Yes | — |
| POST | `/v1/commitment/subtract` | Subtract two commitments (homomorphic) | Yes | — |
| POST | `/v1/commitment/create/batch` | Batch create commitments (max 100) | Yes | — |
| POST | `/v1/viewing-key/generate` | Generate viewing key | Yes | — |
| POST | `/v1/viewing-key/derive` | Derive child viewing key (BIP32-style) | Yes | — |
| POST | `/v1/viewing-key/verify-hierarchy` | Verify parent-child key relationship | Yes | — |
| POST | `/v1/viewing-key/disclose` | Encrypt tx data for auditor | Yes | ✓ |
| POST | `/v1/viewing-key/decrypt` | Decrypt tx data with viewing key | Yes | — |
| GET | `/v1/backends` | List privacy backends with capabilities and health | Yes | — |
| GET | `/v1/backends/:id/health` | Per-backend health check with metrics | Yes | — |
| POST | `/v1/backends/select` | Set preferred backend per API key | Yes | — |
| POST | `/v1/backends/compare` | Compare backends for operation (cost, latency, privacy, recommendations) | Yes | — |
| POST | `/v1/privacy/score` | Wallet privacy/surveillance score (0-100) | Yes | — |
| GET | `/v1/rpc/providers` | Active RPC provider info + supported list | No | — |
| POST | `/v1/swap/private` | Privacy-preserving token swap via real Jupiter DEX | Yes | ✓ |
| POST | `/v1/compliance/disclose` | Selective disclosure with scoped viewing key (enterprise) | Yes | ✓ |
| POST | `/v1/compliance/report` | Generate encrypted audit report for time range (enterprise) | Yes | ✓ |
| GET | `/v1/compliance/report/:id` | Retrieve generated compliance report (enterprise) | Yes | — |
| POST | `/v1/sessions` | Create agent session with defaults (pro+) | Yes | — |
| GET | `/v1/sessions/:id` | Get session configuration (pro+) | Yes | — |
| PATCH | `/v1/sessions/:id` | Update session defaults (pro+) | Yes | — |
| DELETE | `/v1/sessions/:id` | Delete session (pro+) | Yes | — |
| POST | `/v1/governance/ballot/encrypt` | Encrypt vote ballot (Pedersen commitment + nullifier) | Yes | — |
| POST | `/v1/governance/ballot/submit` | Submit encrypted ballot to a proposal | Yes | ✓ |
| POST | `/v1/governance/tally` | Homomorphic tally of all ballots for a proposal | Yes | ✓ |
| GET | `/v1/governance/tally/:id` | Get tally result | Yes | — |
| POST | `/v1/jito/relay` | Submit transaction(s) via Jito Block Engine (real when configured, mock fallback) | Yes | ✓ |
| GET | `/v1/jito/bundle/:id` | Poll Jito bundle status (real or mock) | Yes | — |
| GET | `/v1/billing/usage` | Current period usage by category | Yes | — |
| GET | `/v1/billing/subscription` | Current subscription details | Yes | — |
| POST | `/v1/billing/subscribe` | Create/change subscription | Yes | — |
| GET | `/v1/billing/invoices` | List invoices (paginated) | Yes | — |
| POST | `/v1/billing/portal` | Generate Stripe customer portal URL (pro+) | Yes | — |
| POST | `/v1/billing/webhook` | Stripe webhook receiver | No* | — |
| POST | `/v1/sentinel/assess` | Risk assessment for a proposed action | Yes | — |
| GET | `/v1/sentinel/blacklist` | List blacklisted addresses | Yes | — |
| POST | `/v1/sentinel/blacklist` | Add address to blacklist (admin) | Yes | — |
| DELETE | `/v1/sentinel/blacklist/:address` | Remove address from blacklist (admin) | Yes | — |
| GET | `/v1/sentinel/pending` | List pending cancellable actions | Yes | — |
| POST | `/v1/sentinel/circuit-breaker/:id/cancel` | Cancel a pending action | Yes | — |
| GET | `/v1/sentinel/decisions` | Recent SENTINEL risk decisions | Yes | — |
| GET | `/v1/sentinel/status` | SENTINEL mode + health status | Yes | — |

### Idempotency

Mutation endpoints marked ✓ accept `Idempotency-Key` header (UUID v4). Duplicate requests return cached response with `Idempotency-Replayed: true` header. In-memory LRU cache, 10K entries, 24h TTL.

### Audit Logging

All requests are audit-logged with structured JSON (requestId, method, path, status, latency, sanitized body). Sensitive fields (private keys, blinding factors, viewing keys) are automatically redacted to `[REDACTED]`.

---

## MIDDLEWARE STACK (execution order)

```
1. shutdownMiddleware     → Reject during graceful shutdown (pass health + ready)
2. requestIdMiddleware    → Generate/preserve X-Request-ID
3. helmet()               → Security headers (CSP, HSTS, etc.)
4. secureCors             → Dynamic CORS
5. rateLimiter            → 100 req/min (memory-backed)
6. authenticate           → X-API-Key / Bearer token (skip public paths)
7. meteringMiddleware     → Daily quota check + usage tracking per operation category
8. express.json()         → Parse JSON (1MB limit)
9. compression()          → Gzip
10. requestLogger         → pino-http request/response logging
11. auditLog              → Structured audit log with redaction
12. sessionMiddleware     → Merge X-Session-Id defaults into req.body
13. [route handlers]      → API routes (some with idempotency middleware)
14. notFoundHandler       → 404 catch-all
15. errorHandler          → Global error handler (ErrorCode enum)
```

---

## ERROR CODES

All error codes are centralized in `src/errors/codes.ts` (ErrorCode enum). Full catalog served at `GET /v1/errors`.

| Category | Codes |
|----------|-------|
| **400** | VALIDATION_ERROR, INVALID_JSON, INVALID_HEX_STRING, INVALID_AMOUNT, INVALID_ADDRESS |
| **401** | UNAUTHORIZED, INVALID_API_KEY |
| **404** | NOT_FOUND |
| **429** | RATE_LIMITED |
| **500** | INTERNAL_SERVER_ERROR, STEALTH_GENERATION_FAILED, COMMITMENT_FAILED, TRANSFER_BUILD_FAILED, TRANSFER_CLAIM_FAILED, SCAN_FAILED, VIEWING_KEY_FAILED, ENCRYPTION_FAILED, DECRYPTION_FAILED |
| **500** | SWAP_QUOTE_FAILED, PRIVATE_SWAP_FAILED |
| **400** | SWAP_UNSUPPORTED_TOKEN |
| **403** | TIER_ACCESS_DENIED |
| **500** | COMPLIANCE_DISCLOSURE_FAILED, COMPLIANCE_REPORT_FAILED |
| **404** | COMPLIANCE_REPORT_NOT_FOUND |
| **404** | SESSION_NOT_FOUND |
| **410** | SESSION_EXPIRED |
| **500** | SESSION_CREATE_FAILED |
| **500** | GOVERNANCE_ENCRYPT_FAILED, GOVERNANCE_SUBMIT_FAILED, GOVERNANCE_TALLY_FAILED |
| **404** | GOVERNANCE_TALLY_NOT_FOUND, GOVERNANCE_PROPOSAL_NOT_FOUND |
| **409** | GOVERNANCE_DOUBLE_VOTE |
| **500** | JITO_RELAY_FAILED |
| **404** | JITO_BUNDLE_NOT_FOUND |
| **400** | JITO_INVALID_TRANSACTION |
| **429** | DAILY_QUOTA_EXCEEDED |
| **401** | BILLING_WEBHOOK_INVALID |
| **500** | BILLING_SUBSCRIPTION_FAILED, BILLING_INVOICE_FAILED, BILLING_PORTAL_FAILED |
| **503** | SERVICE_UNAVAILABLE, SOLANA_RPC_UNAVAILABLE |

---

## VPS DEPLOYMENT

| Field | Value |
|-------|-------|
| **Host** | 176.222.53.185 (reclabs3) |
| **User** | sip |
| **Port** | 5006 |
| **Domain** | sipher.sip-protocol.org |
| **Containers** | sipher (API), sipher-redis |
| **SSH** | `ssh sip@176.222.53.185` |
| **Compose** | `~/sipher/docker-compose.yml` |

```bash
# Quick health check
ssh sip@176.222.53.185 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep sipher"

# Restart services
ssh sip@176.222.53.185 "cd ~/sipher && docker compose up -d"

# View logs
ssh sip@176.222.53.185 "docker logs sipher --tail 50"
```

**Note:** After VPS migrations, containers need manual `docker compose up -d` — the `unless-stopped` restart policy only survives Docker daemon restarts, not host migrations.

---

## AI GUIDELINES

### DO:
- Run `pnpm test -- --run` after code changes (555 REST tests + 1300 agent tests must pass)
- Run `pnpm typecheck` before committing
- Use @sip-protocol/sdk for all crypto operations (never roll your own)
- Keep API responses consistent: `{ success, data?, error? }`
- Use ErrorCode enum for all error responses (never string literals)
- Reference ecosystem CLAUDE.md for shared standards
- Add tests for every new endpoint or middleware

### DON'T:
- Commit credentials or API keys
- Expose private keys through the API (exception: claim endpoint derives stealth key)
- Skip input validation on public endpoints
- Break compatibility with OpenClaw skill format
- Log sensitive fields unredacted (audit-log middleware handles this)

---

## MULTI-CHAIN SUPPORT

Stealth address endpoints support 17 chains across 6 families:

| Chain Family | Chains | Curve |
|-------------|--------|-------|
| **Solana** | solana | ed25519 |
| **NEAR** | near | ed25519 |
| **Move** | aptos, sui | ed25519 |
| **EVM** | ethereum, polygon, arbitrum, optimism, base | secp256k1 |
| **Cosmos** | cosmos, osmosis, injective, celestia, sei, dydx | secp256k1 |
| **Bitcoin** | bitcoin, zcash | secp256k1 |

All `/stealth/*` endpoints accept a `chain` parameter (default: `solana`). The curve is auto-detected based on chain.

---

## ROADMAP

See [ROADMAP.md](ROADMAP.md) for the full 6-phase roadmap (38 issues across 6 milestones).

| Phase | Theme | Issues | Status |
|-------|-------|--------|--------|
| 1 | Hackathon Polish | 7 | ✅ Complete |
| 2 | Production Hardening | 7 | ✅ Complete |
| 3 | Advanced Privacy | 7 | ✅ Complete |
| 4 | Multi-Chain | 6 | ✅ Complete |
| 5 | Backend Aggregation | 5 | ✅ Complete |
| 6 | Enterprise | 6 | ✅ Complete |

**Progress:** 38/38 issues complete | 555 REST tests + 1300 agent tests | 66 endpoints | 17 chains | All phases complete | Live demo at /v1/demo

**Quick check:** `gh issue list -R sip-protocol/sipher --state open`

---

**Last Updated:** 2026-04-16
**Status:** SENTINEL Formalization Complete | 66 REST Endpoints | 555 REST + 1300 Agent Tests | 22 SIPHER Tools | 14 SENTINEL Tools | 9 HERALD X Tools | 17 Chains | Command Center UI (2,079 lines) | Platform Abstraction (AgentCore + Web/X Adapters + SentinelCore/Adapter) | Real Jupiter API | SQLite Persistence | Devnet Proof
**Devnet Proof:** [Solscan](https://solscan.io/tx/4FmLGsLkC5DYJojpQeSQoGMArsJonTEnx729gnFCeYEjFsr8Z46VrDzKQXLhFrpM9Uj6ezBtCQckU28odzvjvV4a?cluster=devnet) — real 0.01 SOL shielded transfer via stealth address

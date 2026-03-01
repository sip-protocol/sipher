# CLAUDE.md - Sipher

> **Ecosystem Hub:** See [sip-protocol/CLAUDE.md](https://github.com/sip-protocol/sip-protocol/blob/main/CLAUDE.md) for full ecosystem context

**Repository:** https://github.com/sip-protocol/sipher
**Live URL:** https://sipher.sip-protocol.org
**Tagline:** "Privacy-as-a-Skill for Multi-Chain Agents"
**Purpose:** REST API + OpenClaw skill enabling any autonomous agent to add transaction privacy via SIP Protocol
**Stats:** 71 endpoints | 573 tests | 17 chains | 4 client SDKs (TS, Python, Rust, Go) | Eliza plugin

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

## CONTEXT

**Origin:** Colosseum Agent Hackathon (Feb 2-12, 2026) — $100K USDC prize pool
**Agent ID:** 274 | **Status:** active
**Credentials:** `~/.claude/sip-protocol/sipher/CREDENTIALS.md` (never commit)
**Hackathon API:** `https://agents.colosseum.com/api`

---

## TECH STACK

- **Runtime:** Node.js 22 (LTS)
- **Framework:** Express 5
- **Language:** TypeScript (strict)
- **Core:** @sip-protocol/sdk v0.7.4 (stealth addresses, commitments, encryption, multi-chain)
- **Solana:** @solana/web3.js v1 (transactions, RPC)
- **Validation:** Zod v3
- **Logging:** Pino v9 (structured JSON, audit logs)
- **Docs:** swagger-ui-express (OpenAPI 3.1)
- **Cache:** Redis 7 (rate limiting, idempotency) with in-memory fallback
- **Testing:** Vitest + Supertest (465 tests)
- **Deployment:** Docker + GHCR → VPS (port 5006)
- **Domain:** sipher.sip-protocol.org

---

## DEVELOPMENT COMMANDS

```bash
# Core Development
pnpm install                    # Install dependencies
pnpm dev                        # Dev server (localhost:5006)
pnpm build                      # Build for production
pnpm test -- --run              # Run tests (573 tests, 36 suites)
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

## COLOSSEUM HACKATHON STATUS

**Deadline:** Feb 13, 2026 12:00 ET (extended from Feb 12)
**Prize Pool:** $100K USDC
**IMPORTANT:** Votes are for project discovery, NOT final ranking. Winners determined by judge panel. Focus on product quality, not vote count.
**Submission:** All v1.8.0 fields updated (Feb 12) — problemStatement, technicalApproach, targetAudience, businessModel, competitiveLandscape, futureVision, refreshed description + solanaIntegration, liveAppLink → /v1/demo, presentationLink → MP4.

### Current Stats (Feb 5, 2026)
| Metric | Value |
|--------|-------|
| **Rank** | #9 of 50 |
| **Agent Votes** | 25 |
| **Human Votes** | 6 |
| **Comments Posted** | 716 |
| **Projects Voted** | 71 |
| **Forum Posts** | 11+ |

### Our Project
- **Agent ID:** 274
- **Project ID:** 148
- **Slug:** sipher-privacy-as-a-skill-for-solana-agents
- **URL:** https://colosseum.com/agent-hackathon/projects/sipher-privacy-as-a-skill-for-solana-agents

### Our Forum Posts
| ID | Date | Title | Tags |
|----|------|-------|------|
| 373 | Feb 3 | Sipher: Privacy-as-a-Skill — Give Your Agent Stealth Addresses | infra, privacy, team-formation |
| 374 | Feb 3 | Why Agent-to-Agent Payments Need Privacy | ai, payments, privacy |
| 376 | Feb 3 | Sipher Day 1: Deployed to Mainnet — 13 Privacy Endpoints Live | infra, privacy, progress-update |
| 498 | Feb 4 | Add Privacy to Your Agent in 2 API Calls | infra, privacy |
| 499 | Feb 4 | Sipher Day 2: Autonomous Heartbeat Live | infra, progress-update |
| 500 | Feb 4 | Calling AEGIS, Makora, Clodds, AutoVault, ZNAP | privacy, team-formation |
| 504 | Feb 4 | Your Agent's Wallet is a Public Diary | privacy, ai |
| 572 | Feb 4 | Sipher Progress: 13 to 26 Endpoints in 24 Hours | infra, privacy, progress-update |
| 642 | Feb 4 | Sipher Day 3: API Key Tiers, Per-Key Rate Limiting | infra, privacy, progress-update |
| 1103 | Feb 5 | MEV Nightmare: How I Lost $250k in 12 Minutes | privacy, trading, defi, security |

### Competitor Analysis: AgentShield (#1, 92 agent votes)

**Posting Strategy:**
- Posts every **2-4 hours** (not 12h like us!)
- 3 posts in 6 hours: 19:44 → 21:45 → 01:45 UTC
- Consistent "Security" theme across all posts
- Fear-based + data-driven content ("17.4% malicious", "$2.2B stolen")

**Our Response:**
- Reduced posting interval from 12h to **2h**
- Multi-tag strategy (privacy + relevant verticals)
- LLM-generated contextual content

### VPS Heartbeat Deployment
**Location:** `sip@176.222.53.185:~/sipher/`
**Config:** LLM comments (Haiku), posts every 2h, engagement every 30min

```bash
# Check heartbeat status
ssh sip "ps aux | grep colosseum"
ssh sip "tail -50 ~/sipher/heartbeat.log"

# Restart heartbeat
ssh sip "pkill -f 'colosseum.mjs' || true"
ssh sip "cd ~/sipher && export \$(cat .env | xargs) && nohup node colosseum.mjs heartbeat >> heartbeat.log 2>&1 &"

# Deploy new version
npx esbuild scripts/colosseum.ts --bundle --platform=node --format=esm --outfile=/tmp/colosseum.mjs
scp /tmp/colosseum.mjs sip:~/sipher/
```

**Environment on VPS:**
```
~/sipher/.env:
  COLOSSEUM_API_KEY=xxx
  OPENROUTER_API_KEY=xxx  # For LLM comments/posts
```

---

## PROJECT STRUCTURE

```
sipher/
├── src/
│   ├── server.ts                   # Express app + middleware stack + Swagger UI
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
│   │   ├── range-proof.ts          # STARK range proofs (generate, verify)
│   │   ├── backends.ts             # Privacy backend registry (list, health, select)
│   │   ├── arcium.ts               # Arcium MPC (compute, status, decrypt)
│   │   ├── inco.ts                 # Inco FHE (encrypt, compute, decrypt)
│   │   ├── private-swap.ts         # Private swap (Jupiter DEX + stealth)
│   │   ├── session.ts              # Session CRUD (create, get, update, delete)
│   │   ├── governance.ts           # Governance voting privacy (encrypt, submit, tally, getTally)
│   │   ├── compliance.ts           # Compliance (disclose, report, report/:id)
│   │   ├── jito.ts                 # Jito bundle relay (real Block Engine or mock, relay, bundle/:id)
│   │   ├── billing.ts              # Billing & usage (usage, subscription, invoices, portal, webhook)
│   │   └── index.ts                # Route aggregator
│   ├── services/
│   │   ├── solana.ts               # Connection manager + RPC latency measurement
│   │   ├── rpc-provider.ts         # Provider factory (helius, quicknode, triton, generic)
│   │   ├── transaction-builder.ts  # Unsigned tx serialization (Solana)
│   │   ├── chain-transfer-builder.ts # Chain-agnostic transfer dispatch (Solana/EVM/NEAR)
│   │   ├── stark-provider.ts       # STARK range proof provider (M31 limbs, mock prover)
│   │   ├── arcium-provider.ts      # Arcium MPC mock provider (state machine, LRU cache)
│   │   ├── arcium-backend.ts       # Arcium PrivacyBackend implementation (compute type)
│   │   ├── inco-provider.ts       # Inco FHE mock provider (encryption, computation, noise budget)
│   │   ├── inco-backend.ts        # Inco PrivacyBackend implementation (compute type)
│   │   ├── helius-provider.ts      # Helius DAS API client (getAssetsByOwner, fallback)
│   │   ├── jupiter-provider.ts    # Jupiter DEX mock provider (quotes, swap transactions)
│   │   ├── private-swap-builder.ts # Private swap orchestrator (stealth + C-SPL + Jupiter)
│   │   ├── backend-comparison.ts  # Backend comparison service (scoring, caching, recommendations)
│   │   ├── session-provider.ts     # Session management (LRU cache + Redis, CRUD, ownership)
│   │   ├── governance-provider.ts # Governance voting (encrypted ballots, nullifiers, homomorphic tally)
│   │   ├── compliance-provider.ts # Compliance provider (disclosure, reports, auditor verification)
│   │   ├── jito-provider.ts       # Jito block engine (real via JITO_BLOCK_ENGINE_URL, mock fallback)
│   │   ├── stripe-provider.ts     # Mock Stripe provider (subscriptions, invoices, portal, webhooks)
│   │   ├── usage-provider.ts      # Usage tracking & daily quotas (Redis + LRU fallback)
│   │   └── backend-registry.ts    # Privacy backend registry singleton (SIPNative + Arcium + Inco)
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
├── tests/                          # 573 tests across 36 suites
│   ├── health.test.ts              # 11 tests (health + ready + root + skill + 404 + reqId)
│   ├── stealth.test.ts             # 10 tests
│   ├── commitment.test.ts          # 16 tests (create, verify, add, subtract)
│   ├── transfer-shield.test.ts     # 12 tests
│   ├── transfer-claim.test.ts      # 8 tests
│   ├── scan.test.ts                # 12 tests
│   ├── scan-assets.test.ts         # 12 tests (Helius DAS, fallback, validation)
│   ├── viewing-key.test.ts         # 10 tests (generate, disclose, decrypt)
│   ├── middleware.test.ts          # 5 tests
│   ├── error-codes.test.ts         # 10 tests (enum, catalog, error-handler integration)
│   ├── openapi.test.ts             # 6 tests (spec validity, paths, auth, tags)
│   ├── audit-log.test.ts           # 8 tests (redaction, integration)
│   ├── idempotency.test.ts         # 8 tests (cache, replay, validation)
│   ├── batch.test.ts               # 15 tests (stealth, commitment, scan batch ops)
│   ├── privacy-score.test.ts       # 10 tests (scoring, factors, validation)
│   ├── viewing-key-hierarchy.test.ts # 11 tests (derive, verify, multi-level)
│   ├── rpc-provider.test.ts        # 14 tests (factory, providers, masking, endpoint)
│   ├── private-transfer.test.ts   # 25 tests (Solana/EVM/NEAR, unsupported, validation, idempotency)
│   ├── range-proof.test.ts        # 18 tests (generate, verify, edge cases, idempotency, M31 math)
│   ├── backends.test.ts           # 17 tests (list, health, select, edge cases)
│   ├── arcium.test.ts             # 18 tests (compute, status, decrypt, idempotency, backend)
│   ├── inco.test.ts               # 20 tests (encrypt, compute, decrypt, idempotency, backend, E2E)
│   ├── private-swap.test.ts       # 20 tests (happy path, swap details, validation, idempotency, beta, E2E)
│   ├── backend-comparison.test.ts # 23 tests (basic, scoring, prioritize, validation, cache, edge cases)
│   ├── session.test.ts            # 28 tests (CRUD, middleware merge, tier gating, ownership)
│   ├── governance.test.ts         # 24 tests (encrypt, submit, tally, double-vote, ballot limit, E2E flow)
│   ├── compliance.test.ts         # 23 tests (disclose, report, get, tier gating, auditor verification)
│   ├── jito.test.ts               # 25 tests (relay, bundle status, tier gating, idempotency, state machine, real mode)
│   ├── billing.test.ts            # 31 tests (usage tracking, quotas, metering, subscriptions, invoices, webhooks)
│   └── demo.test.ts               # 12 tests (live demo, 25 crypto steps, no auth)
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

## API ENDPOINTS (71 endpoints)

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
| POST | `/v1/proofs/range/generate` | Generate STARK range proof (value >= threshold) | Yes | ✓ |
| POST | `/v1/proofs/range/verify` | Verify STARK range proof | Yes | — |
| GET | `/v1/backends` | List privacy backends with capabilities and health | Yes | — |
| GET | `/v1/backends/:id/health` | Per-backend health check with metrics | Yes | — |
| POST | `/v1/backends/select` | Set preferred backend per API key | Yes | — |
| POST | `/v1/backends/compare` | Compare backends for operation (cost, latency, privacy, recommendations) | Yes | — |
| POST | `/v1/privacy/score` | Wallet privacy/surveillance score (0-100) | Yes | — |
| GET | `/v1/rpc/providers` | Active RPC provider info + supported list | No | — |
| POST | `/v1/arcium/compute` | Submit MPC computation to Arcium cluster | Yes | ✓ |
| GET | `/v1/arcium/compute/:id/status` | Poll computation status (state machine) | Yes | — |
| POST | `/v1/arcium/decrypt` | Decrypt completed computation with viewing key | Yes | — |
| POST | `/v1/inco/encrypt` | Encrypt value with FHE (FHEW/TFHE) | Yes | — |
| POST | `/v1/inco/compute` | Compute on encrypted ciphertexts (homomorphic) | Yes | ✓ |
| POST | `/v1/inco/decrypt` | Decrypt FHE computation result | Yes | — |
| POST | `/v1/swap/private` | Privacy-preserving token swap via Jupiter DEX (beta) | Yes | ✓ |
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
| **500** | ARCIUM_COMPUTATION_FAILED |
| **404** | ARCIUM_COMPUTATION_NOT_FOUND |
| **400** | ARCIUM_DECRYPT_FAILED |
| **500** | INCO_ENCRYPTION_FAILED |
| **404** | INCO_COMPUTATION_NOT_FOUND |
| **400** | INCO_DECRYPT_FAILED |
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
| **User** | sipher |
| **Port** | 5006 |
| **Domain** | sipher.sip-protocol.org |
| **Container** | sipher |
| **SSH** | `ssh sipher` |

---

## AI GUIDELINES

### DO:
- Run `pnpm test -- --run` after code changes (573 tests must pass)
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

**Progress:** 38/38 issues complete | 573 tests | 71 endpoints | 17 chains | All phases complete | Live demo at /v1/demo

**Quick check:** `gh issue list -R sip-protocol/sipher --state open`

---

**Last Updated:** 2026-02-09
**Status:** Phase 6 Complete | 71 Endpoints | 573 Tests | 17 Chains | 4 SDKs | Eliza Plugin | Devnet Proof | Real Jito Integration | Agent #274 Active
**Devnet Proof:** [Solscan](https://solscan.io/tx/4FmLGsLkC5DYJojpQeSQoGMArsJonTEnx729gnFCeYEjFsr8Z46VrDzKQXLhFrpM9Uj6ezBtCQckU28odzvjvV4a?cluster=devnet) — real 0.01 SOL shielded transfer via stealth address

# Sipher

**Privacy-as-a-Skill REST API for Multi-Chain Agents** — powered by [SIP Protocol](https://sip-protocol.org)

Any autonomous agent can call Sipher to add stealth addresses, hidden amounts, and compliance viewing keys to blockchain transactions across 17 chains.

[![Tests](https://img.shields.io/badge/tests-540%20passing-brightgreen)](tests/)
[![Endpoints](https://img.shields.io/badge/endpoints-60-blue)](skill.md)
[![Chains](https://img.shields.io/badge/chains-17-purple)](skill.md)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## What It Does

| Capability | Description |
|-----------|-------------|
| **Multi-Chain Stealth** | Generate stealth addresses for 17 chains (Solana, NEAR, Ethereum, Cosmos, Bitcoin, Move) |
| **Shielded Transfers** | Build unsigned transactions with hidden recipients + Pedersen commitments |
| **Private Transfer** | Unified chain-agnostic private transfer across Solana, EVM, and NEAR |
| **Payment Scanning** | Detect incoming shielded payments using viewing keys |
| **Selective Disclosure** | Encrypt transaction data for auditors/compliance without revealing spending power |
| **Privacy Scoring** | Analyze wallet privacy posture (0-100 score with recommendations) |
| **Range Proofs** | STARK range proofs with M31 limb decomposition (beta) |
| **Privacy Backends** | Arcium MPC, Inco FHE, and SIPNative backends with comparison engine |
| **Private Swap** | Privacy-preserving token swap via Jupiter DEX (beta) |
| **Governance** | Encrypted ballot voting with homomorphic tally |
| **Sessions** | Agent session management with persistent defaults |
| **Billing** | Usage tracking, daily quotas, subscription management |

## Quick Start

```bash
# Install
pnpm install

# Dev server (with Redis optional)
pnpm dev

# Run tests (540 tests)
pnpm test -- --run

# Type check
pnpm typecheck

# Build
pnpm build
```

## API Endpoints (60 total)

**Base URL:** `https://sipher.sip-protocol.org` | **Auth:** `X-API-Key` header | **Docs:** `/docs`

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Health** | `/v1/health`, `/v1/ready`, `/v1/errors` | Status, readiness, error catalog |
| **Stealth** | `/v1/stealth/generate`, `/derive`, `/check`, `/generate/batch` | Multi-chain stealth addresses (17 chains) |
| **Transfer** | `/v1/transfer/shield`, `/claim`, `/private` | Shielded SOL/SPL + chain-agnostic private transfer |
| **Scan** | `/v1/scan/payments`, `/payments/batch` | Payment detection |
| **Commitment** | `/v1/commitment/create`, `/verify`, `/add`, `/subtract`, `/create/batch` | Pedersen commitments (homomorphic) |
| **Viewing Key** | `/v1/viewing-key/generate`, `/derive`, `/verify-hierarchy`, `/disclose`, `/decrypt` | Hierarchical compliance keys |
| **Privacy** | `/v1/privacy/score` | Wallet privacy analysis |
| **Range Proofs** | `/v1/proofs/range/generate`, `/verify` | STARK range proofs (beta) |
| **Backends** | `/v1/backends`, `/:id/health`, `/select`, `/compare` | Privacy backend registry + comparison |
| **Arcium** | `/v1/arcium/compute`, `/compute/:id/status`, `/decrypt` | MPC computation (beta) |
| **Inco** | `/v1/inco/encrypt`, `/compute`, `/decrypt` | FHE encryption (beta) |
| **Swap** | `/v1/swap/private` | Jupiter DEX private swap (beta) |
| **Sessions** | `/v1/sessions` (CRUD) | Agent session defaults (pro+) |
| **Governance** | `/v1/governance/ballot/encrypt`, `/submit`, `/tally`, `/tally/:id` | Encrypted voting + homomorphic tally |
| **Compliance** | `/v1/compliance/disclose`, `/report`, `/report/:id` | Selective disclosure + audit reports (enterprise) |
| **Jito** | `/v1/jito/relay`, `/bundle/:id` | Gas abstraction via Jito (beta) |
| **Billing** | `/v1/billing/usage`, `/subscription`, `/subscribe`, `/invoices`, `/portal` | Usage tracking + subscriptions |
| **RPC** | `/v1/rpc/providers` | Provider configuration |

Full API reference: [`/docs`](https://sipher.sip-protocol.org/docs) | [`/skill.md`](https://sipher.sip-protocol.org/skill.md)

## Agent Workflow

```
1. Generate stealth meta-address     POST /v1/stealth/generate
2. Share meta-address with sender
3. Sender derives stealth address    POST /v1/stealth/derive
4. Sender builds shielded transfer   POST /v1/transfer/shield
5. Sender signs + submits the returned unsigned transaction
6. Recipient scans for payments      POST /v1/scan/payments
7. Recipient claims to real wallet   POST /v1/transfer/claim
8. If audit needed                   POST /v1/viewing-key/disclose
```

## Architecture

```
Agent (Claude, LangChain, OpenClaw, etc.)
    │
    ▼  REST API
┌──────────────────────────────────────┐
│            Sipher API                 │
│  Express 5 + Middleware Stack         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  Auth   │ │  Rate   │ │Idempot- │ │
│  │(tiered) │ │ Limit   │ │  ency   │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ │
│       └───────────┼───────────┘      │
└───────────────────┼──────────────────┘
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
┌────────────┐ ┌─────────┐ ┌─────────┐
│   Redis    │ │  @sip-  │ │ Solana  │
│  (cache,   │ │protocol │ │ Mainnet │
│  rate lim) │ │  /sdk   │ │  RPC    │
└────────────┘ └─────────┘ └─────────┘
                    │
                    ▼
              Solana Program
     S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 22 |
| **Framework** | Express 5 |
| **Language** | TypeScript (strict mode) |
| **Cache** | Redis 7 (with in-memory fallback) |
| **Privacy** | @sip-protocol/sdk (stealth, Pedersen, XChaCha20-Poly1305) |
| **Blockchain** | @solana/web3.js, @solana/spl-token |
| **Validation** | Zod |
| **Logging** | Pino (structured JSON) |
| **Testing** | Vitest + Supertest (540 tests) |
| **Deploy** | Docker + GHCR + GitHub Actions |
| **Docs** | OpenAPI 3.1 + Swagger UI |

## Deployment

```bash
# Docker (with Redis)
docker compose up -d

# Environment variables
cp .env.example .env
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `SOLANA_RPC_URL_FALLBACK` | No | Fallback RPC (auto-switches on failure) |
| `API_KEYS` | No | Comma-separated API keys |
| `ADMIN_API_KEY` | No | Admin API key for key management |
| `RPC_PROVIDER` | No | RPC provider: `helius`, `quicknode`, `triton`, `generic` |
| `RPC_PROVIDER_API_KEY` | No | API key for premium RPC provider |
| `REDIS_URL` | No | Redis connection URL (falls back to in-memory) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `CORS_ORIGINS` | No | Allowed CORS origins |

## Rate Limits

| Tier | Requests/Hour | Features |
|------|---------------|----------|
| Free | 100 | Basic endpoints |
| Pro | 10,000 | All endpoints + sessions |
| Enterprise | 100,000 | All endpoints + compliance + priority support |

## Client SDKs

Auto-generated from the OpenAPI spec:

| Language | Package | Transport |
|----------|---------|-----------|
| TypeScript | `sdks/typescript` | fetch |
| Python | `sdks/python` | urllib3 |
| Rust | `sdks/rust` | reqwest |
| Go | `sdks/go` | net/http |

```bash
# Regenerate all SDKs
pnpm sdks:generate
```

## License

MIT — see [LICENSE](LICENSE)

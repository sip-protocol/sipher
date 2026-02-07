# Changelog

All notable changes to Sipher are documented here.

## [1.0.0] - 2026-02-06

Production release with 77 endpoints, 540 tests, 17 chains, and 4 client SDKs.

### Phase 6: Enterprise (Complete)

- **Billing & Metering**: Usage tracking with daily quotas per API key, Stripe subscription management, invoice listing, customer portal
- **Jito Gas Abstraction**: Bundle relay and status polling via Jito block engine
- **Compliance**: Selective disclosure with scoped viewing keys, encrypted audit reports for time ranges
- **Sessions**: Agent session CRUD with Redis/LRU storage, `X-Session-Id` middleware merges defaults into requests
- **Governance**: Encrypted ballot submission with Pedersen commitments, nullifier-based double-vote prevention, homomorphic tally
- **Tier Gating**: `requireTier` middleware restricts enterprise endpoints to pro+ API keys

### Phase 5: Backend Aggregation (Complete)

- **Privacy Backend Registry**: SIPNative, Arcium MPC, and Inco FHE backends with health checks
- **Backend Comparison**: Scoring engine comparing cost, latency, privacy level with recommendations
- **Arcium MPC**: Computation submission, status polling (state machine), and decryption
- **Inco FHE**: FHEW/TFHE encryption, homomorphic computation, noise budget tracking
- **Private Swap**: Privacy-preserving token swap via Jupiter DEX with stealth addresses
- **Client SDKs**: Auto-generated TypeScript, Python, Rust, Go clients from OpenAPI spec

### Phase 4: Multi-Chain (Complete)

- **17 Chains**: Solana, NEAR, Aptos, Sui, Ethereum, Polygon, Arbitrum, Optimism, Base, Cosmos, Osmosis, Injective, Celestia, Sei, dYdX, Bitcoin, Zcash
- **Unified Private Transfer**: Chain-agnostic `POST /v1/transfer/private` dispatches to Solana/EVM/NEAR builders
- **Auto Curve Detection**: Ed25519 for Solana/NEAR/Move, secp256k1 for EVM/Cosmos/Bitcoin

### Phase 3: Advanced Privacy (Complete)

- **Batch Operations**: Stealth generate, commitment create, scan payments — all support batch (max 100)
- **Privacy Scoring**: Wallet surveillance/privacy analysis (0-100 score with factor breakdown)
- **Hierarchical Viewing Keys**: BIP32-style derivation, parent-child verification
- **STARK Range Proofs**: Generate and verify range proofs with M31 limb decomposition

### Phase 2: Production Hardening (Complete)

- **Redis Integration**: Rate limiting and idempotency backed by Redis 7 (in-memory fallback)
- **OpenAPI 3.1**: Full spec with Swagger UI at `/docs`
- **Error Catalog**: Centralized ErrorCode enum served at `GET /v1/errors`
- **Audit Logging**: Structured JSON logs with automatic sensitive field redaction
- **Idempotency**: `Idempotency-Key` header for mutation endpoints (LRU cache, 24h TTL)
- **Health Checks**: Extended health with RPC latency, memory usage, readiness probe
- **RPC Provider Abstraction**: Helius, QuickNode, Triton, generic — with endpoint masking
- **RPC Failover**: Primary/fallback connection with auto-switch and recovery

### Phase 1: Hackathon Core (Complete)

- **Stealth Addresses**: Generate meta-address keypair, derive one-time address, check ownership
- **Shielded Transfers**: Build unsigned shield/claim transactions (SOL + SPL)
- **Payment Scanning**: Scan Solana memo program for SIP announcements
- **Pedersen Commitments**: Create, verify, homomorphic add/subtract
- **Viewing Keys**: Generate, selective disclosure, decrypt
- **Express 5 API**: Full middleware stack (auth, CORS, rate limiting, validation, compression)
- **Docker Deployment**: Multi-stage Alpine build, GHCR + VPS auto-deploy

### Security Fixes

- Timing-safe comparison for webhook signatures
- Fail-closed quota enforcement when usage service unavailable
- Ballot cap (10,000) per governance proposal to prevent memory exhaustion
- Empty Bearer token rejection
- Admin response shape normalization

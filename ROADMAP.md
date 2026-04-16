# Sipher Roadmap — Privacy-as-a-Skill for Autonomous Agents

## Endgame Vision

Sipher becomes the **universal privacy middleware API** — the single REST endpoint any agent, app, or service calls to add privacy to blockchain transactions. "Stripe for privacy" — dead-simple API, all complexity internal.

**Principles:** Agent-first | Chain-agnostic | Backend-agnostic | Compliance-ready | Zero custody

**Revenue path:** Tiered API keys (free/pro/enterprise) with metered billing per privacy operation.

**Moat:** Depth of SDK (6,661+ tests), backend aggregation (6+ privacy backends), agent-native design.

---

## Phase 1: Hackathon Polish (Feb 5-12) ✅

> Fill critical gaps, make the demo bulletproof for Colosseum judges.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S1-01 | Add transfer/shield endpoint tests | S | ✅ |
| S1-02 | Add transfer/claim endpoint tests | M | ✅ |
| S1-03 | Add scan/payments endpoint tests | S | ✅ |
| S1-04 | Create full-flow demo script (generate → derive → shield → scan → claim) | S | ✅ |
| S1-05 | Add commitment homomorphic operations (add, subtract) | S | ✅ |
| S1-06 | Add viewing key decrypt endpoint | S | ✅ |
| S1-07 | Create progress update forum posts daily until Feb 12 | S | 🤖 Automated |

**Outcome:** ~~39 → 65+ tests~~ **231 tests**, ~~13 → 16 endpoints~~ **70 endpoints**, full-flow demo script in repo.

---

## Phase 2: Production Hardening (Feb-Mar 2026) ✅

> Make Sipher reliable enough that agents depend on it in production.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S2-01 | Add OpenAPI/Swagger spec served at /docs | M | ✅ |
| S2-02 | Implement API key management with usage tiers (free/pro/enterprise) | L | ✅ |
| S2-03 | Add Redis for rate limiting, idempotency, and session state | L | ✅ |
| S2-04 | Add idempotency key support for all mutation endpoints | M | ✅ |
| S2-05 | Add comprehensive error codes enum and error catalog at GET /errors | S | ✅ |
| S2-06 | Add request audit logging (sanitized payloads to structured logs) | M | ✅ |
| S2-07 | Extend health check to cover all subsystems (RPC latency, Redis, cert expiry) | S | ✅ |

**Outcome:** Production-grade reliability, proper auth tiers, machine-readable error catalog. (7/7 complete)

---

## Phase 3: Advanced Privacy Features (Mar-Apr 2026) ✅

> Expose full SDK depth. This is where Sipher becomes irreplaceable.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S3-01 | Add surveillance/privacy scoring endpoint (wallet analysis, 0-100 score) | L | ✅ |
| S3-02 | Add batch operations (multi-recipient stealth, batch commitments, batch scan) | M | ✅ |
| S3-03 | Add ZK proof generation/verification endpoints (Noir: funding, validity, fulfillment) | XL | ✅ β |
| S3-04 | Add C-SPL (Confidential SPL Tokens) endpoints (wrap, unwrap, transfer) | L | ✅ β |
| S3-05 | Add viewing key hierarchical derivation (BIP32-style, role-based) | M | ✅ |
| S3-06 | Add real-time webhook endpoint for push-based payment detection (Helius) | XL | ✅ |
| S3-07 | Add RPC provider abstraction (Helius, QuickNode, Triton per API key) | M | ✅ |

**Outcome:** Surveillance scoring (conversion tool), ZK proofs, C-SPL, webhooks — full privacy stack. (7/7 complete)

---

## Phase 4: Multi-Chain Expansion (Apr-Jun 2026) ✅

> Extend beyond Solana. SDK already supports NEAR, Ethereum, Cosmos, Bitcoin, Move chains.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S4-01 | Add NEAR stealth address and viewing key endpoints | L | ✅ |
| S4-02 | Add Ethereum/EVM stealth address endpoints (secp256k1) | M | ✅ |
| S4-03 | Add chain-agnostic unified transfer endpoint (POST /transfer/private) | XL | ✅ |
| S4-04 | Add Cosmos stealth address endpoints (Osmosis, Injective, Celestia) | M | ✅ |
| S4-05 | Add Bitcoin Taproot stealth address endpoints (Schnorr-based) | L | ✅ |
| S4-06 | Add Move chain endpoints (Aptos, Sui) | M | ✅ |

**Outcome:** 6 chain families supported through unified API. (6/6 complete)

---

## Phase 5: Privacy Backend Aggregation (Jun-Aug 2026) ✅

> The "OpenRouter for privacy" moment. Single API routing through multiple privacy backends.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S5-01 | Expose PrivacyBackendRegistry via API (list, health, select) | L | ✅ |
| S5-02 | Add Arcium MPC backend endpoints (compute, status, decrypt) | L | ✅ |
| S5-03 | Add Inco FHE backend endpoints (encrypt, compute, decrypt) | L | ✅ |
| S5-04 | Add PrivateSwap composite endpoint (stealth + C-SPL + swap in one call) | XL | ✅ |
| S5-05 | Add privacy backend comparison endpoint (cost, latency, privacy level) | M | ✅ |

**Outcome:** 5+ privacy backends routed through unified API. (5/5 complete)

---

## Phase 6: Enterprise & Ecosystem (Aug-Dec 2026)

> Revenue generation, enterprise adoption, ecosystem growth.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S6-01 | Add compliance/disclosure endpoints (selective disclosure, audit reports) | L | ✅ |
| S6-02 | Auto-generate typed client SDKs (Python, Rust, Go) from OpenAPI spec | L | ✅ |
| S6-03 | Add billing and metering middleware (Stripe integration, usage tracking) | XL | ✅ |
| S6-04 | Add agent session management (pre-configured defaults per session) | M | ✅ |
| S6-05 | Add governance/voting privacy endpoints (encrypted ballots, homomorphic tally) | M | ✅ |
| S6-06 | Add Jito gas abstraction endpoint (relay transactions via Jito bundles) | M | ✅ |

**Outcome:** Revenue stream, enterprise compliance, multi-language SDK, gas abstraction. (6/6 complete ✅)

---

## Phase 7: SENTINEL Security Layer (Apr 2026) ✅

> Autonomous threat detection and risk governance for fund-moving actions.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S7-01 | SentinelCore — Pi SDK LLM risk analyst (β static + γ LLM hybrid) | XL | ✅ |
| S7-02 | SentinelAdapter — guardianBus subscriber with mode gates + loop prevention | L | ✅ |
| S7-03 | Preflight risk-assessment gate in executeTool | L | ✅ |
| S7-04 | Circuit breaker for fund-moving actions above threshold (startup recovery) | M | ✅ |
| S7-05 | 14 SENTINEL tools (7 read + 7 action) with adversarial-data fencing | XL | ✅ |
| S7-06 | 8 REST endpoints (public + admin split, requireOwner) | M | ✅ |
| S7-07 | 4 SQLite tables (blacklist, risk_history, pending_actions, decisions) | M | ✅ |
| S7-08 | SENTINEL_MODE=yolo|advisory|off operator rollout | S | ✅ |
| S7-09 | assessRisk tool added to SIPHER (22 total SIPHER tools) | S | ✅ |

**Outcome:** Autonomous security layer — LLM risk analyst screens all fund-moving actions, operator-driven rollout, full audit trail. (9/9 complete ✅)

---

## Summary

| Phase | Theme | Issues | Timeline | Status |
|-------|-------|--------|----------|--------|
| 1 | Hackathon Polish | 7 | Feb 5-12 | ✅ Complete |
| 2 | Production Hardening | 7 | Feb-Mar | ✅ Complete |
| 3 | Advanced Privacy | 7 | Mar-Apr | ✅ Complete |
| 4 | Multi-Chain | 6 | Apr-Jun | ✅ Complete |
| 5 | Backend Aggregation | 5 | Jun-Aug | ✅ Complete |
| 6 | Enterprise | 6 | Aug-Dec | ✅ Complete |
| 7 | SENTINEL Security | 9 | Apr 2026 | ✅ Complete |

**Progress: 38/38 issues complete** | **497 REST + 905 agent tests** | **66 endpoints** | **17 chains**

---

**Last Updated:** 2026-04-16

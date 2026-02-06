# Sipher — Privacy-as-a-Skill for Multi-Chain Agents

> Add stealth addresses, hidden amounts, and compliance viewing keys to blockchain transactions across 17 chains.

**Base URL:** `https://sipher.sip-protocol.org`
**Auth:** `X-API-Key: <your-key>` header (skip for `GET /`, `GET /skill.md`, `GET /v1/health`, `GET /v1/ready`, `GET /v1/errors`)
**Rate Limits:** Tiered by API key — Free: 100/hr, Pro: 10K/hr, Enterprise: 100K/hr
**Docs:** Interactive API docs at `/docs` | OpenAPI spec at `/v1/openapi.json`

---

## What Sipher Does

Sipher wraps [SIP Protocol](https://sip-protocol.org)'s privacy SDK as a REST API. Any autonomous agent can call these endpoints to:

1. **Generate multi-chain stealth addresses** — one-time recipient addresses for 17 chains (Solana, NEAR, Ethereum, Cosmos, Bitcoin, Move)
2. **Create shielded transfers** — build unsigned Solana transactions with hidden recipients via stealth addresses and hidden amounts via Pedersen commitments
3. **Scan for payments** — detect incoming shielded payments using viewing keys
4. **Selective disclosure** — encrypt/decrypt transaction data for auditors/compliance using viewing keys
5. **Homomorphic commitment math** — add and subtract commitments without revealing values

All privacy operations use:
- **Stealth addresses** — unlinkable one-time addresses (ed25519 for Solana/NEAR/Move, secp256k1 for EVM/Cosmos/Bitcoin)
- **Pedersen commitments** — homomorphic commitments hiding amounts
- **Viewing keys** — selective disclosure for compliance without revealing spending power

### Supported Chains (17 total)

| Chain Family | Chains | Curve |
|-------------|--------|-------|
| **Solana** | solana | ed25519 |
| **NEAR** | near | ed25519 |
| **Move** | aptos, sui | ed25519 |
| **EVM** | ethereum, polygon, arbitrum, optimism, base | secp256k1 |
| **Cosmos** | cosmos, osmosis, injective, celestia, sei, dydx | secp256k1 |
| **Bitcoin** | bitcoin, zcash | secp256k1 |

---

## Endpoints

All responses follow: `{ success: boolean, data?: T, error?: { code, message, details? } }`

### Health & Meta

```
GET /v1/health        → Server status, Solana RPC latency, memory usage
GET /v1/ready         → Readiness probe (200 if healthy, 503 otherwise)
GET /v1/errors        → Full error code catalog with retry guidance
GET /v1/openapi.json  → OpenAPI 3.1 specification
GET /docs             → Interactive Swagger UI
```

---

### Stealth Addresses

#### Generate Meta-Address Keypair

```
POST /v1/stealth/generate
Content-Type: application/json

{
  "chain": "solana",
  "label": "My Agent Wallet"
}
```

**Parameters:**
- `chain` — Target blockchain (default: `solana`). See supported chains above.
- `label` — Optional human-readable label.

Returns: `metaAddress` (spending + viewing public keys), `spendingPrivateKey`, `viewingPrivateKey`, `chain`, `curve`

#### Derive One-Time Stealth Address

```
POST /v1/stealth/derive
Content-Type: application/json

{
  "recipientMetaAddress": {
    "spendingKey": "0x...",
    "viewingKey": "0x...",
    "chain": "solana"
  }
}
```

Returns: `stealthAddress` (address, ephemeralPublicKey, viewTag), `sharedSecret`

#### Check Ownership

```
POST /v1/stealth/check
Content-Type: application/json

{
  "stealthAddress": {
    "address": "0x...",
    "ephemeralPublicKey": "0x...",
    "viewTag": 42
  },
  "spendingPrivateKey": "0x...",
  "viewingPrivateKey": "0x..."
}
```

Returns: `{ isOwner: boolean }`

---

### Shielded Transfers

Mutation endpoints support `Idempotency-Key` header (UUID v4) for safe retries.

#### Build Shielded Transfer (Unsigned)

```
POST /v1/transfer/shield
Content-Type: application/json

{
  "sender": "<base58 Solana address>",
  "recipientMetaAddress": {
    "spendingKey": "0x...",
    "viewingKey": "0x...",
    "chain": "solana"
  },
  "amount": "1000000000",
  "mint": "<optional SPL token mint address>"
}
```

Returns unsigned base64 transaction, stealth address, commitment, viewing key hash. Agent signs and submits.

#### Claim Stealth Payment (Signed)

```
POST /v1/transfer/claim
Content-Type: application/json

{
  "stealthAddress": "<base58>",
  "ephemeralPublicKey": "<base58>",
  "spendingPrivateKey": "0x...",
  "viewingPrivateKey": "0x...",
  "destinationAddress": "<base58>",
  "mint": "<SPL token mint>"
}
```

Derives stealth private key server-side, signs and submits claim transaction. Returns `txSignature`.

#### Unified Private Transfer (Chain-Agnostic)

```
POST /v1/transfer/private
Content-Type: application/json

{
  "sender": "<chain-native address>",
  "recipientMetaAddress": {
    "spendingKey": "0x...",
    "viewingKey": "0x...",
    "chain": "ethereum"
  },
  "amount": "1000000000000000000",
  "token": "<optional token contract/mint>"
}
```

**Supported chains:** solana, ethereum, polygon, arbitrum, optimism, base, near

Returns chain-specific `chainData`:
- **Solana:** `{ type: "solana", transaction: "<base64>" }` — unsigned transaction, agent signs and submits
- **EVM:** `{ type: "evm", to, value, data, chainId }` — TX descriptor, agent builds with ethers/viem/web3
- **NEAR:** `{ type: "near", receiverId, actions[] }` — action descriptors, agent signs with near-api-js

Plus common privacy fields: `stealthAddress`, `ephemeralPublicKey`, `viewTag`, `commitment`, `blindingFactor`, `viewingKeyHash`, `sharedSecret`.

Unsupported chains return `422` with `supportedChains` array.

---

### Scan for Payments

```
POST /v1/scan/payments
Content-Type: application/json

{
  "viewingPrivateKey": "0x...",
  "spendingPublicKey": "0x...",
  "fromSlot": 300000000,
  "limit": 100
}
```

Scans Solana for SIP announcements matching your viewing key. Returns array of detected payments.

---

### Pedersen Commitments

#### Create Commitment

```
POST /v1/commitment/create
Content-Type: application/json

{ "value": "1000000000" }
```

Returns: `commitment` (curve point), `blindingFactor`

#### Verify Commitment

```
POST /v1/commitment/verify
Content-Type: application/json

{
  "commitment": "0x...",
  "value": "1000000000",
  "blindingFactor": "0x..."
}
```

Returns: `{ valid: boolean }`

#### Add Commitments (Homomorphic)

```
POST /v1/commitment/add
Content-Type: application/json

{
  "commitmentA": "0x...",
  "commitmentB": "0x...",
  "blindingA": "0x...",
  "blindingB": "0x..."
}
```

Returns: combined `commitment` and `blindingFactor` representing sum of hidden values.

#### Subtract Commitments (Homomorphic)

```
POST /v1/commitment/subtract
Content-Type: application/json

{
  "commitmentA": "0x...",
  "commitmentB": "0x...",
  "blindingA": "0x...",
  "blindingB": "0x..."
}
```

Returns: combined `commitment` and `blindingFactor` representing difference of hidden values.

---

### Viewing Keys

#### Generate Viewing Key

```
POST /v1/viewing-key/generate
Content-Type: application/json

{ "path": "m/0" }
```

Returns: viewing key with `key`, `path`, `hash`

#### Derive Child Viewing Key (BIP32-style)

```
POST /v1/viewing-key/derive
Content-Type: application/json

{
  "masterKey": {
    "key": "0x...",
    "path": "m/0",
    "hash": "0x..."
  },
  "childPath": "audit"
}
```

Returns: derived child viewing key with `key`, `path` (e.g., `m/0/audit`), `hash`, and `derivedFrom` metadata.

Supports multi-level derivation: `m/0 → m/0/org → m/0/org/2026 → m/0/org/2026/Q1`

#### Verify Key Hierarchy

```
POST /v1/viewing-key/verify-hierarchy
Content-Type: application/json

{
  "parentKey": { "key": "0x...", "path": "m/0", "hash": "0x..." },
  "childKey": { "key": "0x...", "path": "m/0/audit", "hash": "0x..." },
  "childPath": "audit"
}
```

Returns: `{ valid: boolean }` — verifies the child key was derived from the parent at the specified path.

#### Encrypt for Disclosure

```
POST /v1/viewing-key/disclose
Content-Type: application/json

{
  "viewingKey": {
    "key": "0x...",
    "path": "m/0",
    "hash": "0x..."
  },
  "transactionData": {
    "sender": "<address>",
    "recipient": "<stealth address>",
    "amount": "1000000000",
    "timestamp": 1706000000000
  }
}
```

Returns encrypted payload (ciphertext, nonce, viewingKeyHash) that only the viewing key holder can decrypt.

#### Decrypt with Viewing Key

```
POST /v1/viewing-key/decrypt
Content-Type: application/json

{
  "viewingKey": {
    "key": "0x...",
    "path": "m/0",
    "hash": "0x..."
  },
  "encrypted": {
    "ciphertext": "0x...",
    "nonce": "0x...",
    "viewingKeyHash": "0x..."
  }
}
```

Returns decrypted transaction data: `sender`, `recipient`, `amount`, `timestamp`.

---

### Batch Operations

Process multiple operations in a single call (max 100 per request).

#### Batch Generate Stealth Keypairs

```
POST /v1/stealth/generate/batch
Content-Type: application/json

{ "count": 10, "label": "Fleet" }
```

Returns per-item results with `summary: { total, succeeded, failed }`.

#### Batch Create Commitments

```
POST /v1/commitment/create/batch
Content-Type: application/json

{
  "items": [
    { "value": "1000000000" },
    { "value": "2000000000" }
  ]
}
```

#### Batch Scan Payments

```
POST /v1/scan/payments/batch
Content-Type: application/json

{
  "keyPairs": [
    { "viewingPrivateKey": "0x...", "spendingPublicKey": "0x...", "label": "Wallet A" },
    { "viewingPrivateKey": "0x...", "spendingPublicKey": "0x...", "label": "Wallet B" }
  ]
}
```

---

### RPC Providers

```
GET /v1/rpc/providers  → Active provider, supported list, configuration guidance
```

Returns: `active` (provider name, cluster, endpoint, connected, latencyMs), `supported` (array of 4 providers with config details), `configuration` (env var names).

Supported providers: `generic` (any Solana RPC), `helius`, `quicknode`, `triton`. Configure via `RPC_PROVIDER` and `RPC_PROVIDER_API_KEY` env vars.

---

### Privacy Score

Analyze any Solana wallet's on-chain privacy posture.

```
POST /v1/privacy/score
Content-Type: application/json

{ "address": "<base58 Solana address>", "limit": 100 }
```

Returns: `score` (0-100), `grade` (A-F), `factors` (addressReuse, amountPatterns, timingCorrelation, counterpartyExposure), and `recommendations` with specific Sipher endpoints to improve privacy.

---

### Confidential SPL Tokens (C-SPL)

Wrap, unwrap, and transfer SPL tokens with encrypted (hidden) amounts using Solana's Confidential Transfer extension.

#### Wrap SPL → Confidential

```
POST /v1/cspl/wrap
Content-Type: application/json

{
  "mint": "<SPL token mint address>",
  "amount": "1000000000",
  "owner": "<base58 Solana address>",
  "createAccount": true
}
```

Returns: `signature`, `csplMint`, `encryptedBalance` (hex), `token` metadata.

#### Unwrap Confidential → SPL

```
POST /v1/cspl/unwrap
Content-Type: application/json

{
  "csplMint": "C-wSOL",
  "encryptedAmount": "0x...",
  "owner": "<base58 Solana address>",
  "proof": "0x..."
}
```

Returns: `signature`, `amount` (decrypted, as string).

#### Confidential Transfer

```
POST /v1/cspl/transfer
Content-Type: application/json

{
  "csplMint": "C-USDC",
  "from": "<base58>",
  "to": "<base58>",
  "encryptedAmount": "0x...",
  "memo": "payment for services"
}
```

Returns: `signature`, `newSenderBalance` (hex), `recipientPendingUpdated`.

Supported tokens: `C-wSOL`, `C-USDC`, `C-USDT`. All C-SPL endpoints support `Idempotency-Key` header.

---

### STARK Range Proofs (Beta)

Prove that a hidden value in a Pedersen commitment meets a threshold — without revealing the value. Uses M31 limb decomposition (Mersenne prime 2^31-1). Currently uses a mock STARK prover; real Murkl WASM integration coming soon.

#### Generate Range Proof

```
POST /v1/proofs/range/generate
Content-Type: application/json

{
  "value": "1000000000",
  "threshold": "500000000",
  "blindingFactor": "0x...",
  "commitment": "0x..."
}
```

**Parameters:**
- `value` — The secret value to prove (not revealed in the proof)
- `threshold` — Minimum value (public, included in proof)
- `blindingFactor` — 32-byte hex blinding factor for commitment
- `commitment` — Optional existing Pedersen commitment. If omitted, auto-created from value + blindingFactor.

Returns: `proof` (type, proof hex, publicInputs), `commitment`, `metadata` (prover, decomposition, limbCount, security).

Supports `Idempotency-Key` header.

#### Verify Range Proof

```
POST /v1/proofs/range/verify
Content-Type: application/json

{
  "type": "range",
  "proof": "0x...",
  "publicInputs": ["0x...", "0x..."]
}
```

Returns: `{ valid: boolean }`

---

### Privacy Backends

List, inspect, and select privacy backends. Each backend implements a different privacy strategy (stealth addresses, FHE, MPC).

#### List All Backends

```
GET /v1/backends
```

Returns: `backends[]` (name, type, chains, enabled, priority, capabilities, health), `total`, `totalEnabled`.

#### Check Backend Health

```
GET /v1/backends/:id/health
```

Probes a specific backend. Returns: `available`, `estimatedCost`, `estimatedTime`, `health` (circuit breaker state), `metrics` (request counts, latency), `capabilities`.

#### Select Preferred Backend

```
POST /v1/backends/select
Content-Type: application/json

{ "backend": "sip-native" }
```

Sets the preferred privacy backend for your API key. Requires a tiered API key (Free/Pro/Enterprise). Returns: `keyId`, `preferredBackend`.

#### Compare Backends

```
POST /v1/backends/compare
Content-Type: application/json

{
  "operation": "stealth_privacy",
  "chain": "solana",
  "prioritize": "cost"
}
```

**Parameters:**
- `operation` — `stealth_privacy`, `encrypted_compute`, or `compliance_audit`
- `chain` — Target blockchain (default: `solana`)
- `amount` — Optional transaction amount in smallest units
- `prioritize` — Optional: `cost`, `speed`, or `privacy` (adjusts scoring weights to 60%)

Returns: `comparisons[]` (backend, type, available, costLamports, costSOL, latencyMs, latencyCategory, privacyLevel, capabilities, score 0-100, recommended), `recommendation` (best_overall, best_value, fastest, most_private, reasoning).

Scoring: cost 40%, latency 30%, privacy 30% (default). Use `prioritize` to shift weights.

---

### Arcium MPC Compute (Beta)

Submit encrypted computations to the Arcium MPC cluster. Status progresses: submitted → encrypting → processing → finalizing → completed.

#### Submit Computation

```
POST /v1/arcium/compute
Content-Type: application/json

{
  "circuitId": "private_transfer",
  "encryptedInputs": ["0xdeadbeef", "0xcafebabe"],
  "chain": "solana",
  "cipher": "aes256"
}
```

**Parameters:**
- `circuitId` — Circuit: `private_transfer` (2 inputs), `check_balance` (1 input), `validate_swap` (3 inputs)
- `encryptedInputs` — Hex-encoded encrypted inputs (1-10)
- `chain` — Target chain (default: `solana`)
- `cipher` — Encryption cipher: `aes128`, `aes192`, `aes256`, `rescue` (default: `aes256`)

Returns: `computationId` (arc_...), `status`, `estimatedCompletion`, `supportedCircuits`.

Supports `Idempotency-Key` header.

#### Poll Status

```
GET /v1/arcium/compute/:id/status
```

Returns: `computationId`, `status`, `progress` (0-100), `output` (only when completed), `proof` (only when completed).

#### Decrypt Result

```
POST /v1/arcium/decrypt
Content-Type: application/json

{
  "computationId": "arc_...",
  "viewingKey": {
    "key": "0x...",
    "path": "m/44/501/0",
    "hash": "0x..."
  }
}
```

Returns: `decryptedOutput`, `verificationHash`, `circuitId`.

---

### Inco FHE Compute (Beta)

Encrypt values, compute on ciphertexts homomorphically, and decrypt results using Fully Homomorphic Encryption. FHE operations complete synchronously (no status polling needed). Tracks noise budget consumption per operation.

#### Encrypt Value

```
POST /v1/inco/encrypt
Content-Type: application/json

{
  "plaintext": 42,
  "scheme": "tfhe",
  "label": "my-value"
}
```

**Parameters:**
- `plaintext` — Value to encrypt (number or string)
- `scheme` — FHE scheme: `fhew` (fast boolean ops) or `tfhe` (general-purpose)
- `label` — Optional label

Returns: `encryptionId` (inc_...), `ciphertext`, `scheme`, `noiseBudget` (100), `supportedSchemes`.

#### Compute on Ciphertexts

```
POST /v1/inco/compute
Content-Type: application/json

{
  "operation": "add",
  "ciphertexts": ["0x...", "0x..."],
  "scheme": "tfhe"
}
```

**Parameters:**
- `operation` — `add` (2 ops, noise: 5), `mul` (2 ops, noise: 15), `not` (1 op, noise: 3), `compare_eq` (2 ops, noise: 8), `compare_lt` (2 ops, noise: 8)
- `ciphertexts` — Hex-encoded ciphertexts (1-3)
- `scheme` — FHE scheme (default: `tfhe`)

Returns: `computationId` (inc_...), `operation`, `resultCiphertext`, `noiseBudgetRemaining`, `status: "completed"`.

Supports `Idempotency-Key` header.

#### Decrypt Result

```
POST /v1/inco/decrypt
Content-Type: application/json

{
  "computationId": "inc_..."
}
```

Returns: `decryptedOutput`, `verificationHash`, `operation`.

---

### Private Swap (Beta)

Privacy-preserving token swap via Jupiter DEX. Orchestrates stealth address generation, optional C-SPL wrapping, and Jupiter swap into a single call. Output routed to a stealth address with Pedersen commitment.

```
POST /v1/swap/private
Content-Type: application/json

{
  "sender": "<base58 Solana address>",
  "inputMint": "So11111111111111111111111111111111111111112",
  "inputAmount": "1000000000",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "slippageBps": 50,
  "recipientMetaAddress": {
    "spendingKey": "0x...",
    "viewingKey": "0x...",
    "chain": "solana"
  }
}
```

**Parameters:**
- `sender` — Solana wallet address paying for the swap
- `inputMint` — SPL token mint to swap from
- `inputAmount` — Amount in smallest units (lamports)
- `outputMint` — SPL token mint to swap to
- `slippageBps` — Slippage tolerance in basis points (default: 50 = 0.5%)
- `recipientMetaAddress` — Optional. If omitted, an ephemeral stealth address is generated.

**Supported tokens:** SOL, USDC, USDT, mSOL, JitoSOL

Returns: privacy artifacts (`outputStealthAddress`, `ephemeralPublicKey`, `viewTag`, `commitment`, `blindingFactor`, `viewingKeyHash`, `sharedSecret`), swap details (`quoteId`, `outputAmount`, `outputAmountMin`, `priceImpactPct`), and `transactions[]` (ordered bundle of wrap + swap txs).

Supports `Idempotency-Key` header.

---

## Idempotency

Mutation endpoints (`/transfer/shield`, `/transfer/claim`, `/transfer/private`, `/commitment/create`, `/viewing-key/disclose`, `/swap/private`) support the `Idempotency-Key` header. Send a UUID v4 value to safely retry requests — duplicate keys return the cached response with `Idempotency-Replayed: true` header.

---

### Compliance (Enterprise Only)

Enterprise-tier endpoints for audit-ready selective disclosure and compliance reporting.

#### Selective Disclosure

```
POST /v1/compliance/disclose
Content-Type: application/json

{
  "viewingKey": { "key": "0x...", "path": "m/44/501/0", "hash": "0x..." },
  "transactionData": { "txHash": "0x...", "amount": "1000000000", "sender": "...", "receiver": "..." },
  "scope": { "type": "time_range", "startTime": 1700000000000, "endTime": 1700100000000 },
  "auditorId": "auditor-001",
  "auditorVerification": { "auditorKeyHash": "0x...", "nonce": "0x..." }
}
```

Returns: `disclosureId` (cmp_ prefix), `scopedViewingKeyHash`, `ciphertext`, `nonce`, `scope`, `auditorVerified`, `disclosedAt`

Scope types: `full`, `time_range`, `counterparty`, `amount_threshold`

#### Generate Audit Report

```
POST /v1/compliance/report
Content-Type: application/json

{
  "viewingKey": { "key": "0x...", "path": "m/44/501/0", "hash": "0x..." },
  "startTime": 1700000000000,
  "endTime": 1700100000000,
  "auditorId": "auditor-001",
  "auditorVerification": { "auditorKeyHash": "0x...", "nonce": "0x..." },
  "includeCounterparties": true
}
```

Returns: `reportId` (rpt_ prefix), `status`, `generatedAt`, `expiresAt` (24h), `summary` (totalTransactions, totalVolume, uniqueCounterparties, encryptedTransactions[]), `encryptedReport`, `reportHash`

#### Retrieve Report

```
GET /v1/compliance/report/:id
```

Returns: cached report data (same shape as generation response). Reports expire after 24 hours.

---

### Agent Sessions (Pro+)

Configure defaults once, apply to all subsequent requests via `X-Session-Id` header.

#### Create Session

```
POST /v1/sessions
Content-Type: application/json

{
  "defaults": {
    "chain": "solana",
    "privacyLevel": "shielded",
    "backend": "sip-native"
  },
  "ttlSeconds": 3600
}
```

**Parameters:**
- `defaults.chain` — Default chain for stealth operations (17 chains supported)
- `defaults.privacyLevel` — `standard`, `shielded`, or `maximum`
- `defaults.rpcProvider` — `helius`, `quicknode`, `triton`, or `generic`
- `defaults.backend` — `sip-native`, `arcium`, or `inco`
- `defaults.defaultViewingKey` — 0x-prefixed hex viewing key
- `ttlSeconds` — Session TTL (min: 60, default: 3600, max: 86400)

Returns: `sessionId` (sess_ + 64 hex), `defaults`, `createdAt`, `expiresAt`

#### Get Session

```
GET /v1/sessions/:id
```

Returns: `sessionId`, `defaults`, `createdAt`, `expiresAt`, `lastAccessedAt`

#### Update Session Defaults

```
PATCH /v1/sessions/:id
Content-Type: application/json

{
  "defaults": { "chain": "ethereum" }
}
```

Merges new defaults — omitted keys stay unchanged. Returns updated session.

#### Delete Session

```
DELETE /v1/sessions/:id
```

Returns: `{ sessionId, deleted: true }`

#### Using Sessions

Add `X-Session-Id` header to any request. Session defaults are merged into the request body — explicit request parameters always override session defaults.

```
POST /v1/stealth/generate
X-Session-Id: sess_abc123...
Content-Type: application/json

{}
```

The above request inherits `chain`, `backend`, etc. from the session.

---

## Agent Workflow Example

```
1. Agent generates stealth meta-address → POST /v1/stealth/generate
2. Counterparty derives stealth address → POST /v1/stealth/derive
3. Counterparty builds shielded transfer → POST /v1/transfer/shield
4. Counterparty signs + submits the returned transaction
5. Agent scans for incoming payments → POST /v1/scan/payments
6. Agent claims funds to real wallet → POST /v1/transfer/claim
7. If audit needed → POST /v1/viewing-key/disclose
8. Auditor decrypts → POST /v1/viewing-key/decrypt
```

---

## Rate Limiting

API keys are tiered with different rate limits:

| Tier | Requests/Hour | Endpoints |
|------|---------------|-----------|
| Free | 100 | Basic (stealth, commitment, viewing-key) |
| Pro | 10,000 | All endpoints including sessions, except compliance |
| Enterprise | 100,000 | All endpoints including compliance |

Rate limit headers are returned on every response:
- `X-RateLimit-Limit`: Requests allowed per hour
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `X-RateLimit-Tier`: Your tier (free/pro/enterprise)

---

## Admin API

Key management endpoints (require `ADMIN_API_KEY`):

```
GET  /v1/admin/keys       → List all API keys (masked)
POST /v1/admin/keys       → Create new key { tier, name, expiresAt? }
GET  /v1/admin/keys/:id   → Get key details + usage stats
DELETE /v1/admin/keys/:id → Revoke a key
GET  /v1/admin/tiers      → List tier limits
```

---

## Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| API | Express 5 + TypeScript | REST endpoints |
| Cache | Redis 7 (optional) | Rate limiting, idempotency |
| Privacy | @sip-protocol/sdk | Stealth, Pedersen, encryption |
| Blockchain | Solana Mainnet | Program `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` |

**Graceful Degradation:** All features work without Redis (falls back to in-memory). Redis enables distributed rate limiting across multiple instances.

---

## Powered By

- [SIP Protocol](https://sip-protocol.org) — The privacy standard for Web3
- [@sip-protocol/sdk](https://www.npmjs.com/package/@sip-protocol/sdk) — Core cryptographic primitives (6,841+ tests)
- Solana Mainnet — Program `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`

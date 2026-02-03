# Sipher — Privacy-as-a-Skill for Solana Agents

> Add stealth addresses, hidden amounts, and compliance viewing keys to any Solana transaction.

**Base URL:** `https://sipher.sip-protocol.org`
**Auth:** `X-API-Key: <your-key>` header (skip for `GET /`, `GET /skill.md`, `GET /v1/health`)

---

## What Sipher Does

Sipher wraps [SIP Protocol](https://sip-protocol.org)'s privacy SDK as a REST API. Any autonomous agent can call these endpoints to:

1. **Generate stealth addresses** — one-time recipient addresses that prevent on-chain linkability
2. **Create shielded transfers** — build unsigned Solana transactions with hidden recipients via stealth addresses and hidden amounts via Pedersen commitments
3. **Scan for payments** — detect incoming shielded payments using viewing keys
4. **Selective disclosure** — encrypt transaction data for auditors/compliance using viewing keys

All privacy operations use:
- **Stealth addresses** (ed25519 DKSAP) — unlinkable one-time addresses
- **Pedersen commitments** — homomorphic commitments hiding amounts
- **Viewing keys** — selective disclosure for compliance without revealing spending power

---

## Endpoints

All responses follow: `{ success: boolean, data?: T, error?: { code, message, details? } }`

### Health

```
GET /v1/health
```

Returns server status and Solana RPC connection health.

---

### Stealth Addresses

#### Generate Meta-Address Keypair

```
POST /v1/stealth/generate
Content-Type: application/json

{ "label": "My Agent Wallet" }
```

Returns: `metaAddress` (spending + viewing public keys), `spendingPrivateKey`, `viewingPrivateKey`

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

---

### Viewing Keys

#### Generate from Spending Key

```
POST /v1/viewing-key/generate
Content-Type: application/json

{ "spendingPrivateKey": "0x..." }
```

Returns: viewing key with `privateKey`, `publicKey`, `hash`, `createdAt`

#### Encrypt for Disclosure

```
POST /v1/viewing-key/disclose
Content-Type: application/json

{
  "viewingKey": {
    "privateKey": "0x...",
    "publicKey": "0x...",
    "hash": "0x...",
    "createdAt": 1706000000000
  },
  "transactionData": {
    "sender": "<address>",
    "recipient": "<stealth address>",
    "amount": "1000000000",
    "mint": "<mint or null>",
    "timestamp": 1706000000000
  }
}
```

Returns encrypted payload (ciphertext, nonce, viewingKeyHash) that only the viewing key holder can decrypt.

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
```

---

## Powered By

- [SIP Protocol](https://sip-protocol.org) — The privacy standard for Web3
- [@sip-protocol/sdk](https://www.npmjs.com/package/@sip-protocol/sdk) — Core cryptographic primitives
- Solana Mainnet — Program `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`

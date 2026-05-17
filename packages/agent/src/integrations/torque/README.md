# Torque MCP Integration

Sipher integrates [Torque](https://torque.so) to drive a per-action rebate growth loop. After every successful private send / swap / claim / drip / batch-send via sipher's agent tools, a custom event is emitted to `ingest.torque.so` which triggers a REBATE Incentive that distributes a small SOL rebate to a fresh stealth address derived from the user's published SNS `SIP-STEALTH` record.

## Setup

```bash
# In ~/Documents/secret/sipher-vps-secrets.env (or .env for local dev)
TORQUE_API_TOKEN=tq_...                          # Project-scoped event-ingest API key from platform.torque.so/developer (one-time view at creation)
TORQUE_INGESTER_URL=https://ingest.torque.so     # Optional — defaults to production ingester; override only for staging/test
TORQUE_GROWTH_ENABLED=true                       # Master kill-switch — set to 'true' to enable post-success event emission
```

> **Note:** The canonical ingest contract has been verified against the live `ingest.torque.so` endpoint. The API key (`TORQUE_API_TOKEN`) is project-scoped — no campaign IDs are needed; the key alone routes events to the correct project and incentive.

When `TORQUE_GROWTH_ENABLED=false` (default) the entire integration is bypassed cleanly — sipher tools work as before, no events are emitted, no admin endpoint queries Torque.

## Dashboard prerequisites

Before enabling the integration, the following must be configured at `platform.torque.so`:

1. **Project created** under the Torque-owning wallet (one-time)
2. **API key generated** from `/developer` — value goes into `TORQUE_API_TOKEN` (one-time view at creation; rotate via dashboard if lost)
3. **5 Custom Events defined** with these exact slugs + field schemas:

| Slug | Fields |
|---|---|
| `sipher_private_send_completed` | `tx_signature` (string), `network` (string), `rebate_destination` (string) |
| `sipher_private_swap_completed` | `tx_signature` (string), `network` (string), `rebate_destination` (string), `amount_lamports` (number), `asset` (string) |
| `sipher_private_claim_completed` | same as send |
| `sipher_private_drip_completed` | same as send |
| `sipher_private_split_send_completed` | same as send |

4. **REBATE Incentive** configured via `CUSTOM_EVENT_PROVIDER` data source bound to those 5 slugs, with sybil/reward/epoch rules set in the Torque dashboard recipe form (NOT in this code — distribution is dashboard-driven)

Emissions to undefined slugs return `400 Event not found for this API key` — the integration logs the reason and skips without failing the sipher tool.

## Test commands

```bash
# Unit tests (always run)
pnpm --filter @sipher/agent test -- integrations/torque

# Admin endpoint tests (always run)
pnpm --filter @sipher/agent test -- routes/admin-torque

# Integration test — opt-in, hits the real Torque ingest API
TORQUE_API_TOKEN=tq_... \
TORQUE_INGESTER_URL=https://ingest.torque.so \
pnpm --filter @sipher/agent test -- torque-emit-roundtrip

# E2E test — opt-in, requires devnet keypair + published SIP-STEALTH on SIP_TEST_DOMAIN
TORQUE_API_TOKEN=tq_... \
TORQUE_INGESTER_URL=https://ingest.torque.so \
SIP_TEST_DOMAIN=therector.sol \
pnpm --filter @sipher/agent test -- torque-rebate-e2e
```

## Admin endpoint

`GET /admin/api/torque/status` returns the current ingester state:

```json
{
  "ok": true,
  "enabled": true,
  "network": "devnet",
  "ingesterUrl": "https://ingest.torque.so",
  "ingesterReachable": true
}
```

When the ingester is unreachable, `ingesterReachable` is `false` and `ingesterReason` is included:

```json
{
  "ok": true,
  "enabled": true,
  "network": "devnet",
  "ingesterUrl": "https://ingest.torque.so",
  "ingesterReachable": false,
  "ingesterReason": "network"
}
```

`ingesterReason` is one of `'auth' | 'network' | 'unknown'`, present only when `ingesterReachable` is `false`.

When `TORQUE_GROWTH_ENABLED=false`:

```json
{
  "ok": true,
  "enabled": false,
  "reason": "TORQUE_GROWTH_ENABLED is false or required env vars missing"
}
```

## Network model

Torque's event ingestion is **network-agnostic** — `ingest.torque.so` accepts events regardless of which Solana cluster the underlying TX was confirmed on. The `network` field inside `data` is sipher-internal record-keeping.

Torque's **pool funding and reward distribution are mainnet-only** — the SOL/USDC pool that backs a REBATE incentive must live on mainnet. Pubkeys are network-portable, so a wallet that fires devnet events still receives mainnet rewards at the same address.

This enables a **hybrid deployment model**: sipher fires devnet events from devnet wallets (no real money during shadow testing), while Torque pays out from a small mainnet pool. The same `cipher-admin` wallet owns both the Torque project and the mainnet pool.

## Privacy posture

This integration has a known, bounded privacy leak: **Torque learns "wallet X used sipher".**

To attribute actions and route rebates, the Torque MCP server needs the user's public Solana wallet. The recipient of the user's private action stays opaque to Torque (we never send recipient addresses or commitment data). Per-event privacy decisions:

| Event | Wallet sent? | Amount sent? | Recipient sent? |
|---|---|---|---|
| `sipher_private_send_completed` | yes | **no** | no |
| `sipher_private_swap_completed` | yes | yes (already public on-chain) | no |
| `sipher_private_claim_completed` | yes | no | no |
| `sipher_private_drip_completed` | yes | no | no |
| `sipher_private_split_send_completed` | yes | no | no |

Users who want zero attribution leakage should set `TORQUE_GROWTH_ENABLED=false`.

## Tool emission coverage

| Tool | Event name | Emits today? | Notes |
|---|---|---|---|
| `send` (chat-driven) | `sipher_private_send_completed` | Yes (since sipher#262) | Fires after SignTxCard callback `/api/tool-signing/:flagId/confirm` |
| `swap` (chat-driven) | `sipher_private_swap_completed` | Yes (since sipher#262) | Same flow as send; includes `amount_lamports` + `asset` |
| `claim` (chat-driven) | `sipher_private_claim_completed` | Yes (Path A) | Uses the CLAIM tx signature (`result.signature`) as the emission key, distinct from the input deposit-tx-signature (`result.depositTxSignature`). |
| `drip`, `splitSend`, `sweep`, `consolidate`, `recurring`, `scheduleSend` | `sipher_private_drip_completed`, `sipher_private_split_send_completed`, etc. | No | Scheduled-op broadcasts not yet wired. Needs wallet-delegation or pre-signed-batch design — separate follow-up. |
| `deposit`, `refund` | — | No | Routed through `DepositView` / `WithdrawView` dedicated UIs, not the chat path. |

## Architecture

```
sipher tool execution → growth-hook → rebate-destination → TorqueMCPClient → ingest.torque.so/events
                                          │
                                          └─→ derives an Ed25519 stealth address from the
                                              user's SNS SIP-STEALTH record
                                              (via @sip-protocol/sns-stealth@0.1.1),
                                              cached 60s per (wallet, domain) to reduce
                                              SNS RPC load — within that window multiple
                                              events from the same wallet rebate to the
                                              same derived address
```

Event payload shape (canonical contract, verified against live endpoint):

```ts
{
  userPubkey: 'C1phr...',       // user's Solana pubkey
  timestamp: 1747068000000,     // ms-epoch
  eventName: 'sipher_private_send_completed',
  data: {
    tx_signature: '3QCo...',
    network: 'devnet',           // sipher-internal; Torque is network-agnostic
    rebate_destination: 'RbT6...', // fresh stealth address derived from SNS SIP-STEALTH record
    // amount_lamports, asset — present only for swap events
  }
}
```

See `docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md` for full design.

## Friction Log

`docs/integrations/torque/FRICTION-LOG.md` — live build journal capturing API surprises, doc gaps, and praise during the 2-week Frontier hackathon shadow build.

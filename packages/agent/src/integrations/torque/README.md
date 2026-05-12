# Torque MCP Integration

Sipher integrates [Torque](https://torque.so) MCP to drive a per-action rebate growth loop. After every successful private send / swap / claim / drip / batch-send via sipher's agent tools, a `custom_event` is emitted to a Torque campaign that distributes a small SOL/USDC rebate to a fresh stealth address derived from the user's published SNS `SIP-STEALTH` record.

## Setup

```bash
# In ~/Documents/secret/sipher-vps-secrets.env (or .env for local dev)
TORQUE_API_KEY=tk_...                                     # From Torque dashboard
TORQUE_MCP_URL=<provided via Torque hackathon Telegram group>   # MCP server endpoint — confirmed by @smicktrq in Frontier TG
TORQUE_CAMPAIGN_ID_DEVNET=camp_dev_xxx                    # Devnet campaign
TORQUE_CAMPAIGN_ID_MAINNET=camp_main_xxx                  # Mainnet campaign (optional until rollout)
TORQUE_GROWTH_ENABLED=true                                # Master kill-switch
```

> **Note:** `TORQUE_MCP_URL` is TBD pending Torque hackathon Telegram group access. The integration test skip-predicate gates this — tests skip cleanly until the URL is known.

When `TORQUE_GROWTH_ENABLED=false` (default) the entire integration is bypassed cleanly — sipher tools work as before, no events are emitted, no admin endpoint queries Torque.

## Test commands

```bash
# Unit tests (always run)
pnpm --filter @sipher/agent test -- integrations/torque

# Admin endpoint tests (always run)
pnpm --filter @sipher/agent test -- routes/admin-torque

# Integration test — opt-in, hits the real Torque devnet API
TORQUE_API_KEY=tk_... \
TORQUE_MCP_URL=https://... \
TORQUE_TEST_CAMPAIGN_ID=$TORQUE_CAMPAIGN_ID_DEVNET \
pnpm --filter @sipher/agent test -- torque-emit-roundtrip

# E2E test — opt-in, requires devnet keypair + published SIP-STEALTH on SIP_TEST_DOMAIN
TORQUE_API_KEY=tk_... \
TORQUE_MCP_URL=https://... \
TORQUE_TEST_CAMPAIGN_ID=$TORQUE_CAMPAIGN_ID_DEVNET \
SIP_TEST_DOMAIN=therector.sol \
pnpm --filter @sipher/agent test -- torque-rebate-e2e
```

## Admin endpoint

`GET /admin/api/torque/status` returns the current campaign state:

```json
{
  "ok": true,
  "enabled": true,
  "network": "devnet",
  "campaignId": "camp_devnet_1",
  "campaignFetchOk": true,
  "campaign": {
    "id": "camp_devnet_1",
    "name": "Sipher Private Action Rebate",
    "status": "ACTIVE",
    "remainingPool": 4.95,
    "rewardAmountPerEvent": 0.005,
    "rewardToken": "SOL"
  }
}
```

When `TORQUE_GROWTH_ENABLED=false`:

```json
{
  "ok": true,
  "enabled": false,
  "reason": "TORQUE_GROWTH_ENABLED is false or required env vars missing"
}
```

## Privacy posture

This integration has a known, bounded privacy leak: **Torque learns "wallet X used sipher".**

To attribute actions and route rebates, the Torque MCP server needs the user's public Solana wallet. The recipient of the user's private action stays opaque to Torque (we never send recipient addresses or commitment data). Per-event privacy decisions:

| Event | Wallet sent? | Amount sent? | Recipient sent? |
|---|---|---|---|
| `private_send_completed` | yes | **no** | no |
| `private_swap_completed` | yes | yes (already public on-chain) | no |
| `private_claim_completed` | yes | no | no |
| `recurring_send_tick` | yes | no | no |
| `batch_send_completed` | yes | no | no |

Users who want zero attribution leakage should set `TORQUE_GROWTH_ENABLED=false`.

## Architecture

```
sipher tool execution → growth-hook → rebate-destination → TorqueMCPClient → Torque MCP server
                                          │
                                          └─→ derives a fresh Ed25519 stealth address
                                              from the user's SNS SIP-STEALTH record
                                              (via @sip-protocol/sns-stealth@0.1.1)
```

See `docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md` for full design.

## Friction Log

`docs/integrations/torque/FRICTION-LOG.md` — live build journal capturing API surprises, doc gaps, and praise during the 2-week Frontier hackathon shadow build.

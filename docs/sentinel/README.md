# SENTINEL — External Surface Reference

SENTINEL is Sipher's LLM-backed security analyst. Think of it as the security department of an office building: it watches every fund-moving action, flags suspicious wallets, can pause execution for human review, and logs every decision for audit. This folder is the integrator-facing reference for SENTINEL's external surface.

## Sub-references

- [REST API](./rest-api.md) — 10 endpoints under `/api/sentinel`
- [Agent Tools](./tools.md) — 14 LLM tools + `assessRisk`
- [Configuration](./config.md) — 15 environment variables
- [Audit Log Schema](./audit-log.md) — SQLite tables + decision record format

## Operating Modes

SENTINEL has three modes selected via `SENTINEL_MODE`:

| Mode | Behavior on flagged action | Use when |
|---|---|---|
| `yolo` | Allow the action; log the decision | Default; trusted operator + own wallet |
| `advisory` | Pause execution; require explicit human override | Production VPS; admin-supervised flows |
| `off` | Skip preflight entirely; log nothing | Local dev; tests that bypass risk checks |

**Default:** `yolo` (parsed in `packages/agent/src/sentinel/config.ts:30-33`).

## Decision Flow

```mermaid
flowchart TD
  A[SIPHER tool call] -->|fund-moving action| B[Preflight Gate]
  B -->|in scope| C[SENTINEL assess]
  B -->|out of scope| Z[Execute]
  C -->|allow| Z
  C -->|flag, mode=yolo| Z
  C -->|flag, mode=advisory| D[Pause + emit sentinel_pause SSE]
  D -->|admin override| Z
  D -->|admin cancel| X[Reject]
  C -->|block| X
  Z --> L[(Log to sentinel_decisions)]
  X --> L
```

## Quickstart

Authenticate and run a one-shot risk assessment:

```bash
# Get a JWT (see /api/auth/nonce + /api/auth/verify for the full ed25519 flow)
JWT="<your-token>"

curl -X POST http://localhost:3000/api/sentinel/assess \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "vault_refund",
    "wallet": "C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N",
    "amount": 1.5
  }'
```

The response is a `RiskReport` (shape defined in `packages/agent/src/sentinel/risk-report.ts`):

```json
{
  "risk": "high",
  "score": 100,
  "reasons": [
    "SENTINEL output failed schema validation"
  ],
  "recommendation": "block",
  "blockers": [
    "schema-violation"
  ],
  "decisionId": "01KQP24PG0KZCJVWJDQM8H3JAY",
  "durationMs": 440
}
```

> [!NOTE]
> The Sipher agent default port is `5006` (see `packages/agent/src/index.ts:270`). The `localhost:3000` URL above matches the e2e/Playwright convention. Override with `PORT=<n>` env var.

## Cross-references

- Internal design: [`docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md`](../superpowers/specs/2026-04-15-sentinel-formalization-design.md)
- Surface docs design: [`docs/superpowers/specs/2026-04-27-sentinel-surface-docs-design.md`](../superpowers/specs/2026-04-27-sentinel-surface-docs-design.md)

---

*Last verified: 2026-04-27*

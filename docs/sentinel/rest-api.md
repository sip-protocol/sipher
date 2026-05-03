# SENTINEL REST API

All endpoints live under `/api/sentinel`. JWT-based auth via `Authorization: Bearer <token>`.

- **Public** routes require `verifyJwt` only.
- **Admin** routes require `verifyJwt + requireOwner` — wallet must appear in `AUTHORIZED_WALLETS` env var.

> [!WARNING]
> Two distinct cancel routes exist on the admin router and look nearly identical by name:
>
> - `POST /api/sentinel/pending/:id/cancel` — cancels a circuit-breaker pending action (SQLite-backed, always returns 200 + `{"success": bool}`)
> - `POST /api/sentinel/cancel/:flagId` — rejects an in-memory promise-gate flag (returns 204 on success, 404 on missing)
>
> They operate on different state stores. A rename is tracked in [follow-up issue #1](https://github.com/sip-protocol/sipher/issues/SET-DURING-PR-OPEN).

---

## Public Endpoints

### POST /api/sentinel/assess

**Auth:** `verifyJwt`

**Description:** Run a one-shot risk assessment for a proposed action. Used by external integrators or internal callers that want a verdict without committing to execution. The SENTINEL assessor (a Pi-SDK LLM agent) evaluates the action context and returns a structured `RiskReport`.

**Request body:**

```json
{
  "action": "string (required)",
  "wallet": "string (required)",
  "recipient": "string (optional)",
  "amount": "number (optional)",
  "token": "string (optional)",
  "metadata": "object (optional)"
}
```

**Response 200** — `RiskReport`:

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
> The captured response above shows the **schema-validation fallback path** — triggered when the LLM's output fails JSON schema validation (or when `OPENROUTER_API_KEY` / `SENTINEL_MODEL` is unconfigured locally). Production agents with a valid model configured return a fully-evaluated `RiskReport` with the LLM's actual `risk` / `score` / `reasons` / `recommendation`. Both paths use the same response shape; the `decisionId` is always a ULID and `durationMs` is always present.

**Response 400:**

```json
{ "error": "action and wallet are required strings" }
```

Returned when `action` or `wallet` is missing or not a string.

**Response 500:**

```json
{ "error": "<error message from assessor>" }
```

Returned when the assessor throws an unexpected error.

**Response 503:**

```json
{ "error": "SENTINEL assessor not configured" }
```

Only returned when no assessor is registered at startup. Production agents always register one via `setSentinelAssessor`, so this path is rarely hit in deployed environments.

**Example:**

```bash
curl -X POST http://localhost:5006/api/sentinel/assess \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "vault_refund",
    "wallet": "C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N",
    "amount": 1.5
  }'
```

---

### GET /api/sentinel/blacklist

**Auth:** `verifyJwt`

**Description:** List blacklisted addresses. Soft-removed entries (where `removed_at` is set) are filtered out by default.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Maximum entries to return |

**Response 200:**

```json
{
  "entries": []
}
```

> [!NOTE]
> The captured response shows an empty array — this is a fresh local DB with no blacklist entries. In production the array contains objects with fields: `id`, `address`, `reason`, `severity`, `added_by`, `added_at`, `expires_at`, `source_event_id`. Schema detail in `docs/sentinel/audit-log.md`.

**Example:**

```bash
curl -H "Authorization: Bearer $JWT" \
  "http://localhost:5006/api/sentinel/blacklist?limit=50"
```

---

### GET /api/sentinel/pending

**Auth:** `verifyJwt`

**Description:** List queued circuit-breaker pending actions (SQLite-backed). Optionally filter by wallet or status.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `wallet` | string | — | Filter by originating wallet address |
| `status` | string | — | Filter by action status (e.g., `pending`, `cancelled`, `approved`) |

**Response 200:**

```json
{
  "actions": []
}
```

> [!NOTE]
> The captured response shows an empty array — fresh local DB. In production the array contains objects with fields: `id`, `tool`, `args`, `wallet`, `status`, `reason`, `created_at`, `resolved_at`. Schema detail in `docs/sentinel/audit-log.md`.

**Example:**

```bash
curl -H "Authorization: Bearer $JWT" \
  "http://localhost:5006/api/sentinel/pending?wallet=C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N&status=pending"
```

---

### GET /api/sentinel/status

**Auth:** `verifyJwt`

**Description:** SENTINEL runtime status snapshot — current mode, preflight scope, configured model, daily LLM cost accrued, and daily budget ceiling.

**Response 200:**

```json
{
  "mode": "advisory",
  "preflightScope": "fund-actions",
  "model": "openrouter:anthropic/claude-sonnet-4.6",
  "dailyBudgetUsd": 10,
  "dailyCostUsd": 0,
  "blockOnError": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `"yolo"` \| `"advisory"` \| `"off"` | Current operating mode |
| `preflightScope` | string | Which tool categories trigger the preflight gate |
| `model` | string | LLM model identifier used for assessments |
| `dailyBudgetUsd` | number | Maximum daily spend allowed for LLM calls |
| `dailyCostUsd` | number | Actual spend accumulated today (UTC) |
| `blockOnError` | boolean | Whether assessment errors cause the action to be blocked |

**Example:**

```bash
curl -H "Authorization: Bearer $JWT" \
  http://localhost:5006/api/sentinel/status
```

---

## Admin Endpoints

Admin routes require both `verifyJwt` AND `requireOwner` middleware. The calling wallet must appear in the `AUTHORIZED_WALLETS` environment variable (comma-separated list).

### POST /api/sentinel/blacklist

**Auth:** `verifyJwt + requireOwner`

**Description:** Insert a new blacklist entry. The `added_by` field is set to `admin:<wallet>` using the verified wallet from the JWT, or `admin` if no wallet is present.

**Request body:**

```json
{
  "address": "string (required)",
  "reason": "string (required)",
  "severity": "string (required)",
  "expiresAt": "string (optional, ISO 8601 timestamp)",
  "sourceEventId": "string (optional)"
}
```

**Response 200:**

```json
{
  "success": true,
  "entryId": "01KQP25BM8RVZJ92CTANFDNTMG"
}
```

`entryId` is a ULID generated by the SQLite insert.

**Response 400:**

```json
{ "error": "address, reason, severity required" }
```

**Example:**

```bash
curl -X POST http://localhost:5006/api/sentinel/blacklist \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "BadActor11111111111111111111111111111111111",
    "reason": "Flagged by SENTINEL risk assessment",
    "severity": "high"
  }'
```

---

### DELETE /api/sentinel/blacklist/:id

**Auth:** `verifyJwt + requireOwner`

**Description:** Soft-remove a blacklist entry. Sets `removed_at`, `removed_by`, and `removed_reason` columns. The row is **not** deleted from SQLite — it is retained for audit purposes and filtered from `GET /blacklist` responses.

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | ULID of the blacklist entry to remove |

**Request body (optional):**

```json
{ "reason": "string (default: 'manual removal')" }
```

**Response 200:**

```json
{
  "success": true
}
```

**Example:**

```bash
curl -X DELETE http://localhost:5006/api/sentinel/blacklist/01KQP25BM8RVZJ92CTANFDNTMG \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "false positive, cleared by review" }'
```

---

### POST /api/sentinel/pending/:id/cancel

**Auth:** `verifyJwt + requireOwner`

**Description:** Cancel a circuit-breaker pending action (SQLite-backed). Calls `cancelCircuitBreakerAction` in `packages/agent/src/sentinel/circuit-breaker.ts`. The `cancelled_by` field is set to `user:<wallet>` from the JWT, or `admin` if unavailable.

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | ULID of the circuit-breaker pending action |

**Request body (optional):**

```json
{ "reason": "string (default: 'manual cancel')" }
```

**Response 200:** Always 200. The `success` boolean signals whether the ID was found and cancelled.

```json
{ "success": false }
```

When the action ID exists and is in a cancellable state, `success` is `true`. When the ID is not found or already settled, `success` is `false` (as shown above — captured against a missing ID in a fresh DB).

> [!NOTE]
> Unlike the promise-gate routes (`/override/:flagId` and `/cancel/:flagId`), this endpoint does **not** return 404 for missing IDs. The `success` boolean carries that signal instead. See [follow-up issue #1](https://github.com/sip-protocol/sipher/issues/SET-DURING-PR-OPEN) for the rename plan.

**Example:**

```bash
curl -X POST http://localhost:5006/api/sentinel/pending/01KQP25BM8RVZJ92CTANFDNTMG/cancel \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{ "reason": "admin override, action no longer needed" }'
```

---

### GET /api/sentinel/decisions

**Auth:** `verifyJwt + requireOwner`

**Description:** List recent SENTINEL decisions — the assessment outcomes recorded each time SENTINEL evaluated an action. Optionally filter by source.

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Maximum decisions to return |
| `source` | string | — | Filter by source label (e.g., `agent`, `scanner`, `assess`) |

**Response 200:**

```json
{
  "decisions": []
}
```

> [!NOTE]
> The captured response shows an empty array — fresh local DB. In production each decision object contains: `id` (ULID), `action`, `wallet`, `risk`, `score`, `recommendation`, `reasons` (JSON array), `source`, `cost_usd`, `duration_ms`, `created_at`. Schema detail in `docs/sentinel/audit-log.md`.

**Example:**

```bash
curl -H "Authorization: Bearer $JWT" \
  "http://localhost:5006/api/sentinel/decisions?limit=20&source=agent"
```

---

### POST /api/sentinel/override/:flagId

**Auth:** `verifyJwt + requireOwner`

**Description:** Resolve a pending in-memory promise-gate flag — the admin approval path when SENTINEL is in `advisory` mode and has paused an action for human review. Calls `resolvePending(flagId)` in `packages/agent/src/sentinel/pending.ts`.

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `flagId` | string | ID of the in-memory pending promise-gate flag |

**Response 204:** No body — flag was found and resolved. The paused agent tool call proceeds.

**Response 404:**

```json
{ "error": { "code": "NOT_FOUND", "message": "flag not found or expired" } }
```

Returned when no in-memory flag exists for the given `flagId`. Flags expire when the waiting agent times out.

**Example:**

```bash
curl -X POST http://localhost:5006/api/sentinel/override/flag_01KQP24PG0KZCJVWJDQM8H3JAY \
  -H "Authorization: Bearer $JWT"
```

---

### POST /api/sentinel/cancel/:flagId

**Auth:** `verifyJwt + requireOwner`

**Description:** Reject a pending in-memory promise-gate flag — the admin denial path when SENTINEL is in `advisory` mode and has paused an action. Calls `rejectPending(flagId, 'cancelled_by_user')` in `packages/agent/src/sentinel/pending.ts`. The paused tool call receives a rejection and the agent aborts the action.

> [!WARNING]
> See the top-of-file warning about dual-cancel route ambiguity. This route operates on **in-memory promise-gate flags**. For cancelling SQLite-backed circuit-breaker actions, use `POST /api/sentinel/pending/:id/cancel`.

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `flagId` | string | ID of the in-memory pending promise-gate flag |

**Response 204:** No body — flag was found and rejected. The paused agent tool call receives a rejection error.

**Response 404:**

```json
{ "error": { "code": "NOT_FOUND", "message": "flag not found or expired" } }
```

Returned when no in-memory flag exists for the given `flagId`.

**Example:**

```bash
curl -X POST http://localhost:5006/api/sentinel/cancel/flag_01KQP24PG0KZCJVWJDQM8H3JAY \
  -H "Authorization: Bearer $JWT"
```

---

*Last verified: 2026-04-27 | Source: `packages/agent/src/routes/sentinel-api.ts`*

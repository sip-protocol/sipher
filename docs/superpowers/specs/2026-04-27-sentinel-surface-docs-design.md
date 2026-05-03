# SENTINEL External-Tool Surface — Documentation Cleanup Design Spec

**Date:** 2026-04-27
**Status:** Approved scope, ready for implementation plan
**Scope:** Phase 3 of the "address all audit findings" multi-phase effort
**Related audits:** Spec-vs-implementation gap audit (2026-04-18); test-infrastructure spec line 266 lists this phase
**Predecessor specs:** `2026-04-15-sentinel-formalization-design.md` (40k-line internal design)

## Summary

Produce a single canonical reference for SENTINEL's external surface — REST API, agent tools, config env vars, audit log schema — so that integrators (external developers, future contributors, auditors) can self-serve in 15 minutes without reading the 40k-line formalization spec or the codebase. Docs land as five Markdown files under `docs/sentinel/`. JSDoc is added inline to public functions so IDE-hover docs match the reference. Zero behavior changes. Single PR.

## Context

The 2026-04-18 test-infrastructure audit listed Phase 3 as "SENTINEL external-tool surface docs cleanup" with no further detail. By 2026-04-27, the surface includes:

- **10 REST endpoints** under `/api/sentinel/*` (4 public `verifyJwt` + 6 admin `verifyJwt + requireOwner`), including a quirk where `POST /pending/:id/cancel` (circuit-breaker, SQLite-backed) and `POST /cancel/:flagId` (promise-gate, in-memory) sit on the same admin router and read identically.
- **14 SENTINEL agent tools** (7 read + 7 action) in `packages/agent/src/sentinel/tools/`, plus the conversational `assessRisk` tool used by SIPHER.
- **15 config env vars** (mode, scanner, threat detection, autonomy, rate limits, LLM tuning) parsed in `packages/agent/src/sentinel/config.ts`.
- **SQLite audit log** spread across `sentinel_blacklist`, `sentinel_risk_history`, `sentinel_pending_actions`, `sentinel_decisions` tables in `packages/agent/src/db.ts`.

These exist and work. The pause/resume flow shipped 2026-04-27 in PR #155. But the surface is documented only across:

- The 40k-line `2026-04-15-sentinel-formalization-design.md` design spec (internal, dense, decision-flow oriented)
- A SENTINEL section in CLAUDE.md (high-level, terse)
- Inline comments in the route file (partial)

There is no integrator-facing reference. With Superteam grant tranches landing, dApp Store reviews ahead, and possible Solana Foundation grant work, an external integrator will eventually ask "how do I call SENTINEL?" — and there is no answer that doesn't require code-spelunking.

## Goals

1. Produce a **single canonical reference** an integrator can read in 15 minutes.
2. Cover all four sub-surfaces: REST API, agent tools, config env vars, audit log schema.
3. Add **JSDoc to public functions** so IDE-hover docs match the reference.
4. Keep production behavior unchanged. Zero route renames, zero env-var renames, zero response-shape changes.
5. Land as **one PR**, doc-only + JSDoc-only diff.

## Non-goals

- API redesign (route renames, error envelope normalization, tool shape unification) — deferred as separate follow-up issues filed during PR open.
- OpenAPI spec — YAGNI for 10 routes with no published SDK yet.
- Mirror to `docs.sip-protocol.org` (Astro Starlight) — separate follow-up issue.
- Documenting *internal* SENTINEL components (scanner, detector, refund-guard, circuit-breaker internals). The reference covers only what an integrator calls.
- HTML doc generation from JSDoc (TypeDoc, Swagger UI) — follow-up if needed.

## Architecture

Five Markdown files under a new `docs/sentinel/` directory, each scoped to one sub-surface, plus JSDoc cross-references inline in source.

```
docs/
├── deployment.md          # existing, untouched
└── sentinel/              # NEW
    ├── README.md          # overview + modes + decision flow primer (~3KB)
    ├── rest-api.md        # 10 endpoints (~6-8KB)
    ├── tools.md           # 14 agent tools + assessRisk (~8-10KB)
    ├── config.md          # 15 env vars (~4-5KB)
    └── audit-log.md       # SQLite schema + decision record format (~3KB)
```

`README.md` (not `docs/sentinel.md`) so GitHub renders the overview when navigating to the folder.

## Per-File Content Outline

### `README.md`

- One-paragraph "what is SENTINEL" using the security-officer analogy (security department = SENTINEL, building = Sipher)
- **Modes table:** `yolo` / `advisory` / `off` — what each does, when to use, default
- **Decision flow** as a Mermaid `flowchart TD`: action requested → preflight gate → LLM assess → mode-dependent action (block / pause / log)
- **Quickstart:** 5-line `curl` example calling `POST /assess`
- Cross-links to the other four files

### `rest-api.md`

For each of the 10 endpoints, the following template:

```
### POST /api/sentinel/assess
**Auth:** verifyJwt
**Description:** Run a one-shot risk assessment for a proposed action.
**Request body:** { action, wallet, recipient?, amount?, token?, metadata? }
**Response 200:** RiskReport { score, decision, reasoning, flags[] }
**Response 400:** { error: "action and wallet are required strings" }
**Response 503:** { error: "SENTINEL assessor not configured" }
**Example:** [verified curl request + response]
**Notes:** RiskReport shape lives in `packages/agent/src/sentinel/risk-report.ts`
```

Grouped: **Public (4)** then **Admin (6)**, with the dual-`/cancel` quirk called out in a `> [!WARNING]` callout that links to follow-up issue #1.

The 10 endpoints, all under `/api/sentinel`:

**Public** (`verifyJwt`):
1. `POST /assess`
2. `GET /blacklist`
3. `GET /pending`
4. `GET /status`

**Admin** (`verifyJwt + requireOwner`):
5. `POST /blacklist`
6. `DELETE /blacklist/:id`
7. `POST /pending/:id/cancel` — circuit-breaker, SQLite-backed
8. `GET /decisions`
9. `POST /override/:flagId` — promise-gate, in-memory
10. `POST /cancel/:flagId` — promise-gate, in-memory

### `tools.md`

For each of the 14 SENTINEL-specific tools + `assessRisk`:

```
### get-vault-balance
**Type:** read | **Used by:** SentinelCore (LLM agent loop)
**One-liner:** Query current vault SOL/SPL balance for risk context.
**Input:** { vaultAddress: string, token?: string }
**Output:** { balance: number, lastUpdated: number }
**Side effects:** RPC call to Solana (cached 30s)
**When fired:** Whenever SENTINEL needs vault liquidity context for a refund/transfer assessment.
```

The 14 SENTINEL tools, grouped:

**Read (7):**
- `check-reputation`
- `get-deposit-status`
- `get-on-chain-signatures`
- `get-pending-claims`
- `get-recent-activity`
- `get-risk-history`
- `get-vault-balance`

**Action (7):**
- `add-to-blacklist`
- `alert-user`
- `cancel-pending`
- `execute-refund`
- `remove-from-blacklist`
- `schedule-cancellable`
- `veto-sipher-action`

Plus a separate section for `assessRisk` (used in conversational SIPHER agent flows, not the SentinelCore loop).

### `config.md`

Single table grouped by category:

| Var | Type | Default | Valid values | What it tunes |
|---|---|---|---|---|
| `SENTINEL_MODE` | enum | `yolo` | `yolo` \| `advisory` \| `off` | Whether SENTINEL blocks, pauses, or logs |
| `SENTINEL_PREFLIGHT_SCOPE` | enum | `fund-actions` | `fund-actions` \| `critical-only` \| `never` | Which tools trigger pre-execution check |
| ... |

Categories (15 vars total):

- **Mode (3):** `SENTINEL_MODE`, `SENTINEL_PREFLIGHT_SCOPE`, `SENTINEL_PREFLIGHT_SKIP_AMOUNT`
- **Scanner (3):** `SENTINEL_SCAN_INTERVAL`, `SENTINEL_ACTIVE_SCAN_INTERVAL`, `SENTINEL_AUTO_REFUND_THRESHOLD`
- **Threat detection (2):** `SENTINEL_THREAT_CHECK`, `SENTINEL_LARGE_TRANSFER_THRESHOLD`
- **Autonomy (2):** `SENTINEL_BLACKLIST_AUTONOMY`, `SENTINEL_CANCEL_WINDOW_MS`
- **Rate limits (2):** `SENTINEL_RATE_LIMIT_FUND_PER_HOUR`, `SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR`
- **LLM (3):** `SENTINEL_MODEL`, `SENTINEL_DAILY_BUDGET_USD`, `SENTINEL_BLOCK_ON_ERROR`

### `audit-log.md`

- One-paragraph overview: every SENTINEL decision is logged. Read via `GET /api/sentinel/decisions`.
- `CREATE TABLE` statements **copied verbatim** from `packages/agent/src/db.ts` for: `sentinel_blacklist`, `sentinel_risk_history`, `sentinel_pending_actions`, `sentinel_decisions`
- Sample row per table from a real local devnet run
- Retention note: verify behavior in `db.ts` during plan execution; document whatever is true (auto-cleanup vs manual)

## JSDoc Strategy

### Targets

| File | Targets | What the JSDoc says |
|---|---|---|
| `packages/agent/src/routes/sentinel-api.ts` | 10 route handlers | One-liner, `@auth`, `@body`/`@query`, `@returns`, `@see docs/sentinel/rest-api.md#anchor` |
| `packages/agent/src/sentinel/config.ts` | `SentinelConfig` interface (per-property) + `getSentinelConfig` | Type, default, env var, what it tunes |
| `packages/agent/src/sentinel/tools/*.ts` | 14 tool exported definitions | One-liner, when fired, `@see docs/sentinel/tools.md#anchor` |
| `packages/agent/src/sentinel/pending.ts` | Exported `resolvePending`, `rejectPending`, `createPending` | Behavior + REST route mapping |

### Out of scope for JSDoc

- Internal services (scanner, detector, refund-guard, circuit-breaker, risk-report internals)
- `db.ts` SQLite helpers
- Tool *implementations* (only the exported tool definitions; helpers within each tool file stay un-JSDoc'd)

### Style

- No semicolons (matches codebase)
- Concise — most JSDocs 3-5 lines
- `@see` to MD anchor: `@see docs/sentinel/rest-api.md#post-apisentinelassess`
- No `@param` boilerplate when the TS type already says it; only when meaning isn't obvious from the name
- One-line file header pointer: `// Reference: docs/sentinel/<file>.md`

### Example

```ts
/**
 * One-shot risk assessment for a proposed action.
 * @auth verifyJwt
 * @body { action, wallet, recipient?, amount?, token?, metadata? }
 * @returns 200 RiskReport | 400 { error } | 503 { error }
 * @see docs/sentinel/rest-api.md#post-apisentinelassess
 */
sentinelPublicRouter.post('/assess', async (req, res) => { ... })
```

### Verification

- `pnpm typecheck` ensures JSDoc doesn't introduce TS errors
- Manual cross-check task in plan: every endpoint in `rest-api.md` has matching JSDoc on its handler, and vice versa
- No new tooling (no TypeDoc, no ESLint require-jsdoc rule)

## Examples & Conventions

### Sample data

Every example uses **real, runnable values** — not placeholders.

| Element | Source |
|---|---|
| Wallet address | `C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N` (cipher-admin, public, in test fixtures) |
| Recipient address | `So11111111111111111111111111111111111111112` (well-known SOL system program) |
| Token mint | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC mint) |
| Amount | `1.5` (SOL) |
| Signatures / decision IDs / flag IDs | Captured from a local devnet run during spec implementation, never fabricated |

### Curl example shape

```bash
# Request
curl -X POST http://localhost:3000/api/sentinel/assess \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "vault_refund",
    "wallet": "C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N",
    "amount": 1.5
  }'

# Response 200
{
  "score": 0.12,
  "decision": "allow",
  "reasoning": "Action is within autonomy thresholds...",
  "flags": []
}
```

### Diagrams

Mermaid (GitHub-native rendering), not ASCII. Decision flow uses `flowchart TD`; mode comparison uses a table.

### Callouts

GitHub admonition syntax:

```md
> [!WARNING]
> `POST /api/sentinel/cancel/:flagId` and `POST /api/sentinel/pending/:id/cancel`
> are **two distinct routes** — see [follow-up issue #XXX](url) for the rename plan.

> [!NOTE]
> `RiskReport` shape lives in `packages/agent/src/sentinel/risk-report.ts`.
```

### Cross-link conventions

- Within `docs/sentinel/`: relative links — `[REST API](./rest-api.md#post-apisentinelassess)`
- To source: file path + line — `packages/agent/src/sentinel/config.ts:40`
- To repo root: relative from doc location

### Anti-doc-rot

1. **Verify before specifying** — every claim verified against source the day it's written; no paraphrasing
2. `Last verified: YYYY-MM-DD` footer on each MD
3. `CREATE TABLE` statements copied verbatim from `db.ts`
4. Plan includes a "verify all curl examples run against local agent" step before PR open

## Success Criteria

- [ ] `docs/sentinel/{README,rest-api,tools,config,audit-log}.md` all exist
- [ ] All 10 REST endpoints documented with verified curl examples
- [ ] All 14 SENTINEL tools + `assessRisk` documented with input/output/when-fired
- [ ] All 15 env vars documented with defaults cross-checked against `config.ts`
- [ ] `CREATE TABLE` statements verbatim in `audit-log.md`
- [ ] JSDoc added to: 10 route handlers, 14 tool exports, `SentinelConfig` interface, `getSentinelConfig`, `pending.ts` exports
- [ ] Every JSDoc has `@see docs/sentinel/...` cross-link
- [ ] `pnpm typecheck` passes (workspace + agent)
- [ ] `pnpm --filter @sipher/agent test -- --run` still 938 green
- [ ] `pnpm --filter @sipher/app test -- --run` still 45 green
- [ ] All curl examples run successfully against local dev agent
- [ ] Cross-check: each route has matching JSDoc, each tool has matching JSDoc, vice versa
- [ ] `Last verified: YYYY-MM-DD` footer on each MD
- [ ] PR diff is doc-only + JSDoc-only (no behavior code touched)

## Follow-ups

Filed as GitHub issues during PR open:

| # | Title | Priority | Type |
|---|---|---|---|
| 1 | SENTINEL: dual-cancel route rename (`/cancel/:flagId` + `/pending/:id/cancel`) | Medium | API design |
| 2 | SENTINEL: error envelope normalization (`{error: string}` vs `{error: {code,message}}`) | Medium | API design |
| 3 | Mirror SENTINEL docs to `docs-sip` (Astro Starlight, public docs site) | Low | Cross-repo |

Mentioned in spec under "Future surface work" but not filed (no concrete trigger):

| # | Title |
|---|---|
| 4 | SENTINEL: tool input/output shape unification audit |
| 5 | TypeDoc HTML doc generation from JSDoc |
| 6 | OpenAPI spec for `/api/sentinel/*` (when first SDK consumer ships) |

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Doc rot when surface changes | `Last verified` footer + cross-check task on every PR touching `routes/sentinel-api.ts`, `sentinel/tools/`, or `sentinel/config.ts` |
| JSDoc drifts from MD | Same cross-check task |
| Misread quirks during writing (wrong default, wrong response shape) | Spec mandates source-verified data; no paraphrasing |
| Production frontend (`app/src/api/sentinel.ts` etc.) calls something the docs miss | Plan includes "grep for `/api/sentinel/` callsites" task before PR open |
| PR is bigger than expected (~30-40KB MD + ~50 JSDoc blocks) | Doc-only diff is trivially revertible. Acceptable. |

## Rollback

Pure docs + JSDoc PR. Single revert reverts cleanly. No DB migrations, no env changes, no route changes.

## Out of Scope (deferred to other phases)

- Phase 4: REST service tests (chain-transfer-builder, transaction-builder, private-swap-builder)
- Phase 5: Tool unit test backfills (29 agent tools across the codebase)
- Phase 6: Chrome MCP QA against live VPS
- API redesign (covered by follow-up issues 1, 2 — filed during PR; and 4 — noted in spec)
- Public docs site mirror (covered by follow-up issue 3 — filed during PR)
- HTML doc generation tooling (covered by follow-up issue 5 — noted in spec)
- OpenAPI spec (covered by follow-up issue 6 — noted in spec)

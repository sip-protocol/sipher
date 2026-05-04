# SENTINEL REST Error Envelope Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize SENTINEL REST error responses on `{error: {code, message}}` via a typed helper, plus a behavior change to `POST /pending/:id/cancel` (404 + NOT_FOUND when missing) and a frontend upgrade so SentinelConfirm.tsx surfaces the envelope message.

**Architecture:** New file `packages/agent/src/routes/sentinel-errors.ts` exports a `SentinelErrorCode` union and `sendSentinelError(res, code, message)` helper that centralizes the status-code-to-error-code mapping. Five-code taxonomy: `VALIDATION_FAILED | NOT_FOUND | FORBIDDEN | UNAVAILABLE | INTERNAL`. Clean cut migration — no compatibility layer. Eight focused commits.

**Tech Stack:** Express 5, TypeScript, Vitest, supertest, React 19 + Testing Library

**Spec:** `docs/superpowers/specs/2026-05-04-sentinel-error-envelope-design.md`

---

## File Structure

```
packages/agent/src/routes/
├── sentinel-errors.ts          # NEW (Task 1) — SentinelErrorCode union + sendSentinelError helper
└── sentinel-api.ts             # MODIFY (Tasks 2-5) — 7 error sites + 5 JSDoc updates

packages/agent/tests/sentinel/
├── sentinel-errors.test.ts     # NEW (Task 1) — 6 unit tests
└── sentinel-api.test.ts        # MODIFY (Tasks 2-4) — modify 1 test + add 4 tests

app/src/components/
├── SentinelConfirm.tsx         # MODIFY (Task 6) — parse error envelope on failure
└── __tests__/
    └── SentinelConfirm.test.tsx # MODIFY (Task 6) — refactor 1 test + add 1 test

docs/sentinel/
└── rest-api.md                 # MODIFY (Task 7) — add envelope section, update examples

CLAUDE.md                       # MODIFY (Task 8) — bump test counts
```

**Per-task commits.** Each task ends with a single commit. Eight commits total.

**Branch:** `fix/sentinel-error-envelope` (already created from main).

---

## Task 1: Helper file + unit tests (TDD)

**Files:**
- Create: `packages/agent/src/routes/sentinel-errors.ts`
- Create: `packages/agent/tests/sentinel/sentinel-errors.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/agent/tests/sentinel/sentinel-errors.test.ts`:

```ts
// packages/agent/tests/sentinel/sentinel-errors.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import { sendSentinelError } from '../../src/routes/sentinel-errors.js'

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response
}

function jsonCall(res: Response): unknown {
  return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]
}

describe('sendSentinelError', () => {
  it('VALIDATION_FAILED maps to status 400', () => {
    const res = mockResponse()
    sendSentinelError(res, 'VALIDATION_FAILED', 'bad input')
    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message: 'bad input' },
    })
  })

  it('NOT_FOUND maps to status 404', () => {
    const res = mockResponse()
    sendSentinelError(res, 'NOT_FOUND', 'missing')
    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'NOT_FOUND', message: 'missing' },
    })
  })

  it('FORBIDDEN maps to status 403', () => {
    const res = mockResponse()
    sendSentinelError(res, 'FORBIDDEN', 'denied')
    expect(res.status).toHaveBeenCalledWith(403)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'FORBIDDEN', message: 'denied' },
    })
  })

  it('UNAVAILABLE maps to status 503', () => {
    const res = mockResponse()
    sendSentinelError(res, 'UNAVAILABLE', 'not configured')
    expect(res.status).toHaveBeenCalledWith(503)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'UNAVAILABLE', message: 'not configured' },
    })
  })

  it('INTERNAL maps to status 500', () => {
    const res = mockResponse()
    sendSentinelError(res, 'INTERNAL', 'crash')
    expect(res.status).toHaveBeenCalledWith(500)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'INTERNAL', message: 'crash' },
    })
  })

  it('preserves message verbatim including special characters and newlines', () => {
    const res = mockResponse()
    const message = 'Error: "value" failed validation\nat line 42'
    sendSentinelError(res, 'VALIDATION_FAILED', message)
    expect(jsonCall(res)).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-errors.test.ts -- --run`
Expected: FAIL with module-not-found error (`Cannot find module '../../src/routes/sentinel-errors.js'`)

- [ ] **Step 3: Create the helper file**

Create `packages/agent/src/routes/sentinel-errors.ts`:

```ts
// packages/agent/src/routes/sentinel-errors.ts
// Reference: docs/sentinel/rest-api.md#error-envelope

import type { Response } from 'express'

export type SentinelErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAVAILABLE'
  | 'INTERNAL'

const STATUS: Record<SentinelErrorCode, number> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAVAILABLE: 503,
  INTERNAL: 500,
}

/**
 * Send a SENTINEL error envelope: { error: { code, message } }.
 * Status code derived from the SENTINEL code per the design doc.
 * @see docs/sentinel/rest-api.md#error-envelope
 */
export function sendSentinelError(
  res: Response,
  code: SentinelErrorCode,
  message: string,
): void {
  res.status(STATUS[code]).json({ error: { code, message } })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-errors.test.ts -- --run`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: clean (no errors)

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/sentinel-errors.ts packages/agent/tests/sentinel/sentinel-errors.test.ts
git commit -m "feat(sentinel): add sendSentinelError helper with 5-code taxonomy"
```

---

## Task 2: Migrate `POST /assess` (3 error paths) — TDD

**Files:**
- Modify: `packages/agent/tests/sentinel/sentinel-api.test.ts` (existing test on lines 45-49 + add 2 new tests)
- Modify: `packages/agent/src/routes/sentinel-api.ts` (lines 26, 31, 38 + JSDoc lines 16-22)

- [ ] **Step 1: Update existing 400 test + add 503 and 500 tests (failing)**

In `packages/agent/tests/sentinel/sentinel-api.test.ts`, **replace** the existing 400 test (lines 45-49):

```ts
  it('POST /assess returns 400 + VALIDATION_FAILED envelope on missing required fields', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/assess').send({})
    expect(res.status).toBe(400)
    expect(res.body).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message: 'action and wallet are required strings' },
    })
  })
```

Add **two new tests** immediately after (before the next `it` block):

```ts
  it('POST /assess returns 503 + UNAVAILABLE when assessor is not configured', async () => {
    await freshDb()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(null)
    const { sentinelPublicRouter } = await import('../../src/routes/sentinel-api.js')
    const app = express()
    app.use(express.json())
    app.use('/api/sentinel', sentinelPublicRouter)
    const res = await request(app).post('/api/sentinel/assess').send({
      action: 'send', wallet: 'w1',
    })
    expect(res.status).toBe(503)
    expect(res.body).toStrictEqual({
      error: { code: 'UNAVAILABLE', message: 'SENTINEL assessor not configured' },
    })
  })

  it('POST /assess returns 500 + INTERNAL envelope when assessor throws', async () => {
    const assess = vi.fn().mockRejectedValue(new Error('boom'))
    const app = await buildApp(assess as never)
    const res = await request(app).post('/api/sentinel/assess').send({
      action: 'send', wallet: 'w1',
    })
    expect(res.status).toBe(500)
    expect(res.body).toStrictEqual({
      error: { code: 'INTERNAL', message: 'boom' },
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run`
Expected: 3 failures — all three new/modified tests fail body assertions (status assertions still pass; body still has `{error: 'string'}` shape)

- [ ] **Step 3: Migrate the `POST /assess` handler**

In `packages/agent/src/routes/sentinel-api.ts`, **add the import** at the top of the file (after the existing imports, before line 11):

```ts
import { sendSentinelError } from './sentinel-errors.js'
```

**Replace lines 23-40** (the entire `POST /assess` handler) with:

```ts
/**
 * One-shot risk assessment for a proposed action.
 * @auth verifyJwt
 * @body { action, wallet, recipient?, amount?, token?, metadata? }
 * @returns 200 RiskReport | 400 ErrorEnvelope | 500 ErrorEnvelope | 503 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelassess
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelPublicRouter.post('/assess', async (req: Request, res: Response) => {
  const { action, wallet, recipient, amount, token, metadata } = req.body ?? {}
  if (typeof action !== 'string' || typeof wallet !== 'string') {
    sendSentinelError(res, 'VALIDATION_FAILED', 'action and wallet are required strings')
    return
  }
  const assessor = getSentinelAssessor()
  if (!assessor) {
    sendSentinelError(res, 'UNAVAILABLE', 'SENTINEL assessor not configured')
    return
  }
  try {
    const report = await assessor({ action, wallet, recipient, amount, token, metadata })
    res.json(report)
  } catch (e) {
    sendSentinelError(res, 'INTERNAL', e instanceof Error ? e.message : 'assess failed')
  }
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run`
Expected: PASS — all 3 modified/new tests green; existing happy-path test (`POST /assess returns a RiskReport from the assessor`) still passes

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts packages/agent/tests/sentinel/sentinel-api.test.ts
git commit -m "fix(sentinel): migrate POST /assess to error envelope (#158)"
```

---

## Task 3: Migrate `POST /blacklist` 400 — TDD

**Files:**
- Modify: `packages/agent/tests/sentinel/sentinel-api.test.ts` (add 1 new test)
- Modify: `packages/agent/src/routes/sentinel-api.ts` (line 98 + JSDoc lines 88-94)

- [ ] **Step 1: Add the failing test**

In `packages/agent/tests/sentinel/sentinel-api.test.ts`, immediately after the existing `POST /blacklist adds an entry` test (lines 60-69), add:

```ts
  it('POST /blacklist returns 400 + VALIDATION_FAILED envelope on missing fields', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/blacklist').send({ address: 'only-address' })
    expect(res.status).toBe(400)
    expect(res.body).toStrictEqual({
      error: { code: 'VALIDATION_FAILED', message: 'address, reason, severity required' },
    })
  })
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run`
Expected: 1 failure — body assertion fails because handler still emits string error

- [ ] **Step 3: Migrate the `POST /blacklist` handler**

In `packages/agent/src/routes/sentinel-api.ts`, **replace the JSDoc + handler** (lines 88-108) with:

```ts
/**
 * Add an address to the blacklist.
 * @auth verifyJwt + requireOwner
 * @body { address, reason, severity, expiresAt?, sourceEventId? }
 * @returns 200 { success: true, entryId } | 400 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelblacklist
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/blacklist', (req: Request, res: Response) => {
  const { address, reason, severity, expiresAt, sourceEventId } = req.body ?? {}
  if (!address || !reason || !severity) {
    sendSentinelError(res, 'VALIDATION_FAILED', 'address, reason, severity required')
    return
  }
  const wallet = (req as unknown as Record<string, unknown>).wallet as string | undefined
  const id = insertBlacklist({
    address, reason, severity,
    addedBy: wallet ? `admin:${wallet}` : 'admin',
    expiresAt, sourceEventId,
  })
  res.json({ success: true, entryId: id })
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run`
Expected: PASS — new test green; happy-path `POST /blacklist adds an entry` still passes

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts packages/agent/tests/sentinel/sentinel-api.test.ts
git commit -m "fix(sentinel): migrate POST /blacklist to error envelope (#158)"
```

---

## Task 4: Migrate `POST /pending/:id/cancel` (BEHAVIOR CHANGE) — TDD

**Files:**
- Modify: `packages/agent/tests/sentinel/sentinel-api.test.ts` (add 1 new test for the 404 behavior)
- Modify: `packages/agent/src/routes/sentinel-api.ts` (lines 137-145 + JSDoc lines 128-136)

- [ ] **Step 1: Add the failing test for the new 404 behavior**

In `packages/agent/tests/sentinel/sentinel-api.test.ts`, immediately after the existing `POST /pending/:id/cancel cancels an action` test (lines 89-101), add:

```ts
  it('POST /pending/:id/cancel returns 404 + NOT_FOUND when ID does not exist', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/pending/does-not-exist/cancel').send({
      reason: 'attempted cancel',
    })
    expect(res.status).toBe(404)
    expect(res.body).toStrictEqual({
      error: { code: 'NOT_FOUND', message: 'pending action not found or already resolved' },
    })
  })
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run`
Expected: 1 failure — current handler returns 200 with `{success: false}`, not 404

- [ ] **Step 3: Migrate the `POST /pending/:id/cancel` handler**

In `packages/agent/src/routes/sentinel-api.ts`, **replace the JSDoc + handler** (lines 128-145) with:

```ts
/**
 * Circuit-breaker cancel — mark a pending action cancelled in SQLite.
 * Circuit-breaker cancel — distinct from the promise-gate `/cancel/:flagId`.
 * @auth verifyJwt + requireOwner
 * @param id pending action id
 * @body { reason? string }
 * @returns 200 { success: true } | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelpendingidcancel
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/pending/:id/cancel', (req: Request, res: Response) => {
  const reason = (req.body?.reason as string) ?? 'manual cancel'
  const w = (req as unknown as Record<string, unknown>).wallet
  const wallet = (typeof w === 'string' ? w : undefined)
  const by = typeof wallet === 'string' ? `user:${wallet}` : 'admin'
  const id = (typeof req.params.id === 'string' ? req.params.id : String(req.params.id))
  const ok = cancelCircuitBreakerAction(id, by, reason)
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'pending action not found or already resolved')
    return
  }
  res.json({ success: true })
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run`
Expected: PASS — both new test (404 path) and existing happy-path test (success → 200 + `{success: true}`) green

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts packages/agent/tests/sentinel/sentinel-api.test.ts
git commit -m "fix(sentinel): POST /pending/:id/cancel returns 404 + NOT_FOUND on missing (#158)"
```

---

## Task 5: Refactor promise-gate routes to helper (no new tests)

These two routes already emit `{error: {code, message}}` — refactoring them to use the helper produces identical wire output. The existing `pause-resume-routes.test.ts` asserts `res.body.error.code === 'NOT_FOUND'` (line 89) and is the regression guard.

**Files:**
- Modify: `packages/agent/src/routes/sentinel-api.ts` (lines 172-198 + JSDoc lines 164-188)

- [ ] **Step 1: Refactor both handlers to the helper**

In `packages/agent/src/routes/sentinel-api.ts`, **replace the JSDoc + both handlers** (lines 164-198) with:

```ts
/**
 * Promise-gate resolve — approve a paused advisory-mode action.
 * Promise-gate resolve — see also `/cancel/:flagId` reject.
 * @auth verifyJwt + requireOwner
 * @param flagId in-memory promise flag id
 * @returns 204 | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentineloverrideflagid
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/override/:flagId', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = resolvePending(flagId)
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')
    return
  }
  res.status(204).send()
})

/**
 * Promise-gate reject — deny a paused advisory-mode action.
 * Promise-gate reject — distinct from the circuit-breaker `/pending/:id/cancel`.
 * @auth verifyJwt + requireOwner
 * @param flagId in-memory promise flag id
 * @returns 204 | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelcancelflagid
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/cancel/:flagId', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = rejectPending(flagId, 'cancelled_by_user')
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')
    return
  }
  res.status(204).send()
})
```

- [ ] **Step 2: Run all SENTINEL tests to confirm zero regressions**

Run: `pnpm --filter @sipher/agent test packages/agent/tests/sentinel -- --run`
Expected: PASS — all SENTINEL test files green, including `pause-resume-routes.test.ts` (which asserts `res.body.error.code === 'NOT_FOUND'`)

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts
git commit -m "refactor(sentinel): route promise-gate 404s through sendSentinelError (#158)"
```

---

## Task 6: Frontend `SentinelConfirm.tsx` envelope parsing — TDD

**Files:**
- Modify: `app/src/components/__tests__/SentinelConfirm.test.tsx` (modify existing test on lines 87-103, add 1 new fallback test)
- Modify: `app/src/components/SentinelConfirm.tsx` (lines 24-41)

- [ ] **Step 1: Modify existing test + add fallback test (failing)**

In `app/src/components/__tests__/SentinelConfirm.test.tsx`, **replace the existing test** on lines 87-103:

```tsx
  it('displays envelope error message when fetch returns non-ok with envelope body', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('{"error":{"code":"NOT_FOUND","message":"flag not found or expired"}}', { status: 404 })
    ) as typeof fetch
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /override & send/i }))
    expect(onResolved).not.toHaveBeenCalled()
    expect(await screen.findByText('flag not found or expired')).toBeInTheDocument()
  })

  it('falls back to status display when response body is not envelope-shaped', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('<html>500</html>', { status: 500 })
    ) as typeof fetch
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /override & send/i }))
    expect(onResolved).not.toHaveBeenCalled()
    expect(await screen.findByText(/Action failed \(500\)/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sipher/app test src/components/__tests__/SentinelConfirm.test.tsx -- --run`
Expected: 2 failures — both new/modified tests fail because component still shows generic `Action failed (404)` for envelope case

- [ ] **Step 3: Update the component to parse the envelope**

In `app/src/components/SentinelConfirm.tsx`, **replace the `dispatch` function** (lines 20-41) with:

```tsx
  const dispatch = async (kind: 'override' | 'cancel') => {
    if (busy) return
    setBusy(true)
    setError(null)
    let success = false
    try {
      const res = await fetch(`${API_URL}/api/sentinel/${kind}/${encodeURIComponent(flagId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        let message = `Action failed (${res.status})`
        try {
          const body = await res.json()
          if (body?.error?.message) message = String(body.error.message)
        } catch { /* fall back to status */ }
        setError(message)
        return
      }
      success = true
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
    if (success) onResolved(kind)
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sipher/app test src/components/__tests__/SentinelConfirm.test.tsx -- --run`
Expected: PASS — both new tests green; the 4 unchanged tests (rendering, override POST, cancel POST, double-dispatch prevention) still pass

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: clean

- [ ] **Step 6: Commit**

```bash
git add app/src/components/SentinelConfirm.tsx app/src/components/__tests__/SentinelConfirm.test.tsx
git commit -m "feat(app): SentinelConfirm parses error envelope message (#158)"
```

---

## Task 7: Update `docs/sentinel/rest-api.md`

No tests for this task — documentation only.

**Files:**
- Modify: `docs/sentinel/rest-api.md`

- [ ] **Step 1: Add top-level "Error Envelope" section**

In `docs/sentinel/rest-api.md`, **insert** the following section between the auth intro line `> They operate on different state stores. A rename is tracked in [follow-up issue #1](https://github.com/sip-protocol/sipher/issues/157).` and the `---` separator on line 16:

```markdown

## Error Envelope

All SENTINEL routes that emit errors return a structured envelope:

```json
{ "error": { "code": "<CODE>", "message": "<human-readable>" } }
```

| Code | HTTP status | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Required fields missing or malformed |
| `NOT_FOUND` | 404 | Resource ID does not exist |
| `FORBIDDEN` | 403 | Reserved (auth middleware emits its own legacy shape today) |
| `UNAVAILABLE` | 503 | Server up but a dependency is unconfigured |
| `INTERNAL` | 500 | Unexpected server-side failure |

**Note on auth errors:** 401/403 responses from `verifyJwt` and `requireOwner` middleware still use the legacy `{error: "string"}` shape. Normalizing those is tracked separately as a future API-wide cleanup.

```

(The leading and trailing blank lines preserve markdown spacing around the existing surrounding content.)

- [ ] **Step 2: Update `POST /assess` Response 400 / 500 / 503 examples**

In the `POST /api/sentinel/assess` section, **replace** the three response examples (lines ~60-82):

```markdown
**Response 400:**

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "action and wallet are required strings" } }
```

Returned when `action` or `wallet` is missing or not a string.

**Response 500:**

```json
{ "error": { "code": "INTERNAL", "message": "<error message from assessor>" } }
```

Returned when the assessor throws an unexpected error.

**Response 503:**

```json
{ "error": { "code": "UNAVAILABLE", "message": "SENTINEL assessor not configured" } }
```

Only returned when no assessor is registered at startup. Production agents always register one via `setSentinelAssessor`, so this path is rarely hit in deployed environments.
```

- [ ] **Step 3: Update `POST /blacklist` Response 400 example**

In the `POST /api/sentinel/blacklist` section, **replace** the Response 400 example (lines ~234-238):

```markdown
**Response 400:**

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "address, reason, severity required" } }
```
```

- [ ] **Step 4: Rewrite `POST /pending/:id/cancel` Response section**

In the `POST /api/sentinel/pending/:id/cancel` section, **replace** the entire Response 200 block (lines ~310-319) with:

```markdown
**Response 200:**

```json
{ "success": true }
```

Returned when the action ID exists and was cancelled.

**Response 404:**

```json
{ "error": { "code": "NOT_FOUND", "message": "pending action not found or already resolved" } }
```

Returned when the action ID does not exist or is already settled. (Behavior changed in this PR — previously this path returned `200 + {success: false}`.)
```

**Also remove** the stale `> [!NOTE]` callout immediately following (the note that begins "Unlike the promise-gate routes (`/override/:flagId` and `/cancel/:flagId`), this endpoint does **not** return 404 for missing IDs."). It is no longer accurate.

- [ ] **Step 5: Update `Last verified:` footer**

At the bottom of `docs/sentinel/rest-api.md`, replace:

```
*Last verified: 2026-04-27 | Source: `packages/agent/src/routes/sentinel-api.ts`*
```

With:

```
*Last verified: 2026-05-04 | Source: `packages/agent/src/routes/sentinel-api.ts`*
```

- [ ] **Step 6: Verify the markdown renders without breakage**

Run: `git diff docs/sentinel/rest-api.md | head -150`
Expected: Visual confirmation that envelope examples replaced string examples; envelope section added; stale note removed; footer updated.

- [ ] **Step 7: Commit**

```bash
git add docs/sentinel/rest-api.md
git commit -m "docs(sentinel): document error envelope contract + update affected examples (#158)"
```

---

## Task 8: CLAUDE.md test count bump + final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run full agent + app test suites + typecheck (baseline check)**

Run all three in parallel:
```bash
pnpm --filter @sipher/agent test -- --run
pnpm --filter @sipher/app test -- --run
pnpm typecheck
```
Expected counts:
- Agent: **1300 tests**, **104 suites** (1290 → 1300, 103 → 104)
- App: **46 tests**, 12 suites (45 → 46)
- Typecheck: clean

If counts differ, investigate before proceeding.

- [ ] **Step 2: Update CLAUDE.md test counts**

In `CLAUDE.md`, find every occurrence of `1290` (agent test count) and replace with `1300`. Find every occurrence of `103` paired with `suites` (agent suite count) and replace with `104`. Find every occurrence of `45` paired with `app` and replace with `46`.

Use this command to scope the search precisely:
```bash
grep -n "1290\|103 suites\|105 suites\|45 (12 suites)\|45 tests" CLAUDE.md
```

For each match, update via Edit tool with sufficient surrounding context for uniqueness. Common locations include:
- Test count summary at the top of the SIP Core section
- Sipher project status section in MEMORY.md (if applicable — note that MEMORY.md is in the user's private memory dir, NOT in the repo, so this only updates `CLAUDE.md`)
- Status footer line at the bottom

- [ ] **Step 3: Re-run all suites one more time as final verification**

```bash
pnpm --filter @sipher/agent test -- --run
pnpm --filter @sipher/app test -- --run
pnpm typecheck
```
Expected: same counts as Step 1, all green.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: bump test counts after error envelope normalization (1290 → 1300, 103 → 104 suites)"
```

---

## Verification before PR

After all 8 tasks complete:

```bash
# Confirm 8 commits on the branch
git log main..HEAD --oneline

# Confirm test counts
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -10
pnpm --filter @sipher/app test -- --run 2>&1 | tail -10
pnpm typecheck

# Confirm spec + plan are committed (the spec was committed before plan execution)
git log main..HEAD -- docs/superpowers/

# Diff against main for PR description
git diff main..HEAD --stat
```

**Expected diff stat (approximate):**
```
 CLAUDE.md                                                   |  ~10 ++--
 app/src/components/SentinelConfirm.tsx                      |   ~7 ++-
 app/src/components/__tests__/SentinelConfirm.test.tsx       |  ~30 +++++++--
 docs/sentinel/rest-api.md                                   |  ~50 +++++++++--
 docs/superpowers/plans/2026-05-04-sentinel-error-envelope.md| +600 (NEW)
 docs/superpowers/specs/2026-05-04-sentinel-error-envelope-design.md | +296 (NEW, already committed)
 packages/agent/src/routes/sentinel-api.ts                   |  ~30 ++++--
 packages/agent/src/routes/sentinel-errors.ts                |  +25 (NEW)
 packages/agent/tests/sentinel/sentinel-api.test.ts          |  ~50 ++++++--
 packages/agent/tests/sentinel/sentinel-errors.test.ts       |  +75 (NEW)
```

**PR title:** `fix(sentinel): normalize REST error envelope shape across all routes (#158)`

**PR body sections:** Summary | Behavior changes | Test count delta | Closes #158 | Notes (mentions #157 will apply this contract; #159 will mirror docs)

---

## Self-review

**1. Spec coverage check:**

| Spec section / requirement | Plan task |
|---|---|
| Helper file with `SentinelErrorCode` union | Task 1 |
| 5-code taxonomy (VALIDATION_FAILED, NOT_FOUND, FORBIDDEN, UNAVAILABLE, INTERNAL) | Task 1 (helper), Task 2-4 (used in handlers) |
| `sendSentinelError` function signature | Task 1 |
| `POST /assess` 400/500/503 envelope migration | Task 2 |
| `POST /blacklist` 400 envelope migration | Task 3 |
| `POST /pending/:id/cancel` BEHAVIOR CHANGE (200→404 on missing) | Task 4 |
| `POST /override/:flagId` 404 refactor to helper | Task 5 |
| `POST /cancel/:flagId` 404 refactor to helper | Task 5 |
| Frontend SentinelConfirm.tsx envelope parsing | Task 6 |
| Frontend test for envelope display + fallback | Task 6 |
| Helper unit tests (6 tests, all 5 codes + verbatim message) | Task 1 |
| New error-path tests in sentinel-api.test.ts (assess 503/500, blacklist 400, pending 404) | Tasks 2-4 |
| `pause-resume-routes.test.ts` zero changes (regression guard) | Task 5 (verified in Step 2) |
| `docs/sentinel/rest-api.md` Error Envelope section | Task 7 Step 1 |
| `docs/sentinel/rest-api.md` updated response examples | Task 7 Steps 2-4 |
| Stale `/pending/:id/cancel` note removal | Task 7 Step 4 |
| `Last verified:` footer date bump | Task 7 Step 5 |
| JSDoc `@returns` updates on 5 affected handlers | Tasks 2-5 (each handler's JSDoc updated alongside the code change) |
| `@see docs/sentinel/rest-api.md#error-envelope` cross-link on each handler | Tasks 2-5 |
| CLAUDE.md test count bump (1290→1300, 103→104) | Task 8 |
| `pnpm typecheck` clean | Tasks 1-6 (every implementation task), 8 (final) |
| Test count target: agent 1300, app 46 | Task 8 final verification |

All spec requirements mapped to plan tasks. ✓

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N", or vague "add error handling" patterns. Every step contains the actual code or command to run. ✓

**3. Type consistency:**
- `SentinelErrorCode` union spelled identically in helper file (Task 1), used by string literals only in handlers (Tasks 2-5)
- `sendSentinelError` signature `(res, code, message)` consistent across every callsite
- Test assertion uses `toStrictEqual({error: {code, message}})` consistently ✓

**4. Bite-sized check:** Largest task is Task 7 (docs, 7 steps); other tasks are 4-6 steps. Each step is one action (write code, run test, commit). ✓

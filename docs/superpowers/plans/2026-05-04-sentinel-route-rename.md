# SENTINEL Dual-Cancel Route Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename three SENTINEL admin routes so URL names announce which state store they touch, eliminating the dual-cancel ambiguity that PR #160 documented with a `WARNING` callout.

**Architecture:** Pure URL rename, clean cut, single PR. Eight tasks, eight commits. Tasks 1-3 each pair a route handler change with its supertest update (TDD-friendly, every commit lands green). Task 4 `git mv`s the promise-gate test file. Task 5 updates internal JSDoc cross-links. Task 6 updates the lone frontend caller (`SentinelConfirm.tsx`). Tasks 7-8 sweep surface docs and CLAUDE.md.

**Tech Stack:** TypeScript, Express 5 (routing), Vitest (unit), Supertest (HTTP), React 19 + Testing Library (frontend), pnpm + Turborepo workspace.

**Spec:** `docs/superpowers/specs/2026-05-04-sentinel-route-rename-design.md`

> **Note on line numbers:** Line numbers throughout this plan reference the pre-task baseline state of each file. As you commit Tasks 1-8 in order, line numbers in subsequent tasks may shift (e.g., Task 1 shrinks `sentinel-api.ts` by ~2 lines, so Task 2's "lines 172-189" land at roughly "lines 170-187" post-Task-1). Use the code blocks and surrounding context (function names, route paths, JSDoc text) as the source of truth — the line numbers are advisory only.

---

## Pre-Flight

You are working on branch `refactor/sentinel-route-rename` (already created from `main` at commit `00e5933`; the spec was committed as `4207286`).

Confirm before starting:

```bash
git rev-parse --abbrev-ref HEAD
# Expected: refactor/sentinel-route-rename

git log --oneline -1
# Expected: 4207286 docs(sentinel): design spec for dual-cancel route rename (#157)

pnpm --filter @sipher/agent test -- --run 2>&1 | tail -5
# Expected: Tests 1300 passed | Test Files 104 passed
```

If counts differ, stop and investigate — baseline drifted.

---

## Task 1: Rename `POST /pending/:id/cancel` → `POST /circuit-breaker/:id/cancel`

**Files:**
- Modify: `packages/agent/tests/sentinel/sentinel-api.test.ts:130-153`
- Modify: `packages/agent/src/routes/sentinel-api.ts:131-153,168-170`

**Goal of this task:** The circuit-breaker cancel route exposes new URL `/circuit-breaker/:id/cancel`. Old URL returns 404 (Express has no handler for it). Behavior, status codes, error envelope unchanged. Inline `// NOTE:` comment at lines 168-170 is deleted (it referenced the soon-to-be-renamed old URL).

- [ ] **Step 1: Update the failing tests in `sentinel-api.test.ts`**

In `packages/agent/tests/sentinel/sentinel-api.test.ts`, replace the two cancel-route tests (lines 130-153) with these new versions. Note: only `it(...)` text and URL strings change; assertions are identical.

Replace lines 130-153 with:

```ts
  it('POST /circuit-breaker/:id/cancel cancels an action', async () => {
    const app = await buildApp(vi.fn())
    const cb = await import('../../src/sentinel/circuit-breaker.js')
    const id = cb.scheduleCancellableAction({
      actionType: 'refund', payload: {}, reasoning: 'r', wallet: 'w1', delayMs: 60000,
    })
    const res = await request(app).post(`/api/sentinel/circuit-breaker/${id}/cancel`).send({ reason: 'user cancelled' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const { getPendingAction } = await import('../../src/db.js')
    expect(getPendingAction(id)!.status).toBe('cancelled')
    cb.clearAllTimers()
  })

  it('POST /circuit-breaker/:id/cancel returns 404 + NOT_FOUND when ID does not exist', async () => {
    const app = await buildApp(vi.fn())
    const res = await request(app).post('/api/sentinel/circuit-breaker/does-not-exist/cancel').send({
      reason: 'attempted cancel',
    })
    expect(res.status).toBe(404)
    expect(res.body).toStrictEqual({
      error: { code: 'NOT_FOUND', message: 'pending action not found or already resolved' },
    })
  })
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run 2>&1 | tail -20
```

Expected: both new tests FAIL with status 404 (no handler at new URL yet — Express returns default 404 with no envelope, so `res.body` won't match `{error:{code,message}}` either).

- [ ] **Step 3: Update the route handler in `sentinel-api.ts`**

In `packages/agent/src/routes/sentinel-api.ts`, replace the JSDoc + handler at lines 131-153 with:

```ts
/**
 * Circuit-breaker cancel — mark a pending action cancelled in SQLite.
 * Operates on the durable circuit-breaker queue (distinct from the in-memory promise-gate routes).
 * @auth verifyJwt + requireOwner
 * @param id pending action id
 * @body { reason? string }
 * @returns 200 { success: true } | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelcircuit-breakeridcancel
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/circuit-breaker/:id/cancel', (req: Request, res: Response) => {
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

Two diffs vs. existing code:
- Route path: `/pending/:id/cancel` → `/circuit-breaker/:id/cancel`
- JSDoc cross-references: removed two prose lines (`Circuit-breaker cancel — distinct from...`) since the new URL is self-explanatory; updated `@see` anchor; tightened opening line

- [ ] **Step 4: Delete the inline NOTE comment at lines 168-170**

In `packages/agent/src/routes/sentinel-api.ts`, the section header above the promise-gate handlers currently reads:

```ts
// ─── Promise-gate endpoints (pause/resume for advisory mode) ────────────────
// NOTE: distinct from /pending/:id/cancel above (circuit-breaker, SQLite-backed).
// These act on in-memory pending promises owned by sentinel/pending.ts.
```

Replace with:

```ts
// ─── Promise-gate endpoints (pause/resume for advisory mode) ────────────────
// These act on in-memory pending promises owned by sentinel/pending.ts.
```

The middle line (`NOTE: distinct from /pending/:id/cancel...`) is dead weight after the rename — the URL namespaces (`circuit-breaker/*` vs `promise-gate/*`) make the distinction visible.

- [ ] **Step 5: Run tests, verify they pass**

```bash
pnpm --filter @sipher/agent test packages/agent/tests/sentinel/sentinel-api.test.ts -- --run 2>&1 | tail -10
```

Expected: all `sentinel-api.test.ts` tests PASS.

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts packages/agent/tests/sentinel/sentinel-api.test.ts
git commit -m "refactor(sentinel): rename POST /pending/:id/cancel → /circuit-breaker/:id/cancel (#157)"
```

---

## Task 2: Rename `POST /override/:flagId` → `POST /promise-gate/:flagId/resolve`

**Files:**
- Modify: `packages/agent/tests/sentinel/pause-resume-routes.test.ts:63-70,84-90,92-100,102-108`
- Modify: `packages/agent/src/routes/sentinel-api.ts:172-189`

**Goal of this task:** Promise-gate resolve route exposes new URL `/promise-gate/:flagId/resolve`. The pause-resume-routes test file's four `/override`-using tests are updated to the new URL. Note: this test file will be `git mv`d to `promise-gate-routes.test.ts` in Task 4 — for now, it stays at its current name.

- [ ] **Step 1: Update the failing tests in `pause-resume-routes.test.ts`**

In `packages/agent/tests/sentinel/pause-resume-routes.test.ts`, replace four occurrences of `/api/sentinel/override/` with `/api/sentinel/promise-gate/<flagId>/resolve` shape. The `it(...)` text on line 63 also changes.

Replace line 63 (the `it(...)` opening line):

Old:
```ts
  it('POST /api/sentinel/override/:flagId resolves the pending promise (204)', async () => {
```

New:
```ts
  it('POST /api/sentinel/promise-gate/:flagId/resolve resolves the pending promise (204)', async () => {
```

Replace line 66 URL:

Old:
```ts
      .post(`/api/sentinel/override/${flagId}`)
```

New:
```ts
      .post(`/api/sentinel/promise-gate/${flagId}/resolve`)
```

Replace line 86 URL (404 test):

Old:
```ts
      .post('/api/sentinel/override/does-not-exist')
```

New:
```ts
      .post('/api/sentinel/promise-gate/does-not-exist/resolve')
```

Replace line 97 URL (403 test):

Old:
```ts
      .post(`/api/sentinel/override/${flagId}`)
```

New:
```ts
      .post(`/api/sentinel/promise-gate/${flagId}/resolve`)
```

Replace line 106 URL (401 test):

Old:
```ts
    const res = await supertest(createApp()).post(`/api/sentinel/override/${flagId}`)
```

New:
```ts
    const res = await supertest(createApp()).post(`/api/sentinel/promise-gate/${flagId}/resolve`)
```

- [ ] **Step 2: Run tests, verify the four affected tests fail**

```bash
pnpm --filter @sipher/agent test packages/agent/tests/sentinel/pause-resume-routes.test.ts -- --run 2>&1 | tail -20
```

Expected: tests on lines 63-108 that hit the new URL FAIL with 404 (no handler yet). The cancel test at line 72 still passes because its URL is unchanged in this task.

- [ ] **Step 3: Update the route handler in `sentinel-api.ts`**

In `packages/agent/src/routes/sentinel-api.ts`, replace the JSDoc + handler at lines 172-189 with:

```ts
/**
 * Promise-gate resolve — approve a paused advisory-mode action.
 * Operates on the in-memory pending-promise registry owned by `sentinel/pending.ts`.
 * @auth verifyJwt + requireOwner
 * @param flagId in-memory promise flag id
 * @returns 204 | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidresolve
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/promise-gate/:flagId/resolve', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = resolvePending(flagId)
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')
    return
  }
  res.status(204).send()
})
```

Three diffs vs. existing code:
- Route path: `/override/:flagId` → `/promise-gate/:flagId/resolve`
- JSDoc cross-reference line (`Promise-gate resolve — see also \`/cancel/:flagId\` reject.`) removed (Task 3 will add a similar removal for the reject handler; the URL namespaces are self-explanatory now)
- `@see` anchor updated to new heading

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm --filter @sipher/agent test packages/agent/tests/sentinel/pause-resume-routes.test.ts -- --run 2>&1 | tail -10
```

Expected: all 5 tests in this file PASS.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts packages/agent/tests/sentinel/pause-resume-routes.test.ts
git commit -m "refactor(sentinel): rename POST /override/:flagId → /promise-gate/:flagId/resolve (#157)"
```

---

## Task 3: Rename `POST /cancel/:flagId` → `POST /promise-gate/:flagId/reject`

**Files:**
- Modify: `packages/agent/tests/sentinel/pause-resume-routes.test.ts:72-82`
- Modify: `packages/agent/src/routes/sentinel-api.ts:191-208`

**Goal of this task:** Promise-gate reject route exposes new URL `/promise-gate/:flagId/reject`. Only the one cancel test in this file updates URLs (the override-related tests in Task 2 already moved).

- [ ] **Step 1: Update the failing test in `pause-resume-routes.test.ts`**

In `packages/agent/tests/sentinel/pause-resume-routes.test.ts`, replace lines 72-82 (the cancel/reject test) with:

```ts
  it('POST /api/sentinel/promise-gate/:flagId/reject rejects the pending promise (204)', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    // attach noop catch before the HTTP call so Node doesn't flag the rejection as unhandled
    // before our .rejects assertion consumes it
    promise.catch(() => {})
    const res = await supertest(createApp())
      .post(`/api/sentinel/promise-gate/${flagId}/reject`)
      .set('Authorization', `Bearer ${signJwt(ADMIN_WALLET)}`)
    expect(res.status).toBe(204)
    await expect(promise).rejects.toThrow(/cancelled/i)
  })
```

Two diffs:
- `it(...)` text URL: `/api/sentinel/cancel/:flagId` → `/api/sentinel/promise-gate/:flagId/reject`
- Supertest URL: `/api/sentinel/cancel/${flagId}` → `/api/sentinel/promise-gate/${flagId}/reject`

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @sipher/agent test packages/agent/tests/sentinel/pause-resume-routes.test.ts -- --run 2>&1 | tail -15
```

Expected: the reject test FAILS with 404 (no handler yet).

- [ ] **Step 3: Update the route handler in `sentinel-api.ts`**

In `packages/agent/src/routes/sentinel-api.ts`, replace the JSDoc + handler at lines 191-208 with:

```ts
/**
 * Promise-gate reject — deny a paused advisory-mode action.
 * Operates on the in-memory pending-promise registry owned by `sentinel/pending.ts`.
 * @auth verifyJwt + requireOwner
 * @param flagId in-memory promise flag id
 * @returns 204 | 404 ErrorEnvelope
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidreject
 * @see docs/sentinel/rest-api.md#error-envelope
 */
sentinelAdminRouter.post('/promise-gate/:flagId/reject', (req: Request, res: Response) => {
  const flagId = String(req.params.flagId)
  const ok = rejectPending(flagId, 'cancelled_by_user')
  if (!ok) {
    sendSentinelError(res, 'NOT_FOUND', 'flag not found or expired')
    return
  }
  res.status(204).send()
})
```

Three diffs vs. existing code:
- Route path: `/cancel/:flagId` → `/promise-gate/:flagId/reject`
- JSDoc cross-reference line (`Promise-gate reject — distinct from the circuit-breaker \`/pending/:id/cancel\`.`) removed
- `@see` anchor updated to new heading

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm --filter @sipher/agent test packages/agent/tests/sentinel/pause-resume-routes.test.ts -- --run 2>&1 | tail -10
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/sentinel-api.ts packages/agent/tests/sentinel/pause-resume-routes.test.ts
git commit -m "refactor(sentinel): rename POST /cancel/:flagId → /promise-gate/:flagId/reject (#157)"
```

---

## Task 4: `git mv` test file → `promise-gate-routes.test.ts`

**Files:**
- Rename: `packages/agent/tests/sentinel/pause-resume-routes.test.ts` → `packages/agent/tests/sentinel/promise-gate-routes.test.ts`
- Modify (1 line): the `describe(...)` block inside

**Goal of this task:** File name now matches the route namespace it exercises (`promise-gate`). All URL strings inside have already moved (Tasks 2 & 3) so this is a clean rename plus a 1-line `describe` text update. Git rename detection should report 100% similarity.

- [ ] **Step 1: Run `git mv`**

```bash
git mv packages/agent/tests/sentinel/pause-resume-routes.test.ts packages/agent/tests/sentinel/promise-gate-routes.test.ts
```

- [ ] **Step 2: Update the `describe` block**

In `packages/agent/tests/sentinel/promise-gate-routes.test.ts` line 62, replace:

Old:
```ts
describe('SENTINEL pause/resume routes', () => {
```

New:
```ts
describe('SENTINEL promise-gate routes', () => {
```

- [ ] **Step 3: Run the renamed test file to confirm it still works**

```bash
pnpm --filter @sipher/agent test packages/agent/tests/sentinel/promise-gate-routes.test.ts -- --run 2>&1 | tail -10
```

Expected: all 5 tests PASS, suite name reads `SENTINEL promise-gate routes`.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/tests/sentinel/promise-gate-routes.test.ts
git commit -m "test(sentinel): rename pause-resume-routes.test.ts → promise-gate-routes.test.ts (#157)"
```

After committing, verify rename detection:

```bash
git log -1 --stat --diff-filter=R 2>&1 | head -5
# Expected: a `R100` (100% rename) entry, not separate add+delete
```

If the diff shows below 100% similarity, that's still acceptable — the only content change was the `describe` line. Do not split this commit.

---

## Task 5: Update internal JSDoc cross-links in `pending.ts` and `agent.ts`

**Files:**
- Modify: `packages/agent/src/sentinel/pending.ts:42,76,80,93,98`
- Modify: `packages/agent/src/agent.ts:240,360-361`

**Goal of this task:** Source-of-truth JSDoc inside the modules that own promise-gate state now references the new URLs and anchors. Documentation only — no behavioral change, no test required (typecheck verifies the comments don't break parser; the `@see` anchors will be visually validated when rest-api.md is rendered in Task 7).

- [ ] **Step 1: Update `pending.ts` line 42 (createPending JSDoc `@see`)**

In `packages/agent/src/sentinel/pending.ts`, replace line 42:

Old:
```ts
 * @see docs/sentinel/rest-api.md#post-apisentineloverrideflagid
```

New:
```ts
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidresolve
```

- [ ] **Step 2: Update `pending.ts` lines 75-80 (resolvePending JSDoc)**

In `packages/agent/src/sentinel/pending.ts`, replace lines 74-81 (the `resolvePending` JSDoc block + signature line):

Old:
```ts
/**
 * Resolve a pending flag — admin override path.
 * Mapped to `POST /api/sentinel/override/:flagId`.
 * Clears the auto-timeout, removes the flag from the Map, and calls the promise resolver.
 * @param flagId - flag identifier returned by `createPending`
 * @returns `true` if the flag existed and was resolved; `false` if not found or already settled.
 * @see docs/sentinel/rest-api.md#post-apisentineloverrideflagid
 */
```

New:
```ts
/**
 * Resolve a pending flag — admin approval path.
 * Mapped to `POST /api/sentinel/promise-gate/:flagId/resolve`.
 * Clears the auto-timeout, removes the flag from the Map, and calls the promise resolver.
 * @param flagId - flag identifier returned by `createPending`
 * @returns `true` if the flag existed and was resolved; `false` if not found or already settled.
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidresolve
 */
```

Two diffs:
- Prose: `admin override path` → `admin approval path` (clearer with the new URL verb)
- Prose: `POST /api/sentinel/override/:flagId` → `POST /api/sentinel/promise-gate/:flagId/resolve`
- `@see` anchor updated

- [ ] **Step 3: Update `pending.ts` lines 91-98 (rejectPending JSDoc)**

In `packages/agent/src/sentinel/pending.ts`, replace lines 91-99 (the `rejectPending` JSDoc block):

Old:
```ts
/**
 * Reject a pending flag — admin cancel path.
 * Mapped to `POST /api/sentinel/cancel/:flagId`.
 * Clears the auto-timeout, removes the flag from the Map, and rejects the promise with `reason`.
 * @param flagId - flag identifier returned by `createPending`
 * @param reason - rejection reason string (e.g. `'cancelled_by_user'`), wrapped in an Error
 * @returns `true` if the flag existed and was rejected; `false` if not found or already settled.
 * @see docs/sentinel/rest-api.md#post-apisentinelcancelflagid
 */
```

New:
```ts
/**
 * Reject a pending flag — admin denial path.
 * Mapped to `POST /api/sentinel/promise-gate/:flagId/reject`.
 * Clears the auto-timeout, removes the flag from the Map, and rejects the promise with `reason`.
 * @param flagId - flag identifier returned by `createPending`
 * @param reason - rejection reason string (e.g. `'cancelled_by_user'`), wrapped in an Error
 * @returns `true` if the flag existed and was rejected; `false` if not found or already settled.
 * @see docs/sentinel/rest-api.md#post-apisentinelpromise-gateflagidreject
 */
```

Three diffs:
- Prose: `admin cancel path` → `admin denial path` (clearer with the new URL verb)
- Prose: `POST /api/sentinel/cancel/:flagId` → `POST /api/sentinel/promise-gate/:flagId/reject`
- `@see` anchor updated

- [ ] **Step 4: Update `agent.ts` line 240 (SSESentinelPause comment)**

In `packages/agent/src/agent.ts`, replace line 240:

Old:
```ts
  /** Server-issued ID — client posts to /api/sentinel/override/:flagId or /cancel/:flagId */
```

New:
```ts
  /** Server-issued ID — client posts to /api/sentinel/promise-gate/:flagId/resolve or /reject */
```

- [ ] **Step 5: Update `agent.ts` lines 360-361 (architecture comment)**

In `packages/agent/src/agent.ts`, replace lines 360-361:

Old:
```ts
 * until the user POSTs to `/api/sentinel/override/:flagId` (resume) or
 * `/cancel/:flagId` (cancel). Cancellation is surfaced as a synthetic
```

New:
```ts
 * until the user POSTs to `/api/sentinel/promise-gate/:flagId/resolve` (resume) or
 * `/promise-gate/:flagId/reject` (cancel). Cancellation is surfaced as a synthetic
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 7: Run agent test suite to confirm nothing accidentally broke**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -5
```

Expected: 1300 tests / 104 suites pass.

- [ ] **Step 8: Commit**

```bash
git add packages/agent/src/sentinel/pending.ts packages/agent/src/agent.ts
git commit -m "docs(sentinel): update internal JSDoc for renamed routes (#157)"
```

---

## Task 6: Frontend caller — `SentinelConfirm.tsx` + test

**Files:**
- Modify: `app/src/components/SentinelConfirm.tsx:13,20,26,45,56-57`
- Modify: `app/src/components/__tests__/SentinelConfirm.test.tsx:38-43,58-63`

**Goal of this task:** The lone consumer of the renamed routes uses the new URL template. Internal vocabulary moves from `kind: 'override' | 'cancel'` to `verb: 'resolve' | 'reject'` to match the new URL verb segment. The public `onResolved` callback signature changes from `(decision: 'override' | 'cancel') => void` to `(decision: 'resolve' | 'reject') => void`. The lone parent (`ChatSidebar.tsx:164`) ignores the decision arg, so this rename is invisible to callers. Button copy ("Override & Send", "Cancel") stays unchanged — that's user-facing UX.

- [ ] **Step 1: Update the failing assertions in `SentinelConfirm.test.tsx`**

In `app/src/components/__tests__/SentinelConfirm.test.tsx`, replace lines 38-43 (the override test fetch + onResolved assertions):

Old:
```tsx
    await userEvent.click(screen.getByRole('button', { name: /override & send/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/override/abc'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(onResolved).toHaveBeenCalledWith('override')
```

New:
```tsx
    await userEvent.click(screen.getByRole('button', { name: /override & send/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/promise-gate/abc/resolve'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(onResolved).toHaveBeenCalledWith('resolve')
```

Replace lines 58-63 (the cancel test fetch + onResolved assertions):

Old:
```tsx
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/cancel/abc'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(onResolved).toHaveBeenCalledWith('cancel')
```

New:
```tsx
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/promise-gate/abc/reject'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(onResolved).toHaveBeenCalledWith('reject')
```

Also update the `it(...)` text on lines 26 and 46 to match the new vocabulary:

Line 26 — old:
```tsx
  it('POSTs to override endpoint on Override click', async () => {
```

Line 26 — new:
```tsx
  it('POSTs to promise-gate resolve endpoint on Override click', async () => {
```

Line 46 — old:
```tsx
  it('POSTs to cancel endpoint on Cancel click', async () => {
```

Line 46 — new:
```tsx
  it('POSTs to promise-gate reject endpoint on Cancel click', async () => {
```

- [ ] **Step 2: Run app tests, verify the four affected assertions fail**

```bash
pnpm --filter @sipher/app test app/src/components/__tests__/SentinelConfirm.test.tsx -- --run 2>&1 | tail -20
```

Expected: 4 of the 6 tests FAIL — the two URL-shape assertions and the two `onResolved` arg assertions. The other 4 tests (render, double-dispatch, envelope error display, fallback) should still pass.

- [ ] **Step 3: Update `SentinelConfirm.tsx`**

Replace the entire file (`app/src/components/SentinelConfirm.tsx`) with:

```tsx
import { useState } from 'react'
import ConfirmCard from './ConfirmCard'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Props {
  flagId: string
  /** Owner JWT — endpoints require requireOwner middleware on the server. */
  token: string
  action: string
  amount: string
  description?: string
  onResolved: (decision: 'resolve' | 'reject') => void
}

export default function SentinelConfirm({ flagId, token, action, amount, description, onResolved }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = async (verb: 'resolve' | 'reject') => {
    if (busy) return
    setBusy(true)
    setError(null)
    let success = false
    try {
      const res = await fetch(`${API_URL}/api/sentinel/promise-gate/${encodeURIComponent(flagId)}/${verb}`, {
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
    if (success) onResolved(verb)
  }

  return (
    <div className="flex flex-col gap-2">
      <ConfirmCard
        variant="warning"
        action={action}
        amount={amount}
        description={description}
        disabled={busy}
        onConfirm={() => dispatch('resolve')}
        onCancel={() => dispatch('reject')}
      />
      {error && <div className="text-[12px] text-red px-1">{error}</div>}
    </div>
  )
}
```

Five vocabulary-only diffs vs. existing code:
- `Props.onResolved` type union: `'override' | 'cancel'` → `'resolve' | 'reject'`
- `dispatch` arg name: `kind` → `verb`
- `dispatch` arg type: `'override' | 'cancel'` → `'resolve' | 'reject'`
- Fetch URL template: `/api/sentinel/${kind}/${encodeURIComponent(flagId)}` → `/api/sentinel/promise-gate/${encodeURIComponent(flagId)}/${verb}`
- Button handlers: `dispatch('override')` → `dispatch('resolve')`, `dispatch('cancel')` → `dispatch('reject')`

- [ ] **Step 4: Run app tests, verify all pass**

```bash
pnpm --filter @sipher/app test app/src/components/__tests__/SentinelConfirm.test.tsx -- --run 2>&1 | tail -10
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck 2>&1 | tail -10
```

Expected: no errors. The `ChatSidebar.tsx:164` caller passes an arrow function that ignores the decision arg (`onResolved={() => dismissMessage(msg.id)}`), so the type union change is invisible there.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/SentinelConfirm.tsx app/src/components/__tests__/SentinelConfirm.test.tsx
git commit -m "refactor(app): SentinelConfirm uses promise-gate route shape (#157)"
```

---

## Task 7: Surface docs — `docs/sentinel/rest-api.md`

**Files:**
- Modify: `docs/sentinel/rest-api.md:8-14,310-352,388-415,419-449`

**Goal of this task:** Surface docs reflect the new routes. Delete the dual-cancel `WARNING` (top of file). Rename three section headings + their curl examples. Delete the second WARNING block inside the cancel section (now obsolete). The `Last verified: 2026-05-04` footer is already today's date and stays.

- [ ] **Step 1: Delete the top-of-file WARNING block**

In `docs/sentinel/rest-api.md`, delete lines 8-14:

```markdown
> [!WARNING]
> Two distinct cancel routes exist on the admin router and look nearly identical by name:
>
> - `POST /api/sentinel/pending/:id/cancel` — cancels a circuit-breaker pending action (SQLite-backed, returns 200 + `{"success": true}` on success, 404 + `NOT_FOUND` envelope on missing)
> - `POST /api/sentinel/cancel/:flagId` — rejects an in-memory promise-gate flag (returns 204 on success, 404 + `NOT_FOUND` envelope on missing)
>
> They operate on different state stores. A rename is tracked in [follow-up issue #1](https://github.com/sip-protocol/sipher/issues/157).
```

The result: line 7 (the public/admin route description bullets) is followed directly by line 16 (`## Error Envelope` heading). Verify there is exactly one blank line between them.

- [ ] **Step 2: Rename `### POST /api/sentinel/pending/:id/cancel` section heading + curl**

In `docs/sentinel/rest-api.md`, replace line 310:

Old:
```markdown
### POST /api/sentinel/pending/:id/cancel
```

New:
```markdown
### POST /api/sentinel/circuit-breaker/:id/cancel
```

Replace line 347 (curl in this section):

Old:
```bash
curl -X POST http://localhost:5006/api/sentinel/pending/01KQP25BM8RVZJ92CTANFDNTMG/cancel \
```

New:
```bash
curl -X POST http://localhost:5006/api/sentinel/circuit-breaker/01KQP25BM8RVZJ92CTANFDNTMG/cancel \
```

Leave everything else in this section unchanged — including the existing 200/404 documentation and the parenthetical `(Behavior changed in this PR — previously this path returned \`200 + {success: false}\`.)` note on line 342, which describes the #158 behavior change and remains accurate.

- [ ] **Step 3: Rename `### POST /api/sentinel/override/:flagId` section heading + curl**

In `docs/sentinel/rest-api.md`, replace line 388:

Old:
```markdown
### POST /api/sentinel/override/:flagId
```

New:
```markdown
### POST /api/sentinel/promise-gate/:flagId/resolve
```

Replace line 413 (curl):

Old:
```bash
curl -X POST http://localhost:5006/api/sentinel/override/flag_01KQP24PG0KZCJVWJDQM8H3JAY \
```

New:
```bash
curl -X POST http://localhost:5006/api/sentinel/promise-gate/flag_01KQP24PG0KZCJVWJDQM8H3JAY/resolve \
```

- [ ] **Step 4: Rename `### POST /api/sentinel/cancel/:flagId` section heading + curl + delete inner WARNING block**

In `docs/sentinel/rest-api.md`, replace line 419:

Old:
```markdown
### POST /api/sentinel/cancel/:flagId
```

New:
```markdown
### POST /api/sentinel/promise-gate/:flagId/reject
```

Delete lines 425-426 (the inner WARNING block, now obsolete):

```markdown
> [!WARNING]
> See the top-of-file warning about dual-cancel route ambiguity. This route operates on **in-memory promise-gate flags**. For cancelling SQLite-backed circuit-breaker actions, use `POST /api/sentinel/pending/:id/cancel`.
```

After deletion, the **Description** paragraph (line 423) should be followed directly by the **Path params:** heading (was line 428). Verify there is exactly one blank line between them.

Replace line 447 (curl):

Old:
```bash
curl -X POST http://localhost:5006/api/sentinel/cancel/flag_01KQP24PG0KZCJVWJDQM8H3JAY \
```

New:
```bash
curl -X POST http://localhost:5006/api/sentinel/promise-gate/flag_01KQP24PG0KZCJVWJDQM8H3JAY/reject \
```

- [ ] **Step 5: Verify the doc renders cleanly**

```bash
grep -n "^### POST" docs/sentinel/rest-api.md
# Expected: lines for /assess, /blacklist, /circuit-breaker/:id/cancel, /promise-gate/:flagId/resolve, /promise-gate/:flagId/reject
# Should NOT see: /pending/:id/cancel, /override/:flagId, /cancel/:flagId

grep -c "WARNING" docs/sentinel/rest-api.md
# Expected: 0
```

- [ ] **Step 6: Commit**

```bash
git add docs/sentinel/rest-api.md
git commit -m "docs(sentinel): rename routes in rest-api.md + remove dual-cancel WARNING (#157)"
```

---

## Task 8: Cross-doc cleanup — `audit-log.md` + `CLAUDE.md`

**Files:**
- Modify: `docs/sentinel/audit-log.md:72`
- Modify: `CLAUDE.md:487`

**Goal of this task:** Mop up the two remaining stale references in adjacent docs. Both are single-line edits.

- [ ] **Step 1: Update `docs/sentinel/audit-log.md` line 72**

In `docs/sentinel/audit-log.md`, replace line 72:

Old:
```markdown
Circuit-breaker queue. Populated when an action is scheduled to fire after a cancellation window (see [`SENTINEL_CANCEL_WINDOW_MS`](./config.md#autonomy)). Cancel via [`POST /api/sentinel/pending/:id/cancel`](./rest-api.md#post-apisentinelpendingidcancel). The `status` column transitions through `pending` → `executed` or `cancelled`.
```

New:
```markdown
Circuit-breaker queue. Populated when an action is scheduled to fire after a cancellation window (see [`SENTINEL_CANCEL_WINDOW_MS`](./config.md#autonomy)). Cancel via [`POST /api/sentinel/circuit-breaker/:id/cancel`](./rest-api.md#post-apisentinelcircuit-breakeridcancel). The `status` column transitions through `pending` → `executed` or `cancelled`.
```

Two changes on the same line:
- Visible link text URL: `/api/sentinel/pending/:id/cancel` → `/api/sentinel/circuit-breaker/:id/cancel`
- Anchor target: `#post-apisentinelpendingidcancel` → `#post-apisentinelcircuit-breakeridcancel`

- [ ] **Step 2: Update `CLAUDE.md` line 487**

In `CLAUDE.md`, replace line 487:

Old:
```markdown
| POST | `/v1/sentinel/pending/:id/cancel` | Cancel a pending action | Yes | — |
```

New:
```markdown
| POST | `/v1/sentinel/circuit-breaker/:id/cancel` | Cancel a pending action | Yes | — |
```

Path segment update only. The `/v1/` prefix is a pre-existing inconsistency with the actual code path `/api/`, but auditing the prefix is out of scope (every other entry in this table uses `/v1/` too).

- [ ] **Step 3: Commit**

```bash
git add docs/sentinel/audit-log.md CLAUDE.md
git commit -m "docs(sentinel): update audit-log + CLAUDE.md route references (#157)"
```

---

## Final Verification

Before pushing the branch and opening a PR, run the full verification sweep.

- [ ] **Step 1: Full agent test suite**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -5
```

Expected: `Tests 1300 passed | Test Files 104 passed`. Counts unchanged from baseline (rename, not behavior change).

- [ ] **Step 2: Full app test suite**

```bash
pnpm --filter @sipher/app test -- --run 2>&1 | tail -5
```

Expected: `Tests 46 passed | Test Files 12 passed`.

- [ ] **Step 3: Workspace typecheck**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors anywhere in the workspace.

- [ ] **Step 4: Stale-reference grep**

```bash
grep -rn "pending/:id/cancel\|cancel/:flagId\|override/:flagId\|/api/sentinel/pending/[^\"]*cancel\|/api/sentinel/cancel/\|/api/sentinel/override/\|sentinelpendingidcancel\|sentinelcancelflagid\|sentineloverrideflagid" \
  --include="*.ts" --include="*.tsx" --include="*.md" \
  --exclude-dir=docs/superpowers --exclude-dir=node_modules .
```

Expected: zero hits. The `--exclude-dir=docs/superpowers` flag excludes historical specs and plans (which describe the world at the time written and should not be edited).

If any hits surface, address them before pushing — they indicate either (a) a missed call site or (b) a doc that needs updating, and either way the rename is incomplete.

- [ ] **Step 5: Render `rest-api.md` in GitHub preview**

After pushing the branch, open `docs/sentinel/rest-api.md` on the GitHub UI for this branch and click each TOC entry / each `@see` anchor target:

- `#post-apisentinelcircuit-breakeridcancel`
- `#post-apisentinelpromise-gateflagidresolve`
- `#post-apisentinelpromise-gateflagidreject`

If any anchor fails to scroll to its heading, GitHub generated a different anchor than expected — record what GitHub generated, update the JSDoc `@see` references in `pending.ts` and `agent.ts` (and `audit-log.md` line 72) to match, and commit as a fix-up.

- [ ] **Step 6: Final whole-branch review**

Dispatch a code-quality review subagent with the full branch diff. Same pattern as #158 — the per-task review pass caught zero issues until the final whole-branch sweep, which found a stale WARNING line. This PR has more cross-cutting doc surface (3 source JSDoc files, 2 doc files, CLAUDE.md), so the final review is essential. Brief the reviewer: "Verify no stale URL references remain, all `@see` anchors point to existing headings, behavior is unchanged."

- [ ] **Step 7: Push and open PR**

```bash
git push -u origin refactor/sentinel-route-rename
gh pr create --title "refactor(sentinel): rename dual-cancel routes (#157)" --body "$(cat <<'EOF'
## Summary

- Rename three SENTINEL admin routes so URL names announce which state store they touch (closes #157)
- Delete the dual-cancel `WARNING` block in `docs/sentinel/rest-api.md` — the URL namespaces (`circuit-breaker/*` vs `promise-gate/*`) make the architectural distinction self-documenting
- `git mv` `pause-resume-routes.test.ts` → `promise-gate-routes.test.ts` to match the route namespace it exercises

## Route map

| Old | New |
|---|---|
| `POST /api/sentinel/pending/:id/cancel` | `POST /api/sentinel/circuit-breaker/:id/cancel` |
| `POST /api/sentinel/override/:flagId` | `POST /api/sentinel/promise-gate/:flagId/resolve` |
| `POST /api/sentinel/cancel/:flagId` | `POST /api/sentinel/promise-gate/:flagId/reject` |

Clean cut migration — no compatibility layer (same precedent as #158/PR #167). Behavior, status codes, error envelope, auth requirements all preserved. Frontend caller `SentinelConfirm.tsx` updated in the same PR.

## Test plan

- [x] `pnpm --filter @sipher/agent test -- --run` — 1300/104 passing (unchanged)
- [x] `pnpm --filter @sipher/app test -- --run` — 46/12 passing (unchanged)
- [x] `pnpm typecheck` — clean
- [x] Stale-reference grep returns zero hits across `*.ts`, `*.tsx`, `*.md` (excluding historical specs/plans)
- [x] Final whole-branch review (subagent dispatch) — no remaining drift
EOF
)"
```

---

## Test Count Summary

| Suite | Before | After | Delta |
|---|---|---|---|
| Agent (`@sipher/agent`) tests | 1300 | 1300 | 0 |
| Agent suites | 104 | 104 | 0 |
| App (`@sipher/app`) tests | 46 | 46 | 0 |
| App suites | 12 | 12 | 0 |

No new tests added. No tests removed. URL string changes only. CLAUDE.md test-count line stays at 1300/104.

---

## Files-Touched Summary

| Path | Type | Touched in task |
|---|---|---|
| `packages/agent/src/routes/sentinel-api.ts` | Modify | 1, 2, 3 |
| `packages/agent/src/sentinel/pending.ts` | Modify | 5 |
| `packages/agent/src/agent.ts` | Modify | 5 |
| `packages/agent/tests/sentinel/sentinel-api.test.ts` | Modify | 1 |
| `packages/agent/tests/sentinel/pause-resume-routes.test.ts` | Rename → `promise-gate-routes.test.ts` | 2, 3, 4 |
| `app/src/components/SentinelConfirm.tsx` | Modify | 6 |
| `app/src/components/__tests__/SentinelConfirm.test.tsx` | Modify | 6 |
| `docs/sentinel/rest-api.md` | Modify | 7 |
| `docs/sentinel/audit-log.md` | Modify | 8 |
| `CLAUDE.md` | Modify | 8 |
| `docs/superpowers/specs/2026-05-04-sentinel-route-rename-design.md` | Created on branch | (pre-existing in `4207286`) |
| `docs/superpowers/plans/2026-05-04-sentinel-route-rename.md` | This file | (committed alongside the spec or separately) |

10 source/doc files modified + 1 file renamed + 2 spec/plan docs.

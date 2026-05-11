# QA Sweep Tier 4 Wave 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Wave 2b of the QA sweep — 3 net-new "E2 Real" features (#216 demo mode, #217 unauthed activity teaser, #218 IP-rate-limited unauthed chat) plus a shared PR-0 foundation. Closes `qa-skill:1778399617` to zero open and flips the Phase D launch gate ✅.

**Architecture:** PR-0 foundation INLINE first — builds shared `lib/ip-rate-limit.ts` (createStore-backed) + `lib/cache.ts` + `/api/public/*` route prefix. Then 3 parallel SUBAGENT cluster PRs (F1/F2/F3) each consume the foundation and add their feature surface. 4 PRs total. Cross-cluster file coordination on `app/src/views/DashboardView.tsx` (F1 + F2 distinct sections) and `routes/public/index.ts` (append-only).

**Tech Stack:** Express 5, TypeScript, better-sqlite3, Pi SDK (`@mariozechner/pi-agent-core` + `pi-ai`), React 19, Vite 6, Tailwind 4, Vitest, react-router-dom@7, `@phosphor-icons/react`, `@sipher/sdk`.

**Predecessors:**
- Spec: `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-wave-2b-design.md` (committed at `d36ec75`)
- Wave 2a plan (reference for patterns): `docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-2a.md`

---

## Macro-task 1: Push spec + this plan to origin/main

- [ ] **Step 1.1: Stage this plan file**

```bash
cd ~/local-dev/sipher
git add docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-2b.md
git status --short
```
Expected: `A docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-2b.md`

- [ ] **Step 1.2: Commit**

```bash
git commit -m "docs(plan): add Wave 2b QA sweep implementation plan"
```

- [ ] **Step 1.3: Push to origin/main**

```bash
git push origin main
```
Expected: pushes both the spec commit (`d36ec75`) and the plan commit. Subsequent feature PRs will branch from this point so their diffs stay clean (cluster-only, no spec/plan churn).

---

## Macro-task 2: PR-0 Foundation INLINE (~2h)

**Branch:** `chore/wave-2b-foundation`
**Mode:** INLINE (this Claude session executes)
**Estimated:** ~2h
**Closes:** nothing (foundation; references in PR description "Foundation for Wave 2b #216/#217/#218")

### Task 2.1: Create branch + base setup

- [ ] **Step 2.1.1: Create + checkout branch**

```bash
cd ~/local-dev/sipher
git switch -c chore/wave-2b-foundation
git status
```
Expected: `On branch chore/wave-2b-foundation`, clean.

- [ ] **Step 2.1.2: Verify baseline test counts**

```bash
cd packages/agent && pnpm test --run 2>&1 | tail -5
```
Expected: agent baseline test count noted (≈1300 tests per project memory after PR #166 + envelope work).

```bash
cd ~/local-dev/sipher/app && pnpm test --run 2>&1 | tail -5
```
Expected: app baseline 518 tests (per session handoff Wave 2a final count).

### Task 2.2: Build `lib/ip-rate-limit.ts` — TDD

**Files:**
- Create: `packages/agent/src/lib/ip-rate-limit.ts`
- Test: `packages/agent/src/lib/__tests__/ip-rate-limit.test.ts`

- [ ] **Step 2.2.1: Write failing tests**

Write to `packages/agent/src/lib/__tests__/ip-rate-limit.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import {
  checkAndIncrement,
  ipRateLimitMiddleware,
  _resetForTests,
} from '../ip-rate-limit.js'

describe('checkAndIncrement', () => {
  beforeEach(async () => {
    await _resetForTests()
  })

  it('allows the first request and decrements remaining', async () => {
    const result = await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.cap).toBe(5)
    expect(result.resetAt).toBeGreaterThan(Date.now())
  })

  it('counts within the same window', async () => {
    await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    const r2 = await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    expect(r2.remaining).toBe(3)
  })

  it('returns allowed=false when cap exceeded', async () => {
    for (let i = 0; i < 5; i++) await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    const denied = await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    expect(denied.allowed).toBe(false)
    expect(denied.remaining).toBe(0)
  })

  it('isolates buckets per IP', async () => {
    await checkAndIncrement('1.1.1.1', 'demo', 5, 60_000)
    const r = await checkAndIncrement('2.2.2.2', 'demo', 5, 60_000)
    expect(r.remaining).toBe(4) // fresh bucket for new IP
  })

  it('isolates buckets per key for same IP', async () => {
    await checkAndIncrement('1.2.3.4', 'demo', 5, 60_000)
    const r = await checkAndIncrement('1.2.3.4', 'chat', 5, 60_000)
    expect(r.remaining).toBe(4) // fresh bucket for new key
  })

  it('resets the bucket after window expires', async () => {
    vi.useFakeTimers()
    await checkAndIncrement('1.2.3.4', 'demo', 1, 1_000)
    const denied = await checkAndIncrement('1.2.3.4', 'demo', 1, 1_000)
    expect(denied.allowed).toBe(false)
    vi.advanceTimersByTime(1_001)
    const fresh = await checkAndIncrement('1.2.3.4', 'demo', 1, 1_000)
    expect(fresh.allowed).toBe(true)
    expect(fresh.remaining).toBe(0)
    vi.useRealTimers()
  })
})

describe('ipRateLimitMiddleware', () => {
  beforeEach(async () => {
    await _resetForTests()
  })

  function makeApp(key: string, cap: number, windowMs: number) {
    const app = express()
    app.set('trust proxy', 1)
    app.get('/test', ipRateLimitMiddleware(key, cap, windowMs), (_req, res) => {
      res.json({ ok: true })
    })
    return app
  }

  it('sets X-RateLimit-* headers on success', async () => {
    const app = makeApp('demo', 5, 60_000)
    const res = await request(app).get('/test')
    expect(res.status).toBe(200)
    expect(res.headers['x-ratelimit-limit']).toBe('5')
    expect(res.headers['x-ratelimit-remaining']).toBe('4')
    expect(Number(res.headers['x-ratelimit-reset'])).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('returns 429 + RATE_LIMITED envelope on exceeded', async () => {
    const app = makeApp('demo', 1, 60_000)
    await request(app).get('/test') // consume the only slot
    const res = await request(app).get('/test')
    expect(res.status).toBe(429)
    expect(res.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: expect.stringMatching(/limit/i),
        resetAt: expect.any(Number),
      },
    })
  })

  it('honors X-Forwarded-For when trust proxy is set', async () => {
    const app = makeApp('demo', 1, 60_000)
    await request(app).get('/test').set('X-Forwarded-For', '5.5.5.5')
    const res = await request(app).get('/test').set('X-Forwarded-For', '6.6.6.6')
    // Different forwarded IP → fresh bucket → allowed
    expect(res.status).toBe(200)
    expect(res.headers['x-ratelimit-remaining']).toBe('0')
  })
})
```

- [ ] **Step 2.2.2: Run tests to verify they fail (no module yet)**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test --run src/lib/__tests__/ip-rate-limit.test.ts 2>&1 | tail -10
```
Expected: FAIL — `Cannot find module '../ip-rate-limit.js'` or similar.

- [ ] **Step 2.2.3: Implement the module**

Write to `packages/agent/src/lib/ip-rate-limit.ts`:

```ts
import type { Request, RequestHandler, Response, NextFunction } from 'express'
import { createStore } from '../state/ephemeral.js'

interface BucketState { count: number; resetAt: number }

const ipRateLimitStore = createStore<BucketState>('ipRateLimit', { maxSize: 10_000 })

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number  // epoch ms
  cap: number
}

/**
 * Per-(IP, key) sliding-window counter. Same IP can hit different keys
 * (e.g., 'demo' and 'chat') with independent budgets.
 */
export async function checkAndIncrement(
  ip: string,
  key: string,
  cap: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const bucketKey = `${ip}:${key}`
  const existing = await ipRateLimitStore.get(bucketKey)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    await ipRateLimitStore.set(bucketKey, { count: 1, resetAt }, Math.ceil(windowMs / 1000))
    return { allowed: true, remaining: cap - 1, resetAt, cap }
  }

  if (existing.count >= cap) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, cap }
  }

  const next: BucketState = { count: existing.count + 1, resetAt: existing.resetAt }
  const ttlSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  await ipRateLimitStore.set(bucketKey, next, ttlSeconds)
  return { allowed: true, remaining: cap - next.count, resetAt: existing.resetAt, cap }
}

/**
 * Express middleware. Sets X-RateLimit-* headers; returns 429 + envelope on exceeded.
 * Wraps `checkAndIncrement` and reads `req.ip` (Express trust-proxy is configured
 * upstream at index.ts:146-148).
 */
export function ipRateLimitMiddleware(key: string, cap: number, windowMs: number): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? 'unknown'
    const result = await checkAndIncrement(ip, key, cap, windowMs)
    res.setHeader('X-RateLimit-Limit', String(cap))
    res.setHeader('X-RateLimit-Remaining', String(result.remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)))

    if (!result.allowed) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit ${cap}/${Math.round(windowMs / 1000)}s exceeded`,
          resetAt: result.resetAt,
        },
      })
      return
    }
    next()
  }
}

/** Test helper. */
export async function _resetForTests(): Promise<void> {
  await ipRateLimitStore._clear()
}
```

- [ ] **Step 2.2.4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test --run src/lib/__tests__/ip-rate-limit.test.ts 2>&1 | tail -15
```
Expected: PASS, all 9 tests green.

- [ ] **Step 2.2.5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/lib/ip-rate-limit.ts packages/agent/src/lib/__tests__/ip-rate-limit.test.ts
git commit -m "feat(agent): add createStore-backed IP rate limiter"
```

### Task 2.3: Build `lib/cache.ts` — TDD

**Files:**
- Create: `packages/agent/src/lib/cache.ts`
- Test: `packages/agent/src/lib/__tests__/cache.test.ts`

- [ ] **Step 2.3.1: Write failing tests**

Write to `packages/agent/src/lib/__tests__/cache.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { getCached, setCached, _resetForTests } from '../cache.js'

describe('cache helpers', () => {
  beforeEach(async () => {
    await _resetForTests()
  })

  it('returns null for an unset key', async () => {
    const v = await getCached<{ x: number }>('missing')
    expect(v).toBeNull()
  })

  it('returns the value within TTL', async () => {
    await setCached('hit', { x: 42 }, 60)
    const v = await getCached<{ x: number }>('hit')
    expect(v).toEqual({ x: 42 })
  })

  it('returns null after TTL expires', async () => {
    vi.useFakeTimers()
    await setCached('expiring', { x: 1 }, 1)
    vi.advanceTimersByTime(1_500)
    const v = await getCached<{ x: number }>('expiring')
    expect(v).toBeNull()
    vi.useRealTimers()
  })

  it('overwrites the value on second set', async () => {
    await setCached('overwrite', { x: 1 }, 60)
    await setCached('overwrite', { x: 2 }, 60)
    const v = await getCached<{ x: number }>('overwrite')
    expect(v).toEqual({ x: 2 })
  })

  it('clears state via _resetForTests', async () => {
    await setCached('a', 1, 60)
    await _resetForTests()
    expect(await getCached('a')).toBeNull()
  })
})
```

- [ ] **Step 2.3.2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test --run src/lib/__tests__/cache.test.ts 2>&1 | tail -10
```
Expected: FAIL — `Cannot find module '../cache.js'`.

- [ ] **Step 2.3.3: Implement the module**

Write to `packages/agent/src/lib/cache.ts`:

```ts
import { createStore } from '../state/ephemeral.js'

const responseCache = createStore<unknown>('responseCache', { maxSize: 1_000 })

export async function getCached<T>(key: string): Promise<T | null> {
  return (await responseCache.get(key)) as T | null
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await responseCache.set(key, value, ttlSeconds)
}

/** Test helper. */
export async function _resetForTests(): Promise<void> {
  await responseCache._clear()
}
```

- [ ] **Step 2.3.4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test --run src/lib/__tests__/cache.test.ts 2>&1 | tail -10
```
Expected: PASS, 5 tests green.

- [ ] **Step 2.3.5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/lib/cache.ts packages/agent/src/lib/__tests__/cache.test.ts
git commit -m "feat(agent): add response cache helper"
```

### Task 2.4: Build `routes/public/index.ts` (publicRouter)

**Files:**
- Create: `packages/agent/src/routes/public/index.ts`
- Test: covered by integration in Task 2.6

- [ ] **Step 2.4.1: Write the file**

Write to `packages/agent/src/routes/public/index.ts`:

```ts
import { Router } from 'express'

/**
 * Public, unauthenticated routes mounted at /api/public.
 * Feature subagents (Wave 2b F1/F2/F3) extend this router by appending:
 *   import { demoRouter } from './demo.js'
 *   publicRouter.use('/demo', demoRouter)
 *
 * All sub-routers MUST apply ipRateLimitMiddleware with their own key/cap.
 */
export const publicRouter = Router()
```

- [ ] **Step 2.4.2: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/routes/public/index.ts
git commit -m "feat(agent): mount /api/public router prefix"
```

### Task 2.5: Build `lib/queries/public.ts` (stub types)

**Files:**
- Create: `packages/agent/src/lib/queries/public.ts`

- [ ] **Step 2.5.1: Write the file**

Write to `packages/agent/src/lib/queries/public.ts`:

```ts
/**
 * Shared types for public, unauthenticated /api/public/* responses.
 * Feature subagents extend this file with their feature-specific helpers.
 */

export interface DemoVault {
  wallet: string
  balances: { sol: number; tokens: unknown[]; status: string }
}

export interface DemoActivityRow {
  id: string
  agent: string
  type: string
  level: string
  title: string
  detail?: string | null
  created_at: string
}

export interface DemoPrivacyScore {
  score: number
  grade: string
  factors: {
    addressReuse: { score: number; detail: string }
    amountPatterns: { score: number; detail: string }
    timingCorrelation: { score: number; detail: string }
    counterpartyExposure: { score: number; detail: string }
  }
  recommendations: string[]
  transactionsAnalyzed: number
}

export type AmountBand = '<1' | '1-10' | '10-100' | '100-1000' | '>1000'

export interface AnonActivityRow {
  type: string
  chain: string
  amountBand: AmountBand
  relativeTime: string
}

export interface ActivitySummaryResponse {
  counter: number
  recent: AnonActivityRow[]
}
```

- [ ] **Step 2.5.2: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/lib/queries/public.ts
git commit -m "feat(agent): add public query types stub"
```

### Task 2.6: Mount publicRouter in `index.ts`

**Files:**
- Modify: `packages/agent/src/index.ts` (insert single import + single `app.use` line)
- Test: `packages/agent/src/__tests__/public-router-mount.test.ts` (NEW)

- [ ] **Step 2.6.1: Write failing integration test**

Write to `packages/agent/src/__tests__/public-router-mount.test.ts`:

```ts
import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import request from 'supertest'

// Lazy-import to mirror the agent's bootstrap pattern. We probe
// /api/public/_smoke (a probe route added below) to confirm publicRouter
// mounted at the right prefix.

describe('publicRouter mount point', () => {
  let app: import('express').Express

  beforeAll(async () => {
    const { publicRouter } = await import('../routes/public/index.js')
    publicRouter.get('/_smoke', (_req, res) => {
      res.json({ ok: true, mount: '/api/public' })
    })
    const express = (await import('express')).default
    app = express()
    app.set('trust proxy', 1)
    app.use('/api/public', publicRouter)
  })

  afterEach(() => {
    // Smoke route is added once for the whole suite; nothing to clean.
  })

  it('responds at /api/public/_smoke without auth', async () => {
    const res = await request(app).get('/api/public/_smoke')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, mount: '/api/public' })
  })

  it('returns 404 for unmounted /api/public/missing', async () => {
    const res = await request(app).get('/api/public/missing')
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2.6.2: Run test to verify it passes (smoke route in test file already)**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test --run src/__tests__/public-router-mount.test.ts 2>&1 | tail -10
```
Expected: PASS, 2 tests green. (No source change needed for the test alone — it constructs its own Express app.)

- [ ] **Step 2.6.3: Wire publicRouter into the main `index.ts`**

Read `packages/agent/src/index.ts` around line 180 to find an appropriate mount location (after CORS, before authed routers).

Apply this Edit:

```ts
// Find the line: import { vaultRouter } from './routes/vault-api.js'
// Add after the existing route imports:
import { publicRouter } from './routes/public/index.js'
```

And mount before the existing `app.use('/api/confirm', verifyJwt, confirmRouter)` line (around index.ts:193):

```ts
// Public, unauthenticated routes (rate-limited per IP).
// Used by /demo, /activity-summary, /chat (Wave 2b).
app.use('/api/public', publicRouter)
```

- [ ] **Step 2.6.4: Verify agent boots and ESM resolves correctly**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent build 2>&1 | tail -5
```
Expected: Build green. (No runtime smoke needed — production boot is verified at deploy time.)

- [ ] **Step 2.6.5: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/index.ts packages/agent/src/__tests__/public-router-mount.test.ts
git commit -m "feat(agent): wire publicRouter into agent index.ts"
```

### Task 2.7: Verify full test suite + push branch

- [ ] **Step 2.7.1: Run full agent test suite**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test --run 2>&1 | tail -10
```
Expected: All tests pass. Test count delta: baseline + 16 (9 ip-rate-limit + 5 cache + 2 public-router-mount).

- [ ] **Step 2.7.2: Typecheck**

```bash
cd ~/local-dev/sipher && pnpm --filter @sipher/agent exec tsc --noEmit 2>&1 | tail -5
```
Expected: No errors.

- [ ] **Step 2.7.3: Push branch and open PR**

```bash
cd ~/local-dev/sipher
git push -u origin chore/wave-2b-foundation
gh pr create --title "chore(agent): Wave 2b foundation — IP rate limiter + cache + /api/public/*" --body "$(cat <<'EOF'
## Summary

Foundation PR for Wave 2b (#216 demo mode, #217 activity teaser, #218 unauthed chat). No user-facing changes — sets up shared infrastructure that the 3 follow-up cluster PRs consume.

## What ships

- **`packages/agent/src/lib/ip-rate-limit.ts`** — \`createStore\`-backed per-(IP, key) sliding-window rate limiter. Forward-compat with the documented Redis swap path (same backend as \`verifyAttempts\` in routes/auth.ts).
  - \`checkAndIncrement(ip, key, cap, windowMs)\` returns \`{ allowed, remaining, resetAt, cap }\`
  - \`ipRateLimitMiddleware(key, cap, windowMs)\` Express middleware — sets X-RateLimit-* headers, returns 429 + \`{ error: { code: 'RATE_LIMITED', resetAt } }\` envelope on exceeded
- **\`packages/agent/src/lib/cache.ts\`** — tiny TTL-based response cache (createStore-backed) for upcoming GET \`/api/public/*\` cached responses.
- **\`packages/agent/src/routes/public/index.ts\`** — empty Express \`publicRouter\`, mounted at \`/api/public\`. Feature subagents append their sub-routers.
- **\`packages/agent/src/lib/queries/public.ts\`** — shared types for upcoming public response shapes.

## Tests

+16 agent tests:
- 9 ip-rate-limit cases (counter behavior, isolation per IP/key, window expiry, X-Forwarded-For honored, 429 envelope, X-RateLimit-* headers)
- 5 cache cases (set/get within TTL, expiry, overwrite, _resetForTests)
- 2 public-router mount cases

## Notes

- Trust proxy is already configured (\`packages/agent/src/index.ts:146-148\` reads \`TRUST_PROXY\` env, default 1) — middleware honors X-Forwarded-For out of the box.
- CORS configured upstream (\`CORS_ORIGINS\` env) — \`/api/public/*\` inherits, no special wiring needed.
- No user-facing routes ship in this PR — \`publicRouter\` stays empty until F1/F2/F3 land.

## References

- Spec: \`docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-wave-2b-design.md\`
- Plan: \`docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-2b.md\`
EOF
)"
```

- [ ] **Step 2.7.4: Wait for CI green**

```bash
cd ~/local-dev/sipher && gh pr checks --watch
```
Expected: CI green. If flaky, retry once before investigating.

- [ ] **Step 2.7.5: Merge PR-0**

```bash
cd ~/local-dev/sipher && git switch main
gh pr merge --merge --delete-branch
git pull --ff-only
```
Expected: Merge clean, main fast-forwards to PR-0 commit.

---

## Macro-task 3: Pre-dispatch (worktrees + sdk build)

- [ ] **Step 3.1: Create 3 worktrees from main (which now contains foundation)**

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/feat-demo-mode -b feat/demo-mode origin/main
git worktree add .worktrees/feat-activity-teaser -b feat/activity-teaser origin/main
git worktree add .worktrees/feat-unauthed-chat -b feat/unauthed-chat origin/main
git worktree list
```
Expected: 4 worktrees listed (main + 3 cluster).

- [ ] **Step 3.2: Install + build SDK in each worktree (3 parallel bg shells)**

Run 3 parallel `Bash` calls with `run_in_background=true`:

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode && pnpm install --frozen-lockfile && pnpm --filter "@sipher/sdk" build
```
```bash
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser && pnpm install --frozen-lockfile && pnpm --filter "@sipher/sdk" build
```
```bash
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat && pnpm install --frozen-lockfile && pnpm --filter "@sipher/sdk" build
```

Wait for all 3 to complete.

- [ ] **Step 3.3: Verify each worktree symlink + baseline**

```bash
for d in ~/local-dev/sipher/.worktrees/feat-demo-mode ~/local-dev/sipher/.worktrees/feat-activity-teaser ~/local-dev/sipher/.worktrees/feat-unauthed-chat; do
  test -e "$d/app/node_modules/@noble/ciphers" && echo "OK $d" || echo "FAIL $d"
done
```
Expected: 3 "OK" lines.

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode/app && pnpm test --run 2>&1 | tail -3
```
Expected: app baseline (`Tests  518 passed`) + tsc clean as in main.

---

## Cluster F1 — #216 Demo mode (subagent implementer prompt section)

**Branch:** `feat/demo-mode`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-demo-mode/`
**Issue:** #216
**Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-wave-2b-design.md` → "Cluster F1 — #216 Demo mode"
**Estimated:** 3-4h
**Convention:** Per-task TDD red→green→commit. Conventional commits with `feat(app)` / `feat(agent)` / `test(app)` / `test(agent)` scope.

**Out-of-scope guardrails (verbatim — DO NOT cross):**
- DON'T touch ChatSidebar (Cluster F3 territory).
- DON'T touch ActivityStreamTable empty state (Cluster F2 territory — F2 replaces it with `<UnauthedActivityFeed />`).
- DON'T add SSE for demo mode (D17 explicitly excludes SSE).
- DON'T extend demo coverage to non-Dashboard views.
- DON'T modify the IP rate limiter or cache helpers (PR-0 territory; F1 only consumes them).

**Cross-cluster file coordination:**
- `app/src/views/DashboardView.tsx` is also being modified by **Cluster F2 in parallel**. Your changes are in the **PrivacyGraph slot section** (adding `<DemoCtaCard />`). F2's changes are in the **ActivityStreamTable slot section** (replacing the empty table with `<UnauthedActivityFeed />`). Do not touch the ActivityStreamTable slot — trust that the merge will compose cleanly.
- `app/src/views/__tests__/DashboardView.test.tsx` likewise: F1 adds DemoCtaCard tests in a new `describe` block; F2 adds UnauthedActivityFeed tests in their own `describe`. Distinct setup.
- `routes/public/index.ts` — append-only: add `import { demoRouter } from './demo.js'` + `publicRouter.use('/demo', demoRouter)`. No clash with F2/F3's similar appends.

### Task F1.1: Backend — `routes/public/demo.ts`

**Files:**
- Create: `packages/agent/src/routes/public/demo.ts`
- Modify: `packages/agent/src/routes/public/index.ts` (append imports + mount)
- Modify: `packages/agent/src/lib/queries/public.ts` (extend with `getDemoVault`, `getDemoActivity`, `getDemoPrivacyScore` helpers IF needed; subagent investigates)
- Test: `packages/agent/src/routes/public/__tests__/demo.test.ts`

**Service-reuse strategy (subagent investigates + documents in PR description):**

The 3 demo routes need to return the same shapes as their authed counterparts:
- `/api/vault` → handler at `packages/agent/src/routes/vault-api.ts:36-` (computes SOL + token balances + activity for the wallet attached by JWT)
- `/api/activity` → inline at `packages/agent/src/index.ts:224-232` (calls `getActivity(wallet)` from db.ts)
- `/v1/privacy/score` → Mode 2 REST API (built separately to `dist/app.js`); the underlying privacy-score logic lives in `packages/agent/src/tools/privacy-score.ts`

**Pick ONE strategy and apply consistently:**
- **Strategy A (preferred):** Factor the wallet-balance + activity + privacy-score logic into pure service functions in `packages/agent/src/services/wallet-data.ts` (NEW). Both authed routes (existing) and demo routes (new) call them. DRY. Refactors authed code paths.
- **Strategy B (lighter touch):** New `routes/public/demo.ts` re-implements the queries directly using the same primitives (`createConnection`, `getActivity`, `executePrivacyScore`). Some duplication but no refactor of existing routes.

Strategy A is cleaner long-term. Strategy B is safer (smaller blast radius on existing routes). **Pick whichever you can complete cleanly within the time budget; document your choice in the PR description.**

- [ ] **Step F1.1.1: Write failing tests**

Write to `packages/agent/src/routes/public/__tests__/demo.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { _resetForTests as resetIpRateLimit } from '../../../lib/ip-rate-limit.js'
import { _resetForTests as resetCache } from '../../../lib/cache.js'

describe('/api/public/demo/*', () => {
  let app: express.Express

  beforeEach(async () => {
    await resetIpRateLimit()
    await resetCache()
    process.env.DEMO_WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'
    const { publicRouter } = await import('../../public/index.js')
    app = express()
    app.set('trust proxy', 1)
    app.use('/api/public', publicRouter)
  })

  afterEach(() => {
    delete process.env.DEMO_WALLET
  })

  describe('GET /vault', () => {
    it('returns demo wallet vault shape', async () => {
      const res = await request(app).get('/api/public/demo/vault')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
        balances: expect.objectContaining({
          sol: expect.any(Number),
          tokens: expect.any(Array),
          status: expect.any(String),
        }),
      })
    })

    it('returns cached payload on 2nd call within 60s (mock service called once)', async () => {
      // Subagent: spy on whichever service function /vault calls internally;
      // assert it's called once across two requests.
      const res1 = await request(app).get('/api/public/demo/vault')
      const res2 = await request(app).get('/api/public/demo/vault')
      expect(res1.body).toEqual(res2.body)
      // Service-call-count assertion goes here once subagent picks Strategy A or B.
    })

    it('returns 503 when DEMO_WALLET env unset', async () => {
      delete process.env.DEMO_WALLET
      const res = await request(app).get('/api/public/demo/vault')
      expect(res.status).toBe(503)
      expect(res.body).toEqual({
        error: { code: 'UNAVAILABLE', message: expect.stringMatching(/demo/i) },
      })
    })
  })

  describe('GET /activity', () => {
    it('returns demo wallet activity shape', async () => {
      const res = await request(app).get('/api/public/demo/activity')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({
        activity: expect.any(Array),
      })
    })
  })

  describe('GET /privacy-score', () => {
    it('returns demo wallet privacy score shape', async () => {
      const res = await request(app).get('/api/public/demo/privacy-score')
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({
        score: expect.any(Number),
        grade: expect.any(String),
        factors: expect.objectContaining({
          addressReuse: expect.any(Object),
          amountPatterns: expect.any(Object),
          timingCorrelation: expect.any(Object),
          counterpartyExposure: expect.any(Object),
        }),
      })
    })
  })

  describe('rate limiting', () => {
    it('returns 429 after 60 requests in <1min', async () => {
      for (let i = 0; i < 60; i++) await request(app).get('/api/public/demo/vault')
      const res = await request(app).get('/api/public/demo/vault')
      expect(res.status).toBe(429)
      expect(res.body.error.code).toBe('RATE_LIMITED')
    })
  })
})
```

- [ ] **Step F1.1.2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode && pnpm --filter @sipher/agent test --run src/routes/public/__tests__/demo.test.ts 2>&1 | tail -15
```
Expected: FAIL.

- [ ] **Step F1.1.3: Implement `routes/public/demo.ts`**

Subagent:
1. Pick Strategy A or B per the service-reuse note above.
2. Create `packages/agent/src/routes/public/demo.ts` that exports `demoRouter` mounting 3 GETs: `/vault`, `/activity`, `/privacy-score`.
3. Each route applies `ipRateLimitMiddleware('demo', 60, 60_000)`.
4. Each route checks `process.env.DEMO_WALLET` — if unset, returns 503 + `{ error: { code: 'UNAVAILABLE', message: 'Demo mode disabled' } }`.
5. Each route does cache lookup via `getCached('public-demo-vault')` etc, computes if miss, sets via `setCached(key, val, 60)`.
6. Document Strategy choice in this commit's body.

- [ ] **Step F1.1.4: Wire into `routes/public/index.ts`**

Append:
```ts
import { demoRouter } from './demo.js'
publicRouter.use('/demo', demoRouter)
```

- [ ] **Step F1.1.5: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode && pnpm --filter @sipher/agent test --run src/routes/public/__tests__/demo.test.ts 2>&1 | tail -10
```
Expected: PASS, all 6 tests green.

- [ ] **Step F1.1.6: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode
git add packages/agent/src/routes/public/demo.ts packages/agent/src/routes/public/__tests__/demo.test.ts packages/agent/src/routes/public/index.ts packages/agent/src/lib/queries/public.ts
git commit -m "feat(agent): add /api/public/demo/* routes for #216

- Strategy {A|B} (subagent fills in)
- 60s in-memory cache via lib/cache
- Rate-limited 60/IP/min via lib/ip-rate-limit
- 503 + UNAVAILABLE when DEMO_WALLET env unset"
```

### Task F1.2: Frontend — `<DemoView />`

**Files:**
- Create: `app/src/views/DemoView.tsx`
- Test: `app/src/views/__tests__/DemoView.test.tsx`

- [ ] **Step F1.2.1: Write failing tests**

Write to `app/src/views/__tests__/DemoView.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DemoView from '../DemoView'
import { useAuthState } from '../../hooks/useAuthState'

vi.mock('../../hooks/useAuthState')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseAuth = vi.mocked(useAuthState)

beforeEach(() => {
  mockUseAuth.mockReturnValue({ status: 'unauthed', token: null, publicKey: null } as ReturnType<typeof useAuthState>)
  mockNavigate.mockReset()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ wallet: 'FGSkt...', balances: { sol: 1.5, tokens: [], status: 'ok' } }),
  } as Response)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('<DemoView />', () => {
  it('renders banner with Demo mode + both CTA buttons', async () => {
    render(<MemoryRouter><DemoView /></MemoryRouter>)
    expect(await screen.findByText(/demo mode/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /exit demo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('exit-demo button navigates to /', () => {
    render(<MemoryRouter><DemoView /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /exit demo/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('auto-redirects to / when status changes to authed', async () => {
    const { rerender } = render(<MemoryRouter><DemoView /></MemoryRouter>)
    mockUseAuth.mockReturnValue({ status: 'authed', token: 'tok', publicKey: 'pk' } as ReturnType<typeof useAuthState>)
    rerender(<MemoryRouter><DemoView /></MemoryRouter>)
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('fetches /api/public/demo/* without Authorization header', async () => {
    render(<MemoryRouter><DemoView /></MemoryRouter>)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    for (const [, init] of calls) {
      const headers = (init as RequestInit | undefined)?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toBeUndefined()
      expect(headers?.authorization).toBeUndefined()
    }
  })
})
```

- [ ] **Step F1.2.2: Run tests to verify they fail**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode/app && pnpm test --run src/views/__tests__/DemoView.test.tsx 2>&1 | tail -10
```
Expected: FAIL — file does not exist.

- [ ] **Step F1.2.3: Implement `DemoView.tsx`**

Subagent:
1. Create `app/src/views/DemoView.tsx`.
2. Use existing `<DashboardView />` as a structural reference for layout (PrivacyGraph + cards + ActivityStreamTable).
3. Banner at top with "Demo mode" copy + 2 CTA buttons:
   - Exit demo → `useNavigate()('/')`
   - Connect wallet → trigger existing wallet modal opener (subagent finds the pattern in App shell)
4. Data fetches via `fetch()` (NOT `apiFetch` — public endpoints don't go through token-injecting client). 3 calls in parallel: `/api/public/demo/{vault,activity,privacy-score}`.
5. `useEffect`: when `useAuthState().status === 'authed'`, `navigate('/')`.
6. Sidebar HIDDEN — wrap return in a layout-bypassing container (subagent investigates how the existing App shell renders the sidebar; either render DemoView OUTSIDE the sidebar shell, or pass a flag to the shell).
7. Renders existing `<PrivacyGraph>`, `<PrivacyScoreCard>`, `<ShieldedVolumeCard>`, `<MultiChainVaultGrid>`, `<ActivityStreamTable>` components.
8. Action CTAs in MultiChainVaultGrid disabled with title="Connect wallet to use SIPHER for real" — subagent investigates whether MultiChainVaultGrid accepts a `disabled` prop or needs one added (small extension).

- [ ] **Step F1.2.4: Run tests to verify they pass**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode/app && pnpm test --run src/views/__tests__/DemoView.test.tsx 2>&1 | tail -10
```
Expected: PASS, 4 tests green.

- [ ] **Step F1.2.5: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode
git add app/src/views/DemoView.tsx app/src/views/__tests__/DemoView.test.tsx
git commit -m "feat(app): add DemoView for #216 read-only demo mode"
```

### Task F1.3: Frontend — `<DemoCtaCard />`

**Files:**
- Create: `app/src/components/DemoCtaCard.tsx`
- Test: `app/src/components/__tests__/DemoCtaCard.test.tsx`

- [ ] **Step F1.3.1: Write failing tests**

Write to `app/src/components/__tests__/DemoCtaCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DemoCtaCard from '../DemoCtaCard'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('<DemoCtaCard />', () => {
  it('renders CTA copy', () => {
    render(<MemoryRouter><DemoCtaCard /></MemoryRouter>)
    expect(screen.getByText(/curious how it looks populated/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view sample dashboard/i })).toBeInTheDocument()
  })

  it('navigates to /demo on CTA click', () => {
    mockNavigate.mockReset()
    render(<MemoryRouter><DemoCtaCard /></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: /view sample dashboard/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/demo')
  })
})
```

- [ ] **Step F1.3.2: Run tests to verify they fail**

Expected: FAIL — module not found.

- [ ] **Step F1.3.3: Implement `DemoCtaCard.tsx`**

Write to `app/src/components/DemoCtaCard.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'

export default function DemoCtaCard() {
  const navigate = useNavigate()
  return (
    <div className="rounded-lg border border-border bg-card/60 p-6 text-center">
      <p className="text-sm text-text-muted mb-3">Curious how it looks populated?</p>
      <a
        role="link"
        onClick={(e) => { e.preventDefault(); navigate('/demo') }}
        href="/demo"
        className="inline-flex items-center gap-1 text-accent text-sm font-medium hover:underline cursor-pointer"
      >
        View sample dashboard →
      </a>
    </div>
  )
}
```

- [ ] **Step F1.3.4: Run tests to verify they pass**

Expected: PASS, 2 tests green.

- [ ] **Step F1.3.5: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode
git add app/src/components/DemoCtaCard.tsx app/src/components/__tests__/DemoCtaCard.test.tsx
git commit -m "feat(app): add DemoCtaCard for unauthed Dashboard CTA"
```

### Task F1.4: Frontend — wire `<DemoCtaCard />` into unauthed Dashboard + register `/demo` route

**Files:**
- Modify: `app/src/views/DashboardView.tsx` (add `<DemoCtaCard />` near PrivacyGraph slot, gated on `status !== 'authed'`)
- Modify: `app/src/views/__tests__/DashboardView.test.tsx` (add new `describe` block for DemoCtaCard tests)
- Modify: `app/src/App.tsx` (register `/demo` route)
- Test: `app/src/__tests__/App.test.tsx` (add /demo route test if not present)

- [ ] **Step F1.4.1: Write failing test in DashboardView.test.tsx**

Add a new `describe('Demo CTA (unauthed)', ...)` block:

```tsx
describe('Demo CTA (unauthed)', () => {
  it('renders DemoCtaCard when status !== authed', () => {
    render(/* existing unauthed setup */)
    expect(screen.getByRole('link', { name: /view sample dashboard/i })).toBeInTheDocument()
  })

  it('does NOT render DemoCtaCard when authed', () => {
    render(/* existing authed setup */)
    expect(screen.queryByRole('link', { name: /view sample dashboard/i })).toBeNull()
  })
})
```

(Subagent: match the existing test setup pattern in DashboardView.test.tsx for unauthed/authed mocks.)

- [ ] **Step F1.4.2: Run test, expect FAIL**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode/app && pnpm test --run src/views/__tests__/DashboardView.test.tsx -t "Demo CTA" 2>&1 | tail -10
```
Expected: FAIL.

- [ ] **Step F1.4.3: Add `<DemoCtaCard />` to DashboardView**

Edit `app/src/views/DashboardView.tsx`:
- Import `DemoCtaCard`.
- In the unauthed branch (`status !== 'authed'`), render `<DemoCtaCard />` near the empty PrivacyGraph slot. Suggested placement: between the tagline and `<PrivacyGraph />` so the CTA reads naturally as "you're seeing nothing → here's something to look at".

**Coordination note:** Do not modify the ActivityStreamTable section — Cluster F2 owns that.

- [ ] **Step F1.4.4: Run test, expect PASS**

Expected: PASS.

- [ ] **Step F1.4.5: Add `/demo` route to App.tsx**

Read `app/src/App.tsx` to find the routes section. Add:

```tsx
<Route path="/demo" element={<DemoView />} />
```

Add the import for `DemoView` at top.

- [ ] **Step F1.4.6: Add or extend App test for /demo route**

If `app/src/__tests__/App.test.tsx` exists, add a test case verifying `/demo` mounts DemoView. If not, create the test file.

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'

describe('App routing', () => {
  it('mounts DemoView at /demo', () => {
    render(<MemoryRouter initialEntries={['/demo']}><App /></MemoryRouter>)
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
  })
})
```

(Subagent: adjust based on existing App test structure — may need to mock providers.)

- [ ] **Step F1.4.7: Run all impacted tests + typecheck**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode/app
pnpm test --run src/views/__tests__/DashboardView.test.tsx src/__tests__/App.test.tsx 2>&1 | tail -10
pnpm exec tsc --noEmit 2>&1 | tail -5
```
Expected: PASS + tsc clean.

- [ ] **Step F1.4.8: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode
git add app/src/views/DashboardView.tsx app/src/views/__tests__/DashboardView.test.tsx app/src/App.tsx app/src/__tests__/App.test.tsx
git commit -m "feat(app): wire DemoCtaCard + /demo route for #216"
```

### Task F1.5: Final verification + push branch

- [ ] **Step F1.5.1: Run full app test suite**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode/app && pnpm test --run 2>&1 | tail -10
```
Expected: All app tests pass. Test count delta noted.

- [ ] **Step F1.5.2: Run full agent test suite**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode && pnpm --filter @sipher/agent test --run 2>&1 | tail -10
```
Expected: All agent tests pass. +6 tests from demo.test.ts.

- [ ] **Step F1.5.3: Typecheck both**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode/app && pnpm exec tsc --noEmit
cd ~/local-dev/sipher/.worktrees/feat-demo-mode && pnpm --filter @sipher/agent exec tsc --noEmit
```
Expected: clean.

- [ ] **Step F1.5.4: Push branch**

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode
git push -u origin feat/demo-mode
```

(PR creation deferred to dispatcher's two-stage review pipeline.)

---

## Cluster F2 — #217 Unauthed activity teaser (subagent implementer prompt section)

**Branch:** `feat/activity-teaser`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-activity-teaser/`
**Issue:** #217
**Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-wave-2b-design.md` → "Cluster F2 — #217 Unauthed activity teaser"
**Estimated:** 2-3h

**Out-of-scope guardrails:**
- DON'T touch DemoView/DemoCtaCard (Cluster F1 territory).
- DON'T touch ChatSidebar (Cluster F3 territory).
- DON'T add SSE for activity stream (D19 explicitly chose periodic poll).
- DON'T expose sender, recipient, exact amount, or transaction hash.
- DON'T modify the IP rate limiter or cache helpers (PR-0 only).

**Cross-cluster file coordination:**
- `app/src/views/DashboardView.tsx` is also being modified by **Cluster F1 in parallel**. Your changes are in the **ActivityStreamTable slot section** (replacing the empty `<ActivityStreamTable rows={[]} />` with `<UnauthedActivityFeed />`). F1's changes are in the **PrivacyGraph slot section**. Do not touch the PrivacyGraph slot.
- `routes/public/index.ts` — append-only.

### Task F2.1: Backend — `routes/public/activity-summary.ts`

**Files:**
- Create: `packages/agent/src/routes/public/activity-summary.ts`
- Modify: `packages/agent/src/routes/public/index.ts` (append imports + mount)
- Modify: `packages/agent/src/lib/queries/public.ts` (extend with `getActivitySummary` helper if needed)
- Test: `packages/agent/src/routes/public/__tests__/activity-summary.test.ts`

- [ ] **Step F2.1.1: Write failing tests**

Write to `packages/agent/src/routes/public/__tests__/activity-summary.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { _resetForTests as resetIpRateLimit } from '../../../lib/ip-rate-limit.js'
import { _resetForTests as resetCache } from '../../../lib/cache.js'

describe('/api/public/activity-summary', () => {
  let app: express.Express

  beforeEach(async () => {
    await resetIpRateLimit()
    await resetCache()
    const { publicRouter } = await import('../../public/index.js')
    app = express()
    app.set('trust proxy', 1)
    app.use('/api/public', publicRouter)
  })

  it('returns counter + recent rows shape', async () => {
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      counter: expect.any(Number),
      recent: expect.any(Array),
    })
  })

  it('recent rows have only the anonymized fields', async () => {
    const res = await request(app).get('/api/public/activity-summary')
    for (const row of res.body.recent) {
      expect(Object.keys(row).sort()).toEqual(['amountBand', 'chain', 'relativeTime', 'type'])
      expect(['<1', '1-10', '10-100', '100-1000', '>1000']).toContain(row.amountBand)
    }
  })

  it('caches response within 60s window', async () => {
    const res1 = await request(app).get('/api/public/activity-summary')
    const res2 = await request(app).get('/api/public/activity-summary')
    expect(res2.body).toEqual(res1.body)
  })

  it('rate-limited at 120 req/min/IP', async () => {
    for (let i = 0; i < 120; i++) await request(app).get('/api/public/activity-summary')
    const res = await request(app).get('/api/public/activity-summary')
    expect(res.status).toBe(429)
  })

  it('amount band buckets work as documented', async () => {
    // Subagent: this test exercises the amount-band helper directly.
    // Move helper to lib/queries/public.ts or wherever convenient + import.
    const { toAmountBand } = await import('../../../lib/queries/public.js')
    expect(toAmountBand(0.5)).toBe('<1')
    expect(toAmountBand(5)).toBe('1-10')
    expect(toAmountBand(50)).toBe('10-100')
    expect(toAmountBand(500)).toBe('100-1000')
    expect(toAmountBand(5_000)).toBe('>1000')
  })
})
```

- [ ] **Step F2.1.2: Run tests to verify they fail**

Expected: FAIL.

- [ ] **Step F2.1.3: Implement `routes/public/activity-summary.ts` + `toAmountBand` helper**

Subagent:
1. In `lib/queries/public.ts`, add:
   ```ts
   export function toAmountBand(amount: number): AmountBand {
     if (amount < 1) return '<1'
     if (amount < 10) return '1-10'
     if (amount < 100) return '10-100'
     if (amount < 1000) return '100-1000'
     return '>1000'
   }

   export function relativeTime(createdAt: string): string {
     const now = Date.now()
     const ts = new Date(createdAt).getTime()
     const diffMs = now - ts
     const min = Math.floor(diffMs / 60_000)
     if (min < 1) return 'just now'
     if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
     const hrs = Math.floor(min / 60)
     if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
     const days = Math.floor(hrs / 24)
     return `${days} day${days === 1 ? '' : 's'} ago`
   }
   ```
2. Create `packages/agent/src/routes/public/activity-summary.ts`:
   - Mount `GET /` on `activitySummaryRouter`.
   - Apply `ipRateLimitMiddleware('activity-summary', 120, 60_000)`.
   - Cache lookup at `'public-activity-summary'`, 60s TTL.
   - On miss:
     - Compute counter via `db.prepare('SELECT COUNT(*) AS n FROM activity_stream WHERE type LIKE ? OR type LIKE ?').get('%.success', '%.completed').n` (use existing `getDb()` from `db.js`).
     - Get recent: call existing `getActivity(null, { limit: 5 })` from `db.js` (reads across all wallets — exactly what we want for ecosystem-wide teaser).
     - Transform each row: extract `chain` from parsed `detail` (fallback `'solana'`), bucket `detail.amount` via `toAmountBand`, format `relativeTime(created_at)`.
     - **Defensive parse:** the `detail` column is stored as JSON-serialized string in the DB. Use try/catch: `let parsed = {} as Record<string, unknown>; try { parsed = typeof row.detail === 'string' ? JSON.parse(row.detail) : (row.detail ?? {}) } catch {}`.
     - Strip `id`, `wallet`, `agent`, `level`, `created_at`, original `detail` from output — only return `{ type, chain, amountBand, relativeTime }`.
3. Wire into `routes/public/index.ts`:
   ```ts
   import { activitySummaryRouter } from './activity-summary.js'
   publicRouter.use('/activity-summary', activitySummaryRouter)
   ```

- [ ] **Step F2.1.4: Run tests to verify they pass**

Expected: PASS, 5 tests green.

- [ ] **Step F2.1.5: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser
git add packages/agent/src/routes/public/activity-summary.ts packages/agent/src/routes/public/__tests__/activity-summary.test.ts packages/agent/src/routes/public/index.ts packages/agent/src/lib/queries/public.ts
git commit -m "feat(agent): add /api/public/activity-summary for #217

- Counter + 5 most-recent rows (anonymized type+chain+amountBand+relativeTime)
- Defensive JSON.parse on activity_stream.detail (stored as string)
- 60s cache, 120 req/min/IP rate limit"
```

### Task F2.2: Frontend — `<UnauthedActivityFeed />`

**Files:**
- Create: `app/src/components/UnauthedActivityFeed.tsx`
- Test: `app/src/components/__tests__/UnauthedActivityFeed.test.tsx`

- [ ] **Step F2.2.1: Write failing tests**

Write to `app/src/components/__tests__/UnauthedActivityFeed.test.tsx`:

```tsx
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import UnauthedActivityFeed from '../UnauthedActivityFeed'

beforeEach(() => {
  vi.useFakeTimers()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      counter: 12345,
      recent: [
        { type: 'send.success', chain: 'solana', amountBand: '1-10', relativeTime: '3 minutes ago' },
        { type: 'swap.success', chain: 'solana', amountBand: '10-100', relativeTime: '8 minutes ago' },
      ],
    }),
  } as Response)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('<UnauthedActivityFeed />', () => {
  it('renders skeleton during initial load', () => {
    render(<UnauthedActivityFeed />)
    expect(screen.getByTestId('activity-feed-skeleton')).toBeInTheDocument()
  })

  it('renders counter + recent rows after fetch', async () => {
    render(<UnauthedActivityFeed />)
    await waitFor(() => expect(screen.getByText(/12,345/)).toBeInTheDocument())
    expect(screen.getByText(/3 minutes ago/)).toBeInTheDocument()
    expect(screen.getByText(/swap.success/i)).toBeInTheDocument()
  })

  it('does not poll when document.visibilityState is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    render(<UnauthedActivityFeed />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1)) // initial fetch on mount
    vi.advanceTimersByTime(60_000)
    await Promise.resolve()
    expect(global.fetch).toHaveBeenCalledTimes(1) // no poll
  })

  it('polls every 60s when visible', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    render(<UnauthedActivityFeed />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    vi.advanceTimersByTime(60_000)
    await Promise.resolve()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('renders graceful empty-state on fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))
    render(<UnauthedActivityFeed />)
    await waitFor(() => expect(screen.getByText(/live activity unavailable/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step F2.2.2: Run tests, expect FAIL**

Expected: FAIL — module not found.

- [ ] **Step F2.2.3: Implement `UnauthedActivityFeed.tsx`**

Subagent: standard React component with `useState({counter, recent}) | null`, `useEffect` to fetch on mount + setInterval(60s) gated on visibilityState. AbortController on unmount. Skeleton during initial load (`data-testid="activity-feed-skeleton"`). Renders counter formatted with `.toLocaleString()` + 5 rows with type+chain badge+amount band+relativeTime. On fetch error, shows "Live activity unavailable" copy.

- [ ] **Step F2.2.4: Run tests, expect PASS**

Expected: PASS, 5 tests green.

- [ ] **Step F2.2.5: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser
git add app/src/components/UnauthedActivityFeed.tsx app/src/components/__tests__/UnauthedActivityFeed.test.tsx
git commit -m "feat(app): add UnauthedActivityFeed for #217"
```

### Task F2.3: Wire `<UnauthedActivityFeed />` into unauthed Dashboard

**Files:**
- Modify: `app/src/views/DashboardView.tsx` (replace empty ActivityStreamTable with `<UnauthedActivityFeed />` in unauthed branch only)
- Modify: `app/src/views/__tests__/DashboardView.test.tsx` (add new `describe` block — separate from F1's DemoCtaCard block)

- [ ] **Step F2.3.1: Write failing tests**

Add a new `describe('Unauthed activity teaser', ...)` block in DashboardView.test.tsx:

```tsx
describe('Unauthed activity teaser', () => {
  it('renders <UnauthedActivityFeed /> when status !== authed', () => {
    render(/* unauthed setup */)
    expect(screen.getByTestId('activity-feed-skeleton')).toBeInTheDocument()
  })

  it('renders <ActivityStreamTable /> when authed (existing behavior)', () => {
    render(/* authed setup */)
    expect(screen.queryByTestId('activity-feed-skeleton')).toBeNull()
    expect(screen.getByTestId('activity-stream-table')).toBeInTheDocument() // assuming existing test-id
  })
})
```

(Subagent: confirm `data-testid` on `<ActivityStreamTable>`; if not present, add it to make tests assertable.)

- [ ] **Step F2.3.2: Edit DashboardView.tsx — branch on auth in the ActivityStream slot only**

Replace:
```tsx
<ActivityStreamTable rows={allRows} />
```

With:
```tsx
{status === 'authed' ? (
  <ActivityStreamTable rows={allRows} />
) : (
  <UnauthedActivityFeed />
)}
```

Add `import UnauthedActivityFeed from '../components/UnauthedActivityFeed'` at top.

**Coordination note:** Do NOT touch the PrivacyGraph slot — Cluster F1 owns that.

- [ ] **Step F2.3.3: Run tests, expect PASS**

Expected: PASS.

- [ ] **Step F2.3.4: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser
git add app/src/views/DashboardView.tsx app/src/views/__tests__/DashboardView.test.tsx app/src/components/ActivityStreamTable.tsx
git commit -m "feat(app): wire UnauthedActivityFeed into Dashboard for #217"
```

(Last file in `git add` only if subagent added a `data-testid` to ActivityStreamTable — drop if not.)

### Task F2.4: Final verification + push branch

- [ ] **Step F2.4.1: Run full app + agent test suites**

```bash
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser/app && pnpm test --run 2>&1 | tail -10
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser && pnpm --filter @sipher/agent test --run 2>&1 | tail -10
```
Expected: all green.

- [ ] **Step F2.4.2: Typecheck**

```bash
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser/app && pnpm exec tsc --noEmit
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser && pnpm --filter @sipher/agent exec tsc --noEmit
```
Expected: clean.

- [ ] **Step F2.4.3: Push branch**

```bash
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser
git push -u origin feat/activity-teaser
```

---

## Cluster F3 — #218 Unauthed Ask SIPHER (subagent implementer prompt section)

**Branch:** `feat/unauthed-chat`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-unauthed-chat/`
**Issue:** #218
**Spec section:** `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-wave-2b-design.md` → "Cluster F3 — #218 Unauthed Ask SIPHER"
**Estimated:** 4-5h

**Out-of-scope guardrails:**
- DON'T touch DemoView/DemoCtaCard or DashboardView's PrivacyGraph slot (Cluster F1).
- DON'T touch UnauthedActivityFeed or DashboardView's ActivityStreamTable slot (Cluster F2).
- DON'T modify the IP rate limiter, cache helpers, or trust-proxy config (PR-0).
- DON'T add captcha, content classification, or auto-ban (out of scope per D20).
- DON'T enable any tools in unauthed mode.
- DON'T add a token-level cost cap (message-cap is the v1 control per D20).

### Task F3.1: Backend — `routes/public/chat.ts`

**Files:**
- Create: `packages/agent/src/routes/public/chat.ts`
- Modify: `packages/agent/src/routes/public/index.ts` (append imports + mount)
- Test: `packages/agent/src/routes/public/__tests__/chat.test.ts`

**Investigation step (subagent must do BEFORE implementing):**

The existing authed chat endpoint is `app.post('/api/chat/stream', verifyJwt, …)` at `index.ts:256-262`, which delegates to `webAdapter.handleChatStream(req, res)`. The Pi SDK chat loop lives in `packages/agent/src/agent.ts` (`chatStream` async generator). Subagent reads:
- `packages/agent/src/agent.ts` lines 200-400 to understand the SSE event shape
- `packages/agent/src/core/agent-core.ts` lines 60-160 to understand how the AgentCore wraps `chatStream`
- `packages/agent/src/adapters/web.ts` (or wherever `webAdapter` lives) to understand the request/response wiring

**Goal of investigation:** find the cleanest hook point to invoke `chatStream` with **no tools + a custom system prompt**. Likely options:
- A: Call `chatStream` directly with explicit `tools: []` and `systemPrompt: UNAUTHED_SYSTEM_PROMPT` overrides
- B: Build a minimal `unauthedChatStream` async generator that mirrors `chatStream` but skips tool/sentinel/wallet bindings
- C: Use AgentCore with a configured tool-less + restricted-system-prompt agent profile

Subagent picks the strategy with the smallest blast radius and documents in PR description.

- [ ] **Step F3.1.1: Write failing tests**

Write to `packages/agent/src/routes/public/__tests__/chat.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { _resetForTests as resetIpRateLimit } from '../../../lib/ip-rate-limit.js'

describe('/api/public/chat/stream', () => {
  let app: express.Express

  beforeEach(async () => {
    await resetIpRateLimit()
    const { publicRouter } = await import('../../public/index.js')
    app = express()
    app.set('trust proxy', 1)
    app.use(express.json())
    app.use('/api/public', publicRouter)
  })

  it('returns SSE stream on valid POST', async () => {
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'What is a stealth address?' }] })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
  })

  it('emits X-RateLimit-* headers', async () => {
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'hello' }] })
    expect(res.headers['x-ratelimit-limit']).toBe('5')
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0)
    expect(res.headers['x-ratelimit-reset']).toBeDefined()
  })

  it('returns 429 + RATE_LIMITED envelope after 5 requests in 24h', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/public/chat/stream')
        .send({ messages: [{ role: 'user', content: 'q' }] })
    }
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'q' }] })
    expect(res.status).toBe(429)
    expect(res.body).toEqual({
      error: { code: 'RATE_LIMITED', message: expect.any(String), resetAt: expect.any(Number) },
    })
  })

  it('different IPs have independent budgets', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/public/chat/stream')
        .send({ messages: [{ role: 'user', content: 'q' }] })
        .set('X-Forwarded-For', '1.1.1.1')
    }
    const res = await request(app)
      .post('/api/public/chat/stream')
      .send({ messages: [{ role: 'user', content: 'q' }] })
      .set('X-Forwarded-For', '2.2.2.2')
    expect(res.status).toBe(200)
  })

  it('exports UNAUTHED_SYSTEM_PROMPT as a string', async () => {
    const mod = await import('../chat.js')
    expect(typeof mod.UNAUTHED_SYSTEM_PROMPT).toBe('string')
    expect(mod.UNAUTHED_SYSTEM_PROMPT).toMatch(/SIPHER/)
    expect(mod.UNAUTHED_SYSTEM_PROMPT).toMatch(/no tools/i)
  })
})
```

- [ ] **Step F3.1.2: Run tests, expect FAIL**

Expected: FAIL — module not found.

- [ ] **Step F3.1.3: Implement `chat.ts`**

Subagent:
1. Export `UNAUTHED_SYSTEM_PROMPT` constant matching the spec's skeleton (RECTOR may polish at PR review).
2. Create `chatRouter` Express Router:
   - `POST /stream` with `ipRateLimitMiddleware('chat', 5, 24*60*60*1000)` first.
   - Inside the handler:
     - Set SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`)
     - Call `res.flushHeaders()` so the X-RateLimit-* headers (set by middleware before this handler) are committed
     - Invoke the chosen strategy from the investigation step above to stream chat events with no tools + UNAUTHED_SYSTEM_PROMPT
     - Forward emitted events as SSE `data: <json>\n\n`
     - End with `data: [DONE]\n\n`
3. Wire into `routes/public/index.ts`:
   ```ts
   import { chatRouter } from './chat.js'
   publicRouter.use('/chat', chatRouter)
   ```

- [ ] **Step F3.1.4: Run tests, expect PASS**

Expected: PASS, 5 tests green.

- [ ] **Step F3.1.5: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat
git add packages/agent/src/routes/public/chat.ts packages/agent/src/routes/public/__tests__/chat.test.ts packages/agent/src/routes/public/index.ts
git commit -m "feat(agent): add /api/public/chat/stream for #218

- Strategy {A|B|C} (subagent fills in)
- 5 msgs/IP/24h rate limit
- No tools + restricted UNAUTHED_SYSTEM_PROMPT
- SSE stream shape matches authed /api/chat/stream"
```

### Task F3.2: Frontend — extend ChatSidebar with unauthed mode

**Files:**
- Modify: `app/src/components/ChatSidebar.tsx`
- Modify: `app/src/stores/app.ts` (add `unauthedRemaining` state)
- Modify: `app/src/components/__tests__/ChatSidebar.test.tsx` (add unauthed-mode tests)

- [ ] **Step F3.2.1: Add `unauthedRemaining` state to app store**

Edit `app/src/stores/app.ts`:
- Add to state: `unauthedRemaining: number | null` (default null)
- Add action: `setUnauthedRemaining: (n: number | null) => void`
- Reset to null on logout/clearAuth (subagent finds the existing logout pattern)

- [ ] **Step F3.2.2: Write failing ChatSidebar unauthed-mode tests**

Add a new `describe('unauthed mode', ...)` block in `app/src/components/__tests__/ChatSidebar.test.tsx`:

```tsx
describe('unauthed mode', () => {
  beforeEach(() => {
    // Mock useAuthState to return unauthed
    mockUseAuth.mockReturnValue({ status: 'unauthed', token: null, publicKey: null } as ReturnType<typeof useAuthState>)
    global.fetch = vi.fn().mockResolvedValue(mockSseResponseWithRateLimitHeaders(4))
  })

  it('renders 3 suggested questions in empty state', () => {
    render(<ChatSidebar />)
    expect(screen.getByText(/how does a stealth address work/i)).toBeInTheDocument()
    expect(screen.getByText(/sipher and tornado cash/i)).toBeInTheDocument()
    expect(screen.getByText(/viewing keys/i)).toBeInTheDocument()
  })

  it('clicking a suggested question pre-fills + sends', async () => {
    render(<ChatSidebar />)
    fireEvent.click(screen.getByText(/how does a stealth address work/i))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(url).toContain('/api/public/chat/stream')
  })

  it('banner shows "5 free messages — connect for unlimited" before any send', () => {
    render(<ChatSidebar />)
    expect(screen.getByText(/5 .*free messages/i)).toBeInTheDocument()
  })

  it('banner countdown updates from X-RateLimit-Remaining', async () => {
    render(<ChatSidebar />)
    fireEvent.click(screen.getByText(/how does a stealth address work/i))
    await waitFor(() => expect(screen.getByText(/4.*free messages/i)).toBeInTheDocument())
  })

  it('on remaining=0 after send, input disabled + button copy is "Connect wallet to continue"', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockSseResponseWithRateLimitHeaders(0))
    render(<ChatSidebar />)
    fireEvent.click(screen.getByText(/how does a stealth address work/i))
    await waitFor(() => {
      const input = screen.getByLabelText(/ask sipher/i) as HTMLInputElement
      expect(input.disabled).toBe(true)
    })
    expect(screen.getByText(/connect wallet to continue/i)).toBeInTheDocument()
  })

  it('on 429 response, input disabled + toast shown', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600) }),
      json: async () => ({ error: { code: 'RATE_LIMITED', message: 'Daily free limit reached', resetAt: Date.now() + 3600_000 } }),
    } as Response)
    render(<ChatSidebar />)
    fireEvent.click(screen.getByText(/how does a stealth address work/i))
    await waitFor(() => {
      const input = screen.getByLabelText(/ask sipher/i) as HTMLInputElement
      expect(input.disabled).toBe(true)
    })
  })

  it('POST has NO Authorization header in unauthed mode', async () => {
    render(<ChatSidebar />)
    fireEvent.click(screen.getByText(/how does a stealth address work/i))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers.authorization).toBeUndefined()
  })
})
```

(Subagent: write a `mockSseResponseWithRateLimitHeaders(remaining)` helper at the top of the test file that returns a Response-like object with proper SSE body stream + the headers.)

- [ ] **Step F3.2.3: Run tests, expect FAIL**

Expected: FAIL on most.

- [ ] **Step F3.2.4: Refactor `ChatSidebar.tsx` to support unauthed mode**

Subagent:
1. Detect mode: `const mode = token ? 'authed' : 'unauthed'`.
2. In unauthed mode:
   - Empty state shows 3 clickable suggested-question chips (subagent picks 3 from the spec list; RECTOR edits at review).
   - Clicking a chip = `sendMessage(<chip text>)`.
   - Banner above input area: `"{remaining ?? 5} of 5 free messages — connect wallet for unlimited"` reads from `useAppStore.unauthedRemaining`.
   - `sendMessage` posts to `${API_URL}/api/public/chat/stream` with NO Authorization header.
   - After response, parse `X-RateLimit-Remaining` header → call `setUnauthedRemaining(n)`.
   - On 429: parse envelope from JSON body, show toast, disable input, set `unauthedRemaining(0)`.
   - When `unauthedRemaining === 0`: input disabled, send button copy → "Connect wallet to continue", clicking opens wallet modal.
3. Authed mode: existing behavior unchanged. Existing authed tests must stay green.

- [ ] **Step F3.2.5: Run tests, expect PASS**

Expected: PASS — both unauthed tests AND existing authed tests.

- [ ] **Step F3.2.6: Commit**

```bash
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat
git add app/src/components/ChatSidebar.tsx app/src/components/__tests__/ChatSidebar.test.tsx app/src/stores/app.ts
git commit -m "feat(app): extend ChatSidebar with unauthed mode for #218

- 3 suggested questions in empty state
- Banner countdown from X-RateLimit-Remaining
- 429 disables input + Connect-to-continue CTA
- POST without Authorization header"
```

### Task F3.3: Final verification + push branch

- [ ] **Step F3.3.1: Run full app + agent test suites**

```bash
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat/app && pnpm test --run 2>&1 | tail -10
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat && pnpm --filter @sipher/agent test --run 2>&1 | tail -10
```
Expected: green.

- [ ] **Step F3.3.2: Typecheck**

```bash
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat/app && pnpm exec tsc --noEmit
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat && pnpm --filter @sipher/agent exec tsc --noEmit
```
Expected: clean.

- [ ] **Step F3.3.3: Push branch**

```bash
cd ~/local-dev/sipher/.worktrees/feat-unauthed-chat
git push -u origin feat/unauthed-chat
```

---

## Macro-task 7: Two-stage review per cluster (subagent dispatch)

For each cluster {F1, F2, F3} after the implementer subagent reports done:

### Stage A: spec-compliance-reviewer subagent

**Prompt skeleton:**

> You are a spec-compliance reviewer for Cluster {F1|F2|F3} of Wave 2b. The cluster's branch is at `~/local-dev/sipher/.worktrees/<dir>/`. Read the spec section verbatim from `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-wave-2b-design.md` for this cluster, then read the diff (`git diff main...HEAD`) and verify EACH locked decision (D-item, locked test, out-of-scope guardrail, scope cap) is satisfied. Report findings as ✅ APPROVED or 🔴 BLOCKED with specific gaps. Do not write code or make changes — review only.

### Stage B: code-quality-reviewer subagent

**Prompt skeleton:**

> You are a code-quality reviewer for Cluster {F1|F2|F3} of Wave 2b. Branch at `~/local-dev/sipher/.worktrees/<dir>/`. Spec at `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-wave-2b-design.md`. Carry-forward conventions in spec at "Carry-forward conventions" section. Inspect the diff for: TypeScript strictness, error handling at boundaries, missing tests on happy/edge paths, naming consistency, security risks (the public routes especially), accessibility (FE), test fragility (timer mocks, race conditions). Categorize findings as Critical / Important / Minor. Report only — do not write code.

### Stage C (if needed): fix-loop subagent

If Stage B reports Critical or Important findings, dispatch a fresh implementer subagent into the same worktree with a prompt summarizing the findings + asking it to fix them via TDD (red test demonstrating the issue → fix → green test) before re-review.

Minor findings → file as `tech-debt,priority:low` follow-ups (NOT `qa-skill`).

---

## Macro-task 8: PR creation + sequential merges + sync gate

### Task 8.1: Create 3 PRs (after all 3 clusters pass two-stage review)

For each cluster (parallel — 3 `gh pr create` calls):

```bash
cd ~/local-dev/sipher/.worktrees/feat-demo-mode
gh pr create --title "feat(app): #216 demo mode — read-only preview at /demo" --body "$(cat <<'EOF'
## Summary

Adds dedicated /demo route + CTA on unauthed Dashboard. New /api/public/demo/{vault,activity,privacy-score} backend reads the env-configured DEMO_WALLET (FGSkt8…). 60s server-side cache, 60 req/IP/min rate limit. Strategy {A|B} for service reuse — see commit body.

## What ships

- BE: 3 routes under /api/public/demo/* (cached, rate-limited, no JWT)
- FE: <DemoView /> at /demo + <DemoCtaCard /> on unauthed Dashboard
- 503 + UNAVAILABLE envelope when DEMO_WALLET unset
- Auto-redirect to / when wallet connects

## Tests

+N agent tests, +N app tests.

Closes #216
EOF
)"
```

(Repeat for F2 + F3 with appropriate descriptions.)

### Task 8.2: Wait for CI green per PR

```bash
cd ~/local-dev/sipher
gh pr checks --watch -B feat/demo-mode &
gh pr checks --watch -B feat/activity-teaser &
gh pr checks --watch -B feat/unauthed-chat &
wait
```

If any flake, retry the failing job once before investigating.

### Task 8.3: Sequential merges

Order: F1 → F2 → F3. F2 may require manual rebase on DashboardView.tsx after F1 lands.

For each in order:

```bash
cd ~/local-dev/sipher && git switch main
gh pr merge <PR-num> --merge --delete-branch
git pull --ff-only

# After F1 merges, F2 may need rebase:
cd ~/local-dev/sipher/.worktrees/feat-activity-teaser
git fetch origin
git rebase origin/main
# Resolve any DashboardView.tsx conflicts (F1 added DemoCtaCard in PrivacyGraph slot, F2 swapped ActivityStreamTable — should auto-merge but verify)
git push --force-with-lease

# Wait for F2 CI + merge, then F3 follows same rebase pattern if needed
```

### Task 8.4: Wave sync gate

```bash
cd ~/local-dev/sipher
git status
git log --oneline -8
gh issue list --repo sip-protocol/sipher --label "qa-skill:1778399617" --state open --limit 50
```
Expected:
- main HEAD includes all 4 Wave 2b PR merges (PR-0 + F1 + F2 + F3)
- `qa-skill:1778399617` open count = 0
- All worktrees can be removed: `git worktree list` shows only main

```bash
cd ~/local-dev/sipher/app && pnpm test --run 2>&1 | tail -5
cd ~/local-dev/sipher/app && pnpm exec tsc --noEmit 2>&1 | tail -5
cd ~/local-dev/sipher && pnpm --filter @sipher/agent test --run 2>&1 | tail -5
cd ~/local-dev/sipher && pnpm --filter @sipher/agent exec tsc --noEmit 2>&1 | tail -5
```
Expected: all green.

```bash
cd ~/local-dev/sipher
git worktree list
# Remove if any remain:
git worktree remove .worktrees/feat-demo-mode 2>/dev/null
git worktree remove .worktrees/feat-activity-teaser 2>/dev/null
git worktree remove .worktrees/feat-unauthed-chat 2>/dev/null
```

### Task 8.5: Phase D launch gate confirmation

```bash
gh issue list --repo sip-protocol/sipher --label "qa-skill:1778399617" --state open
```
Expected: empty list. Phase D `--diff-from` gate flips ✅.

Update sprint memory to reflect Wave 2b complete + Phase D launch path unblocked.

---

## Self-review summary

Spec coverage check:
- D16 demo wallet env → covered by F1 backend (env-gated routes) + 503 test
- D17 backend shape (3 routes, cache, rate limit, no SSE) → F1 backend tasks
- D18 entry/exit (CTA + /demo + auto-redirect) → F1 frontend tasks
- D19 activity teaser shape → F2 backend + frontend tasks
- D20 unauthed chat shape → F3 backend + frontend tasks
- D21 dispatch shape → Macro-tasks 2/3/4-6/7/8 explicitly mirror it

Placeholder check: no TBD/TODO/FIXME in the plan.

Type consistency: All shared types defined in `lib/queries/public.ts` and consumed by both BE routes and FE components. `RateLimitResult.cap` is set at definition + read by middleware (no drift). `AmountBand` is the literal union used by both `toAmountBand` helper and FE consumer.

---

## Carry-forward conventions (verbatim from spec)

1. NO AI attribution in commits / PRs / files
2. NO semicolons in TS/TSX (single quotes for imports)
3. Conventional commits with appropriate scope
4. NEVER amend commits; create new ones
5. TDD discipline (failing test → implement → passing test)
6. CI must be green before merge; if flaky, retry once before investigating
7. `--merge --delete-branch` (NOT squash)
8. Multi-issue PRs use ONE `Closes #X` per line — Wave 2b each closes 1 issue, single-line case
9. Subagent-driven for genuinely complex; INLINE for mechanical (PR-0 INLINE, F1/F2/F3 SUBAGENT)
10. Use `superpowers:verification-before-completion` before claiming any task done
11. Switch to main BEFORE running `gh pr merge`
12. Build `@sipher/sdk` before agent tests in fresh worktree
13. App tests from inside `app/`: `cd app && pnpm test --run src/...`
14. Typecheck: `pnpm exec tsc --noEmit` from `app/`
15. Subagent prompts include explicit out-of-scope list
16. Push spec+plan to origin BEFORE creating cluster PRs
17. Subagent prompts reference plan file rather than inline full prompts

# QA Sweep — Tier 4 Wave 2b (E2 Features) — Design

**Date:** 2026-05-11
**Session:** frontier_51
**Status:** Approved (RECTOR, this session)
**Predecessors:**
  - Handoff: `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-11-d.md`
  - Tier 4 spec (Wave 1 + Wave 2a): `docs/superpowers/specs/2026-05-11-qa-sweep-tier-4-design.md`
  - Wave 2a plan: `docs/superpowers/plans/2026-05-11-qa-sweep-tier-4-wave-2a.md`
  - Sprint memory: `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`
**Scope:** 3 net-new "E2 Real" features (#216 demo mode, #217 unauthed activity teaser, #218 IP-rate-limited unauthed chat) + 1 shared foundation PR
**Out of scope (this session):** Phase D launch close (3-wallet manual QA, X thread #1) — RECTOR-driven gates after Wave 2b ships
**Estimated work-time:** 7-9h wall-clock (foundation INLINE + 3 parallel SUBAGENT cluster PRs)

---

## Why this slice

Wave 2a (frontier_50) shipped 10 issues across Clusters C/D/E1 — `qa-skill:1778399617` open count dropped 13 → 3. The remaining 3 issues form the "E2" set per Wave 2a's D14: net-new marketing-surface features (#216 + #217 + #218) with "All Real" scope per D13. Once Wave 2b lands, Phase D's `/quality:qa --diff-from` launch gate flips ✅.

The 3 features share a unifying theme: **convert the unauthed dashboard from a dead empty shell into a marketing/onboarding funnel**. Each feature replaces an empty-state surface with a real, populated experience that demonstrates value before commitment.

All 3 features need the same backend infrastructure: a `/api/public/*` route prefix that serves cached, IP-rate-limited, no-JWT data. Building this foundation once (PR-0 INLINE) and consuming it from 3 parallel subagent feature PRs is faster, smaller per-PR, and avoids 3-way clashes on `agent/src/index.ts` + the new shared rate-limit module.

---

## Locked decisions (continuing from Wave 2a D15)

| #   | Decision                                                                                                                                            | Source               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| D16 | Demo wallet = existing devnet `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` (no new mint/seed work)                                                  | RECTOR (Q1)          |
| D17 | Demo backend = 3 routes `GET /api/public/demo/{vault,activity,privacy-score}`, env `DEMO_WALLET`, 60s in-memory server cache, no SSE                | RECTOR (Q2 + Q3)     |
| D18 | Demo entry = dedicated `/demo` route + CTA card on unauthed `/`. Banner on `/demo`: "Demo mode — read-only preview." Auto-redirect to `/` on connect | RECTOR (Q4)          |
| D19 | Activity teaser = counter + 5-recent feed, `GET /api/public/activity-summary`, 60s cache, anonymized to type+chain+amount-band+relative-time only   | RECTOR (Q5)          |
| D20 | Unauthed chat = `POST /api/public/chat/stream` SSE, 5 msgs/IP/24h, NO tools, restricted system prompt, 3 suggested questions, countdown UX          | RECTOR (Q6)          |
| D21 | Wave 2b dispatch = PR-0 foundation INLINE + 3 parallel SUBAGENT cluster PRs (#216, #217, #218) consuming foundation. 4 PRs total                    | RECTOR (Q7)          |

---

## PR-0 — Shared foundation (INLINE, ~2h)

### Why INLINE

~2h of mechanical wiring + tests. Subagent dispatch overhead exceeds the work. Same pattern as Wave 2a foundation patterns (e.g., `<UnauthedEmptyState>` primitive built in Tier 2 was inline-built before being consumed by other clusters).

### Deliverables

```
packages/agent/src/lib/ip-rate-limit.ts          # NEW
packages/agent/src/lib/cache.ts                  # NEW (shared 60s in-memory response cache)
packages/agent/src/routes/public/index.ts        # NEW (mounted at /api/public)
packages/agent/src/lib/queries/public.ts         # NEW (stub w/ shared types only)
packages/agent/src/index.ts                      # EDIT (mount publicRouter)
packages/agent/src/lib/__tests__/ip-rate-limit.test.ts  # NEW
packages/agent/src/lib/__tests__/cache.test.ts          # NEW
```

### Module: `lib/ip-rate-limit.ts`

Reuses the existing `createStore` abstraction (`packages/agent/src/state/ephemeral.ts`) — same backend `verifyAttempts` in `routes/auth.ts` already uses. Maintains forward-compat with the documented Redis swap path.

**Interface:**

```ts
import { createStore } from '../state/ephemeral.js'

interface BucketState { count: number; resetAt: number }
const ipRateLimitStore = createStore<BucketState>('ipRateLimit', { maxSize: 10_000 })

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number  // epoch ms
  cap: number
}

export async function checkAndIncrement(
  ip: string,
  key: string,
  cap: number,
  windowMs: number,
): Promise<RateLimitResult>

export function ipRateLimitMiddleware(
  key: string,
  cap: number,
  windowMs: number,
): RequestHandler

export async function _resetForTests(): Promise<void>
```

**Middleware behavior:**
- Extracts `req.ip` (Express already has `trust proxy = N` set per index.ts:146-148, so X-Forwarded-For is honored)
- Calls `checkAndIncrement(ip, key, cap, windowMs)`
- Sets response headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (epoch seconds)
- On 429: returns envelope `{ error: { code: 'RATE_LIMITED', message: 'Daily limit exceeded for this IP', resetAt } }` + status 429. Does NOT call `next()`.
- On allowed: attaches `req.rateLimit = result` and calls `next()`.

**Why a key per call site:** Demo endpoints + chat + activity-summary each get their own bucket (`'demo'`, `'chat'`, `'activity-summary'`), so an IP exhausted on chat can still hit demo and vice versa.

### Module: `lib/cache.ts`

Tiny TTL-based response cache for the `/api/public/*` GETs (demo + activity-summary). Shared so a per-route cache wrapper is one line.

```ts
import { createStore } from '../state/ephemeral.js'

const responseCache = createStore<unknown>('responseCache', { maxSize: 1_000 })

export async function getCached<T>(key: string): Promise<T | null>
export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void>
export async function _resetForTests(): Promise<void>
```

### Module: `routes/public/index.ts`

Express sub-router exporting a single `publicRouter` mounted at `/api/public`. Initially empty — feature subagents add their routes via further sub-routers.

```ts
import { Router } from 'express'
export const publicRouter = Router()
// Subagents register: publicRouter.use('/demo', demoRouter), etc.
```

### Module: `lib/queries/public.ts` (stub)

Exports shared types only. Subagents extend with feature-specific helpers.

```ts
export interface DemoVault { wallet: string; balances: { sol: number; tokens: unknown[]; status: string } }
export interface DemoActivityRow { id: string; type: string; level: string; created_at: string; detail?: string | null }
export interface DemoPrivacyScore { score: number; grade: string; factors: Record<string, { score: number; detail: string }>; recommendations: string[]; transactionsAnalyzed: number }
export interface ActivitySummaryResponse { counter: number; recent: AnonActivityRow[] }
export interface AnonActivityRow { type: string; chain: string; amountBand: AmountBand; relativeTime: string }
export type AmountBand = '<1' | '1-10' | '10-100' | '100-1000' | '>1000'
```

### Edit: `agent/src/index.ts`

Single line addition (after CORS + before authed routes):

```ts
import { publicRouter } from './routes/public/index.js'
app.use('/api/public', publicRouter)
```

Trust-proxy + CORS already configured at index.ts:146-148 + index.ts:152-160. No new wiring there.

### Tests for PR-0

**`__tests__/ip-rate-limit.test.ts`** (~10 tests):
- First call returns `{ allowed: true, remaining: cap - 1 }`
- Burst beyond cap returns `{ allowed: false, remaining: 0, resetAt }`
- Different IPs have independent buckets
- Different keys for same IP have independent buckets
- Window expiry resets the bucket
- Middleware sets X-RateLimit-* headers correctly
- Middleware returns 429 + envelope on exceeded
- Middleware honors X-Forwarded-For (via supertest header)
- `_resetForTests()` clears state

**`__tests__/cache.test.ts`** (~5 tests):
- get returns null for unset key
- set + get returns value within TTL
- set + get returns null after TTL expires
- maxSize evicts oldest FIFO
- `_resetForTests()` clears state

### PR-0 commit + branch

- Branch: `chore/wave-2b-foundation`
- Commits (one each, conventional):
  - `feat(agent): add createStore-backed IP rate limiter`
  - `feat(agent): add response cache helper`
  - `feat(agent): mount /api/public router prefix`
  - `feat(agent): add public query types stub`
  - `test(agent): cover ip-rate-limit + cache helpers`
- One PR, single Closes line: `Closes` nothing (foundation has no qa-skill issue — referenced in PR description as "Foundation for Wave 2b #216/#217/#218")

---

## Cluster F1 — #216 Demo mode (`feat/demo-mode`)

**Branch:** `feat/demo-mode`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-demo-mode/`
**Issues:** #216
**Mode:** SUBAGENT
**Estimated:** 3-4h
**Closes:** #216

### Backend

**New file: `routes/public/demo.ts`**

Mounts 3 routes on a sub-router exported as `demoRouter`:
- `GET /vault` → returns demo wallet vault state
- `GET /activity` → returns demo wallet activity rows (most recent N)
- `GET /privacy-score` → returns demo wallet privacy score

Each route:
1. `cacheKey = 'public-demo-${endpoint}'`
2. Checks `cache.getCached(cacheKey)` — return on hit
3. On miss: invokes existing service function with `wallet = process.env.DEMO_WALLET`
4. Stores in cache with 60s TTL
5. Returns response

**Existing services to reuse** (DO NOT duplicate):
- `/api/vault` handler logic in `index.ts:184-222` (factor out into `services/vault.ts` getVaultByWallet OR call internally)
- `/api/activity` handler at `index.ts:224-254`
- `/v1/privacy/score` POST handler (find in routes/)

If factoring out is risky, the cleaner pattern is: **import and reuse the underlying DB queries + RPC calls**, not the HTTP handlers. Subagent picks: factor service or duplicate query logic. Documents choice in PR description.

**Rate limit:** `ipRateLimitMiddleware('demo', 60, 60_000)` — 60 reqs/IP/min (generous; cache absorbs most). Applied to the demoRouter.

**Wire in `routes/public/index.ts`:**
```ts
import { demoRouter } from './demo.js'
publicRouter.use('/demo', demoRouter)
```

**Env var:** `DEMO_WALLET` — defaults to `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`. If unset, routes return 503 + envelope `{ error: { code: 'UNAVAILABLE', message: 'Demo mode disabled' } }`. Test exercises both paths.

### Frontend

**New file: `app/src/views/DemoView.tsx`**

Wraps DashboardView's render shape but:
- Banner at top (sticky-ish, dismissible? NO — banner is core to the demo identity, persistent until exit):
  - Copy: "**Demo mode** — read-only preview using a real devnet wallet. Connect your wallet to use SIPHER for real."
  - Two action buttons: "[Exit demo]" (navigates to `/`) and "[Connect wallet]" (opens existing wallet modal trigger)
- Renders existing `<PrivacyGraph>`, `<PrivacyScoreCard>`, `<ShieldedVolumeCard>`, `<MultiChainVaultGrid>`, `<ActivityStreamTable>`
- Data fetched from `/api/public/demo/*` (NO Authorization header, NO body params)
- Sidebar HIDDEN on `/demo` (locked — keeps demo focused, prevents nav into authed-only views, smallest test surface)
- Action CTAs in MultiChainVaultGrid (Deposit buttons per chain) DISABLED with title="Connect wallet to use SIPHER for real"
- `useEffect`: when `useAuthState().status === 'authed'`, navigate to `/` (auto-exit on connect)

**New file: `app/src/components/DemoCtaCard.tsx`**

Renders a card-shaped CTA in the unauthed Dashboard's empty PrivacyGraph slot:
- Copy: "Curious how it looks populated?" + "[View sample dashboard →]"
- Click → navigate to `/demo`

**Edit: `app/src/views/DashboardView.tsx`**
- When `status !== 'authed'`, render `<DemoCtaCard />` near the empty PrivacyGraph slot (placement: above PrivacyGraph, OR replace the empty PrivacyGraph slot — subagent picks based on layout). The visible tagline + grid stay as today.
- When `status === 'authed'`, no `<DemoCtaCard />` (existing behavior).

**Edit: `app/src/App.tsx`**
- Add route `<Route path="/demo" element={<DemoView />} />`

**Coverage scope (locked):** `/demo` populates Dashboard surface only. Vault, Chains, Settings, Keys, etc. remain authed-only — sidebar links from `/demo` are inert (or sidebar hidden).

### Tests

**Backend:**
- `routes/public/__tests__/demo.test.ts`:
  - `GET /api/public/demo/vault` returns demo wallet vault shape
  - 2nd call within 60s returns cached response (mock service called once)
  - Burst of 61 reqs in <1min returns 429 envelope
  - When `DEMO_WALLET` env unset → 503 + UNAVAILABLE envelope
  - Same coverage for `/activity` and `/privacy-score`

**Frontend:**
- `views/__tests__/DemoView.test.tsx`:
  - Banner renders with "Demo mode" + both CTA buttons
  - Exit-demo button navigates to `/`
  - Connect-wallet button triggers wallet modal
  - Auto-redirect to `/` when status changes to `'authed'`
  - Fetch called with no Authorization header
- `components/__tests__/DemoCtaCard.test.tsx`:
  - Renders the CTA copy
  - Click navigates to `/demo`
- `views/__tests__/DashboardView.test.tsx` (extend):
  - Unauthed renders `<DemoCtaCard />`
  - Authed does NOT render `<DemoCtaCard />`
- `App.test.tsx` (extend):
  - Visiting `/demo` mounts `<DemoView />`

### Out-of-scope guardrails for Cluster F1 subagent

- DON'T touch ChatSidebar (Cluster F3 territory).
- DON'T touch ActivityStreamTable empty state (Cluster F2 territory — F2 replaces it with `<UnauthedActivityFeed />`).
- DON'T add SSE for demo mode (D17 explicitly excludes SSE).
- DON'T extend demo coverage to non-Dashboard views (locked scope).
- DON'T modify the IP rate limiter or cache helpers (PR-0 territory; F1 only consumes them).

---

## Cluster F2 — #217 Unauthed activity teaser (`feat/activity-teaser`)

**Branch:** `feat/activity-teaser`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-activity-teaser/`
**Issues:** #217
**Mode:** SUBAGENT
**Estimated:** 2-3h
**Closes:** #217

### Backend

**New file: `routes/public/activity-summary.ts`**

Mounts `GET /` on a sub-router exported as `activitySummaryRouter`. Returns:

```json
{
  "counter": 12345,
  "recent": [
    { "type": "send.success", "chain": "solana", "amountBand": "1-10", "relativeTime": "3 minutes ago" },
    ...
  ]
}
```

**Counter computation:**
- `SELECT COUNT(*) FROM events WHERE type LIKE '%.success' OR type LIKE '%.completed'`
  (or whatever the events table uses to mark fund-mover completions — subagent confirms by reading existing /api/activity handler)
- Cached separately at `'public-activity-summary-counter'`, 60s TTL

**Recent rows computation:**
- `SELECT type, level, detail, created_at FROM events WHERE type LIKE '%.success' OR type LIKE '%.completed' ORDER BY created_at DESC LIMIT 5`
- `detail` column is stored as a JSON string in the events table (per `parseDetail` in `app/src/views/DashboardView.tsx:40-46`). Subagent must `JSON.parse(detail)` defensively (try/catch fallback) before extracting fields.
- Transform each row to `AnonActivityRow`:
  - `type`: keep as-is (e.g., "send.success", "swap.success")
  - `chain`: extracted from parsed `detail.chain` if present, else 'solana' (default)
  - `amountBand`: bucket parsed `detail.amount` into `<1`, `1-10`, `10-100`, `100-1000`, `>1000` SOL (chain-equivalent for non-Solana ignored in v1 — events table is Solana-dominated)
  - `relativeTime`: format `created_at` to "X minutes/hours/days ago"
- NO `sender`, `recipient`, `id`, exact amount, or any wallet-identifiable field in the response

**Cached at `'public-activity-summary'`** (combined response), 60s TTL.

**Rate limit:** `ipRateLimitMiddleware('activity-summary', 120, 60_000)` — 2/sec/IP, generous for poll-on-mount + 60s polling.

**Wire in `routes/public/index.ts`:**
```ts
import { activitySummaryRouter } from './activity-summary.js'
publicRouter.use('/activity-summary', activitySummaryRouter)
```

### Frontend

**New file: `app/src/components/UnauthedActivityFeed.tsx`**

- Fetches `/api/public/activity-summary` on mount
- Polls every 60s while `document.visibilityState === 'visible'`
- Renders skeleton during initial load
- On loaded:
  - `<Counter />` showing "{counter.toLocaleString()} shielded transfers all-time" (formatting suggestion)
  - `<RecentRowsList />` — 5 rows, each: type icon + chain badge + amount band + relative time
- On fetch error: renders compact empty-state "Live activity unavailable" (graceful degradation)
- AbortController on unmount

**Edit: `app/src/views/DashboardView.tsx`**
- When `status !== 'authed'`, render `<UnauthedActivityFeed />` in place of the empty `<ActivityStreamTable rows={[]} />`
- When authed, existing `<ActivityStreamTable />` renders as today
- Position: same place ActivityStreamTable currently sits (below MultiChainVaultGrid)

### Tests

**Backend:**
- `routes/public/__tests__/activity-summary.test.ts`:
  - Returns `{ counter, recent }` shape
  - `recent[*]` has only `{ type, chain, amountBand, relativeTime }` keys (no sender/recipient/exactAmount)
  - Counter > 0 when events table has matching rows
  - Empty events table → counter = 0, recent = []
  - 2nd call within 60s returns cached response
  - Burst of 121 reqs/min returns 429
  - Anonymization: amount 0.5 → '<1', amount 5 → '1-10', amount 50 → '10-100', etc.

**Frontend:**
- `components/__tests__/UnauthedActivityFeed.test.tsx`:
  - Renders skeleton during initial load
  - Renders counter + 5 rows after fetch
  - Visibility-gated polling: hidden tab → no fetch
  - AbortController fires on unmount
  - Counter formatting: 12345 → "12,345"
- `views/__tests__/DashboardView.test.tsx` (extend):
  - Unauthed shows `<UnauthedActivityFeed />` instead of empty ActivityStreamTable
  - Authed shows ActivityStreamTable

### Out-of-scope guardrails for Cluster F2 subagent

- DON'T touch DemoView/DemoCtaCard (Cluster F1 territory).
- DON'T touch ChatSidebar (Cluster F3 territory).
- DON'T add SSE for activity stream (D19 explicitly chose periodic poll).
- DON'T expose sender, recipient, exact amount, or transaction hash in the response.
- DON'T modify the IP rate limiter or cache helpers (PR-0).

---

## Cluster F3 — #218 Unauthed Ask SIPHER (`feat/unauthed-chat`)

**Branch:** `feat/unauthed-chat`
**Worktree:** `~/local-dev/sipher/.worktrees/feat-unauthed-chat/`
**Issues:** #218
**Mode:** SUBAGENT
**Estimated:** 4-5h
**Closes:** #218

### Backend

**New file: `routes/public/chat.ts`**

Mounts `POST /stream` (SSE) on a sub-router exported as `chatRouter`. Same SSE shape as authed `/api/chat/stream` (FE reuses parsing).

**Implementation pattern:**
- Reuses `chatStream` from `agent.ts` BUT passes restricted options:
  - **NO tools** — pass empty tools array (or skip the tool-bind step entirely; subagent investigates pattern in agent.ts)
  - **Restricted system prompt** (defined as exported constant `UNAUTHED_SYSTEM_PROMPT`):
    ```
    You are SIPHER's educational assistant. Answer concise general questions about: SIPHER (multi-chain privacy command center), shielded payments, stealth addresses, Pedersen commitments, viewing keys, and privacy tradeoffs on Solana and EVM chains.

    If the user asks about their wallet, balances, transactions, prices, accounts, or anything that would require running a tool, politely refuse and suggest they connect their wallet to use SIPHER fully.

    Never claim to do anything on-chain. You have no tools available in this mode. Keep answers under 200 words. If asked something off-topic, politely redirect to SIPHER topics.
    ```
  - Subagent finalizes prompt; RECTOR reviews at PR review or post-merge.
- No wallet attached to request (no JWT)
- SSE event stream: same shape as authed (`content_block_delta`, `error`) but emits NO `tool_use` / `tool_result` / `sentinel_pause` events (no tools, no sentinel)

**Rate limit:** `ipRateLimitMiddleware('chat', 5, 24*60*60*1000)` — 5/IP/24h

**Response headers** (from middleware):
- `X-RateLimit-Limit: 5`
- `X-RateLimit-Remaining: N` (after this request)
- `X-RateLimit-Reset: <epoch seconds>`

These headers are emitted BEFORE the SSE stream starts (with res.flushHeaders), so FE reads them from the initial response.

**429 response shape:** envelope `{ error: { code: 'RATE_LIMITED', message: 'Daily free limit reached', resetAt: <epoch ms> } }` with status 429. NOT SSE — plain JSON.

**Wire in `routes/public/index.ts`:**
```ts
import { chatRouter } from './chat.js'
publicRouter.use('/chat', chatRouter)
```

### Frontend

**Edit: `app/src/components/ChatSidebar.tsx`** (major refactor)

- Detect mode: `const mode = token ? 'authed' : 'unauthed'`
- Unauthed mode behavior:
  - **Empty state** (when messages.length === 0):
    - Greeting: "Ask SIPHER about privacy on Solana"
    - 3 suggested-question chips (clickable, pre-fills input + immediately sends):
      - "How does a stealth address work?"
      - "What's the difference between SIPHER and Tornado Cash?"
      - "Why are viewing keys important for compliance?"
    - (Subagent may polish copy; RECTOR reviews.)
  - **Banner above input:** "{remaining} of 5 free messages — connect wallet for unlimited"
    - Reads `remaining` from `useAppStore.unauthedRemaining` (new state)
    - On `remaining === 5` (initial), shows "5 free messages — connect wallet for unlimited" (no countdown until first send)
  - **Send button:** posts to `${API_URL}/api/public/chat/stream` (no Authorization header)
  - **Response handling:**
    - Reads `X-RateLimit-Remaining` from response headers, calls `setUnauthedRemaining(n)`
    - SSE parsing reuses existing logic (skip tool/sentinel branches if not present)
  - **On 429:** parses envelope, shows toast "Daily free limit reached. Resets at {HH:MM}." + disables input + button copy "Connect wallet to continue"
  - **On `remaining === 0` after send:** input disabled + button copy "Connect wallet to continue"
- Authed mode: existing behavior unchanged

**Edit: `app/src/stores/app.ts`**
- Add state: `unauthedRemaining: number | null` (null = unknown, never sent)
- Add action: `setUnauthedRemaining(n: number | null)`
- Reset to null on auth change (so authed → unauthed transition shows fresh state)

**Edit: `app/src/components/ChatSidebar.tsx` placeholder copy:**
- Authed: existing "Message SIPHER..." / "Connect wallet first"
- Unauthed (with remaining > 0): "Ask SIPHER about privacy..."
- Unauthed (with remaining === 0 OR 429): "Connect wallet to continue"

### Tests

**Backend:**
- `routes/public/__tests__/chat.test.ts`:
  - POST returns SSE stream (200 + Content-Type text/event-stream)
  - X-RateLimit-* headers present on response
  - 6th request from same IP within 24h returns 429 + RATE_LIMITED envelope
  - Different IPs have independent counts
  - System prompt presence: agent invocation receives `UNAUTHED_SYSTEM_PROMPT`
  - No-tools enforcement: agent invocation receives empty tools array (or no tool binding)
  - Topic refusal: when user asks "What's my balance?", response refers to wallet connection (asserted via mocked LLM response)

**Frontend:**
- `components/__tests__/ChatSidebar.test.tsx` (extend):
  - Unauthed mode renders 3 suggested-question chips when messages empty
  - Click on suggested chip pre-fills input AND immediately sends
  - Banner shows "5 free messages" before any send
  - Banner updates to "{n} free messages left" after each send (mock X-RateLimit-Remaining response header)
  - On `remaining === 0` after send: input disabled, button copy = "Connect wallet to continue"
  - On 429 response: input disabled, toast shown, button copy = "Connect wallet to continue"
  - POST to `/api/public/chat/stream` with NO Authorization header in unauthed mode
  - Authed mode: existing tests stay green

### Out-of-scope guardrails for Cluster F3 subagent

- DON'T touch DemoView/DemoCtaCard or DashboardView's PrivacyGraph slot (Cluster F1).
- DON'T touch UnauthedActivityFeed or DashboardView's ActivityStreamTable slot (Cluster F2).
- DON'T modify the IP rate limiter, cache helpers, or trust-proxy config (PR-0).
- DON'T add captcha, content classification, or auto-ban (out of scope per D20).
- DON'T enable any tools in unauthed mode.
- DON'T add a token-level cost cap (message-cap is the v1 control per D20).

---

## Cross-cluster file coordination (Wave 2b)

### `app/src/views/DashboardView.tsx` — F1 + F2 both touch

- **F1 (#216):** adds `<DemoCtaCard />` to the unauthed branch (in or near the empty PrivacyGraph slot)
- **F2 (#217):** replaces `<ActivityStreamTable rows={[]} />` with `<UnauthedActivityFeed />` in the unauthed branch
- **Distinct sections** — F1 = top half (PrivacyGraph slot), F2 = bottom (ActivityStreamTable slot)

**Coordination rule** (each subagent prompt includes):
> `DashboardView.tsx` is also being modified by the parallel cluster ({F1|F2}). Your changes are in a distinct section — F1 = `<DemoCtaCard />` near PrivacyGraph; F2 = `<UnauthedActivityFeed />` replacing empty ActivityStreamTable. Do not touch the other cluster's section. Trust the merge will compose cleanly.

Worst case: 5-minute manual rebase at merge time if the auto-merge fails. Recoverable.

### `app/src/views/__tests__/DashboardView.test.tsx` — F1 + F2 both touch

Same rule: F1 adds DemoCtaCard tests, F2 adds UnauthedActivityFeed tests. Different `describe` blocks, no setup overlap. May need 2-3 line manual rebase if both add `beforeEach` setup.

### `agent/src/index.ts` — only PR-0 touches

PR-0 adds `app.use('/api/public', publicRouter)`. F1/F2/F3 all extend `routes/public/index.ts` (which mounts feature sub-routers) — no clash on `index.ts`.

### `routes/public/index.ts` — F1 + F2 + F3 all touch (append-only)

Each subagent adds one line: `publicRouter.use('/{demo|activity-summary|chat}', xRouter)`. Append-only conflicts. Last-merger may need 1-line manual rebase.

### `lib/queries/public.ts` — F1 + F2 may both touch

Stub from PR-0 has shared types. F1 may add demo-specific helpers, F2 may add activity-summary helpers. Append-only — same easy resolution.

**No other shared files.** ChatSidebar (F3-only), DemoView (F1-only), UnauthedActivityFeed (F2-only) are isolated.

---

## Dispatch protocol

### Step 1: Push spec + plan to origin/main

Commit this spec doc + the upcoming Wave 2b plan to a single `docs(spec)` commit on `main`, push to origin BEFORE creating any feature branch. Keeps cluster PR diffs clean (Wave 1 + Wave 2a lesson — otherwise spec/plan land inside the first feature PR).

### Step 2: Build PR-0 INLINE

1. Create branch `chore/wave-2b-foundation` from `main`
2. Build deliverables in order: `lib/ip-rate-limit.ts` → `lib/cache.ts` → `routes/public/index.ts` → `lib/queries/public.ts` → mount in `index.ts` → tests
3. TDD discipline: write tests first per file
4. Commit each deliverable separately (5 commits as listed above)
5. Push, create PR, wait for CI green
6. Merge `--merge --delete-branch`
7. Sync local main: `git pull --ff-only`

### Step 3: Pre-dispatch (sequential)

For each cluster {F1, F2, F3}:
- `git worktree add .worktrees/feat-{demo-mode|activity-teaser|unauthed-chat} -b feat/{branch} origin/main`
- `pnpm install --frozen-lockfile && pnpm --filter "@sipher/sdk" build` (3 parallel bg shells)
- Verify `app/node_modules/@noble/ciphers` symlink + baseline test count

### Step 4: Parallel dispatch (3 SUBAGENT)

Spawn 3 parallel `Agent` calls with implementer prompts. Each subagent prompt:
- References this spec section (verbatim)
- References plan file (when written) for per-task TDD detail
- Includes out-of-scope guardrails (verbatim)
- Includes carry-forward conventions (verbatim from end of this doc)
- Includes branch name + worktree path

### Step 5: Two-stage review per cluster (sequential per cluster, parallel across clusters)

- spec-compliance-reviewer subagent — validates D-items met
- code-quality-reviewer subagent — Critical/Important findings → fix-loop subagent within cluster's worktree
- Minor findings → file as `tech-debt,priority:low` follow-ups (NOT `qa-skill`)

### Step 6: PR creation + CI gate

- `gh pr create` per cluster
- Multi-issue PRs use ONE `Closes #X` per line (Wave 2b each closes 1 issue, so single line each)
- Wait for CI green per PR

### Step 7: Sequential merges (on main)

Order: F1 → F2 → F3 (or whichever order finishes review first)

For each:
1. `git switch main` (avoid worktree-owns-branch quirk)
2. `gh pr merge --merge --delete-branch`
3. `git pull --ff-only`
4. `git worktree remove .worktrees/<dir>` (auto-cleans local branch)
5. Note any rebase needed for next cluster (DashboardView.tsx merge collision)

### Step 8: Wave sync gate

- All 4 PRs merged + main synced
- App test count noted (delta from baseline)
- `pnpm exec tsc --noEmit` confirmed clean from `app/`
- `gh issue list --repo sip-protocol/sipher --label "qa-skill:1778399617" --state open --limit 50` → expect ZERO open issues
- Phase D launch gate (`/quality:qa --diff-from`) flips ✅

---

## Risks & mitigations

| Risk                                                                                              | Likelihood | Mitigation                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `trust proxy` misconfig collapses all IPs to nginx loopback, defeating per-IP rate limiting       | Low        | Already configured at index.ts:146-148 via `TRUST_PROXY` env var (default 1). PR-0 test asserts X-Forwarded-For is honored via supertest. |
| In-memory rate-limit store grows unbounded                                                        | Low        | `createStore` already enforces `maxSize: 10_000` FIFO eviction + 60s sweep of expired entries.                                            |
| Demo wallet `FGSkt8…` data dries up over time (looks empty)                                       | Medium     | Documented; not blocking for launch. If shape becomes ugly, future PR re-seeds. Cache absorbs RPC cost.                                   |
| 60s cache makes demo data feel stale during a demo session                                        | Low        | 60s is fine for a marketing surface — not a real-time trading tool.                                                                       |
| Unauthed chat hits OpenRouter cost (no auth = no per-user accountability)                         | Medium     | 5/IP/24h cap × ~few-hundred tokens/msg → max ~5K tokens/IP/day. Acceptable pre-launch; add stricter caps post-launch if abuse seen.       |
| LLM goes off-topic despite system prompt                                                          | Medium     | System prompt is the only guardrail. Subagent test asserts a topic-refusal example. Add response classifier post-launch if needed.        |
| ChatSidebar refactor breaks authed-mode tests                                                     | Medium     | Subagent uses mode-branching pattern; existing authed tests stay green; new unauthed tests added in separate `describe` block.            |
| DashboardView.tsx F1+F2 merge conflict                                                            | Low        | Coordination rule in subagent prompts (F1 = PrivacyGraph slot CTA, F2 = ActivityStreamTable slot replacement). Manual rebase if needed.   |
| F1 demo backend duplicates `/api/vault` + `/api/activity` + `/v1/privacy/score` handler logic     | Medium     | Subagent investigates: factor service vs duplicate. Documents choice in PR description. Reviewer challenges if duplication is heavy.      |
| F2 events table query schema differs from assumption                                              | Low        | Subagent confirms by reading existing /api/activity handler in index.ts:224-254. Adjusts query to match.                                  |
| F3 system prompt copy lands wrong                                                                 | Medium     | RECTOR reviews at code-quality review or post-merge. Non-blocking for merge.                                                              |
| 3-way parallel CI runs flake                                                                      | Low        | Convention: retry once before investigating. Stable across prior 7 sprints.                                                               |
| `gh issue close` doesn't auto-fire on multi-issue PR                                              | High       | Spec mandates ONE `Closes #X` per line in PR body. Each Wave 2b cluster closes only 1 issue, so single-line case.                         |
| FE expects `chatStream` SSE shape but backend emits a different shape for unauthed mode           | Medium     | Subagent verifies shape parity (no `tool_use` / `tool_result` / `sentinel_pause` events from unauthed but `content_block_delta` + `error` match). FE branch handles missing event types gracefully. |

---

## Out of scope (Wave 2b)

- Captcha (Turnstile / hCaptcha) on unauthed chat — keep watching for abuse, add later if needed
- Content classification on chat outputs — system prompt is the v1 guardrail
- SSE for demo wallet — snapshot is enough payoff
- Analytics events on demo/chat usage (existing umami covers; specific funnel tracking is post-launch)
- Multi-wallet demo support (single hardcoded wallet only)
- Demo coverage of non-Dashboard views (Vault, Chains, Settings, Keys)
- Mainnet demo wallet (devnet only — mainnet vault is "coming soon" copy from Wave 2a)
- Token-level cost cap on chat (message-cap is the v1 control per D20)
- Refactor `verifyAttempts` in `routes/auth.ts` to use the new `lib/ip-rate-limit.ts` module (post-launch cleanup)
- Phase D launch close (3-wallet manual QA + X thread #1) — RECTOR-driven gates AFTER Wave 2b ships
- Tier 2/3 deferred polish items (Tooltip cloneElement, Sheet onClose, Banner copy differentiation, etc.) — separate post-launch cleanup

---

## Carry-forward conventions (stable across sprint)

1. NO AI attribution in commits / PRs / files
2. NO semicolons in TS/TSX (single quotes for imports)
3. Conventional commits with appropriate scope (`fix(app)`, `test(app)`, `feat(app)`, `chore(app)`, `refactor(app)`, `feat(agent)`, etc.)
4. NEVER amend commits; create new ones
5. TDD discipline (failing test → implement → passing test) for code changes
6. CI must be green before merge; if flaky, retry once before investigating
7. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch
8. Multi-issue PRs use ONE `Closes #X` per line in description (NOT comma-separated) — `gh` auto-closes only the FIRST match
9. Subagent-driven for genuinely complex; INLINE for mechanical (PR-0 INLINE, F1/F2/F3 SUBAGENT)
10. Use `superpowers:verification-before-completion` before claiming any task done
11. Switch to main BEFORE running `gh pr merge` (avoid worktree-owns-branch local-cleanup quirk)
12. Build `@sipher/sdk` (`pnpm --filter "@sipher/sdk" build`) before running agent tests in a fresh worktree
13. Run app tests from inside `app/` directory: `cd app && pnpm test --run src/...`
14. Typecheck command is `pnpm exec tsc --noEmit` from `app/`
15. Subagent prompts must include explicit out-of-scope list to prevent scope drift across clusters
16. Push spec+plan to origin BEFORE creating cluster PRs (keeps PR diffs clean)
17. Subagent prompts reference plan file (rather than inlining full prompt text) — keeps Agent dispatch prompts tight

---

## Phase D gate trajectory

| Milestone                                  | qa-skill open count | Phase D `--diff-from` gate |
| ------------------------------------------ | ------------------- | -------------------------- |
| Pre-Wave 2b baseline (post-frontier_50)    | 3                   | 🟡 not yet zero            |
| PR-0 foundation merges                     | 3                   | 🟡 not yet zero            |
| Cluster F1 #216 merges                     | 2                   | 🟡 not yet zero            |
| Cluster F2 #217 merges                     | 1                   | 🟡 not yet zero            |
| Cluster F3 #218 merges                     | 0                   | ✅ flips green             |
| 3-wallet QA + X thread review              | 0                   | ✅ Phase D launch          |

**After Wave 2b ships: 35 of 35 qa-skill closed (100%). Phase D launches once RECTOR-driven gates close (3-wallet QA + X thread #1).**

---

## Plan scope note

**The implementation plan written immediately after this spec covers PR-0 + F1 + F2 + F3** (4 macro-tasks corresponding to the 4 PRs). Each cluster section in the plan includes per-task TDD steps that subagents follow.

This keeps the plan to a manageable size (~4 sections × ~6-8 tasks per section = ~24-32 tasks total).

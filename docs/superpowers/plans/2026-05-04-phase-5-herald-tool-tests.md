# Phase 5 PR-3 — HERALD Tool Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct unit-level test coverage for the 7 HERALD agent tools that the 2026-04-18 audit flagged. Each tool gets its own test file under `packages/agent/tests/herald/tools/<name>.test.ts`. No umbrella migration (HERALD has no equivalent of SENTINEL's `read.test.ts` / `action.test.ts`). Existing `read-mentions.test.ts` and `post-tweet.test.ts` stay UNTOUCHED. Tests follow the six-row sheet from the spec — happy path, input validation, internal branches, service-error handling, output-shape lock, spy assertions on service calls. Heavy boundary mocking — real tool body, no I/O, no real X API. Zero source changes.

**Architecture:** 7 new test files in `packages/agent/tests/herald/tools/<tool>.test.ts`, one shared fixture at `packages/agent/tests/fixtures/herald-tool-mocks.ts` (data-shape factories only — no `vi.fn()` exports, TDZ-safe). Each test file inlines its own `vi.mock` factory for `../../../src/herald/x-client.js`, `../../../src/herald/budget.js`, and (where relevant) `../../../src/coordination/event-bus.js` and `../../../src/db.js`, using `vi.hoisted` for mock-fn declarations. Pattern matches PR-2's `packages/agent/tests/sentinel/tools/check-reputation.test.ts` and `add-to-blacklist.test.ts` exactly. No umbrella deletion task — HERALD has no umbrellas. No cross-tool task — registry/executor coverage already lives in `tests/herald/herald.test.ts`.

**Tech Stack:** Vitest 1.x, `twitter-api-v2` (mocked at `x-client.ts` boundary, NOT the library), `ulid`, `@mariozechner/pi-ai` (tool adapter types).

**Spec:** `docs/superpowers/specs/2026-05-03-phase-5-tool-unit-tests-design.md`

**Branch:** `feat/phase-5-herald-tool-tests` (already created from main at `74c7e5d`)

**Estimated scope:** ~98 new tests across 7 per-tool files + 1 fixture file. Net delta: ~+98 agent tests (1180 → ~1278). Single PR. ~2-3 sessions.

---

## Pre-flight Verification

- [ ] **Step 0a: Confirm branch state**

```bash
cd /Users/rector/local-dev/sipher
git branch --show-current
git log --oneline -3
git status
```

Expected:
```
feat/phase-5-herald-tool-tests
74c7e5d Merge pull request #165 from sip-protocol/feat/phase-5-sentinel-tool-tests
519aafa test(sentinel): close service-error gaps + add file-path headers (final review)
c910a5c docs: bump agent test counts after Phase 5 PR-2 (1050 → 1176, 83 → 96 suites)
On branch feat/phase-5-herald-tool-tests
nothing to commit, working tree clean
```

- [ ] **Step 0b: Confirm baseline test counts**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -5
pnpm test -- --run 2>&1 | tail -5
pnpm --filter @sipher/app test -- --run 2>&1 | tail -5
```

Expected:
- agent: `Tests  1180 passed` (PR-2 baseline)
- root: `Tests  555 passed`
- app: `Tests  45 passed`

- [ ] **Step 0c: Confirm typecheck baseline**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 0d: Commit this plan first**

```bash
git add docs/superpowers/plans/2026-05-04-phase-5-herald-tool-tests.md
git commit -m "docs(plan): add Phase 5 PR-3 plan for HERALD tool tests"
```

---

## Source Tool Inventory

This is the source-of-truth surface for all 7 tools. Each per-tool task references this row.

| Tool | Source file | Boundary mocks | Notable branches | Bus event |
|------|-------------|----------------|------------------|-----------|
| `likeTweet` | `like-tweet.ts` | `getWriteClient` (returns client w/ `.v2.like`), `getHeraldUserId`, `canMakeCall`, `trackXApiCost` | budget gate returns `{liked:false}` (silent); empty `tweet_id` throws | None |
| `readDMs` | `read-dms.ts` | `getWriteClient` (returns client w/ `.v2.listDmEvents`), `canMakeCall`, `trackXApiCost` | budget gate returns empty; **401/403/"not authorized" → rescued to empty** vs other errors → rethrow; max_results clamp 1-100 default 10 | None |
| `readUserProfile` | `read-user.ts` | `getReadClient` (returns client w/ `.v2.userByUsername`), `canMakeCall`, `trackXApiCost` | empty `username` throws; gate → `user:null`; `@` prefix strip; no data → `user:null` | None |
| `replyTweet` | `reply-tweet.ts` | `getWriteClient` (returns client w/ `.v2.reply`), `canMakeCall`, `trackXApiCost` | budget gate **THROWS** (not silent); empty `tweet_id` / `text` throws | None |
| `schedulePost` | `schedule-post.ts` | `getDb` (returns object w/ `.prepare(sql).run(...)`), `ulid()` | DB-only tool; no x-client surface; empty `text` / `scheduled_at` throws | None |
| `searchPosts` | `search-posts.ts` | `getReadClient` (returns client w/ `.v2.search`), `canMakeCall`, `trackXApiCost` | empty `query` throws; gate returns empty; max_results clamp 10-100 default 10 | None |
| `sendDM` | `send-dm.ts` | `getWriteClient` (returns client w/ `.v2.sendDmToParticipant`), `canMakeCall`, `trackXApiCost`, **`guardianBus.emit`** | budget gate **THROWS**; empty `user_id` / `text` throws | **YES — `herald:dm` routine** |

**Mock paths (all relative to `tests/herald/tools/<name>.test.ts`):**
- `../../../src/herald/x-client.js` — `getReadClient`, `getWriteClient`, `getHeraldUserId`
- `../../../src/herald/budget.js` — `canMakeCall`, `trackXApiCost`
- `../../../src/coordination/event-bus.js` — `guardianBus` (only `sendDM`)
- `../../../src/db.js` — `getDb` (only `schedulePost`)
- `ulid` — bare-module mock (only `schedulePost`)

**Out of scope (untouched):**
- `packages/agent/src/herald/tools/post-tweet.ts` ↔ `packages/agent/tests/herald/tools/post-tweet.test.ts` (existing direct test, older `twitter-api-v2`-mock style)
- `packages/agent/src/herald/tools/read-mentions.ts` ↔ `packages/agent/tests/herald/tools/read-mentions.test.ts` (existing direct test)

---

## Task 1: Shared Fixture File

**Files:**
- Create: `packages/agent/tests/fixtures/herald-tool-mocks.ts`

The fixture file exports DATA-SHAPE factories that match the shapes returned by `twitter-api-v2`'s `client.v2.*` methods (as observed by the tools), plus shared X-API constants (valid tweet ID, valid user ID, sample username). **No `vi.fn()` exports** — those go inline per test file via `vi.hoisted` to avoid Vitest TDZ at module load. The fixture is data-shapes ONLY, matching PR-2's locked pattern.

- [ ] **Step 1.1: Create the fixture file**

```typescript
// packages/agent/tests/fixtures/herald-tool-mocks.ts
//
// Shared data-shape factories for HERALD tool tests (Phase 5 PR-3).
// Each factory returns the shape that real twitter-api-v2 client methods
// return as observed by HERALD tools (which read .data and .data.data
// projections, NOT the full TwitterApi SDK response envelope).
//
// NOTE: This file does NOT export vi.fn() instances. Vitest hoists vi.mock
// above imports, so vi.fn() instances must be declared per-test-file via
// vi.hoisted to avoid TDZ. This file holds DATA shapes only — call sites
// pass them into mockResolvedValueOnce / mockReturnValueOnce inside tests.

// ─────────────────────────────────────────────────────────────────────────────
// Test constants
// ─────────────────────────────────────────────────────────────────────────────

/** Sample numeric tweet ID (X uses 64-bit ints serialized as strings) */
export const VALID_TWEET_ID = '1786543210987654321'

/** Sample numeric user ID */
export const VALID_USER_ID = '1234567890'

/** Sample HERALD bot user ID (used by likeTweet via getHeraldUserId) */
export const HERALD_USER_ID = '9876543210'

/** Sample username (no @ prefix — tools strip it) */
export const VALID_USERNAME = 'SipProtocol'

/** Sample DM event ID returned by sendDmToParticipant */
export const VALID_DM_EVENT_ID = 'dm_event_42'

/** Sample reply tweet ID returned by .v2.reply */
export const VALID_REPLY_TWEET_ID = '1786543210987654322'

/** Sample post text */
export const SAMPLE_POST_TEXT = 'Privacy is normal.'

/** Sample search query */
export const SAMPLE_SEARCH_QUERY = 'SIP Protocol privacy'

/** Sample DM body */
export const SAMPLE_DM_TEXT = 'Hello from HERALD'

// ─────────────────────────────────────────────────────────────────────────────
// twitter-api-v2 response shapes — partial, matching what HERALD tools read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shape of an entry in `client.v2.search()` response.data.data[].
 * Matches the projection HERALD's searchPosts tool maps over (id, text,
 * author_id, created_at, public_metrics).
 */
export interface XTweetShape {
  id: string
  text: string
  author_id?: string
  created_at?: string
  public_metrics?: {
    like_count?: number
    retweet_count?: number
    reply_count?: number
  }
}

export function makeXTweet(overrides: Partial<XTweetShape> = {}): XTweetShape {
  return {
    id: VALID_TWEET_ID,
    text: 'sample tweet text',
    author_id: VALID_USER_ID,
    created_at: '2026-05-04T00:00:00.000Z',
    public_metrics: {
      like_count: 5,
      retweet_count: 1,
      reply_count: 2,
    },
    ...overrides,
  }
}

/**
 * Shape of `client.v2.userByUsername()` response.data.
 * Matches the projection HERALD's readUserProfile tool reads (id, name,
 * username, description, verified, public_metrics, created_at).
 */
export interface XUserShape {
  id: string
  name: string
  username: string
  description?: string
  verified?: boolean
  public_metrics?: {
    followers_count?: number
    following_count?: number
    tweet_count?: number
    listed_count?: number
  }
  created_at?: string
}

export function makeXUser(overrides: Partial<XUserShape> = {}): XUserShape {
  return {
    id: VALID_USER_ID,
    name: 'SIP Protocol',
    username: VALID_USERNAME,
    description: 'Privacy standard for Web3',
    verified: false,
    public_metrics: {
      followers_count: 1000,
      following_count: 100,
      tweet_count: 250,
      listed_count: 10,
    },
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Shape of an entry in `client.v2.listDmEvents()` response.data.data[].
 * The DMEventV2 typings in twitter-api-v2 are incomplete; HERALD's readDMs
 * tool reads these fields directly via a local `DMEventFields` interface.
 */
export interface XDmEventShape {
  id: string
  text?: string
  event_type?: string
  created_at?: string
  sender_id?: string
}

export function makeXDmEvent(overrides: Partial<XDmEventShape> = {}): XDmEventShape {
  return {
    id: VALID_DM_EVENT_ID,
    text: 'incoming dm body',
    event_type: 'MessageCreate',
    created_at: '2026-05-04T00:00:00.000Z',
    sender_id: VALID_USER_ID,
    ...overrides,
  }
}

/**
 * Shape of `client.v2.reply()` response.data — single tweet with id and text.
 * Used by HERALD's replyTweet tool (it reads response.data.id only).
 */
export interface XReplyShape {
  id: string
  text: string
}

export function makeXReply(overrides: Partial<XReplyShape> = {}): XReplyShape {
  return {
    id: VALID_REPLY_TWEET_ID,
    text: 'sample reply body',
    ...overrides,
  }
}

/**
 * Shape of `client.v2.sendDmToParticipant()` response — flat object with
 * `dm_event_id`. Used by HERALD's sendDM tool.
 */
export interface XSendDmResultShape {
  dm_event_id: string
  dm_conversation_id?: string
}

export function makeXSendDmResult(
  overrides: Partial<XSendDmResultShape> = {},
): XSendDmResultShape {
  return {
    dm_event_id: VALID_DM_EVENT_ID,
    dm_conversation_id: 'conv_001',
    ...overrides,
  }
}
```

- [ ] **Step 1.2: Verify fixture compiles**

```bash
pnpm typecheck 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 1.3: Commit**

```bash
git add packages/agent/tests/fixtures/herald-tool-mocks.ts
git commit -m "test(herald): add shared fixture for HERALD tool tests"
```

---

## Task 2: like-tweet.test.ts (PATTERN SETTER — pause for review)

**Files:**
- Test: `packages/agent/tests/herald/tools/like-tweet.test.ts` (NEW)

**Source under test:** `packages/agent/src/herald/tools/like-tweet.ts` (50 lines)

`executeLikeTweet` checks budget gate (silent return on block), validates `tweet_id`, calls `getHeraldUserId()` + `getWriteClient()`, invokes `client.v2.like(userId, tweet_id)`, then `trackXApiCost('user_interaction', 1)` and returns `{ liked: true }`.

**Why pattern setter:** Has the full HERALD mock surface (x-client + budget) without bus event or DB — cleanest baseline. PR-2 used `check-reputation.test.ts` as its pattern setter for the same reason. After this task, the next 6 follow the same pattern verbatim with surface adjustments.

**Mocks needed:**
- `../../../src/herald/x-client.js` — `getWriteClient`, `getHeraldUserId`
- `../../../src/herald/budget.js` — `canMakeCall`, `trackXApiCost`

- [ ] **Step 2.1: Write test file scaffolding + tool definition tests**

```typescript
// packages/agent/tests/herald/tools/like-tweet.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VALID_TWEET_ID, HERALD_USER_ID } from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockGetHeraldUserId,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockLike,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockGetHeraldUserId: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockLike: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
  getHeraldUserId: mockGetHeraldUserId,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  likeTweetTool,
  executeLikeTweet,
} from '../../../src/herald/tools/like-tweet.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetHeraldUserId.mockReturnValue(HERALD_USER_ID)
  mockGetWriteClient.mockReturnValue({ v2: { like: mockLike } })
  mockLike.mockResolvedValue({ data: { liked: true } })
})

describe('likeTweetTool definition', () => {
  it('has correct name', () => {
    expect(likeTweetTool.name).toBe('likeTweet')
  })

  it('declares required tweet_id field', () => {
    const schema = likeTweetTool.parameters as { required: string[] }
    expect(schema.required).toEqual(['tweet_id'])
  })

  it('has a non-empty description', () => {
    expect(likeTweetTool.description.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2.2: Run definition tests**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/like-tweet.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  3 passed`.

- [ ] **Step 2.3: Add happy-path + branch tests**

Append to the test file:

```typescript
describe('executeLikeTweet — happy path', () => {
  it('returns { liked: true } when budget gate is open', async () => {
    const r = await executeLikeTweet({ tweet_id: VALID_TWEET_ID })
    expect(r).toEqual({ liked: true })
  })
})

describe('executeLikeTweet — branches', () => {
  it('returns { liked: false } silently when budget gate blocks user_interaction', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeLikeTweet({ tweet_id: VALID_TWEET_ID })

    expect(r).toEqual({ liked: false })
    expect(mockLike).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('throws when tweet_id is empty string', async () => {
    await expect(
      executeLikeTweet({ tweet_id: '' }),
    ).rejects.toThrow(/tweet_id is required/i)
    expect(mockLike).not.toHaveBeenCalled()
  })

  it('throws when tweet_id is whitespace-only', async () => {
    await expect(
      executeLikeTweet({ tweet_id: '   ' }),
    ).rejects.toThrow(/tweet_id is required/i)
    expect(mockLike).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2.4: Add service interaction + service-error tests**

Append to the test file:

```typescript
describe('executeLikeTweet — service interaction', () => {
  it('calls canMakeCall with "user_interaction"', async () => {
    await executeLikeTweet({ tweet_id: VALID_TWEET_ID })
    expect(mockCanMakeCall).toHaveBeenCalledWith('user_interaction')
  })

  it('calls v2.like with HERALD user id and supplied tweet_id', async () => {
    await executeLikeTweet({ tweet_id: VALID_TWEET_ID })

    expect(mockLike).toHaveBeenCalledTimes(1)
    expect(mockLike).toHaveBeenCalledWith(HERALD_USER_ID, VALID_TWEET_ID)
  })

  it('tracks user_interaction cost with resource count 1', async () => {
    await executeLikeTweet({ tweet_id: VALID_TWEET_ID })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('user_interaction', 1)
  })

  it('propagates v2.like throw (rate limit / network / auth)', async () => {
    mockLike.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeLikeTweet({ tweet_id: VALID_TWEET_ID }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2.5: Run full test file**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/like-tweet.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  11 passed`.

- [ ] **Step 2.6: Confirm branch and commit**

```bash
git branch --show-current
```

Expected: `feat/phase-5-herald-tool-tests`. If different (PR-2 detached-HEAD gotcha), recover before commit.

```bash
git add packages/agent/tests/herald/tools/like-tweet.test.ts
git commit -m "test(herald): add direct unit tests for like-tweet tool"
```

- [ ] **Step 2.7: PAUSE — pattern review checkpoint**

This is the pattern setter. Before continuing to Tasks 3-8, the dispatching agent should run two reviews:
1. **Spec compliance** — does this file follow the six-row sheet? Does it use `vi.hoisted`, `vi.clearAllMocks`, fixture imports, `expect.stringMatching` (where applicable)?
2. **Code quality** (`superpowers:code-reviewer`) — anything off about the assertion style or mock surface?

Fix any pattern issues HERE before they propagate to 6 more files.

---

## Task 3: read-user.test.ts (read tool with @-strip + null-data branch)

**Files:**
- Test: `packages/agent/tests/herald/tools/read-user.test.ts` (NEW)

**Source under test:** `packages/agent/src/herald/tools/read-user.ts` (85 lines)

`executeReadUserProfile` validates non-empty `username`, strips leading `@`, checks budget gate (returns `{user:null,cost:0}`), calls `client.v2.userByUsername(username, fields)`, tracks `user_read` cost, and returns `{user, cost}` or `{user:null, cost:0.01}` if response.data is missing.

**Mocks needed:**
- `../../../src/herald/x-client.js` — `getReadClient`
- `../../../src/herald/budget.js` — `canMakeCall`, `trackXApiCost`

- [ ] **Step 3.1: Write the full test file**

```typescript
// packages/agent/tests/herald/tools/read-user.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VALID_USERNAME, makeXUser } from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetReadClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockUserByUsername,
} = vi.hoisted(() => ({
  mockGetReadClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockUserByUsername: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getReadClient: mockGetReadClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  readUserProfileTool,
  executeReadUserProfile,
} from '../../../src/herald/tools/read-user.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetReadClient.mockReturnValue({ v2: { userByUsername: mockUserByUsername } })
  mockUserByUsername.mockResolvedValue({ data: makeXUser() })
})

describe('readUserProfileTool definition', () => {
  it('has correct name', () => {
    expect(readUserProfileTool.name).toBe('readUserProfile')
  })

  it('declares required username field', () => {
    const schema = readUserProfileTool.parameters as { required: string[] }
    expect(schema.required).toEqual(['username'])
  })

  it('has a non-empty description', () => {
    expect(readUserProfileTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeReadUserProfile — happy path', () => {
  it('returns user shape and cost 0.01 when API returns data', async () => {
    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r.cost).toBe(0.01)
    expect(r.user?.username).toBe(VALID_USERNAME)
    expect(r.user?.id).toBeDefined()
    expect(r.user?.name).toBeDefined()
  })

  it('output shape includes id, name, username, description, verified, public_metrics, created_at', async () => {
    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r.user).not.toBeNull()
    const keys = Object.keys(r.user!).sort()
    expect(keys).toEqual([
      'created_at',
      'description',
      'id',
      'name',
      'public_metrics',
      'username',
      'verified',
    ])
  })
})

describe('executeReadUserProfile — branches', () => {
  it('throws when username is empty string', async () => {
    await expect(
      executeReadUserProfile({ username: '' }),
    ).rejects.toThrow(/username is required/i)
    expect(mockUserByUsername).not.toHaveBeenCalled()
  })

  it('throws when username is whitespace-only', async () => {
    await expect(
      executeReadUserProfile({ username: '   ' }),
    ).rejects.toThrow(/username is required/i)
  })

  it('strips leading @ before calling API', async () => {
    await executeReadUserProfile({ username: '@SipProtocol' })

    expect(mockUserByUsername).toHaveBeenCalledTimes(1)
    expect(mockUserByUsername.mock.calls[0][0]).toBe('SipProtocol')
  })

  it('returns { user: null, cost: 0 } when budget gate blocks user_read', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r).toEqual({ user: null, cost: 0 })
    expect(mockUserByUsername).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('returns { user: null, cost: 0.01 } when API response.data is missing', async () => {
    mockUserByUsername.mockResolvedValueOnce({ data: null })

    const r = await executeReadUserProfile({ username: VALID_USERNAME })

    expect(r.user).toBeNull()
    expect(r.cost).toBe(0.01)
    expect(mockTrackXApiCost).toHaveBeenCalledWith('user_read', 1)
  })
})

describe('executeReadUserProfile — service interaction', () => {
  it('calls canMakeCall with "user_read"', async () => {
    await executeReadUserProfile({ username: VALID_USERNAME })
    expect(mockCanMakeCall).toHaveBeenCalledWith('user_read')
  })

  it('calls v2.userByUsername with stripped username and full user.fields list', async () => {
    await executeReadUserProfile({ username: VALID_USERNAME })

    expect(mockUserByUsername).toHaveBeenCalledTimes(1)
    expect(mockUserByUsername).toHaveBeenCalledWith(VALID_USERNAME, {
      'user.fields': [
        'id',
        'name',
        'username',
        'description',
        'verified',
        'public_metrics',
        'created_at',
      ],
    })
  })

  it('tracks user_read cost with resource count 1', async () => {
    await executeReadUserProfile({ username: VALID_USERNAME })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('user_read', 1)
  })

  it('propagates v2.userByUsername throw (rate limit / network / auth)', async () => {
    mockUserByUsername.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeReadUserProfile({ username: VALID_USERNAME }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3.2: Run test file**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/read-user.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  14 passed`.

- [ ] **Step 3.3: Confirm branch and commit**

```bash
git branch --show-current
git add packages/agent/tests/herald/tools/read-user.test.ts
git commit -m "test(herald): add direct unit tests for read-user tool"
```

---

## Task 4: search-posts.test.ts (read tool with max_results clamp)

**Files:**
- Test: `packages/agent/tests/herald/tools/search-posts.test.ts` (NEW)

**Source under test:** `packages/agent/src/herald/tools/search-posts.ts` (82 lines)

`executeSearchPosts` validates non-empty `query`, checks budget gate (returns `{posts:[], cost:0}`), clamps `max_results` to [10, 100] with default 10, calls `client.v2.search(query, opts)`, tracks `search_read` cost (resourceCount = tweets.length || 1), and returns `{posts, cost: resourceCount * 0.005}`.

**Mocks needed:**
- `../../../src/herald/x-client.js` — `getReadClient`
- `../../../src/herald/budget.js` — `canMakeCall`, `trackXApiCost`

- [ ] **Step 4.1: Write the full test file**

```typescript
// packages/agent/tests/herald/tools/search-posts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SAMPLE_SEARCH_QUERY, makeXTweet } from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetReadClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockSearch,
} = vi.hoisted(() => ({
  mockGetReadClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockSearch: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getReadClient: mockGetReadClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  searchPostsTool,
  executeSearchPosts,
} from '../../../src/herald/tools/search-posts.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetReadClient.mockReturnValue({ v2: { search: mockSearch } })
  mockSearch.mockResolvedValue({ data: { data: [makeXTweet(), makeXTweet({ id: '2' })] } })
})

describe('searchPostsTool definition', () => {
  it('has correct name', () => {
    expect(searchPostsTool.name).toBe('searchPosts')
  })

  it('declares required query field', () => {
    const schema = searchPostsTool.parameters as { required: string[] }
    expect(schema.required).toEqual(['query'])
  })

  it('has a non-empty description', () => {
    expect(searchPostsTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeSearchPosts — happy path', () => {
  it('returns mapped posts and cost reflecting result count', async () => {
    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(r.posts).toHaveLength(2)
    expect(r.cost).toBeCloseTo(0.01, 5)
    expect(r.posts[0].id).toBeDefined()
    expect(r.posts[0].text).toBeDefined()
  })

  it('output shape projects id, text, author_id, created_at, public_metrics per post', async () => {
    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    const keys = Object.keys(r.posts[0]).sort()
    expect(keys).toEqual(['author_id', 'created_at', 'id', 'public_metrics', 'text'])
  })
})

describe('executeSearchPosts — branches', () => {
  it('throws when query is empty string', async () => {
    await expect(
      executeSearchPosts({ query: '' }),
    ).rejects.toThrow(/search query is required/i)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('throws when query is whitespace-only', async () => {
    await expect(
      executeSearchPosts({ query: '   ' }),
    ).rejects.toThrow(/search query is required/i)
  })

  it('returns { posts: [], cost: 0 } when budget gate blocks search_read', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(r).toEqual({ posts: [], cost: 0 })
    expect(mockSearch).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('clamps max_results below floor (10) up to 10', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY, max_results: 5 })

    const callOpts = mockSearch.mock.calls[0][1] as { max_results: number }
    expect(callOpts.max_results).toBe(10)
  })

  it('clamps max_results above ceiling (100) down to 100', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY, max_results: 500 })

    const callOpts = mockSearch.mock.calls[0][1] as { max_results: number }
    expect(callOpts.max_results).toBe(100)
  })

  it('uses default max_results=10 when omitted', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    const callOpts = mockSearch.mock.calls[0][1] as { max_results: number }
    expect(callOpts.max_results).toBe(10)
  })

  it('returns empty posts array when API returns no data, with cost 0.005 (count=1 floor)', async () => {
    mockSearch.mockResolvedValueOnce({ data: { data: [] } })

    const r = await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(r.posts).toEqual([])
    expect(r.cost).toBeCloseTo(0.005, 5)
    expect(mockTrackXApiCost).toHaveBeenCalledWith('search_read', 1)
  })
})

describe('executeSearchPosts — service interaction', () => {
  it('calls v2.search with verbatim query and tweet.fields list', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })

    expect(mockSearch).toHaveBeenCalledTimes(1)
    expect(mockSearch).toHaveBeenCalledWith(SAMPLE_SEARCH_QUERY, {
      max_results: 10,
      'tweet.fields': ['author_id', 'created_at', 'text', 'public_metrics'],
    })
  })

  it('tracks search_read cost with resourceCount = tweets.length', async () => {
    await executeSearchPosts({ query: SAMPLE_SEARCH_QUERY })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('search_read', 2)
  })

  it('propagates v2.search throw (rate limit / network / auth)', async () => {
    mockSearch.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeSearchPosts({ query: SAMPLE_SEARCH_QUERY }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4.2: Run test file**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/search-posts.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  15 passed`.

- [ ] **Step 4.3: Confirm branch and commit**

```bash
git branch --show-current
git add packages/agent/tests/herald/tools/search-posts.test.ts
git commit -m "test(herald): add direct unit tests for search-posts tool"
```

---

## Task 5: read-dms.test.ts (read tool with auth-error rescue branch)

**Files:**
- Test: `packages/agent/tests/herald/tools/read-dms.test.ts` (NEW)

**Source under test:** `packages/agent/src/herald/tools/read-dms.ts` (92 lines)

`executeReadDMs` checks budget gate (returns `{dms:[], cost:0}`), clamps `max_results` to [1, 100] with default 10, calls `client.v2.listDmEvents(opts)` inside a try/catch:
- On error containing `403`, `401`, or `not authorized`: rescue → return `{dms:[], cost:0}` (no cost tracking)
- Other errors: rethrow
- Success: maps event fields, tracks `dm_read` cost (count = dms.length || 1), returns `{dms, cost: count * 0.01}`

The auth-rescue branch has THREE distinct triggers — each gets its own test row.

**Mocks needed:**
- `../../../src/herald/x-client.js` — `getWriteClient`
- `../../../src/herald/budget.js` — `canMakeCall`, `trackXApiCost`

- [ ] **Step 5.1: Write the full test file**

```typescript
// packages/agent/tests/herald/tools/read-dms.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeXDmEvent } from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockListDmEvents,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockListDmEvents: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  readDMsTool,
  executeReadDMs,
} from '../../../src/herald/tools/read-dms.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetWriteClient.mockReturnValue({ v2: { listDmEvents: mockListDmEvents } })
  mockListDmEvents.mockResolvedValue({
    data: { data: [makeXDmEvent(), makeXDmEvent({ id: 'dm_event_43' })] },
  })
})

describe('readDMsTool definition', () => {
  it('has correct name', () => {
    expect(readDMsTool.name).toBe('readDMs')
  })

  it('declares no required fields (max_results is optional)', () => {
    const schema = readDMsTool.parameters as { required: string[] }
    expect(schema.required).toEqual([])
  })

  it('has a non-empty description', () => {
    expect(readDMsTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeReadDMs — happy path', () => {
  it('returns mapped DMs and cost reflecting result count', async () => {
    const r = await executeReadDMs({})

    expect(r.dms).toHaveLength(2)
    expect(r.cost).toBeCloseTo(0.02, 5)
  })

  it('output shape projects id, text, event_type, created_at, sender_id per DM', async () => {
    const r = await executeReadDMs({})

    const keys = Object.keys(r.dms[0]).sort()
    expect(keys).toEqual(['created_at', 'event_type', 'id', 'sender_id', 'text'])
  })
})

describe('executeReadDMs — branches', () => {
  it('returns { dms: [], cost: 0 } when budget gate blocks dm_read', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
    expect(mockListDmEvents).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('clamps max_results below floor (1) up to 1', async () => {
    await executeReadDMs({ max_results: 0 })

    const callOpts = mockListDmEvents.mock.calls[0][0] as { max_results: number }
    expect(callOpts.max_results).toBe(1)
  })

  it('clamps max_results above ceiling (100) down to 100', async () => {
    await executeReadDMs({ max_results: 500 })

    const callOpts = mockListDmEvents.mock.calls[0][0] as { max_results: number }
    expect(callOpts.max_results).toBe(100)
  })

  it('uses default max_results=10 when omitted', async () => {
    await executeReadDMs({})

    const callOpts = mockListDmEvents.mock.calls[0][0] as { max_results: number }
    expect(callOpts.max_results).toBe(10)
  })

  it('rescues 401 errors to empty result with no cost tracking', async () => {
    mockListDmEvents.mockRejectedValueOnce(new Error('401 Unauthorized'))

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('rescues 403 errors to empty result with no cost tracking', async () => {
    mockListDmEvents.mockRejectedValueOnce(new Error('403 Forbidden'))

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('rescues "not authorized" errors to empty result with no cost tracking', async () => {
    mockListDmEvents.mockRejectedValueOnce(new Error('User is not authorized for DM read'))

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('rescues non-Error throws via String() coercion (e.g. raw string with 401)', async () => {
    mockListDmEvents.mockRejectedValueOnce('401 access denied')

    const r = await executeReadDMs({})

    expect(r).toEqual({ dms: [], cost: 0 })
  })

  it('returns empty dms array when API returns no data, with cost 0.01 (count=1 floor)', async () => {
    mockListDmEvents.mockResolvedValueOnce({ data: { data: [] } })

    const r = await executeReadDMs({})

    expect(r.dms).toEqual([])
    expect(r.cost).toBeCloseTo(0.01, 5)
    expect(mockTrackXApiCost).toHaveBeenCalledWith('dm_read', 1)
  })
})

describe('executeReadDMs — service interaction', () => {
  it('calls v2.listDmEvents with clamped max_results and dm_event.fields list', async () => {
    await executeReadDMs({ max_results: 25 })

    expect(mockListDmEvents).toHaveBeenCalledTimes(1)
    expect(mockListDmEvents).toHaveBeenCalledWith({
      max_results: 25,
      'dm_event.fields': ['id', 'text', 'event_type', 'created_at', 'sender_id'],
    })
  })

  it('tracks dm_read cost with resourceCount = dms.length', async () => {
    await executeReadDMs({})
    expect(mockTrackXApiCost).toHaveBeenCalledWith('dm_read', 2)
  })

  it('rethrows non-auth errors (e.g. 500 server error)', async () => {
    mockListDmEvents.mockRejectedValueOnce(new Error('500 Internal Server Error'))

    await expect(executeReadDMs({})).rejects.toThrow(/500 Internal Server Error/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('rethrows non-auth errors with no recognizable status code', async () => {
    mockListDmEvents.mockRejectedValueOnce(new Error('connection reset'))

    await expect(executeReadDMs({})).rejects.toThrow(/connection reset/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 5.2: Run test file**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/read-dms.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  18 passed`.

- [ ] **Step 5.3: Confirm branch and commit**

```bash
git branch --show-current
git add packages/agent/tests/herald/tools/read-dms.test.ts
git commit -m "test(herald): add direct unit tests for read-dms tool"
```

---

## Task 6: reply-tweet.test.ts (write tool, gate-throws)

**Files:**
- Test: `packages/agent/tests/herald/tools/reply-tweet.test.ts` (NEW)

**Source under test:** `packages/agent/src/herald/tools/reply-tweet.ts` (57 lines)

`executeReplyTweet` checks budget gate (THROWS — unlike read tools), validates non-empty `tweet_id` and `text`, calls `client.v2.reply(text, tweet_id)`, tracks `content_create` cost, and returns `{tweet_id: response.data.id}`.

**Mocks needed:**
- `../../../src/herald/x-client.js` — `getWriteClient`
- `../../../src/herald/budget.js` — `canMakeCall`, `trackXApiCost`

- [ ] **Step 6.1: Write the full test file**

```typescript
// packages/agent/tests/herald/tools/reply-tweet.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VALID_TWEET_ID,
  VALID_REPLY_TWEET_ID,
  makeXReply,
} from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockReply,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockReply: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

import {
  replyTweetTool,
  executeReplyTweet,
} from '../../../src/herald/tools/reply-tweet.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetWriteClient.mockReturnValue({ v2: { reply: mockReply } })
  mockReply.mockResolvedValue({ data: makeXReply() })
})

describe('replyTweetTool definition', () => {
  it('has correct name', () => {
    expect(replyTweetTool.name).toBe('replyTweet')
  })

  it('declares required tweet_id and text fields', () => {
    const schema = replyTweetTool.parameters as { required: string[] }
    expect(schema.required).toEqual(['tweet_id', 'text'])
  })

  it('has a non-empty description', () => {
    expect(replyTweetTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeReplyTweet — happy path', () => {
  it('returns { tweet_id } from v2.reply response', async () => {
    const r = await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'thanks!' })
    expect(r).toEqual({ tweet_id: VALID_REPLY_TWEET_ID })
  })
})

describe('executeReplyTweet — branches', () => {
  it('throws when budget gate blocks content_create (THROWS, not silent)', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    await expect(
      executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' }),
    ).rejects.toThrow(/budget gate.*content_create blocked/i)

    expect(mockReply).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })

  it('throws when tweet_id is empty string', async () => {
    await expect(
      executeReplyTweet({ tweet_id: '', text: 'reply' }),
    ).rejects.toThrow(/tweet_id is required/i)
    expect(mockReply).not.toHaveBeenCalled()
  })

  it('throws when tweet_id is whitespace-only', async () => {
    await expect(
      executeReplyTweet({ tweet_id: '   ', text: 'reply' }),
    ).rejects.toThrow(/tweet_id is required/i)
  })

  it('throws when text is empty string', async () => {
    await expect(
      executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: '' }),
    ).rejects.toThrow(/text is required/i)
    expect(mockReply).not.toHaveBeenCalled()
  })

  it('throws when text is whitespace-only', async () => {
    await expect(
      executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: '   ' }),
    ).rejects.toThrow(/text is required/i)
  })
})

describe('executeReplyTweet — service interaction', () => {
  it('calls canMakeCall with "content_create"', async () => {
    await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' })
    expect(mockCanMakeCall).toHaveBeenCalledWith('content_create')
  })

  it('calls v2.reply with text and tweet_id in correct argument order', async () => {
    await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'thanks for the question' })

    expect(mockReply).toHaveBeenCalledTimes(1)
    expect(mockReply).toHaveBeenCalledWith('thanks for the question', VALID_TWEET_ID)
  })

  it('tracks content_create cost with resource count 1', async () => {
    await executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('content_create', 1)
  })

  it('propagates v2.reply throw (rate limit / network / auth)', async () => {
    mockReply.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeReplyTweet({ tweet_id: VALID_TWEET_ID, text: 'reply' }),
    ).rejects.toThrow(/429 rate limit/)
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6.2: Run test file**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/reply-tweet.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  13 passed`.

- [ ] **Step 6.3: Confirm branch and commit**

```bash
git branch --show-current
git add packages/agent/tests/herald/tools/reply-tweet.test.ts
git commit -m "test(herald): add direct unit tests for reply-tweet tool"
```

---

## Task 7: send-dm.test.ts (write tool with bus event)

**Files:**
- Test: `packages/agent/tests/herald/tools/send-dm.test.ts` (NEW)

**Source under test:** `packages/agent/src/herald/tools/send-dm.ts` (69 lines)

`executeSendDM` checks budget gate (THROWS), validates non-empty `user_id` and `text`, calls `client.v2.sendDmToParticipant(user_id, {text})`, tracks `dm_create` cost, emits `herald:dm` event on `guardianBus` (level: routine), and returns `{sent: true, dm_id}`.

The bus emit assertion uses the locked PR-2 pattern: `toStrictEqual` + `expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)` for the timestamp. Service-error test must verify NO bus event is emitted when v2.sendDmToParticipant throws.

**Mocks needed:**
- `../../../src/herald/x-client.js` — `getWriteClient`
- `../../../src/herald/budget.js` — `canMakeCall`, `trackXApiCost`
- `../../../src/coordination/event-bus.js` — `guardianBus.emit`

- [ ] **Step 7.1: Write the full test file**

```typescript
// packages/agent/tests/herald/tools/send-dm.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  VALID_USER_ID,
  VALID_DM_EVENT_ID,
  SAMPLE_DM_TEXT,
  makeXSendDmResult,
} from '../../fixtures/herald-tool-mocks.js'

const {
  mockGetWriteClient,
  mockCanMakeCall,
  mockTrackXApiCost,
  mockSendDmToParticipant,
  mockGuardianEmit,
} = vi.hoisted(() => ({
  mockGetWriteClient: vi.fn(),
  mockCanMakeCall: vi.fn(),
  mockTrackXApiCost: vi.fn(),
  mockSendDmToParticipant: vi.fn(),
  mockGuardianEmit: vi.fn(),
}))

vi.mock('../../../src/herald/x-client.js', () => ({
  getWriteClient: mockGetWriteClient,
}))

vi.mock('../../../src/herald/budget.js', () => ({
  canMakeCall: mockCanMakeCall,
  trackXApiCost: mockTrackXApiCost,
}))

vi.mock('../../../src/coordination/event-bus.js', () => ({
  guardianBus: { emit: mockGuardianEmit },
}))

import {
  sendDMTool,
  executeSendDM,
} from '../../../src/herald/tools/send-dm.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockCanMakeCall.mockReturnValue(true)
  mockGetWriteClient.mockReturnValue({
    v2: { sendDmToParticipant: mockSendDmToParticipant },
  })
  mockSendDmToParticipant.mockResolvedValue(makeXSendDmResult())
})

describe('sendDMTool definition', () => {
  it('has correct name', () => {
    expect(sendDMTool.name).toBe('sendDM')
  })

  it('declares required user_id and text fields', () => {
    const schema = sendDMTool.parameters as { required: string[] }
    expect(schema.required).toEqual(['user_id', 'text'])
  })

  it('has a non-empty description', () => {
    expect(sendDMTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeSendDM — happy path', () => {
  it('returns { sent: true, dm_id } from v2.sendDmToParticipant response', async () => {
    const r = await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })
    expect(r).toEqual({ sent: true, dm_id: VALID_DM_EVENT_ID })
  })
})

describe('executeSendDM — branches', () => {
  it('throws when budget gate blocks dm_create (THROWS, not silent)', async () => {
    mockCanMakeCall.mockReturnValueOnce(false)

    await expect(
      executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT }),
    ).rejects.toThrow(/budget gate.*dm_create blocked/i)

    expect(mockSendDmToParticipant).not.toHaveBeenCalled()
    expect(mockTrackXApiCost).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it('throws when user_id is empty string', async () => {
    await expect(
      executeSendDM({ user_id: '', text: SAMPLE_DM_TEXT }),
    ).rejects.toThrow(/user_id is required/i)
    expect(mockSendDmToParticipant).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it('throws when user_id is whitespace-only', async () => {
    await expect(
      executeSendDM({ user_id: '   ', text: SAMPLE_DM_TEXT }),
    ).rejects.toThrow(/user_id is required/i)
  })

  it('throws when text is empty string', async () => {
    await expect(
      executeSendDM({ user_id: VALID_USER_ID, text: '' }),
    ).rejects.toThrow(/text is required/i)
    expect(mockSendDmToParticipant).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })

  it('throws when text is whitespace-only', async () => {
    await expect(
      executeSendDM({ user_id: VALID_USER_ID, text: '   ' }),
    ).rejects.toThrow(/text is required/i)
  })
})

describe('executeSendDM — service interaction', () => {
  it('calls canMakeCall with "dm_create"', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })
    expect(mockCanMakeCall).toHaveBeenCalledWith('dm_create')
  })

  it('calls v2.sendDmToParticipant with user_id and {text} payload', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })

    expect(mockSendDmToParticipant).toHaveBeenCalledTimes(1)
    expect(mockSendDmToParticipant).toHaveBeenCalledWith(VALID_USER_ID, {
      text: SAMPLE_DM_TEXT,
    })
  })

  it('tracks dm_create cost with resource count 1', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })
    expect(mockTrackXApiCost).toHaveBeenCalledWith('dm_create', 1)
  })

  it('emits herald:dm event with user_id and dm_id in data, level routine', async () => {
    await executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT })

    expect(mockGuardianEmit).toHaveBeenCalledTimes(1)
    const [event] = mockGuardianEmit.mock.calls[0]
    expect(event).toStrictEqual({
      source: 'herald',
      type: 'herald:dm',
      level: 'routine',
      data: { user_id: VALID_USER_ID, dm_id: VALID_DM_EVENT_ID },
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    })
  })

  it('propagates v2.sendDmToParticipant throw and does NOT emit bus event', async () => {
    mockSendDmToParticipant.mockRejectedValueOnce(new Error('429 rate limit'))

    await expect(
      executeSendDM({ user_id: VALID_USER_ID, text: SAMPLE_DM_TEXT }),
    ).rejects.toThrow(/429 rate limit/)

    expect(mockTrackXApiCost).not.toHaveBeenCalled()
    expect(mockGuardianEmit).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 7.2: Run test file**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/send-dm.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  14 passed`.

- [ ] **Step 7.3: Confirm branch and commit**

```bash
git branch --show-current
git add packages/agent/tests/herald/tools/send-dm.test.ts
git commit -m "test(herald): add direct unit tests for send-dm tool"
```

---

## Task 8: schedule-post.test.ts (DB-only tool, no x-client surface)

**Files:**
- Test: `packages/agent/tests/herald/tools/schedule-post.test.ts` (NEW)

**Source under test:** `packages/agent/src/herald/tools/schedule-post.ts` (58 lines)

`executeSchedulePost` is the odd-one-out — no X-API surface at all. It validates non-empty `text` and `scheduled_at`, generates a ulid, calls `getDb()`, prepares an INSERT into `herald_queue`, runs it with the params, and returns `{queued: true, id}`.

This is the only HERALD tool that uses `getDb()` (from `'../../db.js'` relative to source). Mock surface is `getDb` + `ulid`. Mocking `ulid` enables deterministic `id` assertions.

**Mocks needed:**
- `../../../src/db.js` — `getDb`
- `ulid` — bare-module mock for deterministic id

- [ ] **Step 8.1: Write the full test file**

```typescript
// packages/agent/tests/herald/tools/schedule-post.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SAMPLE_POST_TEXT } from '../../fixtures/herald-tool-mocks.js'

const SCHEDULED_AT = '2026-12-01T09:00:00Z'
const FAKE_ULID = '01HZZZQQQQQQQQQQQQQQQQQQQQ'

const {
  mockGetDb,
  mockUlid,
  mockPrepare,
  mockRun,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockUlid: vi.fn(),
  mockPrepare: vi.fn(),
  mockRun: vi.fn(),
}))

vi.mock('../../../src/db.js', () => ({
  getDb: mockGetDb,
}))

vi.mock('ulid', () => ({
  ulid: mockUlid,
}))

import {
  schedulePostTool,
  executeSchedulePost,
} from '../../../src/herald/tools/schedule-post.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockUlid.mockReturnValue(FAKE_ULID)
  mockPrepare.mockReturnValue({ run: mockRun })
  mockGetDb.mockReturnValue({ prepare: mockPrepare })
  mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 })
})

describe('schedulePostTool definition', () => {
  it('has correct name', () => {
    expect(schedulePostTool.name).toBe('schedulePost')
  })

  it('declares required text and scheduled_at fields', () => {
    const schema = schedulePostTool.parameters as { required: string[] }
    expect(schema.required).toEqual(['text', 'scheduled_at'])
  })

  it('has a non-empty description', () => {
    expect(schedulePostTool.description.length).toBeGreaterThan(0)
  })
})

describe('executeSchedulePost — happy path', () => {
  it('returns { queued: true, id } with the ulid as id', async () => {
    const r = await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })
    expect(r).toEqual({ queued: true, id: FAKE_ULID })
  })

  it('output shape has exactly { queued, id }', async () => {
    const r = await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })
    expect(Object.keys(r).sort()).toEqual(['id', 'queued'])
  })
})

describe('executeSchedulePost — branches', () => {
  it('throws when text is empty string', async () => {
    await expect(
      executeSchedulePost({ text: '', scheduled_at: SCHEDULED_AT }),
    ).rejects.toThrow(/text is required/i)
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('throws when text is whitespace-only', async () => {
    await expect(
      executeSchedulePost({ text: '   ', scheduled_at: SCHEDULED_AT }),
    ).rejects.toThrow(/text is required/i)
  })

  it('throws when scheduled_at is empty string', async () => {
    await expect(
      executeSchedulePost({ text: SAMPLE_POST_TEXT, scheduled_at: '' }),
    ).rejects.toThrow(/scheduled_at is required/i)
    expect(mockPrepare).not.toHaveBeenCalled()
  })

  it('throws when scheduled_at is whitespace-only', async () => {
    await expect(
      executeSchedulePost({ text: SAMPLE_POST_TEXT, scheduled_at: '   ' }),
    ).rejects.toThrow(/scheduled_at is required/i)
  })
})

describe('executeSchedulePost — service interaction', () => {
  it('prepares an INSERT into herald_queue', async () => {
    await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })

    expect(mockPrepare).toHaveBeenCalledTimes(1)
    const sql = mockPrepare.mock.calls[0][0] as string
    expect(sql).toMatch(/INSERT INTO herald_queue/i)
    expect(sql).toMatch(/'post'/)
    expect(sql).toMatch(/'pending'/)
  })

  it('runs the INSERT with id, text, scheduled_at, and an ISO created_at', async () => {
    await executeSchedulePost({
      text: SAMPLE_POST_TEXT,
      scheduled_at: SCHEDULED_AT,
    })

    expect(mockRun).toHaveBeenCalledTimes(1)
    const args = mockRun.mock.calls[0]
    expect(args[0]).toBe(FAKE_ULID)
    expect(args[1]).toBe(SAMPLE_POST_TEXT)
    expect(args[2]).toBe(SCHEDULED_AT)
    expect(args[3]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('propagates db prepare throw', async () => {
    mockPrepare.mockImplementationOnce(() => {
      throw new Error('database is locked')
    })

    await expect(
      executeSchedulePost({
        text: SAMPLE_POST_TEXT,
        scheduled_at: SCHEDULED_AT,
      }),
    ).rejects.toThrow(/database is locked/)
  })

  it('propagates db run throw', async () => {
    mockRun.mockImplementationOnce(() => {
      throw new Error('UNIQUE constraint failed')
    })

    await expect(
      executeSchedulePost({
        text: SAMPLE_POST_TEXT,
        scheduled_at: SCHEDULED_AT,
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/)
  })
})
```

- [ ] **Step 8.2: Run test file**

```bash
pnpm --filter @sipher/agent test tests/herald/tools/schedule-post.test.ts -- --run 2>&1 | tail -10
```

Expected: `Tests  13 passed`.

- [ ] **Step 8.3: Confirm branch and commit**

```bash
git branch --show-current
git add packages/agent/tests/herald/tools/schedule-post.test.ts
git commit -m "test(herald): add direct unit tests for schedule-post tool"
```

---

## Task 9: Update CLAUDE.md test counts

**Files:**
- Modify: `CLAUDE.md` (root)

PR-2 left agent tests at 1180. PR-3 adds:
- like-tweet: 11
- read-user: 14
- search-posts: 15
- read-dms: 18
- reply-tweet: 13
- send-dm: 14
- schedule-post: 13

Total: **+98 tests** (1180 → 1278). Suite count: **+7 files** (96 → 103).

These exact deltas are estimates; final task verification will confirm and may require minor adjustment.

- [ ] **Step 9.1: Run full agent suite to confirm exact counts**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | grep -E "(Test Files|Tests)" | tail -3
```

Expected: roughly `Test Files  103 passed`, `Tests  1278 passed` (allow ±5 from estimate).

- [ ] **Step 9.2: Update CLAUDE.md**

Find every occurrence of `1180` and `96` (referencing agent test/suite counts) and replace with the actual numbers from Step 9.1. Use grep to enumerate occurrences first.

```bash
grep -n "1180\|1,180" CLAUDE.md
grep -n " 96 " CLAUDE.md
```

Update each line to reflect the new totals. Maintain formatting (e.g., `(1180→1270)` style if used elsewhere).

- [ ] **Step 9.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: bump agent test counts after Phase 5 PR-3 (1180 → ~1278, 96 → 103 suites)"
```

---

## Task 10: Final verification + Open PR

**Files:**
- (push branch + open PR — no file changes)

- [ ] **Step 10.1: Full workspace verification**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -5
pnpm test -- --run 2>&1 | tail -5
pnpm --filter @sipher/app test -- --run 2>&1 | tail -5
pnpm typecheck 2>&1 | tail -5
```

Expected:
- agent: ~1278 passed (no regressions)
- root: 555 passed (unchanged)
- app: 45 passed (unchanged)
- typecheck: clean

- [ ] **Step 10.2: Whole-branch code review checkpoint**

Before push, dispatch `superpowers:code-reviewer` on the full branch. Specifically check for the gap class that bit PR-1 and PR-2:

> **Service-error propagation tests:** every tool that calls a service that can throw (X API, DB) must have at least one test asserting the throw propagates AND that no side-effects (cost tracking, bus emit, DB write) occurred.

Cross-check each new test file against this checklist:
- like-tweet — throw test present ✓ (Step 2.4)
- read-user — throw test present ✓ (Step 3.1)
- search-posts — throw test present ✓ (Step 4.1)
- read-dms — both rescue paths AND non-auth rethrow tests present ✓ (Step 5.1)
- reply-tweet — throw test present ✓ (Step 6.1)
- send-dm — throw test present + verifies NO bus emit ✓ (Step 7.1)
- schedule-post — both prepare-throw AND run-throw tests present ✓ (Step 8.1)

Also check file-path header comments (PR-2's Task 18→19 found 3 missing): every new test file should start with the path comment in its first non-import line, e.g. `// packages/agent/tests/herald/tools/like-tweet.test.ts`.

- [ ] **Step 10.3: Confirm branch and push**

```bash
git branch --show-current
git log --oneline -12
git push origin feat/phase-5-herald-tool-tests
```

Expected: branch is `feat/phase-5-herald-tool-tests`, commits are linear.

- [ ] **Step 10.4: Open PR**

```bash
gh pr create \
  --title "test(phase-5): add direct unit tests for 7 HERALD tools (PR-3 of 3)" \
  --body "$(cat <<'EOF'
## Summary

Phase 5 PR-3 — closure piece. Adds direct per-tool unit tests for the 7 remaining HERALD tools flagged by the 2026-04-18 audit. Test-only PR, zero source changes.

**Tools covered (7):** likeTweet, readDMs, readUserProfile, replyTweet, schedulePost, searchPosts, sendDM.

**Out of scope (existing direct tests, untouched):** postTweet, readMentions.

This PR closes the Phase 5 audit (29 tools total: 8 user-facing PR-1 + 14 SENTINEL PR-2 + 7 HERALD PR-3).

## Spec / Plan

- Spec: \`docs/superpowers/specs/2026-05-03-phase-5-tool-unit-tests-design.md\`
- Plan: \`docs/superpowers/plans/2026-05-04-phase-5-herald-tool-tests.md\`

## New files

| File | Tests |
|------|-------|
| \`packages/agent/tests/fixtures/herald-tool-mocks.ts\` | (data shapes only) |
| \`packages/agent/tests/herald/tools/like-tweet.test.ts\` | 11 |
| \`packages/agent/tests/herald/tools/read-user.test.ts\` | 14 |
| \`packages/agent/tests/herald/tools/search-posts.test.ts\` | 15 |
| \`packages/agent/tests/herald/tools/read-dms.test.ts\` | 18 |
| \`packages/agent/tests/herald/tools/reply-tweet.test.ts\` | 13 |
| \`packages/agent/tests/herald/tools/send-dm.test.ts\` | 14 |
| \`packages/agent/tests/herald/tools/schedule-post.test.ts\` | 13 |

## Test count delta

- Agent: 1180 → ~1278 (+98 net, 7 new files)
- Root: 555 (unchanged)
- App: 45 (unchanged)
- Source code lines changed: 0

## Pattern notes

Reused PR-2's locked patterns verbatim:
- \`vi.hoisted\` for mock fns (TDZ-safe)
- Static imports of source AFTER \`vi.mock\` calls
- Fixture file = data shapes only, no \`vi.fn()\` exports
- Bus events: \`toStrictEqual\` + \`expect.stringMatching(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/)\` for timestamps
- Service-error propagation tested for every tool that calls a throwable service (pre-empted up-front, not at final review)

## Test plan

- [x] \`pnpm --filter @sipher/agent test -- --run\` passes (~1278 tests)
- [x] \`pnpm test -- --run\` passes (555 tests, unchanged)
- [x] \`pnpm --filter @sipher/app test -- --run\` passes (45 tests, unchanged)
- [x] \`pnpm typecheck\` clean
EOF
)"
```

- [ ] **Step 10.5: Confirm PR opened**

```bash
gh pr view --json number,state,mergeable,url
```

Expected: state OPEN, mergeable MERGEABLE (CI may still be running). Print the PR URL for RECTOR.

- [ ] **Step 10.6: Mark PR-3 task complete in this session's work**

Phase 5 audit closed. Next phase per audit: **Phase 6 — Chrome MCP QA vs live VPS** (small, exploratory, separate session).

---

## Self-Review Notes

This plan was self-reviewed against the spec and against PR-1/PR-2 lessons:

1. **Spec coverage** — Each section of the spec ("Architecture → six-row sheet contract", "Per-PR scope", "File layout", "Fixtures") is implemented by Tasks 1-8. The umbrella migration policy doesn't apply (PR-3 has no umbrellas). Cross-tool file deliberately skipped (registry already covered by `tests/herald/herald.test.ts`).
2. **Placeholder scan** — every step has explicit code, file paths, and run commands. No "TBD" / "implement later" / "similar to Task N" deferrals. Test counts in the PR body are estimates with explicit "actual" callout in Task 9.
3. **Type consistency** — fixture exports (`makeXTweet`, `makeXUser`, `makeXDmEvent`, `makeXReply`, `makeXSendDmResult`) and constants (`VALID_TWEET_ID`, etc.) are referenced consistently across Tasks 2-8. Mock variable names follow the `mock<Method>` convention (e.g., `mockLike`, `mockSearch`).
4. **Pattern setter checkpoint** — Task 2 has an explicit pause for spec+code review before Tasks 3-8 propagate the pattern. Same as PR-2's Task 2 review.
5. **Service-error gap pre-emption** — every per-tool task includes a service-error propagation test up-front (PR-1 found 2 such gaps at final review, PR-2 found 4; PR-3 plans for them in the test sheet). For send-dm, the test additionally verifies no bus event is emitted on throw.
6. **Detached-HEAD gotcha** — every commit step starts with `git branch --show-current` to verify still on `feat/phase-5-herald-tool-tests` before commit (PR-2 had this issue at Task 18→19).

# Torque MCP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire sipher's fund-moving agent tools to a Torque MCP server so each successful private action emits a `custom_event` that drives a per-action rebate campaign, with rebates distributed to fresh stealth addresses derived per event.

**Architecture:** New `packages/agent/src/integrations/torque/` module. Sipher's central `executeTool` dispatcher gets a wrapping growth-hook middleware that fires after on-chain confirmation. The hook calls `TorqueMCPClient.emitEvent()` and derives a rebate destination via `rebate-destination.ts` (preferring the SNS `SIP-STEALTH` record from `@sip-protocol/sns-stealth@0.1.1`, falling back to legacy hex meta). Master kill-switch `TORQUE_GROWTH_ENABLED=false` disables cleanly.

**Tech Stack:** TypeScript, Vitest, `@sipher/agent` workspace package, `@sip-protocol/sns-stealth@0.1.1`, `@sip-protocol/sdk`, Pi SDK / AnthropicTool, Torque MCP server (HTTP+SSE transport assumed; verified in Task 1 Step 1).

**Spec:** `docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md`

---

## File Structure

**New (create):**
- `packages/agent/src/integrations/torque/index.ts` — public re-exports
- `packages/agent/src/integrations/torque/types.ts` — `SipherGrowthEvent`, `TorqueCampaign`, MCP request/response types
- `packages/agent/src/integrations/torque/mcp-client.ts` — `TorqueMCPClient` class
- `packages/agent/src/integrations/torque/rebate-destination.ts` — `deriveRebateDestination(wallet, network)`
- `packages/agent/src/integrations/torque/growth-hook.ts` — `wrapExecutorWithGrowthHook(baseExecutor)`
- `packages/agent/src/integrations/torque/README.md` — setup, env vars, privacy posture
- `packages/agent/tests/integrations/torque/mcp-client.test.ts`
- `packages/agent/tests/integrations/torque/rebate-destination.test.ts`
- `packages/agent/tests/integrations/torque/growth-hook.test.ts`
- `packages/agent/tests/integrations/torque/torque-emit-roundtrip.test.ts` (integration, opt-in)
- `packages/agent/tests/integrations/torque/torque-rebate-e2e.test.ts` (e2e, opt-in)
- `packages/agent/src/routes/admin/torque.ts` — `GET /admin/torque/status`
- `packages/agent/tests/routes/admin/torque.test.ts`
- `docs/integrations/torque/FRICTION-LOG.md`

**Modified:**
- `packages/agent/src/agent.ts` — `createAgent` injects growth-hook-wrapped executor when `TORQUE_GROWTH_ENABLED=true`
- `packages/agent/src/routes/admin/index.ts` — register torque route
- `packages/agent/package.json` — no new deps (uses existing `@sip-protocol/sns-stealth`, `@solana/web3.js`)
- `.env.example` (root) — document `TORQUE_*` env vars

**Each file has one responsibility:**
- `types.ts` — types only, no logic
- `mcp-client.ts` — Torque API I/O only, no business logic
- `rebate-destination.ts` — stealth-address derivation only, no I/O to Torque
- `growth-hook.ts` — orchestration only, delegates to client + destination

---

## Task 1 (PR-A): MCP Client Foundation

**Branch:** `feat/torque-mcp-client`

**Files:**
- Create: `packages/agent/src/integrations/torque/types.ts`
- Create: `packages/agent/src/integrations/torque/mcp-client.ts`
- Create: `packages/agent/src/integrations/torque/index.ts`
- Test: `packages/agent/tests/integrations/torque/mcp-client.test.ts`

### Step 1.0: Verify Torque MCP API surface (PRE-CODE)

Before writing code, fetch Torque docs to confirm the assumed API shape (HTTP+SSE, `x-torque-api-key` header, tool names). Plan code uses best assumptions; if the real API differs, edit the types + client method names inline before continuing and log the delta in FRICTION-LOG.md.

- [ ] **Step 1.0.1**: Join Torque hackathon Telegram group, request MCP server endpoint URL + sandbox campaign ID. Capture both into `~/Documents/secret/sipher-vps-secrets.env` as `TORQUE_MCP_URL` and `TORQUE_TEST_CAMPAIGN_ID`.

- [ ] **Step 1.0.2**: `curl -H "x-torque-api-key: $TORQUE_API_KEY" $TORQUE_MCP_URL/tools/list` (or the equivalent MCP introspection endpoint). Save the response to `docs/integrations/torque/api-shape.json` (gitignored, local reference only). If response shape differs from assumptions below, adjust types in Step 1.1.

- [ ] **Step 1.0.3**: Branch off main: `git checkout main && git pull origin main && git checkout -b feat/torque-mcp-client`.

### Step 1.1: Write `types.ts`

- [ ] **Step 1.1.1**: Create `packages/agent/src/integrations/torque/types.ts`:

```typescript
/**
 * Event emitted to Torque MCP after a successful fund-moving sipher tool call.
 * Wallet field is required for attribution; rebate_destination is a fresh
 * stealth address derived per event so Torque does not learn the user's
 * recipient identity.
 */
export interface SipherGrowthEvent {
  event: SipherEventName
  wallet: string
  ts: string
  tx_signature: string
  network: 'mainnet-beta' | 'devnet'
  metadata: {
    amount_lamports?: number
    asset?: string
    rebate_destination: string
  }
}

export type SipherEventName =
  | 'sipher.private_send_completed'
  | 'sipher.private_swap_completed'
  | 'sipher.private_claim_completed'
  | 'sipher.recurring_send_tick'
  | 'sipher.batch_send_completed'

export interface TorqueCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'ENDED'
  remainingPool: number
  rewardAmountPerEvent: number
  rewardToken: string
}

export interface TorqueMCPClientOptions {
  baseUrl: string
  apiKey: string
  campaignId: string
  network: 'mainnet-beta' | 'devnet'
  /** ms; default 8000 */
  timeoutMs?: number
}

export type TorqueEmitResult =
  | { ok: true; eventId: string }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'duplicate' | 'campaign_inactive' | 'unknown'; message: string }
```

- [ ] **Step 1.1.2**: Commit:

```bash
git add packages/agent/src/integrations/torque/types.ts
git commit -m "feat(agent): add torque MCP integration types"
```

### Step 1.2: Write failing test for `TorqueMCPClient.emitEvent`

- [ ] **Step 1.2.1**: Create `packages/agent/tests/integrations/torque/mcp-client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import type { SipherGrowthEvent } from '../../../src/integrations/torque/types.js'

const baseEvent: SipherGrowthEvent = {
  event: 'sipher.private_send_completed',
  wallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  ts: '2026-05-12T12:00:00Z',
  tx_signature: '3QCoHcJ1NNg',
  network: 'devnet',
  metadata: {
    rebate_destination: '4HC3vQB5s5c',
  },
}

describe('TorqueMCPClient.emitEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the event with x-torque-api-key header and JSON body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCESS', data: { eventId: 'evt_1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
      network: 'devnet',
    })

    const result = await client.emitEvent(baseEvent)

    expect(result).toStrictEqual({ ok: true, eventId: 'evt_1' })
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://torque.test/campaigns/camp_devnet_1/events')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-torque-api-key': 'tk_secret',
    })
    expect(JSON.parse(init?.body as string)).toStrictEqual(baseEvent)
  })
})
```

- [ ] **Step 1.2.2**: Run test, confirm it fails:

```bash
pnpm --filter @sipher/agent test:run -- mcp-client
```

Expected: FAIL — module `../../../src/integrations/torque/mcp-client.js` does not exist.

### Step 1.3: Write minimal `mcp-client.ts` to pass

- [ ] **Step 1.3.1**: Create `packages/agent/src/integrations/torque/mcp-client.ts`:

```typescript
import type {
  SipherGrowthEvent,
  TorqueCampaign,
  TorqueEmitResult,
  TorqueMCPClientOptions,
} from './types.js'

const DEFAULT_TIMEOUT_MS = 8000

export class TorqueMCPClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly campaignId: string
  private readonly network: 'mainnet-beta' | 'devnet'
  private readonly timeoutMs: number

  constructor(opts: TorqueMCPClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.apiKey = opts.apiKey
    this.campaignId = opts.campaignId
    this.network = opts.network
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async emitEvent(event: SipherGrowthEvent): Promise<TorqueEmitResult> {
    const url = `${this.baseUrl}/campaigns/${this.campaignId}/events`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-torque-api-key': this.apiKey,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'auth', message: `Torque rejected api key (${response.status})` }
      }
      if (response.status === 409) {
        return { ok: false, reason: 'duplicate', message: 'Event already ingested (idempotency hit)' }
      }
      if (response.status === 429) {
        return { ok: false, reason: 'rate_limit', message: 'Torque rate limit hit' }
      }
      if (response.status === 410) {
        return { ok: false, reason: 'campaign_inactive', message: 'Campaign no longer active' }
      }
      if (!response.ok) {
        return { ok: false, reason: 'unknown', message: `Torque returned ${response.status}` }
      }
      const json = (await response.json()) as { status?: string; data?: { eventId?: string } }
      const eventId = json?.data?.eventId
      if (json?.status !== 'SUCCESS' || !eventId) {
        return { ok: false, reason: 'unknown', message: 'Torque response missing eventId' }
      }
      return { ok: true, eventId }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, reason: 'network', message }
    } finally {
      clearTimeout(timeout)
    }
  }

  async getCampaign(): Promise<TorqueCampaign | null> {
    const url = `${this.baseUrl}/campaigns/${this.campaignId}`
    try {
      const response = await fetch(url, {
        headers: { 'x-torque-api-key': this.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) return null
      const json = (await response.json()) as { status?: string; data?: TorqueCampaign }
      if (json?.status !== 'SUCCESS') return null
      return json.data ?? null
    } catch {
      return null
    }
  }
}
```

- [ ] **Step 1.3.2**: Create `packages/agent/src/integrations/torque/index.ts`:

```typescript
export { TorqueMCPClient } from './mcp-client.js'
export type {
  SipherGrowthEvent,
  SipherEventName,
  TorqueCampaign,
  TorqueMCPClientOptions,
  TorqueEmitResult,
} from './types.js'
```

- [ ] **Step 1.3.3**: Run test, confirm pass:

```bash
pnpm --filter @sipher/agent test:run -- mcp-client
```

Expected: PASS — 1 test green.

### Step 1.4: Add error-path tests (auth, rate-limit, network, duplicate, inactive)

- [ ] **Step 1.4.1**: Append to `packages/agent/tests/integrations/torque/mcp-client.test.ts`:

```typescript
import { it as fcIt } from 'vitest' // alias for clarity in this block
import type { TorqueEmitResult } from '../../../src/integrations/torque/types.js'

describe('TorqueMCPClient.emitEvent error paths', () => {
  beforeEach(() => vi.restoreAllMocks())

  function clientWithMockedFetch(status: number, body: object | string = ''): TorqueMCPClient {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    return new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
      network: 'devnet',
    })
  }

  it.each<[number, TorqueEmitResult['ok'] extends false ? unknown : never]>([])
  it('returns auth reason on 401', async () => {
    const client = clientWithMockedFetch(401)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/401/) })
  })

  it('returns auth reason on 403', async () => {
    const client = clientWithMockedFetch(403)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/403/) })
  })

  it('returns duplicate reason on 409', async () => {
    const client = clientWithMockedFetch(409)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'duplicate', message: expect.stringMatching(/idempotency/i) })
  })

  it('returns rate_limit reason on 429', async () => {
    const client = clientWithMockedFetch(429)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'rate_limit', message: expect.stringMatching(/rate limit/i) })
  })

  it('returns campaign_inactive reason on 410', async () => {
    const client = clientWithMockedFetch(410)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'campaign_inactive', message: expect.stringMatching(/no longer active/i) })
  })

  it('returns unknown reason on other 5xx', async () => {
    const client = clientWithMockedFetch(503)
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'unknown', message: expect.stringMatching(/503/) })
  })

  it('returns network reason on fetch throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))
    const client = new TorqueMCPClient({
      baseUrl: 'https://torque.test',
      apiKey: 'tk_secret',
      campaignId: 'camp_devnet_1',
      network: 'devnet',
    })
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'network', message: 'ECONNREFUSED' })
  })

  it('returns unknown reason when response missing eventId', async () => {
    const client = clientWithMockedFetch(200, { status: 'SUCCESS', data: {} })
    const result = await client.emitEvent(baseEvent)
    expect(result).toStrictEqual({ ok: false, reason: 'unknown', message: expect.stringMatching(/missing eventId/) })
  })
})
```

- [ ] **Step 1.4.2**: Run all client tests, confirm all pass:

```bash
pnpm --filter @sipher/agent test:run -- mcp-client
```

Expected: PASS — 9 tests green.

- [ ] **Step 1.4.3**: Commit:

```bash
git add packages/agent/src/integrations/torque/{mcp-client,types,index}.ts packages/agent/tests/integrations/torque/mcp-client.test.ts
git commit -m "feat(agent): TorqueMCPClient with emit_event + get_campaign + 5 error paths"
```

### Step 1.5: Wire env vars + push branch + PR

- [ ] **Step 1.5.1**: Add to `.env.example` at sipher repo root:

```
# Torque MCP integration (growth loops via Frontier hackathon track)
TORQUE_API_KEY=
TORQUE_MCP_URL=
TORQUE_CAMPAIGN_ID_DEVNET=
TORQUE_CAMPAIGN_ID_MAINNET=
TORQUE_GROWTH_ENABLED=false
```

- [ ] **Step 1.5.2**: Run full sipher agent test suite to verify no regression:

```bash
pnpm --filter @sipher/agent test:run
```

Expected: PASS — existing 1,495+ tests + 9 new = 1,504+ green.

- [ ] **Step 1.5.3**: Run typecheck:

```bash
pnpm --filter @sipher/agent typecheck
```

Expected: clean.

- [ ] **Step 1.5.4**: Push + open PR:

```bash
git add .env.example
git commit -m "docs(env): add TORQUE_* env var stubs"
git push -u origin feat/torque-mcp-client
gh pr create --title "feat(agent): TorqueMCPClient foundation (PR-A of 5)" --body "First of 5 PRs implementing the Torque MCP integration per docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md. Adds types + MCP client with full error-path coverage (auth/duplicate/rate_limit/campaign_inactive/network/unknown). No production code paths reach the client yet — wired in PR-B + PR-C."
```

---

## Task 2 (PR-B): Rebate Destination + Growth Hook

**Branch:** `feat/torque-growth-hook` (off main, after PR-A merge)

**Files:**
- Create: `packages/agent/src/integrations/torque/rebate-destination.ts`
- Create: `packages/agent/src/integrations/torque/growth-hook.ts`
- Test: `packages/agent/tests/integrations/torque/rebate-destination.test.ts`
- Test: `packages/agent/tests/integrations/torque/growth-hook.test.ts`

### Step 2.0: Branch

- [ ] **Step 2.0.1**: `git checkout main && git pull origin main && git checkout -b feat/torque-growth-hook`

### Step 2.1: Write failing test for `deriveRebateDestination`

- [ ] **Step 2.1.1**: Create `packages/agent/tests/integrations/torque/rebate-destination.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Connection, PublicKey } from '@solana/web3.js'

vi.mock('@sip-protocol/sns-stealth', () => ({
  resolveSIPStealth: vi.fn(),
  MetaAddress: class MetaAddress {
    constructor(
      public readonly spending: Uint8Array,
      public readonly viewing: Uint8Array,
      public readonly chain: 'solana',
      public readonly domain: string,
    ) {}
  },
  NotFound: class NotFound { constructor(public readonly kind: 'domain' | 'record') {} },
}))

import { resolveSIPStealth, MetaAddress, NotFound } from '@sip-protocol/sns-stealth'
import { deriveRebateDestination } from '../../../src/integrations/torque/rebate-destination.js'

const WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const conn = {} as Connection

describe('deriveRebateDestination', () => {
  beforeEach(() => vi.clearAllMocks())

  it('derives a stealth address from the SNS SIP-STEALTH record when present', async () => {
    const meta = new MetaAddress(
      new Uint8Array(32).fill(0xaa),
      new Uint8Array(32).fill(0xbb),
      'solana',
      'rector.sol',
    )
    vi.mocked(resolveSIPStealth).mockResolvedValue(meta)

    const result = await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })

    expect(result.kind).toBe('stealth')
    expect(result.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/) // base58
    expect(resolveSIPStealth).toHaveBeenCalledWith(conn, 'rector.sol')
  })

  it('returns null + warns when SNS record not found AND no legacy meta', async () => {
    vi.mocked(resolveSIPStealth).mockResolvedValue(new NotFound('record'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })

    expect(result).toStrictEqual({ kind: 'unavailable', address: null, reason: 'no_sns_record' })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('rebate skipped'),
    )
  })

  it('returns null when no domain provided (no SNS to query)', async () => {
    const result = await deriveRebateDestination({ wallet: WALLET, connection: conn })
    expect(result).toStrictEqual({ kind: 'unavailable', address: null, reason: 'no_domain' })
    expect(resolveSIPStealth).not.toHaveBeenCalled()
  })

  it('caches resolution per wallet+domain for 60s', async () => {
    const meta = new MetaAddress(
      new Uint8Array(32).fill(0xaa),
      new Uint8Array(32).fill(0xbb),
      'solana',
      'rector.sol',
    )
    vi.mocked(resolveSIPStealth).mockResolvedValue(meta)

    await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })
    await deriveRebateDestination({ wallet: WALLET, domain: 'rector.sol', connection: conn })

    expect(resolveSIPStealth).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2.1.2**: Run test, confirm fail:

```bash
pnpm --filter @sipher/agent test:run -- rebate-destination
```

Expected: FAIL — module not found.

### Step 2.2: Implement `rebate-destination.ts`

- [ ] **Step 2.2.1**: Create `packages/agent/src/integrations/torque/rebate-destination.ts`:

```typescript
import type { Connection } from '@solana/web3.js'
import { resolveSIPStealth, MetaAddress } from '@sip-protocol/sns-stealth'
import { generateEd25519StealthAddress, ed25519PublicKeyToSolanaAddress } from '@sip-protocol/sdk'

export type RebateDestination =
  | { kind: 'stealth'; address: string }
  | { kind: 'unavailable'; address: null; reason: 'no_domain' | 'no_sns_record' | 'sns_error' }

interface CacheEntry {
  expiresAt: number
  destination: RebateDestination
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

function cacheKey(wallet: string, domain?: string): string {
  return `${wallet}|${domain ?? ''}`
}

export interface DeriveRebateDestinationParams {
  wallet: string
  domain?: string
  connection: Connection
}

export async function deriveRebateDestination(
  params: DeriveRebateDestinationParams,
): Promise<RebateDestination> {
  const key = cacheKey(params.wallet, params.domain)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.destination
  }

  let result: RebateDestination

  if (!params.domain) {
    result = { kind: 'unavailable', address: null, reason: 'no_domain' }
  } else {
    try {
      const meta = await resolveSIPStealth(params.connection, params.domain)
      if (meta instanceof MetaAddress) {
        const stealth = generateEd25519StealthAddress({
          spendingPublicKey: meta.spending,
          viewingPublicKey: meta.viewing,
        })
        const address = ed25519PublicKeyToSolanaAddress(stealth.publicKey)
        result = { kind: 'stealth', address }
      } else {
        console.warn(
          `[torque] rebate skipped for wallet ${params.wallet} (${params.domain}): no SNS SIP-STEALTH record. Publish via sip-app/wallet/sip-stealth to claim rebates.`,
        )
        result = { kind: 'unavailable', address: null, reason: 'no_sns_record' }
      }
    } catch (err) {
      console.warn(
        `[torque] rebate skipped for wallet ${params.wallet} (${params.domain}): SNS error: ${err instanceof Error ? err.message : String(err)}`,
      )
      result = { kind: 'unavailable', address: null, reason: 'sns_error' }
    }
  }

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, destination: result })
  return result
}

/** Test-only: clear the in-memory cache between test cases. */
export function _resetRebateDestinationCacheForTests(): void {
  cache.clear()
}
```

- [ ] **Step 2.2.2**: Update test to call `_resetRebateDestinationCacheForTests` in beforeEach, then run:

```bash
pnpm --filter @sipher/agent test:run -- rebate-destination
```

Expected: PASS — 4 tests green.

- [ ] **Step 2.2.3**: Commit:

```bash
git add packages/agent/src/integrations/torque/rebate-destination.ts packages/agent/tests/integrations/torque/rebate-destination.test.ts
git commit -m "feat(agent): rebate-destination derives stealth address from SNS record with 60s cache"
```

### Step 2.3: Write failing tests for growth-hook

- [ ] **Step 2.3.1**: Create `packages/agent/tests/integrations/torque/growth-hook.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const emitEventMock = vi.fn()
const deriveRebateDestinationMock = vi.fn()

vi.mock('../../../src/integrations/torque/mcp-client.js', () => ({
  TorqueMCPClient: vi.fn().mockImplementation(() => ({ emitEvent: emitEventMock })),
}))

vi.mock('../../../src/integrations/torque/rebate-destination.js', () => ({
  deriveRebateDestination: deriveRebateDestinationMock,
}))

import { wrapExecutorWithGrowthHook } from '../../../src/integrations/torque/growth-hook.js'

const WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const TX_SIG = '3QCoHcJ1NNg'

const baseExecutor = vi.fn()

const opts = {
  baseUrl: 'https://torque.test',
  apiKey: 'tk_secret',
  campaignId: 'camp_devnet_1',
  network: 'devnet' as const,
  growthEnabled: true,
}

describe('wrapExecutorWithGrowthHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deriveRebateDestinationMock.mockResolvedValue({ kind: 'stealth', address: 'RbT6X9' })
    emitEventMock.mockResolvedValue({ ok: true, eventId: 'evt_1' })
  })

  it('delegates to base executor and returns its result unchanged', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'awaiting_signature', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    const result = await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })

    expect(result).toStrictEqual({ action: 'send', status: 'awaiting_signature', signature: TX_SIG })
    expect(baseExecutor).toHaveBeenCalledOnce()
  })

  it('emits sipher.private_send_completed after a successful send', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })

    expect(emitEventMock).toHaveBeenCalledOnce()
    expect(emitEventMock).toHaveBeenCalledWith({
      event: 'sipher.private_send_completed',
      wallet: WALLET,
      ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
      tx_signature: TX_SIG,
      network: 'devnet',
      metadata: {
        rebate_destination: 'RbT6X9',
      },
    })
  })

  it('OMITS amount_lamports for send events (privacy)', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })

    const call = emitEventMock.mock.calls[0]![0]
    expect(call.metadata.amount_lamports).toBeUndefined()
  })

  it('INCLUDES amount_lamports for swap events (DEX is already public)', async () => {
    baseExecutor.mockResolvedValue({ action: 'swap', status: 'confirmed', signature: TX_SIG, amountInLamports: 1_000_000 })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('swap', { wallet: WALLET, fromToken: 'SOL', toToken: 'USDC', amount: 1 })

    const call = emitEventMock.mock.calls[0]![0]
    expect(call.metadata.amount_lamports).toBe(1_000_000)
  })

  it('does NOT emit when base executor throws', async () => {
    baseExecutor.mockRejectedValue(new Error('boom'))
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await expect(wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })).rejects.toThrow('boom')
    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('does NOT emit for read-only tools (balance, history, scan)', async () => {
    baseExecutor.mockResolvedValue({ action: 'balance', balance: '5 SOL' })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('balance', { wallet: WALLET })

    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('does NOT emit when growthEnabled=false', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, { ...opts, growthEnabled: false })

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })

    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('does NOT bubble emit failures to the caller', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    emitEventMock.mockResolvedValue({ ok: false, reason: 'network', message: 'boom' })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    const result = await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })

    expect(result).toBeDefined()
    expect(emitEventMock).toHaveBeenCalledOnce()
  })

  it('skips emit when no tx_signature in result (e.g. status: awaiting_signature)', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'awaiting_signature' })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })

    expect(emitEventMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2.3.2**: Run, confirm fail:

```bash
pnpm --filter @sipher/agent test:run -- growth-hook
```

Expected: FAIL — module not found.

### Step 2.4: Implement `growth-hook.ts`

- [ ] **Step 2.4.1**: Create `packages/agent/src/integrations/torque/growth-hook.ts`:

```typescript
import type { Connection } from '@solana/web3.js'
import { TorqueMCPClient } from './mcp-client.js'
import { deriveRebateDestination } from './rebate-destination.js'
import type { SipherEventName, SipherGrowthEvent, TorqueMCPClientOptions } from './types.js'

export interface GrowthHookOptions extends TorqueMCPClientOptions {
  growthEnabled: boolean
  /** Optional connection injection for rebate-destination; falls back to a stub if omitted. */
  connection?: Connection
}

/** Map sipher tool name → growth event name. Read-only tools omitted by design. */
const TOOL_EVENT_MAP: Record<string, SipherEventName> = {
  send: 'sipher.private_send_completed',
  swap: 'sipher.private_swap_completed',
  claim: 'sipher.private_claim_completed',
  drip: 'sipher.recurring_send_tick',
  splitSend: 'sipher.batch_send_completed',
}

const AMOUNT_INCLUDED_TOOLS = new Set(['swap'])

type ToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>

export function wrapExecutorWithGrowthHook(
  baseExecutor: ToolExecutor,
  opts: GrowthHookOptions,
): ToolExecutor {
  if (!opts.growthEnabled) {
    return baseExecutor
  }

  const client = new TorqueMCPClient(opts)

  return async (name, input) => {
    const result = await baseExecutor(name, input)
    void emitGrowthEvent(name, input, result, client, opts).catch((err) => {
      console.warn(`[torque] growth event emission threw (suppressed): ${err instanceof Error ? err.message : String(err)}`)
    })
    return result
  }
}

async function emitGrowthEvent(
  toolName: string,
  input: Record<string, unknown>,
  result: unknown,
  client: TorqueMCPClient,
  opts: GrowthHookOptions,
): Promise<void> {
  const eventName = TOOL_EVENT_MAP[toolName]
  if (!eventName) return

  const txSignature = extractTxSignature(result)
  if (!txSignature) return

  const wallet = typeof input.wallet === 'string' ? input.wallet : undefined
  if (!wallet) return

  const domain = typeof input.recipient === 'string' && input.recipient.endsWith('.sol') ? input.recipient : undefined

  const destination = opts.connection
    ? await deriveRebateDestination({ wallet, domain, connection: opts.connection })
    : { kind: 'unavailable', address: null, reason: 'no_domain' as const }

  if (destination.kind !== 'stealth') return

  const event: SipherGrowthEvent = {
    event: eventName,
    wallet,
    ts: new Date().toISOString(),
    tx_signature: txSignature,
    network: opts.network,
    metadata: {
      rebate_destination: destination.address,
      ...(AMOUNT_INCLUDED_TOOLS.has(toolName) ? { amount_lamports: extractAmountLamports(result) } : {}),
    },
  }

  await client.emitEvent(event)
}

function extractTxSignature(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as Record<string, unknown>
  if (typeof r.signature === 'string') return r.signature
  if (typeof r.txSignature === 'string') return r.txSignature
  return undefined
}

function extractAmountLamports(result: unknown): number | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as Record<string, unknown>
  if (typeof r.amountInLamports === 'number') return r.amountInLamports
  if (typeof r.amountLamports === 'number') return r.amountLamports
  return undefined
}
```

- [ ] **Step 2.4.2**: Update `index.ts` to re-export:

```typescript
export { TorqueMCPClient } from './mcp-client.js'
export { deriveRebateDestination, _resetRebateDestinationCacheForTests } from './rebate-destination.js'
export { wrapExecutorWithGrowthHook } from './growth-hook.js'
export type {
  SipherGrowthEvent,
  SipherEventName,
  TorqueCampaign,
  TorqueMCPClientOptions,
  TorqueEmitResult,
} from './types.js'
export type { RebateDestination } from './rebate-destination.js'
export type { GrowthHookOptions } from './growth-hook.js'
```

- [ ] **Step 2.4.3**: Run growth-hook tests:

```bash
pnpm --filter @sipher/agent test:run -- growth-hook
```

Expected: PASS — 9 tests green. **NOTE**: the test for `growthEnabled=false` expects `wrapExecutorWithGrowthHook` to return the base executor unchanged. The test "does NOT emit when growthEnabled=false" verifies this by mocking baseExecutor and asserting emitEventMock was never called.

- [ ] **Step 2.4.4**: Run full agent suite for regression:

```bash
pnpm --filter @sipher/agent test:run
```

Expected: 1,495 + 13 (4 rebate + 9 growth) = 1,508+ passing.

- [ ] **Step 2.4.5**: Typecheck:

```bash
pnpm --filter @sipher/agent typecheck
```

Expected: clean.

- [ ] **Step 2.4.6**: Commit + push + PR:

```bash
git add packages/agent/src/integrations/torque/{growth-hook,index}.ts packages/agent/tests/integrations/torque/growth-hook.test.ts
git commit -m "feat(agent): growth-hook middleware emits torque events post-success with privacy gates"
git push -u origin feat/torque-growth-hook
gh pr create --title "feat(agent): torque growth-hook + rebate destination (PR-B of 5)" --body "Builds on PR-A. Adds rebate-destination (SNS-derived stealth address with 60s cache) and growth-hook middleware that wraps the tool executor. Privacy rules baked in: omit amount for send, include for swap, kill-switch via growthEnabled, never bubble emit failures. 13 new tests."
```

---

## Task 3 (PR-C): Wire Growth Hook into Agent Runtime

**Branch:** `feat/torque-wire-agent` (off main, after PR-B merge)

**Files:**
- Modify: `packages/agent/src/agent.ts`
- Modify: `packages/agent/src/config/network.ts` (read TORQUE_* env vars)
- Test: `packages/agent/tests/agent-torque-wiring.test.ts` (new)

### Step 3.0: Branch + read existing agent.ts wiring

- [ ] **Step 3.0.1**: `git checkout main && git pull origin main && git checkout -b feat/torque-wire-agent`

- [ ] **Step 3.0.2**: Read `packages/agent/src/agent.ts:300-410` to understand the existing `toolExecutor` injection point (the SENTINEL pattern). The growth-hook wires in the same way.

### Step 3.1: Add `loadTorqueConfig()` to `network.ts`

- [ ] **Step 3.1.1**: Append to `packages/agent/src/config/network.ts`:

```typescript
export interface TorqueConfig {
  enabled: boolean
  apiKey: string
  baseUrl: string
  campaignIdDevnet: string
  campaignIdMainnet: string
}

/**
 * Load Torque MCP integration config from env. Returns null if any required
 * env var is missing — caller treats null as "Torque integration disabled."
 */
export function loadTorqueConfig(): TorqueConfig | null {
  const enabled = process.env.TORQUE_GROWTH_ENABLED === 'true'
  if (!enabled) return null

  const apiKey = process.env.TORQUE_API_KEY
  const baseUrl = process.env.TORQUE_MCP_URL
  const campaignIdDevnet = process.env.TORQUE_CAMPAIGN_ID_DEVNET ?? ''
  const campaignIdMainnet = process.env.TORQUE_CAMPAIGN_ID_MAINNET ?? ''

  if (!apiKey || !baseUrl) {
    console.warn('[torque] TORQUE_GROWTH_ENABLED=true but TORQUE_API_KEY or TORQUE_MCP_URL missing — disabling integration')
    return null
  }

  return { enabled, apiKey, baseUrl, campaignIdDevnet, campaignIdMainnet }
}
```

- [ ] **Step 3.1.2**: Write a quick unit test for `loadTorqueConfig` in `packages/agent/tests/config/network-torque.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { loadTorqueConfig } from '../../src/config/network.js'

describe('loadTorqueConfig', () => {
  beforeEach(() => {
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_KEY
    delete process.env.TORQUE_MCP_URL
    delete process.env.TORQUE_CAMPAIGN_ID_DEVNET
    delete process.env.TORQUE_CAMPAIGN_ID_MAINNET
  })

  it('returns null when TORQUE_GROWTH_ENABLED is not "true"', () => {
    expect(loadTorqueConfig()).toBeNull()
  })

  it('returns null when TORQUE_API_KEY is missing despite enabled=true', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    expect(loadTorqueConfig()).toBeNull()
  })

  it('returns config when all required vars present', () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk_secret'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_d'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_m'

    expect(loadTorqueConfig()).toStrictEqual({
      enabled: true,
      apiKey: 'tk_secret',
      baseUrl: 'https://torque.test',
      campaignIdDevnet: 'camp_d',
      campaignIdMainnet: 'camp_m',
    })
  })
})
```

- [ ] **Step 3.1.3**: Run, confirm pass (function exists, fresh test):

```bash
pnpm --filter @sipher/agent test:run -- network-torque
```

Expected: PASS — 3 tests green.

### Step 3.2: Wire into `agent.ts`

- [ ] **Step 3.2.1**: At the top of `packages/agent/src/agent.ts`, add imports:

```typescript
import { wrapExecutorWithGrowthHook } from './integrations/torque/growth-hook.js'
import { loadTorqueConfig } from './config/network.js'
import { createConnection } from '@sipher/sdk'
```

- [ ] **Step 3.2.2**: Locate `createAgent` function (around `agent.ts:300-330`). Inside, after `const baseExecutor = opts.toolExecutor ?? executeTool`, add:

```typescript
const torqueConfig = loadTorqueConfig()
const network = loadNetworkConfig().clusterName
const wrappedExecutor = torqueConfig
  ? wrapExecutorWithGrowthHook(baseExecutor, {
      growthEnabled: true,
      apiKey: torqueConfig.apiKey,
      baseUrl: torqueConfig.baseUrl,
      campaignId: network === 'mainnet-beta' ? torqueConfig.campaignIdMainnet : torqueConfig.campaignIdDevnet,
      network: network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
      connection: createConnection(network),
    })
  : baseExecutor
```

Then replace subsequent uses of `baseExecutor` with `wrappedExecutor` in the same function body (typically 2-3 references — verify against actual file at edit time).

### Step 3.3: Wiring test

- [ ] **Step 3.3.1**: Create `packages/agent/tests/agent-torque-wiring.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

const wrapMock = vi.fn((executor) => executor)

vi.mock('../src/integrations/torque/growth-hook.js', () => ({
  wrapExecutorWithGrowthHook: wrapMock,
}))

import { createAgent } from '../src/agent.js'

describe('createAgent torque wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_KEY
    delete process.env.TORQUE_MCP_URL
  })

  it('does NOT wrap executor when TORQUE_GROWTH_ENABLED is unset', async () => {
    await createAgent({ /* minimum required opts per existing factory */ } as never)
    expect(wrapMock).not.toHaveBeenCalled()
  })

  it('wraps executor with growth hook when env enables it', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk_secret'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_d'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_m'

    await createAgent({ /* minimum required opts */ } as never)
    expect(wrapMock).toHaveBeenCalledOnce()
  })
})
```

NOTE: the `createAgent` opts shape must match the actual factory signature. Inspect the file at edit time and substitute the real minimum required fields (reading from `agent.ts` before writing this test is mandatory — replace `as never` with proper typed minimum).

- [ ] **Step 3.3.2**: Run, confirm pass:

```bash
pnpm --filter @sipher/agent test:run -- agent-torque-wiring
```

Expected: PASS — 2 tests green.

### Step 3.4: Regression + commit

- [ ] **Step 3.4.1**: Run full sipher agent suite, ensure no regressions:

```bash
pnpm --filter @sipher/agent test:run
```

Expected: 1,508+ + 5 (3 config + 2 wiring) = 1,513+ green.

- [ ] **Step 3.4.2**: Typecheck:

```bash
pnpm --filter @sipher/agent typecheck
```

Expected: clean.

- [ ] **Step 3.4.3**: Commit + push + PR:

```bash
git add packages/agent/src/agent.ts packages/agent/src/config/network.ts packages/agent/tests/{config,agent-torque-wiring}.test.ts
git commit -m "feat(agent): wire torque growth-hook into createAgent gated on TORQUE_GROWTH_ENABLED"
git push -u origin feat/torque-wire-agent
gh pr create --title "feat(agent): wire torque growth-hook into agent runtime (PR-C of 5)" --body "Wires the growth-hook from PR-B into createAgent. Defaults to no-op when TORQUE_GROWTH_ENABLED is unset. Mainnet vs devnet campaign ID picked from network config. 5 new tests."
```

---

## Task 4 (PR-D): Devnet Campaign + Integration + E2E + Admin + README + Friction Log

**Branch:** `feat/torque-devnet-campaign` (off main, after PR-C merge)

**Files:**
- Create: `packages/agent/src/routes/admin/torque.ts`
- Create: `packages/agent/tests/routes/admin/torque.test.ts`
- Create: `packages/agent/tests/integrations/torque/torque-emit-roundtrip.test.ts`
- Create: `packages/agent/tests/integrations/torque/torque-rebate-e2e.test.ts`
- Create: `packages/agent/src/integrations/torque/README.md`
- Create: `docs/integrations/torque/FRICTION-LOG.md`
- Modify: `packages/agent/src/routes/admin/index.ts`

### Step 4.0: Branch + Devnet campaign provisioning

- [ ] **Step 4.0.1**: `git checkout main && git pull origin main && git checkout -b feat/torque-devnet-campaign`

- [ ] **Step 4.0.2**: Provision a devnet Torque campaign via the dashboard or REST API. Pool: 5 SOL from `~/Documents/secret/solana-devnet.json`. Per-action rebate: 0.005 SOL. Sybil cap: 5 rebates per wallet per 24h. Capture campaign ID into `~/Documents/secret/sipher-vps-secrets.env` as `TORQUE_CAMPAIGN_ID_DEVNET=`. Log the provisioning steps + any friction in `docs/integrations/torque/FRICTION-LOG.md` (created in Step 4.5).

### Step 4.1: Admin endpoint

- [ ] **Step 4.1.1**: Create `packages/agent/src/routes/admin/torque.ts`:

```typescript
import { Router, type Request, type Response } from 'express'
import { TorqueMCPClient } from '../../integrations/torque/mcp-client.js'
import { loadTorqueConfig } from '../../config/network.js'
import { loadNetworkConfig } from '../../config/network.js'

export function createTorqueAdminRouter(): Router {
  const router = Router()

  router.get('/status', async (_req: Request, res: Response) => {
    const config = loadTorqueConfig()
    if (!config) {
      return res.status(200).json({
        ok: true,
        enabled: false,
        reason: 'TORQUE_GROWTH_ENABLED is false or required env vars missing',
      })
    }

    const network = loadNetworkConfig().clusterName
    const campaignId = network === 'mainnet-beta' ? config.campaignIdMainnet : config.campaignIdDevnet

    const client = new TorqueMCPClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      campaignId,
      network: network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
    })

    const campaign = await client.getCampaign()
    return res.status(200).json({
      ok: true,
      enabled: true,
      network,
      campaignId,
      campaign,
    })
  })

  return router
}
```

- [ ] **Step 4.1.2**: Wire into `packages/agent/src/routes/admin/index.ts`. Read the file first to find existing router registration pattern, then append:

```typescript
import { createTorqueAdminRouter } from './torque.js'
// ...existing routers
adminRouter.use('/torque', createTorqueAdminRouter())
```

- [ ] **Step 4.1.3**: Create `packages/agent/tests/routes/admin/torque.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../src/integrations/torque/mcp-client.js', () => ({
  TorqueMCPClient: vi.fn().mockImplementation(() => ({
    getCampaign: vi.fn().mockResolvedValue({
      id: 'camp_devnet_1',
      name: 'Sipher Private Action Rebate',
      status: 'ACTIVE',
      remainingPool: 4.95,
      rewardAmountPerEvent: 0.005,
      rewardToken: 'SOL',
    }),
  })),
}))

import { createTorqueAdminRouter } from '../../../src/routes/admin/torque.js'

describe('GET /admin/torque/status', () => {
  beforeEach(() => {
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_KEY
    delete process.env.TORQUE_MCP_URL
  })

  it('returns enabled=false when env disables', async () => {
    const app = express().use('/admin/torque', createTorqueAdminRouter())
    const res = await request(app).get('/admin/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, enabled: false })
  })

  it('returns campaign metadata when env enables', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_devnet_1'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_main'

    const app = express().use('/admin/torque', createTorqueAdminRouter())
    const res = await request(app).get('/admin/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      enabled: true,
      campaign: { name: 'Sipher Private Action Rebate', status: 'ACTIVE' },
    })
  })
})
```

- [ ] **Step 4.1.4**: Run, confirm pass:

```bash
pnpm --filter @sipher/agent test:run -- admin/torque
```

Expected: PASS — 2 tests green.

### Step 4.2: Integration test (opt-in, real Torque devnet)

- [ ] **Step 4.2.1**: Create `packages/agent/tests/integrations/torque/torque-emit-roundtrip.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import type { SipherGrowthEvent } from '../../../src/integrations/torque/types.js'

const apiKey = process.env.TORQUE_API_KEY
const baseUrl = process.env.TORQUE_MCP_URL
const campaignId = process.env.TORQUE_TEST_CAMPAIGN_ID

const skip = !apiKey || !baseUrl || !campaignId

describe.skipIf(skip)('integration: torque devnet emit roundtrip', () => {
  let client: TorqueMCPClient

  beforeAll(() => {
    client = new TorqueMCPClient({
      apiKey: apiKey!,
      baseUrl: baseUrl!,
      campaignId: campaignId!,
      network: 'devnet',
    })
  })

  it('emits a custom_event and receives an eventId', async () => {
    const event: SipherGrowthEvent = {
      event: 'sipher.private_send_completed',
      wallet: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
      ts: new Date().toISOString(),
      tx_signature: `test_${Date.now()}`,
      network: 'devnet',
      metadata: {
        rebate_destination: '11111111111111111111111111111111',
      },
    }

    const result = await client.emitEvent(event)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.eventId).toMatch(/^evt_/)
    }
  }, 15_000)
})
```

- [ ] **Step 4.2.2**: Run with env set (after Step 4.0.2):

```bash
TORQUE_TEST_CAMPAIGN_ID=$(...) pnpm --filter @sipher/agent test:run -- torque-emit-roundtrip
```

Expected: PASS — 1 test green. Skip cleanly when env unset.

### Step 4.3: E2E test (opt-in)

- [ ] **Step 4.3.1**: Create `packages/agent/tests/integrations/torque/torque-rebate-e2e.test.ts`. This test exercises the full sipher.send → growth hook → rebate flow on devnet. **Defer detailed implementation to execution time** — the test requires:
  - Funded devnet wallet with both `solana-devnet.json` keypair AND a published `SIP-STEALTH` SNS record
  - 10s+ poll loop after `executeSend` to wait for rebate TX confirmation
  - Solana balance assertion on the derived stealth address

Skeleton:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'

const KEYPAIR_PATH = `${homedir()}/Documents/secret/solana-devnet.json`
const TEST_DOMAIN = process.env.SIP_TEST_DOMAIN
const apiKey = process.env.TORQUE_API_KEY
const baseUrl = process.env.TORQUE_MCP_URL
const campaignId = process.env.TORQUE_TEST_CAMPAIGN_ID

const skip = !existsSync(KEYPAIR_PATH) || !TEST_DOMAIN || !apiKey || !baseUrl || !campaignId

describe.skipIf(skip)('e2e: sipher send → torque rebate (devnet)', () => {
  let connection: Connection
  let payer: Keypair

  beforeAll(() => {
    connection = new Connection('https://api.devnet.solana.com', 'confirmed')
    const secret = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8'))
    payer = Keypair.fromSecretKey(new Uint8Array(secret))
  })

  it('emits event and rebate lands at derived stealth address', async () => {
    // 1. Build + sign + send a sipher.send TX (real devnet, 0.001 SOL)
    // 2. Wait for confirmation
    // 3. Run the growth hook manually with the result
    // 4. Poll the rebate destination for ~10s
    // 5. Assert balance increased by 0.005 SOL (rebate amount)

    // Implementation deferred — fill in at execution time using:
    //   - executeSend from src/tools/send.js
    //   - wrapExecutorWithGrowthHook from src/integrations/torque/growth-hook.js
    //   - deriveRebateDestination to compute expected destination

    expect(true).toBe(true) // placeholder, replace at execution
  }, 60_000)
})
```

- [ ] **Step 4.3.2**: Mark this test as STUB in commit message; full implementation is the LAST task of PR-D's execution and gates "PR ready for review".

### Step 4.4: README

- [ ] **Step 4.4.1**: Create `packages/agent/src/integrations/torque/README.md`:

```markdown
# Torque MCP Integration

Sipher integrates [Torque](https://torque.so) MCP to drive a per-action rebate growth loop. After every successful private send / swap / claim / drip / batch-send via sipher's agent tools, a `custom_event` is emitted to a Torque campaign that distributes a small SOL/USDC rebate to a fresh stealth address derived from the user's published SNS `SIP-STEALTH` record.

## Setup

```bash
# In ~/Documents/secret/sipher-vps-secrets.env (or .env for local dev)
TORQUE_API_KEY=tk_...                                     # From Torque dashboard
TORQUE_MCP_URL=https://api.torque.so                      # MCP server endpoint
TORQUE_CAMPAIGN_ID_DEVNET=camp_dev_xxx                    # Devnet campaign
TORQUE_CAMPAIGN_ID_MAINNET=camp_main_xxx                  # Mainnet campaign
TORQUE_GROWTH_ENABLED=true                                # Master kill-switch
```

When `TORQUE_GROWTH_ENABLED=false` (default) the entire integration is bypassed cleanly — sipher tools work as before, no events are emitted.

## Test commands

```bash
# Unit tests (always run)
pnpm --filter @sipher/agent test:run -- integrations/torque

# Integration test (opt-in, requires env)
TORQUE_TEST_CAMPAIGN_ID=$TORQUE_CAMPAIGN_ID_DEVNET pnpm --filter @sipher/agent test:run -- torque-emit-roundtrip

# E2E test (opt-in, requires devnet keypair + SIP_TEST_DOMAIN)
SIP_TEST_DOMAIN=therector.sol pnpm --filter @sipher/agent test:run -- torque-rebate-e2e
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

Users who want zero attribution leakage should set `TORQUE_GROWTH_ENABLED=false` (or use sipher without the growth-hook integration enabled by their host).

## Architecture

```
sipher tool execution → growth-hook → rebate-destination → TorqueMCPClient → Torque MCP server
```

See `docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md` for full design.

## Friction Log

`docs/integrations/torque/FRICTION-LOG.md` — live build journal capturing API surprises, doc gaps, and praise.
```

### Step 4.5: Friction Log

- [ ] **Step 4.5.1**: Create `docs/integrations/torque/FRICTION-LOG.md`:

```markdown
# Torque MCP Integration — Friction Log

Live build journal during the Torque MCP integration sprint (May 12-26, 2026). Updated daily.

## What broke

_To be filled during build. Capture: concrete API errors, MCP server endpoint surprises, SDK ↔ MCP semantic mismatches, doc contradictions._

## What was confusing

_To be filled. Onboarding gaps, missing examples, unclear which primitive maps to which use case._

## What we'd improve

_To be filled. Concrete suggestions tagged by priority (would-block-adoption / nice-to-have)._

## What worked well

_To be filled. Genuine praise where deserved — keeps the log honest._

## Telegram interactions

_To be filled. Q&A with @smicktrq during build, with timestamps. Signals real engagement._

---

## Day 1 — 2026-05-12

- (entries added during PR-A execution)
```

### Step 4.6: Regression + commit + push

- [ ] **Step 4.6.1**: Run full agent suite:

```bash
pnpm --filter @sipher/agent test:run
```

Expected: previous count + 4 (2 admin + 1 integration + 1 e2e stub) = 1,517+ green.

- [ ] **Step 4.6.2**: Typecheck:

```bash
pnpm --filter @sipher/agent typecheck
```

- [ ] **Step 4.6.3**: Commit + push + PR:

```bash
git add packages/agent/src/routes/admin/torque.ts \
        packages/agent/src/routes/admin/index.ts \
        packages/agent/src/integrations/torque/README.md \
        packages/agent/tests/routes/admin/torque.test.ts \
        packages/agent/tests/integrations/torque/torque-emit-roundtrip.test.ts \
        packages/agent/tests/integrations/torque/torque-rebate-e2e.test.ts \
        docs/integrations/torque/FRICTION-LOG.md
git commit -m "feat(agent): torque devnet campaign + admin endpoint + integration test + README + friction log"
git push -u origin feat/torque-devnet-campaign
gh pr create --title "feat(agent): torque devnet campaign + ops surface (PR-D of 5)" --body "Adds devnet campaign integration, GET /admin/torque/status, opt-in integration + e2e tests (skip cleanly without env), README with privacy posture disclosure, and FRICTION-LOG seed. PR-E (mainnet rollout) is optional and gated on this PR's acceptance."
```

### Step 4.7: Demo recording (non-code, post-merge)

- [ ] **Step 4.7.1**: After PR-D merges, record the 90-second demo per the spec's demo asset section.

- [ ] **Step 4.7.2**: Post tweet from the chosen account tagging `@torqueprotocol`. Capture tweet URL.

- [ ] **Step 4.7.3**: Update `packages/agent/src/integrations/torque/README.md` with a "Demo" section linking the tweet + a Loom or YouTube mirror.

---

## Task 5 (PR-E, OPTIONAL): Mainnet Rollout

Gated on PR-D devnet flow being green for ≥7 days. Builds:

- Fresh dedicated mainnet rebate wallet (generated via `solana-keygen` + stored in `~/Documents/secret/sipher-rebate-mainnet.json`, mode 600)
- Mainnet Torque campaign (small initial pool, $50 USDC equivalent)
- Monitoring playbook in `packages/agent/src/integrations/torque/MAINNET-RUNBOOK.md` (alert thresholds, refill procedure, kill-switch trigger conditions)
- `TORQUE_CAMPAIGN_ID_MAINNET` populated in VPS secrets
- Sipher production deploy with `TORQUE_GROWTH_ENABLED=true` (rolling restart on existing VPS infra)
- 7-day health monitoring post-rollout before scaling pool

PR-E is intentionally not detailed at task-level here. It depends on PR-D outcomes; brainstorming refresh recommended at start of PR-E session.

---

## Self-Review

**Spec coverage:**
- Architecture (Section 1) → Tasks 1, 2, 3 ✓
- Event emission (Section 2) → Task 2 (growth-hook + 5 event mapping) ✓
- Campaign + reward pool (Section 3) → Task 4.0.2 (provisioning) + Task 5 (mainnet) ✓
- Testing (Section 4) → Tasks 1, 2 (unit), Task 4.2 (integration), Task 4.3 (e2e) ✓
- Demo + Friction Log (Section 5) → Task 4.5, Task 4.7 ✓
- Acceptance criteria (9 items) → all covered across PR-A through PR-D, with PR-E gating mainnet items

**Placeholder scan:**
- Task 4.3.1 has a STUB e2e test that is explicitly called out as "fill at execution time." This is a deliberate scope choice — the e2e test depends on a published SIP-STEALTH record (which RECTOR has on `therector.sol`) AND a funded devnet rebate pool, both established at execution. The skeleton + skip predicate are concrete. Risk acknowledged.
- Task 3.3.1 has `as never` casts in the `createAgent` call signature pending agent.ts inspection at edit time. Risk: low — engineer is required to read the file first per Step 3.0.2.

**Type consistency:**
- `SipherGrowthEvent` used identically across types.ts, mcp-client.ts, growth-hook.ts ✓
- `RebateDestination` discriminated union (`'stealth' | 'unavailable'`) consistent across rebate-destination.ts and growth-hook.ts ✓
- `TorqueMCPClientOptions` extended by `GrowthHookOptions` — interface inheritance correct ✓
- `wrapExecutorWithGrowthHook` signature `(baseExecutor, opts) => wrappedExecutor` consistent across PR-B implementation, PR-C wiring, and PR-C wiring tests ✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-torque-mcp-integration.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

# PR-E: Torque Canonical Ingest Contract Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Sipher's Torque MCP integration to use Torque's canonical ingest contract — `POST ingest.torque.so/events` with `x-api-key` header, flattened `{userPubkey, timestamp, eventName, data}` body shape, and underscored event slugs. Drop the campaign-related env vars since Torque has no Campaign primitive.

**Architecture:** Single bundled PR touching: `types.ts` (flatten + rename), `mcp-client.ts` (URL/header/body), `growth-hook.ts` (event construction), `config/network.ts` (env rename, drop campaign vars), `routes/admin.ts` (replace `campaignFetchOk` with ingester reachability probe), `agent.ts` (drop campaignId from call sites), tests for each, plus README + spec + Friction Log sync. Branch: `feat/torque-canonical-ingest` from `main` at `b6b1e37`.

**Tech Stack:** TypeScript 2-space no-semicolons ESM (`.js` extensions on relative imports), Vitest, fetch API, conventional commit prefixes, GPG-signed commits.

---

## File Structure

**Source files (modify):**
- `packages/agent/src/integrations/torque/types.ts` — flatten `SipherGrowthEvent`, rename slugs to underscore form, drop campaign types
- `packages/agent/src/integrations/torque/mcp-client.ts` — rewrite URL/header/body, replace `getCampaign()` with `pingIngester()`
- `packages/agent/src/integrations/torque/growth-hook.ts` — rewrite event construction; drop `campaignId` from `GrowthHookOptions`
- `packages/agent/src/integrations/torque/README.md` — sync env names, slug list, dashboard prerequisites
- `packages/agent/src/config/network.ts` — rename `TorqueConfig` fields, drop `campaignId{Devnet,Mainnet}`
- `packages/agent/src/routes/admin.ts:130-159` — replace `getCampaign` with `pingIngester`; drop `campaignId` field from response
- `packages/agent/src/agent.ts:321-336, 448-462` — drop `campaignId` argument; align with new `loadTorqueConfig` shape

**Test files (modify):**
- `packages/agent/tests/integrations/torque/mcp-client.test.ts` — assert new URL/header/body/error envelopes
- `packages/agent/tests/integrations/torque/growth-hook.test.ts` — assert new emitted event shape
- `packages/agent/tests/config/network-torque.test.ts` — assert new env var names + dropped campaign vars

**Doc files (modify):**
- `docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md` — sync the contract section
- `docs/integrations/torque/FRICTION-LOG.md` — append discovery entries from the dashboard probe + rewrite

---

## Task 1: Sync the spec with the locked canonical contract

**Files:**
- Modify: `docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md`

- [ ] **Step 1: Read the current spec**

Run: `wc -l docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md`
Then `Read` the file to find the sections describing endpoint URL, headers, event payload shape, env vars, and event slugs.

- [ ] **Step 2: Patch the endpoint contract section**

Replace any mention of `${baseUrl}/campaigns/${campaignId}/events` with `${ingesterUrl}/events`. Replace `x-torque-api-key` header references with `x-api-key`. Replace nested `{event, wallet, ts, metadata: {...}}` body example with the new flat `{userPubkey, timestamp, eventName, data: {...}}` shape. The data sub-object is a flat map of string|number|boolean only.

- [ ] **Step 3: Patch the env vars section**

Rename `TORQUE_API_KEY` → `TORQUE_API_TOKEN`. Rename `TORQUE_MCP_URL` → `TORQUE_INGESTER_URL`. Delete any reference to `TORQUE_CAMPAIGN_ID_DEVNET` and `TORQUE_CAMPAIGN_ID_MAINNET` — Torque has no Campaign primitive.

- [ ] **Step 4: Patch the slug list**

Rename event slugs to underscore form everywhere in the spec:
- `sipher.private_send_completed` → `sipher_private_send_completed`
- `sipher.private_swap_completed` → `sipher_private_swap_completed`
- `sipher.private_claim_completed` → `sipher_private_claim_completed`
- `sipher.recurring_send_tick` → `sipher_recurring_send_tick`
- `sipher.batch_send_completed` → `sipher_batch_send_completed`

- [ ] **Step 5: Add a "Discovery + rewrite" addendum section at the end of the spec**

Document the four-host architecture (`server.torque.so` CRUD, `platform.torque.so` UI, `ingest.torque.so` events, `ai.torque.so` AI), the Torque primitives (`IncentiveType: REBATE`, `EventDataSource: CUSTOM_EVENT_PROVIDER`), and the mainnet-only constraint for pool funding and reward distribution (event ingestion is network-agnostic).

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/torque-canonical-ingest
git add docs/superpowers/specs/2026-05-12-torque-mcp-integration-design.md
git commit -m "docs(torque): sync spec with canonical ingest contract + four-host architecture"
```

---

## Task 2: Rewrite `types.ts` + `mcp-client.ts` + their tests as one atomic change

These three files are coupled — the type rename forces the client + tests to update together. Done in one TDD cycle.

**Files:**
- Modify: `packages/agent/src/integrations/torque/types.ts` (full rewrite)
- Modify: `packages/agent/src/integrations/torque/mcp-client.ts` (full rewrite)
- Modify: `packages/agent/src/integrations/torque/index.ts` (drop `TorqueCampaign`, add `TorquePingResult`)
- Modify: `packages/agent/tests/integrations/torque/mcp-client.test.ts` (full rewrite)

- [ ] **Step 1: Write the new `types.ts`**

Replace the entire file contents with:

```typescript
/**
 * Event emitted to Torque ingest after a successful fund-moving sipher tool call.
 * Shape mirrors Torque's canonical ingest contract — flat top-level fields
 * with a `data` sub-object whose values are string|number|boolean only.
 *
 * userPubkey is required for attribution. `data.rebate_destination` carries
 * the per-event fresh stealth address so Torque cannot learn the recipient
 * identity.
 */
export interface SipherGrowthEvent {
  userPubkey: string
  /** ms-epoch number, NOT ISO string */
  timestamp: number
  eventName: SipherEventName
  data: SipherGrowthEventData
}

export interface SipherGrowthEventData {
  tx_signature: string
  network: 'mainnet-beta' | 'devnet'
  rebate_destination: string
  /** Present only on swap events for amount attribution */
  amount_lamports?: number
  /** Present only on swap events */
  asset?: string
}

export type SipherEventName =
  | 'sipher_private_send_completed'
  | 'sipher_private_swap_completed'
  | 'sipher_private_claim_completed'
  | 'sipher_recurring_send_tick'
  | 'sipher_batch_send_completed'

export interface TorqueMCPClientOptions {
  ingesterUrl: string
  apiToken: string
  /** ms; default 8000 */
  timeoutMs?: number
}

export type TorqueEmitResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'rate_limit' | 'network' | 'event_undefined' | 'validation' | 'unknown'; message: string }

export type TorquePingResult =
  | { ok: true }
  | { ok: false; reason: 'auth' | 'network' | 'unknown'; message: string }
```

- [ ] **Step 2: Write the new `mcp-client.ts`**

Replace the entire file contents with:

```typescript
import type {
  SipherGrowthEvent,
  TorqueEmitResult,
  TorqueMCPClientOptions,
  TorquePingResult,
} from './types.js'

const DEFAULT_TIMEOUT_MS = 8000

export class TorqueMCPClient {
  private readonly ingesterUrl: string
  private readonly apiToken: string
  private readonly timeoutMs: number

  constructor(opts: TorqueMCPClientOptions) {
    this.ingesterUrl = opts.ingesterUrl.replace(/\/+$/, '')
    this.apiToken = opts.apiToken
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async emitEvent(event: SipherGrowthEvent): Promise<TorqueEmitResult> {
    const url = `${this.ingesterUrl}/events`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiToken,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'auth', message: `Torque rejected api token (${response.status})` }
      }
      if (response.status === 429) {
        return { ok: false, reason: 'rate_limit', message: 'Torque rate limit hit' }
      }
      if (response.status === 400) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        const message = body?.message ?? 'Torque returned 400'
        if (/Event not found/i.test(message)) {
          return { ok: false, reason: 'event_undefined', message }
        }
        return { ok: false, reason: 'validation', message }
      }
      if (!response.ok) {
        return { ok: false, reason: 'unknown', message: `Torque returned ${response.status}` }
      }
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, reason: 'network', message }
    }
  }

  /**
   * Reachability ping for ops/admin visibility. POSTs an empty body and treats
   * any 4xx/2xx as reachable (server is up). Network errors → not reachable.
   */
  async pingIngester(): Promise<TorquePingResult> {
    const url = `${this.ingesterUrl}/events`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiToken,
        },
        body: '{}',
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'auth', message: `Torque rejected api token (${response.status})` }
      }
      // Any other response (including 400 schema rejection) means the host is reachable.
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, reason: 'network', message }
    }
  }
}
```

- [ ] **Step 3: Write the new `mcp-client.test.ts`**

Replace the entire file contents with:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import type { SipherGrowthEvent } from '../../../src/integrations/torque/types.js'

const baseEvent: SipherGrowthEvent = {
  userPubkey: 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N',
  timestamp: 1747068000000,
  eventName: 'sipher_private_send_completed',
  data: {
    tx_signature: '3QCoHcJ1NNg',
    network: 'devnet',
    rebate_destination: '4HC3vQB5s5c',
  },
}

describe('TorqueMCPClient.emitEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the event with x-api-key header to /events with flat body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'OK' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })

    const result = await client.emitEvent(baseEvent)

    expect(result).toStrictEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://ingest.torque.test/events')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-api-key': 'tk_secret',
    })
    expect(JSON.parse(init?.body as string)).toStrictEqual(baseEvent)
  })

  it('strips trailing slash from ingesterUrl', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'OK' }), { status: 200 }),
    )

    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test/',
      apiToken: 'tk_secret',
    })

    await client.emitEvent(baseEvent)
    expect(fetchSpy.mock.calls[0]![0]).toBe('https://ingest.torque.test/events')
  })
})

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
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
  }

  it('returns auth reason on 401', async () => {
    const client = clientWithMockedFetch(401)
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/401/) })
  })

  it('returns auth reason on 403', async () => {
    const client = clientWithMockedFetch(403)
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/403/) })
  })

  it('returns rate_limit reason on 429', async () => {
    const client = clientWithMockedFetch(429)
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'rate_limit', message: expect.stringMatching(/rate limit/i) })
  })

  it('returns event_undefined reason when 400 says "Event not found"', async () => {
    const client = clientWithMockedFetch(400, { status: 'BAD_REQUEST', message: 'Event not found for this API key' })
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({
      ok: false,
      reason: 'event_undefined',
      message: 'Event not found for this API key',
    })
  })

  it('returns validation reason for other 400 errors', async () => {
    const client = clientWithMockedFetch(400, { status: 'BAD_REQUEST', message: 'body/data Required' })
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({
      ok: false,
      reason: 'validation',
      message: 'body/data Required',
    })
  })

  it('returns network reason on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.emitEvent({
      userPubkey: 'C1phr',
      timestamp: 1747068000000,
      eventName: 'sipher_private_send_completed',
      data: { tx_signature: 's', network: 'devnet', rebate_destination: 'r' },
    })
    expect(result).toStrictEqual({ ok: false, reason: 'network', message: 'connection refused' })
  })
})

describe('TorqueMCPClient.pingIngester', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns ok on 2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: true })
  })

  it('returns ok on 400 (host reachable, just rejected the empty body)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'BAD_REQUEST', message: 'body/eventName Required, body/data Required' }), {
        status: 400,
      }),
    )
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: true })
  })

  it('returns auth reason on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: false, reason: 'auth', message: expect.stringMatching(/401/) })
  })

  it('returns network reason on fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'))
    const client = new TorqueMCPClient({
      ingesterUrl: 'https://ingest.torque.test',
      apiToken: 'tk_secret',
    })
    const result = await client.pingIngester()
    expect(result).toStrictEqual({ ok: false, reason: 'network', message: 'connection refused' })
  })
})
```

- [ ] **Step 4: Patch `index.ts` re-exports**

Replace the contents of `packages/agent/src/integrations/torque/index.ts` with:

```typescript
export { TorqueMCPClient } from './mcp-client.js'
export { deriveRebateDestination, _resetRebateDestinationCacheForTests } from './rebate-destination.js'
export { wrapExecutorWithGrowthHook } from './growth-hook.js'
export type {
  SipherGrowthEvent,
  SipherGrowthEventData,
  SipherEventName,
  TorqueMCPClientOptions,
  TorqueEmitResult,
  TorquePingResult,
} from './types.js'
export type { RebateDestination, DeriveRebateDestinationParams } from './rebate-destination.js'
export type { GrowthHookOptions } from './growth-hook.js'
```

Change: drops `TorqueCampaign`, adds `SipherGrowthEventData` + `TorquePingResult`.

- [ ] **Step 5: Run the new test suite — expect failures from downstream files that haven't been updated yet**

Run: `pnpm --filter @sipher/agent test --run tests/integrations/torque/mcp-client.test.ts`
Expected: PASS for mcp-client.test.ts itself, but the typecheck/other tests may still fail (deferred to next tasks).

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/integrations/torque/types.ts \
        packages/agent/src/integrations/torque/mcp-client.ts \
        packages/agent/src/integrations/torque/index.ts \
        packages/agent/tests/integrations/torque/mcp-client.test.ts
git commit -m "refactor(agent): rewrite TorqueMCPClient + types for canonical ingest contract"
```

---

## Task 3: Rewrite `growth-hook.ts` + tests

**Files:**
- Modify: `packages/agent/src/integrations/torque/growth-hook.ts` (drop campaignId, new event construction)
- Modify: `packages/agent/tests/integrations/torque/growth-hook.test.ts` (assert new shape)

- [ ] **Step 1: Write the new `growth-hook.ts`**

Replace the entire file contents with:

```typescript
import type { Connection } from '@solana/web3.js'
import { TorqueMCPClient } from './mcp-client.js'
import { deriveRebateDestination } from './rebate-destination.js'
import type { SipherEventName, SipherGrowthEvent, TorqueMCPClientOptions } from './types.js'

export interface GrowthHookOptions extends TorqueMCPClientOptions {
  growthEnabled: boolean
  /** Network used to populate SipherGrowthEvent.data.network. */
  network: 'mainnet-beta' | 'devnet'
  /** Optional connection for rebate-destination SNS resolution; emission is skipped if omitted. */
  connection?: Connection
}

/** Map sipher tool name → growth event name. Read-only tools are intentionally absent. */
const TOOL_EVENT_MAP: Record<string, SipherEventName> = {
  send: 'sipher_private_send_completed',
  swap: 'sipher_private_swap_completed',
  claim: 'sipher_private_claim_completed',
  drip: 'sipher_recurring_send_tick',
  splitSend: 'sipher_batch_send_completed',
}

/** Swap outputs are on-chain DEX events already; include lamport amount for Torque attribution. */
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
      console.warn(
        `[torque] growth event emission threw (suppressed): ${err instanceof Error ? err.message : String(err)}`,
      )
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

  if (!opts.connection) return

  const domain =
    typeof input.recipient === 'string' && input.recipient.endsWith('.sol')
      ? input.recipient
      : undefined

  const destination = await deriveRebateDestination({
    wallet,
    domain,
    connection: opts.connection,
  })

  if (destination.kind !== 'stealth') return

  const amountLamports = AMOUNT_INCLUDED_TOOLS.has(toolName)
    ? extractAmountLamports(result)
    : undefined
  const asset = AMOUNT_INCLUDED_TOOLS.has(toolName) ? extractAsset(result) : undefined

  const event: SipherGrowthEvent = {
    userPubkey: wallet,
    timestamp: Date.now(),
    eventName,
    data: {
      tx_signature: txSignature,
      network: opts.network,
      rebate_destination: destination.address,
      ...(amountLamports !== undefined ? { amount_lamports: amountLamports } : {}),
      ...(asset !== undefined ? { asset } : {}),
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

function extractAsset(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as Record<string, unknown>
  if (typeof r.asset === 'string') return r.asset
  if (typeof r.outputMint === 'string') return r.outputMint
  return undefined
}
```

Key change: drop the `campaignId` no-op short-circuit because there's no campaign concept any more. Empty `ingesterUrl` or empty `apiToken` is already covered by `loadTorqueConfig()` returning null.

- [ ] **Step 2: Read the existing `growth-hook.test.ts` to see the test patterns and mocks**

Run: `Read packages/agent/tests/integrations/torque/growth-hook.test.ts`
Note the fixture data, the `vi.mocked()` patterns, and how the test currently mocks `TorqueMCPClient.emitEvent`.

- [ ] **Step 3: Rewrite `growth-hook.test.ts` to assert the new flattened event shape**

Update every test fixture from:
```typescript
{ event: 'sipher.private_send_completed', wallet, ts, tx_signature, network, metadata: {...} }
```
to:
```typescript
{ userPubkey: wallet, timestamp: <number>, eventName: 'sipher_private_send_completed', data: { tx_signature, network, rebate_destination, ... } }
```

For `timestamp`, use `expect.any(Number)` since `Date.now()` is non-deterministic. Or stub `Date.now` via `vi.spyOn(Date, 'now').mockReturnValue(1747068000000)`.

Drop any test asserting the `campaignId` no-op short-circuit (that behavior was removed). Replace it with a test asserting the wrapper passes through cleanly when `growthEnabled: false`.

Update fixtures' `ingesterUrl` field name (was `baseUrl`) and `apiToken` (was `apiKey`).

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @sipher/agent test --run tests/integrations/torque/growth-hook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/integrations/torque/growth-hook.ts \
        packages/agent/tests/integrations/torque/growth-hook.test.ts
git commit -m "refactor(agent): rewrite growth-hook for flat ingest event shape, drop campaign concept"
```

---

## Task 4: Rewrite `config/network.ts` `loadTorqueConfig` + tests

**Files:**
- Modify: `packages/agent/src/config/network.ts:72-106`
- Modify: `packages/agent/tests/config/network-torque.test.ts`

- [ ] **Step 1: Patch `network.ts`**

Replace lines 72-106 of `packages/agent/src/config/network.ts` (the entire "Torque MCP integration config" section) with:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Torque MCP integration config
// ─────────────────────────────────────────────────────────────────────────────

export interface TorqueConfig {
  apiToken: string
  ingesterUrl: string
}

/**
 * Load Torque MCP integration config from env. Returns null if integration is
 * disabled (TORQUE_GROWTH_ENABLED != 'true') or required env vars are missing.
 * Caller treats null as "Torque integration disabled" — passes baseExecutor
 * through unchanged.
 *
 * Env var names follow the official @torque-labs/mcp convention:
 * - TORQUE_API_TOKEN: project-scoped event-ingest API key from
 *   platform.torque.so/developer.
 * - TORQUE_INGESTER_URL: defaults to https://ingest.torque.so. Override only
 *   for staging/test deployments.
 */
export function loadTorqueConfig(): TorqueConfig | null {
  const enabled = process.env.TORQUE_GROWTH_ENABLED === 'true'
  if (!enabled) return null

  const apiToken = process.env.TORQUE_API_TOKEN
  const ingesterUrl = process.env.TORQUE_INGESTER_URL ?? 'https://ingest.torque.so'

  if (!apiToken) {
    console.warn(
      '[torque] TORQUE_GROWTH_ENABLED=true but TORQUE_API_TOKEN missing — disabling integration',
    )
    return null
  }

  return { apiToken, ingesterUrl }
}
```

- [ ] **Step 2: Read existing `network-torque.test.ts`**

Run: `Read packages/agent/tests/config/network-torque.test.ts`
Note the env-stub patterns (likely `vi.stubEnv` or `process.env` assignment with cleanup).

- [ ] **Step 3: Rewrite `network-torque.test.ts`**

Update tests:
- Assert `loadTorqueConfig()` returns null when `TORQUE_GROWTH_ENABLED` is unset, `'false'`, or any other value.
- Assert it returns null when `TORQUE_API_TOKEN` is missing (with `TORQUE_GROWTH_ENABLED=true`).
- Assert it returns `{apiToken, ingesterUrl}` with the new field names when env vars are present.
- Assert it defaults `ingesterUrl` to `https://ingest.torque.so` when `TORQUE_INGESTER_URL` is unset but `TORQUE_API_TOKEN` is set.
- Assert it uses the env override when both are set.
- Drop any test asserting `campaignIdDevnet`/`campaignIdMainnet` (those fields are gone).

Example test for the default ingester URL:

```typescript
it('defaults ingesterUrl to https://ingest.torque.so when env override absent', () => {
  vi.stubEnv('TORQUE_GROWTH_ENABLED', 'true')
  vi.stubEnv('TORQUE_API_TOKEN', 'tk_secret')
  vi.stubEnv('TORQUE_INGESTER_URL', '')
  expect(loadTorqueConfig()).toStrictEqual({
    apiToken: 'tk_secret',
    ingesterUrl: 'https://ingest.torque.so',
  })
})
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @sipher/agent test --run tests/config/network-torque.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/config/network.ts \
        packages/agent/tests/config/network-torque.test.ts
git commit -m "refactor(agent): rename Torque env vars to official names, drop campaign vars"
```

---

## Task 5: Update `routes/admin.ts` `/api/torque/status` route + tests

**Files:**
- Modify: `packages/agent/src/routes/admin.ts:130-159`
- Modify: any admin route test file under `packages/agent/tests/routes/`

- [ ] **Step 1: Identify the admin route test file**

Run: `find packages/agent/tests/routes -name "*admin*" -o -name "*torque*"`
The relevant file will likely be `packages/agent/tests/routes/admin.test.ts` or similar. Read it to find existing `/api/torque/status` tests.

- [ ] **Step 2: Patch `routes/admin.ts` `/api/torque/status` route**

Replace the existing route (lines 130-159) with:

```typescript
adminRouter.get('/api/torque/status', async (_req, res) => {
  const config = loadTorqueConfig()
  if (!config) {
    ;(res as any).status(200).json({
      ok: true,
      enabled: false,
      reason: 'TORQUE_GROWTH_ENABLED is false or required env vars missing',
    })
    return
  }

  const network = loadNetworkConfig().clusterName

  const client = new TorqueMCPClient({
    apiToken: config.apiToken,
    ingesterUrl: config.ingesterUrl,
  })

  const ping = await client.pingIngester()
  ;(res as any).status(200).json({
    ok: true,
    enabled: true,
    network,
    ingesterUrl: config.ingesterUrl,
    ingesterReachable: ping.ok,
    ingesterReason: ping.ok ? undefined : ping.reason,
  })
})
```

- [ ] **Step 3: Update the admin route tests**

For each existing test asserting `campaignId` or `campaignFetchOk` in the response body, rewrite to assert:
- `enabled: true|false`
- `network: 'devnet' | 'mainnet-beta'`
- `ingesterUrl: <expected>`
- `ingesterReachable: true|false`
- `ingesterReason?: 'auth' | 'network' | 'unknown'` when not reachable

Mock `TorqueMCPClient.pingIngester` instead of `getCampaign`.

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @sipher/agent test --run tests/routes/admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/admin.ts packages/agent/tests/routes/admin.test.ts
git commit -m "refactor(agent): replace /torque/status campaignFetchOk with ingester reachability ping"
```

---

## Task 6: Update `agent.ts` call sites

**Files:**
- Modify: `packages/agent/src/agent.ts:321-336, 448-462`

- [ ] **Step 1: Patch `chat()` call site (~line 321-336)**

Replace the existing torqueExecutor block with:

```typescript
  const baseExecutor = opts.toolExecutor ?? executeTool
  const torqueConfig = loadTorqueConfig()
  const torqueExecutor = torqueConfig
    ? (() => {
        const net = loadNetworkConfig()
        return wrapExecutorWithGrowthHook(baseExecutor, {
          growthEnabled: true,
          apiToken: torqueConfig.apiToken,
          ingesterUrl: torqueConfig.ingesterUrl,
          network: net.clusterName === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
          connection: createConnection(net.clusterName, net.rpcUrl),
        })
      })()
    : baseExecutor
```

- [ ] **Step 2: Patch `chatStream()` call site (~line 448-462)**

Apply the same change pattern to the second `loadTorqueConfig()` block in `chatStream()`. Drop the `campaignId` argument; rename `apiKey` → `apiToken`, `baseUrl` → `ingesterUrl`.

- [ ] **Step 3: Run typecheck + full agent test suite**

```bash
pnpm --filter @sipher/agent typecheck
pnpm --filter @sipher/agent test --run
```
Expected: typecheck clean, all 1538+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/agent.ts
git commit -m "refactor(agent): align chat()/chatStream() Torque wiring with new config shape"
```

---

## Task 7: Update README + Friction Log

**Files:**
- Modify: `packages/agent/src/integrations/torque/README.md`
- Modify: `docs/integrations/torque/FRICTION-LOG.md`

- [ ] **Step 1: Patch the README**

Read the current README to find the env vars section, slug list, dashboard prerequisites section, and example payload.

Update:
- Env vars: `TORQUE_API_TOKEN` (was `TORQUE_API_KEY`), `TORQUE_INGESTER_URL` (was `TORQUE_MCP_URL`, default `https://ingest.torque.so`). Drop `TORQUE_CAMPAIGN_ID_DEVNET`, `TORQUE_CAMPAIGN_ID_MAINNET`.
- Slug list: underscore form for all 5 (`sipher_private_send_completed`, etc.).
- Add a "Dashboard prerequisites" section listing: project created at `platform.torque.so`, API key generated from `/developer`, 5 Custom Events defined with matching slugs + fields, REBATE Incentive with `CUSTOM_EVENT_PROVIDER` data source bound to those slugs.
- Add a "Network model" note: event ingestion is network-agnostic but pool funding + reward distribution are mainnet only. Hybrid devnet-event / mainnet-pool deployment is supported by Torque since pubkeys are the same across networks.
- Update the example event payload to the new shape: `{userPubkey, timestamp, eventName, data: {...}}`.

- [ ] **Step 2: Append Friction Log entries**

Append at least 4 dated entries to `docs/integrations/torque/FRICTION-LOG.md`:

1. `2026-05-12 — Dashboard onboarding`: cipher-admin wallet chosen as Torque account owner; HciZTd default account abandoned (no merge/transfer flow exists). Project ID prefix `cmp` + 24-char nanoid (not `camp_xxx` as assumed). API key one-time-view at creation.

2. `2026-05-12 — Canonical contract probe`: Discovered four-host architecture (`server`/`platform`/`ingest`/`ai`.torque.so). Real ingest endpoint is `POST ingest.torque.so/events` with `x-api-key` header — not `server.torque.so/campaigns/{id}/events` as the spec originally assumed. Server schema errors are gold for tests: 401 missing-header, 400 body/eventName Required, 400 Event not found for this API key.

3. `2026-05-12 — Torque primitives model`: Torque has no "Campaign" object. Built around Queries (SQL) + Incentives (binding query → distribution rules) + Lists (epoch snapshots). Our use case = `IncentiveType: REBATE` + `EventDataSource: CUSTOM_EVENT_PROVIDER`. `TORQUE_CAMPAIGN_ID_*` env vars were a misread; removed in this PR.

4. `2026-05-12 — Mainnet-only constraint`: Torque ingests events from any network (pubkeys are strings), but pool escrow and reward distribution are mainnet-only. Devnet wallets receive mainnet rewards because secp256k1/ed25519 pubkeys are network-portable. Hybrid devnet-event/mainnet-payout deployment is viable.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/integrations/torque/README.md \
        docs/integrations/torque/FRICTION-LOG.md
git commit -m "docs(torque): sync README + log canonical-contract discovery in Friction Log"
```

---

## Task 8: Final verification, push, open PR-E

- [ ] **Step 1: Run full agent test suite green**

```bash
pnpm --filter @sipher/agent test --run
```
Expected: All 1538+ tests pass (running tests, 2 opt-in skipped). If any test fails, fix before continuing.

- [ ] **Step 2: Run typecheck and lint**

```bash
pnpm --filter @sipher/agent typecheck
pnpm --filter @sipher/agent lint
```
Expected: clean output.

- [ ] **Step 3: Run sipher-wide test suite to catch any other consumers**

```bash
pnpm test --run 2>&1 | tail -15
```
Expected: no new failures. The PR touches `@sipher/agent` only; other packages should be unaffected.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/torque-canonical-ingest
```

- [ ] **Step 5: Open the PR**

Use `gh pr create` with title `feat(agent): rewrite Torque integration for canonical ingest contract (PR-E)` and a body summarizing:
- Why: previous integration was built against assumptions (campaigns, x-torque-api-key, nested metadata) that turned out wrong when probed against the live Torque endpoint
- Discovery: four-host Torque architecture, mainnet-only pool/distribution, official @torque-labs/mcp env names
- Changes: 5 source files, 3 test files, README, spec, Friction Log
- Tests: +N net (mcp-client +M, growth-hook +L, network-torque +K) — fill in actuals
- Blocker context: still depends on sipher#262 for non-claim events; option (c) claim-only scope retained for the hackathon shadow window
- Manual follow-up before merge: RECTOR creates Custom Events + REBATE Incentive in Torque dashboard, funds mainnet pool

---

## Self-Review Checklist

After completing all tasks, verify:

1. **Spec coverage:** Did each section of the canonical contract in `project_torque-mcp-integration-shipped.md` "Canonical ingest contract" get an implementation? URL/header/body/env-rename/slug-rename/admin-repurpose/test-rewrite/README/Friction-Log — all covered? ✅
2. **No placeholders:** Every step has actual code or actual command. No "implement later" or "similar to above". ✅
3. **Type consistency:** Field names match across types.ts → mcp-client.ts → growth-hook.ts → admin.ts → agent.ts. `apiToken` everywhere (not `apiKey`). `ingesterUrl` everywhere (not `baseUrl`). `eventName` everywhere (not `event`). `userPubkey` everywhere (not `wallet` in event payloads). `timestamp` is number everywhere (not ISO string). ✅

---

## Execution notes for the implementer

- TDD discipline: write the test first, run-fail, implement, run-pass, commit. Each Task is one logical commit unit even though it bundles file changes.
- GPG-sign every commit (`-S` if not default).
- Conventional commit prefixes: `refactor(agent):`, `docs(torque):`, `test(agent):` depending on the dominant change in each commit.
- After each commit, run the touched test file to verify still green.
- If you hit a test you don't understand from the existing code, don't reverse-engineer it — read the file with `Read`, ask if the test still applies under the new contract, and rewrite cleanly.
- Keep commits small (one logical change per commit) — RECTOR's preference per `feedback_phase4-execution-mode`.

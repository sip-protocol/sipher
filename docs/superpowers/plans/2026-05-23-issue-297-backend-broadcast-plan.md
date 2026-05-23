# sipher#297 Backend Broadcast Proxy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-23-issue-297-backend-broadcast-design.md`
**Branch:** `fix/issue-297-backend-broadcast` (already created, base commit `8dece1f` — spec doc)
**Issue:** [sipher#297](https://github.com/sip-protocol/sipher/issues/297)

**Goal:** Add `POST /api/tx/broadcast` to the agent backend so chat-driven sends go out via the Helius-keyed Connection instead of the FE's rate-limited public devnet RPC.

**Architecture:** Backend mounts a JWT-authenticated route that takes a base64 signed tx + blockhash + lastValidBlockHeight, broadcasts via `createConnection(net.clusterName, net.rpcUrl)`, runs the resubmit loop until `confirmTransaction` resolves, and returns `{ signature }`. FE `useTransactionSigner` replaces its `sendAndConfirmWithRetry` call with a POST to the new endpoint. Helper from `app/src/lib/sendWithRetry.ts` is ported into `packages/agent/src/lib/sendWithRetry.ts` and the FE copy is deleted.

**Tech Stack:** TypeScript, Express, Solana web3.js, Vitest + supertest (backend), Vitest + React Testing Library (frontend), `@sipher/sdk`, `apiFetch` helper.

**Spec deviation (one):** Spec §6.1 sketched a `BroadcastError` class with `code` field. Implementation uses `apiFetch` directly (matches existing FE pattern across `SignTxCard.tsx:106`, `SentinelConfirm.tsx:26`, etc.) which throws `Error(message)` from the envelope. Backend `message` field carries user-friendly text directly. No code-based UX branching needed for the Frontier deadline.

---

## File Structure

**New files:**
- `packages/agent/src/lib/sendWithRetry.ts` — port of FE helper, identical logic, Node-side `Connection` import
- `packages/agent/tests/lib/sendWithRetry.test.ts` — backend port of the 5 FE tests
- `packages/agent/src/routes/tx-broadcast.ts` — `POST /broadcast` route handler
- `packages/agent/tests/routes/tx-broadcast.test.ts` — supertest route tests
- `app/src/lib/broadcast.ts` — FE wrapper around `apiFetch` for `/api/tx/broadcast`
- `app/src/lib/__tests__/broadcast.test.ts` — FE helper tests

**Modified files:**
- `packages/agent/src/index.ts` — mount `txBroadcastRouter` at `/api/tx` behind `verifyJwt`
- `app/src/hooks/useTransactionSigner.ts` — replace `sendAndConfirmWithRetry` call with `broadcastViaBackend`

**Deleted files:**
- `app/src/lib/sendWithRetry.ts` — FE helper no longer needed (only caller is `useTransactionSigner`)
- `app/src/lib/__tests__/sendWithRetry.test.ts` — covered by backend port

---

## Task 1: Port `sendWithRetry` helper to backend

**Files:**
- Create: `packages/agent/src/lib/sendWithRetry.ts`
- Create: `packages/agent/tests/lib/sendWithRetry.test.ts`

The helper is a direct port — same dependency-injection shape (`resubmitIntervalMs`, `sleep`), same Solana-DeFi resubmit-while-confirming pattern. Tests port the 5 existing FE tests verbatim with adjusted imports.

- [ ] **Step 1.1: Write the failing test file**

Create `packages/agent/tests/lib/sendWithRetry.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '@solana/web3.js'
import { sendAndConfirmWithRetry } from '../../src/lib/sendWithRetry.js'

const FAKE_SIGNATURE = '5J7XHm...fake'
const FAKE_BLOCKHASH = 'HF3...fake'
const FAKE_BYTES = new Uint8Array([1, 2, 3])
const LAST_VALID_HEIGHT = 100

function makeConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    sendRawTransaction: vi.fn(async () => FAKE_SIGNATURE),
    confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
    ...overrides,
  } as unknown as Connection
}

// Deterministic sleep: tracks elapsed virtual ms and resolves immediately.
function makeFakeSleep() {
  const sleeps: number[] = []
  return {
    sleeps,
    sleep: (ms: number) => {
      sleeps.push(ms)
      return Promise.resolve()
    },
  }
}

describe('sendAndConfirmWithRetry (backend)', () => {
  it('returns signature on happy-path confirmation', async () => {
    const conn = makeConnection()
    const { sleep } = makeFakeSleep()

    const sig = await sendAndConfirmWithRetry(
      conn,
      FAKE_BYTES,
      FAKE_BLOCKHASH,
      LAST_VALID_HEIGHT,
      { sleep, resubmitIntervalMs: 1 },
    )

    expect(sig).toBe(FAKE_SIGNATURE)
    expect(conn.sendRawTransaction).toHaveBeenCalledTimes(1)
    expect(conn.confirmTransaction).toHaveBeenCalledOnce()
  })

  it('resubmits while confirmation is pending', async () => {
    let resolveConfirm: (v: { value: { err: null } }) => void = () => {}
    const conn = makeConnection({
      confirmTransaction: vi.fn(
        () => new Promise<{ value: { err: null } }>((r) => { resolveConfirm = r }),
      ) as unknown as Connection['confirmTransaction'],
    })
    const { sleep, sleeps } = makeFakeSleep()

    const pending = sendAndConfirmWithRetry(
      conn,
      FAKE_BYTES,
      FAKE_BLOCKHASH,
      LAST_VALID_HEIGHT,
      { sleep, resubmitIntervalMs: 1 },
    )

    // Yield enough microtasks for the resubmit loop to fire at least twice
    for (let i = 0; i < 10; i++) await Promise.resolve()

    // Now resolve confirmation
    resolveConfirm({ value: { err: null } })
    const sig = await pending

    expect(sig).toBe(FAKE_SIGNATURE)
    expect((conn.sendRawTransaction as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1)
    expect(sleeps.length).toBeGreaterThan(0)
  })

  it('swallows resubmit errors without failing the outer promise', async () => {
    let firstCall = true
    const conn = makeConnection({
      sendRawTransaction: vi.fn(async () => {
        if (firstCall) { firstCall = false; return FAKE_SIGNATURE }
        throw new Error('429 Too Many Requests')
      }) as unknown as Connection['sendRawTransaction'],
    })
    const { sleep } = makeFakeSleep()

    const sig = await sendAndConfirmWithRetry(
      conn,
      FAKE_BYTES,
      FAKE_BLOCKHASH,
      LAST_VALID_HEIGHT,
      { sleep, resubmitIntervalMs: 1 },
    )

    expect(sig).toBe(FAKE_SIGNATURE)
  })

  it('propagates first-send errors and stops the loop', async () => {
    const conn = makeConnection({
      sendRawTransaction: vi.fn(async () => {
        throw new Error('SendTransactionError: invalid signature')
      }) as unknown as Connection['sendRawTransaction'],
    })
    const { sleep } = makeFakeSleep()

    await expect(
      sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
        sleep,
        resubmitIntervalMs: 1,
      }),
    ).rejects.toThrow('SendTransactionError')
  })

  it('propagates blockheight-exceeded errors from confirmTransaction', async () => {
    const expired = new Error('TransactionExpiredBlockheightExceededError')
    expired.name = 'TransactionExpiredBlockheightExceededError'
    const conn = makeConnection({
      confirmTransaction: vi.fn(async () => { throw expired }) as unknown as Connection['confirmTransaction'],
    })
    const { sleep } = makeFakeSleep()

    await expect(
      sendAndConfirmWithRetry(conn, FAKE_BYTES, FAKE_BLOCKHASH, LAST_VALID_HEIGHT, {
        sleep,
        resubmitIntervalMs: 1,
      }),
    ).rejects.toMatchObject({ name: 'TransactionExpiredBlockheightExceededError' })
  })
})
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `pnpm --filter @sipher/agent test -- tests/lib/sendWithRetry.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/lib/sendWithRetry.js'`

- [ ] **Step 1.3: Implement the helper**

Create `packages/agent/src/lib/sendWithRetry.ts`:

```ts
import type { Connection } from '@solana/web3.js'

const RESUBMIT_INTERVAL_MS = 2000

/**
 * Send a signed transaction and aggressively resubmit until confirmed or expired.
 *
 * Public Solana RPCs are rate-limited and drop transactions silently under load.
 * The default sendRawTransaction + confirmTransaction flow waits ~60-90s for
 * confirmation but does NOT resubmit if the first send was dropped — leading
 * to spurious "block height exceeded" errors when the tx never actually landed.
 *
 * This helper resubmits the same signed bytes every 2s in the background
 * (idempotent: Solana RPCs return the same signature for duplicate sends)
 * while polling for confirmation. First confirmation wins; the loop stops.
 *
 * Ported from app/src/lib/sendWithRetry.ts — see sipher#297 for why the
 * broadcast moved server-side.
 */
export interface SendAndConfirmDeps {
  /** Delay between background resubmits. Override in tests for speed. */
  resubmitIntervalMs?: number
  /** Awaitable sleep. Override in tests with fake timers. */
  sleep?: (ms: number) => Promise<void>
}

export async function sendAndConfirmWithRetry(
  connection: Connection,
  signedTx: Uint8Array,
  blockhash: string,
  lastValidBlockHeight: number,
  deps: SendAndConfirmDeps = {},
): Promise<string> {
  const interval = deps.resubmitIntervalMs ?? RESUBMIT_INTERVAL_MS
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)))

  const submitOnce = () =>
    connection.sendRawTransaction(signedTx, { skipPreflight: true, maxRetries: 0 })

  const signature = await submitOnce()

  let stopped = false
  const resubmit = async () => {
    while (!stopped) {
      await sleep(interval)
      if (stopped) return
      submitOnce().catch(() => {})
    }
  }
  const resubmitPromise = resubmit()

  try {
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    )
    return signature
  } finally {
    stopped = true
    await resubmitPromise.catch(() => {})
  }
}
```

- [ ] **Step 1.4: Run the test to verify it passes**

Run: `pnpm --filter @sipher/agent test -- tests/lib/sendWithRetry.test.ts --run`
Expected: PASS — 5/5 tests green.

- [ ] **Step 1.5: Typecheck the new file**

Run: `pnpm --filter @sipher/agent typecheck`
Expected: 0 errors.

- [ ] **Step 1.6: Commit**

```bash
git add packages/agent/src/lib/sendWithRetry.ts packages/agent/tests/lib/sendWithRetry.test.ts
git commit -S -m "feat(agent): port sendWithRetry helper from FE to backend

Identical logic to app/src/lib/sendWithRetry.ts — broadcasts a signed
tx and aggressively resubmits every 2s while polling for confirmation.
Same dependency-injection shape (resubmitIntervalMs, sleep) for
deterministic tests. The FE copy is deleted in a later task once
useTransactionSigner is wired to the new backend endpoint.

Refs #297"
```

---

## Task 2: Add `POST /api/tx/broadcast` route

**Files:**
- Create: `packages/agent/src/routes/tx-broadcast.ts`
- Create: `packages/agent/tests/routes/tx-broadcast.test.ts`

Route style mirrors `packages/agent/src/routes/vault-deposit-tx.ts` (auth gate → body validation → connection → execute → typed error envelope). Connection is built via `createConnection(net.clusterName, net.rpcUrl)`, identical to `tool-signing.ts:65`.

- [ ] **Step 2.1: Write the failing test file**

Create `packages/agent/tests/routes/tx-broadcast.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'
import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const FAKE_SIGNATURE = '5J7XHm...fake'
const FAKE_BLOCKHASH = 'HF3abc...fake'
const LAST_VALID_HEIGHT = 100_000_000

vi.mock('../../src/config/network.js', () => ({
  loadNetworkConfig: vi.fn(() => ({
    clusterName: 'devnet',
    rpcUrl: 'https://devnet.helius-rpc.com/?api-key=REDACTED',
  })),
}))

vi.mock('@sipher/sdk', async () => {
  const actual = await vi.importActual<typeof import('@sipher/sdk')>('@sipher/sdk')
  return {
    ...actual,
    createConnection: vi.fn(),
  }
})

vi.mock('../../src/lib/sendWithRetry.js', () => ({
  sendAndConfirmWithRetry: vi.fn(),
}))

import { createConnection } from '@sipher/sdk'
import { sendAndConfirmWithRetry } from '../../src/lib/sendWithRetry.js'
import { txBroadcastRouter } from '../../src/routes/tx-broadcast.js'

function mockAuth(wallet: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (wallet) (req as unknown as { wallet: string }).wallet = wallet
    next()
  }
}

function createApp(wallet: string | null = TEST_WALLET) {
  const app = express()
  app.use(express.json())
  app.use('/api/tx', mockAuth(wallet), txBroadcastRouter)
  return app
}

/** Build a valid base64-encoded signed-tx-like payload that web3.js can deserialize. */
function buildFakeSignedTxBase64(): string {
  const tx = new Transaction()
  tx.recentBlockhash = FAKE_BLOCKHASH
  tx.feePayer = new PublicKey(TEST_WALLET)
  tx.add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(TEST_WALLET),
      toPubkey: new PublicKey(TEST_WALLET),
      lamports: 1,
    }),
  )
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64')
}

beforeEach(() => {
  vi.mocked(createConnection).mockReturnValue({
    getBlockHeight: vi.fn(async () => LAST_VALID_HEIGHT - 1000),
  } as unknown as ReturnType<typeof createConnection>)
  vi.mocked(sendAndConfirmWithRetry).mockReset()
})

describe('POST /api/tx/broadcast', () => {
  const validBody = () => ({
    serializedTx: buildFakeSignedTxBase64(),
    blockhash: FAKE_BLOCKHASH,
    lastValidBlockHeight: LAST_VALID_HEIGHT,
  })

  it('returns 401 UNAUTHENTICATED when no wallet on req', async () => {
    const app = createApp(null)
    const res = await supertest(app).post('/api/tx/broadcast').send(validBody())
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 VALIDATION_FAILED when serializedTx is missing', async () => {
    const app = createApp()
    const { serializedTx: _, ...rest } = validBody()
    const res = await supertest(app).post('/api/tx/broadcast').send(rest)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 VALIDATION_FAILED when blockhash is not a string', async () => {
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send({ ...validBody(), blockhash: 123 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 VALIDATION_FAILED when lastValidBlockHeight is not a positive number', async () => {
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send({ ...validBody(), lastValidBlockHeight: 'not a number' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 VALIDATION_FAILED when serializedTx is not valid base64', async () => {
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send({ ...validBody(), serializedTx: 'not!!base64!!' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 VALIDATION_FAILED when bytes are not a deserializable tx', async () => {
    const app = createApp()
    const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString('base64')
    const res = await supertest(app).post('/api/tx/broadcast').send({ ...validBody(), serializedTx: garbage })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 BLOCKHASH_EXPIRED when current height > lastValidBlockHeight', async () => {
    vi.mocked(createConnection).mockReturnValue({
      getBlockHeight: vi.fn(async () => LAST_VALID_HEIGHT + 1),
    } as unknown as ReturnType<typeof createConnection>)
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send(validBody())
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BLOCKHASH_EXPIRED')
  })

  it('returns 200 { signature } on happy-path broadcast + confirm', async () => {
    vi.mocked(sendAndConfirmWithRetry).mockResolvedValueOnce(FAKE_SIGNATURE)
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send(validBody())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ signature: FAKE_SIGNATURE })
  })

  it('returns 504 CONFIRMATION_TIMEOUT when blockheight expires during confirm', async () => {
    const expired = new Error('Transaction expired')
    expired.name = 'TransactionExpiredBlockheightExceededError'
    vi.mocked(sendAndConfirmWithRetry).mockRejectedValueOnce(expired)
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send(validBody())
    expect(res.status).toBe(504)
    expect(res.body.error.code).toBe('CONFIRMATION_TIMEOUT')
  })

  it('returns 502 BROADCAST_FAILED when sendRawTransaction throws non-recoverable', async () => {
    const sendErr = new Error('Invalid signature')
    sendErr.name = 'SendTransactionError'
    vi.mocked(sendAndConfirmWithRetry).mockRejectedValueOnce(sendErr)
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send(validBody())
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('BROADCAST_FAILED')
  })

  it('returns 500 INTERNAL for unknown errors and does not leak stack', async () => {
    vi.mocked(sendAndConfirmWithRetry).mockRejectedValueOnce(new Error('something weird'))
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send(validBody())
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL')
    // body must not contain key fragments
    expect(JSON.stringify(res.body)).not.toContain('api-key=')
  })

  it('redacts Helius API key fragments from error messages', async () => {
    const leaky = new Error('failed at https://devnet.helius-rpc.com/?api-key=12345-secret-uuid-67890')
    leaky.name = 'SendTransactionError'
    vi.mocked(sendAndConfirmWithRetry).mockRejectedValueOnce(leaky)
    const app = createApp()
    const res = await supertest(app).post('/api/tx/broadcast').send(validBody())
    expect(res.status).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('12345-secret-uuid-67890')
    expect(JSON.stringify(res.body)).not.toContain('api-key=')
  })
})
```

- [ ] **Step 2.2: Run the test to verify it fails**

Run: `pnpm --filter @sipher/agent test -- tests/routes/tx-broadcast.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/routes/tx-broadcast.js'`

- [ ] **Step 2.3: Implement the route**

Create `packages/agent/src/routes/tx-broadcast.ts`:

```ts
import { Router, type Request, type Response } from 'express'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { createConnection } from '@sipher/sdk'
import { loadNetworkConfig } from '../config/network.js'
import { sendAndConfirmWithRetry } from '../lib/sendWithRetry.js'

export const txBroadcastRouter = Router()

/** Strip `api-key=<value>` query params from error strings before client return. */
function redact(message: string): string {
  return message.replace(/api-key=[^&\s"')]+/gi, 'api-key=REDACTED')
}

/** Best-effort decode; returns null on invalid base64. */
function decodeBase64(input: string): Uint8Array | null {
  try {
    const buf = Buffer.from(input, 'base64')
    // Buffer.from('not!!base64!!', 'base64') silently returns garbage —
    // round-trip check protects against that.
    if (buf.toString('base64').replace(/=+$/, '') !== input.replace(/=+$/, '')) {
      return null
    }
    return new Uint8Array(buf)
  } catch {
    return null
  }
}

/** Try Transaction first, fall back to VersionedTransaction. Returns true if either succeeds. */
function isValidSignedTx(bytes: Uint8Array): boolean {
  try {
    Transaction.from(bytes)
    return true
  } catch {
    try {
      VersionedTransaction.deserialize(bytes)
      return true
    } catch {
      return false
    }
  }
}

txBroadcastRouter.post('/broadcast', async (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authenticated wallet required' },
    })
    return
  }

  const { serializedTx, blockhash, lastValidBlockHeight } = req.body as {
    serializedTx?: unknown
    blockhash?: unknown
    lastValidBlockHeight?: unknown
  }

  if (typeof serializedTx !== 'string' || serializedTx.length === 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx must be a non-empty base64 string' },
    })
    return
  }
  if (typeof blockhash !== 'string' || blockhash.length === 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'blockhash must be a non-empty string' },
    })
    return
  }
  if (typeof lastValidBlockHeight !== 'number' || !Number.isFinite(lastValidBlockHeight) || lastValidBlockHeight <= 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'lastValidBlockHeight must be a positive number' },
    })
    return
  }

  const signedBytes = decodeBase64(serializedTx)
  if (!signedBytes) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx is not valid base64' },
    })
    return
  }
  if (!isValidSignedTx(signedBytes)) {
    res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'serializedTx is not a valid signed Solana transaction' },
    })
    return
  }

  const net = loadNetworkConfig()
  const connection = createConnection(net.clusterName, net.rpcUrl)

  // Pre-flight: fail fast if the blockhash is already in the past.
  try {
    const currentHeight = await connection.getBlockHeight('confirmed')
    if (currentHeight > lastValidBlockHeight) {
      res.status(400).json({
        error: {
          code: 'BLOCKHASH_EXPIRED',
          message: 'lastValidBlockHeight already in the past — re-sign with a fresh blockhash',
        },
      })
      return
    }
  } catch {
    // getBlockHeight blip — let the actual broadcast surface the real error
  }

  try {
    const signature = await sendAndConfirmWithRetry(
      connection,
      signedBytes,
      blockhash,
      lastValidBlockHeight,
    )
    res.status(200).json({ signature })
    return
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    const rawMessage = err instanceof Error ? err.message : 'unknown error'
    const message = redact(rawMessage)

    if (name === 'TransactionExpiredBlockheightExceededError') {
      res.status(504).json({
        error: {
          code: 'CONFIRMATION_TIMEOUT',
          message: 'Transaction expired before confirmation. Retry with a fresh blockhash.',
        },
      })
      return
    }
    if (name === 'SendTransactionError') {
      res.status(502).json({
        error: { code: 'BROADCAST_FAILED', message: `RPC rejected transaction: ${message}` },
      })
      return
    }
    res.status(500).json({
      error: { code: 'INTERNAL', message },
    })
  }
})
```

- [ ] **Step 2.4: Run the test to verify it passes**

Run: `pnpm --filter @sipher/agent test -- tests/routes/tx-broadcast.test.ts --run`
Expected: PASS — 12/12 tests green.

- [ ] **Step 2.5: Typecheck**

Run: `pnpm --filter @sipher/agent typecheck`
Expected: 0 errors.

- [ ] **Step 2.6: Commit**

```bash
git add packages/agent/src/routes/tx-broadcast.ts packages/agent/tests/routes/tx-broadcast.test.ts
git commit -S -m "feat(agent): add POST /api/tx/broadcast route handler

Takes { serializedTx, blockhash, lastValidBlockHeight }, validates the
body + decodes + deserializes, then broadcasts via the Helius-backed
Connection through sendAndConfirmWithRetry. Returns { signature } on
confirm, 504 CONFIRMATION_TIMEOUT if blockhash expires, 502
BROADCAST_FAILED if the RPC rejects the first send, 400
VALIDATION_FAILED for malformed input, 401 UNAUTHENTICATED if no JWT.

Helius URL fragments are stripped from error messages before client
return — see redact() and the matching test.

The router is mounted in a follow-up commit (index.ts wiring).

Refs #297"
```

---

## Task 3: Mount the route in `packages/agent/src/index.ts`

**Files:**
- Modify: `packages/agent/src/index.ts:210` (insert after the `vaultRefundTxRouter` mount line)

The route mounts at `/api/tx` behind `verifyJwt`, identical pattern to the surrounding fund-moving routers.

- [ ] **Step 3.1: Read the current import + mount blocks**

Read `packages/agent/src/index.ts` lines 1-30 (imports) and 198-216 (mounts) to confirm exact locations.

- [ ] **Step 3.2: Add the import**

Edit `packages/agent/src/index.ts` to add the import (alphabetical-ish; place near the other route imports):

Find:
```ts
import { vaultRefundTxRouter } from './routes/vault-refund-tx.js'
```

Replace with:
```ts
import { vaultRefundTxRouter } from './routes/vault-refund-tx.js'
import { txBroadcastRouter } from './routes/tx-broadcast.js'
```

(If `vaultRefundTxRouter` import isn't at that exact line, place the new import grouped with other route imports.)

- [ ] **Step 3.3: Add the mount**

Find:
```ts
app.use('/api/vault', verifyJwt, vaultRefundTxRouter)
```

Replace with:
```ts
app.use('/api/vault', verifyJwt, vaultRefundTxRouter)
app.use('/api/tx', verifyJwt, txBroadcastRouter)
```

- [ ] **Step 3.4: Typecheck**

Run: `pnpm --filter @sipher/agent typecheck`
Expected: 0 errors.

- [ ] **Step 3.5: Run the full agent suite**

Run: `pnpm --filter @sipher/agent test -- --run`
Expected: all suites pass; new tests included; total count = baseline + (~5 helper + 12 route) ≈ 1647.

- [ ] **Step 3.6: Commit**

```bash
git add packages/agent/src/index.ts
git commit -S -m "feat(agent): mount /api/tx broadcast router behind verifyJwt

Wires POST /api/tx/broadcast into the express app, matching the
pattern of vault-deposit-tx and vault-refund-tx. JWT-authenticated;
unauthenticated callers get 401 UNAUTHENTICATED from the route handler
itself (verifyJwt middleware also rejects upstream).

Refs #297"
```

---

## Task 4: FE broadcast helper

**Files:**
- Create: `app/src/lib/broadcast.ts`
- Create: `app/src/lib/__tests__/broadcast.test.ts`

Thin wrapper around `apiFetch` — matches the existing FE pattern (`SignTxCard.tsx:106`, `SentinelConfirm.tsx:26`). Caller passes JWT via `token` option; `apiFetch` handles 401 interceptor + error envelope unwrapping.

- [ ] **Step 4.1: Write the failing test file**

Create `app/src/lib/__tests__/broadcast.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { broadcastViaBackend } from '../broadcast'

const FAKE_SIGNATURE = '5J7XHm...fake'

const validInput = () => ({
  serializedTx: 'AQID',  // base64 for [1,2,3]
  blockhash: 'HF3abc...fake',
  lastValidBlockHeight: 100_000_000,
})

describe('broadcastViaBackend', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs to /api/tx/broadcast with the expected body shape', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signature: FAKE_SIGNATURE }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await broadcastViaBackend(validInput(), 'jwt-token-abc')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/tx/broadcast')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body as string)).toEqual(validInput())
  })

  it('sends Authorization: Bearer <token> when token provided', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signature: FAKE_SIGNATURE }), { status: 200 }),
    )

    await broadcastViaBackend(validInput(), 'jwt-token-abc')

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const headers = opts.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-token-abc')
  })

  it('returns { signature } on 200 success', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ signature: FAKE_SIGNATURE }), { status: 200 }),
    )

    const result = await broadcastViaBackend(validInput(), 'jwt-token-abc')
    expect(result).toEqual({ signature: FAKE_SIGNATURE })
  })

  it('throws with the envelope error message on 4xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'BLOCKHASH_EXPIRED', message: 'blockhash already in the past' } }),
        { status: 400 },
      ),
    )

    await expect(broadcastViaBackend(validInput(), 'jwt-token-abc'))
      .rejects.toThrow('blockhash already in the past')
  })

  it('throws on 5xx with the envelope message', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'CONFIRMATION_TIMEOUT', message: 'expired before confirm' } }),
        { status: 504 },
      ),
    )

    await expect(broadcastViaBackend(validInput(), 'jwt-token-abc'))
      .rejects.toThrow('expired before confirm')
  })
})
```

- [ ] **Step 4.2: Run the test to verify it fails**

Run: `pnpm --filter @sipher/app test -- src/lib/__tests__/broadcast.test.ts --run`
Expected: FAIL — `Cannot find module '../broadcast'`

- [ ] **Step 4.3: Implement the helper**

Create `app/src/lib/broadcast.ts`:

```ts
import { apiFetch } from '../api/client'

export interface BroadcastInput {
  /** base64-encoded signed transaction bytes */
  serializedTx: string
  /** recent blockhash used when signing */
  blockhash: string
  /** expiry height for confirmation */
  lastValidBlockHeight: number
}

export interface BroadcastResult {
  /** on-chain transaction signature, confirmed at 'confirmed' commitment */
  signature: string
}

/**
 * Broadcast a signed Solana transaction via the sipher backend (server-side
 * Helius connection). Replaces FE-side `connection.sendRawTransaction` which
 * dropped silently on the rate-limited public devnet RPC. See sipher#297.
 *
 * Backend owns broadcast + resubmit + confirm; this helper returns only
 * after the cluster confirms the tx at 'confirmed' commitment.
 *
 * Errors are surfaced via apiFetch's standard envelope unwrapping — the
 * thrown Error.message carries the user-friendly backend message.
 */
export async function broadcastViaBackend(
  input: BroadcastInput,
  token?: string,
): Promise<BroadcastResult> {
  return apiFetch<BroadcastResult>('/api/tx/broadcast', {
    method: 'POST',
    body: JSON.stringify(input),
    token,
  })
}
```

- [ ] **Step 4.4: Run the test to verify it passes**

Run: `pnpm --filter @sipher/app test -- src/lib/__tests__/broadcast.test.ts --run`
Expected: PASS — 5/5 tests green.

- [ ] **Step 4.5: Typecheck**

Run: `pnpm --filter @sipher/app typecheck`
Expected: 0 errors.

- [ ] **Step 4.6: Commit**

```bash
git add app/src/lib/broadcast.ts app/src/lib/__tests__/broadcast.test.ts
git commit -S -m "feat(app): add broadcastViaBackend helper

Thin wrapper around apiFetch that POSTs to /api/tx/broadcast with the
signed-tx + blockhash + lastValidBlockHeight payload. Returns {
signature } on success; throws with the backend's user-friendly error
message on failure (BLOCKHASH_EXPIRED, CONFIRMATION_TIMEOUT, etc.).

Used by useTransactionSigner in the next commit. Replaces the
FE-side broadcast hop that drops silently on public devnet RPC.

Refs #297"
```

---

## Task 5: Wire `useTransactionSigner` to the backend

**Files:**
- Modify: `app/src/hooks/useTransactionSigner.ts`

Replace `sendAndConfirmWithRetry(connection, ...)` with `broadcastViaBackend({...}, token)`. Pull `token` from `useAuthState()`. The hook's external shape (`signAndBroadcast`, `status`, `setStatus`, `reset`) stays unchanged so `SignTxCard` and other callers need no edit.

- [ ] **Step 5.1: Read the current hook**

Read `app/src/hooks/useTransactionSigner.ts` (already done in plan prep — file is 84 lines, lines 1-83).

- [ ] **Step 5.2: Replace the file contents**

Overwrite `app/src/hooks/useTransactionSigner.ts` with:

```ts
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { useCallback, useState } from 'react'
import { broadcastViaBackend } from '../lib/broadcast'
import { useAuthState } from './useAuthState'

export type SignStatus = 'idle' | 'signing' | 'broadcasting' | 'confirmed' | 'error'

export interface SignResult {
  signature?: string
  error?: string
}

function deserializeTransaction(bytes: Uint8Array): Transaction | VersionedTransaction {
  try {
    return Transaction.from(bytes)
  } catch {
    return VersionedTransaction.deserialize(bytes)
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function useTransactionSigner() {
  const { connection } = useConnection()
  const { signTransaction, publicKey } = useWallet()
  const { token } = useAuthState()
  const [status, setStatus] = useState<SignStatus>('idle')

  const signAndBroadcast = useCallback(async (serializedTx: string): Promise<SignResult> => {
    if (!signTransaction || !publicKey) {
      setStatus('error')
      return { error: 'Wallet not connected' }
    }

    try {
      setStatus('signing')

      const bytes = base64ToBytes(serializedTx)
      const tx = deserializeTransaction(bytes)

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

      if (tx instanceof Transaction) {
        tx.recentBlockhash = blockhash
        tx.feePayer = publicKey
      } else {
        tx.message.recentBlockhash = blockhash
      }

      const signed = await signTransaction(tx)

      setStatus('broadcasting')

      // Broadcast via backend (Helius). Public devnet RPC drops broadcasts
      // silently; the backend proxy + server-side resubmit loop defends
      // against that. See sipher#297.
      const { signature } = await broadcastViaBackend(
        {
          serializedTx: bytesToBase64(signed.serialize()),
          blockhash,
          lastValidBlockHeight,
        },
        token ?? undefined,
      )

      setStatus('confirmed')
      return { signature }
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : String(err)
      return { error: message }
    }
  }, [connection, signTransaction, publicKey, token])

  const reset = useCallback(() => setStatus('idle'), [])

  return { signAndBroadcast, status, setStatus, reset }
}
```

- [ ] **Step 5.3: Typecheck**

Run: `pnpm --filter @sipher/app typecheck`
Expected: 0 errors.

- [ ] **Step 5.4: Run the SignTxCard test suite (consumer of useTransactionSigner)**

Run: `pnpm --filter @sipher/app test -- src/components/__tests__/SignTxCard.test.tsx --run`
Expected: PASS — existing 15 tests still green. Hook external shape unchanged means `vi.mock('../../hooks/useTransactionSigner', ...)` continues to work.

- [ ] **Step 5.5: Commit**

```bash
git add app/src/hooks/useTransactionSigner.ts
git commit -S -m "feat(app): broadcast via backend proxy instead of public RPC

useTransactionSigner now POSTs the signed tx to /api/tx/broadcast
(JWT-authenticated) which broadcasts through the backend's Helius
connection. The FE still refreshes blockhash + signs locally; only
the broadcast hop moves server-side. External hook shape unchanged —
signAndBroadcast still returns { signature } | { error }.

Fixes the failure mode from frontier_sip_17: chat-driven sends hit
'block height exceeded' because public devnet RPC dropped the
broadcasts silently. PR #296's FE-side resubmit was necessary but
not sufficient — even aggressive resubmits to the dropping RPC don't
land. Backend Helius connection broadcasts reliably.

Refs #297"
```

---

## Task 6: Delete the FE `sendWithRetry` helper

**Files:**
- Delete: `app/src/lib/sendWithRetry.ts`
- Delete: `app/src/lib/__tests__/sendWithRetry.test.ts`

The helper's only caller was `useTransactionSigner`, which now uses `broadcastViaBackend`. The 5 tests are covered by the backend port (Task 1).

- [ ] **Step 6.1: Confirm no other callers**

Run: `grep -rn 'sendAndConfirmWithRetry\|sendWithRetry' app/src 2>/dev/null`
Expected: no matches (or only the import line we already removed).

- [ ] **Step 6.2: Delete the files**

Run:
```bash
git rm app/src/lib/sendWithRetry.ts app/src/lib/__tests__/sendWithRetry.test.ts
```

- [ ] **Step 6.3: Typecheck**

Run: `pnpm --filter @sipher/app typecheck`
Expected: 0 errors.

- [ ] **Step 6.4: Run the full app suite**

Run: `pnpm --filter @sipher/app test -- --run`
Expected: PASS — app test count shifts from 577 → ~575 (−5 sendWithRetry tests, +5 broadcast helper tests = net 0; minor variance from how vitest counts).

- [ ] **Step 6.5: Commit**

```bash
git commit -S -m "refactor(app): drop FE sendWithRetry helper

The broadcast hop moved to the backend (Task 5 above). The FE
sendAndConfirmWithRetry helper had exactly one caller —
useTransactionSigner — which now uses broadcastViaBackend. Its 5
tests are covered by the backend port at packages/agent/src/lib/
sendWithRetry.ts.

Net app test count: 577 → ~575 (-5 sendWithRetry, +5 broadcast).

Refs #297"
```

---

## Task 7: Final verification + PR

- [ ] **Step 7.1: Full workspace typecheck**

Run: `pnpm typecheck`
Expected: 0 errors across root, sdk, app, agent.

- [ ] **Step 7.2: Full workspace test run**

Run: `pnpm test -- --run`
Expected: all suites PASS.

Tally to confirm:
- agent: 1630 → ~1647 (+17 across helper + route)
- app: 577 → ~575 (net 0)
- sdk: unchanged
- All green.

- [ ] **Step 7.3: Build check (Vite for FE)**

Run: `pnpm --filter @sipher/app build`
Expected: build succeeds; index-*.js bundle produced; no broken imports.

- [ ] **Step 7.4: Pre-push hygiene grep**

Run:
```bash
git log main..HEAD --format='%B' | grep -iE 'co-authored|generated with|claude' && echo "FOUND AI ATTRIBUTION" || echo "clean"
```
Expected: `clean`. If `FOUND AI ATTRIBUTION`, rebase + amend offending commits before push.

- [ ] **Step 7.5: Verify all commits are GPG-signed**

Run:
```bash
git log main..HEAD --show-signature 2>&1 | grep -c 'Good signature'
```
Expected: count equals the number of commits on this branch (7 commits: 1 spec + 1 helper + 1 route + 1 mount + 1 FE helper + 1 hook + 1 delete; the last 6 are the implementation).

- [ ] **Step 7.6: Push the branch**

Run: `git push -u origin fix/issue-297-backend-broadcast`

- [ ] **Step 7.7: Open PR via gh**

Run:
```bash
gh pr create --title "fix(arch): backend broadcast proxy — closes #297" --body "$(cat <<'EOF'
## Summary

Adds `POST /api/tx/broadcast` — a JWT-authenticated backend endpoint that broadcasts signed Solana transactions via the agent's Helius-keyed `Connection` instead of the FE's rate-limited public devnet RPC.

Closes #297.

## Why

Frontier_sip_17 verification (post-#296) found that chat-driven sends still hit "block height exceeded" because the FE broadcasts via `https://api.devnet.solana.com` (returned by `/api/config.publicRpcUrl`). Public devnet RPC drops broadcasts silently under load — two real signatures from that session (`3Cj3Nr…hTn6`, `3SdEhA…hTn6`) returned `getTransaction → null` seconds after sign.

PR #296's FE-side resubmit loop was necessary but not sufficient: aggressive resubmits to a dropping RPC don't land. The backend already has a Helius-keyed Connection (used in `tool-signing.ts` for verify); routing broadcasts through it is the architectural fix.

## What

- `POST /api/tx/broadcast` — JWT-auth'd; takes `{ serializedTx (base64), blockhash, lastValidBlockHeight }`; returns `{ signature }` after `confirmTransaction` at `'confirmed'`.
- `sendAndConfirmWithRetry` ported from `app/src/lib/sendWithRetry.ts` to `packages/agent/src/lib/sendWithRetry.ts`. Same resubmit-while-confirming logic, Node-side Connection.
- FE `useTransactionSigner` calls `broadcastViaBackend` (new helper in `app/src/lib/broadcast.ts`) instead of `connection.sendRawTransaction` + local resubmit. External hook shape unchanged.
- FE `sendWithRetry.ts` + its test deleted (only caller was useTransactionSigner; covered by backend port).

## Architecture

Spec: `docs/superpowers/specs/2026-05-23-issue-297-backend-broadcast-design.md`
Plan: `docs/superpowers/plans/2026-05-23-issue-297-backend-broadcast-plan.md`

Locked decisions (from brainstorming):
- Option A (backend proxy) over B (full RPC proxy) and C (swap public RPC URL)
- Backend owns broadcast + confirm + resubmit (sync long-running POST, no SSE)
- Keep separate from SENTINEL `/api/tool-signing/:flagId/confirm` flow
- JWT auth required (mirrors existing fund-moving endpoints)

## Test plan

- [x] `packages/agent/tests/lib/sendWithRetry.test.ts` — 5 tests (port of FE tests)
- [x] `packages/agent/tests/routes/tx-broadcast.test.ts` — 12 tests (auth, validation, happy path, BLOCKHASH_EXPIRED, CONFIRMATION_TIMEOUT, BROADCAST_FAILED, INTERNAL, Helius key redaction)
- [x] `app/src/lib/__tests__/broadcast.test.ts` — 5 tests (POST shape, auth header, success, 4xx, 5xx)
- [x] `pnpm typecheck` — clean
- [x] `pnpm test -- --run` — all green (agent ~1647, app ~575)
- [ ] Post-deploy manual smoke: chat-driven send via cipher-admin → verify signature on solscan → confirm SENTINEL pending-signing resolves → confirm PR #288 prod verification unblocked

## Out of scope (follow-ups)

- Flip `/api/config.publicRpcUrl` to backend proxy — separate PR
- Backend blockhash endpoint — only if public RPC reads start failing
- Promote `sendAndConfirmWithRetry` to `@sipher/sdk` — right long-term home
- Per-wallet rate limiting — post-Frontier hardening
- Durable nonce migration — much bigger lift
- sipher#292 Cloudflare HTTP/3 toggle — RECTOR-driven (independent)

## Related

- Closes #297
- Builds on #296 (FE resubmit loop, merged 2026-05-23)
- Unblocks PR #288 prod verification (claim auto-derive)
- Frontier judges score 2026-05-27 — this + sipher#292 are the remaining blockers
EOF
)"
```

- [ ] **Step 7.8: Wait for CI**

Watch CI on the PR. Required green checks:
- test
- e2e component
- playwright
- gitleaks
- Vercel
- Vercel Preview Comments

If any check fails, diagnose + fix in a new commit on the branch (NOT a merged main). Re-push.

- [ ] **Step 7.9: Hand off to RECTOR for review + merge**

The PR is ready. RECTOR reviews, may request changes, merges via the standard `--merge --delete-branch` flow.

Post-merge automatic deploys:
- Vercel FE (~3 min Vite build)
- VPS backend via "Test, Build & Deploy" workflow (~11 min Docker build + deploy)

- [ ] **Step 7.10: Post-deploy manual verification**

After both deploys land:

1. `curl -sS https://sipher-api.sip-protocol.org/api/health` → confirm container revision changed.
2. Log in at `https://sipher.sip-protocol.org` with cipher-admin (devnet network).
3. Chat: "send 0.001 SOL to therector.sol" (or to another known stealth recipient).
4. Sign in Phantom when `SignTxCard` renders.
5. Expect: status `signing` → `broadcasting` → `confirmed` within ~30s; signature in chat output.
6. Verify signature on `https://solscan.io/tx/<sig>?cluster=devnet` — confirm tx landed on-chain.
7. Confirm chat continues (SENTINEL pending-signing resolved automatically by `/api/tool-signing/:flagId/confirm`).
8. **Unblocks PR #288 prod verification path** — claim auto-derive can now be exercised end-to-end on prod.

If broadcast hangs > 60s and FE shows "Transaction expired before confirmation. Retry with a fresh blockhash." → backend resubmit loop ran out the blockhash without confirm. Possible causes: backend Helius rate-limit (unlikely), Cloudflare 100s timeout hit (look at #292), demo network congestion (retry). Diagnose with `curl -sS https://sipher-api.sip-protocol.org/api/health` + container logs.

---

## Self-review

**Spec coverage:**
- §1 Context → mental model carried into PR description ✓
- §2 Architectural choice → Tasks 1-7 all implement Option A ✓
- §3 Mental model → Tasks 1 (backend resubmit) + 5 (FE) realize the diagram ✓
- §4 Endpoint contract → Task 2 implements all 7 error codes ✓
- §5 Backend implementation → Tasks 1 (helper), 2 (route), 3 (mount) ✓
- §6 FE implementation → Tasks 4 (broadcast), 5 (hook), 6 (delete sendWithRetry) ✓
- §7 Testing → Tasks 1, 2, 4 add the test files; Task 7.2 runs full suite ✓
- §8 Migration / rollout → Task 7.7 + 7.9 + 7.10 ✓
- §9 Risks → Helius key redaction tested in Task 2 ✓; Cloudflare timeout + RPC rate limit are runtime concerns ✓
- §10 Out of scope → preserved in PR description (Task 7.7) ✓
- §11 Effort estimate → ~3 hours; 7 tasks each 5-60 min ✓

**Spec deviation (noted in header):** Dropped `BroadcastError` class (§6.1) in favor of `apiFetch`'s message-based throw. Justification: matches existing FE patterns; no code-aware UX in this PR; backend messages are user-friendly directly.

**Placeholder scan:** No TBD/TODO/FIXME. Approximate baselines (`~575`, `~1647`) explicitly marked.

**Type consistency:**
- `sendAndConfirmWithRetry` — same signature in §5.2 (spec), Task 1, Task 2 (mocked usage)
- `broadcastViaBackend(input, token?)` — same signature in Task 4 (define), Task 5 (call)
- `BroadcastInput`, `BroadcastResult` — same shape in Task 4 (define), Task 5 (uses inferred type)
- `req.wallet` type — augmented in existing express types (no change needed)

**Verification commands all named:**
- `pnpm --filter @sipher/agent test -- <path> --run`
- `pnpm --filter @sipher/app test -- <path> --run`
- `pnpm --filter @sipher/agent typecheck`
- `pnpm --filter @sipher/app typecheck`
- `pnpm typecheck` (workspace root)
- `pnpm test -- --run` (workspace root)
- `pnpm --filter @sipher/app build`

All match existing scripts in package.json files.

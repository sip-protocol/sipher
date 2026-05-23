import { describe, expect, it, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'
import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const FAKE_SIGNATURE = '5J7XHm...fake'
// Must be a valid 44-char base58 string (decodes to 32 bytes) — used as tx.recentBlockhash
const FAKE_BLOCKHASH = 'GHtXQBsoZHVnNFa9YevAzFr17dwJWVkmE15wFkRebSsp'
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
    // The actual secret value must not appear — redact() replaces the value with REDACTED
    expect(JSON.stringify(res.body)).not.toContain('12345-secret-uuid-67890')
    // The key param name is preserved as api-key=REDACTED (not a secret leak)
    expect(JSON.stringify(res.body)).toContain('api-key=REDACTED')
  })
})

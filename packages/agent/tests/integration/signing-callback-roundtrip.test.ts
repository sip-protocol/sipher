import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/pi/sipher-agent.js', () => ({
  createPiAgent: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    prompt: vi.fn(async () => {}),
    abort: vi.fn(),
    get state() {
      return {
        messages: [],
        tools: [],
        systemPrompt: '',
        model: null,
        isStreaming: false,
        pendingToolCalls: new Set(),
      }
    },
  })),
}))

vi.mock('../../src/pi/stream-bridge.js', () => ({
  streamPiAgent: vi.fn(async function* () {}),
}))

const emitEventMock = vi.fn().mockResolvedValue({ ok: true })
vi.mock('../../src/integrations/torque/mcp-client.js', () => ({
  TorqueMCPClient: vi.fn().mockImplementation(function () { return ({ emitEvent: emitEventMock }) }),
}))

beforeEach(() => {
  emitEventMock.mockClear()
  process.env.TORQUE_GROWTH_ENABLED = 'true'
  process.env.TORQUE_API_TOKEN = 'stub-token'
  process.env.TORQUE_INGESTER_URL = 'https://ingest.test'
})

const { wrapWithSigning } = await import('../../src/agent.js')
const { wrapExecutorWithGrowthHook } = await import('../../src/integrations/torque/growth-hook.js')
const {
  resolvePendingSigning,
  rejectPendingSigning,
} = await import('../../src/sentinel/pending-signing.js')

describe('signing callback round-trip → growth-hook emit', () => {
  it('on resolve, growth-hook receives result with signature and status: completed', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'send',
      status: 'awaiting_signature' as const,
      serializedTx: 'TX',
      privacy: {
        stealthAddress: 'StealthABC',
        commitmentGenerated: true,
        viewingKeyHashIncluded: true,
        feeBps: 50,
        estimatedFee: '0.005 SOL',
        netAmount: '0.995',
      },
    }))

    const queue: unknown[] = []
    const signingExecutor = wrapWithSigning(baseExecutor, {
      sessionId: 's-int-1',
      network: 'devnet',
      externalQueue: queue as never,
      externalWake: () => {},
    })

    const finalExecutor = wrapExecutorWithGrowthHook(signingExecutor as never, {
      growthEnabled: true,
      apiToken: 'stub',
      ingesterUrl: 'https://ingest.test',
      network: 'devnet',
      connection: {} as never,
    })

    const promise = finalExecutor('send', {
      amount: 1,
      token: 'SOL',
      recipient: 'alice.sol',
      wallet: 'WalletABC',
    })

    // Wait one tick so wrapper has emitted + entered the await
    await new Promise((r) => setTimeout(r, 10))
    const event = queue[0] as { flagId: string }
    expect(event).toBeDefined()
    resolvePendingSigning(event.flagId, 'SIG_FINAL_BASE58')

    const result = await promise
    expect((result as { signature: string }).signature).toBe('SIG_FINAL_BASE58')
    expect((result as { status: string }).status).toBe('completed')
  })

  it('on reject, returns cancelled_by_user and growth-hook does NOT fire emit', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'send',
      status: 'awaiting_signature' as const,
      serializedTx: 'TX',
      privacy: {
        stealthAddress: 'StealthABC',
        commitmentGenerated: true,
        viewingKeyHashIncluded: true,
        feeBps: 50,
        estimatedFee: '0.005 SOL',
        netAmount: '0.995',
      },
    }))

    const queue: unknown[] = []
    const signingExecutor = wrapWithSigning(baseExecutor, {
      sessionId: 's-int-2',
      network: 'devnet',
      externalQueue: queue as never,
      externalWake: () => {},
    })

    const finalExecutor = wrapExecutorWithGrowthHook(signingExecutor as never, {
      growthEnabled: true,
      apiToken: 'stub',
      ingesterUrl: 'https://ingest.test',
      network: 'devnet',
      connection: {} as never,
    })

    const promise = finalExecutor('send', {
      amount: 1,
      token: 'SOL',
      recipient: 'alice.sol',
      wallet: 'WalletABC',
    })

    await new Promise((r) => setTimeout(r, 10))
    const event = queue[0] as { flagId: string }
    rejectPendingSigning(event.flagId, 'user_cancel')

    const result = await promise
    expect((result as { status: string }).status).toBe('cancelled_by_user')
    expect((result as { signature?: string }).signature).toBeUndefined()

    // Wait for growth-hook fire-and-forget microtasks to drain
    await new Promise((r) => setTimeout(r, 10))
    expect(emitEventMock).not.toHaveBeenCalled()
  })
})

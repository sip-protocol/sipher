import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Pi agent so we don't make LLM calls; we drive the executor manually
vi.mock('../src/pi/sipher-agent.js', () => ({
  createPiAgent: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    prompt: vi.fn(async function (this: { _executor?: (n: string, i: Record<string, unknown>) => Promise<unknown> }) {
      // No-op; tests call the executor directly via the returned wrapper
    }),
    abort: vi.fn(),
    get state() {
      return { messages: [], tools: [], systemPrompt: '', model: null, isStreaming: false, pendingToolCalls: new Set() }
    },
  })),
}))

vi.mock('../src/pi/stream-bridge.js', () => ({
  streamPiAgent: vi.fn(async function* () {}),
}))

vi.mock('../src/integrations/torque/growth-hook.js', () => ({
  wrapExecutorWithGrowthHook: vi.fn((executor) => executor),
}))

vi.mock('../src/config/network.js', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  return {
    ...actual,
    loadNetworkConfig: vi.fn(() => ({
      network: 'devnet',
      clusterName: 'devnet',
      rpcUrl: 'http://stub',
      publicRpcUrl: 'http://stub',
      programIds: { sipherVault: 'X', sipPrivacy: 'Y' },
      vaultConfig: 'Z',
      beta: true,
      solscanSuffix: '?cluster=devnet',
    })),
    loadTorqueConfig: vi.fn(() => null),
  }
})

const { wrapWithSigning } = await import('../src/agent.js')
const {
  resolvePendingSigning,
  rejectPendingSigning,
  _setTimeoutMsForTests,
  clearAllSigning,
} = await import('../src/sentinel/pending-signing.js')

beforeEach(() => {
  _setTimeoutMsForTests(60_000)
  clearAllSigning('s1')
})

describe('chatStream signing-wait wrapper (wrapWithSigning)', () => {
  it('emits tool_signing_required + awaits promise for send with serializedTx + wallet', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'send',
      status: 'awaiting_signature' as const,
      serializedTx: 'BASE64TX',
      privacy: {
        stealthAddress: 'X',
        commitmentGenerated: true,
        viewingKeyHashIncluded: true,
        feeBps: 50,
        estimatedFee: '0.005 SOL',
        netAmount: '0.995',
      },
    }))

    const queue: unknown[] = []
    let wakeCalled = false
    const wake = () => { wakeCalled = true }

    const wrapped = wrapWithSigning(baseExecutor, {
      sessionId: 's1',
      network: 'devnet',
      externalQueue: queue,
      externalWake: () => wake(),
    })

    const promise = wrapped('send', { amount: 1, token: 'SOL', recipient: 'alice.sol', wallet: 'W1' })

    await new Promise((r) => setTimeout(r, 10))

    expect(queue.length).toBe(1)
    const event = queue[0] as { type: string; flagId: string; toolName: string; serializedTx: string; walletPubkey: string }
    expect(event.type).toBe('tool_signing_required')
    expect(event.toolName).toBe('send')
    expect(event.serializedTx).toBe('BASE64TX')
    expect(event.walletPubkey).toBe('W1')
    expect(wakeCalled).toBe(true)

    resolvePendingSigning(event.flagId, 'SIG_RESOLVED')

    const result = await promise
    expect((result as { signature: string }).signature).toBe('SIG_RESOLVED')
    expect((result as { status: string }).status).toBe('completed')
  })

  it('returns synthetic cancelled_by_user on promise reject', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'swap',
      status: 'awaiting_signature' as const,
      serializedTx: 'TX',
      quote: { estimatedOutput: '150', priceImpact: '0.1', route: ['Jupiter'] },
      privacy: { stealthRouted: true, stealthAddress: 'S' },
    }))

    const queue: unknown[] = []
    const wrapped = wrapWithSigning(baseExecutor, {
      sessionId: 's1', network: 'devnet', externalQueue: queue, externalWake: () => {},
    })

    const promise = wrapped('swap', {
      amount: 1, fromToken: 'SOL', toToken: 'USDC', wallet: 'W1', slippageBps: 50,
    })

    await new Promise((r) => setTimeout(r, 10))
    const event = queue[0] as { flagId: string }
    rejectPendingSigning(event.flagId, 'user_cancel')

    const result = await promise
    expect((result as { status: string }).status).toBe('cancelled_by_user')
    expect((result as { reason: string }).reason).toBe('user_cancel')
    expect((result as { signature?: string }).signature).toBeUndefined()
  })

  it('skips signing pause when result has no serializedTx (preview mode)', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'send',
      status: 'awaiting_signature' as const,
      serializedTx: null,
      privacy: { stealthAddress: '', commitmentGenerated: false, viewingKeyHashIncluded: false, feeBps: 50, estimatedFee: '0.005 SOL', netAmount: null },
    }))

    const queue: unknown[] = []
    const wrapped = wrapWithSigning(baseExecutor, {
      sessionId: 's1', network: 'devnet', externalQueue: queue, externalWake: () => {},
    })

    const result = await wrapped('send', { amount: 1, token: 'SOL', recipient: 'alice.sol' })
    expect(queue.length).toBe(0)
    expect(result).toBe(await baseExecutor.mock.results[0]!.value)
  })

  it('skips signing pause for tools other than send/swap', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'claim', status: 'awaiting_signature' as const, txSignature: 'INPUT_SIG',
    }))
    const queue: unknown[] = []
    const wrapped = wrapWithSigning(baseExecutor, {
      sessionId: 's1', network: 'devnet', externalQueue: queue, externalWake: () => {},
    })
    await wrapped('claim', { txSignature: 'X', viewingKey: 'V', spendingKey: 'S' })
    expect(queue.length).toBe(0)
  })

  it('skips signing pause when input.wallet is missing', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'send', status: 'awaiting_signature' as const, serializedTx: 'TX',
      privacy: { stealthAddress: 'X', commitmentGenerated: true, viewingKeyHashIncluded: true, feeBps: 50, estimatedFee: '0', netAmount: '1' },
    }))
    const queue: unknown[] = []
    const wrapped = wrapWithSigning(baseExecutor, {
      sessionId: 's1', network: 'devnet', externalQueue: queue, externalWake: () => {},
    })
    await wrapped('send', { amount: 1, token: 'SOL', recipient: 'alice.sol' })
    expect(queue.length).toBe(0)
  })

  it('passes through unchanged when result.status is not awaiting_signature', async () => {
    const baseExecutor = vi.fn(async () => ({
      action: 'send', status: 'cancelled_by_user' as const, reason: 'sentinel blocked',
    }))
    const queue: unknown[] = []
    const wrapped = wrapWithSigning(baseExecutor, {
      sessionId: 's1', network: 'devnet', externalQueue: queue, externalWake: () => {},
    })
    const result = await wrapped('send', { amount: 1, token: 'SOL', recipient: 'a.sol', wallet: 'W' })
    expect(queue.length).toBe(0)
    expect((result as { status: string }).status).toBe('cancelled_by_user')
  })
})

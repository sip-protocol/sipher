import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// vi.mock factories are hoisted above all imports by Vitest — do NOT reference
// module-level variables inside them.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('../src/integrations/torque/growth-hook.js', () => ({
  wrapExecutorWithGrowthHook: vi.fn((executor) => executor),
}))

// Minimal fake Pi agent — no LLM calls, resolves immediately.
vi.mock('../src/pi/sipher-agent.js', () => ({
  createPiAgent: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    prompt: vi.fn(async () => {}),
    abort: vi.fn(),
    get state() {
      return {
        messages: [],
        tools: [],
        systemPrompt: 'stub',
        model: null,
        isStreaming: false,
        pendingToolCalls: new Set(),
      }
    },
  })),
}))

// Suppress the stream-bridge so chatStream() yields nothing (avoids generator
// complexity — wiring happens before the generator loop).
vi.mock('../src/pi/stream-bridge.js', () => ({
  streamPiAgent: vi.fn(async function* () {}),
}))

// Guard against network config throws — only called in the Torque-enabled branch.
vi.mock('../src/config/network.js', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return {
    ...actual,
    // loadTorqueConfig is NOT mocked — let the real implementation read env vars.
    // loadNetworkConfig IS mocked when Torque is enabled (avoids SIPHER_NETWORK requirement).
    loadNetworkConfig: vi.fn(() => ({
      network: 'devnet' as const,
      clusterName: 'devnet' as const,
      rpcUrl: 'https://devnet.helius-rpc.com/?api-key=stub',
      publicRpcUrl: 'https://api.devnet.solana.com',
      programIds: {
        sipherVault: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
        sipPrivacy: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
      },
      vaultConfig: 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u',
      beta: true,
      solscanSuffix: '?cluster=devnet',
    })),
  }
})

vi.mock('@sipher/sdk', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return {
    ...actual,
    createConnection: vi.fn(() => ({ stub: 'connection' })),
  }
})

import { wrapExecutorWithGrowthHook } from '../src/integrations/torque/growth-hook.js'

describe('createAgent torque wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_KEY
    delete process.env.TORQUE_MCP_URL
    delete process.env.TORQUE_CAMPAIGN_ID_DEVNET
    delete process.env.TORQUE_CAMPAIGN_ID_MAINNET
    // Ensure DB does not fail on import
    process.env.DB_PATH = ':memory:'
  })

  it('does NOT wrap executor when TORQUE_GROWTH_ENABLED is unset', async () => {
    const { chat } = await import('../src/agent.js')
    await chat('hello')
    expect(wrapExecutorWithGrowthHook).not.toHaveBeenCalled()
  })

  it('wraps executor with growth hook when env enables it', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk_secret'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_d'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_m'

    const { chat } = await import('../src/agent.js')
    await chat('hello')

    expect(wrapExecutorWithGrowthHook).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(wrapExecutorWithGrowthHook).mock.calls[0]!
    expect(callArgs[1]).toStrictEqual({
      growthEnabled: true,
      apiKey: 'tk_secret',
      baseUrl: 'https://torque.test',
      campaignId: 'camp_d', // devnet cluster → devnet campaign ID
      network: 'devnet',
      connection: { stub: 'connection' },
    })
  })

  it('wraps executor in chatStream when env enables it', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk_secret'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_d'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_m'

    const { chatStream } = await import('../src/agent.js')
    const gen = chatStream('hello')
    await gen.next() // drain — streamPiAgent is mocked as empty async generator

    expect(wrapExecutorWithGrowthHook).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(wrapExecutorWithGrowthHook).mock.calls[0]!
    expect(callArgs[1]).toStrictEqual({
      growthEnabled: true,
      apiKey: 'tk_secret',
      baseUrl: 'https://torque.test',
      campaignId: 'camp_d', // devnet cluster → devnet campaign ID
      network: 'devnet',
      connection: { stub: 'connection' },
    })
  })
})

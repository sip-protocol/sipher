import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Connection } from '@solana/web3.js'

// vi.mock factories are hoisted to the top of the file — they CANNOT reference variables
// declared in the test module body. Use vi.fn() directly inside the factory and
// access the mocks via vi.mocked() after import.
vi.mock('../../../src/integrations/torque/mcp-client.js', () => ({
  TorqueMCPClient: vi.fn().mockImplementation(() => ({ emitEvent: vi.fn() })),
}))

vi.mock('../../../src/integrations/torque/rebate-destination.js', () => ({
  deriveRebateDestination: vi.fn(),
}))

import { wrapExecutorWithGrowthHook } from '../../../src/integrations/torque/growth-hook.js'
import { TorqueMCPClient } from '../../../src/integrations/torque/mcp-client.js'
import { deriveRebateDestination } from '../../../src/integrations/torque/rebate-destination.js'

const WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'
const TX_SIG = '3QCoHcJ1NNg'

const baseExecutor = vi.fn()

// Typed references for use inside tests — assigned in beforeEach via vi.mocked().
let emitEventMock: ReturnType<typeof vi.fn>

const opts = {
  ingesterUrl: 'https://ingest.torque.test',
  apiToken: 'tq_secret',
  network: 'devnet' as const,
  growthEnabled: true,
  // connection must be truthy so the implementation routes through deriveRebateDestination.
  // The module is fully mocked so the stub is never actually called.
  connection: {} as unknown as Connection,
}

describe('wrapExecutorWithGrowthHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-wire the TorqueMCPClient factory so each test gets a fresh emitEvent mock.
    emitEventMock = vi.fn().mockResolvedValue({ ok: true })
    vi.mocked(TorqueMCPClient).mockImplementation(() => ({ emitEvent: emitEventMock } as never))
    vi.mocked(deriveRebateDestination).mockResolvedValue({ kind: 'stealth', address: 'RbT6X9' })
  })

  it('delegates to base executor and returns its result unchanged', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'awaiting_signature', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    const result = await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })

    expect(result).toStrictEqual({ action: 'send', status: 'awaiting_signature', signature: TX_SIG })
    expect(baseExecutor).toHaveBeenCalledOnce()
  })

  it('emits sipher_private_send_completed after a successful send', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    // emission is fire-and-forget via .catch; flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).toHaveBeenCalledOnce()
    expect(emitEventMock).toHaveBeenCalledWith({
      userPubkey: WALLET,
      timestamp: expect.any(Number),
      eventName: 'sipher_private_send_completed',
      data: {
        tx_signature: TX_SIG,
        network: 'devnet',
        rebate_destination: 'RbT6X9',
      },
    })
  })

  it('OMITS amount_lamports for send events (privacy)', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const call = emitEventMock.mock.calls[0]![0]
    expect(call.data.amount_lamports).toBeUndefined()
  })

  it('INCLUDES amount_lamports and asset for swap events (DEX is already public)', async () => {
    baseExecutor.mockResolvedValue({
      action: 'swap',
      status: 'confirmed',
      signature: TX_SIG,
      amountInLamports: 1_000_000,
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('swap', { wallet: WALLET, fromToken: 'SOL', toToken: 'USDC', amount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const call = emitEventMock.mock.calls[0]![0]
    expect(call.data.amount_lamports).toBe(1_000_000)
    expect(call.data.asset).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  })

  it('emits sipher_private_swap_completed for swap tool', async () => {
    baseExecutor.mockResolvedValue({
      action: 'swap',
      status: 'confirmed',
      signature: TX_SIG,
      amountInLamports: 500_000,
      asset: 'So11111111111111111111111111111111111111112',
    })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('swap', { wallet: WALLET, fromToken: 'SOL', toToken: 'USDC', amount: 0.5 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).toHaveBeenCalledOnce()
    expect(emitEventMock).toHaveBeenCalledWith({
      userPubkey: WALLET,
      timestamp: expect.any(Number),
      eventName: 'sipher_private_swap_completed',
      data: {
        tx_signature: TX_SIG,
        network: 'devnet',
        rebate_destination: 'RbT6X9',
        amount_lamports: 500_000,
        asset: 'So11111111111111111111111111111111111111112',
      },
    })
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
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('does NOT emit when growthEnabled=false (returns base executor unchanged)', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, { ...opts, growthEnabled: false })

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(TorqueMCPClient).not.toHaveBeenCalled()
    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('does NOT bubble emit failures to the caller', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    // Override emitEvent to return an error result — caller result must still be returned.
    emitEventMock.mockResolvedValue({ ok: false, reason: 'network', message: 'boom' })
    vi.mocked(TorqueMCPClient).mockImplementation(() => ({ emitEvent: emitEventMock } as never))
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    const result = await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result).toBeDefined()
    expect(emitEventMock).toHaveBeenCalledOnce()
  })

  it('does NOT bubble emit promise rejection to the caller', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    emitEventMock.mockRejectedValue(new Error('network'))
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    const result = await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result).toBeDefined()
    expect(emitEventMock).toHaveBeenCalledOnce()
  })

  it('skips emit when no tx_signature in result (e.g. status: awaiting_signature)', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'awaiting_signature' })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('skips emit when result has no wallet in input', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    // wallet field intentionally absent from input
    await wrapped('send', { amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('skips emit when connection is not provided', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, { ...opts, connection: undefined })

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('skips emit when rebate destination is not a stealth address', async () => {
    vi.mocked(deriveRebateDestination).mockResolvedValue({ kind: 'unavailable', address: null, reason: 'no_domain' })
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).not.toHaveBeenCalled()
  })
})

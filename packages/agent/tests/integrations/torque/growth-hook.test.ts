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
  baseUrl: 'https://torque.test',
  apiKey: 'tk_secret',
  campaignId: 'camp_devnet_1',
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
    emitEventMock = vi.fn().mockResolvedValue({ ok: true, eventId: 'evt_1' })
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

  it('emits sipher.private_send_completed after a successful send', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    // emission is fire-and-forget via .catch; flush microtasks
    await new Promise((resolve) => setTimeout(resolve, 0))

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
    await new Promise((resolve) => setTimeout(resolve, 0))

    const call = emitEventMock.mock.calls[0]![0]
    expect(call.metadata.amount_lamports).toBeUndefined()
  })

  it('INCLUDES amount_lamports for swap events (DEX is already public)', async () => {
    baseExecutor.mockResolvedValue({ action: 'swap', status: 'confirmed', signature: TX_SIG, amountInLamports: 1_000_000 })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, opts)

    await wrapped('swap', { wallet: WALLET, fromToken: 'SOL', toToken: 'USDC', amount: 1 })
    await new Promise((resolve) => setTimeout(resolve, 0))

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
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(emitEventMock).not.toHaveBeenCalled()
  })

  it('does NOT emit when growthEnabled=false', async () => {
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })
    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, { ...opts, growthEnabled: false })

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

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

  it('returns the base executor (no client construction, no emit) when campaignId is empty', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })

    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, { ...opts, campaignId: '' })

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(TorqueMCPClient).not.toHaveBeenCalled()
    expect(emitEventMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no campaign ID for network=devnet'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('TORQUE_CAMPAIGN_ID_DEVNET'),
    )
    warnSpy.mockRestore()
  })

  it('treats a whitespace-only campaignId as empty', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })

    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, { ...opts, campaignId: '   ' })

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(TorqueMCPClient).not.toHaveBeenCalled()
    expect(emitEventMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('names the mainnet env var in the warning when network=mainnet-beta', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    baseExecutor.mockResolvedValue({ action: 'send', status: 'confirmed', signature: TX_SIG })

    const wrapped = wrapExecutorWithGrowthHook(baseExecutor, {
      ...opts,
      campaignId: '',
      network: 'mainnet-beta',
    })

    await wrapped('send', { wallet: WALLET, amount: 1, token: 'SOL', recipient: 'rector.sol' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('TORQUE_CAMPAIGN_ID_MAINNET'),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('network=mainnet-beta'),
    )
    warnSpy.mockRestore()
  })
})

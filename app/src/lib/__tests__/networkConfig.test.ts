import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useNetworkConfigStore, fetchNetworkConfig } from '../networkConfig'

describe('networkConfig store', () => {
  beforeEach(() => {
    useNetworkConfigStore.setState({ config: null, error: null })
    vi.restoreAllMocks()
  })

  it('fetchNetworkConfig populates store from /api/config', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        network: 'devnet',
        clusterName: 'devnet',
        publicRpcUrl: 'https://api.devnet.solana.com',
        programIds: { sipherVault: 'S1Phr...', sipPrivacy: 'S1PMF...' },
        vaultConfig: 'CpL4q...',
        beta: true,
        solscanSuffix: '?cluster=devnet',
      }),
    }))

    await fetchNetworkConfig()
    const state = useNetworkConfigStore.getState()
    expect(state.config?.network).toBe('devnet')
    expect(state.config?.beta).toBe(true)
    expect(state.error).toBeNull()
  })

  it('fetchNetworkConfig sets error on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'service unavailable' }),
    }))

    await fetchNetworkConfig()
    const state = useNetworkConfigStore.getState()
    expect(state.config).toBeNull()
    expect(state.error).toBeTruthy()
  })

  it('fetchNetworkConfig sets error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unreachable')))
    await fetchNetworkConfig()
    const state = useNetworkConfigStore.getState()
    expect(state.config).toBeNull()
    expect(state.error).toContain('network unreachable')
  })

  it('solscanUrl helper appends suffix correctly', async () => {
    const { solscanUrl } = await import('../networkConfig')
    expect(solscanUrl('abc123', '?cluster=devnet')).toBe('https://solscan.io/tx/abc123?cluster=devnet')
    expect(solscanUrl('abc123', '')).toBe('https://solscan.io/tx/abc123')
  })
})

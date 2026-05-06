import { create } from 'zustand'

export type NetworkConfigPublic = {
  network: 'devnet' | 'mainnet'
  clusterName: 'devnet' | 'mainnet-beta'
  publicRpcUrl: string
  programIds: {
    sipherVault: string
    sipPrivacy: string
  }
  vaultConfig: string
  beta: boolean
  solscanSuffix: string
}

type Store = {
  config: NetworkConfigPublic | null
  error: string | null
  loading: boolean
}

export const useNetworkConfigStore = create<Store>(() => ({
  config: null,
  error: null,
  loading: false,
}))

export async function fetchNetworkConfig(): Promise<void> {
  useNetworkConfigStore.setState({ loading: true, error: null })
  try {
    const res = await fetch('/api/config')
    if (!res.ok) {
      throw new Error(`Config endpoint returned ${res.status}`)
    }
    const config = (await res.json()) as NetworkConfigPublic
    useNetworkConfigStore.setState({ config, loading: false, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching config'
    useNetworkConfigStore.setState({ config: null, loading: false, error: message })
  }
}

export function solscanUrl(txOrAccount: string, suffix: string): string {
  return `https://solscan.io/tx/${txOrAccount}${suffix}`
}

import { create } from 'zustand'
import { apiFetch } from '../api/client'

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
}

export const useNetworkConfigStore = create<Store>(() => ({
  config: null,
  error: null,
}))

export async function fetchNetworkConfig(): Promise<void> {
  try {
    const config = await apiFetch<NetworkConfigPublic>('/api/config')
    useNetworkConfigStore.setState({ config, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching config'
    useNetworkConfigStore.setState({ config: null, error: message })
  }
}

export function solscanUrl(tx: string, suffix: string): string {
  return `https://solscan.io/tx/${tx}${suffix}`
}

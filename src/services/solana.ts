import { Connection } from '@solana/web3.js'
import { env } from '../config.js'
import { logger } from '../logger.js'
import {
  createProviderConnection,
  resolveProviderType,
  type RpcProviderInfo,
} from './rpc-provider.js'

let primaryConnection: Connection | null = null
let fallbackConnection: Connection | null = null
let activeConnection: 'primary' | 'fallback' = 'primary'
let providerInfo: RpcProviderInfo | null = null

function initPrimary(): { connection: Connection; info: RpcProviderInfo } {
  const result = createProviderConnection({
    provider: resolveProviderType(env.RPC_PROVIDER),
    rpcUrl: env.SOLANA_RPC_URL,
    apiKey: env.RPC_PROVIDER_API_KEY || undefined,
  })
  primaryConnection = result.connection
  providerInfo = result.info
  return result
}

function initFallback(): Connection | null {
  if (!env.SOLANA_RPC_URL_FALLBACK) return null
  if (!fallbackConnection) {
    const result = createProviderConnection({
      provider: 'generic',
      rpcUrl: env.SOLANA_RPC_URL_FALLBACK,
    })
    fallbackConnection = result.connection
  }
  return fallbackConnection
}

export function getConnection(): Connection {
  if (!primaryConnection) initPrimary()

  if (activeConnection === 'fallback' && fallbackConnection) {
    return fallbackConnection
  }
  return primaryConnection!
}

export function getProviderInfo(): RpcProviderInfo {
  if (!providerInfo) initPrimary()
  return providerInfo!
}

export interface SolanaHealthResult {
  connected: boolean
  cluster: string
  provider?: string
  slot?: number
  latencyMs?: number
  usingFallback?: boolean
}

export async function checkSolanaHealth(): Promise<SolanaHealthResult> {
  try {
    const conn = getConnection()
    const info = getProviderInfo()
    const start = performance.now()
    const slot = await conn.getSlot()
    const latencyMs = Math.round(performance.now() - start)
    const cluster = detectCluster(conn.rpcEndpoint)

    // Primary succeeded — switch back if we were on fallback
    if (activeConnection === 'fallback') {
      activeConnection = 'primary'
      logger.info('Solana RPC: primary connection restored')
    }

    return { connected: true, cluster, provider: info.provider, slot, latencyMs, usingFallback: false }
  } catch {
    // Try fallback if available
    const fb = initFallback()
    if (fb) {
      try {
        const start = performance.now()
        const slot = await fb.getSlot()
        const latencyMs = Math.round(performance.now() - start)
        const cluster = detectCluster(fb.rpcEndpoint)

        if (activeConnection !== 'fallback') {
          activeConnection = 'fallback'
          logger.warn('Solana RPC: switched to fallback connection')
        }

        return { connected: true, cluster, provider: 'fallback', slot, latencyMs, usingFallback: true }
      } catch {
        // Both failed
      }
    }

    const info = providerInfo
    return { connected: false, cluster: 'unknown', provider: info?.provider }
  }
}

export function detectCluster(endpoint: string): string {
  if (endpoint.includes('devnet')) return 'devnet'
  if (endpoint.includes('testnet')) return 'testnet'
  if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) return 'localnet'
  return 'mainnet-beta'
}

/**
 * Reset connection (for testing)
 */
export function resetConnection(): void {
  primaryConnection = null
  fallbackConnection = null
  activeConnection = 'primary'
  providerInfo = null
}

import { Connection } from '@solana/web3.js'
import { env } from '../config.js'
import { logger } from '../logger.js'
import {
  createProviderConnection,
  resolveProviderType,
  type RpcProviderInfo,
} from './rpc-provider.js'

let connection: Connection | null = null
let providerInfo: RpcProviderInfo | null = null

export function getConnection(): Connection {
  if (!connection) {
    const result = createProviderConnection({
      provider: resolveProviderType(env.RPC_PROVIDER),
      rpcUrl: env.SOLANA_RPC_URL,
      apiKey: env.RPC_PROVIDER_API_KEY || undefined,
    })
    connection = result.connection
    providerInfo = result.info
  }
  return connection
}

export function getProviderInfo(): RpcProviderInfo {
  if (!providerInfo) {
    getConnection() // initializes provider info
  }
  return providerInfo!
}

export interface SolanaHealthResult {
  connected: boolean
  cluster: string
  provider?: string
  slot?: number
  latencyMs?: number
}

export async function checkSolanaHealth(): Promise<SolanaHealthResult> {
  try {
    const conn = getConnection()
    const info = getProviderInfo()
    const start = performance.now()
    const slot = await conn.getSlot()
    const latencyMs = Math.round(performance.now() - start)
    const cluster = detectCluster(conn.rpcEndpoint)

    return { connected: true, cluster, provider: info.provider, slot, latencyMs }
  } catch {
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
  connection = null
  providerInfo = null
}

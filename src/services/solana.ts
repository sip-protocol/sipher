import { Connection } from '@solana/web3.js'
import { env } from '../config.js'
import { logger } from '../logger.js'

let connection: Connection | null = null

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.SOLANA_RPC_URL, {
      commitment: 'confirmed',
    })
    logger.info({ rpc: env.SOLANA_RPC_URL }, 'Solana connection initialized')
  }
  return connection
}

export interface SolanaHealthResult {
  connected: boolean
  cluster: string
  slot?: number
  latencyMs?: number
}

export async function checkSolanaHealth(): Promise<SolanaHealthResult> {
  try {
    const conn = getConnection()
    const start = performance.now()
    const slot = await conn.getSlot()
    const latencyMs = Math.round(performance.now() - start)
    const cluster = detectCluster(conn.rpcEndpoint)

    return { connected: true, cluster, slot, latencyMs }
  } catch {
    return { connected: false, cluster: 'unknown' }
  }
}

export function detectCluster(endpoint: string): string {
  if (endpoint.includes('devnet')) return 'devnet'
  if (endpoint.includes('testnet')) return 'testnet'
  if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) return 'localnet'
  return 'mainnet-beta'
}

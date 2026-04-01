import { Connection } from '@solana/web3.js'
import { getConfig } from './config.js'
import type { Cluster } from './types.js'

/**
 * Create a Connection to the specified Solana cluster.
 *
 * Uses the default RPC URL from config, or accepts a custom RPC URL override.
 * Commitment defaults to 'confirmed' — good balance of speed vs finality.
 */
export function createConnection(
  cluster: Cluster = 'devnet',
  rpcUrl?: string
): Connection {
  const config = getConfig(cluster, rpcUrl)
  return new Connection(config.rpcUrl, 'confirmed')
}

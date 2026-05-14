export type Network = 'devnet' | 'mainnet'

export type NetworkConfig = {
  network: Network
  clusterName: 'devnet' | 'mainnet-beta'
  rpcUrl: string          // SERVER-SIDE ONLY — keyed Helius URL, never exposed to clients
  publicRpcUrl: string    // un-keyed fallback for UI direct reads
  programIds: {
    sipherVault: string
    sipPrivacy: string
  }
  vaultConfig: string     // VaultConfig PDA address
  beta: boolean
  solscanSuffix: string
}

const SIPHER_VAULT_PROGRAM_ID = 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'
const SIP_PRIVACY_PROGRAM_ID = 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'
const DEVNET_VAULT_CONFIG = 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u'
// Mainnet vault config is the same PDA as devnet because program ID + seed are identical.
// PR-B1 will verify this assumption against the live mainnet deployment.
const MAINNET_VAULT_CONFIG = DEVNET_VAULT_CONFIG

export function loadNetworkConfig(): NetworkConfig {
  const raw = process.env.SIPHER_NETWORK
  if (raw !== 'devnet' && raw !== 'mainnet') {
    throw new Error(
      `FATAL: SIPHER_NETWORK env var required (must be 'devnet' or 'mainnet'), got: ${raw ?? '(unset)'}`,
    )
  }
  const network: Network = raw

  const apiKey = process.env.SIPHER_HELIUS_API_KEY
  if (!apiKey) {
    throw new Error(
      `FATAL: SIPHER_HELIUS_API_KEY env var required, got: ${apiKey === undefined ? '(unset)' : '(empty string)'}`,
    )
  }

  if (network === 'devnet') {
    return {
      network: 'devnet',
      clusterName: 'devnet',
      rpcUrl: `https://devnet.helius-rpc.com/?api-key=${apiKey}`,
      publicRpcUrl: 'https://api.devnet.solana.com',
      programIds: {
        sipherVault: SIPHER_VAULT_PROGRAM_ID,
        sipPrivacy: SIP_PRIVACY_PROGRAM_ID,
      },
      vaultConfig: DEVNET_VAULT_CONFIG,
      beta: true,
      solscanSuffix: '?cluster=devnet',
    }
  }

  // mainnet
  return {
    network: 'mainnet',
    clusterName: 'mainnet-beta',
    rpcUrl: `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
    publicRpcUrl: 'https://api.mainnet-beta.solana.com',
    programIds: {
      sipherVault: SIPHER_VAULT_PROGRAM_ID,
      sipPrivacy: SIP_PRIVACY_PROGRAM_ID,
    },
    vaultConfig: MAINNET_VAULT_CONFIG,
    beta: false,
    solscanSuffix: '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Torque MCP integration config
// ─────────────────────────────────────────────────────────────────────────────

export interface TorqueConfig {
  apiToken: string
  ingesterUrl: string
}

/**
 * Load Torque MCP integration config from env. Returns null if integration is
 * disabled (TORQUE_GROWTH_ENABLED != 'true') or required env vars are missing.
 * Caller treats null as "Torque integration disabled" — passes baseExecutor
 * through unchanged.
 *
 * Env var names follow the official @torque-labs/mcp convention:
 * - TORQUE_API_TOKEN: project-scoped event-ingest API key from
 *   platform.torque.so/developer.
 * - TORQUE_INGESTER_URL: defaults to https://ingest.torque.so. Override only
 *   for staging/test deployments.
 */
export function loadTorqueConfig(): TorqueConfig | null {
  const enabled = process.env.TORQUE_GROWTH_ENABLED === 'true'
  if (!enabled) return null

  const apiToken = process.env.TORQUE_API_TOKEN
  const ingesterUrl = process.env.TORQUE_INGESTER_URL ?? 'https://ingest.torque.so'

  if (!apiToken) {
    console.warn(
      '[torque] TORQUE_GROWTH_ENABLED=true but TORQUE_API_TOKEN missing — disabling integration',
    )
    return null
  }

  return { apiToken, ingesterUrl }
}

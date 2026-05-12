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
  enabled: boolean
  apiKey: string
  baseUrl: string
  campaignIdDevnet: string
  campaignIdMainnet: string
}

/**
 * Load Torque MCP integration config from env. Returns null if integration is
 * disabled (TORQUE_GROWTH_ENABLED != 'true') or required env vars are missing.
 * Caller treats null as "Torque integration disabled" — passes baseExecutor
 * through unchanged.
 */
export function loadTorqueConfig(): TorqueConfig | null {
  const enabled = process.env.TORQUE_GROWTH_ENABLED === 'true'
  if (!enabled) return null

  const apiKey = process.env.TORQUE_API_KEY
  const baseUrl = process.env.TORQUE_MCP_URL
  const campaignIdDevnet = process.env.TORQUE_CAMPAIGN_ID_DEVNET ?? ''
  const campaignIdMainnet = process.env.TORQUE_CAMPAIGN_ID_MAINNET ?? ''

  if (!apiKey || !baseUrl) {
    console.warn(
      '[torque] TORQUE_GROWTH_ENABLED=true but TORQUE_API_KEY or TORQUE_MCP_URL missing — disabling integration',
    )
    return null
  }

  return { enabled, apiKey, baseUrl, campaignIdDevnet, campaignIdMainnet }
}

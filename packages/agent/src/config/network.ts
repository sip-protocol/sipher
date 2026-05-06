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

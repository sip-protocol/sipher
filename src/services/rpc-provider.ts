import { Connection } from '@solana/web3.js'
import { logger } from '../logger.js'

export type RpcProviderType = 'generic' | 'helius' | 'quicknode' | 'triton'

export interface RpcProviderConfig {
  provider: RpcProviderType
  rpcUrl: string
  apiKey?: string
}

export interface RpcProviderInfo {
  provider: RpcProviderType
  endpoint: string
}

const HELIUS_MAINNET = 'https://mainnet.helius-rpc.com'
const HELIUS_DEVNET = 'https://devnet.helius-rpc.com'
const QUICKNODE_SUFFIX = '.quiknode.pro'
const TRITON_SUFFIX = '.triton.one'

function buildProviderUrl(config: RpcProviderConfig): string {
  const { provider, rpcUrl, apiKey } = config

  switch (provider) {
    case 'helius': {
      if (apiKey) {
        const base = rpcUrl.includes('devnet') ? HELIUS_DEVNET : HELIUS_MAINNET
        return `${base}/?api-key=${apiKey}`
      }
      return rpcUrl
    }

    case 'quicknode': {
      if (apiKey && !rpcUrl.includes(QUICKNODE_SUFFIX)) {
        return `https://${apiKey}${QUICKNODE_SUFFIX}`
      }
      return rpcUrl
    }

    case 'triton': {
      if (apiKey && !rpcUrl.includes(TRITON_SUFFIX)) {
        return `https://${apiKey}${TRITON_SUFFIX}`
      }
      return rpcUrl
    }

    case 'generic':
    default:
      return rpcUrl
  }
}

function maskEndpoint(url: string): string {
  try {
    const parsed = new URL(url)
    // Mask API keys in query params
    if (parsed.searchParams.has('api-key')) {
      const key = parsed.searchParams.get('api-key')!
      parsed.searchParams.set('api-key', `${key.slice(0, 4)}...${key.slice(-4)}`)
    }
    // Mask API keys in subdomain (QuickNode/Triton pattern)
    const host = parsed.hostname
    if (host.includes(QUICKNODE_SUFFIX) || host.includes(TRITON_SUFFIX)) {
      const parts = host.split('.')
      if (parts[0].length > 8) {
        parts[0] = `${parts[0].slice(0, 4)}...${parts[0].slice(-4)}`
        parsed.hostname = parts.join('.')
      }
    }
    return parsed.toString()
  } catch {
    return url.replace(/[a-f0-9]{8,}/gi, (m) =>
      m.length > 8 ? `${m.slice(0, 4)}...${m.slice(-4)}` : m
    )
  }
}

export function createProviderConnection(config: RpcProviderConfig): {
  connection: Connection
  info: RpcProviderInfo
} {
  const url = buildProviderUrl(config)
  const masked = maskEndpoint(url)

  logger.info(
    { provider: config.provider, endpoint: masked },
    `RPC provider initialized: ${config.provider}`
  )

  const connection = new Connection(url, { commitment: 'confirmed' })

  return {
    connection,
    info: {
      provider: config.provider,
      endpoint: masked,
    },
  }
}

export function resolveProviderType(provider: string): RpcProviderType {
  const valid: RpcProviderType[] = ['generic', 'helius', 'quicknode', 'triton']
  const normalized = provider.toLowerCase() as RpcProviderType
  return valid.includes(normalized) ? normalized : 'generic'
}

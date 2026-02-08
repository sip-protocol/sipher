import { env } from '../config.js'

export interface DASAsset {
  id: string
  interface: string
  content?: {
    json_uri?: string
    metadata?: {
      name?: string
      symbol?: string
      description?: string
    }
  }
  token_info?: {
    balance: number
    decimals: number
    symbol?: string
    price_info?: {
      price_per_token?: number
      total_price?: number
      currency?: string
    }
  }
  ownership: {
    owner: string
    frozen: boolean
    delegated: boolean
  }
  compression?: {
    compressed: boolean
  }
}

export interface DASResponse {
  total: number
  limit: number
  page: number
  items: DASAsset[]
}

export interface DisplayOptions {
  showFungible?: boolean
  showNativeBalance?: boolean
}

function getHeliusRpcUrl(): string | null {
  if (env.RPC_PROVIDER !== 'helius') return null
  const apiKey = env.RPC_PROVIDER_API_KEY
  if (!apiKey) return null
  const base = env.SOLANA_RPC_URL.includes('devnet')
    ? 'https://devnet.helius-rpc.com'
    : 'https://mainnet.helius-rpc.com'
  return `${base}/?api-key=${apiKey}`
}

export async function getAssetsByOwner(
  ownerAddress: string,
  displayOptions: DisplayOptions = {},
  page = 1,
  limit = 1000,
): Promise<DASResponse> {
  const rpcUrl = getHeliusRpcUrl()
  if (!rpcUrl) {
    throw new HeliusDASUnavailableError(
      'Helius DAS API requires RPC_PROVIDER=helius with a valid RPC_PROVIDER_API_KEY'
    )
  }

  const body = {
    jsonrpc: '2.0',
    id: `sipher-das-${Date.now()}`,
    method: 'getAssetsByOwner',
    params: {
      ownerAddress,
      page,
      limit,
      displayOptions: {
        showFungible: displayOptions.showFungible ?? true,
        showNativeBalance: displayOptions.showNativeBalance ?? false,
      },
    },
  }

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new HeliusDASError(`Helius DAS API returned ${response.status}`)
  }

  const json = await response.json() as {
    result?: DASResponse
    error?: { code: number; message: string }
  }

  if (json.error) {
    throw new HeliusDASError(`Helius DAS error: ${json.error.message}`)
  }

  if (!json.result) {
    throw new HeliusDASError('Helius DAS returned empty result')
  }

  return json.result
}

export function isHeliusConfigured(): boolean {
  return env.RPC_PROVIDER === 'helius' && !!env.RPC_PROVIDER_API_KEY
}

export class HeliusDASError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HeliusDASError'
  }
}

export class HeliusDASUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HeliusDASUnavailableError'
  }
}

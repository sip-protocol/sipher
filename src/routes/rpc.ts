import { Router, Request, Response } from 'express'
import { getProviderInfo, checkSolanaHealth } from '../services/solana.js'

const router = Router()

const SUPPORTED_PROVIDERS = [
  {
    name: 'generic',
    description: 'Any Solana RPC endpoint (default)',
    config: ['SOLANA_RPC_URL'],
  },
  {
    name: 'helius',
    description: 'Helius DAS API — optimized for production workloads',
    config: ['RPC_PROVIDER_API_KEY'],
    url: 'https://helius.dev',
  },
  {
    name: 'quicknode',
    description: 'QuickNode — low-latency RPC with add-ons',
    config: ['RPC_PROVIDER_API_KEY'],
    url: 'https://quicknode.com',
  },
  {
    name: 'triton',
    description: 'Triton (RPC Pool) — ultra-low latency gRPC',
    config: ['RPC_PROVIDER_API_KEY'],
    url: 'https://triton.one',
  },
]

router.get('/rpc/providers', async (_req: Request, res: Response) => {
  const current = getProviderInfo()
  const health = await checkSolanaHealth()

  res.json({
    success: true,
    data: {
      active: {
        provider: current.provider,
        endpoint: current.endpoint,
        connected: health.connected,
        cluster: health.cluster,
        latencyMs: health.latencyMs,
      },
      supported: SUPPORTED_PROVIDERS,
      configuration: {
        env: ['RPC_PROVIDER', 'SOLANA_RPC_URL', 'RPC_PROVIDER_API_KEY'],
        description: 'Set RPC_PROVIDER to switch providers. Use RPC_PROVIDER_API_KEY for authenticated providers.',
      },
    },
  })
})

export default router

import { Router, Request, Response } from 'express'

export const chainsRouter = Router()

interface ChainStatus {
  chainId: string
  network: 'mainnet' | 'devnet' | 'testnet'
  programId: string
  vaultPda: string | null
  tvlSol: number
  feeBps: number
  status: 'live' | 'pending'
  rpcLatencyMs: number | null
}

const CHAINS: ChainStatus[] = [
  {
    chainId: 'solana-mainnet',
    network: 'mainnet',
    programId: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
    vaultPda: 'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ',
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'solana-devnet',
    network: 'devnet',
    programId: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
    vaultPda: 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u',
    tvlSol: 0,
    feeBps: 10,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'sepolia',
    network: 'testnet',
    programId: '0x1FED19684dC108304960db2818CF5a961d28405E',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'arbitrum-sepolia',
    network: 'testnet',
    programId: '0x0B0d06D6B5136d63Bd0817414E2D318999e50339',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'base-sepolia',
    network: 'testnet',
    programId: '0x0B0d06D6B5136d63Bd0817414E2D318999e50339',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'op-sepolia',
    network: 'testnet',
    programId: '0x0B0d06D6B5136d63Bd0817414E2D318999e50339',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'scroll-sepolia',
    network: 'testnet',
    programId: '0x0B0d06D6B5136d63Bd0817414E2D318999e50339',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'linea-sepolia',
    network: 'testnet',
    programId: '0x0B0d06D6B5136d63Bd0817414E2D318999e50339',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'mode-sepolia',
    network: 'testnet',
    programId: '0x0B0d06D6B5136d63Bd0817414E2D318999e50339',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  {
    chainId: 'blast-sepolia',
    network: 'testnet',
    programId: '',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'pending',
    rpcLatencyMs: null,
  },
  {
    chainId: 'mantle-sepolia',
    network: 'testnet',
    programId: '',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'pending',
    rpcLatencyMs: null,
  },
  {
    chainId: 'zksync-era-sepolia',
    network: 'testnet',
    programId: '',
    vaultPda: null,
    tvlSol: 0,
    feeBps: 50,
    status: 'pending',
    rpcLatencyMs: null,
  },
]

chainsRouter.get('/', (_req: Request, res: Response) => {
  res.json({ chains: CHAINS })
})

chainsRouter.get('/aggregate', (_req: Request, res: Response) => {
  const totalTvlSol = CHAINS.reduce((sum, c) => sum + c.tvlSol, 0)
  const liveChains = CHAINS.filter((c) => c.status === 'live').length
  res.json({
    totalTvlSol,
    chainCount: CHAINS.length,
    liveChainCount: liveChains,
    asOf: new Date().toISOString(),
  })
})

import { CSPLTokenService } from '@sip-protocol/sdk'

const WELL_KNOWN_TOKENS = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'C-wSOL',
    name: 'Confidential Wrapped SOL',
    decimals: 9,
    isNativeWrap: true,
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'C-USDC',
    name: 'Confidential USDC',
    decimals: 6,
  },
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'C-USDT',
    name: 'Confidential USDT',
    decimals: 6,
  },
]

let service: CSPLTokenService | null = null

export async function getCSPLService(): Promise<CSPLTokenService> {
  if (!service) {
    service = new CSPLTokenService()
    await service.initialize()

    for (const token of WELL_KNOWN_TOKENS) {
      service.registerToken(token as any)
    }
  }
  return service
}

export function resetCSPLService(): void {
  service = null
}

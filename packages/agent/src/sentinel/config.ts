export interface SentinelConfig {
  scanInterval: number
  activeScanInterval: number
  autoRefundThreshold: number
  threatCheckEnabled: boolean
  largeTransferThreshold: number
  maxRpcPerWallet: number
  maxWalletsPerCycle: number
  backoffMax: number
}

export function getSentinelConfig(): SentinelConfig {
  return {
    scanInterval: Number(process.env.SENTINEL_SCAN_INTERVAL ?? '60000'),
    activeScanInterval: Number(process.env.SENTINEL_ACTIVE_SCAN_INTERVAL ?? '15000'),
    autoRefundThreshold: Number(process.env.SENTINEL_AUTO_REFUND_THRESHOLD ?? '1'),
    threatCheckEnabled: process.env.SENTINEL_THREAT_CHECK !== 'false',
    largeTransferThreshold: Number(process.env.SENTINEL_LARGE_TRANSFER_THRESHOLD ?? '10'),
    maxRpcPerWallet: 5,
    maxWalletsPerCycle: 20,
    backoffMax: 600_000,
  }
}

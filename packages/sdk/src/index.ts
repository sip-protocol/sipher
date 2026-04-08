// @sipher/sdk — TypeScript SDK for the sipher_vault Solana program

// Types
export type {
  VaultConfig,
  DepositRecord,
  VaultBalance,
  DepositResult,
  WithdrawResult,
  RefundResult,
  StealthPayment,
  ScanResult,
  SipherConfig,
  Cluster,
} from './types.js'

// Config
export {
  SIPHER_VAULT_PROGRAM_ID,
  SIP_PRIVACY_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  DEPOSIT_RECORD_SEED,
  VAULT_TOKEN_SEED,
  FEE_TOKEN_SEED,
  DEFAULT_REFUND_TIMEOUT,
  DEFAULT_FEE_BPS,
  MAX_FEE_BPS,
  ANCHOR_DISCRIMINATOR_SIZE,
  VAULT_CONFIG_SIZE,
  DEPOSIT_RECORD_SIZE,
  DEVNET_CONFIG,
  MAINNET_CONFIG,
  getConfig,
} from './config.js'

// Connection helper
export { createConnection } from './connection.js'

// Token resolution
export {
  WSOL_MINT,
  USDC_MINT,
  USDT_MINT,
  resolveTokenMint,
  getTokenDecimals,
  toBaseUnits,
  fromBaseUnits,
} from './tokens.js'

// Vault operations
export {
  deriveVaultConfigPDA,
  deriveDepositRecordPDA,
  deriveVaultTokenPDA,
  deriveFeeTokenPDA,
  anchorDiscriminator,
  deserializeVaultConfig,
  deserializeDepositRecord,
  getVaultConfig,
  getVaultBalance,
  buildDepositTx,
  buildRefundTx,
} from './vault.js'

// Privacy operations
export {
  buildPrivateSendTx,
  scanForPayments,
} from './privacy.js'
export type { PrivateSendParams, ScanParams } from './privacy.js'

// Event parsing
export {
  parseVaultEvents,
  getVaultHistory,
} from './events.js'
export type {
  VaultEventType,
  VaultEvent,
  VaultHistoryResult,
  VaultHistoryOptions,
} from './events.js'

// Jupiter swap helpers
export {
  getJupiterQuote,
  buildSwapTx,
} from './swap.js'
export type {
  JupiterQuote,
  JupiterRouteLeg,
  JupiterSwapResponse,
} from './swap.js'

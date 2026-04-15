import { checkReputationTool, executeCheckReputation } from './check-reputation.js'
import { getRecentActivityTool, executeGetRecentActivity } from './get-recent-activity.js'
import { getOnChainSignaturesTool, executeGetOnChainSignatures } from './get-on-chain-signatures.js'
import { getDepositStatusTool, executeGetDepositStatus } from './get-deposit-status.js'
import { getVaultBalanceTool, executeGetVaultBalance } from './get-vault-balance.js'
import { getPendingClaimsTool, executeGetPendingClaims } from './get-pending-claims.js'
import { getRiskHistoryTool, executeGetRiskHistory } from './get-risk-history.js'
import type { AnthropicTool } from '../../pi/tool-adapter.js'

export const SENTINEL_READ_TOOLS: AnthropicTool[] = [
  checkReputationTool,
  getRecentActivityTool,
  getOnChainSignaturesTool,
  getDepositStatusTool,
  getVaultBalanceTool,
  getPendingClaimsTool,
  getRiskHistoryTool,
]

export const SENTINEL_READ_EXECUTORS: Record<string, (p: Record<string, unknown>) => Promise<unknown>> = {
  checkReputation: (p) => executeCheckReputation(p as { address: string }),
  getRecentActivity: (p) => executeGetRecentActivity(p as Parameters<typeof executeGetRecentActivity>[0]),
  getOnChainSignatures: (p) => executeGetOnChainSignatures(p as Parameters<typeof executeGetOnChainSignatures>[0]),
  getDepositStatus: (p) => executeGetDepositStatus(p as { pda: string }),
  getVaultBalance: (p) => executeGetVaultBalance(p as { wallet: string }),
  getPendingClaims: (p) => executeGetPendingClaims(p as { wallet?: string }),
  getRiskHistory: (p) => executeGetRiskHistory(p as Parameters<typeof executeGetRiskHistory>[0]),
}

export {
  checkReputationTool, executeCheckReputation,
  getRecentActivityTool, executeGetRecentActivity,
  getOnChainSignaturesTool, executeGetOnChainSignatures,
  getDepositStatusTool, executeGetDepositStatus,
  getVaultBalanceTool, executeGetVaultBalance,
  getPendingClaimsTool, executeGetPendingClaims,
  getRiskHistoryTool, executeGetRiskHistory,
}

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

import { executeRefundTool, executeSentinelRefund } from './execute-refund.js'
import { addToBlacklistTool, executeAddToBlacklist } from './add-to-blacklist.js'
import { removeFromBlacklistTool, executeRemoveFromBlacklist } from './remove-from-blacklist.js'
import { alertUserTool, executeAlertUser } from './alert-user.js'
import { scheduleCancellableTool, executeScheduleCancellable } from './schedule-cancellable.js'
import { cancelPendingTool, executeCancelPending } from './cancel-pending.js'
import { vetoSipherTool, executeVetoSipher } from './veto-sipher-action.js'

export const SENTINEL_ACTION_TOOLS: AnthropicTool[] = [
  executeRefundTool,
  addToBlacklistTool,
  removeFromBlacklistTool,
  alertUserTool,
  scheduleCancellableTool,
  cancelPendingTool,
  vetoSipherTool,
]

export const SENTINEL_ACTION_EXECUTORS: Record<string, (p: Record<string, unknown>) => Promise<unknown>> = {
  executeRefund: (p) => executeSentinelRefund(p as Parameters<typeof executeSentinelRefund>[0]),
  addToBlacklist: (p) => executeAddToBlacklist(p as Parameters<typeof executeAddToBlacklist>[0]),
  removeFromBlacklist: (p) => executeRemoveFromBlacklist(p as Parameters<typeof executeRemoveFromBlacklist>[0]),
  alertUser: (p) => executeAlertUser(p as Parameters<typeof executeAlertUser>[0]),
  scheduleCancellableAction: (p) => executeScheduleCancellable(p as Parameters<typeof executeScheduleCancellable>[0]),
  cancelPendingAction: (p) => executeCancelPending(p as Parameters<typeof executeCancelPending>[0]),
  vetoSipherAction: (p) => executeVetoSipher(p as Parameters<typeof executeVetoSipher>[0]),
}

export const SENTINEL_ALL_TOOLS: AnthropicTool[] = [...SENTINEL_READ_TOOLS, ...SENTINEL_ACTION_TOOLS]

export const SENTINEL_ALL_EXECUTORS: Record<string, (p: Record<string, unknown>) => Promise<unknown>> = {
  ...SENTINEL_READ_EXECUTORS,
  ...SENTINEL_ACTION_EXECUTORS,
}

export {
  executeRefundTool, executeSentinelRefund,
  addToBlacklistTool, executeAddToBlacklist,
  removeFromBlacklistTool, executeRemoveFromBlacklist,
  alertUserTool, executeAlertUser,
  scheduleCancellableTool, executeScheduleCancellable,
  cancelPendingTool, executeCancelPending,
  vetoSipherTool, executeVetoSipher,
}

import { countFundActionsInLastHour, countBlacklistAddedByInLastHour } from '../db.js'

/**
 * Returns true if this wallet is still allowed another fund action within the
 * sliding 1h window. Counts non-cancelled pending_actions rows of type 'refund'.
 */
export function isFundActionWithinRateLimit(wallet: string, cap: number): boolean {
  return countFundActionsInLastHour(wallet) < cap
}

/**
 * Returns true if SENTINEL is still allowed another blacklist write within the
 * sliding 1h window. Only counts entries where added_by = 'sentinel'.
 */
export function isBlacklistWithinRateLimit(cap: number): boolean {
  return countBlacklistAddedByInLastHour('sentinel') < cap
}

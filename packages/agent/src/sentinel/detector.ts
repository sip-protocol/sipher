import { type GuardianEvent } from '../coordination/event-bus.js'

export interface Detection {
  event: string
  level: 'critical' | 'important' | 'routine'
  data: Record<string, unknown>
  wallet?: string
}

// ─── Detector functions ────────────────────────────────────────────────────

export function detectUnclaimedPayment(params: {
  ephemeralPubkey: string
  amount: number
  wallet?: string
}): Detection {
  return {
    event: 'sentinel:unclaimed',
    level: 'important',
    data: {
      ephemeralPubkey: params.ephemeralPubkey,
      amount: params.amount,
    },
    wallet: params.wallet,
  }
}

export function detectExpiredDeposit(params: {
  depositPda: string
  amount: number
  wallet?: string
  threshold: number
}): Detection {
  const isLarge = params.amount >= params.threshold

  return {
    event: isLarge ? 'sentinel:refund-pending' : 'sentinel:expired',
    level: isLarge ? 'critical' : 'important',
    data: {
      depositPda: params.depositPda,
      amount: params.amount,
      threshold: params.threshold,
      autoRefund: !isLarge,
    },
    wallet: params.wallet,
  }
}

export function detectThreat(params: {
  address: string
  reason: string
  wallet?: string
}): Detection {
  return {
    event: 'sentinel:threat',
    level: 'critical',
    data: {
      address: params.address,
      reason: params.reason,
    },
    wallet: params.wallet,
  }
}

export function detectLargeTransfer(params: {
  amount: number
  from: string
  wallet?: string
  threshold: number
}): Detection {
  return {
    event: 'sentinel:large-transfer',
    level: 'important',
    data: {
      amount: params.amount,
      from: params.from,
      threshold: params.threshold,
    },
    wallet: params.wallet,
  }
}

export function detectBalanceChange(params: {
  previousBalance: number
  currentBalance: number
  wallet?: string
}): Detection {
  return {
    event: 'sentinel:balance',
    level: 'important',
    data: {
      previousBalance: params.previousBalance,
      currentBalance: params.currentBalance,
      delta: params.currentBalance - params.previousBalance,
    },
    wallet: params.wallet,
  }
}

// ─── Conversion ────────────────────────────────────────────────────────────

export function toGuardianEvent(
  detection: Detection
): Omit<GuardianEvent, 'timestamp'> {
  return {
    source: 'sentinel',
    type: detection.event,
    level: detection.level,
    data: detection.data,
    wallet: detection.wallet ?? null,
  }
}

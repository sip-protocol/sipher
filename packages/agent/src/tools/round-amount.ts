import type Anthropic from '@anthropic-ai/sdk'

const DENOMINATIONS = [10000, 5000, 1000, 500, 100, 50, 10]

export interface RoundAmountParams {
  amount: number
  token: string
}

export interface RoundAmountToolResult {
  action: 'roundAmount'
  status: 'success'
  message: string
  roundedAmount: number
  remainder: number
  denomination: number
  token: string
}

export const roundAmountTool: Anthropic.Tool = {
  name: 'roundAmount',
  description:
    'Round a payment amount down to a common denomination to reduce amount correlation. ' +
    'Denominations: 10, 50, 100, 500, 1000, 5000, 10000. ' +
    'The remainder stays in the vault.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to round (will be rounded DOWN to the nearest denomination)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, etc.',
      },
    },
    required: ['amount', 'token'],
  },
}

export async function executeRoundAmount(
  params: RoundAmountParams,
): Promise<RoundAmountToolResult> {
  if (!params.amount || params.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }

  const token = params.token.toUpperCase()

  let denomination = 0
  let roundedAmount = 0
  for (const denom of DENOMINATIONS) {
    if (params.amount >= denom) {
      denomination = denom
      roundedAmount = Math.floor(params.amount / denom) * denom
      break
    }
  }

  const remainder = Math.round((params.amount - roundedAmount) * 100) / 100

  if (roundedAmount === 0) {
    return {
      action: 'roundAmount',
      status: 'success',
      message: `Amount ${params.amount} ${token} is too small to round — minimum denomination is 10. Full amount stays in vault.`,
      roundedAmount: 0,
      remainder: params.amount,
      denomination: 0,
      token,
    }
  }

  return {
    action: 'roundAmount',
    status: 'success',
    message: `Rounded ${params.amount} ${token} → ${roundedAmount} ${token} (denomination: ${denomination}). Remainder: ${remainder} ${token} stays in vault.`,
    roundedAmount,
    remainder,
    denomination,
    token,
  }
}

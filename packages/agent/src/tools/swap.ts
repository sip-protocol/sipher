import type Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Swap tool — Private swap via vault + Jupiter + stealth output
//
// Phase 1: Validates inputs, returns quote info + message. Full Jupiter
// integration (route fetching, tx building) is Phase 1.5.
// ─────────────────────────────────────────────────────────────────────────────

export interface SwapParams {
  amount: number
  fromToken: string
  toToken: string
  recipient?: string
  slippageBps?: number
}

export interface SwapToolResult {
  action: 'swap'
  amount: number
  fromToken: string
  toToken: string
  recipient: string | null
  slippageBps: number
  status: 'awaiting_quote'
  message: string
  /** Base64-serialized unsigned transaction (null until Phase 1.5 Jupiter integration) */
  serializedTx: null
  quote: {
    estimatedOutput: null
    priceImpact: null
    route: null
    note: string
  }
}

export const swapTool: Anthropic.Tool = {
  name: 'swap',
  description:
    'Execute a private swap: vault funds are swapped via Jupiter and routed to a stealth address. ' +
    'The output tokens are unlinkable to the input. ' +
    'Phase 1 returns quote info — full Jupiter integration in Phase 1.5.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to swap (in human-readable units of fromToken)',
      },
      fromToken: {
        type: 'string',
        description: 'Token to swap from — SOL, USDC, USDT, or SPL mint address',
      },
      toToken: {
        type: 'string',
        description: 'Token to swap to — SOL, USDC, USDT, or SPL mint address',
      },
      recipient: {
        type: 'string',
        description: 'Optional stealth meta-address or pubkey for the output. Defaults to your own stealth address.',
      },
      slippageBps: {
        type: 'number',
        description: 'Slippage tolerance in basis points (default: 50 = 0.5%)',
      },
    },
    required: ['amount', 'fromToken', 'toToken'],
  },
}

export async function executeSwap(params: SwapParams): Promise<SwapToolResult> {
  if (params.amount <= 0) {
    throw new Error('Swap amount must be greater than zero')
  }

  if (!params.fromToken || params.fromToken.trim().length === 0) {
    throw new Error('Source token (fromToken) is required')
  }

  if (!params.toToken || params.toToken.trim().length === 0) {
    throw new Error('Destination token (toToken) is required')
  }

  const fromToken = params.fromToken.toUpperCase()
  const toToken = params.toToken.toUpperCase()

  if (fromToken === toToken) {
    throw new Error('Source and destination tokens must be different')
  }

  const slippageBps = Math.min(Math.max(params.slippageBps ?? 50, 1), 1000)

  // Phase 1: Return the prepared shape. Jupiter route fetching + tx building
  // will be wired in Phase 1.5. The tool validates inputs and returns the
  // swap parameters so the agent can present a confirmation to the user.
  return {
    action: 'swap',
    amount: params.amount,
    fromToken,
    toToken,
    recipient: params.recipient ?? null,
    slippageBps,
    status: 'awaiting_quote',
    message:
      `Private swap prepared: ${params.amount} ${fromToken} -> ${toToken}. ` +
      `Slippage: ${slippageBps / 100}%. ` +
      `Jupiter quote + stealth routing will execute in Phase 1.5.`,
    serializedTx: null,
    quote: {
      estimatedOutput: null,
      priceImpact: null,
      route: null,
      note: 'Jupiter integration pending. Swap will route through vault -> Jupiter -> stealth ATA.',
    },
  }
}

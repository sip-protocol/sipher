import type { Connection } from '@solana/web3.js'
import { TorqueMCPClient } from './mcp-client.js'
import { deriveRebateDestination } from './rebate-destination.js'
import type { SipherEventName, SipherGrowthEvent, TorqueMCPClientOptions } from './types.js'

export interface GrowthHookOptions extends TorqueMCPClientOptions {
  growthEnabled: boolean
  /** Network used to populate SipherGrowthEvent.network. */
  network: 'mainnet-beta' | 'devnet'
  /** Optional connection for rebate-destination SNS resolution; emission is skipped if omitted. */
  connection?: Connection
}

/** Map sipher tool name → growth event name. Read-only tools are intentionally absent. */
const TOOL_EVENT_MAP: Record<string, SipherEventName> = {
  send: 'sipher.private_send_completed',
  swap: 'sipher.private_swap_completed',
  claim: 'sipher.private_claim_completed',
  drip: 'sipher.recurring_send_tick',
  splitSend: 'sipher.batch_send_completed',
}

/** Swap outputs are on-chain DEX events already; include lamport amount for Torque attribution. */
const AMOUNT_INCLUDED_TOOLS = new Set(['swap'])

type ToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>

export function wrapExecutorWithGrowthHook(
  baseExecutor: ToolExecutor,
  opts: GrowthHookOptions,
): ToolExecutor {
  if (!opts.growthEnabled) {
    return baseExecutor
  }

  const client = new TorqueMCPClient(opts)

  return async (name, input) => {
    const result = await baseExecutor(name, input)
    void emitGrowthEvent(name, input, result, client, opts).catch((err) => {
      console.warn(
        `[torque] growth event emission threw (suppressed): ${err instanceof Error ? err.message : String(err)}`,
      )
    })
    return result
  }
}

async function emitGrowthEvent(
  toolName: string,
  input: Record<string, unknown>,
  result: unknown,
  client: TorqueMCPClient,
  opts: GrowthHookOptions,
): Promise<void> {
  const eventName = TOOL_EVENT_MAP[toolName]
  if (!eventName) return

  const txSignature = extractTxSignature(result)
  if (!txSignature) return

  const wallet = typeof input.wallet === 'string' ? input.wallet : undefined
  if (!wallet) return

  // Only attempt SNS resolution when a connection is available.
  if (!opts.connection) return

  const domain =
    typeof input.recipient === 'string' && input.recipient.endsWith('.sol')
      ? input.recipient
      : undefined

  const destination = await deriveRebateDestination({
    wallet,
    domain,
    connection: opts.connection,
  })

  if (destination.kind !== 'stealth') return

  const event: SipherGrowthEvent = {
    event: eventName,
    wallet,
    ts: new Date().toISOString(),
    tx_signature: txSignature,
    network: opts.network,
    metadata: {
      rebate_destination: destination.address,
      ...(AMOUNT_INCLUDED_TOOLS.has(toolName)
        ? { amount_lamports: extractAmountLamports(result) }
        : {}),
    },
  }

  await client.emitEvent(event)
}

function extractTxSignature(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as Record<string, unknown>
  if (typeof r.signature === 'string') return r.signature
  if (typeof r.txSignature === 'string') return r.txSignature
  return undefined
}

function extractAmountLamports(result: unknown): number | undefined {
  if (!result || typeof result !== 'object') return undefined
  const r = result as Record<string, unknown>
  if (typeof r.amountInLamports === 'number') return r.amountInLamports
  if (typeof r.amountLamports === 'number') return r.amountLamports
  return undefined
}

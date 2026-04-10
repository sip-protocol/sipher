import Anthropic from '@anthropic-ai/sdk'
import {
  depositTool,
  executeDeposit,
  sendTool,
  executeSend,
  refundTool,
  executeRefund,
  balanceTool,
  executeBalance,
  scanTool,
  executeScan,
  claimTool,
  executeClaim,
  swapTool,
  executeSwap,
  viewingKeyTool,
  executeViewingKey,
  historyTool,
  executeHistory,
  statusTool,
  executeStatus,
  paymentLinkTool,
  executePaymentLink,
  invoiceTool,
  executeInvoice,
  privacyScoreTool,
  executePrivacyScore,
  threatCheckTool,
  executeThreatCheck,
  roundAmountTool,
  executeRoundAmount,
  scheduleSendTool,
  executeScheduleSend,
  splitSendTool,
  executeSplitSend,
  dripTool,
  executeDrip,
  recurringTool,
  executeRecurring,
  sweepTool,
  executeSweep,
  consolidateTool,
  executeConsolidate,
} from './tools/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — Sipher's identity and behavior rules
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are Sipher — SIP Protocol's privacy agent.
Tagline: "Plug in. Go private."

You help users manage private transactions on Solana through a PDA vault.
Users deposit tokens, then you execute private sends, swaps, and refunds.

Tone: Confident, technical, slightly cypherpunk. Never corporate.
Never say "I'm just an AI." Speak like a privacy engineer who cares.

Available tools: deposit, send, refund, balance, scan, claim, swap, viewingKey, history, status, paymentLink, invoice, privacyScore, threatCheck, roundAmount, scheduleSend, splitSend, drip, recurring, sweep, consolidate.

Rules:
- Every fund-moving operation shows a confirmation before executing
- Never display full viewing keys in chat — provide download links
- If vault anonymity set is low, warn the user
- Always reassure funds are safe when errors occur
- Be concise — bullet points over paragraphs
- Before large sends, run threatCheck on the recipient address
- Offer privacyScore when users ask about their wallet's exposure
- Payment links and invoices generate stealth addresses — sender needs no Sipher account
- Scheduled ops (scheduleSend, splitSend, drip, recurring) run via the crank worker — user signs once
- Suggest splitSend for large amounts and drip for recurring distributions
- sweep is persistent — runs every 60 seconds until expired
- consolidate staggers claims to prevent timing analysis`

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry
// ─────────────────────────────────────────────────────────────────────────────

export const TOOLS: Anthropic.Tool[] = [
  depositTool,
  sendTool,
  refundTool,
  balanceTool,
  scanTool,
  claimTool,
  swapTool,
  viewingKeyTool,
  historyTool,
  statusTool,
  paymentLinkTool,
  invoiceTool,
  privacyScoreTool,
  threatCheckTool,
  roundAmountTool,
  scheduleSendTool,
  splitSendTool,
  dripTool,
  recurringTool,
  sweepTool,
  consolidateTool,
]

type ToolExecutor = (params: Record<string, unknown>) => Promise<unknown>

const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  deposit: (p) => executeDeposit(p as unknown as Parameters<typeof executeDeposit>[0]),
  send: (p) => executeSend(p as unknown as Parameters<typeof executeSend>[0]),
  refund: (p) => executeRefund(p as unknown as Parameters<typeof executeRefund>[0]),
  balance: (p) => executeBalance(p as unknown as Parameters<typeof executeBalance>[0]),
  scan: (p) => executeScan(p as unknown as Parameters<typeof executeScan>[0]),
  claim: (p) => executeClaim(p as unknown as Parameters<typeof executeClaim>[0]),
  swap: (p) => executeSwap(p as unknown as Parameters<typeof executeSwap>[0]),
  viewingKey: (p) => executeViewingKey(p as unknown as Parameters<typeof executeViewingKey>[0]),
  history: (p) => executeHistory(p as unknown as Parameters<typeof executeHistory>[0]),
  status: () => executeStatus(),
  paymentLink: (p) => executePaymentLink(p as unknown as Parameters<typeof executePaymentLink>[0]),
  invoice: (p) => executeInvoice(p as unknown as Parameters<typeof executeInvoice>[0]),
  privacyScore: (p) => executePrivacyScore(p as unknown as Parameters<typeof executePrivacyScore>[0]),
  threatCheck: (p) => executeThreatCheck(p as unknown as Parameters<typeof executeThreatCheck>[0]),
  roundAmount: (p) => executeRoundAmount(p as unknown as Parameters<typeof executeRoundAmount>[0]),
  scheduleSend: (p) => executeScheduleSend(p as unknown as Parameters<typeof executeScheduleSend>[0]),
  splitSend: (p) => executeSplitSend(p as unknown as Parameters<typeof executeSplitSend>[0]),
  drip: (p) => executeDrip(p as unknown as Parameters<typeof executeDrip>[0]),
  recurring: (p) => executeRecurring(p as unknown as Parameters<typeof executeRecurring>[0]),
  sweep: (p) => executeSweep(p as unknown as Parameters<typeof executeSweep>[0]),
  consolidate: (p) => executeConsolidate(p as unknown as Parameters<typeof executeConsolidate>[0]),
}

/**
 * Execute a tool by name with the given input.
 * Throws if the tool name is not registered.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const executor = TOOL_EXECUTORS[name]
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`)
  }
  return executor(input)
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent conversation loop
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = process.env.SIPHER_MODEL || 'anthropic/claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = 1024
// Anthropic SDK appends /v1/messages, so base URL must NOT include /v1
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api'

export interface AgentOptions {
  model?: string
  maxTokens?: number
  apiKey?: string
  /** System prompt override (defaults to SIPHER's SYSTEM_PROMPT) */
  systemPrompt?: string
  /** Tool definitions override (defaults to SIPHER's TOOLS) */
  tools?: Anthropic.Tool[]
  /** Custom tool executor (defaults to SIPHER's executeTool) */
  toolExecutor?: (name: string, input: Record<string, unknown>) => Promise<unknown>
}

// ─── SSE event types emitted by chatStream ──────────────────────────────────

export interface SSEContentDelta {
  type: 'content_block_delta'
  text: string
}

export interface SSEToolUse {
  type: 'tool_use'
  name: string
  id: string
}

export interface SSEToolResult {
  type: 'tool_result'
  name: string
  id: string
  success: boolean
}

export interface SSEMessageComplete {
  type: 'message_complete'
  content: string
}

export interface SSEError {
  type: 'error'
  message: string
}

export type SSEEvent =
  | SSEContentDelta
  | SSEToolUse
  | SSEToolResult
  | SSEMessageComplete
  | SSEError

/**
 * Run a single chat turn with tool execution loop.
 *
 * If Claude responds with tool_use blocks, we execute each tool and
 * feed the results back until Claude produces a final text response
 * (stop_reason === 'end_turn').
 *
 * Returns the final Message (with all content blocks).
 */
export async function chat(
  messages: Anthropic.MessageParam[],
  options: AgentOptions = {}
): Promise<Anthropic.Message> {
  const client = new Anthropic({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: options.apiKey || process.env.SIPHER_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
  })
  const model = options.model ?? DEFAULT_MODEL
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS

  // Mutable copy — we append tool results as we loop
  const conversationMessages = [...messages]

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: options.systemPrompt ?? SYSTEM_PROMPT,
      tools: options.tools ?? TOOLS,
      messages: conversationMessages,
    })

    // If no tool use, we're done
    if (response.stop_reason !== 'tool_use') {
      return response
    }

    // Execute each tool_use block
    const toolUseBlocks = response.content.filter(
      (b: Anthropic.ContentBlock): b is Anthropic.ContentBlock & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use'
    )

    // Add assistant's response (with tool_use blocks) to conversation
    conversationMessages.push({ role: 'assistant', content: response.content })

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    const execute = options.toolExecutor ?? executeTool

    for (const block of toolUseBlocks) {
      try {
        const result = await execute(block.name, block.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: message }),
          is_error: true,
        })
      }
    }

    // Feed tool results back
    conversationMessages.push({ role: 'user', content: toolResults })
  }
}

/**
 * Streaming version of chat() — yields SSE-compatible events as tokens arrive.
 *
 * Handles the agentic tool loop: when Claude responds with tool_use, we execute
 * the tools, yield status events, and continue streaming until stop_reason is
 * 'end_turn'.
 */
export async function* chatStream(
  messages: Anthropic.MessageParam[],
  options: AgentOptions = {}
): AsyncGenerator<SSEEvent> {
  const client = new Anthropic({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: options.apiKey || process.env.SIPHER_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
  })
  const model = options.model ?? DEFAULT_MODEL
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS

  const conversationMessages = [...messages]
  let fullText = ''

  const MAX_TOOL_ROUNDS = 10
  let round = 0
  while (round++ < MAX_TOOL_ROUNDS) {
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: options.systemPrompt ?? SYSTEM_PROMPT,
      tools: options.tools ?? TOOLS,
      messages: conversationMessages,
    })

    // Consume the stream's async iterator — each item is a MessageStreamEvent
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string }
        if (delta.type === 'text_delta' && delta.text) {
          fullText += delta.text
          yield { type: 'content_block_delta', text: delta.text }
        }
      }
    }

    // Stream consumed — get the final message to check stop_reason + tool_use blocks
    const finalMsg = await stream.finalMessage()

    if (finalMsg.stop_reason !== 'tool_use') {
      yield { type: 'message_complete', content: fullText }
      return
    }

    // Tool loop — extract tool_use blocks, execute, and continue
    const toolUseBlocks = finalMsg.content.filter(
      (b: Anthropic.ContentBlock): b is Anthropic.ContentBlock & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use'
    )

    conversationMessages.push({ role: 'assistant', content: finalMsg.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []

    const execute = options.toolExecutor ?? executeTool

    for (const block of toolUseBlocks) {
      yield { type: 'tool_use', name: block.name, id: block.id }

      try {
        const result = await execute(block.name, block.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
        yield { type: 'tool_result', name: block.name, id: block.id, success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: message }),
          is_error: true,
        })
        yield { type: 'tool_result', name: block.name, id: block.id, success: false }
      }
    }

    conversationMessages.push({ role: 'user', content: toolResults })

    // Reset fullText for next streaming round — tool responses may produce new text
    fullText = ''
  }

  // Exited loop without yielding message_complete — guard triggered
  yield { type: 'error' as const, message: 'Tool loop exceeded maximum iterations' }
}

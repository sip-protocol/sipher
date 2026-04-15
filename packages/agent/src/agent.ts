import type { AnthropicTool } from './pi/tool-adapter.js'
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
import type { AgentMessage } from '@mariozechner/pi-agent-core'
import { createPiAgent } from './pi/sipher-agent.js'
import { streamPiAgent } from './pi/stream-bridge.js'
import { attachToolGuard } from './pi/tool-guard.js'

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

export const TOOLS: AnthropicTool[] = [
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
// Agent conversation loop — Pi SDK backed
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatOptions {
  /** Override system prompt */
  systemPrompt?: string
  /** Override tool registry */
  tools?: AnthropicTool[]
  /** Override tool executor (defaults to executeTool) */
  toolExecutor?: (name: string, input: Record<string, unknown>) => Promise<unknown>
  /** Override model in 'provider:modelId' format (defaults to getSipherModel()) */
  model?: string
  /** Prior conversation history in Pi AgentMessage format */
  history?: AgentMessage[]
  /** Optional session id for cache routing */
  sessionId?: string
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
 * Run the SIPHER agent loop to completion via Pi SDK.
 *
 * Returns final assistant text and the list of tool names invoked during
 * this turn. Pi handles the agentic tool loop internally — no manual
 * while-loop required.
 */
export async function chat(
  userMessage: string,
  opts: ChatOptions = {},
): Promise<{ text: string; toolsUsed: string[] }> {
  const agent = createPiAgent({
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,
    tools: opts.tools ?? TOOLS,
    toolExecutor: opts.toolExecutor ?? executeTool,
    model: opts.model,
    history: opts.history,
    sessionId: opts.sessionId,
  })

  const toolsUsed: string[] = []
  agent.subscribe((event) => {
    if (event.type === 'tool_execution_start') {
      const e = event as { type: 'tool_execution_start'; toolName: string }
      toolsUsed.push(e.toolName)
    }
  })

  const guardUnsub = attachToolGuard(agent)
  try {
    await agent.prompt(userMessage)
  } finally {
    guardUnsub()
  }

  // Extract final assistant text from agent.state.messages
  const messages = agent.state.messages
  const finalAssistant = [...messages]
    .reverse()
    .find((m) => (m as { role: string }).role === 'assistant') as
    | { role: string; content?: Array<{ type: string; text?: string }> }
    | undefined

  const text =
    finalAssistant?.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('') ?? ''

  return { text, toolsUsed }
}

/**
 * Streaming version — yields SSE-compatible events as the Pi agent runs.
 *
 * Pi SDK drives the agentic tool loop internally. The stream-bridge converts
 * Pi's push-based event model to a pull-based async generator of SSEEvents
 * compatible with AgentCore's SSEEvent vocabulary.
 */
export async function* chatStream(
  userMessage: string,
  opts: ChatOptions = {},
): AsyncGenerator<SSEEvent> {
  const agent = createPiAgent({
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,
    tools: opts.tools ?? TOOLS,
    toolExecutor: opts.toolExecutor ?? executeTool,
    model: opts.model,
    history: opts.history,
    sessionId: opts.sessionId,
  })

  yield* streamPiAgent(agent, userMessage)
}

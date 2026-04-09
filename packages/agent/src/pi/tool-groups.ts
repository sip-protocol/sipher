import type { Tool } from '@mariozechner/pi-ai'
import {
  depositTool,
  sendTool,
  claimTool,
  refundTool,
  balanceTool,
  scanTool,
  privacyScoreTool,
  threatCheckTool,
  viewingKeyTool,
  historyTool,
  statusTool,
  paymentLinkTool,
  invoiceTool,
  swapTool,
  roundAmountTool,
  scheduleSendTool,
  splitSendTool,
  dripTool,
  recurringTool,
  sweepTool,
  consolidateTool,
} from '../tools/index.js'
import { adaptTool } from './tool-adapter.js'

// ─────────────────────────────────────────────────────────────────────────────
// Tool Groups — Organized by intent domain for dynamic loading
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_GROUPS: Record<string, Tool[]> = {
  // Core vault operations: deposits, transfers, scanning, claiming
  vault: [
    depositTool,
    sendTool,
    claimTool,
    refundTool,
    balanceTool,
    scanTool,
  ].map(adaptTool),

  // Intelligence & analytics: scores, checks, keys, history
  intel: [
    privacyScoreTool,
    threatCheckTool,
    viewingKeyTool,
    historyTool,
    statusTool,
  ].map(adaptTool),

  // Product features: payments, invoices, swaps
  product: [
    paymentLinkTool,
    invoiceTool,
    swapTool,
  ].map(adaptTool),

  // Scheduled & automated operations
  scheduled: [
    scheduleSendTool,
    splitSendTool,
    dripTool,
    recurringTool,
    sweepTool,
    consolidateTool,
    roundAmountTool,
  ].map(adaptTool),
}

// ─────────────────────────────────────────────────────────────────────────────
// getToolGroup — Retrieve a named group, throws on unknown name
// ─────────────────────────────────────────────────────────────────────────────

export function getToolGroup(name: string): Tool[] {
  const group = TOOL_GROUPS[name]
  if (!group) {
    throw new Error(`Unknown tool group: "${name}". Valid groups: ${Object.keys(TOOL_GROUPS).join(', ')}`)
  }
  return group
}

// ─────────────────────────────────────────────────────────────────────────────
// routeIntentTool — Meta-tool for intent classification before tool dispatch
// ─────────────────────────────────────────────────────────────────────────────

export const routeIntentTool: Tool = {
  name: 'routeIntent',
  description: 'Classify the user\'s intent to load the right tool group. Call this FIRST before using any other tool. Groups: vault (deposit, send, claim, refund, balance, scan), intel (privacyScore, threatCheck, viewingKey, history, status), product (paymentLink, invoice, swap), scheduled (scheduleSend, splitSend, drip, recurring, sweep, consolidate, roundAmount).',
  parameters: {
    type: 'object',
    properties: {
      group: {
        type: 'string',
        enum: ['vault', 'intel', 'product', 'scheduled'],
        description: 'The tool group matching the user\'s intent',
      },
      reasoning: {
        type: 'string',
        description: 'Brief explanation of why this group matches',
      },
    },
    required: ['group'],
  } as any,
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL_TOOL_NAMES — Flat list of all 21 tool names across all groups
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_TOOL_NAMES: string[] = Object.values(TOOL_GROUPS)
  .flat()
  .map((tool) => tool.name)

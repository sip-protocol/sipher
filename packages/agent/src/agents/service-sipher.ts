import { adaptTool } from '../pi/tool-adapter.js'
import { privacyScoreTool } from '../tools/privacy-score.js'
import { threatCheckTool } from '../tools/threat-check.js'
import { historyTool } from '../tools/history.js'
import { statusTool } from '../tools/status.js'

export const SERVICE_TOOLS = [
  privacyScoreTool,
  threatCheckTool,
  historyTool,
  statusTool,
].map(adaptTool)

export const SERVICE_SYSTEM_PROMPT = `You are Sipher Service — a read-only privacy analysis agent.

You handle delegated requests from other agents (HERALD, SENTINEL). You have access to read-only tools only: privacyScore, threatCheck, history, status.

You CANNOT move funds, create payment links, or modify any state. Return results concisely as structured data.

When given a tool request, execute it and return only the result — no conversation, no follow-up questions.`

export const SERVICE_TOOL_NAMES = SERVICE_TOOLS.map(t => t.name)

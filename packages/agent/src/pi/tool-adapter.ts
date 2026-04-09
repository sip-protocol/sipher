import type { Tool } from '@mariozechner/pi-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Tool Schema Adapter — Convert Anthropic format to Pi AI format
// ─────────────────────────────────────────────────────────────────────────────
// Anthropic tools use `input_schema` to describe parameters
// Pi AI tools use `parameters` (TypeBox TSchema format)
// The schema structure is compatible, so we just rename the field

export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export function adaptTool(anthropicTool: AnthropicTool): Tool {
  return {
    name: anthropicTool.name,
    description: anthropicTool.description ?? '',
    parameters: anthropicTool.input_schema as any,  // Both use JSON Schema format
  }
}

export function adaptTools(tools: AnthropicTool[]): Tool[] {
  return tools.map(adaptTool)
}

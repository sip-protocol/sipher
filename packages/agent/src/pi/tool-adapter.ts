import type Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@mariozechner/pi-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Tool Schema Adapter — Bidirectional Anthropic ↔ Pi AI format conversion
// ─────────────────────────────────────────────────────────────────────────────
// Anthropic tools use `input_schema` to describe parameters (JSON Schema)
// Pi AI tools use `parameters` (TypeBox TSchema — compatible with JSON Schema)
// Both directions are a field rename; no schema transformation required.

// Legacy interface kept for backward compatibility with adaptTool consumers
export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

/** @deprecated Use toPiTool with Anthropic.Tool instead */
export function adaptTool(anthropicTool: AnthropicTool): Tool {
  return {
    name: anthropicTool.name,
    description: anthropicTool.description ?? '',
    parameters: anthropicTool.input_schema as never,
  }
}

/** @deprecated Use toPiTools with Anthropic.Tool[] instead */
export function adaptTools(tools: AnthropicTool[]): Tool[] {
  return tools.map(adaptTool)
}

// ─────────────────────────────────────────────────────────────────────────────
// Symmetrical API using SDK types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert an Anthropic SDK Tool to Pi AI Tool format.
 * Both use JSON Schema for parameters — this is a field rename only.
 *
 * Note: Normalizes to a plain {type, properties, required} shape.
 * SIPHER tools use flat object schemas only — no $defs, anyOf, or additionalProperties.
 * If a future tool needs a richer schema, extend this accordingly.
 */
export function toPiTool(anthropicTool: Anthropic.Tool): Tool {
  const schema = anthropicTool.input_schema as {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
  return {
    name: anthropicTool.name,
    description: anthropicTool.description ?? '',
    parameters: {
      type: 'object',
      properties: schema.properties ?? {},
      required: schema.required ?? [],
      // `as never`: Pi's Tool<TParameters> requires a TypeBox-branded TSchema.
      // Plain JSON Schema objects can't satisfy that brand at compile time.
      // Runtime behavior is identical — both serialize to JSON Schema.
    } as never,
  }
}

/** Batch conversion: Anthropic.Tool[] → Pi Tool[]. */
export function toPiTools(anthropicTools: Anthropic.Tool[]): Tool[] {
  return anthropicTools.map(toPiTool)
}

/**
 * Convert a Pi AI Tool to Anthropic SDK Tool format.
 * Used by adapters that interface with Anthropic-only consumers (e.g. HERALD → Anthropic).
 */
export function toAnthropicTool(piTool: Tool): Anthropic.Tool {
  const params = piTool.parameters as unknown as {
    type: string
    properties: Record<string, unknown>
    required?: string[]
  }
  return {
    name: piTool.name,
    description: piTool.description ?? '',
    input_schema: {
      type: 'object',
      properties: params.properties ?? {},
      required: params.required ?? [],
    },
  }
}

/** Batch conversion: Pi Tool[] → Anthropic.Tool[]. */
export function toAnthropicTools(piTools: Tool[]): Anthropic.Tool[] {
  return piTools.map(toAnthropicTool)
}

import type { Tool } from '@mariozechner/pi-ai'

// ─────────────────────────────────────────────────────────────────────────────
// Tool Schema Adapter — Bidirectional Anthropic ↔ Pi AI format conversion
// ─────────────────────────────────────────────────────────────────────────────
// Anthropic tools use `input_schema` to describe parameters (JSON Schema)
// Pi AI tools use `parameters` (TypeBox TSchema — compatible with JSON Schema)
// Both directions are a field rename; no schema transformation required.

/**
 * Anthropic tool format. Local definition to avoid runtime dep on @anthropic-ai/sdk.
 * Matches the structure of Anthropic.Tool exactly.
 */
export interface AnthropicTool {
  name: string
  description?: string
  input_schema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
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
export function toPiTool(anthropicTool: AnthropicTool): Tool {
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

/** Batch conversion: AnthropicTool[] → Pi Tool[]. */
export function toPiTools(anthropicTools: AnthropicTool[]): Tool[] {
  return anthropicTools.map(toPiTool)
}

/**
 * Convert a Pi AI Tool to Anthropic SDK Tool format.
 * Used by adapters that interface with Anthropic-only consumers (e.g. HERALD → Anthropic).
 */
export function toAnthropicTool(piTool: Tool): AnthropicTool {
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

/** Batch conversion: Pi Tool[] → AnthropicTool[]. */
export function toAnthropicTools(piTools: Tool[]): AnthropicTool[] {
  return piTools.map(toAnthropicTool)
}

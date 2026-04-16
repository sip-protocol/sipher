import { Type, type Static } from '@sinclair/typebox'

export const RiskReportSchema = Type.Object({
  risk: Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')]),
  score: Type.Integer({ minimum: 0, maximum: 100 }),
  reasons: Type.Array(Type.String()),
  recommendation: Type.Union([Type.Literal('allow'), Type.Literal('warn'), Type.Literal('block')]),
  blockers: Type.Optional(Type.Array(Type.String())),
})

export type RiskReportParsed = Static<typeof RiskReportSchema>

export interface RiskReport extends RiskReportParsed {
  decisionId: string
  durationMs: number
  staticRuleHit?: string
}

/**
 * Strict validator — returns parsed RiskReportParsed or null on failure.
 * Using TypeBox's Check primitive via @sinclair/typebox/value.
 */
export async function validateRiskReport(raw: unknown): Promise<RiskReportParsed | null> {
  const { Value } = await import('@sinclair/typebox/value')
  return Value.Check(RiskReportSchema, raw) ? (raw as RiskReportParsed) : null
}

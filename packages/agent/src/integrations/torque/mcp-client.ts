import type {
  SipherGrowthEvent,
  TorqueCampaign,
  TorqueEmitResult,
  TorqueMCPClientOptions,
} from './types.js'

const DEFAULT_TIMEOUT_MS = 8000

export class TorqueMCPClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly campaignId: string
  private readonly timeoutMs: number

  constructor(opts: TorqueMCPClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.apiKey = opts.apiKey
    this.campaignId = opts.campaignId
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async emitEvent(event: SipherGrowthEvent): Promise<TorqueEmitResult> {
    const url = `${this.baseUrl}/campaigns/${this.campaignId}/events`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-torque-api-key': this.apiKey,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'auth', message: `Torque rejected api key (${response.status})` }
      }
      if (response.status === 409) {
        return { ok: false, reason: 'duplicate', message: 'Event already ingested (idempotency hit)' }
      }
      if (response.status === 429) {
        return { ok: false, reason: 'rate_limit', message: 'Torque rate limit hit' }
      }
      if (response.status === 410) {
        return { ok: false, reason: 'campaign_inactive', message: 'Campaign no longer active' }
      }
      if (!response.ok) {
        return { ok: false, reason: 'unknown', message: `Torque returned ${response.status}` }
      }
      const json = (await response.json()) as { status?: string; data?: { eventId?: string } }
      const eventId = json?.data?.eventId
      if (json?.status !== 'SUCCESS' || !eventId) {
        return { ok: false, reason: 'unknown', message: 'Torque response missing eventId' }
      }
      return { ok: true, eventId }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, reason: 'network', message }
    }
  }

  async getCampaign(): Promise<TorqueCampaign | null> {
    const url = `${this.baseUrl}/campaigns/${this.campaignId}`
    try {
      const response = await fetch(url, {
        headers: { 'x-torque-api-key': this.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (!response.ok) return null
      const json = (await response.json()) as { status?: string; data?: TorqueCampaign }
      if (json?.status !== 'SUCCESS') return null
      return json.data ?? null
    } catch {
      return null
    }
  }
}

import type {
  SipherGrowthEvent,
  TorqueEmitResult,
  TorqueMCPClientOptions,
  TorquePingResult,
} from './types.js'

const DEFAULT_TIMEOUT_MS = 8000

export class TorqueMCPClient {
  private readonly ingesterUrl: string
  private readonly apiToken: string
  private readonly timeoutMs: number

  constructor(opts: TorqueMCPClientOptions) {
    this.ingesterUrl = opts.ingesterUrl.replace(/\/+$/, '')
    this.apiToken = opts.apiToken
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async emitEvent(event: SipherGrowthEvent): Promise<TorqueEmitResult> {
    const url = `${this.ingesterUrl}/events`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiToken,
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'auth', message: `Torque rejected api token (${response.status})` }
      }
      if (response.status === 429) {
        return { ok: false, reason: 'rate_limit', message: 'Torque rate limit hit' }
      }
      if (response.status === 400) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        const message = body?.message ?? 'Torque returned 400'
        if (/Event not found/i.test(message)) {
          return { ok: false, reason: 'event_undefined', message }
        }
        return { ok: false, reason: 'validation', message }
      }
      if (!response.ok) {
        return { ok: false, reason: 'unknown', message: `Torque returned ${response.status}` }
      }
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, reason: 'network', message }
    }
  }

  /**
   * Reachability ping for ops/admin visibility. POSTs an empty body and treats
   * any 4xx/2xx as reachable (server is up). Network errors → not reachable.
   */
  async pingIngester(): Promise<TorquePingResult> {
    const url = `${this.ingesterUrl}/events`
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiToken,
        },
        body: '{}',
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'auth', message: `Torque rejected api token (${response.status})` }
      }
      // Any other response (including 400 schema rejection) means the host is reachable.
      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, reason: 'network', message }
    }
  }
}

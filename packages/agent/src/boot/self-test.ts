import { getSipherModel } from '../pi/provider.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_TIMEOUT_MS = 5000

export interface SelfTestOptions {
  /** Abort budget for the OpenRouter ping. Default 5000ms. Override in tests. */
  timeoutMs?: number
}

/**
 * Validate the OpenRouter configuration at boot by sending a 2-token ping.
 *
 * Catches the two failure modes that produced silent prod outages in
 * frontier_sip_17:
 *   1. SIPHER_MODEL set to a value pi-ai's registry doesn't know (e.g. the
 *      hyphen-form `claude-sonnet-4-6` instead of dot-form). `getSipherModel`
 *      throws synchronously when the lookup fails.
 *   2. OPENROUTER_API_KEY is empty, expired, or revoked. OpenRouter returns
 *      401 and we surface that here, instead of letting it manifest as
 *      empty assistant responses on the first user chat turn.
 *
 * Throwing here aborts the boot sequence in `packages/agent/src/index.ts`
 * (the throw propagates out of the top-level await). Docker restarts the
 * container; the next boot prints the same error until env is fixed.
 *
 * Skip via `SIPHER_SKIP_BOOT_SELF_TEST=true` for test runs, offline dev,
 * or any environment that legitimately cannot reach OpenRouter at boot.
 */
export async function selfTestOpenRouter(opts: SelfTestOptions = {}): Promise<void> {
  if (process.env.SIPHER_SKIP_BOOT_SELF_TEST === 'true') {
    return
  }

  // Throws synchronously when SIPHER_MODEL is invalid for pi-ai's registry.
  const model = getSipherModel()

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OpenRouter self-test failed: OPENROUTER_API_KEY env var is unset')
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)

  let resp: Response
  try {
    resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: 'pong' }],
        max_tokens: 2,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    if (isAbort) {
      throw new Error(`OpenRouter self-test timed out after ${timeoutMs}ms (no response from ${OPENROUTER_URL})`)
    }
    throw err
  } finally {
    clearTimeout(timeoutHandle)
  }

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => '')).slice(0, 300)
    throw new Error(`OpenRouter self-test failed: HTTP ${resp.status} - ${detail}`)
  }
}

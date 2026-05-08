import { useEffect, useState } from 'react'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const POLL_MS = 5000

interface Tick {
  solUsd: number | null
  slot: number | null
}

export function TickerBar() {
  const [tick, setTick] = useState<Tick>({ solUsd: null, slot: null })

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`)
        if (!res.ok) throw new Error('price fetch failed')
        const json = (await res.json()) as Record<string, { usdPrice: number } | undefined>
        const solUsd = json[SOL_MINT]?.usdPrice ?? null
        if (!cancelled) setTick((prev) => ({ ...prev, solUsd }))
      } catch {
        if (!cancelled) setTick((prev) => ({ ...prev, solUsd: null }))
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="flex items-center gap-3 text-2xs font-mono text-text-secondary">
      <span>
        SOL <span className="text-text">{tick.solUsd != null ? tick.solUsd.toFixed(2) : '—'}</span>
      </span>
      <span className="text-text-muted">·</span>
      <span>
        SLOT <span className="text-text">{tick.slot != null ? tick.slot.toLocaleString() : '—'}</span>
      </span>
    </div>
  )
}

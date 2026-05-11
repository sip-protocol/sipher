import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { Card } from '../components/ui/Card'
import { Chip, type ChipTone } from '../components/ui/Chip'

interface SentinelConfigPayload {
  mode: 'yolo' | 'advisory' | 'off'
  preflightScope: string
  preflightSkipAmount: number
  largeTransferThreshold: number
  threatCheckEnabled: boolean
  blacklistAutonomy: boolean
  cancelWindowMs: number
  rateLimitFundPerHour: number
  rateLimitBlacklistPerHour: number
  scanInterval: number
  activeScanInterval: number
  autoRefundThreshold: number
  model: string
  dailyBudgetUsd: number
  dailyCostUsd: number
  blockOnError: boolean
  fundMovingTools: string[]
}

function modeTone(mode: SentinelConfigPayload['mode']): ChipTone {
  if (mode === 'yolo') return 'danger'
  if (mode === 'advisory') return 'warning'
  return 'neutral'
}

function networkTone(network: string): ChipTone {
  return network === 'mainnet' ? 'cyan' : 'warning'
}

export default function SettingsView() {
  const { token, isAdmin } = useAuthState()
  const navigate = useNavigate()
  const network = useNetworkConfigStore((s) => s.config?.network)
  const [config, setConfig] = useState<SentinelConfigPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    if (!token) return
    const controller = new AbortController()
    apiFetch<SentinelConfigPayload>('/api/sentinel/config', {
      token, signal: controller.signal,
    })
      .then((r) => {
        if (!controller.signal.aborted) setConfig(r)
      })
      .catch((e: unknown) => {
        // AbortError convention aligns with HeraldView/SquadView — the err
        // name is the authoritative signal (works whether the abort came
        // from this effect's controller or an upstream AbortError). The
        // signal.aborted check remains as belt-and-suspenders against
        // unmount races where setError would run after the controller's
        // effect-cleanup fired but before the catch micro-task drained.
        if (e instanceof Error && e.name === 'AbortError') return
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Failed to load config')
        }
      })
    return () => controller.abort()
  }, [isAdmin, token, navigate])

  if (!isAdmin) return null

  return (
    <div className="flex flex-col gap-4">
      <title>SIPHER — Settings</title>
      <meta name="description" content="Configure network, privacy, and admin settings." />
      <meta property="og:title" content="SIPHER — Settings" />
      <meta property="og:description" content="Configure network, privacy, and admin settings." />
      <h1 className="text-sm text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
        SETTINGS — READ-ONLY INSPECTOR
      </h1>

      <Card variant="default" className="p-4 flex flex-col gap-2">
        <div
          className="text-2xs text-text-muted"
          style={{ letterSpacing: 'var(--tracking-widest)' }}
        >
          NETWORK
        </div>
        <div className="flex items-center gap-2">
          <Chip tone={networkTone(network ?? '')}>{network ?? 'unknown'}</Chip>
          <span className="text-xs text-text-muted">Set via SIPHER_NETWORK env var.</span>
        </div>
      </Card>

      {error && (
        <Card role="alert" variant="default" className="p-3">
          <p className="text-xs text-danger">{error}</p>
        </Card>
      )}

      {config && (
        <>
          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              SENTINEL MODE
            </div>
            <div className="flex items-center gap-2">
              <Chip tone={modeTone(config.mode)}>{config.mode}</Chip>
              <span className="text-xs text-text-muted">
                Set via SENTINEL_MODE env var. Restart agent to change.
              </span>
            </div>
          </Card>

          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              PREFLIGHT ENVELOPE
            </div>
            <ConfigRow label="Scope" value={config.preflightScope} />
            <ConfigRow label="Skip amount" value={`${config.preflightSkipAmount} SOL`} />
            <ConfigRow label="Large transfer threshold" value={`${config.largeTransferThreshold} SOL`} />
            <ConfigRow label="Threat check enabled" value={String(config.threatCheckEnabled)} />
            <ConfigRow label="Blacklist autonomy" value={String(config.blacklistAutonomy)} />
            <ConfigRow label="Cancel window" value={`${config.cancelWindowMs / 1000}s`} />
            <ConfigRow label="Rate limit (fund/hr)" value={String(config.rateLimitFundPerHour)} />
            <ConfigRow label="Rate limit (blacklist/hr)" value={String(config.rateLimitBlacklistPerHour)} />
            <ConfigRow label="Scan interval" value={`${config.scanInterval / 1000}s`} />
            <ConfigRow label="Active scan interval" value={`${config.activeScanInterval / 1000}s`} />
            <ConfigRow label="Auto-refund threshold" value={String(config.autoRefundThreshold)} />
          </Card>

          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              LLM COST GUARD
            </div>
            <ConfigRow label="Model" value={config.model} />
            <ConfigRow
              label="Daily spend"
              value={`$${config.dailyCostUsd.toFixed(2)} / $${config.dailyBudgetUsd}`}
            />
            <ConfigRow label="Block on error" value={String(config.blockOnError)} />
          </Card>

          <Card variant="default" className="p-4 flex flex-col gap-2">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              FUND-MOVING TOOLS (SENTINEL preflight required)
            </div>
            <p className="text-xs text-text-muted">
              Hardcoded in preflight-rules.ts; allowlist edits are deferred until audit-log infra lands.
            </p>
            <div className="flex flex-wrap gap-2">
              {config.fundMovingTools.map((tool) => (
                <Chip key={tool} tone="cyan">{tool}</Chip>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <Chip tone="neutral">{value}</Chip>
    </div>
  )
}

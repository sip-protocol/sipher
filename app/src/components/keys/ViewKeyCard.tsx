import { useState } from 'react'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { HashCell } from '../ui/HashCell'
import { Sheet } from '../ui/Sheet'
import { useKeyStore } from '../../stores/keys'
import { useAuthState } from '../../hooks/useAuthState'
import { generateKey, type GenerateKeyResponse } from '../../api/keys'

function downloadBlob(downloadData: { blob: string; filename: string }) {
  const bin = atob(downloadData.blob)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = downloadData.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ViewKeyCard() {
  const hash = useKeyStore((s) => s.hash)
  const setHash = useKeyStore((s) => s.set)
  const { token } = useAuthState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)

  async function doGenerate(): Promise<GenerateKeyResponse | null> {
    if (!token) return null
    setBusy(true)
    setError(null)
    try {
      const result = await generateKey(token)
      setHash(result.hash)
      downloadBlob(result.downloadData)
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate viewing key')
      return null
    } finally {
      setBusy(false)
    }
  }

  function copyHash() {
    if (hash) navigator.clipboard.writeText(hash)
  }

  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ◆ VIEWING KEY
      </div>

      {hash === null ? (
        <>
          <p className="text-sm text-text-muted">
            No viewing key in this session. Generate one to enable selective disclosure.
          </p>
          <button
            type="button"
            onClick={doGenerate}
            disabled={busy || !token}
            className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Chip tone="cyan">Active</Chip>
            <HashCell hash={hash} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyHash}
              className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2"
            >
              Copy hash
            </button>
            <button
              type="button"
              onClick={() => setConfirmRotate(true)}
              disabled={busy}
              className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2 disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Rotate'}
            </button>
          </div>
        </>
      )}

      {error && (
        <Card role="alert" variant="default" className="p-3">
          <p className="text-xs text-danger">{error}</p>
        </Card>
      )}

      {confirmRotate && (
        <Sheet open onClose={() => setConfirmRotate(false)} ariaLabel="Rotate viewing key">
          <div className="p-5 flex flex-col gap-4">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              ROTATE VIEWING KEY
            </div>
            <p className="text-sm text-text-muted">
              Rotating invalidates this key for new payments. Save the old key file if past
              payments still need auditor visibility.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRotate(false)}
                className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmRotate(false)
                  await doGenerate()
                }}
                className="text-xs px-3 py-1.5 rounded-md text-bg font-semibold"
                style={{ background: 'var(--color-warning)' }}
              >
                Confirm rotate
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Card>
  )
}

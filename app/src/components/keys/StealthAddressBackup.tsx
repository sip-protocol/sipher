import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../api/client'
import { useAuthState } from '../../hooks/useAuthState'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Sheet } from '../ui/Sheet'
import { encryptWithPassphrase } from '../../lib/crypto/passphrase-encrypt'

interface StealthIndexResponse {
  tree: Array<{
    index: number
    derivationPath: string
    stealthAddress: string
    parentIndex: number | null
    createdAt: string
  }>
  rootWallet: string
}

function downloadEncryptedBlob(blob: object, filename: string) {
  const json = JSON.stringify(blob, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function StealthAddressBackup() {
  const { publicKey, token } = useAuthState()
  const [data, setData] = useState<StealthIndexResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [encrypting, setEncrypting] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const aborterRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    aborterRef.current = controller
    setLoading(true)
    setError(null)
    apiFetch<StealthIndexResponse>('/api/stealth/index', { token, signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setData(r)
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Failed to load stealth index')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, retryNonce])

  const count = data?.tree.length ?? 0

  async function handleSubmit() {
    if (!data) return
    if (passphrase.length < 8) return
    if (passphrase !== confirm) return
    setEncrypting(true)
    try {
      const plaintext = new TextEncoder().encode(JSON.stringify(data))
      const blob = await encryptWithPassphrase(plaintext, passphrase)
      const wallet8 = (publicKey ?? 'unknown').slice(0, 8)
      const filename = `sipher-stealth-backup-${wallet8}-${Math.floor(Date.now() / 1000)}.enc.json`
      downloadEncryptedBlob(blob, filename)
      setSheetOpen(false)
      setPassphrase('')
      setConfirm('')
    } finally {
      setEncrypting(false)
    }
  }

  return (
    <Card variant="default" className="p-5 flex flex-col gap-4">
      <div
        className="text-2xs text-text-muted"
        style={{ letterSpacing: 'var(--tracking-widest)' }}
      >
        ◆ STEALTH ADDRESS BACKUP
      </div>

      {loading && <p className="text-sm text-text-muted">Loading…</p>}

      {error && !loading && (
        <Card role="alert" variant="default" className="p-3 flex items-center justify-between">
          <p className="text-xs text-danger">{error}</p>
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="text-xs border border-line rounded-md px-2.5 py-1 hover:border-line-2"
          >
            Retry
          </button>
        </Card>
      )}

      {!loading && !error && count === 0 && (
        <p className="text-sm text-text-muted">
          No stealth addresses yet. Make a private deposit to populate this.
        </p>
      )}

      {!loading && !error && count > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Chip tone="cyan">{count} addresses</Chip>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="self-start text-xs px-3 py-1.5 rounded-md text-bg font-semibold"
            style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
          >
            Download encrypted backup
          </button>
        </>
      )}

      {sheetOpen && (
        <Sheet open onClose={() => setSheetOpen(false)} ariaLabel="Encrypt backup">
          <div className="p-5 flex flex-col gap-3">
            <div
              className="text-2xs text-text-muted"
              style={{ letterSpacing: 'var(--tracking-widest)' }}
            >
              ENCRYPT BACKUP
            </div>
            <label className="text-xs text-text-muted">
              Passphrase
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                aria-label="Passphrase"
                className="mt-1 w-full text-xs border border-line rounded-md px-2 py-1 bg-bg-2"
              />
            </label>
            <label className="text-xs text-text-muted">
              Confirm passphrase
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-label="Confirm passphrase"
                className="mt-1 w-full text-xs border border-line rounded-md px-2 py-1 bg-bg-2"
              />
            </label>
            {passphrase.length > 0 && passphrase.length < 8 && (
              <p className="text-xs text-danger">Passphrase must be at least 8 characters.</p>
            )}
            {passphrase.length >= 8 && passphrase.length < 12 && (
              <p className="text-xs text-warning">Use a stronger passphrase for stronger protection.</p>
            )}
            {passphrase !== confirm && confirm.length > 0 && (
              <p className="text-xs text-danger">Passphrases do not match.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="text-xs border border-line rounded-md px-3 py-1.5 hover:border-line-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  encrypting ||
                  passphrase.length < 8 ||
                  passphrase !== confirm
                }
                className="text-xs px-3 py-1.5 rounded-md text-bg font-semibold disabled:opacity-40"
                style={{ background: 'linear-gradient(90deg, var(--color-cyan), var(--color-violet))' }}
              >
                {encrypting ? 'Encrypting…' : 'Encrypt and download'}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </Card>
  )
}

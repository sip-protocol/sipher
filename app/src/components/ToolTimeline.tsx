import { CircleNotch, CheckCircle, XCircle } from '@phosphor-icons/react'
import type { ToolCall } from '../stores/app'

interface Props {
  tools?: ToolCall[]
}

function StatusIcon({ status }: { status: ToolCall['status'] }) {
  if (status === 'running') return <CircleNotch size={11} className="animate-spin text-text-muted" />
  if (status === 'success') return <CheckCircle size={11} weight="fill" className="text-green" />
  return <XCircle size={11} weight="fill" className="text-red" />
}

export default function ToolTimeline({ tools }: Props) {
  if (!tools || tools.length === 0) return null

  return (
    <div className="border-b border-elevated/40 bg-elevated/20 px-3 py-2 flex flex-col gap-1.5">
      {tools.map((t, i) => (
        <div key={`${t.name}-${i}`} className="flex items-center gap-2 text-[10px] font-mono">
          <StatusIcon status={t.status} />
          <span className="text-blue font-semibold">{t.name}</span>
          {t.args && <span className="text-text-muted truncate flex-1">{t.args}</span>}
          {t.durationMs != null && (
            <span className="text-text-muted ml-auto shrink-0">{t.durationMs}ms</span>
          )}
        </div>
      ))}
    </div>
  )
}

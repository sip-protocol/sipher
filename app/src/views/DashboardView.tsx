import type { ActivityEvent } from '../hooks/useSSE'

export default function DashboardView({ events, token }: { events: ActivityEvent[]; token: string | null }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-text">Dashboard</h1>
      <p className="text-text-muted text-sm">Dashboard view coming in Task 6...</p>
    </div>
  )
}

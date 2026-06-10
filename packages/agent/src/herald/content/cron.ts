import { fetchGitHubDigests, formatDigests } from './github-digest.js'
import { themeForDate } from './calendar.js'
import { generateDraft } from './generator.js'
import { enqueueContentPost, hasGeneratedToday } from './enqueue.js'
import { guardianBus } from '../../coordination/event-bus.js'
import { isKillSwitchActive } from '../../routes/squad-api.js'
import { getBudgetStatus } from '../budget.js'

export interface DailyContentDeps {
  isKillSwitchActive: () => boolean
  isPaused: () => boolean
  hasGeneratedToday: typeof hasGeneratedToday
  fetchGitHubDigests: typeof fetchGitHubDigests
  formatDigests: typeof formatDigests
  themeForDate: typeof themeForDate
  generateDraft: typeof generateDraft
  enqueueContentPost: typeof enqueueContentPost
  now: () => Date
}

const defaultDeps: DailyContentDeps = {
  isKillSwitchActive,
  isPaused: () => getBudgetStatus().gate === 'paused',
  hasGeneratedToday,
  fetchGitHubDigests,
  formatDigests,
  themeForDate,
  generateDraft,
  enqueueContentPost,
  now: () => new Date(),
}

export interface DailyContentResult {
  generated: boolean
  id?: string
  reason?: string
}

export async function generateDailyContent(deps: DailyContentDeps = defaultDeps): Promise<DailyContentResult> {
  if (deps.isKillSwitchActive()) {
    return { generated: false, reason: 'kill-switch-active' }
  }
  if (deps.isPaused()) {
    return { generated: false, reason: 'budget-paused' }
  }
  if (deps.hasGeneratedToday()) {
    return { generated: false, reason: 'already-generated-today' }
  }

  const digests = await deps.fetchGitHubDigests()
  const digestText = deps.formatDigests(digests)
  const theme = deps.themeForDate(deps.now())
  const draft = await deps.generateDraft(theme, digestText)

  if (!draft || draft.trim().length === 0) {
    return { generated: false, reason: 'empty-draft' }
  }

  const { id } = deps.enqueueContentPost(draft)

  guardianBus.emit({
    source: 'herald',
    type: 'herald:content-generated',
    level: 'routine',
    data: { id, theme: theme.theme },
    timestamp: deps.now().toISOString(),
  })

  return { generated: true, id }
}

function cronEnabled(): boolean {
  return process.env.HERALD_CONTENT_CRON_ENABLED === 'true'
}

function cronIntervalMs(): number {
  // Hourly check; the same-day guard in generateDailyContent ensures ~one post/day.
  return Number(process.env.HERALD_CONTENT_CRON_INTERVAL ?? '3600000')
}

export function startContentCron(): ReturnType<typeof setInterval> | null {
  if (!cronEnabled()) return null

  const timer = setInterval(() => {
    generateDailyContent().catch((err) => {
      guardianBus.emit({
        source: 'herald',
        type: 'herald:content-failed',
        level: 'important',
        data: { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      })
    })
  }, cronIntervalMs())

  timer.unref()
  return timer
}

export function stopContentCron(timer: ReturnType<typeof setInterval> | null): void {
  if (timer) clearInterval(timer)
}

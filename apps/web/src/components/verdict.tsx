import type { Health, Verdict } from '@/lib/api'

const PILL: Record<Verdict, string> = {
  healthy: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  degraded: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  unstable: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100',
  down: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
  starting: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
  stopped: 'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
}

const DOT: Record<Verdict, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  unstable: 'bg-orange-500',
  down: 'bg-red-500',
  starting: 'bg-blue-500',
  stopped: 'bg-muted-foreground/40',
  unknown: 'bg-muted-foreground/40',
}

export function VerdictPill({ verdict, className = '' }: { verdict: Verdict; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${PILL[verdict]} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${DOT[verdict]}`} />
      {verdict}
    </span>
  )
}

const HEALTH_DOT: Record<Health, string> = {
  healthy: 'bg-emerald-500',
  failed: 'bg-red-500',
  pending: 'bg-amber-500',
  neutral: 'bg-muted-foreground/40',
}

export function StateCell({ state, health }: { state: string; health: Health }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`size-2 shrink-0 rounded-full ${HEALTH_DOT[health]}`} />
      <span className={health === 'failed' ? 'font-medium text-red-600 dark:text-red-400' : ''}>
        {state || 'unknown'}
      </span>
    </span>
  )
}

const RESULT: Record<string, string> = {
  live: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  applied: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
  rolled_back: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
  failed: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100',
}

export function ResultBadge({ result }: { result: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${RESULT[result] ?? 'bg-muted text-muted-foreground'}`}>
      {result.replace('_', ' ')}
    </span>
  )
}

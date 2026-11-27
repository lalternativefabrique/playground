import type { SpaceView, Verdict } from '@/lib/api'

export type AppStatus = 'running' | 'rolling' | 'degraded' | 'down' | 'unstable' | 'starting' | 'stopped' | 'unknown'

export function appStatus(s: SpaceView): AppStatus {
  if (s.rolling) return 'rolling'
  const v: Verdict = s.health.verdict
  return v === 'healthy' ? 'running' : v
}

const DOT: Record<AppStatus, string> = {
  running: 'bg-green-500',
  rolling: 'bg-blue-500',
  degraded: 'bg-amber-500',
  unstable: 'bg-orange-500',
  down: 'bg-red-500',
  starting: 'bg-blue-400',
  stopped: 'bg-zinc-500',
  unknown: 'bg-zinc-500',
}

const BADGE: Record<AppStatus, string> = {
  running: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  rolling: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  degraded: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
  unstable: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
  down: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  starting: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
  stopped: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
  unknown: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
}

export function StatusDot({ status, className = '' }: { status: AppStatus; className?: string }) {
  return <span className={`inline-block size-[9px] shrink-0 rounded-full ${DOT[status]} ${className}`} aria-hidden />
}

export function StatusBadge({ status }: { status: AppStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE[status]}`}>{status}</span>
}

export const NEEDS_ATTENTION: AppStatus[] = ['degraded', 'down', 'unstable']

export function sourceLabel(app: SpaceView) {
  if (!app.repo) return 'deployed from a terminal'
  if (app.repo.pinned) return "node demo, kept through every wipe"
  return app.repo.repo.replace(/^https:\/\/(github\.com\/)?/, '')
}


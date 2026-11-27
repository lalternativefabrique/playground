import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { GitBranch, Plus } from 'lucide-react'
import { ApiError, mine, relativeTime } from '@/lib/api'
import type { SpaceView } from '@/lib/api'
import { Shell, useContext, useOverview } from '@/components/shell'
import { NEEDS_ATTENTION, StatusBadge, StatusDot, appStatus } from '@/components/status'
import { NewAppDialog } from '@/components/new-app-dialog'

export const Route = createFileRoute('/apps/')({ component: AppsPage })

type Filter = 'all' | 'mine' | 'failing'

function AppsPage() {
  const overview = useOverview()
  const ctx = useContext()
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const apps = overview.data?.spaces ?? []
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const mineNames = new Set(mine())
    return apps.filter((s) => {
      if (filter === 'failing' && !NEEDS_ATTENTION.includes(appStatus(s))) return false
      if (filter === 'mine' && !(s.repo && mineNames.has(s.repo.name))) return false
      if (!q) return true
      return [s.name, s.repo?.repo ?? '', ...s.images].some((v) => v.toLowerCase().includes(q))
    })
  }, [apps, query, filter])

  const stats = [
    { label: 'Apps', value: apps.length, tone: '' },
    { label: 'Running', value: apps.filter((s) => appStatus(s) === 'running').length, tone: 'text-green-400' },
    { label: 'Need attention', value: apps.filter((s) => NEEDS_ATTENTION.includes(appStatus(s))).length, tone: 'text-amber-400' },
    { label: 'Rolling', value: apps.filter((s) => s.rolling).length, tone: 'text-blue-400' },
  ]

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Apps</h1>
          <span className="text-[13px] text-muted-foreground">
            Everything this throwaway node runs today. Anyone can add one; all of it is gone at the wipe.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-background"
        >
          <Plus className="size-4" aria-hidden />
          New app
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-1 rounded-xl border bg-panel px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className={`text-[22px] font-bold ${s.tone}`}>{overview.isSuccess ? s.value : '–'}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="search" className="sr-only">
          Search apps
        </label>
        <input
          id="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps, repos, images…"
          className="h-[38px] max-w-[420px] flex-[1_1_280px] rounded-lg border border-input bg-panel px-3 text-sm placeholder:text-faint"
        />
        <div role="group" aria-label="Filter" className="flex gap-1.5">
          {(['all', 'mine', 'failing'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`h-[34px] rounded-full border px-3 text-[13px] capitalize ${
                filter === f ? 'border-zinc-600 bg-accent text-foreground' : 'border-input text-muted-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {overview.isPending && <p className="text-sm text-muted-foreground">Reading the node…</p>}
      {overview.isError && (
        <p role="alert" className="rounded-xl border border-red-900 p-4 text-sm text-red-300">
          {overview.error instanceof ApiError ? overview.error.message : 'The node is unreachable.'} It may be wiping; try
          again in a minute.
        </p>
      )}
      {overview.isSuccess && apps.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
          <span className="font-semibold">The node runs nothing yet.</span>
          <span className="text-sm text-muted-foreground">Deploy a public repo and be the first today.</span>
          <button type="button" onClick={() => setCreating(true)} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-background">
            New app
          </button>
        </div>
      )}
      {overview.isSuccess && apps.length > 0 && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">No app matches.</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
        {shown.map((s) => (
          <AppCard key={s.name} app={s} />
        ))}
      </div>

      {creating && <NewAppDialog ctx={ctx.data} onClose={() => setCreating(false)} />}
    </Shell>
  )
}

function AppCard({ app }: { app: SpaceView }) {
  const status = appStatus(app)
  return (
    <Link
      to="/apps/$app"
      params={{ app: app.name }}
      className="flex flex-col gap-3 rounded-2xl border bg-panel p-4 hover:border-zinc-600 focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="flex items-center gap-2.5">
        <StatusDot status={status} />
        <span className="truncate text-[15px] font-semibold">{app.name}</span>
        <span className="ml-auto">
          <StatusBadge status={status} />
        </span>
      </div>
      <span className="truncate text-[13px] text-brand-soft">{app.url ? app.url.replace(/^https?:\/\//, '') : 'no public URL'}</span>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate font-mono">{app.repo ? app.repo.repo.replace(/^https:\/\/(github\.com\/)?/, '') : 'not from a followed repo'}</span>
        </span>
        <span className="truncate font-mono">{app.images.join(', ') || '—'}</span>
      </div>
      <div className="flex items-center gap-2 border-t pt-2.5 text-xs text-muted-foreground">
        <span>{app.health.label}</span>
        {app.repo && <span className="ml-auto">followed {relativeTime(app.repo.added_at)}</span>}
      </div>
    </Link>
  )
}

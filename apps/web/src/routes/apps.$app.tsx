import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, RotateCw } from 'lucide-react'
import { ApiError, api, relativeTime } from '@/lib/api'
import type { ServiceView, SpaceView } from '@/lib/api'
import { Shell, useContext } from '@/components/shell'
import { StatusBadge, StatusDot, appStatus, sourceLabel } from '@/components/status'
import { Tabs } from '@/components/tabs'
import { LogsPanel } from '@/components/logs-panel'
import { CopyableCommand } from '@/components/copyable-command'

type Tab = 'overview' | 'deployments' | 'logs' | 'terminal' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'logs', label: 'Logs' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'settings', label: 'Settings' },
]

export const Route = createFileRoute('/apps/$app')({ component: AppPage })

function AppPage() {
  const { app: name } = Route.useParams()
  const app = useQuery({ queryKey: ['app', name], queryFn: () => api.space(name), refetchInterval: 5_000 })
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <Shell>
      <nav aria-label="Breadcrumb" className="flex gap-2 text-[13px] text-muted-foreground">
        <Link to="/apps" className="hover:text-foreground">
          Apps
        </Link>
        <span>/</span>
        <span className="text-foreground">{name}</span>
      </nav>
      {app.isPending && <p className="text-sm text-muted-foreground">Reading the node…</p>}
      {app.isError && (
        <p role="alert" className="rounded-xl border border-red-300 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300">
          {app.error instanceof ApiError && app.error.status === 404
            ? `No app named ${name} runs on the node: it may have been wiped.`
            : 'The node is unreachable.'}
        </p>
      )}
      {app.data && (
        <>
          <Header app={app.data} />
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="App" />
          {tab === 'overview' && <Overview app={app.data} />}
          {tab === 'deployments' && <Deployments app={app.data} />}
          {tab === 'logs' && <Logs app={app.data} />}
          {tab === 'terminal' && <Terminal app={app.data} />}
          {tab === 'settings' && <Settings app={app.data} />}
        </>
      )}
    </Shell>
  )
}

function Header({ app }: { app: SpaceView }) {
  const status = appStatus(app)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3.5">
        <StatusDot status={status} className="size-[11px]" />
        <h1 className="text-2xl font-bold">{app.name}</h1>
        <StatusBadge status={status} />
        {app.url && (
          <a
            href={app.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-[38px] items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-brand-foreground"
          >
            Open app <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
      <span className="text-[13px] text-muted-foreground">
        <span className={app.repo && !app.repo.pinned ? 'font-mono' : ''}>{sourceLabel(app)}</span>
        {app.repo && !app.repo.pinned && <> · {app.repo.branch}</>}{' '}
        · {app.health.label}
      </span>
    </div>
  )
}

function Overview({ app }: { app: SpaceView }) {
  const watch = app.watches?.[0]
  const cards = [
    { label: 'URL', value: app.url ? app.url.replace(/^https?:\/\//, '') : '—' },
    { label: 'Services', value: `${app.health.up}/${app.health.total} up` },
    { label: 'Image watch', value: watch ? `${watch.service} ${watch.tag_pattern || 'any tag'}` : 'none' },
    { label: 'Last check', value: watch?.last_checked_at ? relativeTime(watch.last_checked_at) : '—' },
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-1 rounded-xl border bg-panel px-4 py-3.5">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <span className="truncate text-sm font-semibold">{c.value}</span>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Service</th>
              <th className="px-4 py-2.5 font-medium">State</th>
              <th className="px-4 py-2.5 font-medium">Image</th>
              <th className="px-4 py-2.5 font-medium">Route</th>
              <th className="px-4 py-2.5 font-medium">Up since</th>
              <th className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(app.services ?? []).map((s) => (
              <ServiceRow key={s.name} app={app.name} service={s} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const HEALTH_DOT = { healthy: 'bg-green-500', pending: 'bg-amber-500', failed: 'bg-red-500', neutral: 'bg-zinc-500' }

function ServiceRow({ app, service }: { app: string; service: ServiceView }) {
  const queryClient = useQueryClient()
  const restart = useMutation({
    mutationFn: () => api.restart(app, service.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app', app] }),
  })
  return (
    <tr className="border-t">
      <td className="px-4 py-3 font-semibold">
        {service.name}
        {service.oneshot && <span className="ml-2 text-xs font-normal text-muted-foreground">job</span>}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-2">
          <span className={`size-2 rounded-full ${HEALTH_DOT[service.health]}`} />
          <span className={service.health === 'failed' ? 'font-medium text-red-600 dark:text-red-400' : ''}>{service.state}</span>
        </span>
        {service.restarts > 0 && <span className="ml-2 text-xs text-muted-foreground">restarted {service.restarts}×</span>}
      </td>
      <td className="px-4 py-3 font-mono text-[12.5px]">{service.image}</td>
      <td className="px-4 py-3 font-mono text-[12.5px]">
        {service.routes.length ? service.routes.join(', ') : service.port ? `:${service.port}` : '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{relativeTime(service.since)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => restart.mutate()}
          disabled={restart.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-raised px-3 text-xs font-medium hover:bg-accent disabled:opacity-60"
          title={restart.isError ? (restart.error).message : undefined}
        >
          <RotateCw className="size-3.5" aria-hidden />
          {restart.isPending ? 'Restarting…' : restart.isError ? 'Refused' : 'Restart'}
        </button>
      </td>
    </tr>
  )
}

type Rollout = {
  key: string
  service: string
  from: string
  to: string
  result: string
  reason?: string
  started: string
  finished?: string
  source: 'rollout' | 'watch'
}

function tag(image: string) {
  const i = image.lastIndexOf(':')
  return i > 0 && !image.slice(i).includes('/') ? image.slice(i + 1) : image
}

function seconds(from: string, to?: string) {
  if (!to) return undefined
  const s = (new Date(to).getTime() - new Date(from).getTime()) / 1000
  return Number.isFinite(s) && s >= 0 ? s : undefined
}

function fmt(s?: number) {
  if (s === undefined) return ''
  return s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
}

const OUTCOME: Record<string, { label: string; tone: string; story: (r: Rollout) => string }> = {
  succeeded: {
    label: 'kept',
    tone: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    story: (r) =>
      `Started next to the old version, took all the traffic once ready, held through the soak, then the old one was retired${r.finished ? ` (${fmt(seconds(r.started, r.finished))} in all)` : ''}.`,
  },
  live: {
    label: 'kept',
    tone: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    story: () => 'The new tag held through the soak and stays.',
  },
  rolled_back: {
    label: 'rolled back',
    tone: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300',
    story: (r) =>
      `The new version failed while it was being watched; traffic went straight back to the previous one, which had never been stopped${r.reason ? `: ${r.reason}` : '.'}`,
  },
  failed: {
    label: 'failed',
    tone: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    story: (r) => `The new version never became ready; the old one kept serving${r.reason ? `: ${r.reason}` : '.'}`,
  },
  applied: {
    label: 'applied',
    tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    story: () => 'Applied; the outcome is not settled yet.',
  },
}

const ROLLING = {
  label: 'rolling',
  tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  story: () => 'In progress: the new version starts next to the old one, then takes the traffic once ready.',
}

function Deployments({ app }: { app: SpaceView }) {
  const rollouts: Rollout[] = [
    ...(app.services ?? []).flatMap((s) =>
      s.rollouts.map((r) => ({
        key: `rollout-${s.name}-${r.started_at}`,
        service: s.name,
        from: tag(r.from_image),
        to: tag(r.to_image),
        result: r.result,
        reason: r.reason,
        started: r.started_at,
        finished: r.finished_at && !r.finished_at.startsWith('0001') ? r.finished_at : undefined,
        source: 'rollout' as const,
      })),
    ),
    ...(app.watches ?? []).flatMap((w) =>
      w.rolls.map((r) => ({
        key: `roll-${w.name}-${r.created_at}`,
        service: w.service,
        from: r.from_tag,
        to: r.to_tag,
        result: r.result,
        reason: r.error,
        started: r.created_at,
        finished: r.finished_at,
        source: 'watch' as const,
      })),
    ),
  ].sort((a, b) => b.started.localeCompare(a.started))

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 rounded-xl border bg-panel p-4.5 md:grid-cols-3">
        {[
          ['1 · Start beside it', 'The new version starts next to the one serving. Visitors stay on the old one meanwhile.'],
          ['2 · Switch at once', 'As soon as it answers its health check, all traffic moves to it in one go. No mix of versions.'],
          ['3 · Keep watching', 'For a soak window the old version stays ready, without traffic. If the new one falls, traffic goes back to it on its own.'],
        ].map(([title, body]) => (
          <div key={title} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">{title}</span>
            <span className="text-[12.5px] leading-relaxed text-muted-foreground">{body}</span>
          </div>
        ))}
      </section>

      {rollouts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No rollout yet. Push a new image tag in <code className="font-mono">.sklp/</code>, or add an image watch, and it
          shows up here.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {rollouts.map((r) => {
            const o = r.finished || r.source === 'watch' ? (OUTCOME[r.result] ?? ROLLING) : ROLLING
            return (
              <li key={r.key} className="flex flex-col gap-2 rounded-xl border px-4.5 py-3.5">
                <div className="flex flex-wrap items-center gap-2.5 text-[13.5px]">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${o.tone}`}>{o.label}</span>
                  <span className="font-semibold">{r.service}</span>
                  <span className="font-mono text-[12.5px]">
                    {r.from} → {r.to}
                  </span>
                  <span className="ml-auto text-[12.5px] text-muted-foreground">
                    {relativeTime(r.started)}
                    {r.finished && ` · ${fmt(seconds(r.started, r.finished))}`}
                  </span>
                </div>
                <span className="text-[13px] leading-relaxed text-muted-foreground">{o.story(r)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Logs({ app }: { app: SpaceView }) {
  const services = app.services ?? []
  const [service, setService] = useState(services[0]?.name)
  if (!service) return <p className="text-sm text-muted-foreground">No service to read.</p>
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <label htmlFor="svc" className="text-[13px] text-muted-foreground">
          Service
        </label>
        <select
          id="svc"
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="h-[34px] rounded-lg border border-input bg-raised px-2.5 text-[13px]"
        >
          {services.map((s) => (
            <option key={s.name}>{s.name}</option>
          ))}
        </select>
      </div>
      <LogsPanel space={app.name} service={service} />
    </div>
  )
}

function Terminal({ app }: { app: SpaceView }) {
  const ctx = useContext()
  const name = ctx.data?.name ?? 'demo'
  const service = app.services?.[0]?.name ?? '<service>'
  const login = ctx.data
    ? `sklp deploy login -context ${name} -server ${ctx.data.server} -token ${ctx.data.token} -ca-fingerprint ${ctx.data.ca_fingerprint}`
    : 'reading the node…'
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <span className="text-[13px] text-muted-foreground">
        From your machine, with sklp installed (Connect page, step 1). Run step 1 once; it saves the “{name}” context
        every other command uses.
      </span>
      <CopyableCommand label="1 · Connect to this node (once)" cmd={login} />
      <CopyableCommand label="2 · Follow the logs" cmd={`sklp deploy logs ${service} -f -space ${app.name} -context ${name}`} />
      <CopyableCommand label="3 · Open a shell" cmd={`sklp deploy exec -space ${app.name} -context ${name} ${service} -- sh`} />
    </div>
  )
}

function Settings({ app }: { app: SpaceView }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const unfollow = useMutation({
    mutationFn: () => api.unfollow(app.repo!.name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['overview'] })
      await navigate({ to: '/apps' })
    },
  })
  const fields = [
    { label: 'Source', value: app.repo?.repo ?? '—' },
    { label: 'Branch', value: app.repo?.branch ?? '—' },
    { label: 'Followed as', value: app.repo?.name ?? '—' },
    { label: 'URL', value: app.url ?? '—' },
  ]
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="grid gap-3.5 rounded-xl border bg-panel p-4.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{f.label}</span>
            <span className="truncate font-mono text-[13px]">{f.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[12.5px] text-faint">
        Volumes live until the wipe and are never backed up. Settings come from the repo: change{' '}
        <code className="font-mono">.sklp/</code> and push, the node applies it.
      </p>
      {app.repo?.pinned && (
        <p className="rounded-xl border px-4.5 py-4 text-[13px] text-muted-foreground">
          This app is one of the node's own demos: it cannot be unfollowed, and it comes back after every wipe.
        </p>
      )}
      {app.repo && !app.repo.pinned && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-300 dark:border-red-900 px-4.5 py-4">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Stop following this repo</span>
            <span className="text-[12.5px] text-muted-foreground">
              New commits are no longer applied. The app and its data are deleted at the wipe either way.
            </span>
          </div>
          <button
            type="button"
            onClick={() => unfollow.mutate()}
            disabled={unfollow.isPending}
            className="ml-auto h-[38px] rounded-lg border border-red-400 dark:border-red-700 px-3.5 text-[13px] font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-60"
          >
            {unfollow.isPending ? 'Unfollowing…' : 'Unfollow'}
          </button>
          {unfollow.isError && (
            <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
              {(unfollow.error).message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

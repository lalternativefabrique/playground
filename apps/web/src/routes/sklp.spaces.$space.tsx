import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { ApiError, api, relativeTime } from '@/lib/api'
import type { ServiceView, SpaceView, Watch } from '@/lib/api'
import { TopBar } from '@/components/top-bar'
import { ResultBadge, StateCell, VerdictPill } from '@/components/verdict'
import { CopyableCommand } from '@/components/copyable-command'
import { LogsPanel } from '@/components/logs-panel'

export const Route = createFileRoute('/sklp/spaces/$space')({ component: SpacePage })

const POLL_MS = 5_000

function SpacePage() {
  const { space: name } = Route.useParams()
  const space = useQuery({ queryKey: ['space', name], queryFn: () => api.space(name), refetchInterval: POLL_MS })
  const [logsOf, setLogsOf] = useState<string>()

  return (
    <div className="min-h-screen">
      <TopBar node={space.data ? 'demo' : undefined} />
      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-16 pt-8">
        <nav aria-label="Breadcrumb" className="flex gap-2 text-sm text-muted-foreground">
          <Link to="/sklp" className="hover:text-foreground">
            Spaces
          </Link>
          <span>/</span>
          <span className="text-foreground">{name}</span>
        </nav>

        {space.isPending && <p className="text-sm text-muted-foreground">Reading the node…</p>}
        {space.error && (
          <p className="rounded-lg border p-4 text-sm text-red-700 dark:text-red-300">
            {space.error instanceof ApiError && space.error.status === 404
              ? `No deploy named ${name} runs on the node: it may have been reset.`
              : 'The demo node is unreachable.'}
          </p>
        )}
        {space.data && (
          <SpaceDetail space={space.data} logsOf={logsOf ?? space.data.services?.[0]?.name} onLogs={setLogsOf} />
        )}
      </main>
    </div>
  )
}

function SpaceDetail({
  space,
  logsOf,
  onLogs,
}: {
  space: SpaceView
  logsOf?: string
  onLogs: (service: string) => void
}) {
  const services = space.services ?? []
  return (
    <>
      <section className="flex flex-wrap items-center gap-4">
        <VerdictPill verdict={space.rolling ? 'starting' : space.health.verdict} className="w-24 justify-center" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{space.name}</h1>
          <p className="text-sm text-muted-foreground">
            {space.repo ? (
              <>
                followed from <a href={space.repo.repo} className="font-mono underline">{space.repo.repo.replace(/^https:\/\//, '')}</a>{' '}
                · {space.repo.branch}
              </>
            ) : (
              'not from a followed repo'
            )}{' '}
            · {space.rolling ? 'rolling a new image' : space.health.label}
          </p>
        </div>
        {space.url && (
          <a
            href={space.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Open {space.url.replace(/^https?:\/\//, '')}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Services</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Service</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">Image</th>
                <th className="px-4 py-2 font-medium">Route</th>
                <th className="px-4 py-2 font-medium">Up since</th>
                <th className="px-4 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <ServiceRow key={s.name} service={s} selected={s.name === logsOf} onLogs={() => onLogs(s.name)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-wrap gap-6">
        <div className="min-w-0 flex-[999_1_560px]">
          {logsOf && <LogsPanel space={space.name} service={logsOf} />}
        </div>
        <div className="min-w-0 flex-[1_1_340px]">
          <Versions watches={space.watches ?? []} services={services} />
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-muted/50 p-5">
        <h2 className="text-sm font-semibold">The same from your terminal</h2>
        <CopyableCommand label="this space" cmd={`sklp deploy get ${space.name} -context demo`} />
        {logsOf && (
          <>
            <CopyableCommand label="follow logs" cmd={`sklp deploy logs ${logsOf} -f -space ${space.name} -context demo`} />
            <CopyableCommand label="shell in" cmd={`sklp deploy exec -space ${space.name} -context demo ${logsOf} -- sh`} />
          </>
        )}
      </section>
    </>
  )
}

function ServiceRow({ service, selected, onLogs }: { service: ServiceView; selected: boolean; onLogs: () => void }) {
  return (
    <tr className={`border-t ${selected ? 'bg-accent/50' : ''}`}>
      <td className="px-4 py-3 font-semibold">
        {service.name}
        {service.oneshot && <span className="ml-2 text-xs font-normal text-muted-foreground">job</span>}
      </td>
      <td className="px-4 py-3">
        <StateCell state={service.state} health={service.health} />
        {service.restarts > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">restarted {service.restarts}×</span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs">{service.image}</td>
      <td className="px-4 py-3 font-mono text-xs">
        {service.routes.length > 0 ? service.routes.join(', ') : service.port ? `:${service.port}` : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(service.since)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onLogs}
          aria-pressed={selected}
          className="h-9 rounded-md border px-3 text-xs font-semibold hover:bg-accent"
        >
          Logs
        </button>
      </td>
    </tr>
  )
}

function Versions({ watches, services }: { watches: Watch[]; services: ServiceView[] }) {
  const rollouts = services.flatMap((s) => s.rollouts.map((r) => ({ ...r, service: s.name }))).reverse()
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Versions the node rolled</h2>
      {watches.length === 0 && rollouts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No image watch for this space. Add a <code className="font-mono">.sklp/image-watches.yaml</code> to your repo
          and the node rolls new tags on its own.
        </p>
      )}
      {watches.map((w) => (
        <div key={w.name} className="rounded-lg border">
          <div className="flex flex-wrap items-baseline gap-2 border-b px-4 py-2 text-sm">
            <span className="font-semibold">{w.service}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {w.image}:{w.current_tag || '?'}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {w.status === 'rolling' ? 'rolling' : `checked ${relativeTime(w.last_checked_at) || 'not yet'}`}
            </span>
          </div>
          <ol className="divide-y">
            {w.rolls.length === 0 && <li className="px-4 py-2 text-xs text-muted-foreground">No roll yet.</li>}
            {w.rolls.map((r) => (
              <li key={r.created_at + r.to_tag} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                <span className="font-mono">
                  {r.from_tag} → {r.to_tag}
                </span>
                <ResultBadge result={r.result} />
                <span className="ml-auto text-muted-foreground">{relativeTime(r.created_at)}</span>
              </li>
            ))}
          </ol>
          {w.held_tag && (
            <p className="border-t px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
              {w.held_tag} was rolled back; the node skips it until a newer tag appears.
            </p>
          )}
        </div>
      ))}
      {watches.length === 0 && rollouts.length > 0 && (
        <ol className="divide-y rounded-lg border">
          {rollouts.map((r) => (
            <li key={r.started_at + r.service} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
              <span className="font-semibold">{r.service}</span>
              <span className="font-mono">{r.to_image}</span>
              <ResultBadge result={r.result} />
              <span className="ml-auto text-muted-foreground">{relativeTime(r.started_at)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">
        The node checks the registry every 2 minutes, soaks a new tag before keeping it, and rolls back one that falls.
      </p>
    </div>
  )
}

import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ExternalLink, Trash2 } from 'lucide-react'
import { ApiError, api, relativeTime } from '@/lib/api'
import type { Follow, PublicContext, SpaceView } from '@/lib/api'
import { TopBar } from '@/components/top-bar'
import { VerdictPill } from '@/components/verdict'
import { CopyableCommand } from '@/components/copyable-command'

export const Route = createFileRoute('/')({ component: DemoPage })

const POLL_MS = 10_000
const STARTER = 'https://github.com/lalternativefabrique/sklp-demo-starter'

function DemoPage() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: POLL_MS })
  const context = useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: Infinity })

  return (
    <div className="min-h-screen">
      <TopBar node={overview.data?.node} />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-16 pt-12">
        <section className="flex max-w-3xl flex-col gap-3">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Deploy a repo onto a real node.</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Paste a public Git repo that holds a <code className="rounded bg-muted px-1.5 font-mono text-sm">.sklp/</code>{' '}
            folder. This node follows it on its own: every commit is applied, every new image tag it watches is
            rolled, soaked and rolled back if it fails. No central server is involved.
          </p>
        </section>

        <section className="flex flex-wrap gap-6">
          <FollowForm />
          <CliCard ctx={context.data} />
        </section>

        <AgentCard />

        <SpacesSection
          spaces={overview.data?.spaces}
          loading={overview.isPending}
          error={overview.error}
        />

        <FollowsSection follows={overview.data?.follows ?? []} spaces={overview.data?.spaces ?? []} />

        <Rules />
      </main>
    </div>
  )
}

function FollowForm() {
  const queryClient = useQueryClient()
  const [repo, setRepo] = useState('')
  const [name, setName] = useState('')
  const follow = useMutation({
    mutationFn: () => api.follow(repo.trim(), name.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['overview'] }),
  })

  return (
    <form
      className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 rounded-lg border p-6"
      onSubmit={(e) => {
        e.preventDefault()
        follow.mutate()
      }}
    >
      <label htmlFor="repo" className="text-sm font-semibold">
        Public Git repo
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="repo"
          required
          value={repo}
          onChange={(e) => {
            setRepo(e.target.value)
            follow.reset()
          }}
          placeholder="https://github.com/you/your-app"
          className="h-11 min-w-0 flex-[1_1_320px] rounded-md border border-input bg-transparent px-3 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={follow.isPending}
          className="h-11 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {follow.isPending ? 'Following…' : 'Follow'}
        </button>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Name it yourself</summary>
        <label htmlFor="follow-name" className="mt-2 block text-xs text-muted-foreground">
          Follow name (defaults to the repo name; it must be free on the node)
        </label>
        <input
          id="follow-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-app"
          className="mt-1 h-10 w-full max-w-xs rounded-md border border-input bg-transparent px-3 font-mono text-sm"
        />
      </details>
      <div role="status" aria-live="polite" className="text-sm">
        {follow.isSuccess && (
          <p className="text-emerald-700 dark:text-emerald-400">
            Following <span className="font-mono">{follow.data.name}</span>. The first pass lands within seconds; your
            space shows up below.
          </p>
        )}
        {follow.isError && (
          <p className="text-red-600 dark:text-red-400">
            {follow.error instanceof ApiError ? follow.error.message : 'The demo did not answer.'}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        No repo at hand? Fork <a className="underline" href={STARTER}>sklp-demo-starter</a>, rename its space and host,
        paste your fork.
      </p>
    </form>
  )
}

function CliCard({ ctx }: { ctx?: PublicContext }) {
  const login = ctx
    ? `sklp deploy login -context ${ctx.name} -server ${ctx.server} -token ${ctx.token} -ca-fingerprint ${ctx.ca_fingerprint}`
    : 'sklp deploy login -context demo …'
  return (
    <aside className="flex min-w-0 flex-[1_1_380px] flex-col gap-3 rounded-lg bg-muted/50 p-6">
      <h2 className="text-sm font-semibold">Or from your terminal</h2>
      <CopyableCommand label="install" cmd="curl -fsSL https://api.skalpai.dev/install/sklp.sh | sh" />
      <CopyableCommand label="connect" cmd={login} />
      <CopyableCommand label="follow" cmd={`sklp deploy follow https://github.com/you/your-app -context ${ctx?.name ?? 'demo'}`} />
      <p className="text-xs text-muted-foreground">
        Then <code className="font-mono">sklp deploy ls</code>, <code className="font-mono">logs</code> and{' '}
        <code className="font-mono">exec</code> work against this node with <code className="font-mono">-context demo</code>.
      </p>
    </aside>
  )
}

function AgentCard() {
  const mcp = '{"mcpServers":{"sklp":{"command":"sklp","args":["mcp","-context","demo"]}}}'
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-6">
      <h2 className="text-sm font-semibold">Or let your agent do it</h2>
      <p className="text-sm text-muted-foreground">
        Once connected, <code className="font-mono">sklp mcp</code> gives your coding agent this node: it can follow a
        repo, read the spaces and their logs, and deploy. Add it to your <code className="font-mono">.mcp.json</code>:
      </p>
      <CopyableCommand label=".mcp.json" cmd={mcp} />
      <CopyableCommand
        label="ask"
        cmd="Use the sklp MCP server to have the demo node follow https://github.com/<me>/<repo>, then show me its spaces once it is up."
      />
    </section>
  )
}

function SpacesSection({ spaces, loading, error }: { spaces?: SpaceView[]; loading: boolean; error: Error | null }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-xl font-bold">Spaces on the node</h2>
        {spaces && (
          <span className="text-sm text-muted-foreground">
            {spaces.length} {spaces.length === 1 ? 'space' : 'spaces'}
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">refreshed every 10 s</span>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Reading the node…</p>}
      {error && (
        <p className="rounded-lg border border-red-200 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300">
          {error instanceof ApiError ? error.message : 'The demo node is unreachable.'} It may be resetting; try again in a
          minute.
        </p>
      )}
      {spaces?.length === 0 && (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          The node runs nothing yet. Follow a repo above and be the first.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {spaces?.map((s) => <SpaceRow key={s.name} space={s} />)}
      </div>
    </section>
  )
}

function SpaceRow({ space }: { space: SpaceView }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 transition-colors hover:bg-accent/50">
      <VerdictPill verdict={space.rolling ? 'starting' : space.health.verdict} className="w-24 justify-center" />
      <Link
        to="/spaces/$space"
        params={{ space: space.name }}
        className="flex min-w-48 flex-col gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-semibold">{space.name}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {space.repo ? space.repo.repo.replace(/^https:\/\//, '') : 'not from a followed repo'}
        </span>
      </Link>
      <span className="truncate font-mono text-xs text-muted-foreground">{space.images.join(', ')}</span>
      <span className="ml-auto flex shrink-0 flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>{space.rolling ? 'rolling a new image' : space.health.label}</span>
        {space.url && (
          <a href={space.url} className="inline-flex items-center gap-1 text-foreground underline" target="_blank" rel="noreferrer">
            {space.url.replace(/^https?:\/\//, '')}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        <Link to="/spaces/$space" params={{ space: space.name }} aria-label={`Open ${space.name}`} className="p-1">
          <ChevronRight className="size-4" />
        </Link>
      </span>
    </div>
  )
}

function FollowsSection({ follows, spaces }: { follows: Follow[]; spaces: SpaceView[] }) {
  const queryClient = useQueryClient()
  const unfollow = useMutation({
    mutationFn: api.unfollow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['overview'] }),
  })
  if (follows.length === 0) return null
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Followed repos</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Repo</th>
              <th className="px-4 py-2 font-medium">Branch</th>
              <th className="px-4 py-2 font-medium">Spaces</th>
              <th className="px-4 py-2 font-medium">Since</th>
              <th className="px-4 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {follows.map((f) => (
              <tr key={f.name} className="border-t">
                <td className="px-4 py-2 font-mono">{f.name}</td>
                <td className="px-4 py-2 font-mono text-xs">
                  <a href={f.repo} className="underline">{f.repo.replace(/^https:\/\//, '')}</a>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{f.branch}</td>
                <td className="px-4 py-2 text-xs">
                  {spaces.filter((s) => s.repo?.name === f.name).map((s) => s.name).join(', ') || '—'}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{relativeTime(f.added_at)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => unfollow.mutate(f.name)}
                    disabled={unfollow.isPending}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Unfollow
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Unfollowing stops the node from applying new commits; the spaces it already runs stay until the next reset.
      </p>
    </section>
  )
}

function Rules() {
  const rules: [string, string][] = [
    ['Everything is public.', 'Anyone sees every space, its logs, and can open a shell in it.'],
    ['First come, first served.', 'A follow name, a space or a host already taken is refused: pick another.'],
    ['Public repos and images, no secrets.', 'What you deploy here, others can read.'],
    ['Wiped every evening at 20:00.', 'Every space and every follow is removed; follow your repo again the next day.'],
  ]
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5 border-t pt-6 text-sm leading-relaxed text-muted-foreground">
      {rules.map(([title, body]) => (
        <p key={title}>
          <strong className="text-foreground">{title}</strong> {body}
        </p>
      ))}
    </section>
  )
}

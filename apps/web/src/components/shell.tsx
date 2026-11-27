import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BookOpen, GitBranch, LayoutGrid, Server } from 'lucide-react'
import type { ReactNode } from 'react'
import { api, formatDuration } from '@/lib/api'

const POLL_MS = 10_000

export function useOverview() {
  return useQuery({ queryKey: ['overview'], queryFn: api.overview, refetchInterval: POLL_MS })
}

export function useContext() {
  return useQuery({ queryKey: ['context'], queryFn: api.context, staleTime: 60_000 })
}

function useWipeIn(at?: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!at) return undefined
  return formatDuration(Math.max(0, new Date(at).getTime() - now))
}

const NAV = [
  { to: '/apps', label: 'Apps', icon: LayoutGrid },
  { to: '/sources', label: 'Sources', icon: GitBranch },
  { to: '/node', label: 'Node', icon: Server },
] as const

export function Shell({ children }: { children: ReactNode }) {
  const overview = useOverview()
  const ctx = useContext()
  const wipeIn = useWipeIn(ctx.data?.wipes_at)
  const online = overview.isSuccess

  return (
    <div className="flex min-h-screen flex-col">
      <div
        role="note"
        className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-amber-700 bg-[#3a2a06] px-6 py-2.5 text-[13.5px] text-amber-200"
      >
        <AlertTriangle className="size-[18px] shrink-0 text-amber-400" aria-hidden />
        <strong className="text-amber-50">Playground: everything here is thrown away.</strong>
        <span>
          Every app, log and follow is wiped daily at {ctx.data?.wipe_label ?? '20:00'}. Nothing is backed up, nothing is
          production-ready, and anyone can see or break what you deploy. No real data, no secrets.
        </span>
        {wipeIn && <span className="ml-auto whitespace-nowrap font-semibold text-amber-50">Wipe in {wipeIn}</span>}
      </div>
      <div className="flex flex-1 flex-wrap">
        <aside className="flex min-w-[200px] max-w-[260px] flex-[1_1_232px] flex-col gap-1.5 border-r bg-panel px-3.5 py-5">
          <Link to="/apps" className="flex items-center gap-2.5 px-2 pb-4 pt-1">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-brand font-bold text-background">p</span>
            <span className="text-[15px] font-semibold">playground</span>
          </Link>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground"
                activeProps={{ className: 'bg-accent font-medium text-foreground' }}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
            <a
              href="https://sklp.skalpai.dev/docs/"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <BookOpen className="size-4" aria-hidden />
              Docs
            </a>
          </nav>
          <div className="mt-auto flex flex-col gap-1.5 rounded-xl border p-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span className={`size-2 rounded-full ${online ? 'bg-green-500' : 'bg-zinc-500'}`} />
              {overview.data?.node ?? 'reaching the node…'}
            </span>
            <span>Throwaway node · not for production</span>
          </div>
        </aside>
        <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-6 px-9 py-7">{children}</main>
      </div>
    </div>
  )
}

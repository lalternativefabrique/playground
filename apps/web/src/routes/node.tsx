import { createFileRoute } from '@tanstack/react-router'
import { Shell, useContext, useOverview } from '@/components/shell'
import { CopyableCommand } from '@/components/copyable-command'

export const Route = createFileRoute('/node')({ component: NodePage })

function NodePage() {
  const overview = useOverview()
  const ctx = useContext()
  const rows = [
    { label: 'Node', value: overview.data?.node ?? '—' },
    { label: 'Control API', value: ctx.data?.server ?? '—' },
    { label: 'Certificate', value: ctx.data?.ca_fingerprint ?? '—' },
    { label: 'Daily wipe', value: ctx.data?.wipe_label ?? '—' },
  ]
  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Node</h1>
        <span className="text-[13px] text-muted-foreground">
          One public VM running sklet: it follows repos, applies their deploys and rolls their images, with no central server.
        </span>
      </div>
      <div className="grid max-w-3xl gap-3.5 rounded-xl border bg-panel p-4.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span className="truncate font-mono text-[13px]">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="flex max-w-3xl flex-col gap-3">
        <CopyableCommand label="Install sklp" cmd="curl -fsSL https://api.skalpai.dev/install/sklp.sh | sh" />
        {ctx.data && (
          <CopyableCommand
            label="Connect to this node"
            cmd={`sklp deploy login -context ${ctx.data.name} -server ${ctx.data.server} -token ${ctx.data.token} -ca-fingerprint ${ctx.data.ca_fingerprint}`}
          />
        )}
      </div>
    </Shell>
  )
}

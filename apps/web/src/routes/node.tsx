import { createFileRoute } from '@tanstack/react-router'
import { Shell, useContext, useOverview } from '@/components/shell'
import { CopyableCommand } from '@/components/copyable-command'

export const Route = createFileRoute('/node')({ component: ConnectPage })

function ConnectPage() {
  const overview = useOverview()
  const ctx = useContext()
  const name = ctx.data?.name ?? 'demo'
  const login = ctx.data
    ? `sklp deploy login -context ${name} -server ${ctx.data.server} -token ${ctx.data.token} -ca-fingerprint ${ctx.data.ca_fingerprint}`
    : 'reading the node…'

  return (
    <Shell>
      <div className="flex max-w-3xl flex-col gap-1">
        <h1 className="text-2xl font-bold">Connect your terminal</h1>
        <span className="text-[13px] text-muted-foreground">
          Drive this node from your machine with sklp: deploy, read logs, open a shell. Four commands, no account.
        </span>
      </div>

      <ol className="flex max-w-3xl flex-col gap-5">
        <Step n={1} title="Install sklp" body="Linux or macOS, one static binary in ~/.local/bin.">
          <CopyableCommand cmd="curl -fsSL https://api.skalpai.dev/install/sklp.sh | sh" />
        </Step>
        <Step
          n={2}
          title="Connect to this node"
          body={`Saves a "${name}" context: the node's address, its token and its certificate fingerprint. The token is public on purpose: this node is thrown away every day.`}
        >
          <CopyableCommand cmd={login} />
        </Step>
        <Step n={3} title="Check it answers" body="Lists what runs on the node, the same apps as this page.">
          <CopyableCommand cmd={`sklp deploy ls -context ${name}`} />
        </Step>
        <Step n={4} title="Deploy your repo" body="A public repo with a .sklp/ folder; the node applies every commit you push.">
          <CopyableCommand cmd={`sklp deploy follow https://github.com/you/your-app -context ${name}`} />
        </Step>
      </ol>

      <section className="flex max-w-3xl flex-col gap-3 rounded-xl border bg-panel p-4.5">
        <h2 className="text-sm font-semibold">Or give it to your coding agent</h2>
        <span className="text-[13px] text-muted-foreground">After step 2, add the sklp MCP server to your agent:</span>
        <CopyableCommand
          label=".mcp.json"
          cmd={`{ "mcpServers": { "sklp": { "command": "sklp", "args": ["mcp", "-context", "${name}"] } } }`}
        />
      </section>

      <section className="grid max-w-3xl gap-3.5 rounded-xl border bg-panel p-4.5 sm:grid-cols-2">
        {[
          { label: 'Node', value: overview.data?.node ?? '—' },
          { label: 'Control API', value: ctx.data?.server ?? '—' },
          { label: 'Certificate fingerprint', value: ctx.data?.ca_fingerprint ?? '—' },
          { label: 'Daily wipe', value: ctx.data?.wipe_label ?? '—' },
        ].map((r) => (
          <div key={r.label} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span className="break-all font-mono text-[13px]">{r.value}</span>
          </div>
        ))}
      </section>
    </Shell>
  )
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-brand-foreground">
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{body}</span>
        {children}
      </div>
    </li>
  )
}

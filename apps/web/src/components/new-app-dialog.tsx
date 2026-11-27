import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { ApiError, api, rememberMine } from '@/lib/api'
import type { PublicContext } from '@/lib/api'
import { CopyableCommand } from '@/components/copyable-command'
import { Tabs } from '@/components/tabs'

type Tab = 'repo' | 'compose' | 'k8s' | 'cli' | 'agent'

const TABS: { id: Tab; label: string }[] = [
  { id: 'repo', label: 'Git repo' },
  { id: 'compose', label: 'Docker Compose' },
  { id: 'k8s', label: 'Kubernetes' },
  { id: 'cli', label: 'Terminal' },
  { id: 'agent', label: 'Agent (MCP)' },
]

const STARTER = 'https://github.com/lalternativefabrique/sklp-demo-starter'

const field =
  'h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-faint focus-visible:outline-2 focus-visible:outline-brand'

export function NewAppDialog({ ctx, onClose }: { ctx?: PublicContext; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('repo')
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="new-app-title"
      className="m-auto mt-20 w-[640px] max-w-[calc(100%-32px)] rounded-2xl border border-input bg-raised p-0 text-foreground shadow-2xl backdrop:bg-black/70"
    >
      <div className="flex items-center px-5 pt-4">
        <h2 id="new-app-title" className="text-lg font-bold">
          New app
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
          className="ml-auto inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
        >
          <X className="size-[18px]" />
        </button>
      </div>
      <div className="px-5 pt-3">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="How to deploy" />
      </div>
      <div className="p-5">
        {tab === 'repo' && <RepoForm onDone={() => dialog.current?.close()} />}
        {tab === 'compose' && <ComposeSteps />}
        {tab === 'k8s' && <KubernetesSteps />}
        {tab === 'cli' && <CliSteps ctx={ctx} />}
        {tab === 'agent' && <AgentSteps ctx={ctx} />}
      </div>
      <div role="note" className="mx-5 mb-5 flex flex-col gap-1 rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-[#3a2a06]/60 px-3.5 py-3 text-[12.5px] text-amber-900 dark:text-amber-200">
        <strong className="text-amber-950 dark:text-amber-50">This is a throwaway playground, not a host.</strong>
        <span>
          Your app is deleted tonight with all its data. Everyone sees it and its logs, and can break it. Public repos and
          images only, never secrets or real data.
        </span>
      </div>
    </dialog>
  )
}

function RepoForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const [repo, setRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [name, setName] = useState('')
  const follow = useMutation({
    mutationFn: () => api.follow(repo.trim(), name.trim(), branch.trim()),
    onSuccess: async (f) => {
      rememberMine(f.name)
      await queryClient.invalidateQueries({ queryKey: ['overview'] })
      onDone()
    },
  })

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        follow.mutate()
      }}
    >
      <label htmlFor="repo" className="text-[13px] font-semibold">
        Public Git repository
      </label>
      <input
        id="repo"
        required
        value={repo}
        onChange={(e) => {
          setRepo(e.target.value)
          follow.reset()
        }}
        placeholder="https://github.com/you/your-app"
        className={`${field} h-[42px] font-mono`}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="branch" className="text-[13px] font-semibold">
            Branch
          </label>
          <input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="follow-name" className="text-[13px] font-semibold">
            Name
          </label>
          <input
            id="follow-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="from the repo"
            className={field}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border border-dashed border-input bg-background px-3.5 py-3 text-[13px] text-muted-foreground">
        <span className="font-medium text-foreground">What the node will do</span>
        <span>
          Read <code className="font-mono">.sklp/deploy-root.yaml</code>, apply every stack it lists, then follow the
          branch: each commit is applied, each new image tag is rolled.
        </span>
      </div>
      {follow.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {follow.error instanceof ApiError ? follow.error.message : 'The node did not answer.'}
        </p>
      )}
      <div className="flex items-center gap-2.5">
        <a href={STARTER} className="text-[13px] text-brand-soft hover:underline">
          No repo? Start from the template
        </a>
        <button
          type="submit"
          disabled={follow.isPending}
          className="ml-auto h-10 rounded-lg bg-brand px-4.5 text-sm font-semibold text-brand-foreground disabled:opacity-60"
        >
          {follow.isPending ? 'Deploying…' : 'Deploy'}
        </button>
      </div>
    </form>
  )
}

function ComposeSteps() {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-muted-foreground">
        sklp turns your Compose file into a deploy. In your repo, with sklp 0.2.23 or later:
      </span>
      <CopyableCommand label="1 · Convert compose.yaml" cmd="sklp init -from compose -to deploy -stack web" />
      <span className="text-[13px] text-muted-foreground">
        2 · Open <code className="font-mono">.sklp/web/deploy.yaml</code> and resolve every{' '}
        <code className="font-mono">TODO(import)</code>: <code className="font-mono">build:</code> needs a public image, host
        mounts become named volumes, and each route needs a host on this node.
      </span>
      <CopyableCommand
        label="3 · Tell the node what to deploy (.sklp/deploy-root.yaml)"
        cmd={DEPLOY_ROOT}
      />
      <span className="text-[13px] text-muted-foreground">4 · Push, then follow the repo from the Git repo tab.</span>
      <ThrowawayValues />
    </div>
  )
}

const DEPLOY_ROOT =
  'kind: deploy-root\nnode: sklet-demo-v1-server\ndeployments:\n  - space: my-app\n    path: .sklp/web/deploy.yaml'

function KubernetesSteps() {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-muted-foreground">
        sklp turns Kubernetes manifests into a deploy. In your repo, with sklp 0.2.23 or later, and{' '}
        <code className="font-mono">kustomize</code> or <code className="font-mono">kubectl</code> on your PATH:
      </span>
      <CopyableCommand label="1 · Convert your manifests" cmd="sklp init -from k8s -stack web" />
      <span className="text-[13px] text-muted-foreground">
        It picks your production kustomize overlay, else your top kustomization, else a <code className="font-mono">k8s/</code>{' '}
        folder; add <code className="font-mono">-path overlays/production</code> to choose.
      </span>
      <span className="text-[13px] text-muted-foreground">
        2 · Open <code className="font-mono">.sklp/web/deploy.yaml</code> and resolve every{' '}
        <code className="font-mono">TODO(import)</code>. Deployments and StatefulSets became services, Jobs and CronJobs
        jobs, Ingress and HTTPRoute routes (give each a host on this node), Secrets <code className="font-mono">${'{VAR}'}</code>.
      </span>
      <CopyableCommand label="3 · Tell the node what to deploy (.sklp/deploy-root.yaml)" cmd={DEPLOY_ROOT} />
      <span className="text-[13px] text-muted-foreground">4 · Push, then follow the repo from the Git repo tab.</span>
      <ThrowawayValues />
    </div>
  )
}

function ThrowawayValues() {
  return (
    <p className="rounded-lg border border-dashed border-input px-3 py-2.5 text-[12.5px] text-muted-foreground">
      The node refuses to start while a <code className="font-mono">${'{VAR}'}</code> is unset. Here, write throwaway
      values in their place, and delete any <code className="font-mono">backup:</code> block with its{' '}
      <code className="font-mono">BACKUP_S3_*</code> lines: nothing is kept anyway.
    </p>
  )
}

function loginCommand(ctx?: PublicContext) {
  return ctx
    ? `sklp deploy login -context ${ctx.name} -server ${ctx.server} -token ${ctx.token} -ca-fingerprint ${ctx.ca_fingerprint}`
    : 'sklp deploy login -context demo …'
}

function CliSteps({ ctx }: { ctx?: PublicContext }) {
  const name = ctx?.name ?? 'demo'
  return (
    <div className="flex flex-col gap-3">
      <CopyableCommand label="1 · Install sklp" cmd="curl -fsSL https://api.skalpai.dev/install/sklp.sh | sh" />
      <CopyableCommand label="2 · Connect to this node" cmd={loginCommand(ctx)} />
      <CopyableCommand label="3 · Follow your repo" cmd={`sklp deploy follow https://github.com/you/your-app -context ${name}`} />
    </div>
  )
}

function AgentSteps({ ctx }: { ctx?: PublicContext }) {
  const name = ctx?.name ?? 'demo'
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-muted-foreground">Once connected (Terminal tab, steps 1–2), give your agent this node:</span>
      <CopyableCommand
        label=".mcp.json"
        cmd={`{ "mcpServers": { "sklp": { "command": "sklp", "args": ["mcp", "-context", "${name}"] } } }`}
      />
      <CopyableCommand
        label="Then ask it"
        cmd="Have the demo node follow https://github.com/you/your-app, then show me the app once it is up."
      />
    </div>
  )
}

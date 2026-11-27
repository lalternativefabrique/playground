import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { ApiError, api, rememberMine } from '@/lib/api'
import type { PublicContext } from '@/lib/api'
import { CopyableCommand } from '@/components/copyable-command'
import { Tabs } from '@/components/tabs'

type Tab = 'repo' | 'compose' | 'cli' | 'agent'

const TABS: { id: Tab; label: string }[] = [
  { id: 'repo', label: 'Git repo' },
  { id: 'compose', label: 'Docker Compose · soon' },
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
        {tab === 'compose' && <ComposeSoon />}
        {tab === 'cli' && <CliSteps ctx={ctx} />}
        {tab === 'agent' && <AgentSteps ctx={ctx} />}
      </div>
      <div role="note" className="mx-5 mb-5 flex flex-col gap-1 rounded-xl border border-amber-700 bg-[#3a2a06]/60 px-3.5 py-3 text-[12.5px] text-amber-200">
        <strong className="text-amber-50">This is a throwaway playground, not a host.</strong>
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
        <p role="alert" className="text-sm text-red-400">
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
          className="ml-auto h-10 rounded-lg bg-brand px-4.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {follow.isPending ? 'Deploying…' : 'Deploy'}
        </button>
      </div>
    </form>
  )
}

function ComposeSoon() {
  return (
    <div className="flex flex-col gap-3 text-[13px] text-muted-foreground">
      <span className="font-medium text-foreground">Coming soon</span>
      <span>
        sklp imports a Compose file for local dev today; turning it into a deploy on a node is being built. Until then,
        put a <code className="font-mono">.sklp/</code> in your repo and use the Git repo tab.
      </span>
      <button
        type="button"
        disabled
        className="ml-auto h-10 cursor-not-allowed rounded-lg border border-input px-4.5 text-sm font-semibold text-faint"
      >
        Deploy · soon
      </button>
    </div>
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

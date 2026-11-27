import { Link } from '@tanstack/react-router'

export function TopBar({ node }: { node?: string }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          sklp <span className="font-normal text-muted-foreground">demo</span>
        </Link>
        <a href="https://sklp.dev/docs" className="text-sm text-muted-foreground hover:text-foreground">
          Docs
        </a>
        <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`size-2 rounded-full ${node ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
          {node ? `node ${node}` : 'reaching the node…'} · resets every day at 20:00 (Paris)
        </span>
      </div>
    </header>
  )
}

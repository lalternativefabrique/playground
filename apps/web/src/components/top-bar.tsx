import { Link } from '@tanstack/react-router'

export function TopBar({ node }: { node?: string }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          playground
        </Link>
        <nav className="flex gap-5 text-sm text-muted-foreground">
          <Link to="/sklp" className="hover:text-foreground" activeProps={{ className: 'text-foreground font-medium' }}>
            sklp node
          </Link>
          <a href="https://sklp.dev/docs" className="hover:text-foreground">
            Docs
          </a>
        </nav>
        <span className="ml-auto text-xs text-muted-foreground">resets every day at 20:00 (Paris)</span>
        {node && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            node {node}
          </span>
        )}
      </div>
    </header>
  )
}

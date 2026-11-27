import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { TopBar } from '@/components/top-bar'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-16 pt-12">
        <section className="flex max-w-3xl flex-col gap-3">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Playground</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Try our tools for real, on shared infrastructure, with nothing to sign up for.
          </p>
        </section>
        <section className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
          <Link
            to="/sklp"
            className="flex flex-col gap-2 rounded-lg border p-6 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2 text-lg font-semibold">
              sklp node <ChevronRight className="size-4" aria-hidden />
            </span>
            <span className="text-sm text-muted-foreground">
              Paste a public repo: a real node follows it, applies every commit and rolls new image tags on its own.
            </span>
          </Link>
        </section>
      </main>
    </div>
  )
}

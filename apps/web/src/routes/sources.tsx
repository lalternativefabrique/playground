import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api, relativeTime } from '@/lib/api'
import { Shell, useOverview } from '@/components/shell'

export const Route = createFileRoute('/sources')({ component: SourcesPage })

function SourcesPage() {
  const overview = useOverview()
  const queryClient = useQueryClient()
  const unfollow = useMutation({
    mutationFn: api.unfollow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['overview'] }),
  })
  const follows = overview.data?.follows ?? []
  const spaces = overview.data?.spaces ?? []

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Sources</h1>
        <span className="text-[13px] text-muted-foreground">
          The repos this node follows: it applies every commit of their branch on its own.
        </span>
      </div>
      {overview.isSuccess && follows.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No repo followed yet.</p>
      )}
      {follows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Repo</th>
                <th className="px-4 py-2.5 font-medium">Branch</th>
                <th className="px-4 py-2.5 font-medium">Apps</th>
                <th className="px-4 py-2.5 font-medium">Followed</th>
                <th className="px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {follows.map((f) => (
                <tr key={f.name} className="border-t">
                  <td className="px-4 py-3 font-mono">{f.name}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">
                    {f.repo.startsWith('https://') ? (
                      <a href={f.repo} className="text-brand-soft hover:underline">
                        {f.repo.replace(/^https:\/\//, '')}
                      </a>
                    ) : (
                      f.repo
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">{f.branch}</td>
                  <td className="px-4 py-3 text-[12.5px]">
                    {spaces.filter((s) => s.repo?.name === f.name).map((s) => s.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{relativeTime(f.added_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => unfollow.mutate(f.name)}
                      disabled={unfollow.isPending}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-medium hover:bg-accent"
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
      )}
      {unfollow.isError && (
        <p role="alert" className="text-sm text-red-400">
          {(unfollow.error).message}
        </p>
      )}
    </Shell>
  )
}

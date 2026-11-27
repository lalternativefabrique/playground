import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, formatBytes } from '@/lib/api'
import type { HostResources } from '@/lib/api'

const W = 320
const H = 72

type Metric = {
  title: string
  capacity: string
  values: number[]
  times: string[]
  detail: (i: number) => string
}

function metrics(r: HostResources): Metric[] {
  const times = r.samples.map((s) => s.at)
  return [
    {
      title: 'CPU',
      capacity: `${r.cpus} vCPU`,
      values: r.samples.map((s) => s.cpu_pct),
      times,
      detail: (i) => `load ${r.samples[i].load1.toFixed(2)}`,
    },
    {
      title: 'Memory',
      capacity: formatBytes(r.mem_total),
      values: r.samples.map((s) => (100 * s.mem_used) / r.mem_total),
      times,
      detail: (i) => `${formatBytes(r.samples[i].mem_used)} used`,
    },
    {
      title: 'Disk',
      capacity: formatBytes(r.disk_total),
      values: r.samples.map((s) => (100 * s.disk_used) / r.disk_total),
      times,
      detail: (i) => `${formatBytes(r.samples[i].disk_used)} used`,
    },
  ]
}

export function NodeCapacity() {
  const res = useQuery({ queryKey: ['resources'], queryFn: api.resources, refetchInterval: 10_000 })
  if (!res.data || res.data.samples.length < 2) {
    return (
      <section className="rounded-xl border bg-panel px-4 py-3.5 text-[13px] text-muted-foreground">
        Measuring the node… the charts appear after a few samples.
      </section>
    )
  }
  return (
    <section aria-label="Node capacity" className="flex flex-col gap-2.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[15px] font-bold">Node capacity</h2>
        <span className="text-[12.5px] text-muted-foreground">
          One machine runs everything on this page · last hour, every 10 s
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {metrics(res.data).map((m) => (
          <Spark key={m.title} m={m} />
        ))}
      </div>
    </section>
  )
}

function Spark({ m }: { m: Metric }) {
  const [hover, setHover] = useState<number>()
  const n = m.values.length
  const x = (i: number) => (i / (n - 1)) * W
  const y = (v: number) => H - (Math.min(100, Math.max(0, v)) / 100) * H
  const line = m.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  const shown = hover ?? n - 1
  const at = new Date(m.times[shown]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-panel px-4 py-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground">{m.title}</span>
        <span className="text-[13px] font-semibold">{m.values[shown].toFixed(0)}%</span>
        <span className="text-xs text-muted-foreground">{m.detail(shown)}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {hover === undefined ? `of ${m.capacity}` : at}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-[72px] w-full overflow-visible"
        role="img"
        aria-label={`${m.title} over the last hour, now ${m.values[n - 1].toFixed(0)}% of ${m.capacity}`}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          setHover(Math.round(((e.clientX - box.left) / box.width) * (n - 1)))
        }}
        onMouseLeave={() => setHover(undefined)}
      >
        <line x1="0" x2={W} y1={y(50)} y2={y(50)} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polygon points={area} className="fill-brand/15" />
        <polyline points={line} fill="none" className="stroke-brand" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hover !== undefined && (
          <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} className="stroke-muted-foreground" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div className="flex justify-between text-[11px] text-faint">
        <span>1 h ago</span>
        <span>50% line</span>
        <span>now</span>
      </div>
    </div>
  )
}

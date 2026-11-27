import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

const MAX_CHARS = 200_000

export function LogsPanel({ space, service }: { space: string; service: string }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'streaming' | 'ended' | 'error'>('streaming')
  const box = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const abort = new AbortController()
    setText('')
    setStatus('streaming')
    ;(async () => {
      try {
        const res = await fetch(api.logsURL(space, service), { signal: abort.signal })
        if (!res.ok || !res.body) throw new Error(String(res.status))
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          setText((prev) => (prev + value).slice(-MAX_CHARS))
        }
        setStatus('ended')
      } catch {
        if (!abort.signal.aborted) setStatus('error')
      }
    })()
    return () => abort.abort()
  }, [space, service])

  useEffect(() => {
    const el = box.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight
  }, [text])

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-semibold">Logs · {service}</h2>
        <span className="text-xs text-muted-foreground">
          {status === 'streaming' ? 'live' : status === 'ended' ? 'stream closed' : 'the node did not stream this log'}
        </span>
      </div>
      <pre
        ref={box}
        className="h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-950 px-4 py-3 font-mono text-xs leading-relaxed text-neutral-200"
      >
        {text || (status === 'streaming' ? 'waiting for output…' : '')}
      </pre>
    </div>
  )
}

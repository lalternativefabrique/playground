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
      <span className={`text-xs ${status === 'streaming' ? 'text-green-300' : 'text-muted-foreground'}`}>
        {status === 'streaming' ? '● live' : status === 'ended' ? 'stream closed' : 'the node did not stream this log'}
      </span>
      <pre
        ref={box}
        className="h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border bg-[#08080a] px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-zinc-300"
      >
        {text || (status === 'streaming' ? 'waiting for output…' : '')}
      </pre>
    </div>
  )
}

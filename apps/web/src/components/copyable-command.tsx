import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyableCommand({ cmd, label }: { cmd: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[13px] text-muted-foreground">{label}</span>}
      <div className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2.5">
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[12.5px]">{cmd}</code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy: ${label ?? cmd}`}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3.5 text-green-700 dark:text-green-400" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Check, ClipboardCopy } from 'lucide-react'

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
    <div className="flex items-center gap-3 rounded bg-muted/60 px-3 py-1.5 text-xs">
      {label && <span className="w-28 shrink-0 text-muted-foreground">{label}</span>}
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono">{cmd}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy: ${cmd}`}
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <ClipboardCopy className="size-3.5" />}
      </button>
    </div>
  )
}

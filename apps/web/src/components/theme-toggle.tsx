import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const KEY = 'playground.theme'

export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${KEY}');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), [])
  const flip = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem(KEY, next ? 'dark' : 'light')
    setDark(next)
  }
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      {dark ? 'Light theme' : 'Dark theme'}
    </button>
  )
}

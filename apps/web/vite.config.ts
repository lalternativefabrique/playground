import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// nitro 3 beta cannot serve vite 8's dev server (its dev entry is missing);
// TanStack Start serves dev on its own, nitro is only the production server.
export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), ...(command === 'build' ? [nitro()] : []), tailwindcss(), tanstackStart(), viteReact()],
}))

import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import appCss from '../styles.css?url'
import { THEME_BOOT } from '@/components/theme-toggle'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Playground · sklp node' },
      {
        name: 'description',
        content: 'Try our tools for real: a shared sklp node that follows your public repo, and more to come.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    scripts: [{ children: THEME_BOOT }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

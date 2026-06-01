// Root providers: react-query (required by chat / tickets / onboarding hooks) +
// the two lib runtime contexts (memoized, per the lib's embedder warning).
// Theme: we set data-theme="dark" on <html> (index.html) instead of mounting a
// theme provider — the lib's ThemeProvider isn't publicly exported, and the ODS
// tokens key off the data-theme attribute directly.
import { useMemo, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  EmbedChatRuntimeProvider,
  EndpointsRuntimeContext,
} from '@flamingo-stack/openframe-frontend-core/contexts'
import { buildChatRuntime, buildEndpointsRuntime } from './content-runtime'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  const chatRuntime = useMemo(buildChatRuntime, [])
  const endpointsRuntime = useMemo(buildEndpointsRuntime, [])
  return (
    <QueryClientProvider client={queryClient}>
      <EmbedChatRuntimeProvider runtime={chatRuntime}>
        <EndpointsRuntimeContext.Provider value={endpointsRuntime}>
          {children}
        </EndpointsRuntimeContext.Provider>
      </EmbedChatRuntimeProvider>
    </QueryClientProvider>
  )
}

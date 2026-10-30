// Root providers: react-query (required by chat / tickets / onboarding hooks) +
// the two lib runtime contexts (memoized, per the lib's embedder warning).
// Theme: we set data-theme="dark" on <html> (index.html) instead of mounting a
// theme provider — the lib's ThemeProvider isn't publicly exported, and the ODS
// tokens key off the data-theme attribute directly.
import { useCallback, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ChatRuntimeContext,
  EndpointsRuntimeContext,
  PageTopicsProvider,
} from '@flamingo-stack/openframe-frontend-core/contexts'
import { AgentIdentityProvider } from '@flamingo-stack/openframe-frontend-core/components'
import {
  ChatIdentityProvider,
  isCrossOriginUrl,
  stripSameOriginToPath,
} from '@flamingo-stack/openframe-frontend-core/components/chat'
import { RichMarkdownRuntimeProvider } from '@flamingo-stack/openframe-frontend-core/components/embeds'
import { TicketLiveProvider } from '@flamingo-stack/openframe-frontend-core/components/tickets'
import { buildChatRuntime, buildEndpointsRuntime } from './content-runtime'
import { EP } from '../config/endpoints'
import { AssistantRuntimeProvider } from './assistant-identity'
import { PAGE_TOPICS } from '../config/page-topics'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: ReactNode }) {
  const routerNavigate = useNavigate()
  const { pathname } = useLocation()
  // The lib's in-app navigation: a link on this origin is a react-router navigation; any other origin is the
  // browser's (returning false).
  const navigate = useCallback(
    ({ href }: { href: string }) => {
      if (isCrossOriginUrl(href)) return false
      routerNavigate(stripSameOriginToPath(href))
      return true
    },
    [routerNavigate],
  )
  const chatRuntime = useMemo(() => buildChatRuntime(navigate), [navigate])
  const endpointsRuntime = useMemo(buildEndpointsRuntime, [])
  return (
    <QueryClientProvider client={queryClient}>
      <ChatRuntimeContext.Provider value={chatRuntime}>
        {/* Resolve identity ONCE for the whole embed. Without this, the
            persistent chat (app-shell) and the /tickets page each call
            useChatIdentity() in separate subtrees → two /identity fetches.
            Mounted INSIDE ChatRuntimeContext (the resolver reads identityUrl)
            and ABOVE everything, so chat + tickets + contact form share it. */}
        <ChatIdentityProvider>
          <EndpointsRuntimeContext.Provider value={endpointsRuntime}>
            {/* RichMarkdownRuntimeProvider — proxy-prefixed overrides for the
                three blog-side endpoints (reddit / twitter / OG-scrape) the
                `<RichMarkdownRenderer>` satellites call. No `transformImageSrc`
                — embedders don't have the Supabase image optimizer; the
                provider's identity-default leaves image URLs unchanged. */}
            <RichMarkdownRuntimeProvider
              redditProxyUrl={EP.redditProxy}
              twitterProxyUrl={EP.twitterProxy}
              ogScraperUrl={EP.ogScraper}
            >
              {/* Ticket realtime + unread state, app-wide: ONE SSE
                  subscription (EP.ticketStream) feeds the shared header's
                  TicketAlertsButton AND the /tickets page. Mounted inside
                  ChatIdentityProvider (streams only for authed identities)
                  and the runtime contexts (reads endpoints). */}
              {/* The assistant's identity (server-read) and this embed's chat
                  opener, for the lib's "ask" surfaces (the FAQ's card). */}
              {/* The AI agents' pictures, read from the server (EP.aiAgents): every
                  mark of Fae or Mingo the lib draws is the icon its identity holds. */}
              <AgentIdentityProvider endpoint={EP.aiAgents}>
                <AssistantRuntimeProvider>
                  {/* The page's topic, read from react-router's address by the FAQ block, its ask card and the
                      chat's quick actions (config/page-topics.ts). */}
                  <PageTopicsProvider topics={PAGE_TOPICS} pathname={pathname}>
                    <TicketLiveProvider>{children}</TicketLiveProvider>
                  </PageTopicsProvider>
                </AssistantRuntimeProvider>
              </AgentIdentityProvider>
            </RichMarkdownRuntimeProvider>
          </EndpointsRuntimeContext.Provider>
        </ChatIdentityProvider>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  )
}

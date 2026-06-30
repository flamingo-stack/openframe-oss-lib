# Embedding `<EmbeddableChat />` — Tutorial

This guide walks through embedding the OpenFrame chat panel in a third-party app and configuring a reverse-proxy that supplies the chat-proxy identity headers.

Two parts:
1. [Part 1 — Mount `<EmbeddableChat />` in a React app](#part-1--mount-embeddablechat--in-a-react-app)
2. [Part 2 — Configure header injection in Spring Cloud Gateway](#part-2--configure-header-injection-in-spring-cloud-gateway)

---

## Architecture

```
Browser  ───►  Your app  ───►  Spring Gateway  ───►  OpenFrame Hub
              (React)         (injects auth +       (chat backend)
                               identity headers)
```

Your React app never sees credentials. The gateway sits between the browser and the hub and injects:

| Header | Required | Purpose |
|--------|----------|---------|
| `Authorization: Bearer <CHAT_PROXY_SECRET>` | ✅ | Proves the gateway is authorized to impersonate users |
| `X-Chat-Act-As: <email>` | ✅ | Identifies which user the request acts on behalf of |
| `X-Chat-First-Name: <string>` | ⚪ | Optional — surfaces in chat greeting / `/whoami` |
| `X-Chat-Last-Name: <string>` | ⚪ | Optional — surfaces in chat greeting / `/whoami` |
| `X-Chat-Avatar-Url: <https://...>` | ⚪ | Optional — must be `https://`; surfaces in chat UI |

The 3 optional headers are PURE PASSTHROUGH — they ride on the `clients.user` object the hub's auth chain returns and are NOT persisted to the database. Embedders use them to render the user's name/avatar in the chat UI without separate user-management plumbing.

---

## Part 1 — Mount `<EmbeddableChat />` in a React app

### Install + peer deps

The lib requires React 18 or 19, `@tanstack/react-query`, and a stylesheet. In your app's `package.json`:

```json
{
  "dependencies": {
    "@flamingo-stack/openframe-frontend-core": "^0.0.105",
    "@tanstack/react-query": "^5.0.0",
    "react": "^18 || ^19",
    "react-dom": "^18 || ^19"
  }
}
```

### Minimal `App.tsx`

```tsx
import { useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  ChatRuntimeContext,
  type ChatRuntime,
} from '@flamingo-stack/openframe-frontend-core/contexts'
import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'
import '@flamingo-stack/openframe-frontend-core/styles'

const queryClient = new QueryClient()

export function App() {
  const runtime: ChatRuntime = useMemo(
    () => ({
      endpoints: {
        chatStreamUrl: '/api/docs/chat',
        approvalToolUrl: '/api/chat/agent/confirm-tool',
        commandsUrl: '/api/docs/commands',
        // Hub's `/api/chat/entity-list` dispatcher does the type → URL
        // lookup server-side. Embedders just hit this single endpoint.
        buildListUrl: (type, ids) =>
          ids.length === 0
            ? null
            : `/api/chat/entity-list?type=${type}&ids=${ids.join(',')}`,
        attachmentUploadUrl: '/api/storage/generate-upload-url',
        attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
        identityUrl: '/api/auth/identity',
        // OPTIONAL — only needed for OpenFrame agent mode (Fae/Mingo). When
        // omitted, the component falls back to the built-in default
        // `(slug) => '/api/ai-agents/' + encodeURIComponent(slug)`. Cross-origin embedders behind a
        // proxy set their absolute/proxied path here.
        aiAgentConfigUrl: (slug) => `/api/ai-agents/${encodeURIComponent(slug)}`,
      },
      navigation: {
        mode: 'embed',
        // Inline card links open against this origin in a new tab.
        defaultContentOrigin: 'https://hub.openframe.ai',
      },
      // Used for localStorage namespacing — pick a stable identifier
      // for your deployment so multiple chat surfaces on the same
      // origin don't collide.
      source: 'openframe',
    }),
    [],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ChatRuntimeContext.Provider value={runtime}>
        <EmbeddableChat />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  )
}
```

That's the whole React side. The lib handles:
- The floating "Ask AI" button
- Panel open/close + animations
- Streaming SSE chat with the hub
- Slash commands (`/whoami`, `/blogs`, `/podcasts`, etc.)
- Inline entity cards (blog posts, customer interviews, etc.)
- Image attachments

### Two-mode setup (Guide + Mingo agent)

`<EmbeddableChat />` is the **single** chat surface used across the
Flamingo stack. It supports two transparent transports living
side-by-side — Guide (SSE → hub) and Mingo (NATS → OpenFrame agent).
Histories never merge; the user flips modes via a header toggle and
each side keeps its own thread.

Pass `modes` to opt into the new API. Configure one slot for legacy /
single-mode hosts (toggle stays hidden), both slots for dual-mode hosts:

```tsx
import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'

<EmbeddableChat
  modes={{
    guide: {
      // Optional — overrides the lib-baked documentType → tableId map.
      tableIdForDocumentType: (docType) => myRegistry[docType] ?? null,
    },
    mingo: {
      dialogId,                          // current conversation id (null → idle)
      getNatsWsUrl: () => natsWsUrl,     // builder, may return null
      clientConfig: { name: 'my-app' },  // optional NATS client config
      publishUserMessage: async (text, { hidden, dialogId }) => {
        // Consumer-owned upstream send — typically an authenticated
        // POST to your chat endpoint, or a NATS publish. Adapter is
        // wire-format agnostic.
        await fetch(`/api/mingo/${dialogId}/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, hidden }),
        })
      },
      fetchChunks: async (dialogId, chatType, fromSeqId) => {
        // Optional — back-fills missed events when the dialog activates.
        // When omitted, the lib's default fetcher is used (see hook docs).
        const r = await fetch(`/api/mingo/${dialogId}/chunks?from=${fromSeqId ?? ''}`)
        return r.json()
      },
    },
  }}
  defaultActiveMode="mingo"             // initial mode for uncontrolled state
  // Or: activeMode={mode} + onActiveModeChange={setMode} for controlled
/>
```

**Single-mode (legacy + guide-only embed):**
```tsx
// No `modes` prop → falls back to legacy guide-only behaviour. The
// top-level `tableIdForDocumentType` prop is auto-synthesised into
// `modes.guide`. Toggle is hidden.
<EmbeddableChat tableIdForDocumentType={myRegistry} />
```

**Notes:**
- The header toggle appears **only when both** `modes.guide` and
  `modes.mingo` are configured. Single-mode hosts see no toggle.
- Image attachments are Guide-only — the add-button is hidden when
  active mode is Mingo regardless of `chat-identity` capability.
- Both adapters are always mounted (React rules of hooks). The
  inactive one stays idle: no SSE request, no NATS subscription, no
  catchup fetch. Local message state is preserved so a mode flip
  restores the user to where they left off.
- `useRequiredChatRuntime()` is invoked unconditionally by the SSE
  adapter. Mingo-only consumers (no Guide config) still need a
  `<ChatRuntimeContext.Provider>` at the root — stub endpoints are
  fine since the SSE adapter never makes network calls when its mode
  isn't active.
- Image attachments

### Choosing the chat mode (OpenFrame agents — Fae / Mingo)

The OpenFrame AI agents (Fae, Mingo) are GLOBAL and served on every platform by
the public `/api/ai-agents` web service. To render a specific agent, pass
`activeAgentSlug` — the chat fetches that agent's display config (greeting +
suggested prompts + source chips) and works in BOTH host and embed modes. The
host owns the picker UI via the `onAgentChange` callback; the component stays
headless about it.

`activeAgentSlug` is fully optional and needs ZERO endpoint wiring — the
component defaults the route to `/api/ai-agents/<slug>` (override via
`endpoints.aiAgentConfigUrl` or the `aiAgentConfigUrl` prop). Leaving it unset is
the platform-knowledge chat (today's behavior).

Render each agent's mark with the library's `AgentMark` (Mingo's vector icon /
Fae's packaged avatar) — the SAME component the hub chat-config UI uses, so the
agent marks stay consistent everywhere.

```tsx
import { useState } from 'react'
import { EmbeddableChat } from '@flamingo-stack/openframe-frontend-core/components/chat'
import { AgentMark, type AgentName } from '@flamingo-stack/openframe-frontend-core/components'

// 'platform' = the platform knowledge chat (no agent); 'fae' / 'mingo' = agents.
type ChatChoice = 'platform' | AgentName

function ChatWithChooser() {
  const [choice, setChoice] = useState<ChatChoice>('platform')

  return (
    <>
      {/* Host-owned chooser — any UI works; here a simple segmented control.
          Agents render the library's AgentMark glyph next to their label. */}
      <div role="radiogroup" aria-label="Chat mode" className="flex gap-2">
        {(['platform', 'fae', 'mingo'] as const).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={choice === c}
            onClick={() => setChoice(c)}
            className="flex items-center gap-2"
          >
            {c !== 'platform' && <AgentMark agent={c} className="w-5 h-5" />}
            {c === 'platform' ? 'Knowledge' : c === 'fae' ? 'Fae' : 'Mingo'}
          </button>
        ))}
      </div>

      <EmbeddableChat
        // Unset for 'platform' → today's empty-state; a slug → that agent.
        activeAgentSlug={choice === 'platform' ? undefined : choice}
        onAgentChange={(slug) => setChoice(slug as ChatChoice)}
      />
    </>
  )
}
```

**Notes:**
- Agent marks come from the library's `AgentMark` component (Mingo = its vector
  `MingoIcon`; Fae = its packaged avatar) — no host asset needed. The hub's
  chat-config admin renders the same component from the DB-configurable
  `openframe_ai_agents.icon_name`.
- Switching `activeAgentSlug` refetches that agent's config (react-query keyed on
  the resolved URL — one cached request per agent).
- DISPLAY-only this phase: retrieval still resolves server-side from the platform.
  The agent customizes the greeting + suggested-prompt chips + source-chip grid,
  not the corpus.
- This is orthogonal to the Guide↔Mingo TRANSPORT toggle (`activeMode` /
  `onActiveModeChange`, above): `activeMode` picks the transport; `activeAgentSlug`
  picks which OpenFrame agent's display config to render.

### Why no auth in the client?

Notice the runtime has NO credentials, NO bearer tokens, NO API keys. The browser makes ordinary `fetch('/api/...')` calls; the GATEWAY sees those, looks up the authenticated user from your app's session, and injects the `Authorization: Bearer <chat-proxy-secret>` + `X-Chat-Act-As: <email>` headers before forwarding to the hub.

This means:
- ✅ Chat secret never leaks to the browser
- ✅ Per-user identity is enforced by the gateway, not by the client
- ✅ The same React code works for every authenticated user

### Dev-mode Vite proxy (validation pattern)

If you want to mirror the validation app at `/tmp/openframe-chat-embed-test/`, use a Vite dev-server proxy to forward `/api/*` to the hub and inject the headers from env vars:

```ts
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const env = {
    OPENFRAME_API_BASE: process.env.OPENFRAME_API_BASE ?? fileEnv.OPENFRAME_API_BASE ?? 'https://hub.openframe.ai',
    CHAT_SECRET: process.env.CHAT_SECRET ?? fileEnv.CHAT_SECRET,
    ACT_AS_EMAIL: process.env.ACT_AS_EMAIL ?? fileEnv.ACT_AS_EMAIL ?? 'demo@example.com',
    ACT_AS_FIRST_NAME: process.env.ACT_AS_FIRST_NAME ?? fileEnv.ACT_AS_FIRST_NAME ?? '',
    ACT_AS_LAST_NAME: process.env.ACT_AS_LAST_NAME ?? fileEnv.ACT_AS_LAST_NAME ?? '',
    ACT_AS_AVATAR_URL: process.env.ACT_AS_AVATAR_URL ?? fileEnv.ACT_AS_AVATAR_URL ?? '',
  }
  return {
    plugins: [react()],
    optimizeDeps: {
      // Yalc-linked packages MUST be excluded from pre-bundle.
      exclude: ['@flamingo-stack/openframe-frontend-core'],
    },
    server: {
      proxy: {
        '/api': {
          target: env.OPENFRAME_API_BASE,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (req) => {
              req.setHeader('Authorization', `Bearer ${env.CHAT_SECRET}`)
              req.setHeader('X-Chat-Act-As', env.ACT_AS_EMAIL)
              if (env.ACT_AS_FIRST_NAME) req.setHeader('X-Chat-First-Name', env.ACT_AS_FIRST_NAME)
              if (env.ACT_AS_LAST_NAME) req.setHeader('X-Chat-Last-Name', env.ACT_AS_LAST_NAME)
              if (env.ACT_AS_AVATAR_URL) req.setHeader('X-Chat-Avatar-Url', env.ACT_AS_AVATAR_URL)
              // SSE-safe: identity content-encoding so the proxy
              // doesn't gzip a streaming response.
              req.setHeader('Accept-Encoding', 'identity')
            })
          },
        },
      },
    },
  }
})
```

`.env.local`:

```env
OPENFRAME_API_BASE=https://hub.openframe.ai
CHAT_SECRET=<paste CHAT_PROXY_SECRET from hub .env>
ACT_AS_EMAIL=you@example.com
ACT_AS_FIRST_NAME=Your
ACT_AS_LAST_NAME=Name
ACT_AS_AVATAR_URL=https://example.com/avatar.png
```

### Verify identity end-to-end

The hub exposes `/api/chat/identity` for a quick capability probe:

```ts
fetch('/api/chat/identity')
  .then((r) => r.json())
  .then(console.log)
// {
//   authTier: 'bearer-act-as',
//   source: 'openframe',
//   attachmentsEnabled: true,
//   user: {
//     name: null,                              // from profiles.full_name
//     email: 'you@example.com',                // from X-Chat-Act-As
//     firstName: 'Your',                       // from X-Chat-First-Name
//     lastName: 'Name',                        // from X-Chat-Last-Name
//     avatarUrl: 'https://example.com/...'     // from X-Chat-Avatar-Url
//   }
// }
```

Or type `/whoami` in the chat panel.

---

## Part 2 — Configure header injection in Spring Cloud Gateway

This is the production setup: Spring Cloud Gateway sits between your React app and the OpenFrame hub, looks up the authenticated user, and injects the identity headers.

### Route definition (`application.yml`)

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: openframe-chat-api
          uri: ${openframe.hub.url}
          predicates:
            - Path=/api/**
          filters:
            # 1. Strip any client-supplied chat-auth headers — defense
            #    against the browser trying to set its own Bearer or
            #    X-Chat-* headers.
            - RemoveRequestHeader=Authorization
            - RemoveRequestHeader=X-Chat-Act-As
            - RemoveRequestHeader=X-Chat-First-Name
            - RemoveRequestHeader=X-Chat-Last-Name
            - RemoveRequestHeader=X-Chat-Avatar-Url
            # 2. Inject the shared chat-proxy secret on every request.
            - AddRequestHeader=Authorization, Bearer ${openframe.chat.proxy-secret}
            # 3. Inject per-user identity headers from the authenticated
            #    principal (set by the ChatIdentityHeadersGatewayFilter
            #    below — Spring's built-in AddRequestHeader can't read
            #    from the security context).
            #    The filter is registered as `chat-identity` and applied
            #    here.
            - name: ChatIdentityHeaders

openframe:
  hub:
    url: https://hub.openframe.ai
  chat:
    # Inject from secret store / env at deploy time.
    proxy-secret: ${OPENFRAME_CHAT_PROXY_SECRET}
```

### Identity-injecting gateway filter (Java + WebFlux)

```java
package com.example.openframe.gateway;

import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * Adds the 4 OpenFrame chat-proxy identity headers from the authenticated
 * principal (typically an OIDC user).
 *
 *   X-Chat-Act-As       — email (REQUIRED)
 *   X-Chat-First-Name   — given_name claim (optional)
 *   X-Chat-Last-Name    — family_name claim (optional)
 *   X-Chat-Avatar-Url   — picture claim, must be https:// (optional)
 *
 * Adds nothing if the request is unauthenticated — the hub will then 401
 * because Authorization Bearer is set but X-Chat-Act-As isn't.
 */
@Component
public class ChatIdentityHeadersGatewayFilterFactory
    extends AbstractGatewayFilterFactory<Object> {

  @Override
  public GatewayFilter apply(Object config) {
    return (exchange, chain) ->
        ReactiveSecurityContextHolder.getContext()
            .map(ctx -> ctx.getAuthentication())
            .filter(Authentication::isAuthenticated)
            .flatMap(auth -> {
              var mutated = exchange.getRequest().mutate();
              applyIdentityHeaders(mutated, auth);
              return chain.filter(
                  exchange.mutate().request(mutated.build()).build());
            })
            // Anonymous → pass through unchanged. The hub rejects with
            // 400 CHAT_PROXY_ACT_AS_REQUIRED, which the React client
            // surfaces as a clean "please sign in" error.
            .switchIfEmpty(chain.filter(exchange));
  }

  private void applyIdentityHeaders(
      org.springframework.http.server.reactive.ServerHttpRequest.Builder req,
      Authentication auth) {
    var principal = auth.getPrincipal();

    // OIDC user shape (Keycloak / Auth0 / Okta / Google).
    if (principal instanceof OidcUser oidc) {
      addIfPresent(req, "X-Chat-Act-As", oidc.getEmail());
      addIfPresent(req, "X-Chat-First-Name", oidc.getGivenName());
      addIfPresent(req, "X-Chat-Last-Name", oidc.getFamilyName());
      addIfHttps(req, "X-Chat-Avatar-Url", oidc.getPicture());
      return;
    }

    // Fallback for non-OIDC: use `auth.getName()` for email-equivalent.
    addIfPresent(req, "X-Chat-Act-As", auth.getName());
  }

  private static void addIfPresent(
      org.springframework.http.server.reactive.ServerHttpRequest.Builder req,
      String name,
      String value) {
    if (value != null && !value.isBlank()) {
      req.header(name, value);
    }
  }

  /** Avatar URL MUST be https:// — the hub 400s anything else. */
  private static void addIfHttps(
      org.springframework.http.server.reactive.ServerHttpRequest.Builder req,
      String name,
      String value) {
    if (value != null && value.startsWith("https://")) {
      req.header(name, value);
    }
  }
}
```

The `name: ChatIdentityHeaders` reference in `application.yml` matches the factory's auto-derived bean name (Spring strips the `GatewayFilterFactory` suffix).

### Production tradeoffs

| Concern | Default | If you need stronger |
|---------|---------|---------------------|
| Secret storage | `${OPENFRAME_CHAT_PROXY_SECRET}` env | Use Spring Vault / AWS Secrets Manager + `@RefreshScope` |
| Principal source | OIDC `picture` claim | Sync your IdP avatar to a CDN URL with a content-addressable hash so the URL is cacheable |
| Anonymous access | Pass-through (hub 400s) | Add a Spring Security filter chain BEFORE the gateway that returns 401 for unauthenticated `/api/**` |
| Rate limiting | None — hub enforces per-IP | Add Spring Cloud Gateway's `RequestRateLimiter` keyed on `auth.getName()` for per-user limits |
| Header injection logging | None | Add a debug-level log statement in `applyIdentityHeaders` — DO NOT log the Bearer secret |

### Testing the gateway

```bash
# Anonymous — should pass through and the hub rejects.
curl -i https://your-gateway/api/chat/identity
# HTTP/1.1 400 — CHAT_PROXY_ACT_AS_REQUIRED

# With a valid OIDC session cookie:
curl -i --cookie "session=..." https://your-gateway/api/chat/identity
# HTTP/1.1 200
# {"authTier":"bearer-act-as","user":{"email":"you@example.com","firstName":"...","lastName":"...","avatarUrl":"..."}}
```

---

## Regression checklist for the two-mode upgrade

When upgrading an existing single-mode embedder (e.g. multi-platform-hub)
to the unified `<EmbeddableChat>`, verify these behaviours stay intact:

### Multi-platform-hub (guide-only legacy path)

The host passes only `tableIdForDocumentType` at the top level — no
`modes` prop. The lib auto-synthesises `modes = { guide: { ... } }` and
forces `activeMode = 'guide'`.

- [ ] Floating "Ask AI" button still appears (legacy `showInternalTrigger` default)
- [ ] Opening the drawer renders the Guide empty state + suggested queries
- [ ] Slash commands (`/whoami`, `/blogs`, etc.) work
- [ ] Inline entity cards render (blog/program/customer-interview/etc.)
- [ ] Image attachments add-button is visible and uploads work
- [ ] localStorage history key is unchanged (`chat:<source>`)
- [ ] Mode toggle is NOT visible in the header
- [ ] `discussRef` / `displayRef` from inline cards still drill into RAG retrieval
- [ ] `currentProvider` / `currentModelLabel` propagate to `<ModelDisplay>`
- [ ] Approval cards + tool-execution blocks render correctly

### OpenFrame frontend (dual-mode new path)

The host passes both `modes.guide` + `modes.mingo`. Toggle is visible.

- [ ] Toggle appears in the drawer header showing "Mingo | Guide"
- [ ] Initial mode matches `defaultActiveMode` (or first configured slot)
- [ ] Clicking the toggle swaps message threads — each mode keeps its own history
- [ ] Mid-stream switch: inactive mode pauses (no further chunks rendered);
      reactivating it picks up where the stream left off (catchup for NATS,
      partial-state for SSE)
- [ ] Attachments add-button is hidden in Mingo mode
- [ ] Slash menu does not surface Guide commands in Mingo mode
      (gated automatically when NATS runtime lacks `commandsUrl`)
- [ ] NATS subscription only opens when Mingo mode is active
- [ ] SSE stream only fires when Guide mode is active and `sendMessage` is called
- [ ] Both adapters return identical `UnifiedChatState` shape (TypeScript-enforced)

---

## References

- Hub auth chain: `lib/api/route-base.ts` → `resolveChatProxyIdentity()`
- Identity endpoint: `app/api/chat/identity/route.ts`
- Validation app: `/tmp/openframe-chat-embed-test/` in the trunk dev environment
- Header contract is defined ONCE in `lib/api/route-base.ts` — changes there propagate to all embedders automatically (no version bump needed for additive headers)

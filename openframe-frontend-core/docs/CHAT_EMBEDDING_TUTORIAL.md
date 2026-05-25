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
        chatIdentityUrl: '/api/chat/identity',
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

## References

- Hub auth chain: `lib/api/route-base.ts` → `resolveChatProxyIdentity()`
- Identity endpoint: `app/api/chat/identity/route.ts`
- Validation app: `/tmp/openframe-chat-embed-test/` in the trunk dev environment
- Header contract is defined ONCE in `lib/api/route-base.ts` — changes there propagate to all embedders automatically (no version bump needed for additive headers)

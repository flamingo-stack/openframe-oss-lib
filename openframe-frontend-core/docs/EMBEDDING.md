# Embedding `@flamingo-stack/openframe-frontend-core` in a non-Next.js React app

This guide shows how to embed lib components (`<AnnouncementBar>`, contact form
hook, access-code hook, chat panel) into a third-party React app — typically
served behind a reverse proxy that rewrites `/api/<your-prefix>/*` to the
hub's `/api/*`.

The lib exposes runtime configuration through two React Contexts:

- **`EndpointsRuntimeContext`** — API endpoint URLs (`AnnouncementBar`, contact
  form, access codes).
- **`ChatRuntimeContext`** — chat-panel endpoints + a `mode: 'host' | 'embed'`
  discriminator that controls click behavior.

The hub mounts a `<HubRuntimeProvider>` that supplies defaults for both;
embedded apps mount their own provider(s) with overrides.

---

## 1. Install

```bash
npm install @flamingo-stack/openframe-frontend-core
```

Peer dependencies (install whichever your components touch): `react`,
`react-dom`, `@tanstack/react-query`, `@radix-ui/react-use-controllable-state`.

---

## 2. Mount the runtime providers at your app's root

Define a small wrapper that builds **memoized** runtime values and provides both contexts.
Non-memoized values churn references on every render and cause downstream
effect-dep churn.

```tsx
// src/runtime-providers.tsx
import { useMemo, type ReactNode } from 'react'
import {
  EndpointsRuntimeContext,
  type EndpointsRuntime,
} from '@flamingo-stack/openframe-frontend-core/contexts'
// ChatRuntimeContext is currently in the hub source tree; once the chat
// panel migrates into oss-lib (see MIGRATING_COMPONENTS.md), the import
// will resolve here. For now, the embedded app uses ONLY the endpoints
// runtime unless you also vendor the chat panel.
import {
  ChatRuntimeContext,
  type ChatRuntime,
} from '@flamingo-stack/openframe-frontend-core/contexts' // <- when chat migrates

const PROXY_PREFIX = '/api/mingo-guide' // your reverse-proxy prefix
const CONTENT_HOST = 'https://hub.openframe.ai' // where chat links should resolve

export function EmbeddedRuntimeProvider({ children }: { children: ReactNode }) {
  const endpoints = useMemo<EndpointsRuntime>(() => ({
    announcementsUrl: `${PROXY_PREFIX}/announcements/active`,
    accessCode: {
      validateUrl: `${PROXY_PREFIX}/validate-access-code`,
      consumeUrl: `${PROXY_PREFIX}/consume-access-code`,
    },
    contactUrl: `${PROXY_PREFIX}/contact`,
  }), [])

  const chat = useMemo<ChatRuntime>(() => ({
    endpoints: {
      chatStreamUrl: `${PROXY_PREFIX}/docs/chat`,
      approvalToolUrl: `${PROXY_PREFIX}/chat/agent/confirm-tool`,
      commandsUrl: `${PROXY_PREFIX}/docs/commands`,
      buildListUrl: (type, ids) => `${PROXY_PREFIX}/${type}?ids=${ids.join(',')}`,
    },
    navigation: {
      mode: 'embed',                          // forces new-tab + absolute URLs on every chat click
      defaultContentOrigin: CONTENT_HOST,     // used when target platform can't be inferred
      // Optional analytics hook. MUST be synchronous (popup-blocker).
      openExternal: (href) => {
        navigator.sendBeacon('/analytics/click', JSON.stringify({ href, t: Date.now() }))
        window.open(href, '_blank', 'noopener,noreferrer')
      },
    },
  }), [])

  return (
    <ChatRuntimeContext.Provider value={chat}>
      <EndpointsRuntimeContext.Provider value={endpoints}>
        {children}
      </EndpointsRuntimeContext.Provider>
    </ChatRuntimeContext.Provider>
  )
}
```

Wrap your tree at the root:

```tsx
// src/main.tsx
import { EmbeddedRuntimeProvider } from './runtime-providers'

createRoot(document.getElementById('root')!).render(
  <EmbeddedRuntimeProvider>
    <App />
  </EmbeddedRuntimeProvider>
)
```

---

## 3. Use the features

### Announcement bar

```tsx
import { AnnouncementBar } from '@flamingo-stack/openframe-frontend-core/components'

<AnnouncementBar />
```

Polls `endpoints.announcementsUrl` every 5 minutes. When the URL is undefined
(no provider mounted), the bar still renders any cached announcement but
skips the fetch and the polling timer entirely.

### Contact form submission

```tsx
import { useContactSubmission } from '@flamingo-stack/openframe-frontend-core/hooks'

function ContactForm() {
  const { submit, isSubmitting, isSuccess } = useContactSubmission({
    successRedirectUrl: '/thank-you',
    successToastMessage: 'We will be in touch.',
  })
  // submit(formData) — POSTs to endpoints.contactUrl
}
```

Throws if no provider is mounted — wrap in `<EmbeddedRuntimeProvider>` (or your
own `<EndpointsRuntimeContext.Provider>`).

### Access code validation

```tsx
import { useAccessCodeIntegration } from '@flamingo-stack/openframe-frontend-core/hooks'

function RegisterForm() {
  const { validate, consume, validateAndConsume, isProcessing } = useAccessCodeIntegration()
  // validate(email, code) — POST endpoints.accessCode.validateUrl
  // consume(email, code) — POST endpoints.accessCode.consumeUrl
}
```

For non-React callers (e.g. server scripts, edge functions), the pure helpers
under `@flamingo-stack/openframe-frontend-core/utils` accept the endpoints
explicitly:

```ts
import {
  validateAccessCode,
  type AccessCodeEndpoints,
} from '@flamingo-stack/openframe-frontend-core/utils'

const endpoints: AccessCodeEndpoints = {
  validateUrl: '/api/mingo-guide/validate-access-code',
  consumeUrl: '/api/mingo-guide/consume-access-code',
}
await validateAccessCode(email, code, endpoints)
```

### Chat panel (when migrated)

The chat panel currently lives in the hub source tree (`components/shared/global-ask-ai.tsx`)
and migrates into oss-lib in a follow-up. When it lands, usage is:

```tsx
import { useState } from 'react'
import { GlobalAskAI } from '@flamingo-stack/openframe-frontend-core/components/chat'

function Shell() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open chat</button>
      <GlobalAskAI
        open={open}
        onOpenChange={setOpen}
        showInternalTrigger={false}   // hide the hub's built-in floating button
      />
    </>
  )
}
```

Every link click inside the chat opens in a new tab against the absolute
content host (`navigation.defaultContentOrigin` or per-platform resolution).

---

## 4. Verification checklist

Open devtools, then:

| Action | Expected |
|---|---|
| App boot | Network requests go to `<PROXY_PREFIX>/*` — never directly to `hub.openframe.ai` |
| Send chat message | `POST <PROXY_PREFIX>/docs/chat` (streaming) |
| Type `/` in chat input | `GET <PROXY_PREFIX>/docs/commands` |
| Click source chip in chat | New tab opens at absolute `https://hub.openframe.ai/...` (or other source platform) |
| `localStorage.setItem('nav-trace','true')` + click chip | Console: `reason=override:embed-mode` |
| Approval card → approve | `POST <PROXY_PREFIX>/chat/agent/confirm-tool` |
| Announcement bar visible | `GET <PROXY_PREFIX>/announcements/active` every 5 min |
| Submit contact form | `POST <PROXY_PREFIX>/contact` |

---

## 5. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `createContext is not a function` during SSR | An oss-lib `utils/` export pulled `contexts/` transitively | Never re-export `hooks/` or `contexts/` from `utils/index.ts` — see [contexts/index.ts JSDoc](../src/contexts/index.ts) |
| `[chat-runtime] hook called outside <ChatRuntimeContext.Provider>` | Chat component rendered above the provider | Lift `<EmbeddedRuntimeProvider>` higher |
| Click opens against embedder origin (wrong host) | Source URL was relative and platform couldn't be inferred AND `defaultContentOrigin` is unset | Set `navigation.defaultContentOrigin` in embed mode |
| Safari blocks the new-tab open | `openExternal` did async work before `window.open` | Make `openExternal` synchronous — use `sendBeacon` for fire-and-forget analytics |
| Chat re-fetches every render | Runtime value rebuilt inline | Wrap the runtime value(s) in `useMemo(() => ({...}), [])` |
| Mid-session provider value swap remounts chat | Branch-based mount (not the lib's outer-forward pattern) | Mount the provider unconditionally at root; only its `value` should change |

---

## Reference

- [`endpoints-runtime-context.tsx`](../src/contexts/endpoints-runtime-context.tsx) — full type definitions for `EndpointsRuntime`.
- [`access-code-client.ts`](../src/utils/access-code-client.ts) — pure helpers + `AccessCodeEndpoints` type.
- [`use-access-code-integration.ts`](../src/hooks/use-access-code-integration.ts) — runtime-binding React hook.
- [`announcement-bar.tsx`](../src/components/announcement-bar.tsx) — the consumer that demonstrates the optional-runtime + cached-paint pattern.

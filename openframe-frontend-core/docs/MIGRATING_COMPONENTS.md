# Migrating components from the hub into `openframe-frontend-core`

This guide walks through moving a component (and its hook/util dependencies)
from `multi-platform-hub` into the shared oss-lib. The working example is
**blog-posts** — moving the blog detail card + list view + the data-fetch
hook + any utility helpers.

The pattern generalizes; the checklist at the end applies to any component.

---

## Mental model: three layers, two bundles

Every file in this lib lives in one of three layers:

| Layer | Folder | tsup bundle | `'use client'` | What goes here |
|---|---|---|---|---|
| **Server-safe utils** | `src/utils/` | server bundle (treeshake on) | No | Pure functions, types, constants. **No React imports, no `createContext()`, no `useContext()`** |
| **Client hooks** | `src/hooks/` | client bundle (`"use client"` banner) | Implicit | React hooks. Free to read context, call `useState`/`useEffect` |
| **Client components** | `src/components/...` | client bundle (`"use client"` banner) | Implicit | React components |

**The cardinal rule:** anything that calls `createContext()` at module top
level OR uses `useContext()` lives in the client bundle. If `utils/index.ts`
re-exports a file that pulls a context, every server-rendered page that
imports anything from `utils/` will crash on SSR with
`createContext is not a function`. This is the trap fixed in the
`use-access-code-integration` extraction — see
[`src/contexts/index.ts`](../src/contexts/index.ts) for the convention.

---

## Worked example: migrating blog posts

Assume the hub has:

```
multi-platform-hub/
├── components/shared/blog-card.tsx          # <BlogCard>
├── components/shared/blog-list.tsx          # <BlogList>
├── hooks/use-blog-posts.ts                  # data-fetch hook (calls /api/blog/posts)
├── lib/utils/blog-card-props.ts             # pure prop-mapping helper
└── lib/data/blog-utils.ts                   # SERVER-ONLY (uses Supabase) → STAYS in hub
```

We want `<BlogCard>` / `<BlogList>` / `useBlogPosts` in oss-lib.
`lib/data/blog-utils.ts` stays in the hub because it imports the Supabase
admin client.

### Step 1 — audit what crosses the boundary

```bash
# What does each file import?
grep -rn "^import" components/shared/blog-card.tsx hooks/use-blog-posts.ts \
  lib/utils/blog-card-props.ts
```

Sort imports into three buckets:

1. **Already in oss-lib** — `@flamingo-stack/openframe-frontend-core/...` — fine
2. **Pure helpers in hub** — small utilities, types — **migrate alongside** the component
3. **Hub-only services** — auth, Supabase admin, route handlers — **must NOT move**

If you see a hub-only service in the chain (e.g. `@/lib/supabase-server`), the
component depends on the hub and can't migrate as-is. Either:
- The component talks to an API endpoint instead (good) — that endpoint becomes
  part of `EndpointsRuntime` (see step 4).
- Refactor first to remove the hub coupling, then migrate.

### Step 2 — pick the new home in oss-lib

| Hub file | New oss-lib location |
|---|---|
| `components/shared/blog-card.tsx` | `src/components/blog/blog-card.tsx` |
| `components/shared/blog-list.tsx` | `src/components/blog/blog-list.tsx` |
| `hooks/use-blog-posts.ts` | `src/hooks/use-blog-posts.ts` |
| `lib/utils/blog-card-props.ts` | `src/utils/blog-card-props.ts` (server-safe — no React imports) |

If `blog-card-props.ts` does NOT call `useContext()` or `createContext()`, put
it in `utils/`. If it does (a hook-shaped helper), put it in `hooks/`.

### Step 3 — copy + adjust imports

Move the files. Inside each, rewrite imports:

```ts
// Before (hub):
import { Card } from '@flamingo-stack/openframe-frontend-core/components/ui'
import { formatDate } from '@/lib/utils/format-date'
import type { BlogPost } from '@/types/blog'

// After (in oss-lib):
import { Card } from '../ui/card'                  // local
import { formatDate } from '../../utils/format-date'
import type { BlogPost } from '../../types/blog'
```

Use **relative paths inside oss-lib** — don't import from
`@flamingo-stack/openframe-frontend-core/...` within the lib itself (creates a
self-reference and breaks tsup splitting).

### Step 4 — extract any hardcoded API paths into `EndpointsRuntime`

If `useBlogPosts` calls `fetch('/api/blog/posts')`, extend `EndpointsRuntime`:

```ts
// src/contexts/endpoints-runtime-context.tsx
export interface EndpointsRuntime {
  announcementsUrl: string
  accessCode: { ... }
  contactUrl: string
  blog: {
    listUrl: string  // GET /api/blog/posts
    detailUrl: (slug: string) => string  // GET /api/blog/posts/[slug]
  }
}
```

Then in the hub default ([`hub-runtime-provider.tsx`](../../multi-platform-hub/components/providers/hub-runtime-provider.tsx)):

```tsx
const endpointsValue = useOuterOrDefault<EndpointsRuntime>(EndpointsRuntimeContext, () => ({
  // ...existing...
  blog: {
    listUrl: '/api/blog/posts',
    detailUrl: (slug) => `/api/blog/posts/${slug}`,
  },
}))
```

And in `useBlogPosts`:

```ts
import { useRequiredEndpointsRuntime } from '../contexts/endpoints-runtime-context'

export function useBlogPosts() {
  const { blog } = useRequiredEndpointsRuntime()
  // useQuery(['blog'], () => fetch(blog.listUrl).then(r => r.json()))
}
```

### Step 5 — barrel exports

Add the new files to the right barrel(s):

```ts
// src/components/index.ts
export * from './blog/blog-card'
export * from './blog/blog-list'

// src/hooks/index.ts
export * from './use-blog-posts'

// src/utils/index.ts (only if blog-card-props.ts is server-safe)
export * from './blog-card-props'
```

### Step 6 — tsup config: do you need a new subpath export?

For most components, the existing `./components` / `./hooks` / `./utils`
subpath exports are enough — you only need a new entry if you want
consumers to import via a finer-grained path like
`@flamingo-stack/openframe-frontend-core/components/blog`.

If you DO want a finer path:

```ts
// tsup.config.ts (in the client entries block — anything with React belongs here)
entry: {
  // ...existing...
  'components/blog/index': 'src/components/blog/index.ts',
}
```

And in `package.json`:

```json
{
  "exports": {
    "./components/blog": {
      "types": "./dist/components/blog/index.d.ts",
      "import": "./dist/components/blog/index.js",
      "require": "./dist/components/blog/index.cjs",
      "default": "./dist/components/blog/index.js"
    }
  }
}
```

Don't forget the matching `src/components/blog/index.ts` barrel.

### Step 7 — update the hub to import from oss-lib

Replace local imports with lib imports:

```tsx
// Before:
import { BlogCard } from '@/components/shared/blog-card'

// After:
import { BlogCard } from '@flamingo-stack/openframe-frontend-core/components'
// or with finer-grained subpath:
import { BlogCard } from '@flamingo-stack/openframe-frontend-core/components/blog'
```

Then delete the now-unused hub files.

### Step 8 — build + verify

```bash
# In oss-lib:
npm run build         # full tsup build
yalc push             # ship to local consumers

# In hub:
npx tsc --noEmit      # type-check
npm run build         # production build
```

Smoke-test in the dev server (`npm run dev:openframe` etc.) — confirm the
blog page still loads, still fetches via the runtime URL, still styled
correctly with ODS tokens.

---

## Checklist (any component)

- [ ] Audit imports — no hub-only services in the call graph (Supabase admin,
      route handlers, hub auth helpers).
- [ ] Pick the right oss-lib home: `utils/` (server-safe), `hooks/` (React, may
      use context), or `components/...` (React UI).
- [ ] Move files; rewrite imports to relative paths.
- [ ] If the component fetches: extract endpoint paths into `EndpointsRuntime`
      (or add a new runtime context if it's a new concern); read via
      `useRequiredEndpointsRuntime()` (throws) or `useEndpointsRuntime()`
      (null fallback for optional consumers).
- [ ] Add hub defaults in
      [`hub-runtime-provider.tsx`](../../multi-platform-hub/components/providers/hub-runtime-provider.tsx).
- [ ] Update barrel(s): `components/index.ts`, `hooks/index.ts`, `utils/index.ts`.
- [ ] (Optional) New subpath export — `tsup.config.ts` entry + `package.json`
      `exports` block.
- [ ] Switch hub call sites to lib imports; delete the hub copies.
- [ ] `npm run build` in oss-lib, then `yalc push`.
- [ ] `npx tsc --noEmit` + `npm run build` in hub.
- [ ] Manual smoke test in dev for the touched feature.
- [ ] Smoke-test on a non-chat page too (to ensure no SSR `createContext`
      regression from a stray `utils/` import that now pulls a context
      transitively).

---

## Anti-patterns to avoid

- **Re-exporting a hook or context module from `utils/index.ts`.** Even
  one accidental `export * from './my-hook'` in the server bundle blows up
  SSR. The fix is the bundle-split convention documented in
  [`src/contexts/index.ts`](../src/contexts/index.ts).
- **Importing from `@flamingo-stack/openframe-frontend-core/...` inside the lib
  itself.** Use relative paths. The package alias is for consumers.
- **Building the runtime value inline at the provider site.** Memoize
  with `useMemo(() => ({...}), [])` so consumer effect-dep arrays stay
  stable across embedder re-renders.
- **Hub-aliased imports (`@/...`) in lib files.** Lib files import only
  from `react`, `react-dom`, other peer deps, and relative paths. Any
  `@/` import is a port-the-file-into-the-lib smell, not a real dep.
- **`'use client'` directive at the top of an individual file.** tsup
  injects the banner per-bundle (client entries only). Per-file
  directives get stripped during bundling. Trust the config.

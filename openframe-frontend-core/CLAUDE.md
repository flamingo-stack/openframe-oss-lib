# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@flamingo-stack/openframe-frontend-core` is the shared TypeScript design system package used by all Flamingo products (OpenMSP, OpenFrame, multi-platform-hub, Flamingo Website, Flamingo Teaser, TMCG, openframe-chat). It provides components, hooks, styles, NATS client, chat engine, and utilities. The old name `@flamingo/ui-kit` is dead — never use it in imports or docs.

It is a **built package**: tsup compiles `src/` into `dist/` (ESM + CJS, plus `tsc` d.ts pass); consumers install from the npm registry or link via yalc during development. Consumers see `dist/`, NOT `src/` — except styles and the Tailwind preset, which ship as source. The repo's `package.json` version lags the registry (CI bumps at publish).

- **Core components**: reusable, platform-agnostic (Button, Card, Modal, etc.)
- **Application components**: platform-specific business components that *consume* the core primitives

## Commands

- `npm run build` — full build (`tsup` + `tsc -p tsconfig.declarations.json`); needs `NODE_OPTIONS=--max-old-space-size=8192`
- `npm run build:fast` — build without d.ts
- `npm run dev` — `tsup --watch`
- `npm run yalc:watch` — rebuild + `yalc push --changed` on every change (the dev loop against consumers)
- `npm run type-check` — TypeScript type checking (strict, zero-errors policy)
- `npm run test` / `test:run` / `test:coverage` — vitest (jsdom)
- `npm run generate:icons` — regenerate `icons-v2-generated/` from raw SVGs in `src/components/icons-v2/` (never hand-edit generated files)
- `npm run storybook` — Storybook on port 6006
- `npm run lint` — ESLint, fast pass (no type information), cached. **This is the one to run on your own changes.**
- `npm run lint:fix` — the same with autofix
- `npm run lint:types` — the type-aware pass (floating promises, the `no-unsafe-*` family). Needs an 8 GB heap and a full TypeScript program, so it is a separate stage — run it before pushing, not while iterating. It is deliberately NOT cached: results depend on other files, so a per-file cache entry goes stale when a different module changes
- `npm run lint:cycles` — circular-import check. A CI-only stage, deliberately NOT in `verify`. Not cached either: a cycle is a property of the graph, not of one file. It was reporting zero findings until 2026-08-25 because its config spread the cycles layer standalone instead of over `...base`, in which shape the rule silently finds nothing — see the note at the top of `eslint.cycles.mjs`
- `npm run lint:config-smoke` — not ESLint: a node script that imports every `eslint-config/` entry point and asserts it loads with the expected config-object count. Run it after ANY edit to `eslint.config.mjs`, `eslint.types.mjs` or `eslint-config/**` — a truncated or half-written config shows up here as a changed count, where ESLint itself would just crash with an unhelpful parse error
- `npm run format` / `format:fix` — Prettier (Biome was removed on 2026-08-24)
- `npm run verify` — every gate, cheapest-first so it fails fast: config-smoke → lint → type-check → types → the full test suite (`lint:cycles` is not in it). This is the "am I done?" command; run it before handing off a diff.

### Which of these to run when

**After you finish a change, run `npm run lint`** — the fast, cached pass. That is the linter
meant for the inner loop, and the only ESLint script worth running by hand while you work.

**Run it after a batch of edits, not after every one.** It is a whole-repo pass, so firing it on
each keystroke or each file just interrupts you without telling you anything new; finish the
change you are making, then lint it.

**Never run the slow passes while iterating.** `lint:cycles` walks the whole import graph and
`lint:types` builds a full TypeScript program with an 8 GB heap. Neither is an inner-loop tool:
`lint:types` belongs in `verify` before you hand off a diff, and `lint:cycles` belongs to CI.

| When | Command |
|---|---|
| after a batch of changes | `npm run lint` |
| after a batch of changes | `npm run type-check` |
| the file you touched | `npx vitest run <path>` |
| after ANY edit to a config | `npm run lint:config-smoke` |
| before handing off a diff | `npm run verify` |
| CI only — do not run locally | `npm run lint:cycles` |

**`lint` + `tsc` passing does NOT mean the code is sound.** The type-aware pass is where the
real defects live, because `any` flowing through code *compiles perfectly* — that is the entire
reason the `no-unsafe-*` family exists. The 2026-08-25 burndown found, behind exactly that:
NaN'd token sums, `"[object Object]"` rendered in three user-facing error surfaces, a release page
that blanked on any API error, and a module-level cache poisoned for the whole session. None of
them were visible to `npm run lint` or to `tsc`.

That is an argument for reaching the type-aware pass early, not for running it repo-wide while you
iterate. Point it at the paths you touched instead — `npx eslint <paths> --config eslint.types.mjs`
— and a finding is much cheaper to fix while you still have that file's context.

**Two cache facts worth knowing:** the ESLint cache is keyed on a hash of the config, so editing
`eslint-config/**` or `eslint.*.mjs` invalidates it wholesale and the next `lint` re-checks
everything. And only `lint` caches — `lint:types` and `lint:cycles` pass `--no-cache` on purpose,
because their results depend on *other* files (types cross module boundaries; a cycle is a property
of the graph), so a per-file cache entry is stale the moment a different file changes.

### Suppressing a lint finding is not allowed

`eslint-disable` comments do nothing: `noInlineConfig` is on, and every inert directive is reported,
so a run with one in it fails. `@ts-ignore` and `@ts-nocheck` are errors; `@ts-expect-error` needs a
real explanation of at least 20 characters. Do not add any of them, and do not widen a type to `any`
to get a green run.

If a rule is genuinely wrong for this codebase, change the rule in `eslint-config/` and say why in
the PR — that is a reviewable decision. Silencing it in a source file is not.

**There is no suppressions baseline.** It was drained to zero on 2026-08-25 and the mechanism was
removed: no `eslint-suppressions*.json` files, no `--suppressions-location` in any script. Do not
reintroduce it — not with `--suppress-all`, not with `--suppress-rule`, not by recreating the files.
A baseline entry carries no reason and never expires, so it reads as debt forever and hides real
regressions in the noise.

Every finding must therefore be either fixed or covered by a named `files:`-scoped block that spells
out WHY. `eslint.config.mjs` holds those for the fast pass; type-aware rules (the `no-unsafe-*`
family, `require-await`, `no-floating-promises`) must be exempted in `eslint.types.mjs` **after**
`...typeChecked` — a block for them placed in `eslint.config.mjs` is silently overridden and does
nothing.

### Do not bypass the git hooks

`pre-commit` runs lint-staged (`eslint --fix` + Prettier on staged files). `pre-push`
runs `type-check` + `lint` over the whole package, because a type error your change
caused in a *different* module is invisible to a staged-files check.

Do not get around them — not with `--no-verify` or `-n`, not with `HUSKY=0`, not by
unsetting `core.hooksPath`. **Reaching for the flag because a check went red is
exactly the thing being ruled out.** A failing hook is a real finding; fix it.

**One legitimate exception: when the HOOK is the hazard, not the code.** lint-staged
stashes the working tree to isolate staged content, and on a very large commit that
stash is a genuine risk — it is how this tree was once reduced to 29 files with a
truncated source file mid-session. If you bypass for that reason you must first run
the equivalent checks by hand over the whole package (`npm run lint`,
`npm run type-check`, `npx prettier --check .`) and say so, with the reason, in the
commit message or to the user. Never bypass silently, and never to save time.

**The hooks are not the last line of defence — CI is.** `All Checks` is a required
status check and covers config-smoke, tsc, both lint passes, the cycle pass, Prettier,
the test suite and the build. A `--no-verify` commit cannot merge past a red gate; it
only costs a wasted CI run. That is why this is a discipline rule rather than a
security boundary — and also why bypassing buys you nothing.

## Core Rules (read before editing)

### 1. Check if a component already exists before creating a new one

Before writing any new component, **search the codebase first** to avoid duplicates:

- Grep for similar names (`ProviderButton`, `*-button`, `*-card`, etc.)
- Check `src/components/ui/`, `src/components/features/`, `src/components/navigation/`, `src/components/icons/`, `src/components/layout/`
- Check the main consuming apps too — a component may already exist there and be ready to migrate into the core library
- If something close exists: extend it (new variant, new prop) instead of cloning

Only create a new file when no suitable component exists. Duplicating a component is almost always wrong — the core library exists to prevent exactly that.

### 2. No hardcoded styles — always use ODS tokens

This applies **especially** when generating code from Figma MCP output, but also to all hand-written styles. Figma MCP returns React+Tailwind with raw hex colors, pixel sizes, and font shorthands — that output is a **reference, not final code**. Always translate it to the ODS token system before committing.

The full canonical ODS token rules (colors, spacing, typography, Figma workflow) live in a single
source-of-truth file in this package. It is the same file consumer apps `@import` from the published
package, so **edit the rules only here**:

@src/ODS_TOKEN_RULES.md

### 3. React Hooks — always at the top, unconditionally

```typescript
// BAD — hook after early return
export function X() {
  if (cond) return null
  const data = useSomeHook()  // error
}

// BAD — hook in try/catch
try { const x = useSearchParams() } catch {}

// GOOD — all hooks first, then conditions
export function X() {
  const data = useSomeHook()
  const router = useRouter()
  if (cond) return null
  return <div>{data}</div>
}

// GOOD — conditional logic inside the hook
useEffect(() => {
  if (!enabled) return
  // work
}, [enabled])
```

## Package Architecture

### Modular exports (optimized for tree-shaking)

```typescript
import { Button, Card, Modal } from '@flamingo-stack/openframe-frontend-core/components/ui'
import { AnnouncementBar, AuthProvidersList, AuthTrigger } from '@flamingo-stack/openframe-frontend-core/components/features'
import { useAnnouncements, useDebounce } from '@flamingo-stack/openframe-frontend-core/hooks'
import { cn, getPlatformAccentColor } from '@flamingo-stack/openframe-frontend-core/utils'
import '@flamingo-stack/openframe-frontend-core/styles'
```

**Server/client split**: client entry points are built with a file-level `"use client"` banner — importing a client barrel from a Next.js Server Component poisons it. Server-safe subpaths: `types/*`, `utils`, `platform-domains`, `schemas/contact-schema`, `components/faq/json-ld`, `components/features/mux-origins`. `utils` must never transitively import `src/contexts/*` (rule in `src/contexts/index.ts`).

**Never export React Query hooks from this lib** — `src/hooks/api/index.ts` is intentionally empty (QueryClientProvider context resolution breaks across the package boundary). Share types + pure fetch functions instead; data hooks live in the consuming apps.

### Platform-aware theming

- Platform types (`src/types/platform.ts` `PlatformName`): `openmsp | tmcg | flamingo | flamingo-teaser | universal | marketing-hub | product-hub | revenue-hub | people-hub | openframe | company-hub`
- `NEXT_PUBLIC_APP_TYPE` switches CSS variables at runtime
- Components adapt automatically (colors, variants, announcements)

### ODS (OpenFrame Design System)

- All tokens are CSS custom properties
- Fluid typography via `clamp()`
- Full semantic color palette with state variations
- Dark mode per platform

### Directories

- `src/components/ui/` — base primitives (Button, Card, Input, Modal, Skeleton, data-table/, file-manager/, …)
- `src/components/layout/` — **PageLayout + TitleBlock (⛔ FROZEN — never modify)**, PageContainer variants, ListPageLayout, PageHeading
- `src/components/features/` — composed business components (auth, notifications/, time-tracker/, board/, ai-enrich/, FigmaPrototypeViewer, video pipeline, admin managers)
- `src/components/navigation/` — Header, AppLayout, NavigationSidebar, SlidingSidebar, StickySectionNav
- `src/components/chat/` — embeddable Mingo/Fae chat + the chat stream engine (chunk processor, history merge)
- `src/components/tickets/`, `docs/`, `embeds/`, `help-center-pages/`, `onboarding-guides/`, `faq/`, `contact/`, `case-studies/`, `related-content/` — content/page verticals
- `src/components/icons/` — 133 legacy hand-written icons (exported via `icons/index.ts`)
- `src/components/icons-v2/` (raw SVGs) → `src/components/icons-v2-generated/` (SVGR output, the `components/icons-v2` export) — regenerate via `npm run generate:icons`
- `src/hooks/ui/` `hooks/state/` (URL-state: useApiParams, useQueryParams, introspector) `hooks/platform/` `hooks/nats/`; `hooks/api/` is intentionally empty
- `src/nats/` — nats.ws client, NatsProvider, `buildNatsWsUrl`
- `src/embed-shims/` — next/router|link|image|dynamic registration shims for non-Next consumers
- `src/contexts/` — client-only runtime contexts (EndpointsRuntime, ChatRuntime)
- `src/styles/` — `index.css` + `ods-*.css` token modules
- `src/utils/` — `cn.ts`, `format.ts`, `platform-config.tsx`, `ods-color-utils.ts`, `access-code-client.ts`, …
- `src/platform-domains.ts` — edge-safe platform→domain SSOT (own subpath export)

### TypeScript

- Strict mode, zero-errors policy
- Path alias `@/*` → `./src/*`
- ES2020 target

### Tailwind

Consumers use the shared preset and must include the lib in their content glob (the package ships `src/`; some consumers scan `dist/` instead — both work):

```javascript
import designSystemConfig from '@flamingo-stack/openframe-frontend-core/tailwind.config.ts'

export default {
  presets: [designSystemConfig],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@flamingo-stack/openframe-frontend-core/src/**/*.{js,ts,jsx,tsx}',
  ],
}
```

Breakpoints are non-standard: `md` **800px**, `lg` 1280px, `xl` 1440px. The preset maps the `ods-attention-*` palette classes (added so ~24 legacy component files render colored at all), but they are **legacy-only** — new and modified code must use the semantic `ods-error/success/warning` tokens, which alias the same palette 1:1 (`text-ods-attention-red-error` ≡ `text-ods-error`, `bg-ods-attention-red-error-secondary` ≡ `bg-ods-error-secondary`). Also: the ODS color vars hold hex values, so Tailwind alpha modifiers (`bg-ods-error/20`) silently produce no CSS — use the `-secondary` token variants instead.

## Key Component Systems

### Authentication

Unified system supporting page-based and modal-based flows.

- **`AuthProvidersList`** — page-based (e.g. OpenFrame)
- **`AuthTrigger`** — modal-based (e.g. multi-platform-hub)
- **`ProviderButton`** — individual SSO button (google / microsoft / slack / github)
- **`AuthModal`** — modal wrapper

SSO provider config:

```typescript
interface SSOConfigStatus {
  provider: string     // 'google' | 'microsoft' | 'slack' | 'github'
  enabled: boolean
  clientId?: string
}
```

All provider icons are embedded SVG (no external deps). OpenFrame routes: `/auth`, `/auth/signup`, `/auth/login`.

### Modal

Custom in-house implementation (not Radix Dialog) — reliable rendering, Escape/backdrop close, scroll block, `z-[1300]`, ODS theming.

```typescript
import { Modal, ModalHeader, ModalTitle, ModalFooter } from '@flamingo-stack/openframe-frontend-core/components/ui'

<Modal isOpen={open} onClose={close}>
  <ModalHeader>
    <ModalTitle>Title</ModalTitle>
  </ModalHeader>
  <ModalFooter>
    <Button variant="outline" onClick={close}>Cancel</Button>
    <Button onClick={confirm}>Confirm</Button>
  </ModalFooter>
</Modal>
```

### Toast

**Sonner-based** (`src/components/ui/toaster.tsx` wraps sonner's `showToast`), `z-[9999]`. Use `useToast()` (`src/hooks/use-toast.ts`) — it normalizes `variant: 'destructive'` → sonner `'error'`, so both spellings work in consumers.

### Button

Variants: `primary`, `secondary`, `outline`, `footer-link` (minimal, zero-padding footer nav variant).

- Secondary uses `text-black` for guaranteed contrast
- `onClick` works when `href` is set (passed through to Next.js `Link`)
- Supports loading state and embedded icons

### Skeleton

`Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonGrid`, `SkeletonButton`, `SkeletonHeading`, `SkeletonList`, `SkeletonNavigation`. All use `bg-ods-bg-secondary`.

### Tooltip

Radix-based. `z-[2147483647]` so it beats everything. Always wrap trigger in `TooltipProvider`.

### Header

`autoHide` flag in `HeaderConfig` — true hides on scroll-down/shows on scroll-up, false stays fixed. Z-index `z-[50]`. `border-ods-border` is always applied.

### StickySectionNav

Paired with `useSectionNavigation(sections, { offset })`. Native `getElementById` + `offsetTop` + `window.scrollTo({ behavior: 'smooth' })`. `isScrollingFromClick` flag prevents scroll-detection fighting programmatic scrolling. Mobile-hidden by default.

### Footer

Config-driven:
- `config.logo.getElement()` — custom logo element
- `config.nameElement.getElement()` — platform name with custom font
- `config.sections` — dynamic link sections
- `config.customComponent` — platform-specific content (e.g. waitlist card)

### FigmaPrototypeViewer

Location: `src/components/features/figma-prototype-viewer.tsx`.

- PostMessage navigation via Figma Embed Kit 2.0 (`NAVIGATE_TO_FRAME_AND_CLOSE_OVERLAYS`) — no iframe reloads
- Event-driven loading via Figma's `NEW_STATE` event — no timeouts
- Split mobile/desktop config: `desktopFileKey` / `mobileFileKey`, `desktopStartingPoint` / `mobileStartingPoint`, `desktopContentDimensions` / `mobileContentDimensions`
- Per-section `startingNodeId` (desktop) and `mobileStartingNodeId`
- Env-var overrides: `NEXT_PUBLIC_FIGMA_DESKTOP_FILE_KEY`, `NEXT_PUBLIC_FIGMA_MOBILE_FILE_KEY`, `*_STARTING_POINT`, `*_WIDTH`, `*_HEIGHT`, `NEXT_PUBLIC_FIGMA_DEBUG`
- Priority order: env > component config > defaults
- Mobile touch gesture detection with 500ms interaction window for page-scroll vs iframe-interact

Breaking: legacy single `fileKey` is removed. Must use split config.

### YouTubeEmbed

CSP-safe iframe mode, via `react-player`. Props: `videoId`, `title`, `showTitle`, `showMeta`, `minimalControls`. Pure ODS tokens — no hardcoded colors.

### ParallaxImageShowcase

Framer Motion. Global mouse tracking (window-level) + scroll-based transforms. Three-layer depth. `INTENSITY` variable for tuning. `layout="openmsp"` gives the two-row logo-then-images variant.

### PageContainer

Standardized container for Flamingo website sections. Located at `src/components/layout/page-container.tsx`.

```typescript
<PageContainer>{children}</PageContainer>

<PageContainer backgroundStyle={{ background: 'linear-gradient(...)' }}>
  {children}
</PageContainer>
```

Props: `fullWidthBackground`, `backgroundClassName`, `backgroundStyle`, `contentPadding` (default `px-6 md:px-20 py-6 md:py-10`), `maxWidth` (default `max-w-[1920px]`), `as`, `id`.

All new Flamingo website sections must use this instead of hand-rolled container markup.

## Platform Configuration (single source of truth)

`src/utils/platform-config.tsx` is the **only** place platform mappings live. Never re-declare `platformIcons` / `platformLogos` / `platformColors` inside a component.

```typescript
import {
  getPlatformIconComponent,   // large icon
  getSmallPlatformIcon,        // small icon
  getPlatformDisplayName,
  getPlatformDescription,
  getPlatformColor,
  isValidPlatform,
  getAllPlatformNames,
  platformDisplayNames,
  platformColors,
  platformDescriptions,
} from '@flamingo-stack/openframe-frontend-core/utils'
```

Supported platforms: see `PlatformName` in `src/types/platform.ts` (openmsp, openframe, flamingo, flamingo-teaser, tmcg, universal, plus the hub platforms).

Adding a new platform = edit this file only; every component that uses these helpers picks it up automatically.

## Access Code System

Client utilities at `src/utils/access-code-client.ts`:

```typescript
validateAccessCode(email, code)            // check only
consumeAccessCode(email, code)             // mark as used
validateAndConsumeAccessCode(email, code)  // both
useAccessCodeIntegration()                 // React hook
```

Backed by `POST /api/validate-access-code` and `POST /api/consume-access-code`. Codes are one-time-use; always validate first, then consume *after* successful registration.

Types in `src/types/access-code-cohorts.ts`.

## Loading States

### Query configuration

```typescript
useQuery({
  queryKey: ['admin-data', filters],
  queryFn: fetchData,
  staleTime: 0,
  gcTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  // DO NOT use placeholderData — it prevents loading states
})
```

### Skeleton pattern

Standard admin skeleton: 12 items in a 3-column grid matching the real content layout.

```typescript
{isLoading ? (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(12)].map((_, i) => (
      <div key={i} className="bg-ods-card border border-ods-border rounded-lg p-6 animate-pulse">
        {/* skeleton blocks using bg-ods-border */}
      </div>
    ))}
  </div>
) : data?.length === 0 ? (
  <EmptyState />
) : (
  <DataGrid data={data} />
)}
```

### Rules

- Always show a skeleton during fetch
- Keep filter UI state (selected buttons stay selected) while skeleton is showing
- Match skeleton dimensions to real content (no layout shift)
- Hierarchy: auth loading → data loading → empty state → content

## Common Gotchas

- **External images** (e.g. Google avatars): use `getProxiedImageUrl` pattern — direct external URLs get blocked by ad-blockers / privacy extensions.
- **URLSearchParams**: `.get()` returns `null`, not `undefined`, for missing keys. Handle accordingly.
- **Supabase uploads**: use `new Uint8Array(arrayBuffer)`, not Node `Buffer.from()`. Use `clients.publicClient` for authenticated ops, not `serviceRoleClient`.
- **Next.js 15 dynamic routes**: params are `Promise<{ id: string }>` — must `await params`.
- **SSO profile updates**: only overwrite profile fields if currently empty — preserves manual user uploads.

## Development Workflow

- **Consumers only see built output** — after every change run `npm run build && yalc push` (or keep `npm run yalc:watch` running). Editing `src/` alone does nothing for linked apps, except styles/Tailwind preset which ship as source.
- The consumer must be yalc-linked first (`npm run core:link` in openframe-frontend); apps periodically get de-yalc'd back to a pinned registry version — check the consumer's `package.json` before assuming a push reaches it.
- Type-check before shipping (`npm run type-check`, zero errors).
- Test across all platforms before releasing a breaking change — this package has many consumers and no semver discipline (0.0.x).

## Best Practices

1. **Reuse over recreate** — search first (see Core Rule 1)
2. **ODS compliance** — tokens only, no hardcoded colors or raw font sizes (see Core Rule 2)
3. **Hooks** unconditional at the top (see Core Rule 3)
4. **Platform agnostic** — core components must work across all platforms
5. **TypeScript strict** — zero errors
6. **Accessibility** — ARIA, keyboard, focus management
7. **Mobile-first** responsive design
8. **Loading states** via skeletons
9. **Error feedback** via toast
10. **Z-index** from the documented hierarchy, don't invent

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@flamingo/ui-kit` is a shared, source-only TypeScript design system package used by all Flamingo products (OpenMSP, OpenFrame, Admin Hub, Flamingo Website, Flamingo Teaser, TMCG). It provides components, hooks, styles, and utilities.

- **UI-Kit components**: reusable, platform-agnostic (Button, Card, Modal, etc.)
- **Application components**: platform-specific business components that *consume* UI-Kit (e.g. `openmsp-video-stats-section.tsx`)

## Commands

- `npm run type-check` — TypeScript type checking
- `npm run dev` — source-only, no build step
- `npm run lint` — placeholder (no linter configured yet)

No test commands are configured.

## Core Rules (read before editing)

### 1. Check if a component already exists before creating a new one

Before writing any new component, **search the codebase first** to avoid duplicates:

- Grep for similar names (`ProviderButton`, `*-button`, `*-card`, etc.)
- Check `src/components/ui/`, `src/components/features/`, `src/components/navigation/`, `src/components/icons/`, `src/components/layout/`
- Check the main consuming apps too — a component may already exist there and be ready to migrate into the UI-Kit
- If something close exists: extend it (new variant, new prop) instead of cloning

Only create a new file when no suitable component exists. Duplicating a component is almost always wrong — the UI-Kit exists to prevent exactly that.

### 2. No hardcoded styles — always use ODS tokens

This applies **especially** when generating code from Figma MCP output, but also to all hand-written styles.

Figma MCP returns React+Tailwind with raw hex colors, pixel sizes, and font shorthands. That output is a **reference, not final code**. Always translate it to the ODS token system before committing.

**Colors** — never write hex, rgb, or Tailwind color scales (`bg-gray-900`, `text-white`, `#FFD951`). Use ODS CSS variables or their Tailwind equivalents:
- `bg-ods-bg`, `bg-ods-bg-secondary`, `bg-ods-card`
- `text-ods-text-primary`, `text-ods-text-secondary`, `text-ods-text-on-accent`
- `border-ods-border`
- `bg-ods-accent`, `text-ods-accent`
- `bg-ods-error`, `text-ods-error` (and `success`, `warning`)

**Typography** — never write raw `text-[32px]`, `text-4xl`, or font-family overrides. Use the typography scale:
- Headings: `text-h1` … `text-h6` (or `text-heading-1` … `text-heading-6`)
- Body: `text-body`, `text-body-sm`, `text-body-lg`
- Labels / meta: `text-label`, `text-caption`
- Font family is already wired into the platform theme — don't override with `font-['DM_Sans']` etc. unless the platform config explicitly demands it (e.g. Footer `nameElement`).

**Spacing / sizing** — prefer Tailwind's standard scale (`p-6`, `gap-4`) over arbitrary values (`p-[23px]`). Arbitrary values are a smell that the designer didn't use the grid.

**Z-index** — use the established hierarchy, don't invent numbers:
- Header: `z-[50]`
- Sidebar overlay: `z-[40]`, sidebar: `z-[45]`
- Modals: `z-[1300]`
- Toasts: `z-[9999]`
- Tooltips: `z-[2147483647]`

**Figma → code workflow**:
1. Call `get_design_context` for the node
2. Treat returned code as a *structural hint only*
3. Map every color, font-size, and font-weight to an ODS token
4. Check the target project for existing components that already match the design intent — reuse over regenerate
5. If Figma uses a token that doesn't exist in ODS, flag it — don't silently hardcode a fallback

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
import { Button, Card, Modal } from '@flamingo/ui-kit/components/ui'
import { AnnouncementBar, AuthProvidersList, AuthTrigger } from '@flamingo/ui-kit/components/features'
import { useAnnouncements, useDebounce } from '@flamingo/ui-kit/hooks'
import { cn, getPlatformAccentColor } from '@flamingo/ui-kit/utils'
import '@flamingo/ui-kit/styles'
```

### Platform-aware theming

- Platform types: `openmsp | admin-hub | openframe | flamingo | flamingo-teaser | tmcg`
- `NEXT_PUBLIC_APP_TYPE` switches CSS variables at runtime
- Components adapt automatically (colors, variants, announcements)

### ODS (OpenFrame Design System)

- All tokens are CSS custom properties
- Fluid typography via `clamp()`
- Full semantic color palette with state variations
- Dark mode per platform

### Directories

- `src/components/ui/` — base primitives (Button, Card, Input, Modal, Skeleton, PageContainer, …)
- `src/components/features/` — complex composed components (AnnouncementBar, Auth, FigmaPrototypeViewer, YouTubeEmbed, ParallaxImageShowcase)
- `src/components/navigation/` — Header, navigation-sidebar, StickySectionNav
- `src/components/icons/` — centralized icons (GitHubIcon, XLogo, OpenFrameLogo, …). New icons go here and are exported via `icons/index.ts`.
- `src/components/layout/` — PageContainer and layout primitives
- `src/hooks/api/` `hooks/ui/` `hooks/platform/` — data, UI, and platform hooks
- `src/styles/` — `index.css` + `ods-*.css` token modules
- `src/utils/` — `cn.ts`, `platform-config.tsx`, `access-code-client.ts`, `ods-color-utils.ts`

### TypeScript

- Strict mode, zero-errors policy
- Path alias `@/*` → `./src/*`
- ES2020 target

### Tailwind

Consumers extend the shared config:

```javascript
import designSystemConfig from '@flamingo/ui-kit/tailwind-config'

export default {
  ...designSystemConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './flamingo-design-system/src/**/*.{js,ts,jsx,tsx}'
  ]
}
```

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
import { Modal, ModalHeader, ModalTitle, ModalFooter } from '@flamingo/ui-kit/components/ui'

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

Radix-based, bottom-right, `z-[9999]`, content-based width, `flex-col gap-2` stacking. Use `useToast()`.

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
} from '@flamingo/ui-kit/utils/platform-config'
```

Supported platforms: `openmsp`, `openframe`, `flamingo`, `flamingo-teaser`, `admin-hub`, `tmcg`, `universal`.

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

- Source-only package: changes are reflected immediately in consumers, no build step
- Type-check before shipping
- Test across all platforms before releasing a breaking change

## Best Practices

1. **Reuse over recreate** — search first (see Core Rule 1)
2. **ODS compliance** — tokens only, no hardcoded colors or raw font sizes (see Core Rule 2)
3. **Hooks** unconditional at the top (see Core Rule 3)
4. **Platform agnostic** — UI-Kit components must work across all platforms
5. **TypeScript strict** — zero errors
6. **Accessibility** — ARIA, keyboard, focus management
7. **Mobile-first** responsive design
8. **Loading states** via skeletons
9. **Error feedback** via toast
10. **Z-index** from the documented hierarchy, don't invent

# @flamingo-stack/openframe-frontend-core

Shared design system and component library for Flamingo platforms (OpenMSP, OpenFrame, Admin Hub, Flamingo Website, TMCG).

## Installation

```bash
npm install @flamingo-stack/openframe-frontend-core
```

## Usage

### Components

```tsx
import { Button, Card, Input, Modal, Tag } from '@flamingo-stack/openframe-frontend-core/components/ui'
import { YouTubeEmbed, FigmaPrototypeViewer } from '@flamingo-stack/openframe-frontend-core/components/features'
import { GitHubIcon, OpenFrameLogo } from '@flamingo-stack/openframe-frontend-core/components/icons'
```

### Hooks

```tsx
import { useDebounce, useMediaQuery, useToast } from '@flamingo-stack/openframe-frontend-core/hooks'
```

### Utilities

```tsx
import { cn, formatDate, formatPrice, getBaseUrl } from '@flamingo-stack/openframe-frontend-core/utils'
```

### Styles

```tsx
// Import in your layout or _app.tsx
import '@flamingo-stack/openframe-frontend-core/styles'
```

### Tailwind Config

Extend the shared Tailwind config in your project:

```ts
import designSystemConfig from '@flamingo-stack/openframe-frontend-core/tailwind.config.ts'

export default {
  ...designSystemConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@flamingo-stack/openframe-frontend-core/src/**/*.{js,ts,jsx,tsx}'
  ]
}
```

## Package Exports

| Export Path | Description |
|---|---|
| `.` | Main entry (all components, hooks, utils) |
| `./components/ui` | Base UI components (Button, Card, Input, Modal, Tag, etc.) |
| `./components/features` | Complex components (YouTubeEmbed, FigmaPrototypeViewer, AuthProvidersList) |
| `./components/icons` | Icon components (GitHubIcon, OpenFrameLogo, XLogo) |
| `./components/icons-v2` | Generated icon set |
| `./components/navigation` | Navigation components (Header, StickySectionNav) |
| `./components/toast` | Toast notification system |
| `./hooks` | React hooks (useDebounce, useMediaQuery, useToast, etc.) |
| `./utils` | Utilities (cn, formatDate, formatPrice, getBaseUrl, platform-config) |
| `./types` | TypeScript type definitions |
| `./styles` | CSS styles and ODS design tokens |
| `./nats` | NATS WebSocket utilities |
| `./fonts` | Font configuration |

## Design System (ODS)

The package includes the OpenFrame Design System (ODS) with:

- **CSS Variables** — Design tokens as custom properties
- **Responsive Typography** — `text-h1` through `text-h6` utilities via Tailwind plugin
- **Platform Theming** — Automatic color adaptation based on `NEXT_PUBLIC_APP_TYPE`
- **Breakpoints** — `md: 800px`, `lg: 1280px`, `xl: 1440px` (mobile-first)

### Tailwind Merge Configuration

The `cn()` utility extends `tailwind-merge` to recognize ODS typography classes (`text-h1`–`text-h6`) as a separate group, so they don't conflict with `text-color` classes:

```tsx
import { cn } from '@flamingo-stack/openframe-frontend-core/utils'

// text-h5 and text-red-500 coexist correctly
cn('text-h5', 'text-red-500') // => "text-h5 text-red-500"
```

## Platform Support

| Platform | App Type | Accent Color |
|---|---|---|
| OpenMSP | `openmsp` | Yellow (#FFC008) |
| OpenFrame | `openframe` | Cyan (#5EFAF0) |
| Flamingo | `flamingo` | Pink (#FF6B6B) |
| Admin Hub | `admin-hub` | Pink (#F357BB) |
| Flamingo Teaser | `flamingo-teaser` | Pink |
| TMCG | `tmcg` | Purple (#8B5CF6) |

Platform detection is automatic via `NEXT_PUBLIC_APP_TYPE` environment variable.

## Development

```bash
# Build the package
npm run build

# Build without type declarations (faster)
npm run build:fast

# Watch mode
npm run dev

# Type checking
npm run type-check

# Run tests
npm run test

# Storybook
npm run storybook

# Publish via yalc (local development)
npm run yalc:push
npm run yalc:watch
```

## Architecture

```
src/
  components/
    ui/           # Base components (Button, Card, Input, Modal, Tag, etc.)
    features/     # Complex components (YouTubeEmbed, FigmaPrototypeViewer)
    icons/        # Centralized icon components
    icons-v2-generated/  # Auto-generated icon set
    navigation/   # Header, StickySectionNav
    toast/        # Toast notification system
  hooks/
    ui/           # UI hooks (useDebounce, useMediaQuery)
    api/          # Data fetching hooks
    platform/     # Platform configuration hooks
  styles/
    index.css     # Main stylesheet
    ods-*.css     # Design token modules
  utils/
    cn.ts         # clsx + tailwind-merge
    platform-config.tsx  # Unified platform configuration
  types/          # TypeScript type definitions
  nats/           # NATS WebSocket integration
```

## Key Dependencies

- **React 18+/19** — Peer dependency
- **Radix UI** — Accessible component primitives
- **Tailwind CSS 3** — Styling with custom design tokens
- **Class Variance Authority** — Component variant management
- **Framer Motion** — Animations
- **Lucide React** — Icons

## License

Private package for Flamingo CX projects.

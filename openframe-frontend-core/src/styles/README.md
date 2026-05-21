# UI Kit Styles Usage Guide

## Overview

This directory contains the complete styling system for `@flamingo/ui-kit` — the ODS (Open Design System) design tokens, the **light/dark theme system**, platform brand overrides, and a small set of vendor stylesheets.

Two orthogonal axes drive the visual layer:

| Axis     | Attribute                            | Sits on    | Controls                                              |
| -------- | ------------------------------------ | ---------- | ----------------------------------------------------- |
| Theme    | `data-theme="light \| dark"`         | `<html>`   | Surfaces, text, borders, status colors                |
| Platform | `data-app-type="openframe \| …"`     | `<body>`   | Brand accent + links only (never bg/text/border)      |

They compose cleanly because they live on different elements and reference the same `--ods-*` primitives.

## File Structure

```
ui-kit/src/styles/
├── index.css                  # Main entry point — imports everything below
├── index.d.ts                 # Side-effect import declaration (no runtime API)
├── app-globals.css            # Global resets, body styling, heading defaults
├── ods-colors.css             # Tier 1 primitives + Tier 2 semantic aliases (theme-aware)
├── ods-design-tokens.css      # Spacing, radii, shadows, durations, typography vars
├── ods-interaction-states.css # Hover / focus / active / disabled state classes
├── ods-responsive-tokens.css  # Breakpoints, fluid font-size clamps
├── dark_theme.tokens.json     # Source of truth for dark primitives (1:1 with ods-colors.css)
├── light_theme.tokens.json    # Source of truth for light primitives
├── storybook-fonts.css        # Direct font CSS for Storybook (Next.js apps use next/font)
├── vendor-react-easy-crop.css # Vendor override for react-easy-crop
├── vendor-react-scroll.css    # Vendor override for react-scroll
└── README.md                  # This file
```

## How to Use

### 1. Basic import (recommended)

Import the complete styling system once in your root CSS:

```css
/* app/globals.css */
@import "@flamingo/ui-kit/styles";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

This single import includes:

- All ODS design tokens (colors, typography, spacing, shadows, durations)
- Both light **and** dark theme primitives (one is active at a time via `data-theme`)
- Platform brand overrides (accent + links)
- Global resets and vendor overrides

### 2. Wrap the app in `ThemeProvider`

CSS alone is not enough — something has to set `data-theme` on `<html>` and persist the user's preference. That's `ThemeProvider`:

```tsx
// app/layout.tsx (Next.js App Router)
import { ThemeProvider } from "@flamingo/ui-kit/components/features";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body data-app-type="openframe">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

> `suppressHydrationWarning` on `<html>` is required — `next-themes` writes `data-theme` before React hydrates.

### 3. Build a toggle with `useThemeToggle`

The kit is **headless by design** — apps own their button visuals.

```tsx
"use client";
import { useThemeToggle } from "@flamingo/ui-kit/components/features";
import { Button } from "@flamingo/ui-kit/components/ui";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { isDark, toggle, mounted } = useThemeToggle();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {mounted && (isDark ? <Sun /> : <Moon />)}
    </Button>
  );
}
```

A live demo of all three patterns (`Showcase`, `ToggleOnly`, `SideBySide`) lives in Storybook under **Foundations / Theme** (`src/stories/Theme.stories.tsx`).

## Theme System

### Defaults & contract

- **Modes**: `light` and `dark` only. No `system` mode (`enableSystem={false}`).
- **Default**: `dark`.
- **Persistence**: `localStorage` key `ods-theme` (exported as `THEME_STORAGE_KEY`).
- **Attribute**: `data-theme` on `<html>` (exported as `THEME_ATTRIBUTE`).
- **Anti-flash**: handled by `next-themes`'s pre-paint script — no hand-rolled `<ThemeScript>` needed.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 1 — Primitives (--ods-*)                       THEME-SCOPED    │
│   :root, [data-theme="dark"], .theme-dark   → dark values (default) │
│   [data-theme="light"], .theme-light        → light values          │
├─────────────────────────────────────────────────────────────────────┤
│ Tier 2 — Semantic aliases (--color-*)               THEME-AGNOSTIC  │
│   var(--color-bg) → var(--ods-system-greys-background)              │
│   …auto-follows whichever tier-1 set is active                      │
├─────────────────────────────────────────────────────────────────────┤
│ Platform overrides ([data-app-type="…"])             ACCENT ONLY    │
│   Override --color-accent-* / --color-link-* / --ods-accent         │
│   Reference --ods-* so they follow the active theme automatically   │
└─────────────────────────────────────────────────────────────────────┘
```

Components never read tier 1 directly — they always reference tier 2 (`--color-*`) or its Tailwind equivalents (`bg-ods-*`, `text-ods-*`, `border-ods-*`). That's why the same JSX renders correctly in both themes.

### Escape hatches

For previews, side-by-side comparisons, or scoping a theme to a subtree, use the class form:

```tsx
<div className="theme-light">
  {/* renders with light primitives regardless of <html> data-theme */}
</div>

<div className="theme-dark">
  {/* renders with dark primitives */}
</div>
```

There is also a `.theme-high-contrast` opt-in for accessibility.

### Source of truth

`dark_theme.tokens.json` and `light_theme.tokens.json` are the canonical token values; `ods-colors.css` mirrors them 1:1. Update tokens by editing both the JSON and the CSS in lockstep (the JSON exists so design tools / token transformers can consume it).

## Platform Support

Platforms set **brand accent + link colors only** (and a couple of intentional brand scrims). They never touch surfaces, text or borders — those are owned by the theme.

| `data-app-type`   | Accent                       | Notes                                |
| ----------------- | ---------------------------- | ------------------------------------ |
| `openframe`       | Yellow `--ods-open-yellow-base`     | Cyan links                    |
| `openmsp`         | Yellow `--ods-open-yellow-base`     |                               |
| `flamingo`        | Pink `--ods-flamingo-pink-base`     | Dark scrim by-design          |
| `flamingo-teaser` | Pink `--ods-flamingo-pink-base`     |                               |
| `tmcg`            | Pink `--ods-flamingo-pink-base`     | Cards share page background; dark scrim |
| `marketing-hub`   | Pink `--ods-flamingo-pink-base`     |                               |
| `product-hub`     | Green `--ods-attention-green-success` |                             |
| `revenue-hub`     | Yellow-warning `--ods-attention-yellow-warning` |                   |
| `people-hub`      | Cyan `--ods-flamingo-cyan-base`     |                               |
| `company-hub`     | Red `--ods-attention-red-error`     |                               |

Adding a new platform = add one `[data-app-type="…"]` block in `ods-colors.css`. Because the block references `--ods-*` primitives (not raw hex), the new platform inherits dark/light flipping for free.

## Key CSS Variables

### Surfaces & text (Tier 2 — what components actually use)

```css
--color-bg                  /* Page background */
--color-bg-card             /* Card / panel surface */
--color-bg-card-secondary   /* Secondary card layer */
--color-bg-surface          /* Raised surface (e.g. inputs) */
--color-bg-overlay          /* Modal scrim */
--color-bg-backdrop         /* Heavier scrim */

--color-text-primary
--color-text-secondary
--color-text-tertiary
--color-text-muted
--color-text-on-accent

--color-border-default
--color-border-hover
--color-border-focus
--color-divider
```

### Accent & status

```css
--color-accent-primary  /* Platform-set */
--color-accent-hover
--color-accent-active
--color-focus-ring

--color-success / -hover / -secondary
--color-error   / -hover / -secondary
--color-warning / -hover / -secondary
--color-info    / -hover
```

### Typography

All typography is driven by CSS variables defined in `ods-design-tokens.css`. Both Tailwind and component styles read these — single source of truth.

```css
/* Font families */
--font-family-heading: "Azeret Mono", "SF Mono", Monaco, …, monospace;
--font-family-body:    "DM Sans", -apple-system, BlinkMacSystemFont, …, sans-serif;

/* Per-heading family overrides */
--font-h1-family: var(--font-family-heading);
--font-h2-family: var(--font-family-heading);
--font-h3-family: var(--font-family-body);
--font-h4-family: var(--font-family-body);
--font-h5-family: var(--font-family-heading);
--font-h6-family: var(--font-family-heading);
```

Tailwind `fontFamily` references the variables, not raw names:

```ts
// tailwind.config.ts
fontFamily: {
  sans:    ["var(--font-family-body)"],
  mono:    ["var(--font-family-heading)"],
  body:    ["var(--font-family-body)"],
  heading: ["var(--font-family-heading)"],
}
```

The `odsTypographyPlugin` ships `text-h1` … `text-h6` composite utilities that bundle family + weight + size + line-height + letter-spacing:

| Class       | Family             | Weight             | Size                          | Line-height                              | Extras              |
| ----------- | ------------------ | ------------------ | ----------------------------- | ---------------------------------------- | ------------------- |
| `text-h1`   | `--font-h1-family` | `--font-h1-weight` | `--font-size-h1-title`        | `--font-line-space-h1-main-title`        | `-0.02em`           |
| `text-h2`   | `--font-h2-family` | `--font-h2-weight` | `--font-size-h2-sub-title`    | `--font-line-space-h2-sub-title`         | `-0.02em`           |
| `text-h3`   | `--font-h3-family` | `--font-h3-weight` | `--font-size-h3-body`         | `--font-line-space-h3-body`              | `-0.02em`           |
| `text-h4`   | `--font-h4-family` | `--font-h4-weight` | `--font-size-h4-body`         | `--font-line-space-h4-body`              | —                   |
| `text-h5`   | `--font-h5-family` | `--font-h5-weight` | `--font-size-h5-caption`      | `--font-line-space-h5-caption`           | `-0.02em` uppercase |
| `text-h6`   | `--font-h6-family` | `--font-h6-weight` | `--font-size-h6-caption`      | `--font-line-space-h6-caption`           | —                   |

Plus size-only utilities (`text-heading-1` … `text-heading-6`) when you want a different font-family but the heading's size + line-height. Fluid scaling via `clamp()` is defined in `ods-responsive-tokens.css`.

### Spacing & radii

```css
--space-px, --space-0_5, --space-1 … --space-20
--radius, --radius-sm, --radius-md, --radius-lg, --radius-xl
--shadow-card, --shadow-card-hover, --shadow-modal, --shadow-focus
```

## Component Integration

### With Tailwind

```tsx
<h1 className="text-h1">Main title</h1>
<p className="text-body text-ods-text-secondary">Body copy</p>

<button className="bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover">
  Platform-coloured button
</button>

<div className="bg-ods-card border border-ods-border text-ods-text-primary">
  Card surface — auto-flips between themes
</div>
```

### With CSS-in-JS

```tsx
const Surface = styled.div`
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
`;
```

## Customisation

### Adding custom styles

```css
@import "@flamingo/ui-kit/styles";

@tailwind base;
@tailwind components;
@tailwind utilities;

.my-component {
  background: var(--color-accent-primary);
  color: var(--color-text-on-accent);
}
```

### Overriding tokens

Override after the import, in the appropriate selector. **Theme-scoped** tokens must be overridden inside the matching selector so they flip:

```css
@import "@flamingo/ui-kit/styles";

/* Theme-stable override (applies to both themes) */
:root {
  --font-family-body: "Inter", sans-serif;
  --radius-lg: 12px;
}

/* Theme-scoped override (per-theme) */
:root[data-theme="dark"] {
  --ods-system-greys-background: #0a0a0a;
}
:root[data-theme="light"] {
  --ods-system-greys-background: #ffffff;
}
```

## Troubleshooting

### Styles not loading

Import the package path, not the file path:

```css
@import "@flamingo/ui-kit/styles";        /* correct */
@import "@flamingo/ui-kit/styles/index.css"; /* incorrect */
```

### Theme flashes wrong colour on first paint

You're missing `suppressHydrationWarning` on `<html>` or you're not wrapping in `ThemeProvider`. Both are required for `next-themes`'s pre-paint script to do its job.

### `useThemeToggle` returns `dark` even after toggling to light

You're reading `theme` before `mounted === true`. Until hydration completes, the hook returns the default (`dark`). Gate UI on `mounted` to avoid hydration mismatch — the [Showcase story](../stories/Theme.stories.tsx) shows the pattern.

### Platform accent not applying

1. `data-app-type` must be on `<body>` (or any ancestor of the components).
2. The value must match one of the supported keys (see the Platform Support table).
3. Make sure your root CSS imports `@flamingo/ui-kit/styles`.

### Component uses brand colour that ignores the theme

That's by design for the few theme-stable shades (`--ods-*-dark`, `--ods-*-light`) and third-party social brand colours. Use a tier-2 alias (`--color-*`) when you want theme-aware behaviour.

### Duplicate styles in the bundle

You're importing both the umbrella (`@flamingo/ui-kit/styles`) and individual ODS files. Pick one.

## Best Practices

1. **Wrap in `ThemeProvider` once** at the app root and use `useThemeToggle()` for UI — never set `data-theme` manually from app code.
2. **Use tier-2 aliases (`--color-*` / `bg-ods-*` / `text-ods-*`)** in components, not tier-1 primitives or raw hex.
3. **Use `text-h1` … `text-h6`** for headings — they apply the full typography stack.
4. **Use `font-heading` / `font-body`** for font-family only.
5. **Test in both themes** — the easiest way is the `Foundations/Theme/SideBySide` Storybook story.
6. **Never hardcode colours, font-families, or pixel sizes** (see project CLAUDE.md, Core Rule 2).
7. **Keep platform overrides to accent-only**. Surfaces / text / borders are the theme's job.

## Migration Notes

- The legacy `ods-dynamic-theming.css` and `ods-fluid-typography.css` have been folded into `ods-colors.css` and `ods-responsive-tokens.css` respectively — drop those imports if you still reference them.
- Previous releases conflated *platform* and *theme* (e.g. "openframe = dark only"). Theme is now a **per-user** choice that exists independently of platform; both axes compose. If you previously branched layout on platform to imply theme, switch to reading `useTheme()`.
- Hardcoded `"DM Sans"` / `"Azeret Mono"` references should become `var(--font-family-body)` / `var(--font-family-heading)`.

## Contributing

1. **Token values** → edit both the `*.tokens.json` AND `ods-colors.css` (they must stay in sync).
2. **New design tokens** → the appropriate `ods-*.css` file. Add a tier-2 alias if components are expected to consume it.
3. **Global resets / body styling** → `app-globals.css`.
4. **Platform brand overrides** → bottom of `ods-colors.css`.
5. **Typography changes** → update CSS variables in `ods-design-tokens.css` **and** the `odsTypographyPlugin` in `tailwind.config.ts`.
6. **Theme system changes** → update `src/components/providers/theme-provider.tsx` and the Storybook demo (`src/stories/Theme.stories.tsx`).
7. **Update this README** when adding new files, new platforms, or changing the theme contract.
8. **Test in both themes** and across at least two platforms before committing.

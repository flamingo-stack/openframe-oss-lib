# ODS Color System Migration Plan

## Goal

Eliminate the unnecessary semantic abstraction layer (Tier 2/3) and align code 1:1 with Figma design tokens. Enable Tailwind opacity modifiers (`bg-ods-bg/50`).

---

## Current State (Problems)

```
Figma tokens (hex)
  → Tier 1: --ods-system-greys-background: #161616
    → Tier 2: --color-bg: var(--ods-system-greys-background)     ← unnecessary layer
      → Tier 3: --bg: var(--color-bg)                            ← unnecessary layer
        → Tailwind: bg: 'var(--color-bg)'                        ← doesn't support /opacity
```

- **3 levels of abstraction** instead of 1
- Designers work with flat tokens, but the code adds semantics that don't exist in Figma
- Hex format doesn't support Tailwind opacity modifier (`bg-ods-bg/50`)
- `data-app-type` duplicates identical values (bg, text, border) for each platform
- 80+ semantic variables, of which only accent/link are actually overridden per platform

## Target State

```
ods_color_tokens.json (hex)
  → script hex→hsl
    → Tier 1: --ods-system-greys-background: 0deg 0% 9%    (HSL channels)
      → Tailwind: bg: 'hsl(var(--ods-system-greys-background) / <alpha-value>)'
```

- **1 level** — flat tokens 1:1 with Figma
- HSL channels for opacity support
- The only abstraction — `--ods-accent` for platform theming (3 variables)

---

## Steps

### Step 1: Build script `generate-ods-colors`

Create a script that reads `ods_color_tokens.json` and generates CSS with HSL channels.

**Input** (`ods_color_tokens.json`):
```json
{
  "color": {
    "system": {
      "greys": {
        "background": { "value": "#161616", "type": "color" }
      }
    }
  }
}
```

**Output** (`ods-colors.generated.css`):
```css
:root {
  --ods-system-greys-background: 0deg 0% 9%;
  --ods-system-greys-black: 0deg 0% 13%;
  --ods-open-yellow-base: 45deg 100% 52%;
  --ods-flamingo-pink-base: 323deg 87% 65%;
  --ods-flamingo-cyan-base: 174deg 95% 67%;
  /* ... all tokens */

  /* Social — stay as hex, opacity not needed */
  --social-slack: #4a154b;
  --social-linkedin: #0a66c2;
  /* ... */
}
```

**Location**: `scripts/generate-ods-colors.ts`
**npm script**: `"generate:colors": "tsx scripts/generate-ods-colors.ts"`

---

### Step 2: Platform theming — accent only

Replace all `data-app-type` blocks (80+ variables) with a minimal override.

**New** (`ods-platform-theme.css`):
```css
:root {
  --ods-accent: var(--ods-open-yellow-base);
  --ods-accent-hover: var(--ods-open-yellow-hover);
  --ods-accent-active: var(--ods-open-yellow-action);
}

[data-app-type="flamingo"],
[data-app-type="flamingo-teaser"] {
  --ods-accent: var(--ods-flamingo-pink-base);
  --ods-accent-hover: var(--ods-flamingo-pink-hover);
  --ods-accent-active: var(--ods-flamingo-pink-action);
}

[data-app-type="people-hub"] {
  --ods-accent: var(--ods-flamingo-cyan-base);
  --ods-accent-hover: var(--ods-flamingo-cyan-hover);
  --ods-accent-active: var(--ods-flamingo-cyan-action);
}

/* ... other platforms */
```

**Delete**: all of Tier 2, Tier 3, `.theme-light`, `.theme-high-contrast` (unused).

---

### Step 3: Update `tailwind.config.ts`

Map Tailwind classes → direct ODS tokens with opacity support.

```ts
ods: {
  // === Backgrounds (semantic shortcuts → direct tokens) ===
  bg:           'hsl(var(--ods-system-greys-background) / <alpha-value>)',
  card:         'hsl(var(--ods-system-greys-black) / <alpha-value>)',
  'bg-hover':   'hsl(var(--ods-system-greys-black-hover) / <alpha-value>)',
  'bg-active':  'hsl(var(--ods-system-greys-black-action) / <alpha-value>)',
  'bg-surface': 'hsl(var(--ods-system-greys-soft-grey) / <alpha-value>)',
  skeleton:     'hsl(var(--ods-system-greys-black) / <alpha-value>)',
  divider:      'hsl(var(--ods-system-greys-soft-grey) / <alpha-value>)',

  // === Borders ===
  border: {
    DEFAULT: 'hsl(var(--ods-system-greys-soft-grey) / <alpha-value>)',
    hover:   'hsl(var(--ods-system-greys-soft-grey-hover) / <alpha-value>)',
    active:  'hsl(var(--ods-system-greys-soft-grey-action) / <alpha-value>)',
    focus:   'hsl(var(--ods-open-yellow-base) / <alpha-value>)',
  },

  // === Text ===
  text: {
    primary:   'hsl(var(--ods-system-greys-white) / <alpha-value>)',
    secondary: 'hsl(var(--ods-system-greys-grey) / <alpha-value>)',
    tertiary:  'hsl(var(--ods-system-greys-soft-grey-hover) / <alpha-value>)',
    muted:     'hsl(var(--ods-system-greys-grey-action) / <alpha-value>)',
    disabled:  'hsl(var(--ods-system-greys-soft-grey) / <alpha-value>)',
    'on-accent': 'hsl(0deg 0% 10% / <alpha-value>)',
  },

  // === Accent (the only abstraction — for platform theming) ===
  accent: {
    DEFAULT: 'hsl(var(--ods-accent) / <alpha-value>)',
    hover:   'hsl(var(--ods-accent-hover) / <alpha-value>)',
    active:  'hsl(var(--ods-accent-active) / <alpha-value>)',
  },

  // === Status ===
  success: {
    DEFAULT:   'hsl(var(--ods-attention-green-success) / <alpha-value>)',
    hover:     'hsl(var(--ods-attention-green-success-hover) / <alpha-value>)',
    secondary: 'hsl(var(--ods-attention-green-success-secondary) / <alpha-value>)',
  },
  error: {
    DEFAULT:   'hsl(var(--ods-attention-red-error) / <alpha-value>)',
    hover:     'hsl(var(--ods-attention-red-error-hover) / <alpha-value>)',
    secondary: 'hsl(var(--ods-attention-red-error-secondary) / <alpha-value>)',
  },
  warning: {
    DEFAULT:   'hsl(var(--ods-attention-yellow-warning) / <alpha-value>)',
    hover:     'hsl(var(--ods-attention-yellow-warning-hover) / <alpha-value>)',
    secondary: 'hsl(var(--ods-attention-yellow-warning-secondary) / <alpha-value>)',
  },
  info: {
    DEFAULT: 'hsl(var(--ods-flamingo-cyan-base) / <alpha-value>)',
    hover:   'hsl(var(--ods-flamingo-cyan-hover) / <alpha-value>)',
  },

  // === Raw palette (direct access to Figma tokens) ===
  yellow: {
    base:      'hsl(var(--ods-open-yellow-base) / <alpha-value>)',
    hover:     'hsl(var(--ods-open-yellow-hover) / <alpha-value>)',
    action:    'hsl(var(--ods-open-yellow-action) / <alpha-value>)',
    secondary: 'hsl(var(--ods-open-yellow-secondary) / <alpha-value>)',
    dark:      'hsl(var(--ods-open-yellow-dark) / <alpha-value>)',
    light:     'hsl(var(--ods-open-yellow-light) / <alpha-value>)',
  },
  pink: {
    base:      'hsl(var(--ods-flamingo-pink-base) / <alpha-value>)',
    hover:     'hsl(var(--ods-flamingo-pink-hover) / <alpha-value>)',
    action:    'hsl(var(--ods-flamingo-pink-action) / <alpha-value>)',
    secondary: 'hsl(var(--ods-flamingo-pink-secondary) / <alpha-value>)',
    dark:      'hsl(var(--ods-flamingo-pink-dark) / <alpha-value>)',
    light:     'hsl(var(--ods-flamingo-pink-light) / <alpha-value>)',
  },
  cyan: {
    base:      'hsl(var(--ods-flamingo-cyan-base) / <alpha-value>)',
    hover:     'hsl(var(--ods-flamingo-cyan-hover) / <alpha-value>)',
    action:    'hsl(var(--ods-flamingo-cyan-action) / <alpha-value>)',
    secondary: 'hsl(var(--ods-flamingo-cyan-secondary) / <alpha-value>)',
    dark:      'hsl(var(--ods-flamingo-cyan-dark) / <alpha-value>)',
    light:     'hsl(var(--ods-flamingo-cyan-light) / <alpha-value>)',
  },
  grey: {
    bg:        'hsl(var(--ods-system-greys-background) / <alpha-value>)',
    black:     'hsl(var(--ods-system-greys-black) / <alpha-value>)',
    soft:      'hsl(var(--ods-system-greys-soft-grey) / <alpha-value>)',
    grey:      'hsl(var(--ods-system-greys-grey) / <alpha-value>)',
    white:     'hsl(var(--ods-system-greys-white) / <alpha-value>)',
  },
}
```

---

### Step 4: Component migration

Tailwind classes **don't change** — `bg-ods-bg`, `text-ods-text-primary`, `border-ods-border` remain the same. Only what's behind them changes (CSS variable → direct token in HSL).

**Needs migration**:
- Inline `style={{ color: 'var(--color-text-secondary)' }}` → `var(--ods-system-greys-grey)` or Tailwind class
- Direct references to `--color-*` in `.tsx` files (~111 occurrences in 29 files)
- Remove `rgba()` hardcodes where `/opacity` can now be used instead

**No changes needed**:
- All `bg-ods-*`, `text-ods-*`, `border-ods-*` classes — they work as before

---

### Step 5: Remove dead code

- [ ] Remove Tier 2 (`--color-*` variables) from `ods-colors.css`
- [ ] Remove Tier 3 (`--bg`, `--card`, `--accent` shorthands) from `ods-colors.css`
- [ ] Remove `.theme-light` and `.theme-high-contrast` (unused)
- [ ] Remove all `data-app-type` blocks except accent overrides
- [ ] Remove `ods-dynamic-theming.css` if it duplicates the above
- [ ] Update `index.css` imports

---

### Step 6: Validation

- [ ] `npm run type-check` — zero errors
- [ ] Visual check across all platforms (OpenFrame, Flamingo, Admin Hub)
- [ ] Verify that `bg-ods-bg/50` works
- [ ] Grep for `--color-` — should be 0 occurrences in `.tsx` files
- [ ] Grep for `rgba(` — replace with Tailwind opacity where possible

---

## File Changes Summary

| File | Action |
|------|--------|
| `scripts/generate-ods-colors.ts` | **Create** — hex→HSL script |
| `src/styles/ods-colors.generated.css` | **Create** — generated output |
| `src/styles/ods-platform-theme.css` | **Create** — accent-only overrides |
| `src/styles/ods-colors.css` | **Delete** — replaced by generated + theme |
| `tailwind.config.ts` | **Edit** — direct ODS tokens with `<alpha-value>` |
| `src/styles/index.css` | **Edit** — update imports |
| `~29 .tsx files` | **Edit** — replace `--color-*` refs with `--ods-*` |
| `package.json` | **Edit** — add `generate:colors` script |

## Migration Safety

- Tailwind class names (`bg-ods-bg`, `text-ods-text-primary`) **remain identical**
- Only the underlying CSS variables change
- Zero visual difference after migration (same colors, same rendering)
- Opacity support is purely additive — nothing breaks

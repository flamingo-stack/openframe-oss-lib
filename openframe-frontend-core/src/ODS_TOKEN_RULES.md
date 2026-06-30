# ODS Token Rules (canonical)

> **Single source of truth.** This file lives in `@flamingo-stack/openframe-frontend-core` and is
> consumed by every app via `@import` from the installed package. Edit it **only here** in the core
> lib; consumers pick up changes when they bump the package version. Do not copy it into other repos.

## Principle

Never hardcode colors, font families, font sizes, or spacing. Always use ODS tokens — Tailwind
`ods-*` utilities or ODS CSS variables. This applies to **new and modified** components: convert
hardcoded values you touch, even when copying an existing pattern. Figma MCP output is a structural
hint only — translate it to ODS tokens before committing.

## Colors

Source of truth: `src/styles/` + `tailwind.config.ts`. Use the Tailwind `ods-*` classes (the top
semantic layer). Never reach into the raw palette vars such as `var(--ods-attention-red-error)` —
the semantic layer (`--color-*`) exists so theming and renames don't break.

- **Backgrounds:** `bg-ods-bg` (page), `bg-ods-card`, `bg-ods-overlay`, `bg-ods-skeleton`
- **Text:** `text-ods-text-primary`, `-secondary`, `-tertiary`, `-muted`, `-on-accent`
- **Borders:** `border-ods-border` (+ `-hover`, `-active`, `-focus`)
- **Accent:** `bg-ods-accent`, `text-ods-accent` (+ `-hover`, `-active`)
- **Status:** `text-ods-error` / `bg-ods-error`, plus `-success`, `-warning`, `-info` — **NOT** `var(--ods-attention-*)`
- **Brand:** `bg-ods-flamingo-pink`, `bg-ods-flamingo-cyan`, `text-ods-open-yellow`
- **Adaptive:** `text-ods-current` / `bg-ods-current` (platform-aware brand color)

**Forbidden:** hex (`#fff`), `rgb()`, Tailwind color scales (`bg-gray-800`, `text-white`), and raw
`var(--ods-attention-*)` palette vars.

## Spacing

ODS spacing is **not** mapped into Tailwind's spacing scale. Use arbitrary utilities that reference
the spacing CSS variables — the same way the Figma mockups do (`gap: var(--spacing-system-xl)`):

```
gap-[var(--spacing-system-xl)]   p-[var(--spacing-system-lf)]   px-[var(--spacing-system-s)]
```

The same applies to `py/pt/pb/pl/pr`, `mx/my/mt/mb/ml/mr`, `space-x`, `space-y`, `inset`,
`top/right/bottom/left`.

| Token | Mobile | Desktop |
|-------|--------|---------|
| `--spacing-system-zero` | 0 | 0 |
| `--spacing-system-xxs` | 4px | 4px |
| `--spacing-system-xs` | 4px | 8px |
| `--spacing-system-xsf` | 8px | 8px |
| `--spacing-system-s` | 8px | 12px |
| `--spacing-system-sf` | 12px | 12px |
| `--spacing-system-m` | 12px | 16px |
| `--spacing-system-mf` | 16px | 16px |
| `--spacing-system-l` | 16px | 24px |
| `--spacing-system-lf` | 24px | 24px |
| `--spacing-system-xl` | 24px | 40px |
| `--spacing-system-xlf` | 40px | 40px |
| `--spacing-system-xxl` | 40px | 40px |

Mapping from raw Tailwind: `gap-1` → `xxs` (4px), `gap-2` → `xsf` (8px), `gap-3` → `sf` (12px),
`gap-4` → `mf` (16px), `gap-6` → `lf` (24px), `gap-10` → `xlf` (40px). Use the `f` ("fixed") variant
to keep a value constant across breakpoints; the non-`f` variant grows on desktop. `gap-0` / `p-0`
are fine — `0` is unambiguous. Fixed component dimensions (`h-20`, `w-56`) are sizing, not spacing —
leave them as Tailwind sizing classes.

## Typography

Use the ODS composite typography utilities (`text-h1` … `text-h6`). Never write raw `text-[16px]`,
`text-4xl`, or font-family overrides like `font-['DM_Sans']`.

| Class | Font | Weight | Size (tablet+) | Line-height | Text-transform |
|-------|------|--------|-----------------|-------------|----------------|
| `text-h3` | DM Sans | **700 (bold)** | 18px | 24px | none |
| `text-h4` | DM Sans | 500 (medium) | 18px | 24px | none |
| `text-h5` | Azeret Mono | 500 (medium) | 14px | 20px | **uppercase** |
| `text-h6` | DM Sans | 500 (medium) | 14px | 20px | none |

`text-h1` / `text-h2` cover larger headings. Key distinctions:

- `text-h3` vs `text-h4`: same size (18px) but h3 is **bold**, h4 is **medium** — h4 for stat values, h3 for bold headings.
- `text-h5` vs `text-h6`: same size (14px) but h5 is **Azeret Mono uppercase** (section labels like "POLICY TESTING"), h6 is **DM Sans sentence case** (regular labels like "Started", "Duration").

## General

- Convert hardcoded values to ODS tokens even when copying patterns from existing code.
- Match Figma by choosing the typography class on **font family + weight + text-transform**, not just size.
- If Figma uses a token that doesn't exist in ODS, flag it — don't silently hardcode a fallback.
- **Z-index** — use the established hierarchy, don't invent numbers: in-layout sidebar overlay
  `z-[40]` / sidebar `z-[45]` (sit BELOW page chrome — header/footer stay above), header & footer
  `z-[50]`, page-overlay drawer `z-[60]` overlay / `z-[65]` panel (a full-viewport `fixed` drawer that
  must cover the footer — e.g. the admin `SlidingSidebar`), modals `z-[1300]`, toasts `z-[9999]`,
  tooltips `z-[2147483647]`.

## Figma → code workflow

1. Call `get_design_context` for the node.
2. Treat the returned code as a *structural hint only*.
3. Map every color, font-size, font-weight, and spacing value to an ODS token.
4. Check the target project for existing components that already match the design — reuse over regenerate.
5. If Figma uses a token absent from ODS, flag it — don't hardcode a fallback.

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

Two families only: **Azeret Mono** (headings and technical/section labels — `--font-family-heading`)
and **DM Sans** (body text and regular labels — `--font-family-body`).

Use the ODS composite typography utilities (`text-h1` … `text-h6`). Never write raw `text-[16px]`,
`text-4xl`, or font-family overrides like `font-['DM_Sans']`.

Figma source of truth:
[Fonts — styles](https://www.figma.com/design/NYUB1Xe0bJyIuL16aUE81Z/open-design-system?node-id=132-413) ·
[Font Sizes Table — responsive](https://www.figma.com/design/NYUB1Xe0bJyIuL16aUE81Z/open-design-system?node-id=132-460)

Sizes below are `font-size/line-height` in px per breakpoint (desktop ≥1280px, tablet ≥800px,
mobile below):

| Class | Font | Weight | Desktop | Tablet | Mobile | Letter-spacing | Text-transform |
|-------|------|--------|---------|--------|--------|----------------|----------------|
| `text-h1` | Azeret Mono | 600 (semibold) | 56/64 | 48/56 | 40/40 | -0.02em | none |
| `text-h2` | Azeret Mono | 600 (semibold) | 32/40 | 32/40 | 24/32 | -0.02em | none |
| `text-h3` | DM Sans | **700 (bold)** | 18/24 | 18/24 | 14/20 | -0.02em | none |
| `text-h4` | DM Sans | 500 (medium) | 18/24 | 18/24 | 14/20 | 0 | none |
| `text-h5` | Azeret Mono | 500 (medium) | 14/20 | 14/20 | 12/16 | -0.02em | **uppercase** |
| `text-h6` | DM Sans | 500 (medium) | 14/20 | 14/20 | 12/16 | 0 | none |
| `text-code` | Azeret Mono | 500 (medium) | 14/20 | 14/20 | 12/16 | 0 | none |

The breakpoint scaling is built into the utilities via the responsive CSS variables
(`--font-size-h*` / `--font-line-space-h*` in `src/styles/ods-responsive-tokens.css`) — never
re-implement it with `md:`/`lg:` size overrides.

Key distinctions:

- `text-code` vs `text-h5`: both Azeret Mono 14px, but `text-code` is for monospace *content*
  (commands, code blocks, ids, file paths, version strings) — no uppercase, neutral tracking;
  `text-h5` is for uppercase section *labels*. Confirmed by design (2026-07): the `code` style
  is being added to the Figma design system with this exact spec.
- `text-h1` vs `text-h2`: both Azeret Mono semibold — h1 is the page title, h2 a section sub-title.
- `text-h3` vs `text-h4`: same size (18px) but h3 is **bold**, h4 is **medium** — h4 for stat values, h3 for bold headings.
- `text-h5` vs `text-h6`: same size (14px) but h5 is **Azeret Mono uppercase** (section labels like "POLICY TESTING"), h6 is **DM Sans sentence case** (regular labels like "Started", "Duration").

**Component scale tokens.** `text-badge` (10/12, fixed across breakpoints) is the badge/chip stamp
size. It is **not** a step in the scale above and carries no family, weight or casing — it sets size
and line-height only, so it composes with whichever h5/h6 treatment the badge already uses. Reach
for it on badges and chips instead of a raw `text-[10px]`; anything a user reads belongs on
`text-h5`/`text-h6` or larger. Stamps are fixed on purpose — growing them on desktop is what
balloons a badge out of the row it sits in.

## General

- Convert hardcoded values to ODS tokens even when copying patterns from existing code.
- Match Figma by choosing the typography class on **font family + weight + text-transform**, not just size.
- If Figma uses a token that doesn't exist in ODS, flag it — don't silently hardcode a fallback.
- **Z-index** — use the established hierarchy, don't invent numbers: in-layout sidebar overlay
  `z-[40]`, footer `z-[44]` (page-chrome bottom, intentionally below the admin drawer so an open
  right-drawer covers it), admin `SlidingSidebar` drawer overlay `z-[45]` / panel `z-[46]` (a
  full-viewport `fixed` right-drawer that covers the footer but stays BEHIND the header — its panel
  has a header spacer), sticky header `z-[50]`, modals `z-[50]`/`z-[1300]` (Radix dialogs sit at
  `z-50` and win over the header via DOM order; the custom `Modal` is `z-[1300]`), toasts `z-[9999]`,
  tooltips `z-[2147483647]`. The header is deliberately kept at `z-[50]` (not raised above the drawer)
  so it never covers a `z-50` dialog opened on an admin screen.

## Figma → code workflow

1. Call `get_design_context` for the node.
2. Treat the returned code as a *structural hint only*.
3. Map every color, font-size, font-weight, and spacing value to an ODS token.
4. Check the target project for existing components that already match the design — reuse over regenerate.
5. If Figma uses a token absent from ODS, flag it — don't hardcode a fallback.

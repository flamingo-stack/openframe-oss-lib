// Shared style atoms for `Button` and `SplitButton`. Extracted to keep a single
// source of truth for surface colors, outline borders, and split-divider colors.

// Each variant pairs `disabled:` (real `<button disabled>`) with `aria-disabled:`
// (used for `<Link aria-disabled>` since anchors don't support `:disabled`).
export const buttonSurfaceClasses = {
  accent:
    "bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover active:bg-ods-accent-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled",
  outline:
    "bg-ods-card text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:bg-ods-card disabled:text-ods-text-disabled aria-disabled:bg-ods-card aria-disabled:text-ods-text-disabled",
  transparent:
    "bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled",
  destructive:
    "bg-ods-error text-ods-text-on-accent hover:bg-ods-error-hover active:bg-ods-error-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled",
  warning:
    "bg-ods-warning text-ods-text-on-accent hover:bg-ods-warning-hover active:bg-ods-warning-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled",
  // A self-contained glyph (play badge, unmute glyph) that already carries its
  // own scrim: no button surface at all, in any state. Distinct from
  // `transparent`, whose hover/active fills would paint a rectangle behind the
  // glyph — which is why call sites were undoing them with
  // `hover:bg-transparent active:bg-transparent`.
  glyph:
    "bg-transparent text-ods-text-primary hover:bg-transparent active:bg-transparent disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled",
  // Chrome that sits ON media (video cards, image lightboxes): a scrim disc so
  // the glyph stays legible over an arbitrary frame. Promoted to a variant
  // because the walkthrough card, its theater and the bite cards were each
  // stacking the same classes at the call site.
  overlay:
    "rounded-full bg-ods-overlay text-ods-text-primary backdrop-blur-sm hover:text-ods-accent active:text-ods-accent-active disabled:text-ods-text-disabled aria-disabled:text-ods-text-disabled",
} as const

export const outlineBorderClasses =
  "border border-ods-border hover:border-ods-border-hover active:border-ods-border-active disabled:border-ods-border aria-disabled:border-ods-border"

// Glyph scale for the split-layout button family: 16px below md, 24px from md.
//
// Shared because the same page-header action renders through EITHER of the two
// split layouts depending on its shape — `SplitButton` for two click targets, and
// `Button` + `splitIcon` for one with a decorative trailing glyph — and the two sit
// side by side in the same row. They used to disagree: `SplitButton` carried this
// responsive scale while the `Button` split slots re-declared a flat 20px, so a
// "submenu" action's icons rendered 4px smaller than its neighbour's on desktop.
// `Button`'s own flat `[&_svg]:h-5` stays as it is for ordinary (non-split) buttons.
export const splitGlyphSizeClasses = "[&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6"

// Color of the vertical seam between the main and icon halves (split layouts).
export const splitDividerColorClasses = {
  accent: "border-ods-accent-active",
  outline: "border-ods-border",
  transparent: "border-ods-border",
  destructive: "border-ods-error-active",
  warning: "border-ods-warning-active",
} as const

export type ButtonSurfaceVariant = keyof typeof buttonSurfaceClasses

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
} as const

export const outlineBorderClasses =
  "border border-ods-border hover:border-ods-border-hover active:border-ods-border-active disabled:border-ods-border aria-disabled:border-ods-border"

// Color of the vertical seam between the main and icon halves (split layouts).
export const splitDividerColorClasses = {
  accent: "border-ods-accent-active",
  outline: "border-ods-border",
  transparent: "border-ods-border",
  destructive: "border-ods-error-active",
} as const

export type ButtonSurfaceVariant = keyof typeof buttonSurfaceClasses

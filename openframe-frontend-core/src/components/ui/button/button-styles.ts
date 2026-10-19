// Shared style atoms for `Button` and `SplitButton`. Extracted to keep a single
// source of truth for surface colors, outline borders, and split-divider colors.

// Each variant pairs `disabled:` (real `<button disabled>`) with `aria-disabled:`
// (used for `<Link aria-disabled>` since anchors don't support `:disabled`).
export const buttonSurfaceClasses = {
  accent:
    'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover active:bg-ods-accent-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  outline:
    'bg-ods-card text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:bg-ods-card disabled:text-ods-text-disabled aria-disabled:bg-ods-card aria-disabled:text-ods-text-disabled',
  transparent:
    'bg-transparent text-ods-text-primary hover:bg-ods-bg-hover active:bg-ods-bg-active disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled',
  destructive:
    'bg-ods-error text-ods-text-on-accent hover:bg-ods-error-hover active:bg-ods-error-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  warning:
    'bg-ods-warning text-ods-text-on-accent hover:bg-ods-warning-hover active:bg-ods-warning-active disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  // The page's colours swapped: light on a dark theme, dark on a light one. A
  // strong action that must NOT be the accent, for a surface that already
  // holds the one accent call to action (an "Approve" inside a product demo).
  inverted:
    'bg-ods-text-primary text-ods-bg hover:bg-ods-text-secondary active:bg-ods-text-secondary disabled:bg-ods-disabled aria-disabled:bg-ods-disabled',
  // A self-contained glyph (play badge, unmute glyph) that already carries its
  // own scrim: no button surface at all, in any state. Distinct from
  // `transparent`, whose hover/active fills would paint a rectangle behind the
  // glyph — which is why call sites were undoing them with
  // `hover:bg-transparent active:bg-transparent`.
  glyph:
    'bg-transparent text-ods-text-primary hover:bg-transparent active:bg-transparent disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled',
  // A quiet inline text action (a "Show all" / "Show less" disclosure, a
  // secondary "Clear" beside a field): secondary text that takes the accent on
  // hover, and no surface in any state. Promoted to a variant because the
  // disclosure toggle was a primitive <button> restating these classes. Pair
  // with size="compact" and noPaddingX so the label aligns with the text above.
  link: 'bg-transparent text-ods-text-secondary hover:bg-transparent hover:text-ods-accent active:bg-transparent active:text-ods-accent-active disabled:bg-transparent disabled:text-ods-text-disabled aria-disabled:bg-transparent aria-disabled:text-ods-text-disabled',
  // Chrome that sits ON media (video cards, image lightboxes): a scrim disc so
  // the glyph stays legible over an arbitrary frame. Promoted to a variant
  // because the walkthrough card, its theater and the bite cards were each
  // stacking the same classes at the call site.
  overlay:
    'rounded-full bg-ods-overlay text-ods-text-primary backdrop-blur-sm hover:text-ods-accent active:text-ods-accent-active disabled:text-ods-text-disabled aria-disabled:text-ods-text-disabled',
} as const;

export const outlineBorderClasses =
  'border border-ods-border hover:border-ods-border-hover active:border-ods-border-active disabled:border-ods-border aria-disabled:border-ods-border';

// Glyph scale for the split-layout button family: 16px below md, 24px from md.
//
// Shared because the same page-header action renders through EITHER of the two
// split layouts depending on its shape — `SplitButton` for two click targets, and
// `Button` + `splitIcon` for one with a decorative trailing glyph — and the two sit
// side by side in the same row. They used to disagree: `SplitButton` carried this
// responsive scale while the `Button` split slots re-declared a flat 20px, so a
// "submenu" action's icons rendered 4px smaller than its neighbour's on desktop.
// `Button`'s own flat `[&_svg]:h-5` stays as it is for ordinary (non-split) buttons.
export const splitGlyphSizeClasses = '[&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6';

// Per-size glyph scale for `Button`'s split slots AND the loading overlay that
// covers them, so those two read from ONE place — the overlay sits outside both
// slots and inherits neither their sizing nor a shell base rule, so without this it
// would have to restate a number, which is the divergence described above.
//
// Scoped to `Button` on purpose: `SplitButton` keeps its own `small` ramp
// (12px → 16px, vs the flat 16px here) and only shares the `default` step through
// `splitGlyphSizeClasses`. Aligning `small` too is a visible design change, so it is
// not folded in here silently.
export const splitGlyphSizeBySize = {
  default: splitGlyphSizeClasses,
  small: '[&_svg]:h-4 [&_svg]:w-4',
} as const;

// Color of the vertical seam between the main and icon halves (split layouts).
export const splitDividerColorClasses = {
  accent: 'border-ods-accent-active',
  outline: 'border-ods-border',
  transparent: 'border-ods-border',
  destructive: 'border-ods-error-active',
  warning: 'border-ods-warning-active',
} as const;

export type ButtonSurfaceVariant = keyof typeof buttonSurfaceClasses;

/**
 * A button's box per size (height, padding, label type, glyph size): read by `buttonVariants` and by
 * `InteractiveSkeleton.Button`'s `size`, so a button's skeleton is the button's box at every breakpoint.
 */
export const BUTTON_SIZE_CLASS = {
  default: 'h-11 px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-h3 md:h-12',
  small: 'h-6 p-[var(--spacing-system-xs)] text-h5 md:h-8',
  // The CHILD is the affordance (a badge, a chip, a thumbnail): the button
  // contributes the hit target, the focus ring and the keyboard/ARIA
  // semantics, and NO box of its own. Without this, call sites reached for
  // a `className="h-auto p-0"` override to cancel the default box.
  wrap: 'h-auto p-0',
  'small-legacy': 'h-10 px-[var(--spacing-system-m)] py-[var(--spacing-system-xs)] text-[14px] font-bold', // Temporary alias for "small" — deprecated; grep size="small-legacy" (lib + hub) and migrate the remaining consumers before removal
  // 24px pill for slim strips (announcement/promo bars, inline banner
  // actions — Primer banner / Polaris banner / Vercel-bar convention).
  // The label matches the strip's MESSAGE type ramp exactly (DM Sans
  // regular, 13px -> md:14px, snug leading — the announcement bar's
  // subtitle styling): in-strip CTAs must never read louder than the
  // message beside them, so this deliberately uses neither the
  // mono-uppercase control style of "small" nor a heavier weight.
  // Pinned h-6 across breakpoints (24px = the WCAG 2.5.8 target-size
  // floor) with horizontal-dominant padding and a 14px glyph.
  compact: 'h-6 px-[var(--spacing-system-sf)] py-0 font-normal text-h6 [&_svg]:h-3.5 [&_svg]:w-3.5',
  icon: 'h-11 w-11 p-[var(--spacing-system-sf)] md:h-12 md:w-12 [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6',
  // Quiet 32px icon target with a 16px glyph, fixed across breakpoints
  // (Carbon ghost sm / Primer medium / shadcn icon-sm all pin 32px;
  // ≥ the 24px WCAG 2.5.8 target floor). For icon actions that read as
  // metadata rather than CTAs — author-page social rows, share rows.
  // Pair with variant="transparent" for the ghost treatment.
  // `BUTTON_ICON_SM_SIZE` states the same 32px for a layout that must clear one.
  'icon-sm': 'h-8 w-8 p-[var(--spacing-system-xxs)] [&_svg]:h-4 [&_svg]:w-4',
  // 20px inline glyph for affordances that sit INSIDE a line of text —
  // an info hint beside a badge, a copy glyph after an id. `icon-sm`'s
  // 32px target is correct for a metadata row but visually swamps a
  // 10px badge or a 14px label, so hosts were reaching for className
  // overrides to shrink it. Below the WCAG 2.5.8 target floor on purpose:
  // this is only for glyphs whose information is ALSO available another
  // way (tooltip content mirrored into an aria-describedby node), never
  // for a sole means of performing an action.
  'icon-inline': 'h-5 min-h-0 w-5 min-w-0 shrink-0 p-0 [&_svg]:h-3.5 [&_svg]:w-3.5',
  // Bare 56px media glyph (play / unmute over video). A size variant so
  // hosts stop re-implementing a <button> to escape the 20px svg cap.
  'icon-glyph': 'h-14 w-14 p-0 [&_svg]:h-14 [&_svg]:w-14',
} as const;

export type ButtonSizeKey = keyof typeof BUTTON_SIZE_CLASS;


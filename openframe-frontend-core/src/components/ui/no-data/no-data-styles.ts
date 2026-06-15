// Shared style atoms for the NoData (empty-state) family. Mirrors the approach
// used by `button-styles.ts`: a single source of truth for the icon scale, the
// block-group surface and the interactive/disabled treatment, expressed as
// reusable class atoms so new looks can be added without touching the markup.

import { cva, type VariantProps } from "class-variance-authority"

// Leading-icon glyph scale: 16px on mobile, 24px on md+. Color is intentionally
// omitted so the glyph inherits the current text color (and dims with it when
// the block is disabled).
export const noDataIconClasses =
  "inline-flex shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6"

// Surface for the action-block group container: a card-colored panel with a
// border and rounded corners. `overflow-hidden` keeps only the outer blocks
// round — inner blocks stay square.
export const noDataActionsVariants = cva("overflow-hidden rounded-md", {
  variants: {
    variant: {
      outline: "bg-ods-card border border-ods-border",
    },
  },
  defaultVariants: { variant: "outline" },
})

export type NoDataActionsVariant = NonNullable<
  VariantProps<typeof noDataActionsVariants>["variant"]
>

// Interactive treatment for a clickable block: hover/active surface tints, a
// keyboard focus ring, and a disabled state that grays the text and stops
// pointer interaction — matching the disabled outline button.
export const noDataActionInteractiveClasses =
  "cursor-pointer transition-colors hover:bg-ods-bg-hover active:bg-ods-bg-active " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus focus-visible:ring-inset " +
  "disabled:cursor-default disabled:pointer-events-none disabled:text-ods-text-disabled"

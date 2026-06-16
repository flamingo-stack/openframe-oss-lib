// Shared style atoms for the NoData (empty-state) family. A single source of
// truth for the icon scale and the info-block group surface, expressed as CVA
// variants so new looks can be added without touching the markup.

import { cva, type VariantProps } from "class-variance-authority"

// Leading-icon glyph scale: 16px on mobile, 24px on md+. Color is intentionally
// omitted so the glyph inherits the current text color.
export const noDataIconClasses =
  "inline-flex shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 md:[&_svg]:h-6 md:[&_svg]:w-6"

// Surface for the info-block group container: a transparent, bordered panel with
// rounded corners. `overflow-hidden` keeps only the outer blocks round — inner
// blocks stay square.
export const noDataActionsVariants = cva("overflow-hidden rounded-md", {
  variants: {
    variant: {
      outline: "border border-ods-border",
    },
  },
  defaultVariants: { variant: "outline" },
})

export type NoDataActionsVariant = NonNullable<
  VariantProps<typeof noDataActionsVariants>["variant"]
>

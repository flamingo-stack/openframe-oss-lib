// Shared style atoms for the NoData (empty-state) family. A single source of
// truth for the icon scale and the info-block group surface, expressed as CVA
// variants so new looks can be added without touching the markup.

import { cva, type VariantProps } from 'class-variance-authority';

// Leading-icon glyph scale: 16px on mobile, 24px on md+. The slot is that box
// itself, not the glyph's: a glyph still on its way (an agent's mark reads its
// icon from the server) or drawn a frame late leaves the slot its height, so the
// title or label beside it does not jump when it lands. Color is intentionally
// omitted so the glyph inherits the current text color.
export const noDataIconClasses =
  'inline-flex size-4 shrink-0 items-center justify-center content-md:size-6 [&_svg]:h-4 [&_svg]:w-4 content-md:[&_svg]:h-6 content-md:[&_svg]:w-6';

// Surface for the info-block group container: a transparent, bordered panel with
// rounded corners. `overflow-hidden` keeps only the outer blocks round — inner
// blocks stay square.
export const noDataActionsVariants = cva('overflow-hidden rounded-md', {
  variants: {
    variant: {
      outline: 'border border-ods-border',
    },
  },
  defaultVariants: { variant: 'outline' },
});

export type NoDataActionsVariant = NonNullable<VariantProps<typeof noDataActionsVariants>['variant']>;

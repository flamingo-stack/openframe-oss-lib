'use client'

/**
 * ProductReleaseCard — chat entity-card re-export of the canonical
 * `<ProductReleaseCard>` already in `src/components/shared/product-release/`.
 *
 * The shared module is the SOURCE OF TRUTH (lg + sm variants live there).
 * This file just re-exports under `entity-cards/` so the chat barrel
 * (`components/chat/index.ts`) groups every entity card under one path
 * — consumers don't notice the indirection.
 */

export {
  ProductReleaseCard,
  type ProductReleaseCardProps,
  type ProductReleaseCardSize,
  type ProductReleaseCardAnchorProps,
} from '../../shared/product-release/product-release-card'
export { ProductReleaseCardSkeleton } from '../../shared/product-release/product-release-card-skeleton'

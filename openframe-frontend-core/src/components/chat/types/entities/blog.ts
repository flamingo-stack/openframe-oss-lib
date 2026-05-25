/**
 * Blog entity types — chat card consumer barrel.
 *
 * The canonical Blog shapes already live in `src/types/blog.ts` (lib).
 * Audit found NO competing definition in the hub — clients have always
 * relied on this lib shape. This module re-exports the chat-card-relevant
 * surface so the entities barrel has a single import path.
 *
 * Cards consume `BlogPost` (full row) or `BlogPostSummary` (the catalog
 * projection). Tags / categories / author / pagination shapes are
 * re-exported for completeness.
 */

export type {
  BlogPost,
  BlogPostSummary,
  BlogPostPlatform,
  BlogPostCategory,
  BlogPostTag,
  BlogCategory,
  BlogTag,
  BlogAuthor,
  BlogMediaAsset,
  BlogStatus,
  BlogPagination,
  BlogSearchParams,
} from '@/types/blog';

/**
 * Chat entity row types — canonical wire shapes the chat cards consume.
 *
 * Each module here holds the type for one entity surface (commit/PR/review,
 * slack message, hubspot ticket, data-room doc, roadmap item, investor
 * update, onboarding guide, program items, blog, case study, customer
 * interview). They moved here from the hub when the chat surface
 * migrated into lib so the cards have a single, lib-owned source of
 * truth — clients can compose the wire shape without importing hub-tree
 * helpers.
 *
 * Hub-side server utilities that PRODUCE these shapes (DAL functions,
 * RAG mappers, sync engines) stay in the hub — only the wire TYPE
 * (+ pure formatters that operate on it) lives here.
 */

export * from './data-room-doc';
export * from './github-activity';
export * from './hubspot-ticket';
export * from './investor-update';
export * from './onboarding-guide';
export * from './program-types';
export * from './roadmap-item';
export * from './slack-message';
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
} from '../../../../types/blog';
export type { CaseStudy, CaseStudyFilters, CaseStudyListResponse } from '../../../../types/case-study';
export type { ContentRef, ContentRefWithReason } from '../../../../types/content-ref';
export type {
  CustomerInterview,
  CustomerInterviewConfig,
  CustomerInterviewFilters,
  CustomerInterviewListResponse,
} from '../../../../types/customer-interview';
export { programItemToStripProfile } from '../../../features/video-bites-shared';
export type { ProgramAuthorRef } from '../../../features/video-bites-shared';

/**
 * Entity-card barrel — re-exports every chat-surface card under one path.
 *
 * Cards in this directory are PURE PRESENTATION: they take a pre-resolved
 * `href`, optional `placeholderUrl`, and entity data as props. They write
 * NO internal click logic — consumers wrap the card with their own anchor
 * (hub's `<NavLinkAnchor>` or lib's `<NavLinkAnchorViaRuntime>`).
 */

// Existing supporting primitives
export {
  EntityAuthorCard,
  EntityMetadataValueCell,
  EntityMetadataAuthorCell,
  EMPTY_AUTHOR_PLACEHOLDER,
  type EntityAuthorCardProps,
} from './entity-author-card'
export { BlogImagePlaceholder } from './blog-image-placeholder'
export {
  EntityPortraitCard,
  type EntityPortraitCardProps,
  type EntityPortraitPerson,
} from './entity-portrait-card'
export { AdminContentCard } from './admin-content-card'
export { WhatIShippedCard, WhatIShippedCardSkeleton } from './what-i-shipped-card'
export type { WhatIShippedCardData, WhatIShippedCardProps } from './what-i-shipped-card'

// Moved-into-subdir flat cards
export { BlockCard, type BlockCardProps } from './block-card'
export {
  ChatTicketItem,
  type ChatTicketItemData,
  type ChatTicketItemProps,
} from './chat-ticket-item'
export {
  ChatVideoEntityCard,
  type ChatVideoEntityCardProps,
} from './chat-video-entity-card'
export {
  ProductReleaseCard,
  ProductReleaseCardSkeleton,
  type ProductReleaseCardProps,
  type ProductReleaseCardSize,
  type ProductReleaseCardAnchorProps,
} from './product-release-card'
// Card-prop builders: `defaultBuildProductReleaseCardProps` (sm chat default) +
// `buildProductReleaseCardProps` (RICH lg builder — the ProductReleasesView
// default; lifted from the hub so embedders get the full metadata grid).
export {
  defaultBuildProductReleaseCardProps,
  buildProductReleaseCardProps,
  type ProductReleaseCardDerivedProps,
} from './product-release-card-defaults'

// Refactored pure-presentation cards
export { BlogCard, BlogCardSkeleton, type BlogCardProps } from './blog-card'
export {
  CaseStudyCard,
  CaseStudyCardSkeleton,
  type CaseStudyCardProps,
} from './case-study-card'
export {
  CustomerInterviewCard,
  CustomerInterviewCardSkeleton,
  type CustomerInterviewCardProps,
} from './customer-interview-card'
export {
  InvestorUpdateCard,
  InvestorUpdateCardSkeleton,
  type InvestorUpdateCardProps,
} from './investor-update-card'
export {
  OnboardingGuideCard,
  OnboardingGuideCardSkeleton,
  type OnboardingGuideCardProps,
} from './onboarding-guide-card'
export {
  RoadmapCard,
  RoadmapCardSkeleton,
  type RoadmapCardProps,
  type VoteType,
} from './roadmap-card'
export {
  RoadmapVoteButton,
  type RoadmapVoteButtonProps,
} from './roadmap-vote-button'
export { TaskTypeIcon, type TaskTypeIconProps } from './task-type-icon'
export {
  GitHubActivityCard,
  GitHubActivityCardSkeleton,
  type GitHubActivityCardProps,
  type GitHubActivityCardAnchorProps,
} from './github-activity-card'
export {
  SlackMessageCard,
  SlackMessageCardSkeleton,
  type SlackMessageCardProps,
  type SlackMessageCardAnchorProps,
} from './slack-message-card'
export {
  HubspotTicketCard,
  HubspotTicketCardSkeleton,
  type HubspotTicketCardProps,
  type HubspotTicketCardAnchorProps,
} from './hubspot-ticket-card'
export {
  DataRoomDocCard,
  DataRoomDocCardSkeleton,
  type DataRoomDocCardProps,
  type DataRoomDocCardAnchorProps,
} from './data-room-doc-card'
export {
  ProgramCard,
  ProgramCardSkeleton,
  type ProgramCardProps,
} from './program-card'
export {
  CampaignCardAdmin,
  CampaignCardAdminSkeleton,
  type CampaignCardItem,
  type CampaignCardAdminProps,
  type CampaignCardAdminAnchorProps,
} from './campaign-card-admin'
export {
  GenericEntityCard,
  GenericEntityCardSkeleton,
  type GenericEntityCardItem,
  type GenericEntityCardProps,
  type GenericEntityCardAnchorProps,
} from './generic-entity-card'

// Per-type dispatch + ChatCardLoader — single switch over canonical
// chat cards. Adding a new card type = one entry in `CHAT_CARD_REGISTRY`
// inside `./dispatch.tsx`.
export {
  renderChatInlineEntityCard,
  ChatCardLoader,
  type ChatCardRenderOptions,
  type ChatCardDispatchExtras,
} from './dispatch'

// Program author-ref + video-bites profile adapter — re-exported through the
// PACKAGE-EXPORTED chat barrel so the hub can value-import them (deep paths
// into chat/types/* are not in the package exports map and 404 at runtime).
export {
  programItemToStripProfile,
  type ProgramAuthorRef,
} from '../types/entities/program-types'

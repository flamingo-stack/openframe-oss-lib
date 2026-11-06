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
} from './entity-author-card';
export { BlogImagePlaceholder } from './blog-image-placeholder';
export { EntityPortraitCard, type EntityPortraitCardProps, type EntityPortraitPerson } from './entity-portrait-card';
export { useCoverImageFallback, hideOnError, type CoverImageFallback } from './use-cover-image-fallback';
export { AdminContentCard } from './admin-content-card';
export {
  CONTENT_CARD_FRAME_CLASS,
  CONTENT_CARD_SKELETON_FRAME_CLASS,
  ContentCardFrame,
  type ContentCardFrameProps,
} from './content-card-frame';
export {
  AdminContentCardGrid,
  ADMIN_CONTENT_CARD_GRID_CLASS,
  type AdminContentCardGridProps,
} from './admin-content-card-grid';
export { EmployeeEntryCard, EmployeeEntryBadge } from './employee-entry-card';
export type { EmployeeEntryCardData, EmployeeEntryCardProps } from './employee-entry-card';
export { WhatIShippedCard } from './what-i-shipped-card';
export type { WhatIShippedCardData, WhatIShippedCardProps } from './what-i-shipped-card';
export { HowIWorkCard } from './how-i-work-card';
export type { HowIWorkCardData, HowIWorkCardProps } from './how-i-work-card';
export { AiPromptCard } from './ai-prompt-card';
export type { AiPromptCardData, AiPromptCardProps } from './ai-prompt-card';

// Moved-into-subdir flat cards
export { BlockCard, type BlockCardProps } from './block-card';
export { ChatTicketItem, type ChatTicketItemData, type ChatTicketItemProps } from './chat-ticket-item';
export { ChatVideoEntityCard, type ChatVideoEntityCardProps } from './chat-video-entity-card';
export {
  CHAT_CARD_DISCLOSURE,
  CHAT_CARD_DISCLOSURES,
  ChatCardDisclosureButton,
  type ChatCardDisclosureKind,
  ChatCardDisclosureRow,
  chatCardDisclosureOf,
  useChatCardDisclosure,
} from './chat-card-disclosure';
export {
  ProductReleaseCard,
  type ProductReleaseCardProps,
  type ProductReleaseCardSize,
  type ProductReleaseCardAnchorProps,
} from '../../shared/product-release/product-release-card';
// Card-prop builders: `defaultBuildProductReleaseCardProps` (sm chat default) +
// `buildProductReleaseCardProps` (RICH lg builder — the ProductReleasesView
// default; lifted from the hub so embedders get the full metadata grid).
export {
  defaultBuildProductReleaseCardProps,
  buildProductReleaseCardProps,
  type ProductReleaseCardDerivedProps,
} from './product-release-card-defaults';

// Refactored pure-presentation cards
export { BlogCard, type BlogCardProps } from './blog-card';
export { CaseStudyCard, type CaseStudyCardProps } from './case-study-card';
export { CustomerInterviewCard, type CustomerInterviewCardProps } from './customer-interview-card';
export { InvestorUpdateCard, type InvestorUpdateCardProps } from './investor-update-card';
export { OnboardingGuideCard, type OnboardingGuideCardProps } from './onboarding-guide-card';
export { RoadmapCard, type RoadmapCardProps, type VoteType } from './roadmap-card';
export { DesignDocCard, designDocMetaLine, designDocPeople, type DesignDocCardProps } from './design-doc-card';
export { RoadmapVoteButton, type RoadmapVoteButtonProps } from './roadmap-vote-button';
export { TaskTypeIcon, type TaskTypeIconProps } from './task-type-icon';
export {
  GitHubActivityCard,
  type GitHubActivityCardProps,
  type GitHubActivityCardAnchorProps,
} from './github-activity-card';
export { SlackMessageCard, type SlackMessageCardProps, type SlackMessageCardAnchorProps } from './slack-message-card';
export {
  HubspotTicketCard,
  type HubspotTicketCardProps,
  type HubspotTicketCardAnchorProps,
} from './hubspot-ticket-card';
export { DataRoomDocCard, type DataRoomDocCardProps, type DataRoomDocCardAnchorProps } from './data-room-doc-card';
export {
  PROGRAM_CARD_SKELETON_HOSTS,
  PROGRAM_CARD_SKELETON_MEDIA,
  ProgramCard,
  type ProgramCardProps,
} from './program-card';
export {
  CampaignCardAdmin,
  type CampaignCardItem,
  type CampaignCardAdminProps,
  type CampaignCardAdminAnchorProps,
} from './campaign-card-admin';
export {
  GenericEntityCard,
  type GenericEntityCardItem,
  type GenericEntityCardProps,
  type GenericEntityCardAnchorProps,
} from './generic-entity-card';

// Per-type dispatch + ChatCardLoader — single switch over canonical
// chat cards. Adding a new card type = one entry in `CHAT_CARD_REGISTRY`
// inside `./dispatch.tsx`.
export {
  renderChatInlineEntityCard,
  ChatCardLoader,
  chatCardLabel,
  type ChatCardRenderOptions,
  type ChatCardDispatchExtras,
} from './dispatch';

// Program author-ref + video-bites profile adapter — re-exported through the
// PACKAGE-EXPORTED chat barrel so the hub can value-import them (deep paths
// into chat/types/* are not in the package exports map and 404 at runtime).
export { programItemToStripProfile, type ProgramAuthorRef } from '../../features/video-bites-shared';
export { type MingoInfoCardAction, MingoInfoCardActionProvider } from '../mingo-info-card';

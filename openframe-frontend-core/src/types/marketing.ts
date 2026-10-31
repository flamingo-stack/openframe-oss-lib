/**
 * Marketing Campaign Types
 *
 * The rows of the marketing tables as the database holds them (`marketing_campaigns`, `ai_content`, `ai_media`),
 * column for column, and the vocabularies their check constraints allow. A type here names no column the table
 * does not have.
 */

// =============================================================================
// Campaign Types
// =============================================================================

/** `marketing_campaigns.status` (its check constraint). */
export type CampaignStatus = 'draft' | 'active' | 'completed';

/** What a campaign is about (`marketing_campaigns.content_source`). */
export interface CampaignContentSource {
  type: ContentSourceType | null;
  id: number | string | null;
  url?: string | null;
  /** The blog a seed-blog campaign writes its article for. */
  blog_account_id?: number | null;
}

export interface MarketingCampaign {
  id: number;
  name: string;
  description: string | null;
  start_date: string | null;
  goals: string[] | null;
  status: CampaignStatus;
  content_source: CampaignContentSource | null;
  /** The accounts the campaign writes for, each with what to generate (the hub's own shape). */
  selected_accounts: unknown[] | null;
  settings: Record<string, unknown> | null;
  strategy_settings: Record<string, unknown> | null;
  copy_settings: Record<string, unknown> | null;
  image_settings: Record<string, unknown> | null;
  video_settings: Record<string, unknown> | null;
  details_feedback: unknown;
  copy_feedback: unknown;
  image_feedback: unknown;
  video_feedback: unknown;
  designer_feedback: unknown;
  strategy_feedback: unknown;
  /** Editor-provided AI generation instructions (steers Generate Content / Image / Video / Workflow prompts) */
  custom_instructions: string | null;
  ai_effort_score: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// AI Content Types
// =============================================================================

/** `ai_content.content_type` (its check constraint). */
export type ContentType = 'blog_post' | 'channel_post' | 'ad_copy' | 'email' | 'video_script';

/** `ai_content.status` and `ai_media.status` (their check constraints). */
export type ContentStatus =
  | 'generating'
  | 'draft'
  | 'pending_review'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'published';

export interface AIContent {
  id: number;
  campaign_id: number | null;
  content_type: ContentType;
  title: string | null;
  content: string;
  prompt_used: string | null;
  ai_provider: 'anthropic' | 'openai' | null;
  ai_model: string | null;
  metadata: Record<string, unknown> | null;
  status: ContentStatus;
  selected_for_publish: boolean;
  blog_post_id: number | null;
  workflow_id: string | null;
  /** The distribution channel the post is written for. */
  distribution_channel_id: number | null;
  published_at: string | null;
  external_post_id: string | null;
  external_post_url: string | null;
  url_injection_preference?: URLInjectionPreference;
  /** The comment that carries the link, when the link went `as_comment`. */
  external_comment_id?: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// AI Media Types
// =============================================================================

/** Row union. Compare through `utils/media-type` (`isVideoMedia` / `isImageMedia` / `MEDIA_TYPE`), never a literal. */
export type MediaType = 'image' | 'video' | 'figma_export';

/** `ai_media.provider` (its check constraint). */
export type MediaProvider =
  | 'dalle'
  | 'dalle-3'
  | 'sdxl'
  | 'replicate'
  | 'figma'
  | 'manual'
  | 'midjourney'
  | 'flux-2-pro'
  | 'flux-pro'
  | 'flux-dev'
  | 'flux-schnell'
  | 'ideogram-v2'
  | 'ideogram-v3-turbo'
  | 'recraft-v3'
  | 'imagen-4'
  | 'nano-banana-pro'
  | 'seedream-4.5'
  | 'sd-3.5-large'
  | 'veo-3-fast'
  | 'veo-3'
  | 'kling-v2.5'
  | 'luma-ray2'
  | 'pixverse-v5'
  | 'mochi-1'
  | 'cogvideox-t2v'
  | 'cogvideox-i2v'
  | 'hailuo'
  | 'wan-2.5'
  | 'ltx-video'
  | 'stable-video-diffusion';

export type MediaStatus = ContentStatus;

export interface AIMedia {
  id: number;
  campaign_id: number | null;
  media_type: MediaType;
  title: string | null;
  description: string | null;
  prompt_used: string | null;
  provider: MediaProvider;
  model_version: string | null;
  storage_url: string | null;
  thumbnail_url: string | null;
  dimensions: MediaDimensions | null;
  file_size_bytes: number | null;
  status: MediaStatus;
  metadata: Record<string, unknown> | null;
  workflow_id: string | null;
  /** The distribution channel the media is made for. NOTE: there is no `selected_for_publish` on media — a media
   *  item is "selected" by being ATTACHED to a post that is selected (`ai_content_media`). */
  distribution_channel_id: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaDimensions {
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g., "16:9", "9:16", "1:1"
}

// =============================================================================
// Content Source Types (NEW)
// =============================================================================

export type ContentSourceType =
  | 'product_release'
  | 'blog_post_seed' // Generate new blog post (seed blog workflow)
  | 'blog_post_existing' // Use existing blog post
  | 'case_study'
  | 'customer_interview' // Link to customer interview
  | 'event' // Luma events
  | 'podcast' // Podcast episodes
  | 'webinar' // Webinars
  | 'investor_update' // Investor updates
  | 'onboarding_guide' // Onboarding guides (lives on openframe platform)
  | 'walkthrough_video' // Per-platform floating demo video (no slug, no detail page; URL is the platform home)
  | 'what_i_shipped' // What I Shipped employee check-ins (lives on people-hub)
  | 'how_i_work' // How I Work employee AI-workflow sessions (lives on people-hub)
  | 'ai_prompt' // Squawkbox prompt library entries (lives on people-hub)
  | 'faq' // FAQ Q&A pair (single-page /faqs index; deep-link by category anchor)
  | 'design_doc' // Internal design docs (product-hub admin; preview route only, no public page)
  | 'from_scratch';

/**
 * Where a post's link goes: nowhere, written into the post, posted as a comment, or opened by the post itself
 * (`as_link`: tapping the notification of an OpenFrame announcement opens it).
 */
export type URLInjectionPreference = 'none' | 'in_post' | 'as_comment' | 'as_link';

export interface ContentSourceOption {
  id: number | string; // Events/podcasts/webinars use UUID strings
  type: ContentSourceType;
  title: string;
  summary?: string;
  url?: string;
  published_at?: string;
  /** Featured image or cover image URL from the source entity */
  image_url?: string;
  /**
   * Display name of the platform that OWNS this row ("Flamingo", "OpenMSP", …).
   *
   * The content picker is deliberately unscoped, so every list mixes rows from
   * different platforms and the owning platform is often the only thing telling
   * two rows apart — per-platform walkthrough videos share a title AND a summary,
   * differing only by platform. The URL cannot stand in for this: in dev every
   * platform resolves to the same localhost origin.
   */
  platform_display_name?: string;
}

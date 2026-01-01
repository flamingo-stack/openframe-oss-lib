/**
 * Marketing Campaign Types
 *
 * Types for the Marketing AI system including campaigns, content, media,
 * social accounts, scheduled posts, and usage tracking.
 */

// =============================================================================
// Core Campaign Types
// =============================================================================

export interface MarketingCampaign {
  id: number;
  name: string;
  description: string | null;
  platform: string;
  start_date: string | null;
  end_date: string | null;
  goals: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  start_date?: string;
  goals?: string[];
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  start_date?: string;
  goals?: string[];
}

// =============================================================================
// AI Content Types
// =============================================================================

export type ContentType = 'blog_post' | 'social_post' | 'ad_copy' | 'email';
export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'published';

export interface AIContent {
  id: number;
  campaign_id: number | null;
  content_type: ContentType;
  title: string | null;
  content: string;
  prompt_used: string | null;
  ai_model: string;
  generation_tokens: number | null;
  cost_cents: number | null;
  confidence_score: number | null;
  metadata: Record<string, unknown> | null;
  status: ContentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  platform: string;
  created_at: string;
  updated_at: string;
  // Publishing & Override fields
  selected_for_publish: boolean;
  override_url: string | null;
  override_at: string | null;
  override_by: string | null;
}

export interface CreateAIContentInput {
  campaign_id?: number;
  content_type: ContentType;
  title?: string;
  content: string;
  prompt_used?: string;
  ai_model: string;
  generation_tokens?: number;
  cost_cents?: number;
  confidence_score?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// AI Media Types
// =============================================================================

export type MediaType = 'image' | 'video' | 'figma_export';
export type MediaProvider = 'dalle' | 'dalle-3' | 'sdxl' | 'replicate' | 'figma' | 'manual' | 'midjourney' | 'flux-pro' | 'flux-dev' | 'ideogram-v2' | 'recraft-v3' | 'kling-v2.5' | 'luma-ray2' | 'hailuo' | 'ltx-video' | 'stable-video-diffusion';
export type MediaStatus = 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'rejected' | 'published' | 'generating';

export interface AIMedia {
  id: number;
  campaign_id: number | null;
  media_type: MediaType;
  title: string | null;
  description: string | null;
  prompt_used: string | null;
  provider: MediaProvider;
  model_version: string | null;
  cost_cents: number | null;
  storage_path: string | null;
  storage_url: string | null;
  thumbnail_url: string | null;
  dimensions: MediaDimensions | null;
  file_size_bytes: number | null;
  status: MediaStatus;
  figma_file_id: string | null;
  figma_node_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  metadata: Record<string, unknown> | null;
  platform: string;
  created_at: string;
  updated_at: string;
  // Publishing & Override fields
  selected_for_publish: boolean;
  override_url: string | null;
  override_at: string | null;
  override_by: string | null;
}

export interface MediaDimensions {
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g., "16:9", "9:16", "1:1"
}

export interface CreateAIMediaInput {
  campaign_id?: number;
  media_type: MediaType;
  title?: string;
  description?: string;
  prompt_used?: string;
  provider: MediaProvider;
  model_version?: string;
  cost_cents?: number;
  storage_path?: string;
  storage_url?: string;
  thumbnail_url?: string;
  dimensions?: MediaDimensions;
  file_size_bytes?: number;
  figma_file_id?: string;
  figma_node_id?: string;
}

// =============================================================================
// Social Account Types
// =============================================================================

export type SocialChannel = 'slack' | 'linkedin' | 'facebook' | 'instagram' | 'twitter' | 'youtube';
export type SocialAccountType = 'personal' | 'page' | 'organization' | 'channel';

export interface SocialAccount {
  id: number;
  channel: SocialChannel;
  account_type: SocialAccountType;
  account_name: string;
  account_id: string;
  platform: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  permissions: string[] | null;
  is_active: boolean;
  last_sync_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSocialAccountInput {
  channel: SocialChannel;
  account_type: SocialAccountType;
  account_name: string;
  account_id: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Scheduled Post Types
// =============================================================================

export type ScheduledPostStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface ScheduledPost {
  id: number;
  campaign_id: number;
  content_id: number | null;
  media_ids: number[];
  social_account_id: number;
  scheduled_at: string;
  published_at: string | null;
  status: ScheduledPostStatus;
  external_post_id: string | null;
  external_post_url: string | null;
  error_message: string | null;
  retry_count: number;
  created_by: string | null;
  platform: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledPostInput {
  campaign_id: number;
  content_id?: number;
  media_ids?: number[];
  social_account_id: number;
  scheduled_at: string;
  created_by?: string;
}

// =============================================================================
// Content Approval Types
// =============================================================================

export type ContentApprovalType = 'ai_content' | 'ai_media' | 'campaign';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';

export interface ContentApproval {
  id: number;
  content_type: ContentApprovalType;
  content_id: number;
  status: ApprovalStatus;
  reviewer_id: string | null;
  reviewer_notes: string | null;
  revision_notes: string | null;
  approved_at: string | null;
  platform: string;
  created_at: string;
}

export interface CreateContentApprovalInput {
  content_type: ContentApprovalType;
  content_id: number;
  status: ApprovalStatus;
  reviewer_id?: string;
  reviewer_notes?: string;
  revision_notes?: string;
}

// =============================================================================
// AI Usage Tracking Types
// =============================================================================

export type AIService = 'anthropic' | 'openai' | 'replicate' | 'figma' | 'google';
export type AIOperation = 'text_generation' | 'image_generation' | 'video_generation' | 'figma_export';

export interface AIUsage {
  id: number;
  service: AIService;
  operation: AIOperation;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  user_id: string | null;
  content_id: number | null;
  media_id: number | null;
  platform: string;
  created_at: string;
}

export interface TrackAIUsageInput {
  service: AIService;
  operation: AIOperation;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_cents?: number;
  user_id?: string;
  content_id?: number;
  media_id?: number;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Statistics Types
// =============================================================================

export interface CampaignStats {
  totalCampaigns: number;
  drafts: number;      // Campaigns with 0 workflow runs
  active: number;      // Campaigns with ≥1 workflow run (not completed)
  completed: number;   // Campaigns marked as completed
}

export interface AIUsageSummary {
  totalCostCents: number;
  totalTokens: number;
  byService: Record<string, { cost: number; count: number }>;
}

// =============================================================================
// Campaign with Related Data
// =============================================================================

export interface CampaignWithDetails {
  campaign: MarketingCampaign;
  content: AIContent[];
  media: AIMedia[];
}

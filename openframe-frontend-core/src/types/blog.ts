import type { UserProfile } from "./user"
import type { EntityPlatformAssoc } from "./entity-platform"

// Core Platform Types (dynamically fetched from database via API)
export type Platform = string;
export type BlogStatus = 'draft' | 'ai_drafted' | 'published' | 'ai_published' | 'scheduled' | 'archived';

// Author interface for blog posts (camelCase — the blog contract's own
// shape; detail-row authors elsewhere use the shared EntityAuthor).
export interface BlogAuthor {
  id: number;
  name?: string;
  avatar?: string;
  bio?: string;
  jobTitle?: string;
  /** Public author-page slug — present only when the hub's public-author
   *  gate passes (is_real profiles only). */
  slug?: string;
  /** Author's LinkedIn from profile_social_links — Article schema sameAs
   *  + the author.url fallback for slug-less authors. */
  linkedinUrl?: string;
}

// Database Models
export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  featured_image?: string;
  author_id: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  status: BlogStatus;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  og_image_url?: string;
  view_count: number;
  
  // Normalized relationships (for client-side usage)
  author?: BlogAuthor;
  categories: BlogCategory[];
  tags: BlogTag[];
  
  // Raw API response structure (for database queries)
  profiles?: {
    id: number;
    full_name?: string;
    avatar_url?: string;
    about?: string;
  };
  blog_post_platforms?: BlogPostPlatform[];
  blog_post_categories?: BlogPostCategory[];
  // Flat unified tag-association shape (hydrated by entity-tag-utils).
  blog_post_tags?: TagAssoc[];
  blog_media_assets?: BlogMediaAsset[];
}

/** Hydrated `entity_platforms` association row — the shared junction shape
 *  (see entity-platform.ts). The legacy `{blog_post_id, platform}` junction
 *  declaration is gone; runtime always produced the hydrated shape. */
export type BlogPostPlatform = EntityPlatformAssoc;

export interface BlogPostCategory {
  post_id: number;
  category_id: number;
  blog_categories?: BlogCategory;
}

export interface BlogPostTag {
  post_id: number;
  tag_id: number;
  blog_tags?: BlogTag;
}

/**
 * Flat per-entity tag association — the unified shape hydrated onto every
 * taggable entity's `<entity>_tags[]` array (mirrors the platform `*_platforms`
 * association shape). `tag_id` is always present; `id`/`name`/`slug` come from
 * the embedded vocabulary row. Replaces the legacy nested `{ blog_tags: {...} }`.
 */
export interface TagAssoc {
  tag_id: number;
  id?: number;
  name?: string;
  slug?: string;
}

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  created_at?: string;
}

export interface BlogTag {
  id: number;
  name: string;
  slug: string;
  description?: string;
  created_at?: string;
}

export interface BlogMediaAsset {
  id: string;
  blog_post_id: number;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  alt_text?: string;
  caption?: string;
  upload_path: string;
  uploaded_by?: string;
  created_at: string;
}

export interface BlogSEOAnalytics {
  id: string;
  blog_post_id: number;
  analysis_date: string;
  title_score: number;
  meta_description_score: number;
  content_score: number;
  readability_score: number;
  keyword_density?: any;
  suggestions?: any;
  overall_score: number;
}

// Form Data Types
export interface CreateBlogPostData {
  title: string;
  slug: string;
  summary?: string;
  content: string;
  featured_image?: string;
  author_id: string;
  status: BlogStatus;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  og_image_url?: string;
  published_at?: string | null;
  platforms: Platform[];
  /** Platform UUID (Platform is a string alias; kept as `string` for clarity — setEntityPlatforms compares against platform_id). */
  featured_platform?: string;
  categories: number[];
  tags: number[];
}

export interface UpdateBlogPostData {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  featured_image?: string;
  status?: BlogStatus;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  og_image_url?: string;
  published_at?: string | null;
  platforms?: Platform[];
  /** Platform UUID (Platform is a string alias; kept as `string` for clarity — setEntityPlatforms compares against platform_id). */
  featured_platform?: string;
  categories?: number[];
  tags?: number[];
}

// Query Options
export interface GetBlogPostsOptions {
  platform?: Platform | 'all';
  status?: BlogStatus | 'all';
  category?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'updated_at' | 'published_at' | 'title';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  author_id?: string;
}

// Dashboard Stats
export interface BlogPostStats {
  total_posts: number;
  published_posts: number;
  draft_posts: number;
  scheduled_posts: number;
  archived_posts: number;
  total_views: number;
  posts_by_platform: Record<Platform, number>;
  recent_posts: BlogPost[];
}

// Import unified platform configuration (removed duplicate definition)
// PLATFORM_CONFIGS removed - all platform data now comes from database via getPlatformsConfig()
export type { PlatformConfig } from './platform';

// SEO Analysis Types
export interface SEOAnalysisResult {
  overall_score: number;
  title_score: number;
  meta_description_score: number;
  content_score: number;
  readability_score: number;
  keyword_density: Record<string, number>;
  suggestions: string[];
  errors: string[];
  warnings: string[];
}

export interface SEOAnalysisOptions {
  target_keywords?: string[];
  analyze_readability?: boolean;
  check_duplicates?: boolean;
}

export interface BlogPostSummary {
  id: number
  title: string
  slug: string
  summary: string | null
  featured_image: string | null
  published_at: string | null
  author_name: string | null
  author_avatar: string | null
  categories: { name: string; slug: string }[]
  tags: { name: string; slug: string }[]
  is_featured?: boolean
  view_count?: number
}

export interface BlogPagination {
  posts: BlogPostSummary[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasFeaturedPost?: boolean
}

export interface BlogSearchParams {
  page?: number
  pageSize?: number
  category?: string
  tag?: string
  search?: string
}

// New interfaces for filtering system
export interface BlogFilterSidebarProps {
  categories: BlogCategory[]
  tags: BlogTag[]
  selectedCategories?: string[]
  selectedTags?: string[]
  isLoading?: boolean
}

export interface BlogFilterOption {
  key: string
  label: string
  count?: number
}

export interface BlogFilters {
  categories: BlogFilterOption[]
  tags: BlogFilterOption[]
}

// Transform blog categories/tags to match CategorySidebar interface
export interface BlogCategoryType {
  id: number
  name: string
  description?: string
  subcategories?: never // Blog categories don't have subcategories
}

export interface BlogCategoryForSidebar extends BlogCategoryType {
  slug?: string
}

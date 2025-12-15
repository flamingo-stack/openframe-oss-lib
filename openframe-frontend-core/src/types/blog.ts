import type { UserProfile } from "./user"

// Core Platform Types (using existing platform enum)
export type Platform = 'openmsp' | 'openframe' | 'flamingo' | 'flamingo-teaser' | 'universal';
export type BlogStatus = 'draft' | 'published' | 'scheduled' | 'archived';

// Author interface for blog posts
export interface BlogAuthor {
  id: number;
  name?: string;
  avatar?: string;
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
  };
  blog_post_platforms?: BlogPostPlatform[];
  blog_post_categories?: BlogPostCategory[];
  blog_post_tags?: BlogPostTag[];
  blog_media_assets?: BlogMediaAsset[];
}

export interface BlogPostPlatform {
  id: string;
  blog_post_id: number;
  platform: Platform;
  is_featured: boolean;
  featured_order?: number;
  created_at: string;
}

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
  featured_platform?: Platform;
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
  featured_platform?: Platform;
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

// Platform Configuration
export interface PlatformConfig {
  name: Platform;
  display_name: string;
  default_color: string;
  default_icon: string;
}

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    name: 'openmsp',
    display_name: 'OpenMSP',
    default_color: 'var(--ods-open-yellow-base)',     // CSS variable instead of hex
    default_icon: 'openmsp-logo'
  },
  {
    name: 'openframe',
    display_name: 'OpenFrame', 
    default_color: 'var(--ods-open-yellow-base)',     // CSS variable instead of hex
    default_icon: 'openframe-logo'
  },
  {
    name: 'flamingo',
    display_name: 'Flamingo',
    default_color: 'var(--ods-flamingo-pink-base)',   // CSS variable instead of hex
    default_icon: 'flamingo-logo'
  },
  {
    name: 'universal',
    display_name: 'Universal',
    default_color: 'var(--ods-open-yellow-base)',     // CSS variable instead of hex
    default_icon: 'globe'
  }
];

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

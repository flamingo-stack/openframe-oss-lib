// Product Release Types
// Following the blog.ts pattern for consistency

import type { PlatformRecord } from './platform'
import type { BlogTag } from './blog'
import type { VideoTeaser, TranscriptWord, SpeakerMapping } from './video-processing'

export interface ChangelogEntry {
  title: string
  description?: string
}

export interface ReleaseMedia {
  id: number
  release_id: number
  media_type: 'image' | 'video' | 'screenshot' | 'demo'
  media_url: string
  display_order: number | null
  title: string | null
  description: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export interface ProductReleaseGitHubLink {
  id: number
  release_id: number
  github_release_url: string // Full URL (e.g., https://github.com/org/repo/releases/tag/v2.0.0)
  display_order: number | null
  created_at: string
}

export interface KnowledgeBaseLink {
  id: number
  release_id: number
  kb_article_path: string // Relative path (e.g., /api/authentication/api-keys.md)
  display_order: number | null
  created_at: string
}

export interface ClickUpRoadmapTask {
  id: number
  release_id: number
  clickup_task_id: string // Just the task ID - details from roadmap folder
  display_order: number | null
  created_at: string
}

export interface ClickUpDeliveryTask {
  id: number
  release_id: number
  clickup_task_id: string // Just the task ID - details from delivery list
  display_order: number | null
  created_at: string
}

export interface ProductRelease {
  id: number
  title: string
  slug: string
  version: string
  summary: string | null
  content: string | null

  // Release metadata
  release_type: 'major' | 'minor' | 'patch' | 'beta' | 'alpha'
  release_status: 'alpha' | 'beta' | 'stable' | 'deprecated'
  release_date: string

  // Changelog (JSONB arrays)
  features_added: ChangelogEntry[]
  bugs_fixed: ChangelogEntry[]
  improvements: ChangelogEntry[]
  breaking_changes: ChangelogEntry[]

  // External relationships (one-to-many)
  github_releases?: ProductReleaseGitHubLink[]
  knowledge_base_links?: KnowledgeBaseLink[]
  clickup_roadmap_tasks?: ClickUpRoadmapTask[]
  clickup_delivery_tasks?: ClickUpDeliveryTask[]
  release_media?: ReleaseMedia[]

  // Media (keeping featured_image for hero)
  featured_image: string | null

  // Documentation
  migration_guide_url: string | null
  documentation_url: string | null

  // Video (youtube_url for embeds, main_video_url for AI processing)
  youtube_url: string | null
  main_video_url: string | null
  transcript: string | null
  transcript_words_data?: TranscriptWord[]
  video_summary: string | null // AI-generated summary from video transcription
  video_bites: VideoTeaser[] // JSONB array of extracted video clips
  highlight_video_url: string | null
  highlight_video_thumbnail: string | null
  highlight_video_duration_ms: number | null
  highlight_video_source: 'manual' | 'ai_generated' | null
  ai_transcript_formatted?: string
  speaker_mapping?: SpeakerMapping
  ai_confidence_transcript: number | null
  ai_confidence_video_summary: number | null // Confidence for video-generated summary
  ai_confidence_summary: number | null // Confidence for entity summary (Release Content Generation)

  // SEO
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  og_image_url: string | null

  // Publishing
  status: 'draft' | 'published' | 'archived'
  published_at: string | null
  author_id: string | null

  // Timestamps
  created_at: string
  updated_at: string

  // Editor-provided AI generation instructions (steers Generate Content prompt)
  custom_instructions: string | null

  // Analytics
  view_count: number
  download_count: number

  // Relations (populated by joins)
  platforms?: PlatformRecord[]
  tags?: BlogTag[]
  product_release_platforms?: Array<{
    platform_id: string
    is_featured: boolean
    featured_order: number | null
  }>
  product_release_tags?: Array<{
    tag_id: number
  }>
  blog_tags?: BlogTag[]
}

export interface CreateProductReleaseData {
  title: string
  slug: string
  version: string
  summary?: string
  content?: string
  release_type: 'major' | 'minor' | 'patch' | 'beta' | 'alpha'
  release_status: 'alpha' | 'beta' | 'stable' | 'deprecated'
  release_date: string
  features_added?: ChangelogEntry[]
  bugs_fixed?: ChangelogEntry[]
  improvements?: ChangelogEntry[]
  breaking_changes?: ChangelogEntry[]
  github_releases?: Array<{ github_release_url: string; display_order?: number }>
  knowledge_base_links?: Array<{ kb_article_path: string; display_order?: number }>
  clickup_roadmap_tasks?: Array<{ clickup_task_id: string; display_order?: number }>
  clickup_delivery_tasks?: Array<{ clickup_task_id: string; display_order?: number }>
  release_media?: Array<{ media_type: 'image' | 'video' | 'screenshot' | 'demo'; media_url: string; title?: string; description?: string; display_order?: number }>
  featured_image?: string
  migration_guide_url?: string
  documentation_url?: string
  youtube_url?: string
  main_video_url?: string
  transcript?: string
  video_summary?: string // AI-generated summary from video transcription
  video_bites?: VideoTeaser[]
  highlight_video_url?: string | null
  highlight_video_thumbnail?: string | null
  highlight_video_duration_ms?: number | null
  highlight_video_source?: 'manual' | 'ai_generated' | null
  seo_title?: string
  seo_description?: string
  seo_keywords?: string
  og_image_url?: string
  status: 'draft' | 'published' | 'archived'
  published_at?: string | null
  author_id: string
  platforms: string[] // Array of platform IDs (UUIDs)
  featured_platform?: string // Platform ID for featured
  tags: number[] // Array of tag IDs
  custom_instructions?: string | null
}

export type UpdateProductReleaseData = Partial<CreateProductReleaseData>

export interface ProductReleaseFilters {
  platform?: string | 'all'
  tags?: string[]
  version?: string
  release_type?: ('major' | 'minor' | 'patch' | 'beta' | 'alpha')[]
  release_status?: ('alpha' | 'beta' | 'stable' | 'deprecated')[]
  has_breaking_changes?: boolean
  search?: string
  featured?: boolean
  status?: string
  limit?: number
  offset?: number
  ids?: (number | string)[]
}

export interface ProductReleaseListResponse {
  data: ProductRelease[]
  count: number
}

// GitHub Release interface (for wizard)
export interface GitHubRelease {
  id: string
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
  prerelease: boolean
  draft: boolean
}

// Release type options for dropdowns
export const releaseTypeOptions = [
  { value: 'major', label: 'Major Release', description: 'Breaking changes, new architecture', color: 'red' },
  { value: 'minor', label: 'Minor Release', description: 'New features, backward compatible', color: 'blue' },
  { value: 'patch', label: 'Patch Release', description: 'Bug fixes only', color: 'green' },
  { value: 'beta', label: 'Beta Release', description: 'Pre-release testing version', color: 'yellow' },
  { value: 'alpha', label: 'Alpha Release', description: 'Early testing version', color: 'orange' }
] as const

// Release status options
export const releaseStatusOptions = [
  { value: 'alpha', label: 'Alpha', description: 'Early development, unstable', color: 'orange' },
  { value: 'beta', label: 'Beta', description: 'Feature complete, testing', color: 'yellow' },
  { value: 'stable', label: 'Stable', description: 'Production ready', color: 'green' },
  { value: 'deprecated', label: 'Deprecated', description: 'No longer supported', color: 'gray' }
] as const

// Changelog category labels
export const changelogLabels = {
  features_added: 'Features Added',
  bugs_fixed: 'Bugs Fixed',
  improvements: 'Improvements',
  breaking_changes: 'Breaking Changes'
} as const

// Semantic versioning validation regex
export const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/

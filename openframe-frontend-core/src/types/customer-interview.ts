// Customer Interview Types
// Following the case-study.ts pattern for consistency

import type { PlatformRecord } from './platform'
import type { MSP } from './stack'
import type { UserProfile } from './user'
import type { CaseStudy } from './case-study'

// Re-export shared video processing types for backwards compatibility
export type { VideoTeaser, Speaker, VideoClip, TranscriptWord, SpeakerMapping, ExcludedRange } from './video-processing'
import type { VideoTeaser, Speaker, VideoClip, TranscriptWord, SpeakerMapping, ExcludedRange } from './video-processing'

export interface CustomerInterviewConfig {
  /** Target duration in seconds for AI-generated highlight video (default: 180) */
  highlight_target_duration_seconds?: number
  /** Skip subtitle burning during highlight video generation */
  skipSubtitleBurning?: boolean
}

export interface CustomerInterview {
  id: number
  title: string
  slug: string
  video_summary: string | null // AI-generated summary from video transcription (Markdown supported)
  transcript: string | null // Markdown supported

  // OpenMSP user (customer)
  user_id: string | null // OpenMSP user who is the customer

  // Video content
  main_video_url: string | null
  teasers: VideoTeaser[] // JSONB array

  // Highlight video (AI-generated summary video)
  highlight_video_url?: string | null
  highlight_video_thumbnail?: string | null
  highlight_video_duration_ms?: number | null
  highlight_video_source?: 'manual' | 'ai_generated' | null

  // Optional case study link
  case_study_id: number | null

  // SEO
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string | null
  og_image_url: string | null
  featured_image: string | null

  // Publishing (simple workflow: draft → completed)
  status: 'draft' | 'completed'
  completed_at: string | null
  author_id: string | null

  // AI Processing Status
  ai_transcript_status?: 'pending' | 'processing' | 'completed' | 'failed'
  ai_summary_status?: 'pending' | 'processing' | 'completed' | 'failed'
  ai_clips_status?: 'pending' | 'processing' | 'completed' | 'failed'
  ai_processing_started_at?: string
  ai_processing_completed_at?: string
  ai_processing_error?: string

  // AI Generated Content
  ai_transcript_raw?: string
  ai_transcript_formatted?: string
  ai_confidence_transcript?: number
  ai_confidence_video_summary?: number // Confidence for video-generated summary
  ai_summary_bullets?: string[]
  ai_summary_gist?: string
  ai_speakers?: Speaker[]
  ai_video_clips?: VideoClip[]

  // External API Tracking
  assemblyai_transcript_id?: string
  twelvelabs_video_id?: string

  // Word-level transcript data for video processing
  transcript_words_data?: TranscriptWord[]

  // Incentive mention exclusion ranges (computed during transcription)
  incentive_excluded_ranges?: ExcludedRange[]

  // Speaker identification mapping (computed during transcription)
  // Maps AssemblyAI labels ("A", "B") to actual person info
  speaker_mapping?: SpeakerMapping

  /** Per-interview configuration options (JSONB) */
  config?: CustomerInterviewConfig

  // Timestamps
  created_at: string
  updated_at: string

  // Analytics
  view_count: number

  // Relations (populated by joins)
  platforms?: PlatformRecord[]
  user?: UserProfile // Customer data (includes msp_id)
  msp?: MSP // Customer's MSP data via user.msp_id
  author?: UserProfile // Interview author
  case_study?: CaseStudy // Linked case study
  customer_interview_platforms?: Array<{
    platform_id: string
    is_featured: boolean
    featured_order: number | null
  }>
}

export interface CreateCustomerInterviewData {
  title: string
  slug: string
  video_summary?: string // AI-generated summary from video transcription (Markdown supported)
  transcript?: string // Markdown supported
  user_id?: string // Customer UUID
  main_video_url?: string
  highlight_video_url?: string | null
  teasers?: VideoTeaser[]
  case_study_id?: number | null
  seo_title?: string
  seo_description?: string
  seo_keywords?: string
  og_image_url?: string
  featured_image?: string
  status: 'draft' | 'completed'
  completed_at?: string | null
  author_id: string
  platforms: string[] // Array of platform IDs (UUIDs)
  featured_platform?: string // Platform ID for featured
  config?: CustomerInterviewConfig
}

export type UpdateCustomerInterviewData = Partial<CreateCustomerInterviewData>

export interface CustomerInterviewFilters {
  platform?: string | 'all'
  industry?: string // Filtered from MSP profile data
  company_size?: string // Filtered from MSP profile data
  search?: string
  featured?: boolean
  status?: 'draft' | 'completed' | 'all'
  limit?: number
  offset?: number
  ids?: (number | string)[]
}

export interface CustomerInterviewListResponse {
  data: CustomerInterview[]
  count: number
}

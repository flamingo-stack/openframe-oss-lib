// Video Processing Shared Types
// Used by CustomerInterview, ProductRelease, and future video-enabled entities

/**
 * VideoTeaser represents a short video clip extracted from a longer video.
 * Used for teasers/bites that can be shown on preview pages.
 */
export interface VideoTeaser {
  url: string
  title?: string
  thumbnail_url?: string // Optional thumbnail image URL for video preview. If not provided, video player will show first frame automatically.
  published?: boolean // Controls visibility on public preview page (default: false, admin must select)
  source?: 'manual' | 'ai_generated' // Track origin of teaser
  created_at?: string // ISO timestamp for sorting (newer items first)
  // Duration auto-detected from video file
}

/**
 * Speaker identification for transcription
 */
export interface Speaker {
  label: string
  name?: string
  confidence?: number
}

/**
 * VideoClip represents a segment identified by AI analysis
 */
export interface VideoClip {
  start_time: number
  end_time: number
  description: string
  query_used: string
  confidence: number
  twelve_labs_id?: string
  thumbnail_url?: string
}

/**
 * Word-level transcript data for precise video processing
 */
export interface TranscriptWord {
  text: string
  start: number // milliseconds
  end: number // milliseconds
  confidence: number
  speaker?: string
}

/**
 * Speaker mapping for interview/video transcripts
 * Maps AssemblyAI labels ("A", "B") to actual person info
 */
export interface SpeakerMapping {
  [label: string]: {
    name: string
    role: 'interviewer' | 'interviewee' | 'presenter' | 'host' | 'guest'
    userId?: string
  }
}

/**
 * Excluded time ranges (e.g., for incentive mentions)
 */
export interface ExcludedRange {
  start: number // seconds
  end: number // seconds
}

/**
 * Base video processing fields shared across entities
 */
export interface VideoProcessingFields {
  main_video_url: string | null
  transcript: string | null
  transcript_words_data?: TranscriptWord[]
  highlight_video_url?: string | null
  highlight_video_thumbnail?: string | null
  highlight_video_duration_ms?: number | null
  highlight_video_source?: 'manual' | 'ai_generated' | null
  ai_transcript_formatted?: string
  speaker_mapping?: SpeakerMapping
  ai_confidence_transcript?: number | null
  ai_confidence_summary?: number | null
}

/**
 * Entity types that support agent processing
 * - customer_interview: Customer interview videos with transcription/bites/highlight
 * - product_release: Product release videos with transcription/bites/highlight
 * - marketing_campaign: Marketing campaign content generation (autonomous workflow)
 * - case_study: Case study generation from customer interviews
 */
export type VideoProcessingEntityType =
  | 'customer_interview'
  | 'product_release'
  | 'marketing_campaign'
  | 'case_study'
  | 'webinar'
  | 'podcast_episode'

/**
 * Customer Interview AI Processing Types
 *
 * Type definitions for AI-powered video processing features including
 * transcription, summarization, and video clip extraction.
 */

import type { Speaker, VideoClip } from './customer-interview'

// ============================================================================
// Status Types
// ============================================================================

export type AIProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface AIProcessingState {
  transcript: AIProcessingStatus
  summary: AIProcessingStatus
  clips: AIProcessingStatus
  error?: string
  startedAt?: string
  completedAt?: string
}

// ============================================================================
// Transcription Types
// ============================================================================

export interface TranscriptionUtterance {
  speaker: string
  text: string
  start: number         // milliseconds
  end: number           // milliseconds
  confidence: number    // 0-1 scale
}

export interface TranscriptionResult {
  transcript_raw: string                    // AssemblyAI JSON response
  transcript_formatted: string              // Markdown formatted with speakers
  summary_bullets: string[]                 // Bullet-point summary
  summary_gist: string                      // 1-2 sentence overview
  speakers?: Speaker[]                      // Speaker metadata
  confidence_transcript: number             // 0-100 overall confidence
  confidence_summary: number                // 0-100 summary confidence
  assemblyai_id: string                     // AssemblyAI transcript ID
  processing_duration: number               // seconds
  warnings?: string[]                       // Processing warnings
}

export interface AssemblyAITranscript {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  utterances?: TranscriptionUtterance[]
  confidence?: number
  audio_duration?: number
  error?: string
}

export interface AssemblyAISummary {
  response: string
  bullets?: string[]
  gist?: string
  headline?: string
  request_id: string
}

// ============================================================================
// Video Clip Types
// ============================================================================

export interface VideoClipsResult {
  clips: VideoClip[]
  twelvelabs_id: string
  processing_duration: number
  warnings?: string[]
}

export interface TwelveLabsSearchResult {
  data: Array<{
    video_id: string
    confidence: string              // "high" | "medium" | "low"
    start: number                   // seconds
    end: number                     // seconds
    metadata: string                // Description
    score: number                   // 0-1 relevance
  }>
}

// ============================================================================
// Combined Processing Types
// ============================================================================

export interface VideoProcessingOptions {
  processTranscription?: boolean
  processSummary?: boolean
  processClips?: boolean
  clipQueries?: string[]
  enableSpeakerDiarization?: boolean
  language?: string                // ISO language code, default 'en'
}

export interface VideoProcessingResult {
  transcription?: TranscriptionResult
  clips?: VideoClipsResult
  overallDuration: number          // Total processing time in seconds
  errors: string[]
  warnings: string[]
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface AIProcessingRequest {
  processTranscription?: boolean
  processSummary?: boolean
  processClips?: boolean
  clipQueries?: string[]
}

export interface AIProcessingResponse {
  jobId: string
  status: 'queued' | 'processing'
  estimatedDuration: number        // seconds
}

export interface AIStatusResponse {
  transcript: {
    status: AIProcessingStatus
    progress?: number               // 0-100
    error?: string
    completedAt?: string
  }
  summary: {
    status: AIProcessingStatus
    progress?: number
    error?: string
    completedAt?: string
  }
  clips: {
    status: AIProcessingStatus
    progress?: number
    error?: string
    completedAt?: string
  }
  overallProgress: number          // 0-100
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface AssemblyAIWebhookPayload {
  transcript_id: string
  status: 'completed' | 'error'
  error?: string
}

export interface TwelveLabsWebhookPayload {
  video_id: string
  status: 'ready' | 'failed'
  error?: string
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface TranscriptViewerProps {
  transcript: string                // Markdown content
  speakers?: Speaker[]              // Speaker metadata
  collapsible?: boolean             // Enable collapse
  defaultExpanded?: boolean         // Initial state
  showTimestamps?: boolean          // Show time markers
  highlightSearch?: string          // Search term highlighting
  showCard?: boolean                // Wrap in Card component (default: true)
  className?: string
}

export interface AIProcessingStatusDisplayProps {
  status: AIStatusResponse
  onRetry?: () => void
  className?: string
}

export interface VideoClipCardProps {
  clip: VideoClip
  videoUrl: string
  onPlay?: (startTime: number) => void
  className?: string
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface VideoAIConfig {
  assemblyai: {
    apiKey: string
    baseUrl: string
    features: {
      speaker_diarization: boolean
      sentiment_analysis: boolean
      entity_detection: boolean
    }
  }
  twelvelabs: {
    apiKey: string
    baseUrl: string
    defaultQueries: string[]
  }
  processing: {
    timeoutMs: number
    webhookEnabled: boolean
    retryAttempts: number
  }
}

// Re-export types from customer-interview for convenience
export type { Speaker, VideoClip } from './customer-interview'

// Customer Interview Types
// Following the case-study.ts pattern for consistency

import type { PlatformRecord } from './platform'
import type { MSP } from './stack'
import type { UserProfile } from './user'
import type { CaseStudy } from './case-study'

export interface VideoTeaser {
  url: string
  title?: string
  duration?: number // in seconds
}

export interface CustomerInterview {
  id: number
  title: string
  slug: string
  summary: string | null // Markdown supported
  transcript: string | null // Markdown supported

  // OpenMSP user (customer)
  user_id: string | null // OpenMSP user who is the customer

  // Video content
  main_video_url: string | null
  teasers: VideoTeaser[] // JSONB array

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
  summary?: string // Markdown supported
  transcript?: string // Markdown supported
  user_id?: string // Customer UUID
  main_video_url?: string
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
}

export interface CustomerInterviewListResponse {
  data: CustomerInterview[]
  count: number
}

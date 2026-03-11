// Case Study Types
// Following the blog.ts pattern for consistency

import type { BlogTag } from './blog';
import type { CustomerInterview, VideoTeaser } from './customer-interview';
import type { PlatformRecord } from './platform';
import type { MSP } from './stack';
import type { UserProfile } from './user';

export interface CaseStudy {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  featured_image: string | null;

  // OpenMSP user (MSP info comes through user.msp_id)
  // All company/industry/testimonial data comes from the MSP profile
  user_id: string | null; // OpenMSP user who owns this case study

  // Story structure
  challenge: string | null;
  solution: string | null;
  results: string | null;

  // Testimonial video (text testimonials come from MSP profile)
  testimonial_video_url: string | null; // YouTube URL (preferred when both exist)
  uploaded_video_url: string | null; // Uploaded video file URL (fallback when no YouTube)

  // Video enhancement fields
  video_source_type: 'youtube' | 'uploaded' | null; // Deprecated - use URL detection instead
  video_source: 'manual' | 'ai_generated' | null; // Video origin: manual (user uploaded/entered) or ai_generated (rolled from interview)
  video_bites: VideoTeaser[]; // Array of video clips from interviews or manually added
  customer_interview_id: number | null; // Linked customer interview for bidirectional relationship

  // SEO
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  og_image_url: string | null;

  // Publishing
  status: 'draft' | 'ai_drafted' | 'published' | 'scheduled' | 'archived';
  published_at: string | null;
  author_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Analytics
  view_count: number;

  // Relations (populated by joins)
  platforms?: PlatformRecord[];
  tags?: BlogTag[];
  user?: UserProfile; // Populated user data (includes msp_id)
  msp?: MSP; // Populated MSP data via user.msp_id - includes industry, company_size, testimonials, etc.
  author?: UserProfile; // Article author
  customer_interview?: CustomerInterview; // Linked customer interview
  case_study_platforms?: Array<{
    platform_id: string;
    is_featured: boolean;
    featured_order: number | null;
  }>;
  case_study_tags?: Array<{
    tag_id: number;
  }>;
  blog_tags?: BlogTag[];
}

export interface CreateCaseStudyData {
  title: string;
  slug: string;
  summary?: string;
  featured_image?: string;
  user_id?: string; // OpenMSP user ID (UUID) - MSP comes through user.msp_id
  challenge?: string;
  solution?: string;
  results?: string;
  testimonial_video_url?: string; // YouTube URL
  uploaded_video_url?: string; // Uploaded video file URL
  // Video enhancement fields
  video_source_type?: 'youtube' | 'uploaded'; // Deprecated
  video_source?: 'manual' | 'ai_generated';
  video_bites?: VideoTeaser[];
  customer_interview_id?: number | null;
  // SEO
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  og_image_url?: string;
  status: 'draft' | 'ai_drafted' | 'published' | 'scheduled' | 'archived';
  published_at?: string | null;
  author_id: string;
  platforms: string[]; // Array of platform IDs (UUIDs)
  featured_platform?: string; // Platform ID for featured
  tags: number[]; // Array of tag IDs
}

export type UpdateCaseStudyData = Partial<CreateCaseStudyData>;

export interface CaseStudyFilters {
  platform?: string | 'all';
  tags?: string[];
  industry?: string; // Filtered from MSP profile data
  company_size?: string; // Filtered from MSP profile data
  search?: string;
  featured?: boolean;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface CaseStudyListResponse {
  data: CaseStudy[];
  count: number;
}

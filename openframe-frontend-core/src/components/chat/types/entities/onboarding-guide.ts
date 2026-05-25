/**
 * Onboarding Guide entity — wire shape for the chat onboarding-guide
 * card + the `/api/onboarding-guides` reads.
 *
 * Lifted from `lib/data/onboarding-guide-utils.ts` in the hub. The
 * server-side DAL (createOnboardingGuide / updateOnboardingGuide /
 * resolvePublicPlatformScope / …) stays hub-side; only the row TYPE +
 * the filter/response shapes move here.
 */

export interface OnboardingGuide {
  id: string;
  title: string;
  slug: string;

  // Structured ordering
  section: string;
  step_order: number;
  section_order: number;

  // Body
  content: string | null;
  video_summary: string | null;
  transcript: string | null;
  transcript_words_data: unknown | null;
  srt_content: string | null;
  ai_transcript_formatted: string | null;

  // Video pipeline. `main_video_url` (Mux / MP4) and `youtube_url` are
  // INDEPENDENT columns — same shape as `product_releases`. The detail
  // page + RAG mapper read whichever is set; `<VideoSourceSelector>` in
  // the admin form toggles between them.
  main_video_url: string | null;
  main_video_thumbnail: string | null;
  youtube_url: string | null;
  highlight_video_url: string | null;
  highlight_video_thumbnail: string | null;
  highlight_video_duration_ms: number | null;
  highlight_video_source: string | null;
  video_bites: unknown[];

  // Images
  featured_image: string | null;
  og_image_url: string | null;

  // SEO
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;

  // Workflow
  status: string;
  published_at: string | null;
  author_id: string | null;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    job_title: string | null;
    email?: string | null;
  };
  custom_instructions: string | null;
  config: Record<string, unknown> | null;
  ai_effort_score: number | null;

  // Junction (multi-platform)
  onboarding_guide_platforms?: Array<{
    platform_id: string;
    is_featured: boolean;
    featured_order: number | null;
    name?: string;
    display_name?: string;
  }>;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface OnboardingGuideFilters {
  status?: string;
  search?: string;
  section?: string;
  platform?: string;
  limit?: number;
  offset?: number;
  ids?: string[];
}

export interface OnboardingGuideListResponse {
  data: OnboardingGuide[];
  count: number;
}

export interface OnboardingGuideSectionSummary {
  section: string;
  section_order: number;
  count: number;
}

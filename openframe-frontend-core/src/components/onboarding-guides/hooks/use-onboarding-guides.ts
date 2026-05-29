'use client'

/**
 * React Query hooks for Onboarding Guides — PUBLIC reads only.
 *
 * Admin mutations (create/update/delete/publish/stats/save-highlight)
 * stay HUB-side in `hooks/use-onboarding-guides.ts` and import the
 * `onboardingGuideKeys.admin` sub-namespace from this module so the
 * cache namespace `['onboarding-guides']` has a single source of truth.
 *
 * Endpoints (`/api/onboarding-guides*`) are host-supplied — non-Next.js
 * embedders must reverse-proxy the same routes. Same precedent as the
 * tickets list hook.
 */

import { useQuery } from '@tanstack/react-query'

import type {
  OnboardingGuide,
  OnboardingGuideFilters,
  OnboardingGuideListResponse,
  OnboardingGuideSectionSummary,
} from '../../chat/types/entities/onboarding-guide'

/**
 * Cache key builder for the `['onboarding-guides']` namespace.
 *
 * Includes BOTH public-read sub-keys (`lists`, `list`, `details`,
 * `detail`, `sections`) AND the `admin` sub-namespace. Admin mutations
 * live hub-side but invalidate against this same builder so a single
 * `qc.invalidateQueries({ queryKey: onboardingGuideKeys.all })` from
 * an admin hook also clears the public read cache.
 */
export const onboardingGuideKeys = {
  all: ['onboarding-guides'] as const,
  lists: () => [...onboardingGuideKeys.all, 'list'] as const,
  list: (filters: OnboardingGuideFilters) =>
    [...onboardingGuideKeys.lists(), filters] as const,
  details: () => [...onboardingGuideKeys.all, 'detail'] as const,
  detail: (slug: string) => [...onboardingGuideKeys.details(), slug] as const,
  sections: () => [...onboardingGuideKeys.all, 'sections'] as const,
  admin: {
    all: ['admin', 'onboarding-guides'] as const,
    lists: () => ['admin', 'onboarding-guides', 'list'] as const,
    detail: (slug: string) =>
      ['admin', 'onboarding-guide', slug] as const,
    stats: () => ['admin', 'onboarding-guides', 'stats'] as const,
  },
}

export function useOnboardingGuides(filters?: OnboardingGuideFilters) {
  return useQuery({
    queryKey: onboardingGuideKeys.list(filters || {}),
    queryFn: async (): Promise<OnboardingGuideListResponse> => {
      const params = new URLSearchParams()
      if (filters?.search) params.set('search', filters.search)
      if (filters?.section) params.set('section', filters.section)
      if (filters?.limit) params.set('limit', filters.limit.toString())
      if (filters?.offset) params.set('offset', filters.offset.toString())
      const res = await fetch(`/api/onboarding-guides?${params}`)
      if (!res.ok) throw new Error('Failed to fetch onboarding guides')
      return res.json()
    },
  })
}

export function useOnboardingGuide(slug: string | undefined) {
  return useQuery({
    queryKey: onboardingGuideKeys.detail(slug || ''),
    queryFn: async (): Promise<OnboardingGuide> => {
      const res = await fetch(`/api/onboarding-guides/${slug}`)
      if (!res.ok) throw new Error('Failed to fetch onboarding guide')
      return res.json()
    },
    enabled: !!slug,
  })
}

export function useOnboardingGuideSections() {
  return useQuery({
    queryKey: onboardingGuideKeys.sections(),
    queryFn: async (): Promise<OnboardingGuideSectionSummary[]> => {
      const res = await fetch('/api/onboarding-guides/sections')
      if (!res.ok)
        throw new Error('Failed to fetch onboarding-guide sections')
      return res.json()
    },
    staleTime: 0,
  })
}

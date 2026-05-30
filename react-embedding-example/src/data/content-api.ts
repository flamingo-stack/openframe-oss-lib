// Thin typed fetchers for the props-driven surfaces (onboarding catalog/detail,
// roadmap list). Returns lib row types; URLs come from the single EP map. This is
// the embedder data layer every host needs — not a re-implementation of lib logic.
// (Deletable once the optional onboarding-hook lib seam lands.)
import type {
  OnboardingGuide,
  OnboardingGuideListResponse,
  OnboardingGuideSectionSummary,
  RoadmapItem,
} from '@flamingo-stack/openframe-frontend-core/components/chat'
import { EP } from '../config/endpoints'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`)
  return res.json() as Promise<T>
}

export function fetchOnboardingGuides(section?: string): Promise<OnboardingGuideListResponse> {
  const qs = section ? `?section=${encodeURIComponent(section)}` : ''
  return getJson<OnboardingGuideListResponse>(`${EP.onboarding}${qs}`)
}

export function fetchOnboardingSections(): Promise<OnboardingGuideSectionSummary[]> {
  return getJson<OnboardingGuideSectionSummary[]>(EP.onboardingSections)
}

export function fetchOnboardingGuide(slug: string): Promise<OnboardingGuide> {
  return getJson<OnboardingGuide>(EP.onboardingBySlug(slug))
}

export async function fetchRoadmap(): Promise<RoadmapItem[]> {
  // The hub's /api/roadmap returns { items, count }.
  const data = await getJson<{ items: RoadmapItem[] }>(EP.roadmap)
  return data.items ?? []
}

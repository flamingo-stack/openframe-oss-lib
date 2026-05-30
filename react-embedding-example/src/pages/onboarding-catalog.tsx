import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  OnboardingGuidesCatalogView,
  OnboardingGuidesCatalogSkeleton,
} from '@flamingo-stack/openframe-frontend-core/components/onboarding-guides'
import { fetchOnboardingGuides, fetchOnboardingSections } from '../data/content-api'
import { PageError } from '../components/page-state'

/**
 * Props-driven onboarding catalog. We fetch from /content/api/onboarding-guides
 * ourselves and pass the data in — bypassing the lib's hardcoded `/api` list hook.
 * The lib view reads `?section=` from the URL (via the embed-shim → react-router
 * bridge) and pushes it back, so we re-fetch per section here.
 */
export function OnboardingCatalogPage() {
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section') ?? ''
  const guides = useQuery({
    queryKey: ['onboarding-guides', section],
    queryFn: () => fetchOnboardingGuides(section || undefined),
  })
  const sections = useQuery({ queryKey: ['onboarding-sections'], queryFn: fetchOnboardingSections })

  if (guides.isLoading || sections.isLoading) return <OnboardingGuidesCatalogSkeleton />
  if (guides.isError || sections.isError || !guides.data || !sections.data) {
    return (
      <PageError
        title="Couldn't load onboarding guides"
        detail={String((guides.error ?? sections.error)?.message ?? '')}
      />
    )
  }
  return (
    <OnboardingGuidesCatalogView
      initialGuides={guides.data.data}
      initialSections={sections.data}
      initialSection={section}
      basePath="/onboarding-guides"
    />
  )
}

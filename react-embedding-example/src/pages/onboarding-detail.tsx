import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { OnboardingGuideDetailView } from '@flamingo-stack/openframe-frontend-core/components/onboarding-guides'
import { fetchOnboardingGuide } from '../data/content-api'
import { PageError, PageLoading } from '../components/page-state'

export function OnboardingDetailPage() {
  const { slug } = useParams()
  const guide = useQuery({
    queryKey: ['onboarding-guide', slug],
    queryFn: () => fetchOnboardingGuide(slug!),
    enabled: !!slug,
  })

  if (guide.isLoading) return <PageLoading label="Loading guide…" />
  if (guide.isError || !guide.data) {
    return <PageError title="Guide not found" detail={String(guide.error?.message ?? '')} />
  }
  return (
    <OnboardingGuideDetailView initialData={guide.data} basePath="/onboarding-guides" backHref="/onboarding-guides" />
  )
}

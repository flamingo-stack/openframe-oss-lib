import { useParams } from 'react-router-dom'
import { OnboardingGuideDetailView } from '@flamingo-stack/openframe-frontend-core/components/onboarding-guides'
import { EP } from '../config/endpoints'

/**
 * Onboarding guide detail — config-only. The lib `<OnboardingGuideDetailView>`
 * fetches the guide internally; this page supplies only the route **slug** and
 * the **api route** (`EP.onboardingBySlug`).
 */
export function OnboardingDetailPage() {
  const { slug = '' } = useParams()
  return (
    <OnboardingGuideDetailView
      slug={slug}
      guideEndpoint={EP.onboardingBySlug}
      basePath="/onboarding-guides"
    />
  )
}

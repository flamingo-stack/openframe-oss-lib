import { OnboardingGuidesCatalogView } from '@flamingo-stack/openframe-frontend-core/components/onboarding-guides'
import { EP } from '../config/endpoints'

/**
 * Onboarding catalog — config-only. The lib `<OnboardingGuidesCatalogView>`
 * fetches the guides + section summaries internally (reading `?section=` from
 * the URL); this page supplies only the **api routes**.
 */
export function OnboardingCatalogPage() {
  return (
    <OnboardingGuidesCatalogView
      guidesEndpoint={EP.onboarding}
      sectionsEndpoint={EP.onboardingSections}
      basePath="/onboarding-guides"
    />
  )
}

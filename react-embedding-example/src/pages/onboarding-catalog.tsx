import { DevSectionPage } from '@flamingo-stack/openframe-frontend-core/components'
import { OnboardingGuidesCatalogView } from '@flamingo-stack/openframe-frontend-core/components/onboarding-guides'
import { EP } from '../config/endpoints'

/**
 * Onboarding catalog — config-only, SAME shape as the roadmap / releases / delivery
 * pages: `<DevSectionPage sectionKey="onboarding">` supplies the page chrome (hero +
 * back button); the lib `<OnboardingGuidesCatalogView>` renders its own RAG search +
 * section pills + the guide grid and fetches internally (reading `?section=` from the
 * URL). This page supplies only the **api routes**.
 */
export function OnboardingCatalogPage() {
  return (
    <DevSectionPage sectionKey="onboarding">
      <OnboardingGuidesCatalogView
        guidesEndpoint={EP.onboarding}
        sectionsEndpoint={EP.onboardingSections}
        basePath="/onboarding-guides"
      />
    </DevSectionPage>
  )
}

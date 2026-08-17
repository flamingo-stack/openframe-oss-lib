import { useParams } from 'react-router-dom'
import { OnboardingGuideDetailView } from '@flamingo-stack/openframe-frontend-core/components/onboarding-guides'
import { EP } from '../config/endpoints'
import { CONTENT_PREFIX } from '../config/content'

// Module-level (stable identity): the view builds RELATIVE `/api/captions/...`
// track URLs from the guide's SRT columns; route them back through the
// /content proxy so the browser doesn't resolve them against this SPA's origin.
const transformCaptionsUrl = (rel: string) => `${CONTENT_PREFIX}${rel}`

/**
 * Onboarding guide detail — config-only. The lib `<OnboardingGuideDetailView>`
 * fetches the guide internally; this page supplies only the route **slug**, the
 * **api route** (`EP.onboardingBySlug`), and the captions proxy rewrite.
 */
export function OnboardingDetailPage() {
  const { slug = '' } = useParams()
  return (
    <OnboardingGuideDetailView
      slug={slug}
      guideEndpoint={EP.onboardingBySlug}
      basePath="/onboarding-guides"
      transformCaptionsUrl={transformCaptionsUrl}
    />
  )
}

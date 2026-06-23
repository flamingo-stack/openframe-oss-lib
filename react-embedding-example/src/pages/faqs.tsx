import { FaqDocumentPage } from '@flamingo-stack/openframe-frontend-core/components'
import { CONTENT_PREFIX } from '../../proxy/content-prefix.mjs'

/**
 * FAQ — config-only. `<FaqDocumentPage>` owns the chrome (PageShell + the
 * "Back to home" button + the canonical FAQ hero) and self-fetches the FAQ list
 * from `${apiBaseUrl}/api/faqs` — here `/content/api/faqs`, which the proxy
 * rewrites to the hub. With no entity scope the hub serves the platform-only
 * ACTIVE list (identical to what the hub's SSR `/faqs` page renders), so this
 * embed matches the hub byte-for-byte.
 *
 * We rely on the DEFAULT back button ("Back to home" → `/`), consistent with
 * roadmap/delivery/releases — do NOT pass `backButton={false}` (only `legal`
 * opts out of the back affordance).
 */
export function FaqsPage() {
  return (
    <FaqDocumentPage
      apiBaseUrl={CONTENT_PREFIX}
      subtitle="Answers to the most common questions about OpenFrame."
    />
  )
}

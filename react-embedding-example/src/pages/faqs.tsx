import { FaqDocumentPage } from '@flamingo-stack/openframe-frontend-core/components'
import { CONTENT_PREFIX } from '../../proxy/content-prefix.mjs'

/**
 * FAQ — config-only. `<FaqDocumentPage>` owns the chrome (PageShell + the
 * canonical FAQ hero) and self-fetches the FAQ list from `${apiBaseUrl}/api/faqs`
 * — here `/content/api/faqs`, which the proxy rewrites to the hub. A SPA has no
 * SSR `initialFaqs`, so it deliberately falls to the self-fetch path (the
 * `/api/faqs` suggestion-fill the lib designed embeds around — same as how
 * roadmap/delivery self-fetch). `backButton={false}` because this embedder owns
 * the nav chrome (mirrors legal.tsx).
 */
export function FaqsPage() {
  return (
    <FaqDocumentPage
      apiBaseUrl={CONTENT_PREFIX}
      backButton={false}
      subtitle="Answers to the most common questions about OpenFrame."
    />
  )
}

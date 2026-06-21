import { ShareExperienceSection } from '@flamingo-stack/openframe-frontend-core/components/case-studies'

/**
 * Embed proof of `<ShareExperienceSection>` — the case-studies "Share
 * Your Experience" review-CTA block lifted out of `multi-platform-hub`
 * into the lib.
 *
 * The inner `<ContactForm>` posts through the AMBIENT
 * `EndpointsRuntime.contactUrl` set in `app-providers.tsx`
 * (= `${CONTENT_PREFIX}/api/contact` = `/content/api/contact`),
 * which the Vite dev proxy forwards to the hub's `/api/contact` —
 * so the embed gets a fully working submission with no per-call-site
 * wiring. Same proxy seam every other embed-aware form uses (see
 * `<ContactForm>` on `/contact`).
 *
 * Copy is left at the lib defaults (the hub's existing /case-studies
 * copy) so the embed renders the same UX a returning case-study
 * candidate would see on the hub.
 */
export function CaseStudiesPage() {
  return (
    <div className="p-6">
      <ShareExperienceSection />
    </div>
  )
}

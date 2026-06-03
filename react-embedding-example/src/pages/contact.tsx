import { ContactForm } from '@flamingo-stack/openframe-frontend-core/components/contact'

/**
 * ContactForm is self-contained: it calls `useContactSubmission` internally, which
 * reads `contactUrl` (= EP.contact) from the mounted EndpointsRuntime provider. No
 * host-side hook or schema import needed.
 */
export function ContactPage() {
  return (
    <div className="p-6">
      <ContactForm title="Contact us" subtitle="Questions about OpenFrame? Send us a note." />
    </div>
  )
}

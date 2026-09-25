import { TrustCenterPage as LibTrustCenterPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages'
import type { TrustCenterDocument } from '@flamingo-stack/openframe-frontend-core/types'
import { EP } from '../config/endpoints'

/** Public legal documents open this app's own `/legal/:docType` route (see app-routes). */
function documentHref(document: TrustCenterDocument): string | null {
  return document.legalDocType ? `/legal/${document.legalDocType}` : (document.url ?? null)
}

/**
 * Trust Center — config-only. `<TrustCenterPage>` owns the chrome, self-fetches
 * the hub's public Vanta projection through the `/content` proxy, derives
 * "monitored" client-side, and routes gated-document requests through the lib
 * ContactForm (`/api/contact`, via the endpoints runtime). This page supplies
 * only the **api route** and where legal documents open.
 */
export function TrustCenterPage() {
  return <LibTrustCenterPage endpoint={EP.trustCenter} documentHref={documentHref} />
}

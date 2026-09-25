import { TrustCenterPage as LibTrustCenterPage } from '@flamingo-stack/openframe-frontend-core/components/help-center-pages'
import { EP } from '../config/endpoints'

/**
 * Trust Center — config-only. `<TrustCenterPage>` owns the chrome, self-fetches
 * the hub's public Vanta projection through the `/content` proxy, derives
 * "monitored" client-side, and routes gated-document requests through the lib
 * ContactForm (`/api/contact`, via the endpoints runtime). This page supplies
 * only the **api route**.
 */
export function TrustCenterPage() {
  return <LibTrustCenterPage endpoint={EP.trustCenter} />
}

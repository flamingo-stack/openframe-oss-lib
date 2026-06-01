import { DevSectionPage, ProductReleasesView } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

/**
 * Releases LIST — config-only. `<DevSectionPage sectionKey="releases">` supplies the
 * chrome (hero + search + release-status filter, all URL-param-wired); the title comes
 * from the section registry (no manual <h1>). `<ProductReleasesView>` reads those
 * params, fetches, paginates, and renders. This page supplies only the **api route**.
 */
export function ReleasesPage() {
  return (
    <DevSectionPage sectionKey="releases">
      <ProductReleasesView endpoint={EP.productReleases} />
    </DevSectionPage>
  )
}

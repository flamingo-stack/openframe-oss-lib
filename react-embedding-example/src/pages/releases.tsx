import { ProductReleasesView } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

/**
 * Releases LIST — config-only. The shared lib `<ProductReleasesView>` fetches,
 * paginates, and renders internally; this page supplies only the **api route**
 * (`EP.productReleases` → `/content/api/releases`). No data layer, no page state.
 */
export function ReleasesPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-ods-text-primary">Product releases</h1>
      <ProductReleasesView endpoint={EP.productReleases} />
    </div>
  )
}

'use client'

/**
 * `<ProductReleasesListPage>` — the full `/releases` list page: `DevSectionPage
 * sectionKey="releases"` chrome wrapping the self-contained `<ProductReleasesView>`.
 * Hosts configure the api route + detail `basePath` (+ optional SSR `initialData`
 * and a custom card-prop builder). Card → detail nav flows through
 * `runtime.composeContentUrl`.
 */

import type { ReactNode } from 'react'
import type { ProductRelease, ProductReleaseListResponse } from '../../types/product-release'
import { DevSectionPage } from '../shared/dev-section'
import { ProductReleasesView, type ProductReleaseCardExtras } from '../shared/product-release'

export interface ProductReleasesListPageProps {
  /** GET list endpoint (the api route). Default `/api/releases`. */
  releasesEndpoint?: string
  /** Fallback detail-href prefix when `composeContentUrl` is not wired. Default `/releases`. */
  basePath?: string
  /** Derive the per-card prop bundle (defaults to the lib's rich builder). */
  buildCardProps?: (release: ProductRelease) => ProductReleaseCardExtras
  /** Optional SSR hydrate for the first page (hub server-fetch). */
  initialData?: ProductReleaseListResponse
  /** Back-button config. Pass `false` to hide. Default `{ href: '/' }`. */
  backButton?: { label?: string; href?: string } | false
  title?: string
  subtitle?: string
  /** Optional slot rendered below the list, inside the page chrome. */
  belowContent?: ReactNode
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container (forwarded to `DevSectionPage`). */
  shell?: boolean
}

export function ProductReleasesListPage({
  releasesEndpoint,
  basePath,
  buildCardProps,
  initialData,
  backButton,
  title,
  subtitle,
  belowContent,
  shell,
}: ProductReleasesListPageProps) {
  return (
    <DevSectionPage sectionKey="releases" backButton={backButton} title={title} subtitle={subtitle} shell={shell}>
      <ProductReleasesView
        endpoint={releasesEndpoint}
        basePath={basePath}
        buildCardProps={buildCardProps}
        initialData={initialData}
      />
      {belowContent}
    </DevSectionPage>
  )
}

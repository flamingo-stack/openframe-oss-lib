'use client'

/**
 * `<DeliveryPage>` — the full bug-fixes & enhancements (`delivery`) page:
 * `DevSectionPage sectionKey="delivery"` chrome wrapping the self-contained
 * `<DeliveryLists>` (Recently Completed + Active Tasks tables). Hosts configure
 * only the two bucket api routes.
 */

import type { ReactNode } from 'react'
import { DevSectionPage } from '../shared/dev-section'
import { DeliveryLists } from '../shared/delivery'

export interface DeliveryPageProps {
  /** GET endpoint for the "Recently Completed" bucket. Default `/api/delivery/completed`. */
  completedEndpoint?: string
  /** GET endpoint for the "Active Tasks" bucket. Default `/api/delivery/in-progress`. */
  inProgressEndpoint?: string
  /** Back-button config. Pass `false` to hide. Default `{ href: '/' }`. */
  backButton?: { label?: string; href?: string } | false
  title?: string
  subtitle?: string
  /** Optional slot rendered below the lists, inside the page chrome. */
  belowContent?: ReactNode
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container (forwarded to `DevSectionPage`). */
  shell?: boolean
}

export function DeliveryPage({
  completedEndpoint,
  inProgressEndpoint,
  backButton,
  title,
  subtitle,
  belowContent,
  shell,
}: DeliveryPageProps) {
  return (
    <DevSectionPage sectionKey="delivery" backButton={backButton} title={title} subtitle={subtitle} shell={shell}>
      <DeliveryLists completedApiEndpoint={completedEndpoint} inProgressApiEndpoint={inProgressEndpoint} />
      {belowContent}
    </DevSectionPage>
  )
}

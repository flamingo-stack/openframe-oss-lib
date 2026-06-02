import { DevSectionPage, DeliveryLists } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

/**
 * Delivery — config-only. `<DevSectionPage sectionKey="delivery">` supplies the chrome
 * (hero + search + task-type filter, all URL-param-wired); `<DeliveryLists>` reads
 * `search` / `task_type` and renders the completed + active tables. This page supplies
 * only the two **api routes**.
 */
export function DeliveryPage() {
  return (
    <DevSectionPage sectionKey="delivery">
      <DeliveryLists
        completedApiEndpoint={EP.deliveryCompleted}
        inProgressApiEndpoint={EP.deliveryInProgress}
      />
    </DevSectionPage>
  )
}

import { DeliveryLists } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

/**
 * DeliveryLists fetches its own data and reads `search` / `task_type` URL params
 * (written by its internal chrome via the embed-shim → react-router bridge). We
 * only retarget its two endpoints to /content.
 */
export function DeliveryPage() {
  return (
    <div className="p-6">
      <DeliveryLists
        completedApiEndpoint={EP.deliveryCompleted}
        inProgressApiEndpoint={EP.deliveryInProgress}
      />
    </div>
  )
}

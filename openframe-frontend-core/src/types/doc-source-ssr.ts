/**
 * SSR payload returned by the hub's `getDocSourceSsrData(sourceId, docPath)`
 * helper. Lib-resident so the viewer + the route-shell agree on the shape
 * without a hub-to-lib back-import.
 */

import type { DocNode, DocContent } from './doc-source'

export interface DocSourceSsrPayload {
  structure: DocNode[]
  content: DocContent | null
  contentStoragePath: string | null
  expandedNodeIds: string[]
}

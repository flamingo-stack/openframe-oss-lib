// `buildListUrl` is the one ChatRuntime field that is required and has no lib
// default — it maps an entity-card content type + ids to the list endpoint the
// chat fetches to expand a compact card. This is the small per-embedder builder
// (NOT a copy of the hub's server-side RAG_TABLE_CONFIGS). Unknown types return
// null and the lib skips rendering the expand affordance.
import { EP } from './endpoints'

const LIST_BASE: Record<string, string> = {
  roadmap: EP.roadmap,
  delivery: EP.deliveryCompleted,
  onboarding_guide: EP.onboarding,
}

export function buildListUrl(type: string, ids: string[]): string | null {
  const base = LIST_BASE[type]
  if (!base) return null
  return `${base}?ids=${ids.map(encodeURIComponent).join(',')}`
}

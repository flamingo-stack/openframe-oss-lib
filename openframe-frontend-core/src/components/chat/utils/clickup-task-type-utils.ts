/**
 * ClickUp custom_item_id → human-readable label resolver.
 *
 * Lib-side subset of the hub's `lib/utils/clickup-task-type-utils.ts`.
 * The hub file also exports delivery / workspace slug helpers used by
 * the sync engine; only the chat-surfaced label resolver migrates here
 * because chat-inline cards and activity feeds need it.
 *
 * Reference: ClickUp's standard task types (custom_item_id values):
 *   null/1000=Task, 1001=Milestone, 1002=Recurring, 1003=Subtask,
 *   1004=Form, 1006=Plan, 1007=Strategy, 1008=Bug, 1009=Request,
 *   1010=Feature, 1011=Story, 1012=Epic, 1013=Component, 1014=Initiative.
 */

export const CUSTOM_ITEM_ID = {
  TASK: 1000,
  MILESTONE: 1001,
  RECURRING: 1002,
  SUBTASK: 1003,
  FORM: 1004,
  PLAN: 1006,
  STRATEGY: 1007,
  BUG: 1008,
  REQUEST: 1009,
  FEATURE: 1010,
  STORY: 1011,
  EPIC: 1012,
  COMPONENT: 1013,
  INITIATIVE: 1014,
} as const

/**
 * Display name for a ClickUp task type — used in chat-inline cards and
 * activity feeds where the type badge would otherwise show a numeric ID.
 *
 * Returning `null` for unknown IDs lets callers fall back to a generic
 * "Task" affordance rather than printing `task-1100` or similar.
 */
export function getTaskTypeLabel(
  customItemId: number | null | undefined,
): string | null {
  switch (customItemId) {
    case CUSTOM_ITEM_ID.TASK:       return 'Task'
    case CUSTOM_ITEM_ID.MILESTONE:  return 'Milestone'
    case CUSTOM_ITEM_ID.RECURRING:  return 'Recurring'
    case CUSTOM_ITEM_ID.SUBTASK:    return 'Subtask'
    case CUSTOM_ITEM_ID.FORM:       return 'Form'
    case CUSTOM_ITEM_ID.PLAN:       return 'Plan'
    case CUSTOM_ITEM_ID.STRATEGY:   return 'Strategy'
    case CUSTOM_ITEM_ID.BUG:        return 'Bug'
    case CUSTOM_ITEM_ID.REQUEST:    return 'Request'
    case CUSTOM_ITEM_ID.FEATURE:    return 'Feature'
    case CUSTOM_ITEM_ID.STORY:      return 'Story'
    case CUSTOM_ITEM_ID.EPIC:       return 'Epic'
    case CUSTOM_ITEM_ID.COMPONENT:  return 'Component'
    case CUSTOM_ITEM_ID.INITIATIVE: return 'Initiative'
    default:                         return null
  }
}

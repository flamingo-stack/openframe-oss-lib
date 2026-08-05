/**
 * Delivery (ClickUp Bug-fixes & Enhancements) wire types — shared between the
 * hub's `/api/delivery*` route shapes and the lib's `DeliveryTable`/`DeliveryLists`/
 * `DeliverySection` components.
 *
 * Lifted from hub `types/delivery.ts` so embedders consuming the lib's
 * delivery surfaces and the lib's own `ReleaseDetailPage` (which renders
 * related delivery items) share one canonical shape.
 */

/**
 * Display identity for a task assignee — WIRE-SAFE shape: name + avatar
 * only, resolved server-side (ClickUp assignee × profiles). Emails are
 * deliberately NOT on the wire; the roadmap/delivery boards are public
 * surfaces (same policy as the RAG mappers). Feeds `AvatarStack`
 * directly.
 */
export interface TaskAssigneeDisplay {
  /** ClickUp member id — stable render key. */
  id: number;
  name: string | null;
  avatarUrl: string | null;
}

export interface DeliveryItem {
  id: string;
  title: string;
  description: string;
  status: string;
  statusColor: string; // ClickUp status color
  taskType: 'Request' | 'Bug' | string; // ClickUp task type
  /**
   * Canonical ClickUp custom_item_id (1008 = Bug, 1009 = Request, …).
   * Surfaced here so the chat's compact card can render a type-specific
   * lucide icon via `TaskTypeIcon` instead of the two-letter initials
   * fallback. Single source of truth lives in
   * `lib/utils/clickup-task-type-utils.ts` (hub-side).
   */
  customItemId: number | null;
  /** Assignee display identities (name + avatar, never email) — powers
   *  the AvatarStack on cards. Optional: producers that don't enrich
   *  (e.g. activity-cache recent_tasks) simply omit it. */
  assignees?: TaskAssigneeDisplay[];
  /**
   * Every ClickUp list the task is associated with (home list + ClickUp's
   * "Tasks in Multiple Lists" locations). UI joins these for display.
   * Falls back to a single-element array containing the home list when
   * there are no additional locations.
   */
  listNames: string[];
  dateOpened: number; // Unix timestamp
  dateUpdated: number; // Unix timestamp
  dateClosed: number | null; // Unix timestamp or null if not closed
  clickupUrl: string;
}

export interface DeliveryResponse {
  completed: DeliveryItem[];
  inProgress: DeliveryItem[];
}

// Task type to badge label mapping
export const TASK_TYPE_LABELS = {
  Request: 'ENHANCEMENT',
  Bug: 'BUG-FIX',
} as const;

// Task type to badge text-color mapping (ODS attention-red for Bug; default for others)
export const TASK_TYPE_TEXT_COLORS = {
  Request: '', // Default white/grey
  Bug: 'text-[var(--ods-attention-red-error)]',
} as const;

/**
 * Roadmap Item entity — wire shape for the chat roadmap card and the
 * public `/api/roadmap` reads.
 *
 * Lifted from `lib/data/clickup-query-utils.ts` in the hub. Mirrors the
 * `roadmap_items` projection produced by `transformTask()` in
 * `clickup-sync-utils.ts`.
 *
 * Naming note: a `RoadmapItem` stub already exists in
 * `src/components/shared/product-release/release-detail-page.tsx` as
 * `{ id: string; [key: string]: unknown }` — that placeholder predates this
 * canonical shape and lives in a different module, so the two don't
 * collide. Callers that want the strongly-typed wire shape import from
 * `@/components/chat/types/entities/roadmap-item`; the product-release
 * placeholder will be reconciled in a follow-up.
 */

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: string;
  statusColor: string;
  icon: string | null;
  figmaUrl: string | null;
  screenshots: string[];
  targetVersion: string | null;
  upvotes: number;
  downvotes: number;
  quarter: string;
  clickupUrl: string;
  /** ClickUp canonical task-type taxonomy ID (1008=Bug, 1009=Request,
   *  1010=Feature, …). Drives the type-specific icon rendered in the
   *  chat's compact card for the internal-tasks variant — see
   *  `getTaskTypeIcon` in `lib/utils/clickup-task-type-utils.ts`. */
  customItemId: number | null;
}

export interface RoadmapStaleness {
  lastSyncedAt: string | null;
  staleSinceMs: number;
}

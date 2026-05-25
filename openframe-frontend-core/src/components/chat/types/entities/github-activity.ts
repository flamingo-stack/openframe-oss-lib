/**
 * GitHub Activity entity types — wire shape for chat cards.
 *
 * Mirrors the canonical row consumed by `GitHubActivityCard`:
 *   - `commit`     : commit on a repo (SHA, message)
 *   - `pull_request`: PR opened/updated
 *   - `pr_review`  : review submitted on a PR (state badge drives color)
 *
 * Lifted from `components/shared/github/github-activity-card.tsx` so the
 * type is canonical in lib — clients can build / pass / extend it without
 * pulling in the card itself.
 */

export type GitHubActivityKind = 'commit' | 'pull_request' | 'pr_review';

export type PrReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'DISMISSED'
  | 'PENDING';

export interface GitHubActivityItem {
  /** Commit SHA (full or short) / PR-# / review id */
  id: string;
  /** Commit message / PR title / review state */
  title: string;
  /** "owner/repo" — derived from the GitHub URL when not provided */
  repo?: string;
  /** ISO timestamp or millisecond epoch */
  dateUpdated?: string | number | null;
  /** GitHub URL — used as the link target */
  url?: string | null;
  /** Discriminator — defaults to 'commit' when not supplied */
  kind?: GitHubActivityKind;
}

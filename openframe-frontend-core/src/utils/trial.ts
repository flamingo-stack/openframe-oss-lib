/**
 * The free trial's facts and the words every surface says them with: the
 * sign-up panel here, and the host site's trial buttons, trust rows and pricing
 * copy. Stated once, so a trial that changes length changes everywhere.
 *
 * Server-safe (no React, no DOM).
 */

/** How long the free trial runs, in days. */
export const TRIAL_DAYS = 14;

/** The reassurance labels shown beside a trial button. */
export const TRIAL_LABELS = {
  /** "14 day free trial" */
  length: `${TRIAL_DAYS} day free trial`,
  noCard: 'No card required',
  cancel: 'Cancel Anytime',
  noContract: 'No Contract',
} as const;

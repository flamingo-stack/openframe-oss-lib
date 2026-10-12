/**
 * The words every surface states the free trial with: the sign-up panel here,
 * and the host site's trial buttons, trust rows and pricing copy.
 *
 * The trial's LENGTH is not stated here. It is the billing plan's, so a host
 * passes the number it read from its server (`trialLabels(days)`); with no
 * number the length is left out, never guessed.
 *
 * Server-safe (no React, no DOM).
 */

/** The reassurance labels that hold whatever the trial's length is. */
export const TRIAL_TERMS = {
  noCard: 'No card required',
  cancel: 'Cancel Anytime',
  noContract: 'No Contract',
} as const;

/** "30 day free trial", from the length the billing plan states. A string is a template slot (`{trialDays}`). */
export const trialLengthLabel = (days: number | string): string => `${days} day free trial`;

/** The labels shown beside a trial button. `length` is null while the plan's length is not known. */
export function trialLabels(days: number | string | null | undefined) {
  return { ...TRIAL_TERMS, length: days === null || days === undefined || days === '' ? null : trialLengthLabel(days) };
}

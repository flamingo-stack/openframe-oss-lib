/**
 * A design doc's status as every surface draws it (the hub's design-docs screens, its doc page, the lib's design-doc
 * cards), and its sign-off caption.
 *
 * Both halves of the status are vocabulary rows the hub resolves onto the doc, so no surface holds a word or a colour:
 *   - its READINESS (`doc.readiness`): the stage the sign-offs put it in (not ready, in active work, blocked, ready to
 *     build), picked by the hub from the `readiness` rows by role;
 *   - a LIFECYCLE status a person set (`doc.lifecycle`: postponed, shipped, archived). While one is set it is what the
 *     doc shows; cleared, the readiness shows again.
 *
 * The sign-off caption is counts only ("4/6 signed off · 1 blocking"): the status has its own badge.
 * Pure, zero-import beyond the type.
 */
import type { DesignDoc, DesignDocCompletion, DesignDocVocabularyDisplay } from '../types/design-doc';

/** What the doc's status badge says: its lifecycle status when a person set one, else its readiness (null from a hub
 *  that resolves neither). */
export function designDocStatusDisplay(
  doc: Pick<DesignDoc, 'lifecycle' | 'readiness'>,
): DesignDocVocabularyDisplay | null {
  return doc.lifecycle ?? doc.readiness ?? null;
}

/** "4/6 signed off" */
export function formatCompletionLabel(completion: Pick<DesignDocCompletion, 'total' | 'completed'>): string {
  return `${completion.completed}/${completion.total} signed off`;
}

/** The SAME count plus the blocking veto ("4/6 signed off · 1 blocking"): the dashboard row, the doc page, the card. */
export function formatCompletionLabelWithBlockers(completion: DesignDocCompletion): string {
  const base = formatCompletionLabel(completion);
  return completion.openBlocking > 0 ? `${base} · ${completion.openBlocking} blocking` : base;
}

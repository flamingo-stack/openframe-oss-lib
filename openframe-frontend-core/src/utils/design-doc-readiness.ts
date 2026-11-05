/**
 * A design doc's status in words: THE wording every surface prints (the hub's design-docs screens, its doc page, the
 * lib's design-doc cards).
 *
 * Two fields, one displayed state:
 *   - READINESS is derived from the sign-offs: "Ready to build" once every department section is signed off and no
 *     blocking comment is open, "In active work" once at least one section is signed off, else "Not ready" (nothing
 *     signed off yet). "Blocked" is shown over the last two while a section asks for changes or a blocking comment is
 *     open.
 *   - A LIFECYCLE status is set by a person (postponed, shipped, archived; vocabulary rows, resolved by the hub into
 *     `doc.lifecycle`). While one is set it is what the doc shows; cleared, the readiness shows again.
 *
 * The sign-off caption is counts only ("4/6 signed off · 1 blocking"): the status has its own badge.
 * Pure, zero-import beyond the type.
 */
import type { DesignDoc, DesignDocCompletion } from '../types/design-doc';

export const DESIGN_DOC_READINESS = ['ready', 'in_progress', 'not_ready'] as const;
export type DesignDocReadiness = (typeof DESIGN_DOC_READINESS)[number];

/**
 * Each readiness's label and badge colour (a `StatusBadge` scheme). Ready is the soft cyan of information, never the
 * green of success: green is Shipped, so the two can never look alike. In active work is the soft pink no status a
 * person sets uses (Postponed is warning, Shipped success, Archived default).
 */
export const DESIGN_DOC_READINESS_DISPLAY: Record<
  DesignDocReadiness,
  { label: string; scheme: 'cyanSoft' | 'pinkSoft' | 'default' }
> = {
  ready: { label: 'Ready to build', scheme: 'cyanSoft' },
  in_progress: { label: 'In active work', scheme: 'pinkSoft' },
  not_ready: { label: 'Not ready', scheme: 'default' },
};

/** A not-ready doc that something is holding back: a section asking for changes or an open blocking comment. */
export const DESIGN_DOC_BLOCKED_DISPLAY = { label: 'Blocked', scheme: 'error' } as const;

/**
 * Ready to build ⇔ `completion.isComplete` (every section signed off, no open blocking comment); In active work ⇔ at
 * least one section signed off; Not ready ⇔ none yet.
 */
export const designDocReadiness = (
  completion: Pick<DesignDocCompletion, 'isComplete' | 'completed'>,
): DesignDocReadiness => (completion.isComplete ? 'ready' : completion.completed > 0 ? 'in_progress' : 'not_ready');

/** What the doc's status badge says: its lifecycle status when a person set one, else its readiness. */
export function designDocStatusDisplay(doc: Pick<DesignDoc, 'completion' | 'lifecycle'>): {
  label: string;
  scheme: string;
} {
  if (doc.lifecycle) return { label: doc.lifecycle.label, scheme: doc.lifecycle.color_scheme };
  const { completion } = doc;
  if (!completion.isComplete && (completion.blocked > 0 || completion.openBlocking > 0))
    return DESIGN_DOC_BLOCKED_DISPLAY;
  return DESIGN_DOC_READINESS_DISPLAY[designDocReadiness(completion)];
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

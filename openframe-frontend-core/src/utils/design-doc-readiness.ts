/**
 * A design doc's readiness in words — THE wording every surface prints (the hub's design-docs screens, its doc
 * page, the lib's design-doc card): "Ready to build" once every department section is signed off and no blocking
 * comment is open, else "Not ready", and the sign-off caption beside it. Pure, zero-import beyond the type.
 */
import type { DesignDocCompletion } from '../types/design-doc';

export const DESIGN_DOC_READINESS = ['ready', 'not_ready'] as const;
export type DesignDocReadiness = (typeof DESIGN_DOC_READINESS)[number];

/** Each readiness's label and badge colour (a `StatusBadge` scheme). */
export const DESIGN_DOC_READINESS_DISPLAY: Record<
  DesignDocReadiness,
  { label: string; scheme: 'success' | 'default' }
> = {
  ready: { label: 'Ready to build', scheme: 'success' },
  not_ready: { label: 'Not ready', scheme: 'default' },
};

/** Ready to build ⇔ `completion.isComplete` (every section signed off, no open blocking comment). */
export const designDocReadiness = (completion: Pick<DesignDocCompletion, 'isComplete'>): DesignDocReadiness =>
  completion.isComplete ? 'ready' : 'not_ready';

/** "4/6 reviews signed off" */
export function formatCompletionLabel(completion: Pick<DesignDocCompletion, 'total' | 'completed'>): string {
  return `${completion.completed}/${completion.total} reviews signed off`;
}

/** The SAME label plus readiness and the blocking veto (the dashboard row, the doc page, the card). */
export function formatCompletionLabelWithBlockers(completion: DesignDocCompletion): string {
  const base = formatCompletionLabel(completion);
  if (completion.isComplete) return `${DESIGN_DOC_READINESS_DISPLAY.ready.label} · ${base}`;
  return completion.openBlocking > 0 ? `${base} · ${completion.openBlocking} blocking` : base;
}

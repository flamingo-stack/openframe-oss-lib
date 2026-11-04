'use client';

import { cn } from '../../utils/cn';
import { APPROVAL_LEVEL_META } from '../features/approval-level';
import { AlertTriangleIcon } from '../icons-v2-generated';
import { Alert } from '../ui/alert';
import { ArgRow } from './tool-call-blocks';
import type { PolicyReviewData } from './types';

/** The decisions in which a matched guardrail rule, not the policy, set the level (`DENY` and the two it replaces). */
const RULE_DECISIONS: ReadonlySet<string> = new Set(['DENY', 'SOFT_DENY', 'HARD_DENY']);

/**
 * Whether Mingo escalated the call: a guardrail rule, not the policy, set its level. The decision says so; matched rules
 * stand in only when a backend sends no decision. The one test behind the alert, the row's warning icon and the warning
 * Approve.
 */
export function isPolicyEscalated(review: PolicyReviewData | undefined): boolean {
  if (!review) return false;
  return review.decision ? RULE_DECISIONS.has(review.decision) : review.matchedRules.length > 0;
}

/**
 * The policy's level as the settings page names it. A call no rule of the policy matched gets the fallback, which the
 * settings call "Unmatched Actions".
 */
function policyLevelText(review: PolicyReviewData): string | undefined {
  // The level in force is the policy's only when no rule raised it.
  const level = review.policyLevel ?? (isPolicyEscalated(review) ? undefined : review.approvalLevel);
  if (!level) return undefined;
  const label = APPROVAL_LEVEL_META[level].label;
  return review.decision === 'FALLBACK' ? `${label} (Unmatched Actions)` : label;
}

/** Whether {@link PolicyReviewRows} draws anything: a body opens only onto rows it has. */
export function hasPolicyReviewRows(review: PolicyReviewData | undefined): review is PolicyReviewData {
  return !!review && (!!policyLevelText(review) || review.operationCodes.length > 0);
}

/**
 * The review in the command's body, under its arguments (Figma 1374-105458): the policy's level and the operations the
 * review saw, as `key: value` rows like the arguments above them. The matched rules are the policy's own, so they get
 * no row of their own; an escalation says why in its band.
 */
export function PolicyReviewRows({ review, className }: { review: PolicyReviewData; className?: string }) {
  const level = policyLevelText(review);
  if (!hasPolicyReviewRows(review)) return null;
  return (
    // A plain block: the rows stack on their own, and a nested flex column costs WebKit a layout pass (WEBVIEW-001).
    <div className={cn('w-full', className)}>
      {level && <ArgRow argKey="Guardrail Policy" value={level} />}
      {review.operationCodes.length > 0 && <ArgRow argKey="Operations" value={review.operationCodes.join(', ')} />}
    </div>
  );
}

/**
 * "Mingo Escalated": the band under an escalated command, with the review's reason (Figma 1374-105482). Draws nothing
 * for a call that was not escalated. Without a reason it names the rules instead.
 */
export function PolicyEscalationAlert({
  review,
  className,
}: {
  review: PolicyReviewData | undefined;
  className?: string;
}) {
  if (!review || !isPolicyEscalated(review)) return null;
  const description = review.reason ?? review.matchedRules.map(rule => rule.label).join(', ');
  return (
    // A note, not an `alert`: it is part of the thread, read in place, and a live region would interrupt the reader
    // for every escalated call on each replay of the history.
    <Alert
      role="note"
      variant="warning"
      className={cn(
        'flex items-center gap-[var(--spacing-system-m)] rounded-none border-0 p-[var(--spacing-system-m)]',
        className,
      )}
    >
      <span className="flex shrink-0" aria-hidden>
        <AlertTriangleIcon size={20} />
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-[var(--spacing-system-xxs)]">
        <p className="break-words text-h3">Mingo Escalated</p>
        {description && <p className="break-words text-h6">{description}</p>}
      </div>
    </Alert>
  );
}

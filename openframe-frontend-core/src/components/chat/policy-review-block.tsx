'use client';

import { cn } from '../../utils/cn';
import { Tag, type TagProps } from '../ui/tag';
import type { PolicyReviewData } from './types';

type TagVariant = NonNullable<TagProps['variant']>;

interface DecisionStyle {
  label: string;
  variant: TagVariant;
}

const DECISION_STYLES: Record<string, DecisionStyle> = {
  POLICY: { label: 'Policy', variant: 'grey' },
  FALLBACK: { label: 'Not in policy', variant: 'warning' },
  SOFT_DENY: { label: 'Soft deny', variant: 'warning' },
  HARD_DENY: { label: 'Hard deny', variant: 'error' },
};

const LEVEL_LABELS: Record<string, string> = {
  ALLOW: 'Allowed',
  ASK_USER: 'Ask user',
  ASK_TECHNICIAN: 'Ask technician',
  DENY: 'Denied',
};

const RULE_VARIANTS: Record<string, TagVariant> = {
  HARD_DENY: 'error',
  SOFT_DENY: 'warning',
};

function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level;
}

function ruleVariant(type: string | undefined): TagVariant {
  return (type && RULE_VARIANTS[type]) || 'outline';
}

function title(source: string | undefined): string {
  return source === 'CLASSIFIER' ? 'AI review' : 'Policy review';
}

/**
 * The security policy's review of one tool call: which path set the approval level (the admin's
 * policy, the fallback, a soft or hard rule), the level it set, the rules that matched, the reason
 * and the operations it saw. Admin-only detail: the client variants never render it.
 */
export function PolicyReviewBlock({ review, className }: { review: PolicyReviewData; className?: string }) {
  const decision = review.decision ? DECISION_STYLES[review.decision] : undefined;
  const rules = review.matchedRules ?? [];
  const operations = review.operationCodes ?? [];
  const raisedFromPolicy =
    !!review.approvalLevel && !!review.policyLevel && review.approvalLevel !== review.policyLevel;

  return (
    <div
      className={cn(
        'flex w-full flex-col items-start gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)] text-h6',
        className,
      )}
    >
      <div className="flex w-full flex-wrap items-center gap-[var(--spacing-system-xsf)]">
        <span className="text-ods-text-secondary text-h5">{title(review.source)}</span>
        {decision && <Tag as="span" variant={decision.variant} label={decision.label} />}
        {review.approvalLevel && <span className="text-ods-text-primary">{levelLabel(review.approvalLevel)}</span>}
        {raisedFromPolicy && review.policyLevel && (
          <span className="text-ods-text-secondary">(policy: {levelLabel(review.policyLevel)})</span>
        )}
      </div>

      {rules.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-[var(--spacing-system-xsf)]">
          <span className="text-ods-text-secondary">Rules:</span>
          {rules.map(rule => (
            <Tag
              key={rule.code || rule.label}
              as="span"
              variant={ruleVariant(rule.type)}
              label={rule.label || rule.code}
            />
          ))}
        </div>
      )}

      {review.reason && <p className="w-full break-words text-ods-text-primary">{review.reason}</p>}

      {operations.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-[var(--spacing-system-xxs)]">
          <span className="text-ods-text-secondary">Operations:</span>
          <span className="break-all text-ods-text-secondary text-code">{operations.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

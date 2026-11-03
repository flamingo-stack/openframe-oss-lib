import type { PolicyReviewData, PolicyReviewRuleData } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function optionalField<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

function strings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function rules(raw: unknown): PolicyReviewRuleData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map(rule => ({
      code: optionalString(rule.code) ?? '',
      label: optionalString(rule.label) ?? '',
      ...optionalField('type', optionalString(rule.type)),
    }))
    .filter(rule => rule.code !== '' || rule.label !== '');
}

/** Coerce the wire's `policyReview` (approval tool calls and EXECUTING_TOOL chips) into the card's shape. */
export function normalizePolicyReview(raw: unknown): PolicyReviewData | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    source: optionalString(raw.source),
    decision: optionalString(raw.decision),
    approvalLevel: optionalString(raw.approvalLevel),
    policyLevel: optionalString(raw.policyLevel),
    operationCodes: strings(raw.operationCodes),
    matchedRules: rules(raw.matchedRules),
    reason: optionalString(raw.reason),
  };
}

/** Carries a review onto a merged segment only when there is one, so review-less tools keep their exact shape. */
export function withPolicyReview(review: PolicyReviewData | undefined): { policyReview?: PolicyReviewData } {
  return review ? { policyReview: review } : {};
}

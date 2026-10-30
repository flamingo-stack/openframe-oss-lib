import type { CommandReviewData, CommandReviewRuleData } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function strings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function rules(raw: unknown): CommandReviewRuleData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map(rule => ({ code: optionalString(rule.code) ?? '', label: optionalString(rule.label) ?? '' }))
    .filter(rule => rule.code !== '' || rule.label !== '');
}

/** Coerce the wire's RMM `commandReview` (approval tool calls and EXECUTING_TOOL chips) into the card's shape. */
export function normalizeCommandReview(raw: unknown): CommandReviewData | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    decision: optionalString(raw.decision),
    approvalLevel: optionalString(raw.approvalLevel),
    policyLevel: optionalString(raw.policyLevel),
    operationCodes: strings(raw.operationCodes),
    matchedRules: rules(raw.matchedRules),
    reason: optionalString(raw.reason),
  };
}

/** Carries a review onto a merged segment only when there is one, so review-less tools keep their exact shape. */
export function withCommandReview(review: CommandReviewData | undefined): { commandReview?: CommandReviewData } {
  return review ? { commandReview: review } : {};
}

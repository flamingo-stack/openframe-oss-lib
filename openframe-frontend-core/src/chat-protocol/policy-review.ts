import type { PolicyReviewData, PolicyReviewRuleData } from '../components/chat/types/message.types';
import type { ApprovalLevel } from '../types/permissions';
import { isRecord } from './wire-narrow';

const APPROVAL_LEVELS: ReadonlySet<string> = new Set<ApprovalLevel>(['ALLOW', 'ASK_USER', 'ASK_TECHNICIAN', 'DENY']);

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function level(value: unknown): ApprovalLevel | undefined {
  return typeof value === 'string' && APPROVAL_LEVELS.has(value) ? (value as ApprovalLevel) : undefined;
}

function rules(raw: unknown): PolicyReviewRuleData[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap(rule => {
    const code = text(rule.code);
    const label = text(rule.label) ?? code;
    return label ? [{ code: code ?? label, label }] : [];
  });
}

function codes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(text).filter((code): code is string => !!code);
}

/** `{ policyReview }` when the wire carries one, else `{}`: the key is additive, so a row without a review keeps its
 *  exact shape (history, the live stream and their golden corpora). */
export function policyReviewField(raw: unknown): { policyReview?: PolicyReviewData } {
  const policyReview = normalizePolicyReview(raw);
  return policyReview ? { policyReview } : {};
}

/** The first review of the ones given, as an additive field (see {@link policyReviewField}). */
export function keptPolicyReview(...reviews: Array<PolicyReviewData | undefined>): {
  policyReview?: PolicyReviewData;
} {
  const policyReview = reviews.find(review => review !== undefined);
  return policyReview ? { policyReview } : {};
}

/**
 * The wire's `policyReview` (NATS chunk or history row) as the chat reads it, or `undefined` when there is none.
 * Rules without a name and blank operation codes are dropped; an approval level this build does not know is dropped
 * alone, not the review. `decision` and `source` stay open strings (the backend is folding the two deny kinds into
 * one `DENY`).
 */
export function normalizePolicyReview(raw: unknown): PolicyReviewData | undefined {
  if (!isRecord(raw)) return undefined;
  const source = text(raw.source);
  const decision = text(raw.decision);
  const approvalLevel = level(raw.approvalLevel);
  const policyLevel = level(raw.policyLevel);
  const reason = text(raw.reason);
  return {
    ...(source ? { source } : {}),
    ...(decision ? { decision } : {}),
    ...(approvalLevel ? { approvalLevel } : {}),
    ...(policyLevel ? { policyLevel } : {}),
    operationCodes: codes(raw.operationCodes),
    matchedRules: rules(raw.matchedRules),
    ...(reason ? { reason } : {}),
  };
}

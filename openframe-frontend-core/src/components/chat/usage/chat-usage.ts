/**
 * The numbers behind the chat's Usage panel and the ring on its token counter: how full the chat's context is and
 * which colour that is, and how the token figures are written. Pure functions, shared by the panel, the counter's
 * ring and the hosts that build the panel's data, so they cannot disagree.
 */

/** The compaction ratio when the backend did not send one: the design's 75%. */
export const DEFAULT_COMPACTION_THRESHOLD = 0.75;

/** How far before compaction the context turns yellow: ten points, so there is time to tidy the chat first. */
export const CONTEXT_WARNING_LEAD = 0.1;

export type ChatUsageTone = 'default' | 'warning' | 'error';

/**
 * What the Usage panel shows. The host builds it: the company figures from its billing data, the chat figures from
 * the dialog's token usage. Every figure the host does not know yet is null, and the panel writes "—" for it rather
 * than a guessed 0.
 */
export interface ChatUsagePanelData {
  /** The period's free grant and how much of it is spent. Null while unknown. */
  free: { used: number; total: number } | null;
  /** The prepaid balance, what it is worth, and its colour (the host's balance rule). Null while unknown. */
  balance: { tokens: number; usd: number; tone: ChatUsageTone } | null;
  /** The company figures are being read for the first time: their rows draw skeletons. */
  companyLoading?: boolean;
  /** This chat: the last reply's whole context against the model's budget, and the share at which memory is
   *  compacted (the backend's ratio; the design's 75% when absent). On the counter, the counter's own figures win. */
  context: { used: number | null; limit: number | null; compactionThreshold?: number | null };
  /** The last reply's tokens by kind; they add up to `context.used`. Null while the backend does not report it. */
  breakdown: { input: number; cacheRead: number; cacheWrite: number; output: number } | null;
}

/** A usable compaction ratio: the backend's when it is a share in (0, 1], else the default. */
export function compactionThresholdOf(threshold: number | null | undefined): number {
  return typeof threshold === 'number' && threshold > 0 && threshold <= 1 ? threshold : DEFAULT_COMPACTION_THRESHOLD;
}

/** The share of the budget the chat holds, or null while either figure is unknown (no reply yet, no budget). */
export function contextRatio(used: number | null | undefined, limit: number | null | undefined): number | null {
  if (typeof used !== 'number' || typeof limit !== 'number' || !(limit > 0) || used < 0) return null;
  return used / limit;
}

/** Ratios compared in whole basis points, so 65% is yellow at exactly 65% whatever the float error of 0.75 - 0.1. */
const basisPoints = (ratio: number) => Math.round(ratio * 10_000);

/**
 * The context's colour: yellow from ten points before compaction, red once past it (compaction fires when the chat
 * holds MORE than the threshold, so exactly at it is still yellow). Unknown figures read as the default.
 */
export function chatContextTone(
  used: number | null | undefined,
  limit: number | null | undefined,
  threshold?: number | null,
): ChatUsageTone {
  const ratio = contextRatio(used, limit);
  if (ratio == null) return 'default';
  const compactAt = compactionThresholdOf(threshold);
  if (basisPoints(ratio) > basisPoints(compactAt)) return 'error';
  return basisPoints(ratio) >= basisPoints(compactAt - CONTEXT_WARNING_LEAD) ? 'warning' : 'default';
}

/** `12840` → `"12,840"`: the panel's full figures. */
export function formatTokensFull(count: number): string {
  return Math.round(count).toLocaleString('en-US');
}

function trimDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * The company figures, short: K below a million, M from it, one decimal at most, rounded DOWN so a figure never
 * reaches its total before it is spent ("9.9M / 10M", not "10M / 10M"), and a small balance never reads "0M".
 */
export function formatTokensShort(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n >= 1_000_000) return `${trimDecimal(Math.floor(n / 100_000) / 10)}M`;
  if (n >= 1_000) return `${trimDecimal(Math.floor(n / 100) / 10)}K`;
  return String(n);
}

/** `38.4` → `"$38.40"`. */
export function formatUsd(amount: number): string {
  return `$${Math.max(0, amount).toFixed(2)}`;
}

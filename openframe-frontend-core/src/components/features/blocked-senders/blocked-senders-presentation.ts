import {
  BLOCKED_SUBMISSION_FORM_LABELS,
  type BlockedSenderKind,
  type BlockedSenderRow,
  type SenderSignalStrength,
  type SenderSuggestionState,
} from '../../../types/blocked-senders';
import { formatDate } from '../../../utils/format';
import type { StatusBadgeProps } from '../../ui/status-badge';

type BadgeColor = NonNullable<StatusBadgeProps['colorScheme']>;

/** What a missing name or date reads as. */
export const BLOCKED_SENDERS_UNKNOWN = 'Unknown';

/** The copy of a list tab, per kind of sender. */
export const BLOCKED_SENDER_KIND_COPY: Record<
  BlockedSenderKind,
  {
    noun: string;
    nounPlural: string;
    column: string;
    fieldLabel: string;
    placeholder: string;
    searchPlaceholder: string;
    blockLabel: string;
    hint: string;
    /** The empty list's line, worded per kind ("a domain", "an address"). */
    emptyHint: string;
  }
> = {
  domain: {
    noun: 'domain',
    nounPlural: 'domains',
    column: 'Domain',
    fieldLabel: 'Domain',
    placeholder: 'rogue-msp.example',
    searchPlaceholder: 'Domain or reason',
    blockLabel: 'Block domain',
    emptyHint: 'Every domain you block is listed here.',
    hint: "Blocks sign-up, invitations, SSO sign-up and every hub form from the next request. Only for throwaway or abusive domains, never a real company's.",
  },
  address: {
    noun: 'address',
    nounPlural: 'addresses',
    column: 'Email',
    fieldLabel: 'Email address',
    placeholder: 'spammer@gmail.com',
    searchPlaceholder: 'Email or reason',
    blockLabel: 'Block address',
    emptyHint: 'Every address you block is listed here.',
    hint: 'Blocks one address on sign-up and every hub form from the next request. For a sender on a public mail provider (gmail.com, outlook.com), whose domain is never blocked.',
  },
};

export const REASON_LABEL = 'Reason (required)';
export const REASON_PLACEHOLDER = 'The signup or submissions it came from';

/** "with at least 2 strong signals", or nothing when no strong signal is required. */
export function strongSignalsClause(minStrong: number): string {
  if (minStrong <= 0) return '';
  return ` with at least ${minStrong} strong ${minStrong === 1 ? 'signal' : 'signals'}`;
}

export const SOURCE_BADGE: Record<BlockedSenderRow['source'], { label: string; color: BadgeColor }> = {
  manual: { label: 'Manual', color: 'default' },
  auto: { label: 'Auto', color: 'error' },
};

export const SIGNAL_STRENGTH_BADGE: Record<SenderSignalStrength, { label: string; color: BadgeColor }> = {
  strong: { label: 'Strong', color: 'error' },
  medium: { label: 'Medium', color: 'warning' },
  weak: { label: 'Weak', color: 'default' },
  negative: { label: 'Protects', color: 'success' },
};

export const SUGGESTION_STATE_BADGE: Record<SenderSuggestionState, { label: string; color: BadgeColor }> = {
  suggested: { label: 'Suggested', color: 'warning' },
  would_block: { label: 'Would block', color: 'error' },
  blocked: { label: 'Blocked', color: 'error' },
  dismissed: { label: 'Not spam', color: 'success' },
  expired: { label: 'Expired', color: 'default' },
};

/** A suggestion a person can still act on. */
export function isOpenSuggestion(state: SenderSuggestionState): boolean {
  return state === 'suggested' || state === 'would_block';
}

export const KIND_LABEL: Record<BlockedSenderKind, string> = { domain: 'Domain', address: 'Address' };

/** "+3" for a signal that adds, "-10" for one that protects. */
export function signalPoints(points: number): string {
  return points > 0 ? `+${points}` : String(points);
}

/** "1 submission", "5 submissions". */
export function submissionCountLabel(count: number): string {
  return `${count} submission${count === 1 ? '' : 's'}`;
}

/** A form's name; an unknown form shows as sent. */
export function formLabel(form: string): string {
  return BLOCKED_SUBMISSION_FORM_LABELS[form] ?? form;
}

const DATE_PARTS = { year: 'numeric', month: 'short', day: 'numeric' } as const;

/** A stored instant in the lib's date rule (UTC); an absent or unreadable one reads as unknown. */
function formatBlockedInstant(value: string | null, options: Intl.DateTimeFormatOptions): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return BLOCKED_SENDERS_UNKNOWN;
  return formatDate(value, options);
}

/** "Nov 6, 2026". */
export function formatBlockedDate(value: string | null): string {
  return formatBlockedInstant(value, DATE_PARTS);
}

/** "Nov 6, 2026, 14:20". */
export function formatBlockedDateTime(value: string | null): string {
  return formatBlockedInstant(value, { ...DATE_PARTS, hour: '2-digit', minute: '2-digit' });
}

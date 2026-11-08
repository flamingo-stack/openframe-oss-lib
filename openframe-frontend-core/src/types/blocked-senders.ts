/**
 * Blocked senders wire types: the ONE contract between a host's staff routes (the hub's `/api/admin/spam/**`, a thin
 * proxy to OpenFrame's Backoffice blocklist plus the hub's own spam tables) and the lib's `<BlockedSendersPage>`.
 *
 * Server-safe (no React, no DOM): the hub routes import these types from `@flamingo-stack/openframe-frontend-core/types`.
 *
 * Every domain and address is in ONE list (OpenFrame's), and every row is releasable: nothing is "blocked by
 * configuration". `source` is derived by the host: `auto` when the spam recommender added it, else `manual`.
 */

/** THE route base. The page default, and the base every segment below is built on. */
export const BLOCKED_SENDERS_API_PATH = '/api/admin/spam';

/** Rows per page on every tab. The host's routes page with it and the tables draw this many loading rows. */
export const BLOCKED_SENDERS_PAGE_SIZE = 20;

export type BlockedSenderKind = 'domain' | 'address';

export type BlockedSendersTab = 'domains' | 'emails' | 'suggestions' | 'submissions';

/** The tabs, in the order the page shows them. */
export const BLOCKED_SENDERS_TABS: readonly BlockedSendersTab[] = ['domains', 'emails', 'suggestions', 'submissions'];

/** The tab labels. */
export const BLOCKED_SENDERS_TAB_LABELS: Record<BlockedSendersTab, string> = {
  domains: 'Domains',
  emails: 'Emails',
  suggestions: 'Suggestions',
  submissions: 'Blocked submissions',
};

/** A blocked domain or address, as the blocklist holds it. */
export interface BlockedSenderRow {
  value: string;
  kind: BlockedSenderKind;
  reason: string | null;
  addedBy: string | null;
  createdAt: string | null;
  source: 'manual' | 'auto';
}

/** One page of a list (the ticket pager's contract). `page` is 1-based. */
export interface BlockedSendersPageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** A blocklist page. */
export type BlockedSendersListResponse = BlockedSendersPageResult<BlockedSenderRow>;

export type SenderSignalStrength = 'strong' | 'medium' | 'weak' | 'negative';

/** One reason a sender was scored, with what it was read from. `points` is negative for a protecting signal. */
export interface SenderSignal {
  id: string;
  strength: SenderSignalStrength;
  points: number;
  label: string;
  evidence: string;
}

export type SenderSuggestionState = 'suggested' | 'would_block' | 'blocked' | 'dismissed' | 'expired';

/** A scored sender: a domain, or an address on a public mail provider. */
export interface SenderSuggestionRow {
  id: number;
  sender: string;
  kind: BlockedSenderKind;
  score: number;
  strongSignals: number;
  submissionCount: number;
  signals: SenderSignal[];
  state: SenderSuggestionState;
  /** What the scorer decided, in a sentence ("Over the suggest bar (4): waiting for a person."). */
  verdict: string;
  /** The block reason built from the evidence; the Block dialog starts from it. */
  suggestedReason: string;
  lastSubmissionAt: string | null;
}

/** A form submission the gate stopped. It was never sent to HubSpot. */
export interface BlockedSubmissionRow {
  id: number;
  at: string;
  form: string;
  sender: string;
  reason: string | null;
  hubspot: 'not_sent';
}

/** The forms the gate checks, as the Blocked submissions tab names them. An unknown form shows as sent. */
export const BLOCKED_SUBMISSION_FORM_LABELS: Record<string, string> = {
  contact: 'Contact',
  waitlist: 'Waitlist',
  meeting_booking: 'Book a meeting',
  form_rescue: 'Unfinished form',
};

/** The counts on the tabs, the auto-block state, and the bars the Suggestions tab's hint states. */
export interface BlockedSendersOverview {
  counts: Record<BlockedSendersTab, number>;
  autoBlock: { enabled: boolean; dryRun: boolean };
  suggestBar: number;
  blockBar: number;
  /** The strong signals a sender needs, on top of `blockBar`, to be auto-blocked (0: none). */
  blockMinStrong: number;
}

export type BlockedSendersSegment = 'overview' | 'domains' | 'emails' | 'suggestions' | 'submissions';

type QueryParams = Record<string, string | number | null | undefined>;

/**
 * An address beside the endpoint: `<endpoint path>/<path>`, with the endpoint's own query kept (a host's `?env=`)
 * and `params` merged in. An empty, null or undefined param is left out.
 */
function besideBlockedSendersEndpoint(endpoint: string, path: string, params: QueryParams = {}): string {
  const [base, existing] = endpoint.split('?', 2);
  const search = new URLSearchParams(existing ?? '');
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') search.delete(key);
    else search.set(key, String(value));
  }
  const query = search.toString();
  return `${base.replace(/\/+$/, '')}/${path}${query ? `?${query}` : ''}`;
}

/** THE address of a segment: `blockedSendersUrl('/api/admin/spam?env=qa', 'domains', { q: 'x', page: 2 })`. */
export function blockedSendersUrl(endpoint: string, segment: BlockedSendersSegment, params?: QueryParams): string {
  return besideBlockedSendersEndpoint(endpoint, segment, params);
}

/** The address of an action on one suggestion: `<endpoint>/suggestions/<id>/block` or `/not-spam`. */
export function blockedSenderSuggestionUrl(endpoint: string, id: number, action: 'block' | 'not-spam'): string {
  return besideBlockedSendersEndpoint(endpoint, `suggestions/${encodeURIComponent(String(id))}/${action}`);
}

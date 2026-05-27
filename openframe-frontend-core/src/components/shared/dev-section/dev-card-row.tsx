'use client';

/**
 * Shared row chrome for any `DevSectionPage` list (delivery, tickets,
 * future sections). One source of truth for the layout that every
 * dev-section card row uses:
 *   left column  → title (h3) / subtitle (h5 uppercase) / description
 *                  (h4 line-clamp-3), each in a fixed min-height block
 *                  so rows align across the grid
 *   right column → caller-supplied stacked badges
 *
 * Surface stays small on purpose — `rightBadges` is a `ReactNode` so
 * the caller decides how many badges (delivery: 2, tickets: 1-2,
 * future: anything). No behavior baked in: the caller wraps the row
 * in a `<div>` (static, like delivery) or `<button>` (clickable, like
 * tickets) and renders the row content via this component.
 *
 * Pair with `DevCardRowSkeletonList` for the loading state — the
 * skeleton mirrors the same min-heights so the in-flight UI doesn't
 * shift the layout when real data lands.
 */

import type { ReactNode } from 'react';
import { SquareAvatar } from '../../ui/square-avatar';
import {
  TicketAttachmentsList,
  type TicketAttachment,
} from '../../ui/ticket-attachments-list';
import { formatRelativeTime } from '../../../utils/date-utils';

export interface DevCardRowContentProps {
  title: string;
  /** Single-line uppercase metadata (e.g. "UPDATED today, #4271, Code review"). */
  subtitle: string;
  /** 3-line description block. Empty string renders the fallback. */
  description: string;
  /** Fallback copy when `description` is empty. Defaults to a generic
   *  string; ticket / delivery surfaces override. */
  emptyDescription?: string;
  /** Right column — caller renders its own stacked badges. */
  rightBadges: ReactNode;
}

export function DevCardRowContent({
  title,
  subtitle,
  description,
  emptyDescription = 'No description provided',
  rightBadges,
}: DevCardRowContentProps) {
  return (
    <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
      <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
        <div className="min-h-[24px] flex items-center">
          <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] flex-1 line-clamp-2 md:truncate break-words">
            {title}
          </h3>
        </div>
        <div className="min-h-[20px] flex items-center">
          <p className="text-h5 text-ods-text-secondary uppercase tracking-[-0.28px] truncate">
            {subtitle}
          </p>
        </div>
        <div className="min-h-[72px] flex items-center">
          <p className="text-h4 text-ods-text-secondary line-clamp-3 break-words">
            {description || emptyDescription}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 self-start flex flex-col gap-2">
        {rightBadges}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ConversationCardRow — sibling row variant for thread-style conversation
// surfaces (ticket detail drawer, future inbox replies, etc.). Shares the
// outer chrome (`border-b last:border-b-0 p-[12px] md:p-[16px]`) with
// `DevCardRowContent` so a list mixing both variants stays visually
// coherent. Internal layout differs because the data shape is different:
// instead of title/subtitle/description + right-stacked badges, a
// conversation message has an author (avatar + name + role + timestamp)
// and a free-form body that should NOT be line-clamped, plus optional
// attachments rendered via the shared `<TicketAttachmentsList>` so
// download UX is identical to any other attachments surface in the lib.
//
// 2026 conversation-UI best practices applied (UXPin / Salesforce UX /
// Coveo support-ticket research):
//   - Author identity visible on every turn (avatar + name + role chip)
//   - Threaded single-side layout — best for async business support,
//     not alternating bubbles
//   - Relative timestamp right-aligned, absolute on hover (`title` attr)
//   - Body uses `whitespace-pre-wrap break-words` so multi-line replies
//     and long URLs render without clipping
//   - WCAG 2.2 contrast + 44×44 touch targets enforced by the shared
//     `<TicketAttachmentsList>` download button
// ────────────────────────────────────────────────────────────────────────────

export interface ConversationCardRowProps {
  /** Display name of the message author. "You" for the current customer,
   *  "Support team" for any non-customer engagement. */
  author: string;
  /** Optional short role label rendered as an inline chip beside the
   *  author name — e.g. "You", "Original message", "Resolution". Keeps
   *  the header line scannable on long threads. */
  role?: string;
  /** Avatar image URL. Falls back to `author` initials when missing
   *  (initials derived by `<SquareAvatar>` via `getFirstLastInitials`). */
  avatarSrc?: string;
  /** ISO timestamp. Renders via `formatRelativeTime` with the absolute
   *  string in the `title` for hover-precision. `null`/`undefined`
   *  hides the timestamp entirely (e.g. the original ticket body which
   *  shares the ticket's `created_at`). */
  timestamp?: string | null;
  /** Free-form message body. Empty string + zero attachments renders
   *  nothing (the row is skipped at the caller level). */
  body: string;
  /** Files attached to this message. Rendered through the lib's
   *  `<TicketAttachmentsList>` so the chip styling, file-icon picker
   *  and download button match every other attachments surface. */
  attachments?: TicketAttachment[];
  /** Author bucket — kept for semantic markup + future styling needs.
   *  Does NOT drive avatar color anymore: the avatar always renders
   *  with the canonical `<SquareAvatar>` defaults (ODS palette,
   *  derived by the component itself). Adding bespoke bg-color
   *  overrides per role drifted from the ODS theme and was reverted. */
  variant?: 'current-user' | 'support';
}

export function ConversationCardRow({
  author,
  role,
  avatarSrc,
  timestamp,
  body,
  attachments,
  variant = 'support',
}: ConversationCardRowProps) {
  const hasBody = body.trim().length > 0;
  const hasAttachments = !!attachments && attachments.length > 0;
  if (!hasBody && !hasAttachments) return null;

  const relativeTime = timestamp ? formatRelativeTime(timestamp) : null;

  return (
    <article
      className="border-b border-ods-border last:border-b-0 p-[12px] md:p-[16px] flex gap-[12px] md:gap-[16px] w-full"
      aria-label={`${author}${relativeTime ? ` · ${relativeTime}` : ''}`}
    >
      {/* Avatar — canonical `<SquareAvatar>` with NO className override.
          Color, border, and fallback styling all come from the ODS
          theme defaults (`bg-ods-bg` + `border-ods-border` +
          `text-ods-text-primary`). Per-role bespoke colors
          (bg-ods-flamingo-pink for customer / bg-ods-flamingo-cyan
          for support) were tried + reverted — they drifted from the
          standard theme and broke parity with other surfaces that
          use SquareAvatar without overrides (assignee-dropdown,
          ticket-info-section). */}
      <SquareAvatar
        src={avatarSrc}
        alt={author}
        fallback={author}
        size="sm"
        variant="round"
      />

      <div className="flex-1 min-w-0 flex flex-col gap-[8px] md:gap-[12px]">
        {/* Header row — author + optional role chip on the left,
            relative time on the right. The header collapses cleanly on
            narrow viewports by wrapping. */}
        <div className="flex items-baseline justify-between gap-[8px] flex-wrap">
          <div className="flex items-baseline gap-[8px] min-w-0">
            <h3 className="text-h4 text-ods-text-primary truncate">{author}</h3>
            {role && (
              <span className="text-h6 text-ods-text-secondary uppercase tracking-[-0.28px] shrink-0">
                {role}
              </span>
            )}
          </div>
          {relativeTime && (
            <time
              className="text-h6 text-ods-text-secondary uppercase tracking-[-0.28px] shrink-0"
              dateTime={timestamp ?? undefined}
              title={timestamp ?? undefined}
            >
              {relativeTime}
            </time>
          )}
        </div>

        {/* Body — full message, no line-clamp. `pre-wrap` preserves
            authored line breaks; `break-words` handles long URLs. */}
        {hasBody && (
          <p className="text-h4 text-ods-text-primary whitespace-pre-wrap break-words">
            {body}
          </p>
        )}

        {/* Attachments — delegated to the canonical lib component so
            every file-attachment surface (chat, drawer, future inbox)
            shares the same chip styling + download UX. */}
        {hasAttachments && <TicketAttachmentsList attachments={attachments!} />}
      </div>
    </article>
  );
}

/**
 * Skeleton variant matching `ConversationCardRow`'s layout. Used by
 * the ticket-detail-drawer's timeline panel while engagements load —
 * mirrors avatar + header + body so the loading→loaded swap doesn't
 * reshape the row vertically.
 */
export function ConversationCardRowSkeleton() {
  return (
    <div className="border-b border-ods-border last:border-b-0 p-[12px] md:p-[16px] flex gap-[12px] md:gap-[16px] w-full">
      {/* Avatar — matches SquareAvatar size="sm" (32px) used by the
          real row. Round to match `variant="round"`. */}
      <div className="h-8 w-8 shrink-0 rounded-full bg-ods-border animate-pulse" />
      <div className="flex-1 min-w-0 flex flex-col gap-[8px] md:gap-[12px]">
        {/* Header row — author + role chip + timestamp placeholders. */}
        <div className="flex items-baseline justify-between gap-[8px]">
          <div className="flex items-baseline gap-[8px] flex-1">
            <div className="h-[24px] w-32 bg-ods-border rounded animate-pulse" />
            <div className="h-[20px] w-16 bg-ods-border rounded animate-pulse" />
          </div>
          <div className="h-[20px] w-20 bg-ods-border rounded animate-pulse shrink-0" />
        </div>
        {/* Body — two-line placeholder. */}
        <div className="space-y-2">
          <div className="h-[20px] w-full bg-ods-border rounded animate-pulse" />
          <div className="h-[20px] w-3/4 bg-ods-border rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/** Multi-row skeleton list — drop-in for the conversation timeline's
 *  loading state. Defaults to 2 rows so the placeholder fits in a
 *  reasonable vertical footprint without dominating the drawer. */
export function ConversationCardRowSkeletonList({ rows = 2 }: { rows?: number }) {
  return (
    <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
      {Array.from({ length: rows }, (_, i) => (
        <ConversationCardRowSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton rendering for a single row — the bars mirror the same
 * min-heights as `DevCardRowContent` so the loading→loaded swap
 * doesn't reflow.
 */
export function DevCardRowSkeleton() {
  return (
    <div className="border-b border-ods-border last:border-b-0 p-[12px] md:p-[16px]">
      <div className="flex flex-col md:flex-row items-start justify-between gap-[12px] md:gap-[16px] w-full">
        <div className="flex-1 min-w-0 w-full md:w-auto flex flex-col gap-[12px] md:gap-[16px]">
          <div className="min-h-[24px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-full" />
          </div>
          <div className="min-h-[20px] flex items-center">
            <div className="h-[20px] bg-ods-border rounded animate-pulse w-1/2" />
          </div>
          <div className="min-h-[72px] flex items-center">
            <div className="flex-1 space-y-1">
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full" />
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-full" />
              <div className="h-[20px] bg-ods-border rounded animate-pulse w-2/3" />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 self-start flex flex-col gap-2">
          <div className="h-[32px] w-[100px] bg-ods-border rounded animate-pulse" />
          <div className="h-[32px] w-[120px] bg-ods-border rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * The standard "5 skeleton rows inside a bordered card" loading state
 * used by every list shell. Both delivery (`delivery-table.tsx`) and
 * tickets (`tickets-list.tsx`) mount this directly.
 */
export function DevCardRowSkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
      {Array.from({ length: rows }, (_, i) => (
        <DevCardRowSkeleton key={i} />
      ))}
    </div>
  );
}

'use client';

/**
 * `<ChatMessageRow>` — THE single source of truth for a Slack-channel-style
 * message row. Rendered by BOTH:
 *   - the OpenMSP Slack-community feed (hub `components/slack/chat-interface.tsx`)
 *   - the customer ticket conversation feed (lib `ticket-detail-drawer.tsx`)
 *
 * Both surfaces render THIS component, so they are pixel-identical by
 * construction — avatar size, font sizes, weights, spacing, and line-heights
 * can never drift apart. The markup is the verbatim Slack `MessageItem` layout
 * (avatar `w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover` + bold name +
 * relative time + `whitespace-pre-wrap` body). Colors are ODS theme tokens
 * ONLY (`text-ods-text-primary` / `text-ods-text-secondary`). The `text-[Npx]`
 * / `font-body` / `leading-*` utilities are FONT/SIZE, not color — they are
 * required to match the Slack typography exactly.
 *
 * `footer` is the only per-surface variation slot: the Slack feed passes its
 * "N replies" badge; the ticket feed passes `<TicketAttachmentsList>`.
 */

import { useState, type ReactNode } from 'react';
import Image from '../../embed-shims/next-image';
import { personInitials } from '../../utils/format';
import { useProxiedImageUrl } from './hooks/use-proxied-image-url';

export interface ChatMessageRowProps {
  /** Display name (bold, top-left). */
  displayName: string;
  /** Avatar image URL. Proxied via `useProxiedImageUrl`; falls back to
   *  initials in a same-sized `rounded-lg` box when absent. */
  avatarUrl?: string | null;
  /** Pre-formatted relative-time label (e.g. "2h ago"). Caller formats it —
   *  Slack passes its server `displayTime`, tickets pass
   *  `formatRelativeTime(createdAt)`. Empty/undefined hides the time. */
  timeLabel?: string | null;
  /** Message body — a plain string (rendered `whitespace-pre-wrap`) or a
   *  pre-rendered node (the Slack surfaces pass mrkdwn-formatted nodes).
   *  Empty/absent + no footer renders nothing under the header. */
  body: string | ReactNode;
  /** Per-surface slot under the body: Slack reply badge / ticket attachments. */
  footer?: ReactNode;
}

export function ChatMessageRow({ displayName, avatarUrl, timeLabel, body, footer }: ChatMessageRowProps) {
  // Avatars load directly from their (https) host — same as the rest of the app,
  // so the browser disk-caches them (Google/etc. send `cache-control: max-age`).
  // `useProxiedImageUrl` only rewrites http/relative URLs; https pass through.
  const proxiedAvatar = useProxiedImageUrl(avatarUrl ?? '');
  const resolvedAvatar = proxiedAvatar || avatarUrl || undefined;
  // Fall back to the initials box if the avatar load FAILS (transient CDN 429,
  // ad-blocker, dead URL) instead of showing a broken image. Keyed on the URL
  // (not a bool) so a later render with a DIFFERENT avatar re-attempts the load
  // rather than inheriting a stale failure.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = resolvedAvatar && resolvedAvatar !== failedSrc ? resolvedAvatar : undefined;
  const hasBody = typeof body === 'string' ? body.trim().length > 0 : body != null && body !== false;

  return (
    <div className="flex w-full min-w-0 gap-2 md:gap-3">
      {/* Avatar — verbatim Slack sizing: 32px → 40px, rounded-lg, object-cover.
          Initials fallback uses the SAME box so layout is identical with or
          without an image. */}
      {src ? (
        <Image
          src={src}
          alt={displayName}
          className="h-8 w-8 flex-shrink-0 rounded-lg object-cover md:h-10 md:w-10"
          width={40}
          height={40}
          onError={() => setFailedSrc(resolvedAvatar ?? null)}
        />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-bg text-ods-text-primary text-h6 md:h-10 md:w-10">
          {personInitials(displayName) || '?'}
        </div>
      )}

      {/* Message content */}
      <div className="min-w-0 max-w-full flex-1">
        {/* Header — name + relative time. Verbatim Slack typography. */}
        <div className="mb-1 flex min-w-0 max-w-full items-center gap-2">
          <span className="truncate font-body text-[14px] font-bold leading-[1.33] tracking-[-0.02em] text-ods-text-primary md:text-[15px]">
            {displayName}
          </span>
          {timeLabel && <span className="flex-shrink-0 text-ods-text-secondary text-h6">{timeLabel}</span>}
        </div>

        {/* Body — verbatim Slack: 12/14px, pre-wrap, break-words. */}
        {hasBody && (
          <div className="min-w-0 max-w-full whitespace-pre-wrap break-words text-ods-text-primary text-h6">{body}</div>
        )}

        {footer}
      </div>
    </div>
  );
}

/**
 * Skeleton with 1:1 structural parity to `<ChatMessageRow>` — SAME wrapper
 * (`flex gap-2 md:gap-3`), SAME avatar box (`w-8 h-8 md:w-10 md:h-10
 * rounded-lg`), SAME header `mb-1`, and bar heights matching the real
 * name/time/body line-heights so the loading→loaded swap does not reflow.
 */
export function ChatMessageRowSkeleton() {
  // Bars use `bg-ods-border` (NOT `bg-ods-skeleton` — that token resolves to
  // transparent in this build, leaving the box visually empty).
  return (
    <div className="flex w-full min-w-0 gap-2 md:gap-3">
      <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-lg bg-ods-border md:h-10 md:w-10" />
      <div className="min-w-0 flex-1">
        {/* Header row — name + time bars, same mb-1 + gap-2 as the real header. */}
        <div className="mb-1 flex items-center gap-2">
          <div className="h-[15px] w-24 animate-pulse rounded bg-ods-border md:h-[20px] md:w-32" />
          <div className="h-[12px] w-12 animate-pulse rounded bg-ods-border md:h-[16px] md:w-16" />
        </div>
        {/* Two body lines — match the 12/14px body line-height. */}
        <div className="h-[14px] w-full animate-pulse rounded bg-ods-border md:h-[18px]" />
        <div className="mt-1 h-[14px] w-3/4 animate-pulse rounded bg-ods-border md:h-[18px]" />
      </div>
    </div>
  );
}

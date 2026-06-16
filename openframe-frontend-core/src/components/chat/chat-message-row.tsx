'use client'

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

import Image from '../../embed-shims/next-image'
import { getFirstLastInitials } from '../../utils/format'
import { useProxiedImageUrl } from './hooks/use-proxied-image-url'
import { useState, type ReactNode } from 'react'

export interface ChatMessageRowProps {
  /** Display name (bold, top-left). */
  displayName: string
  /** Avatar image URL. Proxied via `useProxiedImageUrl`; falls back to
   *  initials in a same-sized `rounded-lg` box when absent. */
  avatarUrl?: string | null
  /** Pre-formatted relative-time label (e.g. "2h ago"). Caller formats it —
   *  Slack passes its server `displayTime`, tickets pass
   *  `formatRelativeTime(createdAt)`. Empty/undefined hides the time. */
  timeLabel?: string | null
  /** Message body. Empty + no footer renders nothing under the header. */
  body: string
  /** Per-surface slot under the body: Slack reply badge / ticket attachments. */
  footer?: ReactNode
}

export function ChatMessageRow({
  displayName,
  avatarUrl,
  timeLabel,
  body,
  footer,
}: ChatMessageRowProps) {
  // Avatars load directly from their (https) host — same as the rest of the app,
  // so the browser disk-caches them (Google/etc. send `cache-control: max-age`).
  // `useProxiedImageUrl` only rewrites http/relative URLs; https pass through.
  const proxiedAvatar = useProxiedImageUrl(avatarUrl ?? '')
  const resolvedAvatar = proxiedAvatar || avatarUrl || undefined
  // Fall back to the initials box if the avatar load FAILS (transient CDN 429,
  // ad-blocker, dead URL) instead of showing a broken image. Keyed on the URL
  // (not a bool) so a later render with a DIFFERENT avatar re-attempts the load
  // rather than inheriting a stale failure.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const src = resolvedAvatar && resolvedAvatar !== failedSrc ? resolvedAvatar : undefined
  const hasBody = body.trim().length > 0

  return (
    <div className="flex gap-2 md:gap-3 w-full min-w-0">
      {/* Avatar — verbatim Slack sizing: 32px → 40px, rounded-lg, object-cover.
          Initials fallback uses the SAME box so layout is identical with or
          without an image. */}
      {src ? (
        <Image
          src={src}
          alt={displayName}
          className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover flex-shrink-0"
          width={40}
          height={40}
          onError={() => setFailedSrc(resolvedAvatar ?? null)}
        />
      ) : (
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex-shrink-0 flex items-center justify-center bg-ods-bg border border-ods-border text-[12px] font-medium text-ods-text-primary font-body">
          {getFirstLastInitials(displayName) || '?'}
        </div>
      )}

      {/* Message content */}
      <div className="flex-1 min-w-0 max-w-full">
        {/* Header — name + relative time. Verbatim Slack typography. */}
        <div className="flex items-center gap-2 max-w-full mb-1 min-w-0">
          <span className="text-[14px] md:text-[15px] font-bold leading-[1.33] text-ods-text-primary font-body tracking-[-0.02em] truncate">
            {displayName}
          </span>
          {timeLabel && (
            <span className="text-[11px] md:text-[12px] font-medium leading-[1.43] text-ods-text-secondary font-body flex-shrink-0">
              {timeLabel}
            </span>
          )}
        </div>

        {/* Body — verbatim Slack: 12/14px, pre-wrap, break-words. */}
        {hasBody && (
          <div className="text-[12px] md:text-[14px] font-medium leading-[1.43] text-ods-text-primary font-body whitespace-pre-wrap break-words min-w-0 max-w-full">
            {body}
          </div>
        )}

        {footer}
      </div>
    </div>
  )
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
    <div className="flex gap-2 md:gap-3 w-full min-w-0">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex-shrink-0 bg-ods-border animate-pulse" />
      <div className="flex-1 min-w-0">
        {/* Header row — name + time bars, same mb-1 + gap-2 as the real header. */}
        <div className="flex items-center gap-2 mb-1">
          <div className="h-[15px] md:h-[20px] w-24 md:w-32 bg-ods-border rounded animate-pulse" />
          <div className="h-[12px] md:h-[16px] w-12 md:w-16 bg-ods-border rounded animate-pulse" />
        </div>
        {/* Two body lines — match the 12/14px body line-height. */}
        <div className="h-[14px] md:h-[18px] w-full bg-ods-border rounded animate-pulse" />
        <div className="h-[14px] md:h-[18px] w-3/4 bg-ods-border rounded animate-pulse mt-1" />
      </div>
    </div>
  )
}

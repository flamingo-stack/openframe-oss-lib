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
import { AVATAR_SIZE_PX } from '../../styles/component-sizes';
import { cn } from '../../utils/cn';
import { personInitials } from '../../utils/format';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { loadingItemProps, useLoadingScope } from '../ui/loading-scope';
import { useProxiedImageUrl } from './hooks/use-proxied-image-url';

/** The row: avatar beside the content, verbatim Slack spacing. */
const ROW_CLASS = 'flex w-full min-w-0 gap-2 md:gap-3';
/** The avatar box (image, initials and skeleton alike): 32px → 40px, rounded-lg. */
const AVATAR_BOX_CLASS = 'h-8 w-8 flex-shrink-0 rounded-lg md:h-10 md:w-10';
/** The content column beside the avatar. */
const CONTENT_CLASS = 'min-w-0 max-w-full flex-1';
/** The header line: name + relative time. */
const HEADER_CLASS = 'mb-1 flex min-w-0 max-w-full items-center gap-2';
/** The name's type (14/15px, leading 1.33): its line height is the header's in both forms. */
const NAME_TYPE_CLASS = 'font-body text-[14px] font-bold leading-[1.33] tracking-[-0.02em] md:text-[15px]';
/**
 * How many lines a message body typically takes while it is read (a short chat message wraps once or twice). A
 * typical count, not a measured one: the loaded body takes its own height.
 */
const CHAT_MESSAGE_ROW_BODY_LINES = 2;

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
  /**
   * The row while it is read (also inside a loading scope): the same boxes, the avatar a skeleton box, the name and
   * time bars at their real line heights, the body a typical run of lines. Pass empty data props
   * (`displayName=""`, `body=""`).
   */
  loading?: boolean;
  /** List markers (`data-loading-item`), set by the list on its rows; forwarded in both forms. */
  [key: `data-${string}`]: unknown;
}

export function ChatMessageRow(props: ChatMessageRowProps) {
  const loading = useLoadingScope() || !!props.loading;
  if (loading) return <ChatMessageRowLoading {...loadingItemProps(props)} />;
  return <ChatMessageRowLoaded {...props} />;
}

function ChatMessageRowLoaded(props: ChatMessageRowProps) {
  const { displayName, avatarUrl, timeLabel, body, footer } = props;
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
    <div className={ROW_CLASS} {...loadingItemProps(props)}>
      {/* Avatar — verbatim Slack sizing: 32px → 40px, rounded-lg, object-cover.
          Initials fallback uses the SAME box so layout is identical with or
          without an image. */}
      {src ? (
        <Image
          src={src}
          alt={displayName}
          className={cn(AVATAR_BOX_CLASS, 'object-cover')}
          width={AVATAR_SIZE_PX.md}
          height={AVATAR_SIZE_PX.md}
          onError={() => setFailedSrc(resolvedAvatar ?? null)}
        />
      ) : (
        <div
          className={cn(
            AVATAR_BOX_CLASS,
            'flex items-center justify-center border border-ods-border bg-ods-bg text-ods-text-primary text-h6',
          )}
        >
          {personInitials(displayName) || '?'}
        </div>
      )}

      {/* Message content */}
      <div className={CONTENT_CLASS}>
        {/* Header — name + relative time. Verbatim Slack typography. */}
        <div className={HEADER_CLASS}>
          <span className={cn('truncate text-ods-text-primary', NAME_TYPE_CLASS)}>{displayName}</span>
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
 * The row's loading form, from the loaded row's own class constants: the same wrapper, avatar box and header, the
 * name bar at the name's line height (`inherit` inside the name's type), the time bar at `text-h6`, and the body a
 * typical run of `text-h6` lines.
 */
function ChatMessageRowLoading(markers: { [key: `data-${string}`]: unknown }) {
  return (
    <div className={ROW_CLASS} {...markers}>
      <UnifiedSkeleton className={AVATAR_BOX_CLASS} />
      <div className={CONTENT_CLASS}>
        <div className={HEADER_CLASS}>
          <TextLineSkeleton type="inherit" as="span" className={cn(NAME_TYPE_CLASS, 'w-24 md:w-32')} />
          <TextLineSkeleton type="h6" as="span" className="w-12 flex-shrink-0 md:w-16" />
        </div>
        <TextLineSkeleton type="h6" lines={CHAT_MESSAGE_ROW_BODY_LINES} />
      </div>
    </div>
  );
}

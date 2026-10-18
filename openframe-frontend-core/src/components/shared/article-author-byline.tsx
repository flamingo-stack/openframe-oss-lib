'use client';

/**
 * Shared "author byline" card used by article-shaped detail pages
 * (blog post, product release, onboarding guide, investor update).
 *
 * MOVED from the hub so any consuming app can embed it; hub call sites
 * import it directly and pass their platform-aware copy explicitly
 * (`fallbackBio={defaultAuthorFallbackBio()}` from the hub's app-config).
 *
 * Embed-readiness contract:
 *   - `Link` / `Image` render through the embed-shims (plain `<a>` / `<img>`
 *     in non-Next hosts; the real Next primitives once the host registers
 *     them at app init).
 *   - The avatar is proxied through the OPTIONAL ambient `ChatRuntime`
 *     (`endpoints.imageProxyUrlPrefix`, same config `useProxiedImageUrl`
 *     reads) — when no runtime is mounted the raw URL renders as-is, so the
 *     component never throws outside a provider. Hosts can also inject
 *     `proxyImageUrl` to bypass the runtime entirely.
 *   - `fallbackBio` is a PLAIN prop (no app-config import): the lib has no
 *     platform awareness; pass copy or leave it absent to render nothing.
 *
 * Render order: avatar → name + job title + date → bio (when present).
 * Returns null when `author` is empty (no card rendered); in a loading scope it is
 * `ArticleAuthorBylineSkeleton`.
 */

import { Calendar, User } from 'lucide-react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import Image from '../../embed-shims/next-image';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { formatBioText, formatDateWithTimezone } from '../../utils/format';
import { getProxiedImageUrl } from '../../utils/image-proxy';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';

export interface ArticleAuthorBylineProps {
  /** Author display name. Required — block is hidden when null/empty. */
  author: string | null;
  /** Avatar URL. Falls back to a placeholder when null. */
  avatar?: string | null;
  /** Optional bio paragraph rendered below the name. */
  bio?: string | null;
  /** Optional job title rendered immediately under the name. */
  jobTitle?: string | null;
  /** Optional published date (ISO string or Date). Rendered next to the name. */
  publishedAt?: string | Date | null;
  /** Optional link target for the author name (e.g. the author page). */
  href?: string | null;
  /**
   * Fallback paragraph when `bio` is empty. Plain copy — the lib has no
   * platform/config awareness, so hosts that want a branded default
   * ("Contributing author on the {platform} platform") pass it explicitly
   * (the hub wrapper derives it from `getAppConfig()`). Absent/null ⇒
   * nothing renders below the name when `bio` is empty.
   */
  fallbackBio?: string | null;
  /** Avatar size variant. `md` = 56px (default), `lg` = 64px. */
  size?: 'md' | 'lg';
  /**
   * Host-injected avatar-URL mapper. Wins over the ambient-runtime proxy
   * resolution. Use when the host proxies images outside the `ChatRuntime`
   * config (e.g. a bespoke CDN rewrite).
   */
  proxyImageUrl?: (url: string) => string;
  className?: string;
}

/** The card's layout, read by the card and by its skeleton, so the skeleton is the card's size. */
const BYLINE_FRAME_CLASS = cn(
  'rounded-lg border border-ods-border bg-ods-card p-6',
  'flex flex-col items-start gap-4 content-md:flex-row',
);
const AVATAR_SIZE_CLASS = { md: 'w-14 h-14', lg: 'w-16 h-16' } as const;
const AVATAR_BORDER_CLASS = 'rounded-full border-2 border-ods-border';
const BODY_CLASS = 'min-w-0 flex-1';
const NAME_ROW_CLASS = 'flex flex-wrap items-baseline gap-x-3 gap-y-1';
const NAME_CLASS = 'text-ods-text-primary text-h5';
const JOB_TITLE_CLASS = 'text-body-sm mt-0.5 font-body text-ods-text-secondary';
const BIO_CLASS = 'text-body-md mt-2 font-body leading-relaxed text-ods-text-secondary';

function formatDate(value: string | Date): string {
  // A published date is a content date: UTC-pinned through the one renderer, so
  // the server and every client agree on the day (React #418).
  return formatDateWithTimezone(value, null, 'long');
}

export function ArticleAuthorByline({
  author,
  avatar,
  bio,
  jobTitle,
  publishedAt,
  href,
  fallbackBio,
  size = 'md',
  proxyImageUrl,
  className,
}: ArticleAuthorBylineProps) {
  // Optional runtime — `useChatRuntime` returns null outside a provider, so
  // the byline works in bare embeds (raw avatar URL) and proxies whenever the
  // host mounted a runtime with `imageProxyUrlPrefix` (the hub always does).
  const runtime = useChatRuntime();
  const loading = useLoadingScope();
  if (loading) return <ArticleAuthorBylineSkeleton size={size} className={className} />;
  if (!author) return null;

  const proxiedAvatar = avatar
    ? proxyImageUrl
      ? proxyImageUrl(avatar)
      : (getProxiedImageUrl(avatar, {
          proxyPrefix: runtime?.endpoints.imageProxyUrlPrefix,
          skipDomains: runtime?.endpoints.imageProxySkipDomains,
          directHttps: true,
        }) ?? avatar)
    : '';

  // Class-driven sizing (md = 56px, lg = 64px). The numeric pair feeds only
  // the Image element's intrinsic width/height attributes (required by the
  // Next image shim) — layout comes from the classes.
  const avatarSizeClass = AVATAR_SIZE_CLASS[size];
  const avatarIconClass = size === 'lg' ? 'w-8 h-8' : 'w-7 h-7';
  const avatarDim = size === 'lg' ? 64 : 56;
  const formattedBio = formatBioText(bio ?? null);
  const dateLabel = publishedAt ? formatDate(publishedAt) : '';

  return (
    <div
      className={cn(BYLINE_FRAME_CLASS, className)}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatar ? (
          <Image
            src={proxiedAvatar || avatar}
            alt={author}
            width={avatarDim}
            height={avatarDim}
            className={cn(AVATAR_BORDER_CLASS, 'object-cover', avatarSizeClass)}
          />
        ) : (
          <div
            className={cn(
              'flex items-center justify-center bg-ods-bg',
              AVATAR_BORDER_CLASS,
              avatarSizeClass,
            )}
          >
            <User className={cn('text-ods-text-secondary', avatarIconClass)} />
          </div>
        )}
      </div>

      {/* Name + meta + bio */}
      <div className={BODY_CLASS}>
        <div className={NAME_ROW_CLASS}>
          <h3 className={NAME_CLASS}>
            {href ? (
              <Link href={href} className="transition-colors hover:text-ods-accent">
                {author}
              </Link>
            ) : (
              author
            )}
          </h3>
          {dateLabel && (
            <span className="text-body-sm inline-flex items-center gap-1 font-body text-ods-text-secondary">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </span>
          )}
        </div>
        {jobTitle && <p className={JOB_TITLE_CLASS}>{jobTitle}</p>}
        {formattedBio ? (
          <p className={BIO_CLASS}>{formattedBio}</p>
        ) : fallbackBio ? (
          <p className="text-body-md mt-2 font-body italic text-ods-text-secondary">{fallbackBio}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The byline while its author is read: the card frame, the avatar circle at its size, and bars for the name (h5),
 * the job title and three bio lines, each inside the loaded text's own element so it takes that line's height.
 */
export function ArticleAuthorBylineSkeleton({
  size = 'md',
  className,
}: {
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <div className={cn(BYLINE_FRAME_CLASS, className)} aria-hidden>
      <div className="flex-shrink-0">
        <UnifiedSkeleton variant="circular" className={AVATAR_SIZE_CLASS[size]} />
      </div>
      <div className={cn(BODY_CLASS, 'w-full')}>
        <div className={NAME_ROW_CLASS}>
          <h3 className={NAME_CLASS}>
            <TextLineSkeleton type="inherit" as="span" className="w-40" />
          </h3>
        </div>
        <p className={JOB_TITLE_CLASS}>
          <TextLineSkeleton type="inherit" as="span" className="w-32" />
        </p>
        <p className={BIO_CLASS}>
          <TextLineSkeleton type="inherit" as="span" lines={3} className="w-full" />
        </p>
      </div>
    </div>
  );
}

'use client'

/**
 * Shared "author byline" card used by article-shaped detail pages
 * (blog post, product release, onboarding guide, investor update).
 *
 * MOVED from the hub (`components/shared/article-author-byline.tsx`) so any
 * consuming app can embed it; the hub keeps a thin wrapper that pre-binds its
 * host-specific injections (the platform-aware `fallbackBio` default derived
 * from `getAppConfig()`).
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
 * Returns null when `author` is empty (no card rendered).
 */

import React from 'react'
import { Calendar, User } from 'lucide-react'
import Image from '../../embed-shims/next-image'
import Link from '../../embed-shims/next-link'
import { cn } from '../../utils/cn'
import { formatBioText } from '../../utils/format'
import { getProxiedImageUrl } from '../../utils/image-proxy'
import { useChatRuntime } from '../../contexts/chat-runtime-context'

export interface ArticleAuthorBylineProps {
  /** Author display name. Required — block is hidden when null/empty. */
  author: string | null
  /** Avatar URL. Falls back to a placeholder when null. */
  avatar?: string | null
  /** Optional bio paragraph rendered below the name. */
  bio?: string | null
  /** Optional job title rendered immediately under the name. */
  jobTitle?: string | null
  /** Optional published date (ISO string or Date). Rendered next to the name. */
  publishedAt?: string | Date | null
  /** Optional link target for the author name (e.g. the author page). */
  href?: string | null
  /**
   * Fallback paragraph when `bio` is empty. Plain copy — the lib has no
   * platform/config awareness, so hosts that want a branded default
   * ("Contributing author on the {platform} platform") pass it explicitly
   * (the hub wrapper derives it from `getAppConfig()`). Absent/null ⇒
   * nothing renders below the name when `bio` is empty.
   */
  fallbackBio?: string | null
  /** Avatar size variant. `md` = 56px (default), `lg` = 64px. */
  size?: 'md' | 'lg'
  /**
   * Host-injected avatar-URL mapper. Wins over the ambient-runtime proxy
   * resolution. Use when the host proxies images outside the `ChatRuntime`
   * config (e.g. a bespoke CDN rewrite).
   */
  proxyImageUrl?: (url: string) => string
  className?: string
}

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  // `timeZone: 'UTC'` keeps the SSR (server = UTC) and client (user's local tz)
  // renders identical — without it a published_at near a midnight boundary
  // formats to a different day on each side, triggering a React #418 hydration
  // text mismatch. Matches the convention in blog-metadata.tsx / investor-update.
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
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
  const runtime = useChatRuntime()
  if (!author) return null

  const proxiedAvatar = avatar
    ? proxyImageUrl
      ? proxyImageUrl(avatar)
      : (getProxiedImageUrl(avatar, {
          proxyPrefix: runtime?.endpoints.imageProxyUrlPrefix,
          skipDomains: runtime?.endpoints.imageProxySkipDomains,
          directHttps: true,
        }) ?? avatar)
    : ''

  // Class-driven sizing (md = 56px, lg = 64px). The numeric pair feeds only
  // the Image element's intrinsic width/height attributes (required by the
  // Next image shim) — layout comes from the classes.
  const avatarSizeClass = size === 'lg' ? 'w-16 h-16' : 'w-14 h-14'
  const avatarIconClass = size === 'lg' ? 'w-8 h-8' : 'w-7 h-7'
  const avatarDim = size === 'lg' ? 64 : 56
  const formattedBio = formatBioText(bio ?? null)
  const dateLabel = publishedAt ? formatDate(publishedAt) : ''

  return (
    <div
      className={cn(
        'bg-ods-card border border-ods-border rounded-lg p-6',
        'flex flex-col md:flex-row gap-4 items-start',
        className,
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatar ? (
          <Image
            src={proxiedAvatar || avatar}
            alt={author}
            width={avatarDim}
            height={avatarDim}
            className={cn('rounded-full border-2 border-ods-border object-cover', avatarSizeClass)}
          />
        ) : (
          <div
            className={cn(
              'rounded-full border-2 border-ods-border bg-ods-bg flex items-center justify-center',
              avatarSizeClass,
            )}
          >
            <User className={cn('text-ods-text-secondary', avatarIconClass)} />
          </div>
        )}
      </div>

      {/* Name + meta + bio */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-h5 text-ods-text-primary">
            {href ? (
              <Link href={href} className="hover:text-ods-accent transition-colors">
                {author}
              </Link>
            ) : (
              author
            )}
          </h3>
          {dateLabel && (
            <span className="inline-flex items-center gap-1 font-body text-body-sm text-ods-text-secondary">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </span>
          )}
        </div>
        {jobTitle && (
          <p className="font-body text-body-sm text-ods-text-secondary mt-0.5">
            {jobTitle}
          </p>
        )}
        {formattedBio ? (
          <p className="font-body text-body-md text-ods-text-secondary leading-relaxed mt-2">
            {formattedBio}
          </p>
        ) : fallbackBio ? (
          <p className="font-body text-body-md text-ods-text-secondary italic mt-2">
            {fallbackBio}
          </p>
        ) : null}
      </div>
    </div>
  )
}

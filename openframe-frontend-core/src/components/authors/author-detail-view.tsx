'use client'

/**
 * Author detail-page body — identity header (avatar → name → job title →
 * socials), bio, expertise badges, and a `children` slot for the authored-
 * content rail. THE one implementation behind the hub's `/authors/[slug]`
 * page AND embedded author pages (react-embedding-example) — hosts fetch
 * the `AuthorProfile` however they like and drill it in.
 *
 * Embed-readiness contract (same rules as ArticleAuthorByline):
 *   - `Image` renders through the embed shim (plain `<img>` in non-Next
 *     hosts; the real `next/image` once registered at app init).
 *   - Avatar proxying rides the OPTIONAL ambient `ChatRuntime`
 *     (`endpoints.imageProxyUrlPrefix`) — no provider ⇒ raw URL, never
 *     throws. `proxyImageUrl` prop wins over the runtime.
 *   - The authored-content rail is a SLOT (`children`), not a baked-in
 *     fetch: the hub passes its pre-bound `RelatedContentSection` with SSR
 *     `initialItems`; embedders pass the lib section with `apiBaseUrl`.
 *     The view stays data-in, markup-out.
 *
 * Heading semantics are the HOST's: the view renders the name as a styled
 * `<p>` (like the hub profile header) so a hosting page can own its `<h1>`
 * (the hub uses an sr-only h1 for crawlers).
 */

import React from 'react'
import Image from '../../embed-shims/next-image'
import { cn } from '../../utils/cn'
import { formatBioText } from '../../utils/format'
import { getProxiedImageUrl } from '../../utils/image-proxy'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import { SocialIconRow } from '../social-icon-row'
import { StatusBadge } from '../ui/status-badge'
import type { AuthorProfile } from '../../types/entity-author'

export interface AuthorDetailViewProps {
  author: AuthorProfile
  /** Host-injected avatar-URL mapper — wins over the ambient runtime. */
  proxyImageUrl?: (url: string) => string
  /** Authored-content rail (or anything else) rendered below the profile. */
  children?: React.ReactNode
  className?: string
}

export function AuthorDetailView({
  author,
  proxyImageUrl,
  children,
  className,
}: AuthorDetailViewProps) {
  // Optional runtime — null-safe outside a provider (bare embeds render the
  // raw avatar URL; the hub's app-wide HubRuntimeProvider supplies the proxy).
  const runtime = useChatRuntime()

  const proxiedAvatar = author.avatarUrl
    ? proxyImageUrl
      ? proxyImageUrl(author.avatarUrl)
      : (getProxiedImageUrl(author.avatarUrl, {
          proxyPrefix: runtime?.endpoints.imageProxyUrlPrefix,
          skipDomains: runtime?.endpoints.imageProxySkipDomains,
          directHttps: true,
        }) ?? author.avatarUrl)
    : null

  const subtitle = [author.jobTitle, author.company].filter(Boolean).join(' @ ')
  const bioText = formatBioText(author.about)

  return (
    <div className={cn('flex flex-col gap-5 md:gap-6', className)}>
      {/* Identity header: avatar left; name → subtitle → socials stacked right. */}
      <div className="flex gap-6 w-full items-start">
        <div className="relative shrink-0 h-24 w-24">
          <div className="rounded-full overflow-hidden bg-ods-bg-secondary border border-ods-border w-full h-full relative">
            {proxiedAvatar ? (
              <Image
                src={proxiedAvatar}
                alt={author.fullName}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full text-3xl text-ods-text-secondary font-['Azeret_Mono']">
                {author.fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex flex-col justify-center gap-2">
          <p className="text-h2 text-ods-text-primary leading-none truncate">
            {author.fullName}
          </p>
          {subtitle && (
            <p className="font-body text-lg text-ods-text-secondary leading-none truncate">
              {subtitle}
            </p>
          )}
          {author.socialLinks.length > 0 && (
            // Ghost compact row (transparent 32px) — metadata, not CTAs.
            <SocialIconRow
              compact
              links={author.socialLinks.map((link) => ({
                platform: link.platform,
                href: link.url,
                label: `${author.fullName}'s ${link.platform}`,
              }))}
            />
          )}
        </div>
      </div>

      {bioText && (
        <p className="font-body text-base leading-relaxed text-ods-text-secondary">
          {bioText}
        </p>
      )}

      {author.knowsAbout.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {author.knowsAbout.map((topic) => (
            <StatusBadge key={topic} text={topic} variant="button" colorScheme="cyan" singleLine />
          ))}
        </div>
      )}

      {children}
    </div>
  )
}

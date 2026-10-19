'use client';

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

import type React from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import Image from '../../embed-shims/next-image';
import type { AuthorProfile } from '../../types/entity-author';
import { cn } from '../../utils/cn';
import { formatBioText } from '../../utils/format';
import { getProxiedImageUrl } from '../../utils/image-proxy';
import { InteractiveSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { SocialIconRow, socialIconRowClass } from '../social-icon-row';
import { useLoadingScope } from '../ui/loading-scope';
import { SquareAvatar } from '../ui/square-avatar';
import { StatusBadge } from '../ui/status-badge';

export interface AuthorDetailViewProps {
  author: AuthorProfile;
  /** Host-injected avatar-URL mapper — wins over the ambient runtime. */
  proxyImageUrl?: (url: string) => string;
  /** Authored-content rail (or anything else) rendered below the profile. */
  children?: React.ReactNode;
  className?: string;
}

/** The view's layout, read by the view and by its skeleton, so the skeleton is the view's size. */
const VIEW_CLASS = 'flex flex-col gap-5 md:gap-6';
const IDENTITY_ROW_CLASS = 'flex w-full items-start gap-6';
const AVATAR_BOX_CLASS = 'relative h-24 w-24 shrink-0';
const IDENTITY_TEXT_CLASS = 'flex min-w-0 flex-col justify-center gap-2';
const NAME_CLASS = 'truncate leading-none text-ods-text-primary text-h2';
const SUBTITLE_CLASS = 'truncate text-h4 leading-none text-ods-text-secondary';
const BIO_CLASS = 'text-ods-text-secondary text-h6';
const TOPICS_CLASS = 'flex flex-wrap gap-2';
/** Social icons (compact, icon-sm 32px, gap-2) a skeleton draws: a profile's typical row (192px, five links). */
const AUTHOR_SKELETON_SOCIALS = 5;

export function AuthorDetailView({ author, proxyImageUrl, children, className }: AuthorDetailViewProps) {
  // Optional runtime — null-safe outside a provider (bare embeds render the
  // raw avatar URL; the hub's app-wide HubRuntimeProvider supplies the proxy).
  const runtime = useChatRuntime();
  // In a loading scope the host passes an empty profile and the view draws itself: each part holds its place with a
  // skeleton of its own size, and `children` (the host's rail) draws its own.
  const loading = useLoadingScope();

  const proxiedAvatar =
    !loading && author.avatarUrl
      ? proxyImageUrl
        ? proxyImageUrl(author.avatarUrl)
        : (getProxiedImageUrl(author.avatarUrl, {
            proxyPrefix: runtime?.endpoints.imageProxyUrlPrefix,
            skipDomains: runtime?.endpoints.imageProxySkipDomains,
            directHttps: true,
          }) ?? author.avatarUrl)
      : null;

  const subtitle = [author.jobTitle, author.company].filter(Boolean).join(' @ ');
  const bioText = formatBioText(author.about);

  return (
    <div className={cn(VIEW_CLASS, className)}>
      {/* Identity header: avatar left; name → subtitle → socials stacked right. */}
      <div className={IDENTITY_ROW_CLASS} aria-hidden={loading || undefined}>
        <div className={AVATAR_BOX_CLASS}>
          {loading ? (
            // The avatar in its scope draws its own skeleton, the round box of this frame.
            <SquareAvatar variant="round" alt="" className="h-full w-full" />
          ) : (
            <div className="relative h-full w-full overflow-hidden rounded-full border border-ods-border bg-ods-bg-surface">
              {proxiedAvatar ? (
                <Image src={proxiedAvatar} alt={author.fullName} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ods-text-secondary text-h2">
                  {author.fullName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={cn(IDENTITY_TEXT_CLASS, loading && 'w-full')}>
          <p className={NAME_CLASS}>
            {loading ? (
              // A typical name's width (about 282px at the name's `text-h2`).
              <TextLineSkeleton type="inherit" as="span" className="w-72 max-w-full" />
            ) : (
              author.fullName
            )}
          </p>
          {(loading || subtitle) && (
            <p className={SUBTITLE_CLASS}>
              {loading ? <TextLineSkeleton type="inherit" as="span" className="w-48 max-w-full" /> : subtitle}
            </p>
          )}
          {loading ? (
            <div className={socialIconRowClass(true)}>
              {Array.from({ length: AUTHOR_SKELETON_SOCIALS }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton icons never reorder
                <InteractiveSkeleton.Button key={i} size="icon-sm" />
              ))}
            </div>
          ) : (
            author.socialLinks.length > 0 && (
              // Ghost compact row (transparent 32px) — metadata, not CTAs.
              <SocialIconRow
                compact
                links={author.socialLinks.map(link => ({
                  platform: link.platform,
                  href: link.url,
                  label: `${author.fullName}'s ${link.platform}`,
                }))}
              />
            )
          )}
        </div>
      </div>

      {loading ? (
        // A bio's usual length per width: five lines on a phone, three on a tablet, two from desktop.
        <p className={BIO_CLASS} aria-hidden>
          <TextLineSkeleton type="inherit" as="span" lines={5} className="w-full content-md:hidden" />
          <TextLineSkeleton
            type="inherit"
            as="span"
            lines={3}
            className="hidden w-full content-md:flex content-lg:hidden"
          />
          <TextLineSkeleton type="inherit" as="span" lines={2} className="hidden w-full content-lg:flex" />
        </p>
      ) : (
        bioText && <p className={BIO_CLASS}>{bioText}</p>
      )}

      {!loading && author.knowsAbout.length > 0 && (
        // Optional per author (not drawn while loading): marked so for the loading-state check.
        <div className={TOPICS_CLASS} data-loading-optional>
          {author.knowsAbout.map(topic => (
            <StatusBadge key={topic} text={topic} variant="button" colorScheme="cyan" singleLine />
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

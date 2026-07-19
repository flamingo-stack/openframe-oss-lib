"use client";

/**
 * RichMarkdownRenderer — the content composition over the unified
 * `MarkdownEngine`: RuntimeProvider + shortcodes + embed overrides +
 * fetch-based internal-link resolver + `article` typography.
 *
 * This IS the real component (the old 1223-line standalone implementation
 * was deleted in the unification). Public prop surface is unchanged, so
 * every hub/app call site compiles untouched. Deltas vs the old
 * implementation are the ones reviewed in the unification plan: the
 * sanitize stack + tag-escape pre-pass now apply to content surfaces
 * (`extraAllowedHtmlTags={['video','source']}` keeps authored video
 * working), the engine is memoized, and the dead light-mode branches are
 * gone.
 */
import React, { memo, useCallback, useMemo } from 'react';
import { MarkdownEngine } from '../engine';
import type { ResolveLinkResult } from '../../../../types/doc-source';
import {
  RichMarkdownRuntimeProvider,
  useRichMarkdownRuntime,
  type RichMarkdownRuntime,
} from '../../../embeds/rich-markdown-runtime';
import { resolveTextSizeConfig } from '../text-size';
import { buildRichEmbedOverrides } from './embed-overrides';
import { processShortcodes } from './shortcodes';
import type { HeadingSection } from '../heading-ids';

/** Raw-HTML tags authored content needs beyond the chat-safe baseline. */
const RICH_EXTRA_TAGS = ['video', 'source'];

export interface RichMarkdownRendererProps extends Partial<RichMarkdownRuntime> {
  content: string;
  className?: string;
  sectionIds?: HeadingSection[];
  /** Callback for internal navigation (called after the resolver returns) */
  onInternalLinkClick?: (path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => void;
  /** List of broken links detected server-side */
  brokenLinks?: string[];
  /** Current documentation path for resolving relative links */
  currentPath?: string;
  /** Source for resolving internal links (default: 'openframe-docs'). Registry id from DOC_SOURCES. */
  resolveSource?: string;
  /** Path of the internal link-resolver endpoint. Default '/api/docs/resolve-link'. */
  resolveLinkEndpointUrl?: string;
  /** When the page already has an H1, render markdown `#` as `h2` (e.g. legal pages). */
  demoteMarkdownH1ToH2?: boolean;
}

const RichMarkdownRendererImpl: React.FC<RichMarkdownRendererProps> = ({
  content,
  className = '',
  sectionIds,
  onInternalLinkClick,
  brokenLinks = [],
  currentPath,
  resolveSource = 'openframe-docs',
  resolveLinkEndpointUrl = '/api/docs/resolve-link',
  demoteMarkdownH1ToH2 = false,
  // Runtime overrides; provider fills the defaults
  redditProxyUrl,
  twitterProxyUrl,
  ogScraperUrl,
  transformImageSrc,
}) => {
  return (
    <RichMarkdownRuntimeProvider
      redditProxyUrl={redditProxyUrl}
      twitterProxyUrl={twitterProxyUrl}
      ogScraperUrl={ogScraperUrl}
      transformImageSrc={transformImageSrc}
    >
      <RichMarkdownInner
        content={content}
        className={className}
        sectionIds={sectionIds}
        onInternalLinkClick={onInternalLinkClick}
        brokenLinks={brokenLinks}
        currentPath={currentPath}
        resolveSource={resolveSource}
        resolveLinkEndpointUrl={resolveLinkEndpointUrl}
        demoteMarkdownH1ToH2={demoteMarkdownH1ToH2}
      />
    </RichMarkdownRuntimeProvider>
  );
};

interface InnerProps {
  content: string;
  className?: string;
  sectionIds?: HeadingSection[];
  onInternalLinkClick?: (path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => void;
  brokenLinks?: string[];
  currentPath?: string;
  resolveSource: string;
  resolveLinkEndpointUrl: string;
  demoteMarkdownH1ToH2: boolean;
}

const RichMarkdownInner: React.FC<InnerProps> = ({
  content,
  className = '',
  sectionIds,
  onInternalLinkClick,
  brokenLinks = [],
  currentPath,
  resolveSource,
  resolveLinkEndpointUrl,
  demoteMarkdownH1ToH2,
}) => {
  const { ogScraperUrl } = useRichMarkdownRuntime();

  // The OG link-preview endpoint is `${apiBaseUrl}${ogEndpointPath}` —
  // split the runtime URL once. Full URLs route through the cross-origin
  // proxy; path-only values are used as the path with an empty base.
  const { ogApiBaseUrl, ogEndpointPath } = useMemo(() => {
    try {
      const u = new URL(ogScraperUrl);
      return {
        ogApiBaseUrl: `${u.protocol}//${u.host}`,
        ogEndpointPath: u.pathname,
      };
    } catch {
      return { ogApiBaseUrl: '', ogEndpointPath: ogScraperUrl };
    }
  }, [ogScraperUrl]);

  // ONE link-resolution code path: the engine's callback seam. This is the
  // fetch implementation the old Rich renderer had inline in its <a>
  // handler — the engine's base `a` component now drives it.
  const onResolveLink = useCallback(
    async (href: string, path: string): Promise<ResolveLinkResult> => {
      const response = await fetch(resolveLinkEndpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: href, currentPath: path, source: resolveSource }),
      });
      return response.json();
    },
    [resolveLinkEndpointUrl, resolveSource],
  );

  const textSizes = useMemo(() => resolveTextSizeConfig('article'), []);

  const componentOverrides = useMemo(
    () => buildRichEmbedOverrides({ ogApiBaseUrl, ogEndpointPath, textSizes }),
    [ogApiBaseUrl, ogEndpointPath, textSizes],
  );

  return (
    <MarkdownEngine
      content={content}
      className={className}
      sectionIds={sectionIds}
      demoteMarkdownH1ToH2={demoteMarkdownH1ToH2}
      brokenLinks={brokenLinks}
      currentPath={currentPath}
      onInternalLinkClick={onInternalLinkClick}
      onResolveLink={onResolveLink}
      preprocessContent={processShortcodes}
      componentOverrides={componentOverrides}
      textSize="article"
      extraAllowedHtmlTags={RICH_EXTRA_TAGS}
    />
  );
};

/** Memoized — see the engine's memo rationale. */
export const RichMarkdownRenderer = memo(RichMarkdownRendererImpl);


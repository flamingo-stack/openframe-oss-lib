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
import { MarkdownEngine, NO_BROKEN_LINKS, type MarkdownEngineProps } from '../engine';
import type { ResolveLinkResult } from '../../../../types/doc-source';
import {
  RichMarkdownRuntimeProvider,
  useRichMarkdownRuntime,
  type RichMarkdownRuntime,
} from '../../../embeds/rich-markdown-runtime';
import { resolveTextSizeConfig } from '../text-size';
import { buildRichEmbedOverrides } from './embed-overrides';
import { processShortcodes } from './shortcodes';

/** Raw-HTML tags authored content needs beyond the chat-safe baseline. */
const RICH_EXTRA_TAGS = ['video', 'source'];

/**
 * The engine props this composition OWNS and therefore does not forward:
 * shortcode preprocessing, the embed component map, the `article` text
 * preset, the fetch link resolver, the rich tag allowlist, and streaming
 * (authored content is never streamed).
 */
type RichOwnedEngineProps =
  | 'extraAllowedHtmlTags'
  | 'preprocessContent'
  | 'componentOverrides'
  | 'textSize'
  | 'onResolveLink'
  | 'additionalRemarkPlugins'
  | 'streaming';

/**
 * Derived from `MarkdownEngineProps` rather than hand-copied. The previous
 * shape restated 7 engine props here and a THIRD time in `InnerProps`, so
 * every engine prop doc/type change had to be mirrored in three places (and
 * a missed mirror type-checks fine while silently dropping the prop).
 */
export interface RichMarkdownRendererProps
  extends Partial<RichMarkdownRuntime>,
    Omit<MarkdownEngineProps, RichOwnedEngineProps> {
  /** Source for resolving internal links (default: 'openframe-docs'). Registry id from DOC_SOURCES. */
  resolveSource?: string;
  /** Path of the internal link-resolver endpoint. Default '/api/docs/resolve-link'. */
  resolveLinkEndpointUrl?: string;
}

const RichMarkdownRendererImpl: React.FC<RichMarkdownRendererProps> = ({
  content,
  className = '',
  sectionIds,
  onInternalLinkClick,
  brokenLinks = NO_BROKEN_LINKS,
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

/**
 * "The outer component already applied these defaults", ENCODED IN THE TYPE:
 * the runtime props are consumed by the provider (so they are gone here),
 * and the three defaulted props are `Required` — a missed default upstream
 * is a type error rather than a silent `undefined`.
 */
type InnerProps = Omit<RichMarkdownRendererProps, keyof RichMarkdownRuntime> &
  Required<
    Pick<
      RichMarkdownRendererProps,
      'resolveSource' | 'resolveLinkEndpointUrl' | 'demoteMarkdownH1ToH2'
    >
  >;

const RichMarkdownInner: React.FC<InnerProps> = ({
  content,
  className = '',
  sectionIds,
  onInternalLinkClick,
  brokenLinks,
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


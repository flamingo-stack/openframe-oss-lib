"use client";

/**
 * Rich-composition component overrides: the embed layer (Video SSOT,
 * Reddit/Twitter/LinkedIn embeds, OG link previews, Figma, MarkdownImage).
 *
 * These imports are deliberately isolated in this file — keeping them out
 * of the engine and the simple composition keeps the CHAT bundle free of
 * embed code (a runtime `variant` prop could not be tree-shaken; a
 * separate composition module can).
 */
import React from 'react';
import type { Components } from 'react-markdown';
import { RedditEmbedClient } from '../../../embeds/reddit-embed-client';
import { TwitterEmbedClient } from '../../../embeds/twitter-embed-client';
import { LinkedInEmbedClient } from '../../../embeds/linkedin-embed-client';
import { Video } from '../../../features/video';
import { OGLinkPreview, OGLinkErrorBoundary } from '../../../embeds/og-link-preview';
import { FigmaEmbed } from '../../../embeds/figma-embed';
import { MarkdownImage } from '../../../embeds/markdown-image';
import { buildStandardLeafRenderers } from '../base-components';
import type { TextSizeElement } from '../text-size';

/** Depth-first search of a hast node for the first `<a href>` matching `hostRe`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findFirstHref(node: any, hostRe: RegExp): string | null {
  if (!node) return null;
  if (node.tagName === 'a') {
    const href = node.properties?.href;
    if (typeof href === 'string' && hostRe.test(href)) return href;
  }
  for (const child of node.children ?? []) {
    const found = findFirstHref(child, hostRe);
    if (found) return found;
  }
  return null;
}

export interface BuildRichEmbedOverridesOptions {
  ogApiBaseUrl: string;
  ogEndpointPath: string;
  textSizes: Record<TextSizeElement, string>;
}

/**
 * Overrides spread LAST onto the engine's base map: `code` (fence-language
 * embeds), `div` (shortcode-expanded embeds), `img` (MarkdownImage with
 * runtime transformImageSrc), `video` (raw tags → Video SSOT).
 */
export function buildRichEmbedOverrides({
  ogApiBaseUrl,
  ogEndpointPath,
  textSizes,
}: BuildRichEmbedOverridesOptions): Partial<Components> {
  // Standard `code` / `blockquote` come from the base SSOT — this module
  // owns ONLY the embed special cases and delegates every fall-through, so
  // the shared classes can never drift between the two compositions.
  const standard = buildStandardLeafRenderers({ textSizes });

  return {
    // Fence-language embeds (```youtube-embed etc.); everything else
    // (mermaid, highlighted blocks, inline code) falls through to `standard`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: (codeProps: any) => {
      const { inline, className: codeClassName, children } = codeProps;
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';
      const fenceText = () => String(children).replace(/\n$/, '').trim();

      if (!inline && language === 'youtube-embed') {
        return <Video kind="youtube" url={fenceText()} />;
      }
      if (!inline && language === 'reddit-embed') {
        return <RedditEmbedClient url={fenceText()} />;
      }
      if (!inline && language === 'tweet-embed') {
        return <TwitterEmbedClient url={fenceText()} />;
      }
      if (!inline && language === 'link-preview') {
        return (
          <OGLinkPreview
            url={fenceText()}
            variant="compact"
            enablePlaceholder={false}
            apiBaseUrl={ogApiBaseUrl}
            ogEndpointPath={ogEndpointPath}
          />
        );
      }
      if (!inline && language === 'figma-embed') {
        return <FigmaEmbed url={fenceText()} height="70vh" />;
      }
      if (!inline && language === 'linkedin-embed') {
        return <LinkedInEmbedClient url={fenceText()} />;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (standard.code as any)(codeProps);
    },

    // Shortcode-expanded embeds: <div class="youtube-embed" data-video-id>…
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ node, className, children, ...props }: any) => {
      if (className === 'youtube-embed') {
        return <Video kind="youtube" url={props['data-video-id']} />;
      }
      if (className === 'reddit-embed') {
        return <RedditEmbedClient url={props['data-post-url']} />;
      }
      if (className === 'tweet-embed') {
        return <TwitterEmbedClient url={props['data-tweet-url']} />;
      }
      if (className === 'link-preview') {
        const url = props['data-url'];
        if (!url || typeof url !== 'string') {
          console.warn('Invalid URL for link preview:', url);
          return <div className="text-ods-text-secondary text-sm">Invalid link</div>;
        }
        try {
          new URL(url);
          return (
            <OGLinkErrorBoundary fallback={<div className="text-ods-text-secondary text-sm">Link preview unavailable</div>}>
              <OGLinkPreview
                url={url}
                variant="compact"
                enablePlaceholder={false}
                apiBaseUrl={ogApiBaseUrl}
                ogEndpointPath={ogEndpointPath}
              />
            </OGLinkErrorBoundary>
          );
        } catch (e) {
          console.warn('Malformed URL for link preview:', url, e);
          return <div className="text-ods-text-secondary text-sm">Malformed URL: {url}</div>;
        }
      }
      if (className === 'figma-embed') {
        return <FigmaEmbed url={props['data-figma-url']} height="70vh" />;
      }
      if (className === 'linkedin-embed') {
        return <LinkedInEmbedClient url={props['data-post-url']} />;
      }
      return <div className={className} {...props}>{children}</div>;
    },

    // Reddit's OWN embed markup lives in 58 published blog posts as
    // `<blockquote class="reddit-embed-bq">…<a href="post-url">` paired with
    // a `<script src="embed.reddit.com/widgets.js">` loader. The sanitize
    // stack strips the script (correctly), so the composition rehydrates the
    // blockquote itself: extract the post URL from the first reddit link and
    // render the RedditEmbedClient SSOT. Non-reddit blockquotes fall through
    // to the engine's base blockquote.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blockquote: (bqProps: any) => {
      const { node, className } = bqProps;
      const classNames: string = Array.isArray(className) ? className.join(' ') : (className ?? '');
      if (classNames.includes('reddit-embed-bq')) {
        const postUrl = findFirstHref(node, /reddit\.com/);
        if (postUrl) return <RedditEmbedClient url={postUrl} />;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (standard.blockquote as any)(bqProps);
    },

    // In-article images: MarkdownImage reads `transformImageSrc` from the
    // rich-markdown runtime (Supabase optimization on the hub, identity
    // elsewhere). Guard against empty `![]()`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    img: ({ src, alt }: any) => {
      if (!src || typeof src !== 'string' || src.trim() === '') {
        return null;
      }
      return <MarkdownImage src={src.trim()} alt={alt} />;
    },

    // Raw <video> tags in stored content (blog publisher injection) route
    // to the <Video> SSOT (MuxPlayer) so HLS manifests play everywhere.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    video: ({ src, poster, className }: any) => {
      if (!src || typeof src !== 'string' || src.trim() === '') {
        return null;
      }
      return (
        <div className={`overflow-hidden ${className || 'w-full my-8 rounded-lg'}`}>
          <div className="w-full aspect-video">
            <Video kind="file" url={src.trim()} poster={typeof poster === 'string' ? poster : undefined} />
          </div>
        </div>
      );
    },
  };
}

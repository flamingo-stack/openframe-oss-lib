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
import { MermaidDiagram } from '../mermaid-diagram';
import { cn } from '../../../../utils/cn';
import type { TextSizeElement } from '../text-size';

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
  return {
    // Fence-language embeds (```youtube-embed etc.) + the standard code
    // path. This override REPLACES the base `code` renderer, so the
    // standard block/inline branches are reproduced here with the same
    // classes (base-components.tsx is the reference).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code: ({ node, inline, className: codeClassName, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';
      const fenceText = () => String(children).replace(/\n$/, '').trim();

      if (!inline && language === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
      }
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

      if (!inline && match) {
        return (
          <div className="code-block-container border rounded-lg my-6 overflow-hidden bg-ods-card border-ods-border">
            <div className="code-header border-b px-4 py-2 bg-ods-card border-ods-border">
              <span className="font-sans text-xs uppercase tracking-wide text-ods-text-tertiary">
                {language || 'code'}
              </span>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto">
                <code
                  className={cn(`language-${language} hljs`, textSizes.code)}
                  style={{
                    fontFamily: "JetBrains Mono', 'SF Mono', Consolas, monospace",
                    background: 'transparent',
                    color: 'var(--color-text-primary)',
                  }}
                  {...props}
                >
                  {children}
                </code>
              </pre>
            </div>
          </div>
        );
      }

      return (
        <code className="font-mono text-[0.9em] px-1.5 py-0.5 rounded border bg-ods-card text-ods-text-primary border-ods-border" {...props}>
          {children}
        </code>
      );
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

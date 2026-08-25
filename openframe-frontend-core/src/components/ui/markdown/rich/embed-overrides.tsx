'use client';

/**
 * Rich-composition component overrides: the embed layer (Video SSOT,
 * Reddit/Twitter/LinkedIn embeds, OG link previews, Figma, MarkdownImage).
 *
 * These imports are deliberately isolated in this file — keeping them out
 * of the engine and the simple composition keeps the CHAT bundle free of
 * embed code (a runtime `variant` prop could not be tree-shaken; a
 * separate composition module can).
 */
import type { ElementContent } from 'hast';
import type { Components } from 'react-markdown';
import { FigmaEmbed } from '../../../embeds/figma-embed';
import { LinkedInEmbedClient } from '../../../embeds/linkedin-embed-client';
import { MarkdownImage } from '../../../embeds/markdown-image';
import { OGLinkPreview, OGLinkErrorBoundary } from '../../../embeds/og-link-preview';
import { RedditEmbedClient } from '../../../embeds/reddit-embed-client';
import { TwitterEmbedClient } from '../../../embeds/twitter-embed-client';
import { Video } from '../../../features/video';
import { buildStandardLeafRenderers, hasRenderableSrc, type MdRenderProps } from '../base-components';
import type { TextSizeElement } from '../text-size';

/** Depth-first search of a hast node for the first `<a href>` matching `hostRe`. */
function findFirstHref(node: ElementContent | undefined, hostRe: RegExp): string | null {
  if (!node || node.type !== 'element') return null;
  if (node.tagName === 'a') {
    const href = node.properties.href;
    if (typeof href === 'string' && hostRe.test(href)) return href;
  }
  for (const child of node.children) {
    const found = findFirstHref(child, hostRe);
    if (found) return found;
  }
  return null;
}

/**
 * Shortcode-expanded embed `<div>`s carry their payload on `data-*`
 * attributes (`processShortcodes` emits them). React's `div` prop type does
 * not model `data-*`, so the ones this renderer reads are declared here.
 */
type EmbedDivProps = MdRenderProps<'div'> & {
  'data-video-id'?: string;
  'data-post-url'?: string;
  'data-tweet-url'?: string;
  'data-url'?: string;
  'data-figma-url'?: string;
};

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
  // Standard `code` / `blockquote` / `div` come from the base SSOT — this
  // module owns ONLY the embed special cases and delegates every
  // fall-through, so the shared markup can never drift between the two
  // compositions.
  //
  // The delegations below CALL those renderers as plain functions rather
  // than rendering them as components (that is what the `as any` casts are
  // for). That is only sound because `buildStandardLeafRenderers` is
  // documented HOOK-FREE — if a hook ever appears in one of them, these
  // call sites must become real elements (`<Standard.code {...props} />`)
  // first.
  const standard = buildStandardLeafRenderers({ textSizes });

  return {
    // Fence-language embeds (```youtube-embed etc.); everything else
    // (mermaid, highlighted blocks, inline code) falls through to `standard`.
    code: (codeProps: MdRenderProps<'code'>) => {
      const { className: codeClassName, children } = codeProps;
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';
      const fenceText = () => String(children).replace(/\n$/, '').trim();

      if (language === 'youtube-embed') {
        return <Video kind="youtube" url={fenceText()} />;
      }
      if (language === 'reddit-embed') {
        return <RedditEmbedClient url={fenceText()} />;
      }
      if (language === 'tweet-embed') {
        return <TwitterEmbedClient url={fenceText()} />;
      }
      if (language === 'link-preview') {
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
      if (language === 'figma-embed') {
        return <FigmaEmbed url={fenceText()} height="70vh" />;
      }
      if (language === 'linkedin-embed') {
        return <LinkedInEmbedClient url={fenceText()} />;
      }

      return standard.code(codeProps);
    },

    // Shortcode-expanded embeds: <div class="youtube-embed" data-video-id>…
    div: (divProps: EmbedDivProps) => {
      const {
        className,
        'data-video-id': videoId,
        'data-post-url': postUrl,
        'data-tweet-url': tweetUrl,
        'data-url': previewUrl,
        'data-figma-url': figmaUrl,
      } = divProps;
      // Each branch requires its payload attribute: a shortcode div that
      // lost it used to hand the embed component `url={undefined}` and
      // render a permanently broken player. Falling through to the plain
      // `div` keeps the surrounding content intact instead.
      if (className === 'youtube-embed' && videoId) {
        return <Video kind="youtube" url={videoId} />;
      }
      if (className === 'reddit-embed' && postUrl) {
        return <RedditEmbedClient url={postUrl} />;
      }
      if (className === 'tweet-embed' && tweetUrl) {
        return <TwitterEmbedClient url={tweetUrl} />;
      }
      if (className === 'link-preview') {
        const url = previewUrl;
        if (!url) {
          console.warn('Invalid URL for link preview:', url);
          return <div className="text-sm text-ods-text-secondary">Invalid link</div>;
        }
        try {
          new URL(url);
          return (
            <OGLinkErrorBoundary
              fallback={<div className="text-sm text-ods-text-secondary">Link preview unavailable</div>}
            >
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
          return <div className="text-sm text-ods-text-secondary">Malformed URL: {url}</div>;
        }
      }
      if (className === 'figma-embed' && figmaUrl) {
        return <FigmaEmbed url={figmaUrl} height="70vh" />;
      }
      if (className === 'linkedin-embed' && postUrl) {
        return <LinkedInEmbedClient url={postUrl} />;
      }
      return standard.div(divProps);
    },

    // Pasted-from-the-platform embed markup lives in published blog posts as
    // `<blockquote class="reddit-embed-bq">…<a href="post-url">` (58 blocks
    // across 9 posts) — and Twitter's equivalent is
    // `<blockquote class="twitter-tweet">…<a href="status-url">`. Each pair
    // ships a `widgets.js` loader script, which `processShortcodes` strips
    // from the source text (Step 1.5). The composition rehydrates the
    // blockquote itself: extract the post URL from the first matching link
    // and render the platform's embed-client SSOT. Other blockquotes fall
    // through to the engine's base blockquote.
    blockquote: (bqProps: MdRenderProps<'blockquote'>) => {
      const { node, className } = bqProps;
      const classNames: string = Array.isArray(className) ? className.join(' ') : (className ?? '');
      if (classNames.includes('reddit-embed-bq')) {
        const postUrl = findFirstHref(node, /reddit\.com/);
        if (postUrl) return <RedditEmbedClient url={postUrl} />;
      }
      if (classNames.includes('twitter-tweet')) {
        const tweetUrl = findFirstHref(node, /(?:twitter\.com|x\.com)\/[^/]+\/status\//);
        if (tweetUrl) return <TwitterEmbedClient url={tweetUrl} />;
      }
      return standard.blockquote(bqProps);
    },

    // In-article images: MarkdownImage reads `transformImageSrc` from the
    // rich-markdown runtime (Supabase optimization on the hub, identity
    // elsewhere). Guard against empty `![]()`.
    img: ({ src, alt }: MdRenderProps<'img'>) => {
      // Empty-`![]()` guard shared with the base `img` renderer.
      if (!hasRenderableSrc(src)) return null;
      return <MarkdownImage src={src.trim()} alt={alt} />;
    },

    // Raw <video> tags in stored content (blog publisher injection) route
    // to the <Video> SSOT (MuxPlayer) so HLS manifests play everywhere.
    video: ({ src, poster, className }: MdRenderProps<'video'>) => {
      if (!hasRenderableSrc(src)) return null;
      return (
        <div className={`overflow-hidden ${className || 'my-8 w-full rounded-lg'}`}>
          <div className="aspect-video w-full">
            <Video kind="file" url={src.trim()} poster={typeof poster === 'string' ? poster : undefined} />
          </div>
        </div>
      );
    },
  };
}

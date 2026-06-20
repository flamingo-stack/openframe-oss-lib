"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
// Theme removed - using fixed dark mode for platform consistency
// Using rehype-highlight instead of SyntaxHighlighter for better integration
import { RedditEmbedClient } from '../embeds/reddit-embed-client';
import { TwitterEmbedClient } from '../embeds/twitter-embed-client';
import { LinkedInEmbedClient } from '../embeds/linkedin-embed-client';
import { Video } from '../features/video';
import { ErrorIcon } from '../icons/error-icon';
import { OGLinkPreview, OGLinkErrorBoundary } from '../embeds/og-link-preview';
import { FigmaEmbed } from '../embeds/figma-embed';
import { MarkdownImage } from '../embeds/markdown-image';
import {
  RichMarkdownRuntimeProvider,
  useRichMarkdownRuntime,
  type RichMarkdownRuntime,
} from '../embeds/rich-markdown-runtime';

// Import highlight.js styles only - rehype-highlight handles the actual highlighting
// No manual language imports needed



// Global styles for Mermaid diagrams
const mermaidStyles = `
  .mermaid-svg-container svg {
    max-width: 100% !important;
    height: auto !important;
    min-height: 200px;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 14px !important;
  }

  /* Desktop sizing - larger and more prominent */
  @media (min-width: 1520px) {
    .mermaid-svg-container svg {
      max-width: 900px !important;
      max-height: 700px !important;
      min-height: 300px;
      font-size: 16px !important;
    }
  }

  /* Medium screens (tablets/laptops) */
  @media (min-width: 768px) and (max-width: 1519px) {
    .mermaid-svg-container svg {
      max-width: 700px !important;
      max-height: 600px !important;
      min-height: 250px;
      font-size: 15px !important;
    }
  }

  /* Mobile responsiveness */
  @media (max-width: 767px) {
    .mermaid-svg-container svg {
      max-width: 90vw !important;
      max-height: 400px !important;
      min-height: 200px;
      font-size: 13px !important;
    }
  }

  /* Responsive pie chart and flowchart sizing */
  .mermaid-svg-container svg[width] {
    width: 100% !important;
  }

  .mermaid-svg-container .node rect,
  .mermaid-svg-container .node circle,
  .mermaid-svg-container .node ellipse,
  .mermaid-svg-container .node polygon {
    stroke-width: 2px !important;
  }
  .mermaid-svg-container .edgePath path {
    stroke-width: 2px !important;
  }

  /* Enhance readability on larger screens */
  @media (min-width: 768px) {
    .mermaid-svg-container .node text,
    .mermaid-svg-container .edgeLabel text {
      font-size: 14px !important;
    }
  }

  @media (min-width: 1520px) {
    .mermaid-svg-container .node text,
    .mermaid-svg-container .edgeLabel text {
      font-size: 16px !important;
    }
  }
`;

// Interface definition moved above the component

// <Video> is the single source of truth for every video surface — it
// handles YouTube facade + Mux HLS + MP4 fallback behind one component.

// Mermaid Diagram Component
const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fixed dark mode for platform consistency
  const isDarkMode = true;

  useEffect(() => {
    const renderMermaid = async () => {
      try {
        setIsLoading(true);
        const { default: mermaid } = await import('mermaid');

        // Configure theme based on detected mode
        const themeConfig = isDarkMode ? {
          theme: 'dark' as const,
          themeVariables: {
            primaryColor: '#FFC008',
            primaryTextColor: '#FAFAFA',
            primaryBorderColor: '#3A3A3A',
            lineColor: '#888888',
            secondaryColor: '#212121',
            tertiaryColor: '#2A2A2A',
            background: 'transparent',
            mainBkg: 'transparent',
            secondBkg: 'transparent',
            tertiaryBkg: 'transparent',
            cScale0: '#FFC008',
            cScale1: '#4ECDC4',
            cScale2: '#45B7D1',
            cScale3: '#96CEB4',
            cScale4: '#FFEAA7',
            cScale5: '#DDA0DD',
            cScale6: '#98D8C8',
            cScale7: '#F7DC6F',
            cScale8: '#BB8FCE',
            cScale9: '#85C1E9',
            taskTextColor: '#FAFAFA',
            taskTextOutsideColor: '#FAFAFA',
            activeTaskTextColor: '#1A1A1A',
            nodeTextColor: '#FAFAFA'
          }
        } : {
          theme: 'base' as const,
          themeVariables: {
            primaryColor: '#FFC008',
            primaryTextColor: '#1A1A1A',
            primaryBorderColor: '#D1D5DB',
            lineColor: '#6B7280',
            secondaryColor: '#F3F4F6',
            tertiaryColor: '#E5E7EB',
            background: 'transparent',
            mainBkg: 'transparent',
            secondBkg: 'transparent',
            tertiaryBkg: 'transparent',
            cScale0: '#F59E0B',
            cScale1: '#10B981',
            cScale2: '#3B82F6',
            cScale3: '#8B5CF6',
            cScale4: '#EF4444',
            cScale5: '#F97316',
            cScale6: '#06B6D4',
            cScale7: '#84CC16',
            cScale8: '#EC4899',
            cScale9: '#6366F1',
            taskTextColor: '#1A1A1A',
            taskTextOutsideColor: '#1A1A1A',
            activeTaskTextColor: '#FFFFFF',
            nodeTextColor: '#1A1A1A',
            textColor: '#1A1A1A',
            labelTextColor: '#1A1A1A'
          }
        };

        mermaid.initialize({
          startOnLoad: false,
          ...themeConfig,
          // Ensure proper sizing
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            rankSpacing: 50,
            nodeSpacing: 30,
            curve: 'basis'
          },
          sequence: {
            useMaxWidth: true,
            width: 150
          },
          pie: {
            useMaxWidth: true,
            useWidth: undefined
          },
          // Global font settings
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          // More lenient parsing
          securityLevel: 'loose'
        });

        const { svg: renderedSvg } = await mermaid.render(`mermaid-${Date.now()}`, chart);
        setSvg(renderedSvg);
        setIsLoading(false);
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError(`Failed to render diagram: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    if (mounted) {
      renderMermaid();
    }
  }, [chart, isDarkMode, mounted]);

  if (error) {
    return (
      <div className="error-state bg-ods-card border border-ods-border rounded-lg p-6 my-6">
        <div className="error-icon flex justify-center mb-4">
          <ErrorIcon className="w-12 h-12 text-ods-error" />
        </div>
        <div className="error-title text-center font-sans font-semibold text-lg text-ods-error mb-2">
          Diagram Error
        </div>
        <div className="error-description text-center font-sans text-sm text-ods-text-secondary mb-4 break-words overflow-hidden max-w-full">
          <div className="overflow-x-auto">
            <pre className="whitespace-pre-wrap break-words text-xs">{error}</pre>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !svg) {
    return (
      <div className="skeleton-code bg-ods-card border border-ods-border rounded-lg p-6 min-h-[120px] flex items-center justify-center">
        <div className="animate-pulse text-ods-text-tertiary font-sans">
          {isLoading ? 'Loading diagram renderer...' : 'Rendering diagram...'}
        </div>
      </div>
    );
  }

  const containerClasses = isDarkMode
    ? 'mermaid-container rounded-lg p-4 md:p-6 lg:p-8 my-6 overflow-x-auto bg-ods-card border border-ods-border'
    : 'mermaid-container rounded-lg p-4 md:p-6 lg:p-8 my-6 overflow-x-auto bg-white border border-ods-border';

  return (
    <div className={containerClasses}>
      <div className="flex justify-center items-center w-full min-h-[200px] md:min-h-[250px] lg:min-h-[300px]">
        <div
          className="mermaid-svg-container w-full flex justify-center max-w-full"
          style={{
            fontSize: '14px'
          }}
          dangerouslySetInnerHTML={{
            __html: svg.replace(
              /<svg[^>]*>/,
              (match) => {
                // Force responsive sizing for all diagrams, especially pie charts
                return match
                  .replace(/width="[^"]*"/, 'width="100%"')
                  .replace(/height="[^"]*"/, 'height="auto"')
                  .replace(/viewBox="[^"]*"/, (viewBoxMatch) => {
                    // Preserve viewBox for proper scaling
                    return viewBoxMatch;
                  });
              }
            )
          }}
        />
      </div>
    </div>
  );
};

// Process shortcodes AND auto-detect URLs before passing to react-markdown
const processShortcodes = (content: string): string => {
  let processedContent = content;

  // Escape values interpolated into the raw HTML `data-*` attributes generated below.
  // With rehypeRaw enabled, an unescaped `"`/`<`/`>` in a URL or id could break out of
  // the attribute and inject markup, so every interpolated embed value goes through this.
  const escapeAttr = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // First, process explicit shortcodes
  processedContent = processedContent
    // YouTube embeds: {{youtube:VIDEO_ID}}
    .replace(/\{\{youtube:([^}]+)\}\}/g, (match, videoId) => {
      return `\n\n<div class="youtube-embed" data-video-id="${escapeAttr(videoId.trim())}"></div>\n\n`;
    })
    // Markdoc-style YouTube: {% youtube id="VIDEO_ID" /%} or {% youtube id="VIDEO_ID" title="..." /%}
    .replace(/\{%\s*youtube\s+id="([^"]+)"(?:\s+title="[^"]*")?\s*\/?%\}/g, (match, videoId) => {
      return `\n\n<div class="youtube-embed" data-video-id="${escapeAttr(videoId.trim())}"></div>\n\n`;
    })
    /**
     * SHORTCODE: YouTube Thumbnail Link (RECOMMENDED - GitHub + Flamingo Compatible)
     *
     * This is a SHORTCODE pattern processed in processShortcodes(), NOT auto-detection.
     * It is the PREFERRED format because it works on BOTH GitHub AND Flamingo:
     *   - On GitHub: Renders as a clickable thumbnail image linking to YouTube
     *   - On Flamingo: Converts to a full embedded YouTube player
     *
     * SYNTAX: [![Title](https://img.youtube.com/vi/VIDEO_ID/QUALITY.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
     *
     * HOW TO CREATE:
     *   1. Get your VIDEO_ID from: youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
     *   2. Choose thumbnail quality: maxresdefault.jpg (HD), hqdefault.jpg, or 0.jpg
     *   3. Build the pattern: [![Your Title](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
     *
     * THUMBNAIL QUALITY OPTIONS:
     *   - maxresdefault.jpg - HD 1280x720 (may not exist for all videos)
     *   - hqdefault.jpg     - High quality 480x360
     *   - 0.jpg             - Standard quality 480x360
     *
     * COMPLETE EXAMPLE (video ID: awc-yAnkhIo):
     *   [![OpenFrame Demo](https://img.youtube.com/vi/awc-yAnkhIo/maxresdefault.jpg)](https://www.youtube.com/watch?v=awc-yAnkhIo)
     *
     * USE THIS FORMAT for all documentation that needs to work on both GitHub and Flamingo.
     * Only use {{youtube:ID}} or {% youtube id="ID" /%} for Flamingo-only content.
     */
    .replace(/\[!\[([^\]]*)\]\(https?:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]+)\/[^)]+\)\]\(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)[^)]*\)/g,
      (match, altText, thumbId, videoId) => {
        return `\n\n<div class="youtube-embed" data-video-id="${videoId}"></div>\n\n`;
      })
    // Reddit embeds: {{reddit:POST_URL}}
    .replace(/\{\{reddit:([^}]+)\}\}/g, (match, urlOrId) => {
      const postUrl = urlOrId.trim();
      // Handle both full URLs and relative paths
      const fullUrl = postUrl.startsWith('http') ? postUrl : `https://reddit.com/r/${postUrl}`;
      return `\n\n<div class="reddit-embed" data-post-url="${escapeAttr(fullUrl)}"></div>\n\n`;
    })
    // Twitter/X embeds: {{tweet:TWEET_URL}} or {{twitter:TWEET_URL}}
    .replace(/\{\{(?:tweet|twitter):([^}]+)\}\}/g, (match, urlOrId) => {
      const tweetInput = urlOrId.trim();
      // Handle both full URLs and tweet IDs
      const tweetUrl = tweetInput.startsWith('http')
        ? tweetInput
        : `https://twitter.com/twitter/status/${tweetInput}`;
      return `\n\n<div class="tweet-embed" data-tweet-url="${escapeAttr(tweetUrl)}"></div>\n\n`;
    })
    // Figma embeds: {{figma:URL}}
    .replace(/\{\{figma:([^}]+)\}\}/g, (match, url) => {
      return `\n\n<div class="figma-embed" data-figma-url="${escapeAttr(url.trim())}"></div>\n\n`;
    })
    // LinkedIn embeds: {{linkedin:POST_URL}}
    .replace(/\{\{linkedin:([^}]+)\}\}/g, (match, url) => {
      return `\n\n<div class="linkedin-embed" data-post-url="${escapeAttr(url.trim())}"></div>\n\n`;
    })
    // Link previews: {{link:URL}}
    .replace(/\{\{link:([^}]+)\}\}/g, (match, url) => {
      return `\n\n<div class="link-preview" data-url="${escapeAttr(url.trim())}"></div>\n\n`;
    });

  // Next, auto-detect standalone URLs (but NOT those already in markdown links or code blocks)

  // Step 1: Temporarily replace code blocks to protect them
  const codeBlocks: string[] = [];
  processedContent = processedContent.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Step 2: Temporarily replace markdown links to protect them
  const markdownLinks: string[] = [];
  processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => {
    const placeholder = `__MARKDOWN_LINK_${markdownLinks.length}__`;
    markdownLinks.push(match);
    return placeholder;
  });

  // Step 2.5: Temporarily replace table rows to protect URLs inside tables
  const tableRows: string[] = [];
  processedContent = processedContent.replace(/^\|.+\|$/gm, (match) => {
    const placeholder = `__TABLE_ROW_${tableRows.length}__`;
    tableRows.push(match);
    return placeholder;
  });

  // Step 3: Auto-detect standalone URLs and convert to appropriate embeds
  processedContent = processedContent
    // YouTube URLs (standalone only)
    .replace(/(?:^|\s)(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+))(?:\s|$)/g,
      (match, fullUrl, videoId, offset, string) => {
        return match.replace(fullUrl, `\n\n<div class="youtube-embed" data-video-id="${videoId}"></div>\n\n`);
      })
    // Reddit URLs (standalone only) - matches any reddit.com URL pattern
    .replace(/(?:^|\s)(https?:\/\/(?:www\.)?reddit\.com\/[^\s]+)(?:\s|$)/g,
      (match, redditUrl) => {
        return match.replace(redditUrl, `\n\n<div class="reddit-embed" data-post-url="${escapeAttr(redditUrl)}"></div>\n\n`);
      })
    // Twitter/X URLs (standalone only)
    .replace(/(?:^|\s)(https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\/\s]+\/status\/\d+)(?:\s|$)/g,
      (match, tweetUrl) => {
        return match.replace(tweetUrl, `\n\n<div class="tweet-embed" data-tweet-url="${escapeAttr(tweetUrl)}"></div>\n\n`);
      })
    // Figma URLs (standalone only) - design/file/proto/board/deck/slides → interactive embed
    .replace(/(?:^|\s)(https?:\/\/(?:www\.|embed\.)?figma\.com\/(?:design|file|proto|board|deck|slides)\/[^\s]+)(?:\s|$)/g,
      (match, figmaUrl) => {
        return match.replace(figmaUrl, `\n\n<div class="figma-embed" data-figma-url="${escapeAttr(figmaUrl)}"></div>\n\n`);
      })
    // LinkedIn post URLs (standalone only) → native post embed (like reddit/twitter)
    .replace(/(?:^|\s)(https?:\/\/(?:www\.)?linkedin\.com\/(?:posts|feed\/update|embed\/feed\/update)\/[^\s]+)(?:\s|$)/g,
      (match, liUrl) => {
        return match.replace(liUrl, `\n\n<div class="linkedin-embed" data-post-url="${escapeAttr(liUrl)}"></div>\n\n`);
      })
    // Other external URLs (standalone only) - convert to link previews
    .replace(/(?:^|\s)(https?:\/\/[^\s]+)(?:\s|$)/g,
      (match, url) => {
        try {
          // Skip if already processed as a specific embed above
          // Use more precise domain matching to avoid false positives like "zabbix.com" containing "x.com"
          const urlObj = new URL(url);
          const hostname = urlObj.hostname.toLowerCase();

          // Skip URLs already handled by specific embed handlers above (videos, posts, tweets).
          // Exact host match (or a subdomain of it) — substring checks like
          // `hostname.includes('x.com')` false-positive on "zabbix.com", and
          // `includes('figma.com')` would match a hostile "evil-figma.com".
          const hostIs = (domain: string) =>
            hostname === domain || hostname.endsWith(`.${domain}`);
          // Allow non-video YouTube URLs (channels, playlists, `@handle`) to fall
          // through to the og-scraper — the scraper now sends a YouTube consent
          // cookie so the channel OG metadata (title, channel avatar) comes back
          // rich. Only video URLs (`?v=` / youtu.be) become inline player embeds.
          const isYouTubeVideo =
            (hostIs('youtube.com') && urlObj.searchParams.has('v')) || hostIs('youtu.be');
          // Allow LinkedIn non-post URLs (profile `/in/`, company `/company/`,
          // etc.) to fall through to the og-scraper. LinkedIn returns full OG for
          // signed-out preview crawlers — og:title with name + employer,
          // og:description with bio + experience, og:image with profile photo.
          // Only interactive post embeds keep their dedicated handler above.
          if (isYouTubeVideo ||
              hostIs('reddit.com') || hostIs('twitter.com') || hostIs('x.com') ||
              hostIs('figma.com')) {
            return match;
          }

          return match.replace(url, `\n\n<div class="link-preview" data-url="${escapeAttr(url)}"></div>\n\n`);
        } catch (e) {
          // If URL parsing fails, just return the original match without processing
          console.warn('Failed to parse URL for link preview:', url, e);
          return match;
        }
      });

  // Step 3.5: Restore table rows
  tableRows.forEach((row, index) => {
    processedContent = processedContent.replace(`__TABLE_ROW_${index}__`, row);
  });

  // Step 4: Restore markdown links
  markdownLinks.forEach((link, index) => {
    processedContent = processedContent.replace(`__MARKDOWN_LINK_${index}__`, link);
  });

  // Step 5: Restore code blocks (MUST be last to prevent link preview in code)
  codeBlocks.forEach((block, index) => {
    processedContent = processedContent.replace(`__CODE_BLOCK_${index}__`, block);
  });

  return processedContent;
};

/**
 * Props for `<RichMarkdownRenderer>`. Aside from the four runtime knobs
 * lifted from {@link RichMarkdownRuntime}, this is the same shape the hub's
 * `SimpleMarkdownRenderer` ever had — every legacy call site can be moved
 * over without other changes.
 */
export interface RichMarkdownRendererProps extends Partial<RichMarkdownRuntime> {
  content: string;
  className?: string;
  sectionIds?: Array<{ id: string; title: string; level: number }>;
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

export const RichMarkdownRenderer: React.FC<RichMarkdownRendererProps> = ({
  content,
  className = "",
  sectionIds,
  onInternalLinkClick,
  brokenLinks = [],
  currentPath: propCurrentPath,
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
        currentPath={propCurrentPath}
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
  sectionIds?: Array<{ id: string; title: string; level: number }>;
  onInternalLinkClick?: (path: string, options?: { expandFolder?: boolean; fromInternalLink?: boolean }) => void;
  brokenLinks?: string[];
  currentPath?: string;
  resolveSource: string;
  resolveLinkEndpointUrl: string;
  demoteMarkdownH1ToH2: boolean;
}

const RichMarkdownInner: React.FC<InnerProps> = ({
  content,
  className = "",
  sectionIds,
  onInternalLinkClick,
  brokenLinks = [],
  currentPath: propCurrentPath,
  resolveSource,
  resolveLinkEndpointUrl,
  demoteMarkdownH1ToH2,
}) => {
  const idCountsRef = useRef<Record<string, number>>({});
  const { ogScraperUrl } = useRichMarkdownRuntime();

  // The OG link-preview endpoint is `${apiBaseUrl}${ogEndpointPath}` —
  // split the runtime URL once so we can pass both parts into the lib's
  // existing `OGLinkPreview`. For full URLs (`https://hub.example.com/api/...`)
  // we route through the cross-origin proxy; for path-only values we use
  // them as the path with an empty base.
  const { ogApiBaseUrl, ogEndpointPath } = useMemo(() => {
    try {
      const u = new URL(ogScraperUrl);
      return {
        ogApiBaseUrl: `${u.protocol}//${u.host}`,
        ogEndpointPath: u.pathname,
      };
    } catch {
      // Not a full URL — treat as a path on the same origin.
      return { ogApiBaseUrl: '', ogEndpointPath: ogScraperUrl };
    }
  }, [ogScraperUrl]);

  // Build section ID map synchronously so it's available during the first render
  // (useEffect would run after render, causing heading ID mismatches)
  const sectionIdMap = useMemo(() => {
    const map = new Map<string, string>();
    if (sectionIds) {
      sectionIds.forEach(section => {
        const cleanTitle = section.title
          .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
          .trim()
          .toLowerCase();
        map.set(section.title.toLowerCase(), section.id);
        map.set(cleanTitle, section.id);
        map.set(section.title, section.id);
      });
    }
    return map;
  }, [sectionIds]);

  // Fixed dark mode - no theme detection needed
  const isDarkMode = true;

  // Function to generate unique IDs for headings
  const generateHeadingId = useCallback((text: string, level: number): string => {
    // If we have sectionIds from backend and this is H1 or H2, use those
    if (sectionIds && (level === 1 || level === 2)) {
      // Try multiple variations for matching
      const variations = [
        text,
        text.toLowerCase(),
        text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim(),
        text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim().toLowerCase()
      ];

      for (const variation of variations) {
        const backendId = sectionIdMap.get(variation);
        if (backendId) {
          return backendId;
        }
      }
    }

    // Otherwise generate ID normally
    const baseId = text
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '') // Remove emojis
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove remaining special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // Fallback if baseId is empty after cleaning
    const cleanId = baseId || `section-${Object.keys(idCountsRef.current).length + 1}`;

    // Handle duplicate IDs
    if (idCountsRef.current[cleanId]) {
      idCountsRef.current[cleanId]++;
      return `${cleanId}-${idCountsRef.current[cleanId]}`;
    } else {
      idCountsRef.current[cleanId] = 1;
      return cleanId;
    }
  }, [sectionIds, sectionIdMap]);

  // Process content early - before any conditional returns
  const processedContent = processShortcodes(content);

  // Memoize components to prevent React from losing event handlers
  // This MUST be before any conditional returns to satisfy React's Rules of Hooks
  const components = useMemo(() => ({
    // Custom code renderer
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!inline && language === 'mermaid') {
        return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />;
      }

      if (!inline && language === 'youtube-embed') {
        const videoId = String(children).replace(/\n$/, '').trim();
        return <Video kind="youtube" url={videoId} />;
      }

      if (!inline && language === 'reddit-embed') {
        const postUrl = String(children).replace(/\n$/, '').trim();
        return <RedditEmbedClient url={postUrl} />;
      }

      if (!inline && language === 'tweet-embed') {
        const tweetUrl = String(children).replace(/\n$/, '').trim();
        return <TwitterEmbedClient url={tweetUrl} />;
      }



      if (!inline && language === 'link-preview') {
        const url = String(children).replace(/\n$/, '').trim();
        return (
          <OGLinkPreview
            url={url}
            variant="compact"
            enablePlaceholder={false}
            apiBaseUrl={ogApiBaseUrl}
            ogEndpointPath={ogEndpointPath}
          />
        );
      }

      if (!inline && language === 'figma-embed') {
        const url = String(children).replace(/\n$/, '').trim();
        return <FigmaEmbed url={url} height="70vh" />;
      }

      if (!inline && language === 'linkedin-embed') {
        const postUrl = String(children).replace(/\n$/, '').trim();
        return <LinkedInEmbedClient url={postUrl} />;
      }



      if (!inline && match) {
        // Let rehype-highlight handle the syntax highlighting automatically
        // Just provide the styled container
        return (
          <div className={`code-block-container border rounded-lg my-6 overflow-hidden ${
            isDarkMode
              ? 'bg-ods-card border-ods-border'
              : 'bg-ods-bg-secondary border-ods-border'
          }`}>
            <div className={`code-header border-b px-4 py-2 ${
              isDarkMode
                ? 'bg-ods-card border-ods-border'
                : 'bg-[#E5E7EB] border-[#D1D5DB]'
            }`}>
              <span className={`font-sans text-xs uppercase tracking-wide ${
                isDarkMode ? 'text-ods-text-tertiary' : 'text-ods-text-tertiary'
              }`}>
                {language || 'code'}
              </span>
            </div>
            <div className="p-4">
              <pre className="overflow-x-auto">
                <code
                  className={`language-${language} hljs`}
                  style={{
                    fontSize: '14px',
                    fontFamily: "JetBrains Mono', 'SF Mono', Consolas, monospace",
                    background: 'transparent',
                    color: isDarkMode ? 'var(--ods-text-primary)' : 'var(--ods-text-primary)'
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
        <code
          className={`font-mono text-[0.9em] px-1.5 py-0.5 rounded border ${
            isDarkMode
              ? 'bg-ods-card text-ods-text-primary border-ods-border'
              : 'bg-ods-bg-secondary text-ods-text-primary border-ods-border'
          }`}
          {...props}
        >
          {children}
        </code>
      );
    },

    // Custom HTML element renderer for our processed shortcodes
    div: ({ node, className, children, ...props }: any) => {
      if (className === 'youtube-embed') {
        const videoId = props['data-video-id'];
        return <Video kind="youtube" url={videoId} />;
      }

      if (className === 'reddit-embed') {
        const postUrl = props['data-post-url'];
        return <RedditEmbedClient url={postUrl} />;
      }

      if (className === 'tweet-embed') {
        const tweetUrl = props['data-tweet-url'];
        return <TwitterEmbedClient url={tweetUrl} />;
      }



      if (className === 'link-preview') {
        const url = props['data-url'];

        // Validate URL before rendering component
        if (!url || typeof url !== 'string') {
          console.warn('Invalid URL for link preview:', url);
          return <div className="text-ods-text-secondary text-sm">Invalid link</div>;
        }

        try {
          new URL(url); // Validate URL format
          // Wrap in error boundary to catch any runtime errors
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

    // Style blockquotes
    blockquote: ({ children }: any) => (
      <blockquote className={`border-l-4 border-[#FFC008] ml-0 pl-6 my-8 py-4 rounded-r-lg ${
        isDarkMode
          ? 'bg-[#1F1F1F]'
          : 'bg-[#F8F9FA]'
      }`}>
        <div className={`font-sans text-[1.125em] leading-relaxed ${
          isDarkMode
            ? 'text-ods-text-secondary'
            : 'text-ods-text-primary'
        }`}>
          {children}
        </div>
      </blockquote>
    ),

    // Style headings - SIMPLIFIED: No complex logic in react-markdown
    h1: ({ children }: any) => {
      // Extract text from children (could be string or React elements)
      const extractText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return '';
      };

      const text = extractText(children);
      const level = demoteMarkdownH1ToH2 ? 2 : 1;
      const id = generateHeadingId(text, level);

      const h1VisualClassName = `font-sans font-bold text-[32px] md:text-[40px] lg:text-[48px] leading-[1.25] mt-8 mb-4 first:mt-0 ${
        isDarkMode ? 'text-ods-text-primary' : 'text-[#111827]'
      }`;

      if (demoteMarkdownH1ToH2) {
        return (
          <h2 id={id} className={h1VisualClassName}>
            {children}
          </h2>
        );
      }

      return (
        <h1 id={id} className={h1VisualClassName}>
          {children}
        </h1>
      );
    },
    h2: ({ children }: any) => {
      // Extract text from children (could be string or React elements)
      const extractText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return '';
      };

      const text = extractText(children);
      const id = generateHeadingId(text, 2);

      return (
        <h2
          id={id}
          className={`font-sans font-semibold text-[28px] md:text-[32px] mt-8 mb-4 pb-2 border-b ${
            isDarkMode
              ? 'text-ods-text-primary border-ods-border'
              : 'text-[#111827] border-[#E5E7EB]'
          }`}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children }: any) => {
      // Extract text from children (could be string or React elements)
      const extractText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return '';
      };

      const text = extractText(children);
      const id = generateHeadingId(text, 3);

      return (
        <h3
          id={id}
          className={`font-sans font-semibold text-[24px] md:text-[28px] mt-6 mb-3 ${
            isDarkMode ? 'text-ods-text-primary' : 'text-[#111827]'
          }`}
        >
          {children}
        </h3>
      );
    },
    h4: ({ children }: any) => {
      // Extract text from children (could be string or React elements)
      const extractText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return '';
      };

      const text = extractText(children);
      const id = generateHeadingId(text, 4);

      return (
        <h4
          id={id}
          className={`font-sans font-semibold text-[20px] md:text-[22px] mt-4 mb-2 ${
            isDarkMode ? 'text-ods-text-primary' : 'text-[#111827]'
          }`}
        >
          {children}
        </h4>
      );
    },
    h5: ({ children }: any) => {
      // Extract text from children (could be string or React elements)
      const extractText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return '';
      };

      const text = extractText(children);
      const id = generateHeadingId(text, 5);

      return (
        <h5
          id={id}
          className={`font-sans font-semibold text-[18px] md:text-[20px] mt-3 mb-2 ${
            isDarkMode ? 'text-ods-text-primary' : 'text-[#111827]'
          }`}
        >
          {children}
        </h5>
      );
    },
    h6: ({ children }: any) => {
      // Extract text from children (could be string or React elements)
      const extractText = (node: any): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return '';
      };

      const text = extractText(children);
      const id = generateHeadingId(text, 6);

      return (
        <h6
          id={id}
          className={`font-sans font-semibold text-[16px] md:text-[18px] mt-3 mb-1 ${
            isDarkMode ? 'text-ods-text-primary' : 'text-[#111827]'
          }`}
        >
          {children}
        </h6>
      );
    },

    // Style paragraphs
    p: ({ children }: any) => (
      <p className={`font-sans text-[16px] md:text-[18px] lg:text-[20px] leading-[1.6] my-4 ${
        isDarkMode ? 'text-ods-text-primary' : 'text-[#374151]'
      }`}>
        {children}
      </p>
    ),

    // Style links - use SPAN for internal docs to avoid browser navigation
    a: ({ href, children, className }: any) => {
      // Check if this link is broken
      const isBroken = brokenLinks.includes(href);

      // Internal doc link: only DocumentationSection (knowledge-base) passes currentPath.
      // Using prop instead of window.location keeps server/client output identical (no hydration mismatch).
      const isInternalDocLink =
        (propCurrentPath !== undefined && propCurrentPath !== null) &&
        href &&
        !href.startsWith('http') &&
        !href.startsWith('#');

      // For broken links, show as non-clickable but keep original color
      if (isBroken) {
        return (
          <span className="text-ods-accent cursor-not-allowed">
            {children}
            <sup className="ml-1 text-xs font-bold text-red-500">[BROKEN]</sup>
          </span>
        );
      }

      // For internal doc links, use span to avoid ANY default navigation
      if (isInternalDocLink) {
        const currentPath = propCurrentPath ?? '';
        return (
          <span
            className="text-ods-accent no-underline relative transition-colors duration-200 hover:after:w-full after:content-[''] after:absolute after:w-0 after:h-0.5 after:-bottom-0.5 after:left-0 after:bg-ods-accent after:transition-all after:duration-300 cursor-pointer"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();


              if (!onInternalLinkClick) {
                console.error('🔗 No onInternalLinkClick callback provided!');
                return;
              }

              try {
                // Call server to resolve the link
                const response = await fetch(resolveLinkEndpointUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ link: href, currentPath, source: resolveSource })
                });

                const result = await response.json();

                if (result.type === 'folder-no-readme' && result.action === 'expand_folder') {
                  // Folder without README - expand it and scroll to sidebar
                  onInternalLinkClick(result.resolvedPath, { expandFolder: true, fromInternalLink: true });
                } else if (result.type === 'not-found') {
                  // Link points to non-existent path - this shouldn't happen since broken links are pre-detected
                  console.warn(`🔗 Link points to non-existent path: ${result.resolvedPath}`);
                  // Don't navigate
                  return;
                } else if (result.success && result.resolvedPath) {
                  // Normal navigation - ALWAYS pass fromInternalLink for consistent behavior
                  onInternalLinkClick(result.resolvedPath, { fromInternalLink: true });
                } else {
                  console.error('Failed to resolve link:', result.error || result.message);
                }
              } catch (error) {
                console.error('Error resolving link:', error);
              }
            }}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                (e.currentTarget as HTMLElement).click();
              }
            }}
          >
            {children}
          </span>
        );
      }

      // Regular external links and anchors
      return (
        <a
          href={href}
          className={`text-ods-accent no-underline relative transition-colors duration-200 hover:after:w-full after:content-[''] after:absolute after:w-0 after:h-0.5 after:-bottom-0.5 after:left-0 after:bg-ods-accent after:transition-all after:duration-300 ${className || ''}`}
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      );
    },

    // In-article images. Used everywhere RichMarkdownRenderer is (blog, case studies,
    // interviews, docs, legal, admin preview). Markdown images have unknown intrinsic
    // dimensions, so <MarkdownImage> reads `transformImageSrc` from the runtime context
    // to optimize Supabase URLs (hub) or fall through identity (embedders).
    // Guard against empty/undefined sources (e.g. `![]()` in markdown).
    img: ({ src, alt }: any) => {
      if (!src || typeof src !== 'string' || src.trim() === '') {
        return null;
      }
      return <MarkdownImage src={src.trim()} alt={alt} />;
    },

    // Style lists
    ul: ({ children }: any) => (
      <ul className={`list-disc list-outside my-4 ml-8 space-y-2 ${
        isDarkMode ? 'text-ods-text-primary' : 'text-[#374151]'
      }`}>
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className={`list-decimal list-outside my-4 ml-8 space-y-2 ${
        isDarkMode ? 'text-ods-text-primary' : 'text-[#374151]'
      }`}>
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="text-[16px] md:text-[18px] leading-relaxed pl-2">
        {children}
      </li>
    ),

    // Style tables
    table: ({ children }: any) => (
      <div className="table-container my-6 overflow-x-auto">
        <div className={`min-w-full border rounded-lg ${
          isDarkMode
            ? 'border-ods-border bg-ods-card'
            : 'border-[#E5E7EB] bg-white'
        }`}>
          <table className="w-full table-fixed md:table-auto">
            {children}
          </table>
        </div>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className={isDarkMode ? 'bg-ods-bg-secondary' : 'bg-ods-bg-secondary'}>
        {children}
      </thead>
    ),
    th: ({ children }: any) => (
      <th className={`px-2 md:px-4 py-3 text-left text-xs md:text-sm font-semibold text-ods-accent border-r last:border-r-0 break-words ${
        isDarkMode ? 'border-ods-border' : 'border-[#E5E7EB]'
      }`}>
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className={`px-2 md:px-4 py-3 text-xs md:text-sm border-r last:border-r-0 border-b break-words whitespace-normal ${
        isDarkMode
          ? 'text-ods-text-primary border-ods-border'
          : 'text-[#374151] border-[#E5E7EB]'
      }`}>
        {children}
      </td>
    ),

    // Style horizontal rules
    hr: () => (
      <hr className={`border-0 border-t my-8 ${
        isDarkMode ? 'border-ods-border' : 'border-[#E5E7EB]'
      }`} />
    ),
  }), [
    isDarkMode,
    generateHeadingId,
    onInternalLinkClick,
    brokenLinks,
    propCurrentPath,
    demoteMarkdownH1ToH2,
    resolveSource,
    resolveLinkEndpointUrl,
    ogApiBaseUrl,
    ogEndpointPath,
  ]);

  // Render markdown on both server and client so article content is in initial HTML (SSR).
  return (
    <div className={`simple-markdown-renderer ${className}`}>
      {/* Inject Mermaid styles */}
      <style dangerouslySetInnerHTML={{ __html: mermaidStyles }} />
      <div className="content-wrapper max-w-none">
        <article className="prose prose-lg max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[
              rehypeRaw,
              [rehypeHighlight, {
                detect: true,
                ignoreMissing: true
              }]
            ]}
            components={components}
          >
            {processedContent}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
};

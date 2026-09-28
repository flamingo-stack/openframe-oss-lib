/**
 * Shortcode + auto-URL-embed preprocessing for the rich (content)
 * composition. Moved verbatim from the old RichMarkdownRenderer — the
 * `{{youtube:...}}` / `{% youtube %}` / thumbnail-link / auto-URL grammar
 * is authored-content SSOT; chat surfaces never run this.
 */

import { hostMatches } from '../../../../utils/social-platforms';

export const processShortcodes = (content: string): string => {
  let processedContent = content;

  // Escape values interpolated into the raw HTML `data-*` attributes generated below.
  // With rehypeRaw enabled, an unescaped `"`/`<`/`>` in a URL or id could break out of
  // the attribute and inject markup, so every interpolated embed value goes through this.
  const escapeAttr = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /**
   * Emit one shortcode-expanded embed div. Every `embed-overrides.tsx` branch
   * REQUIRES its payload attribute — a div that lost it renders as an empty
   * div (and, before that guard existed, a permanently broken player). So the
   * callers below must never hand a blank `value` in here; they keep the
   * literal shortcode text instead, which shows the author their markup is wrong.
   */
  const embedDiv = (className: string, attr: string, value: string) =>
    `\n\n<div class="${className}" ${attr}="${escapeAttr(value)}"></div>\n\n`;

  /**
   * Replace the FIRST literal occurrence of `needle` with `replacement`.
   * The function-form replacer is deliberate: with a plain string replacement
   * JS re-interprets `$&`, `` $` ``, `$'` and `$$` **in the replacement text**,
   * so a URL or a restored code fence containing them was silently corrupted
   * (a fenced `mktemp /tmp/x.$$` became `/tmp/x.$`; a bash `$'\n'` spliced the
   * rest of the document into the fence).
   */
  const replaceLiteral = (haystack: string, needle: string, replacement: string) =>
    haystack.replace(needle, () => replacement);

  // First, process explicit shortcodes
  processedContent = processedContent
    // YouTube embeds: {{youtube:VIDEO_ID}}
    .replace(/\{\{youtube:([^}]+)\}\}/g, (match: string, videoId: string) => {
      const id = videoId.trim();
      return id ? embedDiv('youtube-embed', 'data-video-id', id) : match;
    })
    // Markdoc-style YouTube: {% youtube id="VIDEO_ID" /%} or {% youtube id="VIDEO_ID" title="..." /%}
    .replace(/\{%\s*youtube\s+id="([^"]+)"(?:\s+title="[^"]*")?\s*\/?%\}/g, (match: string, videoId: string) => {
      const id = videoId.trim();
      return id ? embedDiv('youtube-embed', 'data-video-id', id) : match;
    })
    /**
     * SHORTCODE: YouTube Thumbnail Link (RECOMMENDED - GitHub + Flamingo Compatible)
     *
     * SYNTAX: [![Title](https://img.youtube.com/vi/VIDEO_ID/QUALITY.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
     *   - On GitHub: renders as a clickable thumbnail image linking to YouTube
     *   - On Flamingo: converts to a full embedded YouTube player
     * Use this format for docs that must work on BOTH GitHub and Flamingo;
     * {{youtube:ID}} / {% youtube id="ID" /%} are Flamingo-only.
     */
    .replace(
      /\[!\[([^\]]*)\]\(https?:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]+)\/[^)]+\)\]\(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)[^)]*\)/g,
      (match: string, _altText: string, _thumbId: string, videoId: string) => {
        return embedDiv('youtube-embed', 'data-video-id', videoId);
      },
    )
    // Reddit embeds: {{reddit:POST_URL}}
    .replace(/\{\{reddit:([^}]+)\}\}/g, (match: string, urlOrId: string) => {
      const postUrl = urlOrId.trim();
      // Without this guard a blank payload built the subreddit-less
      // `https://reddit.com/r/`, i.e. a guaranteed-broken embed.
      if (!postUrl) return match;
      const fullUrl = postUrl.startsWith('http') ? postUrl : `https://reddit.com/r/${postUrl}`;
      return embedDiv('reddit-embed', 'data-post-url', fullUrl);
    })
    // Twitter/X embeds: {{tweet:TWEET_URL}} or {{twitter:TWEET_URL}}
    .replace(/\{\{(?:tweet|twitter):([^}]+)\}\}/g, (match: string, urlOrId: string) => {
      const tweetInput = urlOrId.trim();
      // Same as reddit: a blank payload built `…/status/` with no id.
      if (!tweetInput) return match;
      const tweetUrl = tweetInput.startsWith('http') ? tweetInput : `https://twitter.com/twitter/status/${tweetInput}`;
      return embedDiv('tweet-embed', 'data-tweet-url', tweetUrl);
    })
    // Figma by file key (spec grammar): {{figma:FILE_KEY[:NODE_ID]}} → rewritten to the
    // canonical URL form so the {{figma:URL}} rule below owns the rendering.
    .replace(
      /\{\{figma:(?!https?:)([A-Za-z0-9]+)(?::([0-9]+[-:][0-9]+))?\}\}/g,
      (match: string, key: string, node: string | undefined) => {
        const nodeParam = node ? `?node-id=${node.replace(':', '-')}` : '';
        return `{{figma:https://www.figma.com/design/${key}${nodeParam}}}`;
      },
    )
    // Figma embeds: {{figma:URL}}
    .replace(/\{\{figma:([^}]+)\}\}/g, (match: string, url: string) => {
      const figmaUrl = url.trim();
      return figmaUrl ? embedDiv('figma-embed', 'data-figma-url', figmaUrl) : match;
    })
    // Claude artifact / Claude Design: {{claude-artifact:URL}} / {{claude-design:URL}}
    // — the same shape as figma, so a Claude link is a markdown BLOCK wherever
    // markdown renders, never a bespoke card one surface hand-assembles.
    // `{{claude-artifact:URL}}` or `{{claude-artifact:URL|Name}}` — the optional
    // name after the pipe is the ONLY source of a real title (claude.ai serves
    // one og:title for every artifact), so the block carries it through.
    .replace(
      /\{\{claude-(artifact|design):([^|}]+)(?:\|([^}]*))?\}\}/g,
      (match: string, kind: string, url: string, title: string | undefined) => {
        const name = title?.trim();
        const titleAttr = name ? ` data-title="${escapeAttr(name)}"` : '';
        return `\n\n<div class="claude-embed" data-url="${escapeAttr(url.trim())}" data-kind="${kind}"${titleAttr}></div>\n\n`;
      },
    )
    // LinkedIn embeds: {{linkedin:POST_URL}}
    .replace(/\{\{linkedin:([^}]+)\}\}/g, (match: string, url: string) => {
      const postUrl = url.trim();
      return postUrl ? embedDiv('linkedin-embed', 'data-post-url', postUrl) : match;
    })
    // Link previews: {{link:URL}}
    .replace(/\{\{link:([^}]+)\}\}/g, (match: string, url: string) => {
      const previewUrl = url.trim();
      return previewUrl ? embedDiv('link-preview', 'data-url', previewUrl) : match;
    });

  // Next, auto-detect standalone URLs (but NOT those already in markdown links or code blocks)

  // Step 1: Temporarily replace code blocks to protect them
  const codeBlocks: string[] = [];
  processedContent = processedContent.replace(/```[\s\S]*?```|`[^`]+`/g, match => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Step 1.5: Strip well-formed `<script …>…</script>` elements from prose.
  // Pasted social embed markup ships a loader script alongside its markup
  // (Reddit: `<blockquote class="reddit-embed-bq">…` + embed.reddit.com
  // widgets.js; Twitter: platform.twitter.com widgets.js). Scripts NEVER
  // execute on this surface — the sanitize stack strips real ones — but the
  // engine's text pre-pass escapes the tag first, so it used to render as
  // VISIBLE source text under every embed. Runs after Step 1 so script tags
  // inside code fences / inline code stay literal sample code; an UNCLOSED
  // opener is left alone (falls through to today's escape-to-text behavior,
  // which is the safe degrade). Quantifiers are hard-bounded (ReDoS).
  processedContent = processedContent.replace(/<script\b[^>]{0,2000}>[\s\S]{0,20000}?<\/script\s{0,10}>/gi, '');

  // Step 2: Temporarily replace markdown links to protect them
  const markdownLinks: string[] = [];
  processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, match => {
    const placeholder = `__MARKDOWN_LINK_${markdownLinks.length}__`;
    markdownLinks.push(match);
    return placeholder;
  });

  // Step 2.5: Temporarily replace table rows to protect URLs inside tables
  const tableRows: string[] = [];
  processedContent = processedContent.replace(/^\|.+\|$/gm, match => {
    const placeholder = `__TABLE_ROW_${tableRows.length}__`;
    tableRows.push(match);
    return placeholder;
  });

  // Step 3: Auto-detect standalone URLs and convert to appropriate embeds
  processedContent = processedContent
    // YouTube URLs (standalone only)
    .replace(
      /(?:^|\s)(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+))(?:\s|$)/g,
      (match: string, fullUrl: string, videoId: string) => {
        return replaceLiteral(match, fullUrl, embedDiv('youtube-embed', 'data-video-id', videoId));
      },
    )
    // Reddit URLs (standalone only)
    .replace(/(?:^|\s)(https?:\/\/(?:www\.)?reddit\.com\/[^\s]+)(?:\s|$)/g, (match: string, redditUrl: string) => {
      return replaceLiteral(match, redditUrl, embedDiv('reddit-embed', 'data-post-url', redditUrl));
    })
    // Twitter/X URLs (standalone only)
    .replace(
      /(?:^|\s)(https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^/\s]+\/status\/\d+)(?:\s|$)/g,
      (match: string, tweetUrl: string) => {
        return replaceLiteral(match, tweetUrl, embedDiv('tweet-embed', 'data-tweet-url', tweetUrl));
      },
    )
    // Figma URLs (standalone only) - design/file/proto/board/deck/slides → interactive embed
    .replace(
      /(?:^|\s)(https?:\/\/(?:www\.|embed\.)?figma\.com\/(?:design|file|proto|board|deck|slides)\/[^\s]+)(?:\s|$)/g,
      (match: string, figmaUrl: string) => {
        return replaceLiteral(match, figmaUrl, embedDiv('figma-embed', 'data-figma-url', figmaUrl));
      },
    )
    // LinkedIn post URLs (standalone only) → native post embed
    .replace(
      /(?:^|\s)(https?:\/\/(?:www\.)?linkedin\.com\/(?:posts|feed\/update|embed\/feed\/update)\/[^\s]+)(?:\s|$)/g,
      (match: string, liUrl: string) => {
        return replaceLiteral(match, liUrl, embedDiv('linkedin-embed', 'data-post-url', liUrl));
      },
    )
    // Other external URLs (standalone only) - convert to link previews
    .replace(/(?:^|\s)(https?:\/\/[^\s]+)(?:\s|$)/g, (match: string, url: string) => {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        // Exact host match (or a subdomain of it) — substring checks like
        // `hostname.includes('x.com')` false-positive on "zabbix.com". ONE
        // owner: `hostMatches` in the JSX-free social-platforms leaf, so a
        // future refinement (`m.` hosts, punycode) cannot land in only one of
        // the two allowlists that need it.
        const hostIs = (domain: string) => hostMatches(hostname, domain);
        // Non-video YouTube URLs (channels, playlists, `@handle`) fall
        // through to the og-scraper; only video URLs become inline players.
        const isYouTubeVideo = (hostIs('youtube.com') && urlObj.searchParams.has('v')) || hostIs('youtu.be');
        // LinkedIn non-post URLs (profiles, companies) fall through to the
        // og-scraper too; only interactive post embeds have handlers above.
        if (isYouTubeVideo || hostIs('reddit.com') || hostIs('twitter.com') || hostIs('x.com') || hostIs('figma.com')) {
          return match;
        }

        return replaceLiteral(match, url, embedDiv('link-preview', 'data-url', url));
      } catch (e) {
        console.warn('Failed to parse URL for link preview:', url, e);
        return match;
      }
    });

  // Step 3.5: Restore table rows
  tableRows.forEach((row, index) => {
    processedContent = replaceLiteral(processedContent, `__TABLE_ROW_${index}__`, row);
  });

  // Step 4: Restore markdown links
  markdownLinks.forEach((link, index) => {
    processedContent = replaceLiteral(processedContent, `__MARKDOWN_LINK_${index}__`, link);
  });

  // Step 5: Restore code blocks (MUST be last to prevent link preview in code)
  codeBlocks.forEach((block, index) => {
    processedContent = replaceLiteral(processedContent, `__CODE_BLOCK_${index}__`, block);
  });

  return processedContent;
};

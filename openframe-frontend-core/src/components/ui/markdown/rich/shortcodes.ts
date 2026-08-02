/**
 * Shortcode + auto-URL-embed preprocessing for the rich (content)
 * composition. Moved verbatim from the old RichMarkdownRenderer — the
 * `{{youtube:...}}` / `{% youtube %}` / thumbnail-link / auto-URL grammar
 * is authored-content SSOT; chat surfaces never run this.
 */

export const processShortcodes = (content: string): string => {
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
     * SYNTAX: [![Title](https://img.youtube.com/vi/VIDEO_ID/QUALITY.jpg)](https://www.youtube.com/watch?v=VIDEO_ID)
     *   - On GitHub: renders as a clickable thumbnail image linking to YouTube
     *   - On Flamingo: converts to a full embedded YouTube player
     * Use this format for docs that must work on BOTH GitHub and Flamingo;
     * {{youtube:ID}} / {% youtube id="ID" /%} are Flamingo-only.
     */
    .replace(/\[!\[([^\]]*)\]\(https?:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]+)\/[^)]+\)\]\(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)[^)]*\)/g,
      (match, altText, thumbId, videoId) => {
        return `\n\n<div class="youtube-embed" data-video-id="${videoId}"></div>\n\n`;
      })
    // Reddit embeds: {{reddit:POST_URL}}
    .replace(/\{\{reddit:([^}]+)\}\}/g, (match, urlOrId) => {
      const postUrl = urlOrId.trim();
      const fullUrl = postUrl.startsWith('http') ? postUrl : `https://reddit.com/r/${postUrl}`;
      return `\n\n<div class="reddit-embed" data-post-url="${escapeAttr(fullUrl)}"></div>\n\n`;
    })
    // Twitter/X embeds: {{tweet:TWEET_URL}} or {{twitter:TWEET_URL}}
    .replace(/\{\{(?:tweet|twitter):([^}]+)\}\}/g, (match, urlOrId) => {
      const tweetInput = urlOrId.trim();
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
      (match, fullUrl, videoId) => {
        return match.replace(fullUrl, `\n\n<div class="youtube-embed" data-video-id="${videoId}"></div>\n\n`);
      })
    // Reddit URLs (standalone only)
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
    // LinkedIn post URLs (standalone only) → native post embed
    .replace(/(?:^|\s)(https?:\/\/(?:www\.)?linkedin\.com\/(?:posts|feed\/update|embed\/feed\/update)\/[^\s]+)(?:\s|$)/g,
      (match, liUrl) => {
        return match.replace(liUrl, `\n\n<div class="linkedin-embed" data-post-url="${escapeAttr(liUrl)}"></div>\n\n`);
      })
    // Other external URLs (standalone only) - convert to link previews
    .replace(/(?:^|\s)(https?:\/\/[^\s]+)(?:\s|$)/g,
      (match, url) => {
        try {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname.toLowerCase();

          // Exact host match (or a subdomain of it) — substring checks like
          // `hostname.includes('x.com')` false-positive on "zabbix.com".
          const hostIs = (domain: string) =>
            hostname === domain || hostname.endsWith(`.${domain}`);
          // Non-video YouTube URLs (channels, playlists, `@handle`) fall
          // through to the og-scraper; only video URLs become inline players.
          const isYouTubeVideo =
            (hostIs('youtube.com') && urlObj.searchParams.has('v')) || hostIs('youtu.be');
          // LinkedIn non-post URLs (profiles, companies) fall through to the
          // og-scraper too; only interactive post embeds have handlers above.
          if (isYouTubeVideo ||
              hostIs('reddit.com') || hostIs('twitter.com') || hostIs('x.com') ||
              hostIs('figma.com')) {
            return match;
          }

          return match.replace(url, `\n\n<div class="link-preview" data-url="${escapeAttr(url)}"></div>\n\n`);
        } catch (e) {
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

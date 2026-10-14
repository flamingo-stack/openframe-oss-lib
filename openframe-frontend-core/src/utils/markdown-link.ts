/**
 * One link format for the markdown editors and one `rel` rule for the renderers.
 *
 * A FOLLOWED link is written as markdown, `[text](url)`, exactly as the editors always wrote it.
 * A NOFOLLOW link is written as an HTML anchor, `<a href="url" rel="nofollow">text</a>`: markdown
 * has no attribute syntax, and an HTML anchor is what stored content already uses for links that
 * carry attributes (the sanitizer keeps `rel` on `a`). Reading back accepts both forms, so a link
 * can be switched either way. Nothing is rewritten unless an editor changes a link.
 *
 * Server-safe: no React, no DOM.
 */

/** The `rel` tokens an author may set on a link. Search engines read these; nothing else is kept. */
export const AUTHORED_LINK_REL_TOKENS = ['nofollow', 'ugc', 'sponsored'] as const;

/** What a renderer adds to every link that opens in a new tab. */
const NEW_TAB_REL = 'noopener noreferrer';

/** The authored SEO tokens in a `rel` value, in their canonical order. */
export function authoredRelTokens(rel: string | readonly string[] | null | undefined): string[] {
  if (!rel) return [];
  const given = new Set(
    (typeof rel === 'string' ? rel.split(/\s+/) : rel).map(token => token.trim().toLowerCase()).filter(Boolean),
  );
  return AUTHORED_LINK_REL_TOKENS.filter(token => given.has(token));
}

/** Whether an authored `rel` asks search engines not to follow the link. */
export function isNofollowRel(rel: string | readonly string[] | null | undefined): boolean {
  return authoredRelTokens(rel).includes('nofollow');
}

/**
 * The `rel` a renderer writes for a link: the author's SEO tokens, plus `noopener noreferrer` when
 * the link opens in a new tab. `undefined` when there is nothing to write.
 */
export function renderedLinkRel(
  authoredRel: string | readonly string[] | null | undefined,
  opensInNewTab: boolean,
): string | undefined {
  const tokens = authoredRelTokens(authoredRel);
  if (opensInNewTab) tokens.push(NEW_TAB_REL);
  return tokens.length > 0 ? tokens.join(' ') : undefined;
}

/** A link as the editor's dialog edits it. */
export interface MarkdownLinkFields {
  text: string;
  url: string;
  nofollow: boolean;
}

/** A link found in the editor's text, with the range it occupies. */
export interface MarkdownLinkMatch extends MarkdownLinkFields {
  start: number;
  end: number;
}

// `[text](url)` or `[text](url "title")`, never an image (`![…]`). The text may hold escaped brackets.
const MARKDOWN_LINK_RE = /(?<!!)\[((?:\\.|[^\]\\])*)\]\(\s*<?([^\s)>]*)>?(?:\s+"[^"]*")?\s*\)/g;
// One HTML anchor, attributes and text. Nested anchors are not valid HTML, so the first `</a>` ends it.
const HTML_LINK_RE = /<a\s([^>]*)>([\s\S]*?)<\/a\s*>/gi;

function htmlAttribute(attributes: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(attributes);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/([\\[\]])/g, '\\$1');
}

function unescapeMarkdownLinkText(value: string): string {
  return value.replace(/\\([\\[\]])/g, '$1');
}

/** A URL inside `(…)` breaks on whitespace and unbalanced parentheses; percent-encode them. */
function encodeMarkdownUrl(url: string): string {
  return url.replace(/\s/g, match => encodeURIComponent(match)).replace(/[()]/g, match => encodeURIComponent(match));
}

/**
 * The link the selection `[selectionStart, selectionEnd]` is in or on, if any: a markdown link or an
 * HTML anchor that contains the whole selection (a caret counts when it touches the link).
 */
export function findMarkdownLinkAt(
  text: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
): MarkdownLinkMatch | null {
  const from = Math.min(selectionStart, selectionEnd);
  const to = Math.max(selectionStart, selectionEnd);
  const contains = (start: number, end: number) => start <= from && to <= end;

  for (const match of text.matchAll(HTML_LINK_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (!contains(start, end)) continue;
    const attributes = match[1] ?? '';
    return {
      start,
      end,
      text: decodeHtmlEntities(match[2] ?? ''),
      url: decodeHtmlEntities(htmlAttribute(attributes, 'href') ?? ''),
      nofollow: isNofollowRel(htmlAttribute(attributes, 'rel')),
    };
  }
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (!contains(start, end)) continue;
    return { start, end, text: unescapeMarkdownLinkText(match[1] ?? ''), url: match[2] ?? '', nofollow: false };
  }
  return null;
}

/** The text that writes a link: markdown when followed, an HTML anchor when nofollow. */
export function formatMarkdownLink({ text, url, nofollow }: MarkdownLinkFields): string {
  const label = text.length > 0 ? text : url;
  if (nofollow) {
    return `<a href="${escapeHtmlAttribute(url)}" rel="nofollow">${escapeHtmlText(label)}</a>`;
  }
  return `[${escapeMarkdownLinkText(label)}](${encodeMarkdownUrl(url)})`;
}

/**
 * Convert markdown source to plain text. Used by both the SEO server component
 * (article-body echo in JSON-LD) and chat entity-card preview (clamped previews
 * inside chat cards).
 *
 * The two consumers differ only in pre/post processing — `mode: 'article'`
 * strips code blocks + images + headings + list bullets and preserves paragraph
 * breaks; `mode: 'preview'` collapses everything to a single line. Both share
 * the same inline-marker strip (link / bold / italic / inline-code).
 *
 * Raw HTML is Markdown too (CommonMark "Raw HTML"; the editors write a link that carries a `rel`
 * as `<a href rel>`), so tags are removed and their text kept: `<a …>a partner</a>` → `a partner`.
 * `<script>` / `<style>` lose their content, `<br>` becomes a line break, comments go, and the
 * common entities are decoded. Inline code is left alone, so `` `<div>` `` stays readable.
 *
 * All regex patterns are linear (negated character classes, non-greedy with
 * bounded targets) — no nested quantifiers, no catastrophic backtracking on
 * pathological input.
 */

export interface MarkdownToPlainOptions {
  /**
   * - `'article'` (default): preserve paragraph structure (`\n\n` as separator),
   *   strip code blocks + images + headings + list bullets. Used for the
   *   article-body echo on SEO surfaces.
   * - `'preview'`: collapse all whitespace to single spaces; result is a single
   *   line. Used for chat-card previews / OG-card snippets where line breaks
   *   would wrap awkwardly.
   */
  mode?: 'article' | 'preview';
  /** Optional max-character cap. Truncates with no ellipsis (caller-decided). */
  maxChars?: number;
}

/** Strip inline markdown markers (bold, italic, inline-code, links). Shared
 *  by `extractSections`'s `stripFormattingMarkers` and `markdownToPlainText`. */
export function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1') // *italic* → italic
    .replace(/`([^`]+)`/g, '$1'); // `inline code` → inline code
}

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const HTML_RAW_TEXT_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_BREAK_RE = /<br\s*\/?>/gi;
// A tag starts with `<` (or `</`) directly followed by a letter, so `a < b > c` is not one.
const HTML_TAG_RE = /<\/?[A-Za-z][^<>]*>/g;
const INLINE_CODE_SPLIT_RE = /(`[^`]+`)/;
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};
const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g;

/** Remove raw HTML tags and keep their text, outside inline code spans. */
function stripHtml(s: string): string {
  return s
    .split(INLINE_CODE_SPLIT_RE)
    .map((part, index) =>
      // Odd indexes are the captured inline-code spans: left as written.
      index % 2 === 1
        ? part
        : part
            .replace(HTML_COMMENT_RE, '')
            .replace(HTML_RAW_TEXT_RE, '')
            .replace(HTML_BREAK_RE, '\n')
            .replace(HTML_TAG_RE, '')
            .replace(HTML_ENTITY_RE, entity => HTML_ENTITIES[entity] ?? entity),
    )
    .join('');
}

export function markdownToPlainText(markdown: string, options: MarkdownToPlainOptions = {}): string {
  const { mode = 'article', maxChars } = options;

  let out = markdown
    // Fenced code blocks — must run BEFORE inline strippers (otherwise the
    // backtick-grave strip below grazes them).
    .replace(/```[\s\S]*?```/g, '')
    // Images — `![alt](src)` → empty (we drop them entirely in plain text).
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '');

  out = stripHtml(out);

  out = stripInlineMarkdown(out)
    // Heading markers (any depth).
    .replace(/^#+\s*/gm, '')
    // List bullets at start-of-line.
    .replace(/^\s*[-*+]\s+/gm, '');

  if (mode === 'preview') {
    out = out.replace(/\s+/g, ' ').trim();
  } else {
    out = out.replace(/\n{3,}/g, '\n\n').trim();
  }

  if (maxChars != null && out.length > maxChars) {
    out = out.slice(0, maxChars);
  }
  return out;
}

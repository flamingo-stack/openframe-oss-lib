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
  mode?: 'article' | 'preview'
  /** Optional max-character cap. Truncates with no ellipsis (caller-decided). */
  maxChars?: number
}

/** Strip inline markdown markers (bold, italic, inline-code, links). Shared
 *  by `extractSections`'s `stripFormattingMarkers` and `markdownToPlainText`. */
export function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // [text](url) → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')         // **bold** → bold
    .replace(/\*([^*]+)\*/g, '$1')             // *italic* → italic
    .replace(/`([^`]+)`/g, '$1')               // `inline code` → inline code
}

export function markdownToPlainText(
  markdown: string,
  options: MarkdownToPlainOptions = {},
): string {
  const { mode = 'article', maxChars } = options

  let out = markdown
    // Fenced code blocks — must run BEFORE inline strippers (otherwise the
    // backtick-grave strip below grazes them).
    .replace(/```[\s\S]*?```/g, '')
    // Images — `![alt](src)` → empty (we drop them entirely in plain text).
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')

  out = stripInlineMarkdown(out)
    // Heading markers (any depth).
    .replace(/^#+\s*/gm, '')
    // List bullets at start-of-line.
    .replace(/^\s*[-*+]\s+/gm, '')

  if (mode === 'preview') {
    out = out.replace(/\s+/g, ' ').trim()
  } else {
    out = out.replace(/\n{3,}/g, '\n\n').trim()
  }

  if (maxChars != null && out.length > maxChars) {
    out = out.slice(0, maxChars)
  }
  return out
}

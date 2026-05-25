/**
 * Shared helper for the host-side markdown formatter ↔ server-side
 * parser pair. Single source of truth so the host-side build (chat
 * bubble render) and the server-side strip (LLM input cleanup) can
 * never drift.
 *
 * Lib-side replacement for the hub's `lib/utils/chat-attachment-markdown.ts`.
 * The hub file pulled its constants from `lib/config/chat-attachment-config`
 * + its `ChatAttachment` type from `lib/types/chat-attachment`. Both are
 * inlined here as lib-local constants/types — they're stable wire-format
 * contracts (the hub's view-route owns the prefix + token-param name; any
 * change is a coordinated migration).
 *
 * URL flavors at a glance:
 *   - HOST-SIDE (user-bubble render): uses the runtime's
 *     `attachmentViewUrlPrefix` (hub default = `/api/storage/view/chat-attachments/`).
 *     Embedded apps override per their reverse-proxy topology.
 *   - SERVER-SIDE (strip regex): uses the constant
 *     `CHAT_ATTACHMENT_VIEW_URL_PREFIX` directly. The chat ROUTE always
 *     runs on the hub, so it always strips on the hub default.
 *   - ANTHROPIC image-blocks: uses the RAW Supabase signed URL — NOT the
 *     proxy URL — because Anthropic's image fetcher doesn't reliably
 *     follow 302 redirects.
 *
 * Security gates inside the formatter:
 *   - Filename markdown chars escaped via `escapeMarkdownInline` so a
 *     name like `screenshot](https://evil.com).png` cannot terminate
 *     the markdown image early and embed an attacker-controlled URL.
 *   - `<` and `>` escaped too — prevents CommonMark autolink expansion
 *     for filenames containing URL-shaped text.
 */

// ---------------------------------------------------------------------------
// Lib-local constants + types (mirror the hub's chat-attachment-config /
// chat-attachment.ts). These are wire-format contracts owned by the hub's
// view route; embedders that want to override the prefix do so via
// `ChatRuntime.endpoints.attachmentViewUrlPrefix`, not by changing these.
// ---------------------------------------------------------------------------

/** Hub-default prefix for the view-proxy URL. Embedders override via the
 *  runtime. The server-side strip regex always uses THIS value (server
 *  runs on the hub). */
export const CHAT_ATTACHMENT_VIEW_URL_PREFIX = '/api/storage/view/chat-attachments/'

/** Query parameter name for the HMAC view token. */
export const CHAT_ATTACHMENT_VIEW_TOKEN_QUERY_PARAM = 't'

/** Subset Anthropic's image content-block API supports. HEIC / video
 *  attachments fall through to the text-marker form so the LLM still sees
 *  a reference even when it can't visually parse the file. */
export const ANTHROPIC_SUPPORTED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

/**
 * Wire shape for a single chat attachment.
 *
 * `viewToken` is server-issued (HMAC-signed) and embedded in the markdown
 * URL's `?t=` query parameter. The client never generates it — the upload
 * route returns it alongside the storage path.
 */
export interface ChatAttachment {
  storagePath: string
  viewToken: string
  contentType: string
  fileName: string
  size: number
}

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

/**
 * Build the markdown view-URL for a chat attachment.
 *
 * `viewUrlPrefix` is parameterized (NOT pulled from the constant) so
 * host-side callers can pass the runtime's prefix
 * (`ChatRuntime.endpoints.attachmentViewUrlPrefix`) — embedded apps
 * supply an absolute URL against the hub's origin so chat-history
 * markdown works cross-origin.
 *
 * Server-side callers (the strip regex source) should pass
 * `CHAT_ATTACHMENT_VIEW_URL_PREFIX` directly.
 */
export function buildChatAttachmentViewUrl(
  viewUrlPrefix: string,
  storagePath: string,
  viewToken: string,
): string {
  return `${viewUrlPrefix}${storagePath}?${CHAT_ATTACHMENT_VIEW_TOKEN_QUERY_PARAM}=${encodeURIComponent(viewToken)}`
}

// ---------------------------------------------------------------------------
// Markdown formatter
// ---------------------------------------------------------------------------

/**
 * Escape inline-markdown special characters from a filename before
 * interpolation. Closes the markdown-injection / phishing primitive:
 * a filename like `screenshot](https://evil.com).png` would otherwise
 * terminate `![filename](...)` early and emit an attacker-controlled
 * URL in the user's bubble.
 *
 * Escapes: `[`, `]`, `(`, `)`, `\`, `\n`, `\r`, `<`, `>`, `"`.
 */
export function escapeMarkdownInline(text: string): string {
  return text.replace(/[[\]()\\\n\r<>"]/g, (ch) => {
    switch (ch) {
      case '\n':
        return ' '
      case '\r':
        return ''
      default:
        return `\\${ch}`
    }
  })
}

/**
 * Format a single chat-attachment as a markdown line to append to the
 * user's bubble text BEFORE sending.
 *
 * Images (MIME in `ANTHROPIC_SUPPORTED_IMAGE_MIME`) emit the `![]()`
 * image form so the browser renders the attachment inline. Everything
 * else (HEIC, video, audio) emits the `[Attached: ...]` link form so the
 * bubble shows a clickable file pill instead of a broken-image icon.
 */
export function formatChatAttachmentMarkdownForBubble(
  att: ChatAttachment,
  viewUrlPrefix: string,
): string {
  const safeName = escapeMarkdownInline(att.fileName)
  const url = buildChatAttachmentViewUrl(viewUrlPrefix, att.storagePath, att.viewToken)
  const isImage = (ANTHROPIC_SUPPORTED_IMAGE_MIME as readonly string[]).includes(att.contentType)
  return isImage ? `\n\n![${safeName}](${url})` : `\n\n[Attached: ${safeName}](${url})`
}

// ---------------------------------------------------------------------------
// Server-side strip regex + parser
// ---------------------------------------------------------------------------

/**
 * Module-private: the `CHAT_ATTACHMENT_VIEW_URL_PREFIX` with regex
 * meta-characters escaped, so it can be safely interpolated into
 * regex sources. Computed ONCE at module load. Exported so other
 * regex-building call sites can share the same source of truth.
 */
export const CHAT_ATTACHMENT_VIEW_URL_PREFIX_REGEX_ESCAPED =
  CHAT_ATTACHMENT_VIEW_URL_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Single anchored regex matching both the image (`![]()`) and link
 * (`[Attached: ...]`) forms keyed on the server-side prefix.
 *
 * `gm` flags — multi-line anchored so the regex matches per-line.
 * Non-chat markdown links/images stay untouched because the regex
 * requires the literal `/api/storage/view/chat-attachments/` prefix.
 */
export const CHAT_ATTACHMENT_MARKDOWN_PATTERN = new RegExp(
  `^\\s*!?\\[[^\\]]*\\]\\(${CHAT_ATTACHMENT_VIEW_URL_PREFIX_REGEX_ESCAPED}[^)]+\\)\\s*$`,
  'gm',
)

/**
 * Strip pre-embedded chat-attachment markdown lines from `text`.
 * Returns the cleaned text + the storage paths extracted from the
 * matched URLs.
 */
export function stripChatAttachmentMarkdown(text: string): {
  stripped: string
  storagePaths: string[]
} {
  const storagePaths: string[] = []
  const pathExtract = new RegExp(
    `\\(${CHAT_ATTACHMENT_VIEW_URL_PREFIX_REGEX_ESCAPED}([^?)]+)`,
  )
  const stripped = text.replace(CHAT_ATTACHMENT_MARKDOWN_PATTERN, (match) => {
    const m = match.match(pathExtract)
    if (m && m[1]) storagePaths.push(m[1])
    return ''
  })
  return {
    stripped: stripped.replace(/\n{3,}/g, '\n\n').trim(),
    storagePaths,
  }
}

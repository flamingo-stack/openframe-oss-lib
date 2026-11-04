/**
 * The bubble's markdown for a user row's `file` part (`chatFilePartMarkdown`), and the escape every server that writes
 * a file name into markdown applies (`escapeMarkdownInline`). The attachment itself (its constants, shape and view url)
 * is the chat protocol's (`chat-protocol/attachment.ts`).
 *
 * Security gate: a file name's markdown characters are escaped, so a name like `screenshot](https://evil.com).png`
 * cannot end the markdown image early and embed an attacker-controlled URL; `<` and `>` too, against CommonMark
 * autolinks.
 */

import {
  ANTHROPIC_SUPPORTED_IMAGE_MIME,
  CHAT_ATTACHMENT_VIEW_URL_PREFIX,
  filePartViewUrl,
} from '../../../chat-protocol/attachment';
import { escapeRegExp } from '../../../utils/escape-regexp';

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
  return text.replace(/[[\]()\\\n\r<>"]/g, ch => {
    switch (ch) {
      case '\n':
        return ' ';
      case '\r':
        return '';
      default:
        return `\\${ch}`;
    }
  });
}

/**
 * A `file` part as the bubble draws it. Images (MIME in `ANTHROPIC_SUPPORTED_IMAGE_MIME`) are the `![]()` image form, so
 * the browser renders them inline; everything else (HEIC, video, audio) is the `[Attached: ...]` link form, a file pill
 * instead of a broken-image icon.
 */
export function chatFilePartMarkdown(
  part: { mediaType: string; filename?: string; url: string },
  viewUrlPrefix: string | undefined,
): string {
  const safeName = escapeMarkdownInline(part.filename ?? 'attachment');
  const url = filePartViewUrl(part.url, viewUrlPrefix);
  return (ANTHROPIC_SUPPORTED_IMAGE_MIME as readonly string[]).includes(part.mediaType)
    ? `![${safeName}](${url})`
    : `[Attached: ${safeName}](${url})`;
}

/** The hub's view-proxy prefix with its regex characters escaped, for a server that builds a pattern over view urls. */
export const CHAT_ATTACHMENT_VIEW_URL_PREFIX_REGEX_ESCAPED = escapeRegExp(CHAT_ATTACHMENT_VIEW_URL_PREFIX);

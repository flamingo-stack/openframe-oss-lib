/**
 * `flattenAssistantContent` — coerce a chat message's `content` field
 * (string OR `MessageSegment[]`) into a plain string for wire transport.
 *
 * Background: useChat populates assistant messages with a structured
 * segment array as the streamed SSE arrives (text segments, approval
 * cards, tool_execution blocks, thinking blocks). The local React
 * state holds `content: MessageSegment[]` for those turns. When the
 * client serializes the conversation back to the server for the NEXT
 * turn, a naive `typeof content === 'string' ? content : ''` strip-
 * to-empty silently drops every post-approve receipt, every Sonnet-
 * streamed answer, and every diagnostic Q — Anthropic receives
 * `assistant: ""` for those turns and has no context to follow.
 *
 * The function:
 *   1. Returns plain strings as-is.
 *   2. For arrays, joins every `text`-typed segment's `text` field
 *      with `\n\n` separators. Non-text segments (approval_request,
 *      tool_execution, thinking) have no LLM-visible textual content
 *      and are intentionally skipped — they shouldn't bloat the
 *      request body.
 *   3. Returns `''` for anything else (null, undefined, unknown shape).
 */
export function flattenAssistantContent(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (!Array.isArray(raw)) return ''
  const parts: string[] = []
  for (const seg of raw) {
    if (seg && typeof seg === 'object' && (seg as { type?: string }).type === 'text') {
      const t = (seg as { text?: unknown }).text
      if (typeof t === 'string' && t.length > 0) parts.push(t)
    }
  }
  return parts.join('\n\n')
}

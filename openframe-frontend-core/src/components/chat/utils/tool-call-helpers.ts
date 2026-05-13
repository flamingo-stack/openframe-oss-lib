import type { PendingToolCallData } from '../types'

/**
 * Keys in `toolCallArguments` whose value is the actual command/query/script
 * body — anything that should be rendered as the tool's "title" line in the
 * approval card. Order matters: first match wins.
 */
export const COMMAND_BODY_ARG_KEYS = ['command', 'query', 'script', 'scriptContent', 'code'] as const

/**
 * Extract a human-readable command string from a tool call.
 * Order: command/query/script/scriptContent/code arg → toolTitle → toolName → fallback.
 */
export function getCommandText(call: PendingToolCallData): string {
  const args = call.toolCallArguments
  if (args && typeof args === 'object') {
    const a = args as Record<string, unknown>
    for (const key of COMMAND_BODY_ARG_KEYS) {
      const candidate = a[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate
    }
  }
  return call.toolTitle || call.toolName || 'Tool call'
}

export type FormattedArgValue =
  | { kind: 'inline'; text: string }
  | { kind: 'block'; text: string; language: 'json' | 'text' }

const INLINE_STRING_MAX = 80

/**
 * Decide how to render a single `toolCallArguments` value:
 *  - objects/arrays → pretty-printed JSON block
 *  - strings that parse as JSON → pretty-printed JSON block
 *  - multi-line or long strings → preserved-whitespace text block
 *  - everything else → inline single line
 */
export function formatToolArgValue(value: unknown): FormattedArgValue {
  if (value === null || value === undefined) return { kind: 'inline', text: '' }

  if (typeof value === 'object') {
    return { kind: 'block', text: safeStringify(value), language: 'json' }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return { kind: 'block', text: JSON.stringify(JSON.parse(trimmed), null, 2), language: 'json' }
      } catch {
        // not valid JSON — fall through
      }
    }
    if (value.includes('\n') || value.length > INLINE_STRING_MAX) {
      return { kind: 'block', text: value, language: 'text' }
    }
    return { kind: 'inline', text: value }
  }

  return { kind: 'inline', text: String(value) }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/**
 * Decide how to render a tool execution `result` string.
 *  - Strips a single surrounding markdown code fence (``` … ```), since the
 *    backend often wraps Bash/PowerShell output that way.
 *  - If the body parses as JSON, returns a pretty-printed JSON block.
 *  - If the body is multi-line / long, returns a preserved-whitespace block.
 *  - Otherwise inline.
 */
export function formatToolResult(value: string | undefined | null): FormattedArgValue {
  if (typeof value !== 'string') return { kind: 'inline', text: '' }

  const fenced = value.match(/^\s*```(?:[a-zA-Z0-9_-]*)\n([\s\S]*?)\n```\s*$/)
  const body = fenced ? fenced[1] : value
  const trimmed = body.trim()

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return { kind: 'block', text: JSON.stringify(JSON.parse(trimmed), null, 2), language: 'json' }
    } catch {
      // fall through
    }
  }

  if (body.includes('\n') || body.length > INLINE_STRING_MAX) {
    return { kind: 'block', text: body, language: 'text' }
  }
  return { kind: 'inline', text: body }
}

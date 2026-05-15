import type { PendingToolCallData } from '../types'

/**
 * Keys in `toolCallArguments` whose value is the actual command/query/script
 * body — anything that should be rendered as the tool's "title" line in the
 * approval card. Order matters: first match wins.
 */
export const COMMAND_BODY_ARG_KEYS = ['command', 'query', 'script', 'scriptContent', 'code'] as const

/**
 * Resolve the human-readable title/preview line for a tool call.
 * Order: command/query/script/scriptContent/code arg → title → name → fallback.
 *
 * Shape-agnostic so both the approval card (`PendingToolCallData`:
 * `toolCallArguments`/`toolName`) and the execution card (`ToolExecutionData`:
 * `parameters`/`toolFunction`) can share one source of truth.
 */
export function getToolCallTitle(opts: {
  args?: Record<string, unknown> | null
  title?: string | null
  name?: string | null
}): string {
  const { args, title, name } = opts
  if (args && typeof args === 'object') {
    for (const key of COMMAND_BODY_ARG_KEYS) {
      const candidate = args[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate
    }
  }
  return title || name || 'Tool call'
}

/**
 * Extract a human-readable command string from a batch tool call.
 * Thin adapter over {@link getToolCallTitle}.
 */
export function getCommandText(call: PendingToolCallData): string {
  return getToolCallTitle({
    args: call.toolCallArguments,
    title: call.toolTitle,
    name: call.toolName,
  })
}

export type FormattedArgValue =
  | { kind: 'inline'; text: string }
  | { kind: 'block'; text: string; language: 'json' | 'text' }

const INLINE_STRING_MAX = 80

/**
 * Pretty-print like `JSON.stringify(value, null, 2)`, but render multi-line
 * string values across real lines instead of escaped `\n` sequences.
 *
 * Trade-off: the output is optimised for human reading, not for being
 * re-parsed as JSON (multi-line string bodies lose their surrounding quotes
 * and escaping). Single-line strings keep normal JSON quoting/escaping.
 *
 * `indent` is the nesting level of this value's content lines / closing
 * bracket (matching the 2-space step of `JSON.stringify(_, null, 2)`).
 */
function expandJson(value: unknown, indent: number): string {
  const pad = (n: number) => '  '.repeat(n)

  if (value === null) return 'null'
  const t = typeof value
  if (t === 'number' || t === 'boolean' || t === 'bigint') return String(value)

  if (t === 'string') {
    const s = (value as string).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    if (!s.includes('\n')) return JSON.stringify(s)
    return s
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
      .split('\n')
      .map((line) => pad(indent) + line)
      .join('\n')
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) =>
      typeof v === 'string' && /[\r\n]/.test(v)
        ? expandJson(v, indent + 1)
        : pad(indent + 1) + expandJson(v, indent + 1),
    )
    return '[\n' + items.join(',\n') + '\n' + pad(indent) + ']'
  }

  if (t === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '{}'
    const items = entries.map(([k, v]) => {
      const key = JSON.stringify(k)
      if (typeof v === 'string' && /[\r\n]/.test(v)) {
        return pad(indent + 1) + key + ':\n' + expandJson(v, indent + 2)
      }
      return pad(indent + 1) + key + ': ' + expandJson(v, indent + 1)
    })
    return '{\n' + items.join(',\n') + '\n' + pad(indent) + '}'
  }

  return JSON.stringify(value)
}

/**
 * Entry point for {@link expandJson}: readable pretty-print where multi-line
 * string fields (script bodies, command output, …) are shown with real line
 * breaks instead of literal `\n`.
 */
export function expandedJsonStringify(value: unknown): string {
  try {
    return expandJson(value, 0)
  } catch {
    return String(value)
  }
}

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
        return { kind: 'block', text: expandedJsonStringify(JSON.parse(trimmed)), language: 'json' }
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
  return expandedJsonStringify(value)
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
      return { kind: 'block', text: expandedJsonStringify(JSON.parse(trimmed)), language: 'json' }
    } catch {
      // fall through
    }
  }

  if (body.includes('\n') || body.length > INLINE_STRING_MAX) {
    return { kind: 'block', text: body, language: 'text' }
  }
  return { kind: 'inline', text: body }
}

/**
 * Lib-side portable subset of the hub's `lib/utils/slash-dispatch-utils.ts`.
 *
 * The full hub file owns the SERVER-SIDE parser/dispatcher (depends on
 * `slash-commands-config`, `slash-commands-static`, `doc-source-config-utils`,
 * `chat-admin-types`, `rag-table-config`) which stays hub-side.
 *
 * What MIGRATES here is the wire contract + the small text helpers consumed
 * by chat surfaces in the lib + the hub UI:
 *   - `WireCommandOverride`        — wire-shape (chat request body)
 *   - `parseWireCommandOverride`   — wire validator
 *   - `CommandOverride`            — server-built dispatch result type
 *     (presentation typed as `string` here; the hub narrows via its own
 *     `SlashCommandPresentation` union)
 *   - `extractEntityIdFilter`      — `CommandOverride` → narrowed filter
 *   - `sanitizeTitleForChat`       — collapse control chars in titles
 *   - `formatSingularLookupInvocation` — `/cmd "value"` builder
 *   - `buildDiscussAddendum`       — server-side Discuss addendum prose
 *
 * Validation constants (regex + length caps) are duplicated here verbatim
 * to keep the lib's wire validator self-contained.
 */

const WIRE_TABLE_ID_REGEX = /^[a-z][a-z0-9-]*$/
const WIRE_ID_REGEX = /^[A-Za-z0-9._:/-]+$/
const WIRE_TABLE_ID_MAX = 60
const WIRE_ID_MAX = 200
const WIRE_QUERY_MAX = 2000

/** Wire-supplied `CommandOverride` — the subset of fields a client (chat
 *  shell) is allowed to send on the request body. Excludes
 *  `systemPromptAddendum` by construction: addendum injection is a
 *  Rule-5b bypass vector, so we never accept it from the wire. */
export interface WireCommandOverride {
  entityIdFilter?: { tableId: string; id: string }
  retrievalQueryOverride?: string
}

/**
 * Parse + validate a wire-supplied `commandOverride` from the chat
 * request body. Returns the validated subset OR `null` if the input is
 * missing / malformed in every field.
 */
export function parseWireCommandOverride(raw: unknown): WireCommandOverride | null {
  if (!raw || typeof raw !== 'object') return null
  const out: WireCommandOverride = {}
  const r = raw as Record<string, unknown>

  if (r.entityIdFilter && typeof r.entityIdFilter === 'object') {
    const f = r.entityIdFilter as Record<string, unknown>
    if (
      typeof f.tableId === 'string'
      && f.tableId.length > 0
      && f.tableId.length <= WIRE_TABLE_ID_MAX
      && WIRE_TABLE_ID_REGEX.test(f.tableId)
      && typeof f.id === 'string'
      && f.id.length > 0
      && f.id.length <= WIRE_ID_MAX
      && WIRE_ID_REGEX.test(f.id)
    ) {
      out.entityIdFilter = { tableId: f.tableId, id: f.id }
    }
  }
  if (
    typeof r.retrievalQueryOverride === 'string'
    && r.retrievalQueryOverride.length > 0
    && r.retrievalQueryOverride.length <= WIRE_QUERY_MAX
  ) {
    out.retrievalQueryOverride = r.retrievalQueryOverride
  }
  if (out.entityIdFilter === undefined && out.retrievalQueryOverride === undefined) {
    return null
  }
  return out
}

/**
 * Sanitize a free-text title for use inside a chat-visible string:
 * collapse control chars (\r \n \t) to single spaces and trim. Defends
 * against a row title containing embedded newlines (which would split
 * the rendered prompt across visible lines + survive into ILIKE in a
 * confusing way) and tab/CR artifacts from sloppy imports.
 */
export function sanitizeTitleForChat(value: string | null | undefined): string {
  return (value ?? '').replace(/[\r\n\t]+/g, ' ').trim()
}

/**
 * Compose a singular-lookup slash invocation as the user-visible chat
 * message: `/<cmd> "<value>"` (or `/<cmd>` when value is empty).
 *
 * SINGLE SOURCE OF TRUTH for the quoting convention `parseSlashCommand`
 * consumes: outer `"`-pair triggers `singularLookup`; unquoted args run
 * FTS; empty args browse. Internal `"` chars are backslash-escaped so
 * the visible string is paste-able / re-runnable.
 */
export function formatSingularLookupInvocation(cmdId: string, value?: string | null): string {
  // Escape `\` BEFORE `"` — otherwise a value ending in `\` survives the
  // `"`-escape pass and, when wrapped in `"..."`, the trailing `\"`
  // becomes a literal `"` to a parser that processes backslash escapes,
  // breaking the close quote. CodeQL's `js/incomplete-sanitization` fires
  // on the previous one-pass `\"` escape for exactly this reason.
  const safe = sanitizeTitleForChat(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
  return safe ? `/${cmdId} "${safe}"` : `/${cmdId}`
}

/** Command-override structure passed to `buildChatContext.opts.commandOverride`. */
export interface CommandOverride {
  retrievalScope?: string[]
  systemPromptAddendum?: string
  retrievalQueryOverride?: string | null
  /** Singular-item lookup. When set, retrieval bypasses FTS and queries the
   *  named table directly via ILIKE on the matchFields. */
  entityLookup?: {
    tableId: string
    value: string
    matchFields: string[]
  }
  /** Singular row by primary key. Used by the inline object-card
   *  "Discuss" action — the client knows the exact row id from a prior
   *  chip. Higher precedence than `entityLookup` (route enforces) and
   *  `retrievalQueryOverride`. The retrieval layer still runs the table's
   *  `searchFilter` so privacy invariants hold. */
  entityIdFilter?: {
    tableId: string
    id: string
  }
  /** "Browse" bypass for bare slash list commands. The search layer
   *  treats this as "skip FTS — return rows from these tableIds ordered
   *  by the configured `primaryDateColumn` DESC". */
  browseScope?: string[]
  /** Presentation hint propagated from the slash command. Hub narrows to
   *  its `SlashCommandPresentation` union; lib leaves as `string` for
   *  decoupling. */
  presentation?: string
}

/**
 * Resolve the wire `entityIdFilter` from a `CommandOverride`, optionally
 * narrowed to a specific `tableId`. Returns the validated `{ tableId, id }`
 * pair only when both fields are present, non-empty, and (when an expected
 * tableId is passed) match. Returns `null` otherwise.
 */
export function extractEntityIdFilter(
  override: CommandOverride | null | undefined,
  expectedTableId?: string,
): { tableId: string; id: string } | null {
  const f = override?.entityIdFilter
  if (!f) return null
  const tableId = typeof f.tableId === 'string' ? f.tableId : ''
  const id = typeof f.id === 'string' ? f.id : ''
  if (!tableId || !id) return null
  if (expectedTableId && tableId !== expectedTableId) return null
  return { tableId, id }
}

/**
 * Server-only synthesizer for the Discuss-action system-prompt addendum.
 * Called by the chat route AFTER `parseWireCommandOverride` accepts an
 * `entityIdFilter` — the addendum text is composed from server-trusted
 * values (the row's tableId + id) so a malicious client can't inject
 * arbitrary prompt content.
 */
export function buildDiscussAddendum(args: { tableId: string; id: string }): string {
  const idTag = args.id.length > 24 ? args.id.slice(0, 24) + '…' : args.id
  return (
    `Ask drill-in for row id="${args.id}" in table "${args.tableId}". Focus the ` +
    `answer on this single record. If retrieval returns 0 rows (privacy ` +
    `filter), say so plainly per Rule 5b.\n\n` +
    `OPEN with the inline card on the FIRST line, immediately followed by ` +
    `the chip and a mono-font id tag — no prose before the card:\n` +
    `    [card://<type>:${args.id}] [N] \`${args.tableId} · ${idTag}\`\n` +
    `Use the EXACT <type> from the row's <document type="..." id="${args.id}"> tag.\n\n` +
    `SURFACE EVERY FIELD PRESENT in the retrieved record — the user already ` +
    `knows the title from the card; the value of Ask is the BODY (description, ` +
    `status, vote counts, dates, linked URLs, …). Walk each non-empty field. ` +
    `Don't invent fields, don't hallucinate values, silently omit absent fields.\n\n` +
    `FORMAT: card+chip+id-tag opener, then ONE framing sentence, then a compact ` +
    `bulleted "**Field** — value" list. Don't restate fields already in the list.`
  )
}

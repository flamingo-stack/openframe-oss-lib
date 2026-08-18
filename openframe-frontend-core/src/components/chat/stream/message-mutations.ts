/**
 * Pure message-mutation kernel for the master chat-stream reducer.
 *
 * These helpers were absorbed from `use-nats-chat-adapter.ts` in Phase 3 of
 * the chat unification — they are the ONE implementation of "apply a stream
 * fragment to a message thread". The reducer (`chat-stream-reducer.ts`) and
 * the cross-side projections (`chat-dialog-store.ts`) both build on them.
 *
 * REFERENTIAL-STABILITY CONTRACT: every helper clones ONLY the touched
 * message object (and the touched segment slot inside it). A value-level
 * no-op — e.g. a replayed duplicate EXECUTED_TOOL whose merge would write
 * identical values — returns the PRIOR references untouched, so React
 * memoization over untouched messages survives redeliveries.
 *
 * Framework-free: no React, no timers.
 */

import type {
  ApprovalBatchExecutionState,
  ChatApprovalStatus,
  MessageSegment,
  ToolExecutionSegment,
  ToolExecutionData,
} from '../types'
import type { UnifiedChatMessage } from '../types/unified-chat-state.types'

export function nextId(role: 'user' | 'assistant'): string {
  // Date.now() + counter sliver keeps ids monotonic even when two
  // messages are produced inside the same ms tick (user + assistant
  // placeholder fire back-to-back from a single sendMessage call).
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Realtime user/direct/system chunks can be replays of rows already on
 * screen. Content-window dedup is the LAST layer (seq-less transports only)
 * — see the layer list in `chat-stream-reducer.ts`.
 */
export const CONTENT_DEDUP_WINDOW = 4
export const SYSTEM_DEDUP_WINDOW = 10

export function hasRecentMessage(
  prev: UnifiedChatMessage[],
  predicate: (message: UnifiedChatMessage) => boolean,
  window: number,
): boolean {
  const start = Math.max(0, prev.length - window)
  for (let i = prev.length - 1; i >= start; i--) {
    if (predicate(prev[i])) return true
  }
  return false
}

/**
 * Replace (or append) the trailing assistant message with the latest
 * accumulated segments.
 */
export function updateTrailingAssistant(
  prev: UnifiedChatMessage[],
  segments: MessageSegment[],
): UnifiedChatMessage[] {
  const last = prev[prev.length - 1]
  if (!last || last.role !== 'assistant') {
    // No placeholder exists — append a fresh assistant message.
    return [
      ...prev,
      {
        id: nextId('assistant'),
        role: 'assistant',
        content: '',
        segments,
      },
    ]
  }
  return [...prev.slice(0, -1), { ...last, segments }]
}

/**
 * Identity of a block that must upsert rather than stack when re-appended,
 * namespaced so two kinds can never collide. `null` for segments that coalesce
 * by adjacency (text/thinking/guide) or are pushed raw. Legacy approval cards
 * share one requestId across an unfolded batch, hence the command in the key.
 *
 * `ticket_escalated` keys on its dialog-scoped ticketId, which is safe HERE
 * (two receipts inside one trailing bubble can only be a redelivery) but is NOT
 * a turn identity — see the deliberate omissions in `turnRequestKeys` and the
 * host's thread-global dedupe.
 */
function upsertKey(seg: MessageSegment): string | null {
  switch (seg.type) {
    case 'approval_batch':
      return `batch:${seg.data.approvalRequestId}`
    case 'approval_request':
      return `req:${seg.data.requestId}:${seg.data.command}`
    case 'escalation_offer':
      return `offer:${seg.data.offerId}`
    case 'ticket_escalated':
      return `escalated:${seg.data.ticketId}`
    case 'ticket_event':
      // The stream sequence is the event's only stable id; a seq-less segment
      // (hydrated history) is pushed raw — `addTicketEvent`'s payload-equality
      // upsert owns that case.
      return seg.streamSeq !== undefined ? `ticket-event:${seg.streamSeq}` : null
    default:
      return null
  }
}

/**
 * Append-mode counterpart of `updateTrailingAssistant` for post-MESSAGE_END
 * continuation fragments (`SegmentsUpdateMetadata.append`). Coalesces
 * trailing fragments of the same type, mirroring the accumulator; block deltas
 * upsert by identity (see `upsertKey`) so a replayed emit stays idempotent.
 */
export function appendToTrailingAssistant(
  prev: UnifiedChatMessage[],
  segments: MessageSegment[],
): UnifiedChatMessage[] {
  if (segments.length === 0) return prev
  const last = prev[prev.length - 1]
  if (!last || last.role !== 'assistant') {
    return [
      ...prev,
      { id: nextId('assistant'), role: 'assistant', content: '', segments },
    ]
  }
  const merged = [...(last.segments ?? [])]
  for (const seg of segments) {
    const tail = merged[merged.length - 1]
    const key = upsertKey(seg)
    if (seg.type === 'text' && tail?.type === 'text') {
      merged[merged.length - 1] = { type: 'text', text: tail.text + seg.text }
    } else if (seg.type === 'thinking' && tail?.type === 'thinking') {
      merged[merged.length - 1] = { type: 'thinking', text: tail.text + seg.text }
    } else if (seg.type === 'guide' && tail?.type === 'guide') {
      merged[merged.length - 1] = { type: 'guide', text: tail.text + seg.text }
    } else if (key) {
      // Block deltas must be IDEMPOTENT: an emit can be seen twice (live plus
      // the JetStream catch-up replay over hydrated history), so upsert on the
      // block's identity instead of raw-appending a duplicate card.
      const idx = merged.findIndex((m) => upsertKey(m) === key)
      if (idx !== -1) merged[idx] = seg
      else merged.push(seg)
    } else {
      // Other non-text segments are pushed RAW on purpose: EXECUTING↔EXECUTED
      // pairing and batch merging are `applyToolExecutionToMessages`'s job
      // (post-END tool chunks never reach this helper — the reducer routes
      // them cross-message). Running the accumulator here would double-apply
      // those rules.
      merged.push(seg)
    }
  }
  return [...prev.slice(0, -1), { ...last, segments: merged }]
}

// =============================================================================
// Segment-projection kernel — shared scaffolding + single-rule predicates
// =============================================================================

/**
 * Map every assistant message's segments through `fn`, preserving the
 * REFERENTIAL-STABILITY CONTRACT in ONE place: `fn` returns the SAME
 * segment reference to signal "unchanged"; untouched messages (and the
 * whole array on a global no-op) keep their prior references. Every
 * segment projection below rides this scaffold instead of re-implementing
 * the changed-flag dance.
 */
function mapSegments(
  prev: UnifiedChatMessage[],
  fn: (s: MessageSegment) => MessageSegment,
): UnifiedChatMessage[] {
  let changed = false
  const next = prev.map((m) => {
    if (m.role !== 'assistant' || !m.segments) return m
    let msgChanged = false
    const segs = m.segments.map((s) => {
      const out = fn(s)
      if (out !== s) msgChanged = true
      return out
    })
    if (!msgChanged) return m
    changed = true
    return { ...m, segments: segs }
  })
  return changed ? next : prev
}

/**
 * THE approval-resolution rule for a single segment — one predicate for
 * both containers (the message-array projections here AND the flat
 * segment list in `MessageSegmentAccumulator.updateApprovalStatus`), so
 * the two paths can never drift:
 *   - `approval_request` matched on `data.requestId` → status flip;
 *   - `approval_batch` anchor (`data.approvalRequestId`, the server's
 *     `batch:<first proposalId>` — never a row id) → status flip;
 *   - `approval_batch` ROW (`toolCalls[].toolExecutionRequestId`) →
 *     tick that row's execution (check on approved, cross otherwise)
 *     without touching the batch status.
 *   - `escalation_offer` matched on `data.offerId` → status flip +
 *     resolver stamp. Escalation offers are backed by the SAME
 *     `ToolApprovalRequest` collection as command approvals, so the two id
 *     spaces are one and a cross-match is impossible.
 * Returns the SAME reference when nothing matched or changed.
 */
export function applyApprovalStatusToSegment(
  s: MessageSegment,
  requestId: string,
  status: ChatApprovalStatus,
  resolvedByName?: string | null,
): MessageSegment {
  if (s.type === 'approval_request' && s.data.requestId === requestId && s.status !== status) {
    return { ...s, status }
  }
  if (s.type === 'escalation_offer') {
    if (s.data.offerId !== requestId) return s
    const nextResolvedBy = resolvedByName ?? s.resolvedByName
    // Status alone is not enough to early-out: the host overlay flips the
    // status first and the persisted row supplies the resolver name after, so
    // bailing on an unchanged status drops the "by {name}" stamp.
    if (s.status === status && nextResolvedBy === s.resolvedByName) return s
    return { ...s, status, resolvedByName: nextResolvedBy }
  }
  if (s.type !== 'approval_batch') return s
  const isAnchor = s.data.approvalRequestId === requestId
  const hasRow = s.data.toolCalls?.some((c) => c.toolExecutionRequestId === requestId)
  if (!isAnchor && !hasRow) return s
  const nextResolvedBy = resolvedByName ?? s.resolvedByName
  const nextExecutions = hasRow
    ? {
        ...(s.data.executions ?? {}),
        [requestId]: { status: 'done' as const, success: status === 'approved' },
      }
    : s.data.executions
  const nextStatus = isAnchor ? status : s.status
  if (
    s.status === nextStatus &&
    nextResolvedBy === s.resolvedByName &&
    nextExecutions === s.data.executions
  ) {
    return s
  }
  return {
    ...s,
    status: nextStatus,
    resolvedByName: nextResolvedBy,
    data: {
      ...s.data,
      ...(nextExecutions ? { executions: nextExecutions } : {}),
    },
  }
}

/**
 * Next state for a batch row's execution slot from a tool-execution
 * chunk — folds the never-downgrade guard (redelivered EXECUTING after
 * EXECUTED landed) and the EXECUTED/EXECUTING ternary into ONE rule
 * shared by the message projection and the accumulator. Returns null
 * for the no-op case (caller keeps prior references).
 */
export function nextBatchExecution(
  prevExec: ApprovalBatchExecutionState | undefined,
  toolData: ToolExecutionData,
): ApprovalBatchExecutionState | null {
  if (toolData.type === 'EXECUTING_TOOL' && prevExec?.status === 'done') return null
  return toolData.type === 'EXECUTED_TOOL'
    ? { status: 'done', result: toolData.result, success: toolData.success }
    : { status: 'executing', result: prevExec?.result, success: prevExec?.success }
}

/** The executions-map triple-spread — one home for the write shape. */
export function withBatchExecution<S extends { data: { executions?: Record<string, ApprovalBatchExecutionState> } }>(
  seg: S,
  execId: string,
  state: ApprovalBatchExecutionState,
): S {
  return {
    ...seg,
    data: { ...seg.data, executions: { ...(seg.data.executions ?? {}), [execId]: state } },
  }
}

/**
 * Flip ONLY an approval_batch segment's status — no execution writes.
 * The click-time optimistic flip uses this instead of
 * `projectApprovalResolutionToMessages` as defense-in-depth: even if a
 * (misbehaving) server emitted a batchId colliding with a row's
 * proposal id, the flip could not pre-tick that row's execution to a
 * false success before its confirm actually ran.
 */
export function projectBatchStatusToMessages(
  prev: UnifiedChatMessage[],
  anchorId: string,
  status: ChatApprovalStatus,
): UnifiedChatMessage[] {
  return mapSegments(prev, (s) => {
    if (s.type !== 'approval_batch') return s
    if (s.data.approvalRequestId !== anchorId || s.status === status) return s
    return { ...s, status }
  })
}

/**
 * Mark ONE batch row's confirm as FAILED (expired proposal, network
 * error): tick its execution icon to the failure cross so the row's
 * loader doesn't spin forever. Batch status is untouched — other rows
 * may still be resolving.
 */
export function projectBatchRowFailureToMessages(
  prev: UnifiedChatMessage[],
  rowRequestId: string,
): UnifiedChatMessage[] {
  return mapSegments(prev, (s) => {
    if (
      s.type !== 'approval_batch' ||
      !s.data.toolCalls?.some((c) => c.toolExecutionRequestId === rowRequestId)
    ) {
      return s
    }
    const existing = s.data.executions?.[rowRequestId]
    if (existing?.status === 'done') return s
    return withBatchExecution(s, rowRequestId, { status: 'done', success: false })
  })
}

/**
 * Upsert a standalone context-compaction segment into the trailing assistant
 * bubble. Compaction emissions arrive as the accumulator's CUMULATIVE array —
 * only the compaction segment itself may be applied, or interleaved
 * continuation text would duplicate. A `completed` segment replaces the last
 * `started` one in place.
 */
export function upsertTrailingCompaction(
  prev: UnifiedChatMessage[],
  segments: MessageSegment[],
): UnifiedChatMessage[] {
  const compaction = [...segments].reverse().find((s) => s.type === 'context_compaction')
  if (!compaction) return prev
  const last = prev[prev.length - 1]
  if (!last || last.role !== 'assistant') {
    return [
      ...prev,
      { id: nextId('assistant'), role: 'assistant', content: '', segments: [compaction] },
    ]
  }
  const existing = last.segments ?? []
  // LAST 'started' segment (not first): with repeated compactions in one
  // bubble the earlier ones are already completed-in-place, so the newest
  // 'started' is the only one this completion can belong to.
  const startedIdx = existing
    .map((s) => s.type === 'context_compaction' && s.status === 'started')
    .lastIndexOf(true)
  const merged =
    startedIdx !== -1
      ? existing.map((s, i) => (i === startedIdx ? compaction : s))
      : [...existing, compaction]
  return [...prev.slice(0, -1), { ...last, segments: merged }]
}

/** Scoped value-compare for the fields a tool merge writes (status/type,
 *  result, success, execId, restored title, parameters). Small objects —
 *  JSON compare for `parameters` keeps a replayed duplicate a no-op even
 *  when the transport rebuilt the object. */
function sameToolData(a: ToolExecutionData, b: ToolExecutionData): boolean {
  return (
    a.type === b.type &&
    a.integratedToolType === b.integratedToolType &&
    a.toolFunction === b.toolFunction &&
    a.toolTitle === b.toolTitle &&
    a.result === b.result &&
    a.success === b.success &&
    a.toolExecutionRequestId === b.toolExecutionRequestId &&
    (a.parameters === b.parameters ||
      JSON.stringify(a.parameters ?? null) === JSON.stringify(b.parameters ?? null))
  )
}

function sameExecutionState(
  a: ApprovalBatchExecutionState | undefined,
  b: ApprovalBatchExecutionState,
): boolean {
  return !!a && a.status === b.status && a.result === b.result && a.success === b.success
}

/**
 * Cross-message tool-execution updater for post-MESSAGE_END tool chunks
 * (approved commands executing after the approval bubble, async batch
 * results). Scans messages from the end:
 *  1) an `approval_batch` whose `toolCalls` contains the execution id →
 *     merge into its `executions` map;
 *  2) a matching `tool_execution` segment (same id, or EXECUTING with the
 *     same tool for legacy id-less backends) → update in place;
 *  3) no match → append the segment to the trailing assistant bubble.
 *
 * A value-level no-op (replayed duplicate) returns `prev` untouched.
 */
export function applyToolExecutionToMessages(
  prev: UnifiedChatMessage[],
  segment: ToolExecutionSegment,
): UnifiedChatMessage[] {
  const merged = mergeToolExecutionIfPresent(prev, segment)
  if (merged !== null) return merged
  return appendToTrailingAssistant(prev, [segment])
}

/**
 * Merge-only variant of `applyToolExecutionToMessages` — the pure projection
 * used for the cross-SIDE fan-out in `chat-dialog-store.ts`. Updates a
 * matching batch slot / tool segment when present; returns `null` when
 * nothing matches (the caller decides whether to append — projections never
 * do, so a tool that belongs to one side only never grows a card on the
 * other).
 */
export function mergeToolExecutionIfPresent(
  prev: UnifiedChatMessage[],
  segment: ToolExecutionSegment,
): UnifiedChatMessage[] | null {
  const toolData = segment.data
  const execId = toolData.toolExecutionRequestId

  for (let i = prev.length - 1; i >= 0; i--) {
    const message = prev[i]
    if (message.role !== 'assistant' || !message.segments) continue

    for (let j = message.segments.length - 1; j >= 0; j--) {
      const seg = message.segments[j]

      if (
        execId &&
        seg.type === 'approval_batch' &&
        seg.data.toolCalls.some((c) => c.toolExecutionRequestId === execId)
      ) {
        const prevExec: ApprovalBatchExecutionState | undefined = seg.data.executions?.[execId]
        // Shared rule (`nextBatchExecution`): folds the never-downgrade
        // guard (JetStream redelivery of EXECUTING after EXECUTED
        // landed — null = matched-with-no-change, caller doesn't append
        // either) and the EXECUTED/EXECUTING ternary.
        const nextExec = nextBatchExecution(prevExec, toolData)
        if (nextExec === null) return prev
        // Value-level no-op (replayed duplicate) → prior references.
        if (sameExecutionState(prevExec, nextExec)) return prev
        const nextSegments = [...message.segments]
        nextSegments[j] = withBatchExecution(seg, execId, nextExec)
        const next = [...prev]
        next[i] = { ...message, segments: nextSegments }
        return next
      }

      if (seg.type === 'tool_execution') {
        // KNOWN LIMIT (id-less chunks only — current backends always send
        // toolExecutionRequestId): the fuzzy fallback pairs only with a
        // segment still EXECUTING, so a replayed id-less EXECUTING/EXECUTED
        // arriving after the pair completed matches nothing and falls to the
        // caller's append (duplicate card). Widening the predicate to
        // EXECUTED twins would instead swallow a LEGITIMATE second run of the
        // same tool — without ids the two are indistinguishable, and losing a
        // real run is worse than a duplicate card on a legacy transport.
        const matches = execId
          ? seg.data.toolExecutionRequestId === execId
          : seg.data.type === 'EXECUTING_TOOL' &&
            seg.data.integratedToolType === toolData.integratedToolType &&
            seg.data.toolFunction === toolData.toolFunction
        if (!matches) continue
        // Never downgrade a completed segment back to EXECUTING (replayed
        // EXECUTING chunk after its EXECUTED already landed).
        if (toolData.type === 'EXECUTING_TOOL' && seg.data.type === 'EXECUTED_TOOL') {
          return prev
        }
        const mergedData: ToolExecutionData = {
          ...toolData,
          toolTitle: toolData.toolTitle ?? seg.data.toolTitle,
          parameters: toolData.parameters || seg.data.parameters,
        }
        // Value-level no-op (replayed duplicate) → prior references.
        if (sameToolData(seg.data, mergedData)) return prev
        const nextSegments = [...message.segments]
        nextSegments[j] = { type: 'tool_execution', data: mergedData }
        const next = [...prev]
        next[i] = { ...message, segments: nextSegments }
        return next
      }
    }
  }

  return null
}

/**
 * Project an approval resolution onto the thread — the ONE rule lives in
 * `applyApprovalStatusToSegment` (shared with the accumulator's flat
 * segment list); this is just its message-array projection via
 * `mapSegments`.
 */
export function projectApprovalResolutionToMessages(
  prev: UnifiedChatMessage[],
  requestId: string,
  status: ChatApprovalStatus,
  resolvedByName?: string | null,
): UnifiedChatMessage[] {
  return mapSegments(prev, (s) =>
    applyApprovalStatusToSegment(s, requestId, status, resolvedByName),
  )
}

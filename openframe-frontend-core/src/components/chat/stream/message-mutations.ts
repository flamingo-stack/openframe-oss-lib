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
 * Append-mode counterpart of `updateTrailingAssistant` for post-MESSAGE_END
 * continuation fragments (`SegmentsUpdateMetadata.append`). Coalesces
 * trailing fragments of the same type, mirroring the accumulator; approval
 * deltas upsert by request id so a replayed emit stays idempotent.
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
    if (seg.type === 'text' && tail?.type === 'text') {
      merged[merged.length - 1] = { type: 'text', text: tail.text + seg.text }
    } else if (seg.type === 'thinking' && tail?.type === 'thinking') {
      merged[merged.length - 1] = { type: 'thinking', text: tail.text + seg.text }
    } else if (seg.type === 'approval_batch') {
      // Approval deltas must be IDEMPOTENT: the escalated-result emit can be
      // seen twice (live + catch-up replay over hydrated history), so upsert
      // by request id instead of raw-appending a duplicate card.
      const idx = merged.findIndex(
        (m) => m.type === 'approval_batch' && m.data.approvalRequestId === seg.data.approvalRequestId,
      )
      if (idx !== -1) merged[idx] = seg
      else merged.push(seg)
    } else if (seg.type === 'approval_request') {
      // Legacy cards share one requestId across an unfolded batch — key on
      // (requestId, command) so each tool's card upserts its own twin.
      const idx = merged.findIndex(
        (m) =>
          m.type === 'approval_request' &&
          m.data.requestId === seg.data.requestId &&
          m.data.command === seg.data.command,
      )
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
        // Never downgrade a done batch slot back to executing (JetStream
        // redelivery of the EXECUTING chunk after EXECUTED landed). Returning
        // prev = matched-with-no-change, so the caller doesn't append either.
        if (toolData.type === 'EXECUTING_TOOL' && prevExec?.status === 'done') {
          return prev
        }
        const nextExec: ApprovalBatchExecutionState =
          toolData.type === 'EXECUTED_TOOL'
            ? { status: 'done', result: toolData.result, success: toolData.success }
            : { status: 'executing', result: prevExec?.result, success: prevExec?.success }
        // Value-level no-op (replayed duplicate) → prior references.
        if (sameExecutionState(prevExec, nextExec)) return prev
        const nextSegments = [...message.segments]
        nextSegments[j] = {
          ...seg,
          data: { ...seg.data, executions: { ...(seg.data.executions ?? {}), [execId]: nextExec } },
        }
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
 * Cross-message approval status flip (absorbed from the NATS adapter's
 * `onApprovalResolved` handler). Idempotent + reference-preserving: only the
 * messages/segments whose status (or resolvedByName) actually changes are
 * cloned; a no-op returns `prev`.
 */
export function projectApprovalResolutionToMessages(
  prev: UnifiedChatMessage[],
  requestId: string,
  status: ChatApprovalStatus,
  resolvedByName?: string | null,
): UnifiedChatMessage[] {
  let changed = false
  const next = prev.map((m) => {
    if (m.role !== 'assistant' || !m.segments) return m
    let msgChanged = false
    const segs = m.segments.map((s) => {
      if (s.type === 'approval_request' && s.data.requestId === requestId && s.status !== status) {
        msgChanged = true
        return { ...s, status }
      }
      if (s.type === 'approval_batch' && s.data.approvalRequestId === requestId) {
        const nextResolvedBy = resolvedByName ?? s.resolvedByName
        if (s.status === status && nextResolvedBy === s.resolvedByName) return s
        msgChanged = true
        return { ...s, status, resolvedByName: nextResolvedBy }
      }
      return s
    })
    if (!msgChanged) return m
    changed = true
    return { ...m, segments: segs }
  })
  return changed ? next : prev
}

/**
 * Phase-3 tests — `createChatDialogStore` cross-side projection.
 *
 * Exactly two operations fan out across sides of the same dialogId:
 * approval-resolution by requestId and tool-execution merge by execId.
 * The projection is recomputed from state (never re-injected into the other
 * side's seq stream), so per-side seq gates stay untouched and replays are
 * idempotent with full referential stability on untouched messages.
 */

import { describe, it, expect } from 'vitest'
import { createChatDialogStore } from '../chat-dialog-store'
import type { ChatStreamEvent } from '../../../../chat-protocol/events'

const DIALOG = 'dlg-1'

const batchApproval = (seq?: number): ChatStreamEvent => ({
  type: 'approval-request',
  requestId: 'req-1',
  approvalType: 'CLIENT',
  toolCalls: [
    {
      toolExecutionRequestId: 'exec-1',
      toolName: 'run_command',
      requiresApproval: true,
      approvalType: 'CLIENT',
      toolCallArguments: null,
    },
  ],
  ...(seq != null ? { seq } : {}),
})

function seedBothSides(store: ReturnType<typeof createChatDialogStore>) {
  // Side A (client view) and side B (technician mirror) both saw the turn
  // with the approval card — each through its OWN seq stream.
  for (const side of ['main', 'observer'] as const) {
    store.apply(DIALOG, side, { type: 'turn-start', seq: 1 })
    store.apply(DIALOG, side, { type: 'text-delta', text: 'needs approval', seq: 2 })
    store.apply(DIALOG, side, batchApproval(3))
    store.apply(DIALOG, side, { type: 'turn-end', seq: 4 })
  }
}

describe('createChatDialogStore — cross-side projection', () => {
  it('(a) a same-id TEXT event on one side does NOT touch the other side', () => {
    const store = createChatDialogStore()
    seedBothSides(store)
    const bBefore = store.getSnapshot(DIALOG, 'observer')

    store.apply(DIALOG, 'main', { type: 'text-delta', text: 'main-only continuation', seq: 5 })

    expect(store.getSnapshot(DIALOG, 'observer')).toBe(bBefore)
    const aTrailing = store.getSnapshot(DIALOG, 'main').messages.at(-1)
    const bTrailing = store.getSnapshot(DIALOG, 'observer').messages.at(-1)
    expect(JSON.stringify(aTrailing)).not.toEqual(JSON.stringify(bTrailing))
  })

  it('(b) approval resolved on side A updates side B matching card (status + resolver)', () => {
    const store = createChatDialogStore()
    seedBothSides(store)

    store.apply(DIALOG, 'main', {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      approvalType: 'CLIENT',
      resolvedByName: 'Alice Client',
      seq: 5,
    })

    for (const side of ['main', 'observer'] as const) {
      const messages = store.getSnapshot(DIALOG, side).messages
      const card = messages
        .flatMap((m) => m.segments ?? [])
        .find((s) => s.type === 'approval_batch')
      expect(card).toBeDefined()
      expect((card as { status?: string }).status).toBe('approved')
      expect((card as { resolvedByName?: string | null }).resolvedByName).toBe('Alice Client')
      // Status map mirrored on both sides so future replays render resolved.
      expect(store.getSnapshot(DIALOG, side).approvalStatuses['req-1']).toBe('approved')
    }
  })

  it('(b2) tool execution on side A merges into side B batch card WITHOUT appending', () => {
    const store = createChatDialogStore()
    seedBothSides(store)
    store.apply(DIALOG, 'main', {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      seq: 5,
    })

    store.apply(DIALOG, 'main', {
      type: 'tool-execution',
      data: {
        type: 'EXECUTED_TOOL',
        integratedToolType: 'SHELL',
        toolFunction: 'run_command',
        result: 'ok',
        success: true,
        toolExecutionRequestId: 'exec-1',
      },
      seq: 6,
    })

    const b = store.getSnapshot(DIALOG, 'observer')
    const bSegments = b.messages.flatMap((m) => m.segments ?? [])
    const batch = bSegments.find((s) => s.type === 'approval_batch')
    expect(
      (batch as { data: { executions?: Record<string, unknown> } }).data.executions,
    ).toEqual({ 'exec-1': { status: 'done', result: 'ok', success: true } })
    // Merge-only projection: no standalone tool card appeared on side B.
    expect(bSegments.filter((s) => s.type === 'tool_execution')).toHaveLength(0)
  })

  it('(c) replaying side A events after the projection: no double-application + Object.is stability on side B untouched messages', () => {
    const store = createChatDialogStore()
    seedBothSides(store)

    const resolve: ChatStreamEvent = {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      approvalType: 'CLIENT',
      resolvedByName: 'Alice Client',
      seq: 5,
    }
    const executedEvent: ChatStreamEvent = {
      type: 'tool-execution',
      data: {
        type: 'EXECUTED_TOOL',
        integratedToolType: 'SHELL',
        toolFunction: 'run_command',
        result: 'ok',
        success: true,
        toolExecutionRequestId: 'exec-1',
      },
      seq: 6,
    }
    store.apply(DIALOG, 'main', resolve)
    store.apply(DIALOG, 'main', executedEvent)

    const aState = store.getSnapshot(DIALOG, 'main')
    const bState = store.getSnapshot(DIALOG, 'observer')
    const bMessages = bState.messages

    // Replay side A's events (reconnect back-fill). Side A drops them via
    // its seq gate; the recomputed projection over side B is a value-level
    // no-op → identical references end-to-end.
    store.apply(DIALOG, 'main', resolve)
    store.apply(DIALOG, 'main', executedEvent)

    expect(store.getSnapshot(DIALOG, 'main')).toBe(aState)
    const bAfter = store.getSnapshot(DIALOG, 'observer')
    expect(bAfter.messages).toBe(bMessages)
    bAfter.messages.forEach((m, i) => expect(m).toBe(bMessages[i]))
    expect(bAfter).toBe(bState)
  })

  it("(c2) the projection never advances the other side's seq gate", () => {
    const store = createChatDialogStore()
    seedBothSides(store)

    // Side A resolves at a HIGH seq…
    store.apply(DIALOG, 'main', {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      seq: 100,
    })
    // …side B's own stream continues at ITS low seq — must still apply.
    store.apply(DIALOG, 'observer', { type: 'text-delta', text: ' b-continues', seq: 5 })
    const bTrailing = store.getSnapshot(DIALOG, 'observer').messages.at(-1)
    const texts = (bTrailing?.segments ?? []).filter((s) => s.type === 'text') as Array<{
      text: string
    }>
    expect(texts.at(-1)?.text).toContain('b-continues')
  })
})

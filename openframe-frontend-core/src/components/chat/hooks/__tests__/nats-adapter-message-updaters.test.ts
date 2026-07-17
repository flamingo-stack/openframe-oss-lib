/**
 * Pure message-updater helpers behind `useNatsChatAdapter`'s realtime
 * callbacks. These guard the post-MESSAGE_END paths that used to corrupt the
 * thread: continuation fragments replacing the whole trailing bubble, tool
 * chunks wiping completed replies, and standalone compaction duplication.
 */

import { describe, it, expect } from 'vitest'
import {
  appendToTrailingAssistant,
  applyToolExecutionToMessages,
  upsertTrailingCompaction,
} from '../use-nats-chat-adapter'
import type { UnifiedChatMessage } from '../../types/unified-chat-state.types'
import type { MessageSegment, ToolExecutionSegment } from '../../types'

const assistant = (id: string, segments: MessageSegment[]): UnifiedChatMessage => ({
  id,
  role: 'assistant',
  content: '',
  segments,
})

const user = (id: string, content: string): UnifiedChatMessage => ({
  id,
  role: 'user',
  content,
})

const executing = (execId?: string, toolFunction = 'run_command'): ToolExecutionSegment => ({
  type: 'tool_execution',
  data: {
    type: 'EXECUTING_TOOL',
    integratedToolType: 'SHELL',
    toolFunction,
    toolTitle: 'Run command',
    ...(execId ? { toolExecutionRequestId: execId } : {}),
  },
})

const executed = (execId?: string, toolFunction = 'run_command'): ToolExecutionSegment => ({
  type: 'tool_execution',
  data: {
    type: 'EXECUTED_TOOL',
    integratedToolType: 'SHELL',
    toolFunction,
    result: 'ok',
    success: true,
    ...(execId ? { toolExecutionRequestId: execId } : {}),
  },
})

describe('appendToTrailingAssistant', () => {
  it('appends into the trailing assistant bubble without dropping prior segments', () => {
    const prev = [
      user('u1', 'hi'),
      assistant('a1', [{ type: 'text', text: 'done. ' }]),
    ]
    const next = appendToTrailingAssistant(prev, [{ type: 'text', text: 'continuing' }])
    expect(next).toHaveLength(2)
    expect(next[1].segments).toEqual([{ type: 'text', text: 'done. continuing' }])
  })

  it('pushes a new segment when types differ instead of merging', () => {
    const prev = [assistant('a1', [{ type: 'text', text: 'answer' }])]
    const next = appendToTrailingAssistant(prev, [{ type: 'thinking', text: 'hmm' }])
    expect(next[0].segments).toEqual([
      { type: 'text', text: 'answer' },
      { type: 'thinking', text: 'hmm' },
    ])
  })

  it('opens a fresh assistant bubble when the thread ends with a user message', () => {
    const prev = [user('u1', 'hi')]
    const next = appendToTrailingAssistant(prev, [{ type: 'text', text: 'reply' }])
    expect(next).toHaveLength(2)
    expect(next[1].role).toBe('assistant')
    expect(next[1].segments).toEqual([{ type: 'text', text: 'reply' }])
  })

  it('returns the input untouched for an empty fragment list', () => {
    const prev = [assistant('a1', [{ type: 'text', text: 'answer' }])]
    expect(appendToTrailingAssistant(prev, [])).toBe(prev)
  })
})

describe('applyToolExecutionToMessages', () => {
  it('replaces a matching EXECUTING segment in place (same bubble intact)', () => {
    const prev = [
      user('u1', 'run it'),
      assistant('a1', [{ type: 'text', text: 'running…' }, executing('exec-1')]),
    ]
    const next = applyToolExecutionToMessages(prev, executed('exec-1'))
    expect(next).toHaveLength(2)
    const segs = next[1].segments!
    expect(segs[0]).toEqual({ type: 'text', text: 'running…' })
    expect(segs[1].type).toBe('tool_execution')
    expect((segs[1] as ToolExecutionSegment).data.type).toBe('EXECUTED_TOOL')
    // toolTitle restored from the EXECUTING twin (backend omits it on EXECUTED)
    expect((segs[1] as ToolExecutionSegment).data.toolTitle).toBe('Run command')
  })

  it('updates a tool in an EARLIER bubble, not just the trailing one', () => {
    const prev = [
      assistant('a1', [executing('exec-1')]),
      assistant('a2', [{ type: 'text', text: 'meanwhile' }]),
    ]
    const next = applyToolExecutionToMessages(prev, executed('exec-1'))
    expect((next[0].segments![0] as ToolExecutionSegment).data.type).toBe('EXECUTED_TOOL')
    expect(next[1].segments).toEqual([{ type: 'text', text: 'meanwhile' }])
  })

  it('merges execution state into an approval_batch containing the exec id', () => {
    const prev: UnifiedChatMessage[] = [
      assistant('a1', [
        {
          type: 'approval_batch',
          data: {
            approvalRequestId: 'req-1',
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
          },
          status: 'approved',
        },
      ]),
    ]
    const next = applyToolExecutionToMessages(prev, executed('exec-1'))
    const batch = next[0].segments![0]
    expect(batch.type).toBe('approval_batch')
    expect((batch as Extract<MessageSegment, { type: 'approval_batch' }>).data.executions).toEqual({
      'exec-1': { status: 'done', result: 'ok', success: true },
    })
  })

  it('appends to the trailing bubble when nothing matches (never replaces content)', () => {
    const prev = [assistant('a1', [{ type: 'text', text: 'full reply' }])]
    const next = applyToolExecutionToMessages(prev, executing('exec-9'))
    const segs = next[0].segments!
    expect(segs).toHaveLength(2)
    expect(segs[0]).toEqual({ type: 'text', text: 'full reply' })
    expect((segs[1] as ToolExecutionSegment).data.toolExecutionRequestId).toBe('exec-9')
  })

  it('never downgrades an EXECUTED segment back to EXECUTING (replayed chunk)', () => {
    const prev = [assistant('a1', [executed('exec-1')])]
    const next = applyToolExecutionToMessages(prev, executing('exec-1'))
    expect(next).toBe(prev)
  })

  it('falls back to (toolType, toolFunction) pairing when no exec id is present', () => {
    const prev = [assistant('a1', [executing(undefined, 'get_devices')])]
    const next = applyToolExecutionToMessages(prev, executed(undefined, 'get_devices'))
    expect((next[0].segments![0] as ToolExecutionSegment).data.type).toBe('EXECUTED_TOOL')
  })
})

describe('upsertTrailingCompaction', () => {
  it('appends a started compaction into the trailing bubble', () => {
    const prev = [assistant('a1', [{ type: 'text', text: 'reply' }])]
    const next = upsertTrailingCompaction(prev, [{ type: 'context_compaction', status: 'started' }])
    expect(next[0].segments).toEqual([
      { type: 'text', text: 'reply' },
      { type: 'context_compaction', status: 'started' },
    ])
  })

  it('replaces the started segment on completion instead of duplicating', () => {
    const prev = [
      assistant('a1', [
        { type: 'text', text: 'reply' },
        { type: 'context_compaction', status: 'started' },
      ]),
    ]
    const next = upsertTrailingCompaction(prev, [
      { type: 'context_compaction', status: 'completed', summary: 'compacted' },
    ])
    expect(next[0].segments).toEqual([
      { type: 'text', text: 'reply' },
      { type: 'context_compaction', status: 'completed', summary: 'compacted' },
    ])
  })

  it('applies ONLY the compaction segment from a cumulative emission', () => {
    const prev = [assistant('a1', [{ type: 'text', text: 'reply' }])]
    // Accumulator emits its whole array — interleaved text must not duplicate.
    const next = upsertTrailingCompaction(prev, [
      { type: 'context_compaction', status: 'completed' },
      { type: 'text', text: 'reply' },
    ])
    expect(next[0].segments).toEqual([
      { type: 'text', text: 'reply' },
      { type: 'context_compaction', status: 'completed' },
    ])
  })
})

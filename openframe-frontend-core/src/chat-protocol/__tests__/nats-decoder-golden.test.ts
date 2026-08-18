/**
 * GOLDEN CHARACTERIZATION TESTS — `decodeNatsChunk`.
 *
 * Pins the NATS chunk → `ChatStreamEvent` mapping for the whole recorded
 * corpus of wire shapes (every MESSAGE_TYPE the decoder handles, plus the
 * malformed/unknown tolerance cases). Retargeted from the deleted
 * `parseChunkToAction` golden suite when the superseded legacy parser was
 * removed — same corpus, now snapshotted against the ONE live decoder.
 *
 * Do NOT "fix" behaviors captured here — they are the recorded baseline.
 */

import { describe, it, expect } from 'vitest'
import type { ChatStreamEvent } from '../events'
import { decodeNatsChunk, guideEventForNats } from '../nats-decoder'

/** Recorded corpus of realistic NATS chunk shapes, keyed by scenario name. */
const CORPUS: Record<string, unknown> = {
  message_start: { type: 'MESSAGE_START' },
  message_end: { type: 'MESSAGE_END' },

  text: { type: 'TEXT', text: 'Hello, ' },
  text_empty_string: { type: 'TEXT', text: '' },
  text_missing_text_field: { type: 'TEXT' },

  thinking: { type: 'THINKING', text: 'Considering options…' },
  thinking_missing_text: { type: 'THINKING' },

  guide: { type: 'GUIDE', text: '## Enroll a device\n1. Open Settings' },
  guide_empty_string: { type: 'GUIDE', text: '' },
  guide_missing_text: { type: 'GUIDE' },

  // GUIDE frames — hub frames the agent re-streams verbatim inside the same
  // chunk type, under `payload`. They cross over by DEFAULT; only the dialog's
  // own accounting and phase stop at the seam. See `guideEventForNats`.
  guide_frame_text_leading: {
    type: 'GUIDE',
    payload: { kind: 'text-leading', text: "I'll look that up in the docs." },
  },
  guide_frame_thinking: {
    type: 'GUIDE',
    payload: { kind: 'thinking-delta', text: 'The user asked about <policies> setup' },
  },
  guide_frame_tool_error: {
    type: 'GUIDE',
    payload: { kind: 'tool_error', message: 'Could not reach HubSpot' },
  },
  // Dropped: would blank the model badge / relabel the turn with the hub's model.
  guide_frame_routing: {
    type: 'GUIDE',
    payload: { kind: 'routing', routedComplexity: 'deep', routedModel: 'claude-x', routedThinkingBudget: 8000 },
  },
  guide_frame_metadata: {
    type: 'GUIDE',
    payload: { model: 'claude-x', modelLabel: 'Guide model', conversationId: 'conv-1' },
  },
  // Dropped: the dialog owns its own phase and token accounting.
  guide_frame_status_thinking: { type: 'GUIDE', payload: { status: 'thinking' } },
  guide_frame_usage_start: { type: 'GUIDE', payload: { kind: 'usage', stage: 'start', input_tokens: 12 } },
  // Crosses over stamped `origin: 'guide'` — the marker that keeps the card
  // inline and sends its buttons to the hub's confirm route.
  guide_frame_approval_request: {
    type: 'GUIDE',
    payload: {
      kind: 'approval_request',
      proposalId: 'prop-1',
      toolName: 'create_ticket',
      title: 'Open a support ticket',
      fields: [{ label: 'Subject', value: 'Agent will not enroll' }],
    },
  },
  guide_frame_approval_batch: {
    type: 'GUIDE',
    payload: {
      kind: 'approval_batch',
      batchId: 'batch:prop-1',
      proposals: [{ proposalId: 'prop-1', toolName: 'create_ticket', title: 'Open a ticket' }],
    },
  },
  guide_frame_decision_resolved: {
    type: 'GUIDE',
    payload: { kind: 'decision_resolved', proposalId: 'prop-1', ok: true, action: 'approved', willAutoContinue: false },
  },
  // Malformed payloads degrade to a no-op, like every other chunk shape.
  guide_frame_payload_not_object: { type: 'GUIDE', payload: 'text-leading' },
  guide_frame_payload_array: { type: 'GUIDE', payload: [{ kind: 'text-leading', text: 'hi' }] },
  guide_frame_payload_empty: { type: 'GUIDE', payload: {} },
  // `text` wins when both are present — the body is what the agent persists.
  guide_frame_text_wins: { type: 'GUIDE', text: 'body', payload: { kind: 'thinking-delta', text: 'ignored' } },
  guide_frame_with_seq: {
    type: 'GUIDE',
    streamSeq: 77,
    payload: { kind: 'text-leading', text: 'Checking the docs…' },
  },

  // ASK — the guide-routing clarification card. `text` is the intro sentence
  // riding the same chunk; a card without a question or without usable options
  // is dropped (nothing the user could answer).
  ask: {
    type: 'ASK',
    text: 'Do you want the OpenFrame docs on scripts, or the scripts in your own workspace?',
    question: 'What do you want to work on?',
    options: [
      { label: 'Find documentation', description: 'How scripting works and how to set it up' },
      { label: 'Your scripts', description: 'List, edit or run the scripts in your workspace' },
    ],
  },
  ask_without_intro: { type: 'ASK', question: 'Which one?', options: [{ label: 'Docs' }] },
  ask_missing_question: { type: 'ASK', options: [{ label: 'Docs' }] },
  ask_blank_question: { type: 'ASK', question: '   ', options: [{ label: 'Docs' }] },
  ask_no_options: { type: 'ASK', question: 'Which one?', options: [] },
  ask_options_not_array: { type: 'ASK', question: 'Which one?', options: 'Docs' },
  ask_unusable_option_rows: {
    type: 'ASK',
    question: 'Which one?',
    options: [{ label: '   ' }, { description: 'no label' }, null, 'Docs'],
  },

  ai_metadata_full: {
    type: 'AI_METADATA',
    modelDisplayName: 'Claude Sonnet',
    modelName: 'claude-sonnet-x',
    providerName: 'anthropic',
    contextWindow: 200000,
  },
  // Legacy field name `provider` (not `providerName`) is accepted.
  ai_metadata_legacy_provider_field: {
    type: 'AI_METADATA',
    modelName: 'gpt-x',
    provider: 'openai',
  },
  ai_metadata_missing_model: { type: 'AI_METADATA', providerName: 'anthropic' },
  ai_metadata_non_numeric_context_window: {
    type: 'AI_METADATA',
    modelName: 'claude-sonnet-x',
    providerName: 'anthropic',
    contextWindow: '200000',
  },

  executing_tool: {
    type: 'EXECUTING_TOOL',
    integratedToolType: 'TACTICAL_RMM',
    toolFunction: 'run_script',
    title: 'Run cleanup script',
    // The card's body line. Carried by EXECUTING only — the EXECUTED chunk
    // never repeats it, so losing it here blanks the tool card for the whole
    // run. Every chunk in this corpus omitted it once, which is how a decoder
    // that silently dropped the field shipped with the goldens still green.
    toolExplanation: 'Discovering columns available in the system_info table for accurate querying.',
    parameters: { script: 'cleanup.sh', timeout: 30 },
    toolExecutionRequestId: 'exec-1',
  },
  executing_tool_minimal: { type: 'EXECUTING_TOOL' },

  executed_tool: {
    type: 'EXECUTED_TOOL',
    integratedToolType: 'TACTICAL_RMM',
    toolFunction: 'run_script',
    parameters: { script: 'cleanup.sh' },
    result: 'Freed 2.3 GB',
    success: true,
    toolExecutionRequestId: 'exec-1',
  },
  executed_tool_failure_no_exec_id: {
    type: 'EXECUTED_TOOL',
    integratedToolType: 'FLEET_MDM',
    toolFunction: 'lock_device',
    result: 'Device unreachable',
    success: false,
  },

  approval_request_single: {
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'req-1',
    approvalType: 'CLIENT',
    command: 'systemctl restart nats',
    explanation: 'Restart the message broker',
  },
  // snake_case id field (approval_request_id) is accepted as a fallback.
  approval_request_snake_case_id: {
    type: 'APPROVAL_REQUEST',
    approval_request_id: 'req-2',
    command: 'rm -rf /tmp/cache',
  },
  approval_request_batch: {
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'batch-1',
    approvalType: 'ADMIN',
    toolCalls: [
      {
        toolExecutionRequestId: 'exec-a',
        toolName: 'create_ticket',
        toolTitle: 'Create ticket',
        toolExplanation: 'Opens a new support ticket',
        toolType: 'WRITE',
        requiresApproval: true,
        approvalType: 'ADMIN',
        toolCallArguments: { subject: 'Printer down' },
      },
      {
        toolExecutionRequestId: 'exec-b',
        toolName: 'read_kb',
        requiresApproval: false,
        approvalType: null,
        toolCallArguments: null,
      },
    ],
  },
  // Malformed entries inside toolCalls are coerced/filtered by normalizeToolCalls.
  approval_request_batch_malformed_entries: {
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'batch-2',
    toolCalls: [
      null,
      'not-an-object',
      { toolName: 42, requiresApproval: 'yes', toolCallArguments: 'nope' },
    ],
  },
  // CHARACTERIZATION: an empty toolCalls array falls back to the SINGLE
  // approval-request shape (batch requires length > 0).
  approval_request_empty_tool_calls: {
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'req-3',
    toolCalls: [],
    command: 'echo hi',
  },

  escalation_offer_pending: {
    type: 'ESCALATION_OFFER',
    offerId: 'offer-1',
    state: 'PENDING',
    text: 'This ticket can be handed off to a technician.',
    origin: 'MANUAL',
  },
  escalation_offer_approved: {
    type: 'ESCALATION_OFFER',
    offerId: 'offer-1',
    state: 'APPROVED',
    displayName: 'John Smith',
  },
  escalation_offer_superseded: {
    type: 'ESCALATION_OFFER',
    offerId: 'offer-1',
    state: 'SUPERSEDED',
    resolvedByName: 'John Smith',
  },
  escalation_offer_unknown_state: { type: 'ESCALATION_OFFER', offerId: 'offer-1', state: 'WAT' },
  escalation_offer_missing_id: { type: 'ESCALATION_OFFER', state: 'PENDING' },

  ticket_escalated: {
    type: 'TICKET_ESCALATED',
    ticketId: 'ticket-1',
    ticketNumber: 1002,
    reason: 'INACTIVITY',
    text: 'Automatically escalated to a human technician.',
  },
  ticket_escalated_missing_reason: { type: 'TICKET_ESCALATED', ticketId: 'ticket-1' },
  ticket_escalated_missing_ticket_id: { type: 'TICKET_ESCALATED', reason: 'INACTIVITY' },

  // TICKET_EVENT — standalone lifecycle receipt. `kind` is an OPEN string:
  // unknown kinds must decode (neutral render), only a missing/blank kind is
  // malformed. The chunk names its JetStream sequence `sequenceId` in the
  // payload; it backfills `seq` when the transport didn't stamp `streamSeq`.
  ticket_event_resolved: {
    type: 'TICKET_EVENT',
    kind: 'RESOLVED',
    actorId: 'fae',
    actorName: 'Fae',
    actorType: 'AI',
    sequenceId: 412,
  },
  ticket_event_reopened_with_reason: {
    type: 'TICKET_EVENT',
    kind: 'REOPENED',
    actorId: 'user-42',
    actorName: 'John Smith',
    actorType: 'CLIENT',
    reason: 'The printer stopped working again',
    sequenceId: 413,
  },
  ticket_event_unknown_kind: { type: 'TICKET_EVENT', kind: 'ON_HOLD', actorName: 'Roman Smith' },
  // Where the ticket reopened INTO - decides the card's subtitle without
  // guessing from the actor. Blank strings are folded to undefined.
  ticket_event_reopened_target_kind: {
    type: 'TICKET_EVENT',
    kind: 'REOPENED',
    actorId: 'user-42',
    actorName: 'John Smith',
    actorType: 'CLIENT',
    targetStatusKind: 'AI_ASSISTANCE',
    streamSeq: 414,
  },
  ticket_event_blank_target_kind_dropped: {
    type: 'TICKET_EVENT',
    kind: 'REOPENED',
    targetStatusKind: '  ',
    streamSeq: 415,
  },
  ticket_event_missing_kind: { type: 'TICKET_EVENT', actorName: 'Fae' },
  ticket_event_blank_reason_dropped: { type: 'TICKET_EVENT', kind: 'RESOLVED', reason: '   ' },
  // Transport-stamped streamSeq wins over the payload's sequenceId copy.
  ticket_event_stream_seq_wins: {
    type: 'TICKET_EVENT',
    kind: 'RESOLVED',
    streamSeq: 500,
    sequenceId: 499,
  },

  approval_result_approved: {
    type: 'APPROVAL_RESULT',
    approvalRequestId: 'req-1',
    approved: true,
    approvalType: 'CLIENT',
    displayName: 'Jane Admin',
  },
  approval_result_rejected_resolved_by_name: {
    type: 'APPROVAL_RESULT',
    approvalRequestId: 'req-1',
    approved: false,
    resolvedByName: 'Bob Tech',
  },
  // CHARACTERIZATION: approved must be === true; any other value → rejected.
  approval_result_truthy_string_approved: {
    type: 'APPROVAL_RESULT',
    approvalRequestId: 'req-9',
    approved: 'true',
  },

  error_full: { type: 'ERROR', error: 'Agent crashed', details: '{"error":{"message":"boom"}}' },
  error_bare: { type: 'ERROR' },

  message_request: {
    type: 'MESSAGE_REQUEST',
    text: 'open a ticket',
    ownerType: 'CLIENT',
    displayName: 'Alice',
    userId: 'user-42',
  },
  message_request_with_context_items: {
    type: 'MESSAGE_REQUEST',
    text: 'diagnose this device',
    contextItems: [
      { type: 'device', id: 'dev-1' },
      { type: 'ticket' }, // missing id → filtered
      { id: 'orphan' }, // missing type → filtered
    ],
  },
  message_request_no_text: { type: 'MESSAGE_REQUEST' },

  token_usage: {
    type: 'TOKEN_USAGE',
    inputTokensSize: 1200,
    outputTokensSize: 340,
    totalTokensSize: 1540,
    contextSize: 180000,
  },
  token_usage_empty_defaults: { type: 'TOKEN_USAGE' },

  context_compaction_start: { type: 'CONTEXT_COMPACTION_START' },
  context_compaction_end: { type: 'CONTEXT_COMPACTION_END', text: 'Compacted 34 messages' },
  context_compaction_end_no_summary: { type: 'CONTEXT_COMPACTION_END' },

  system: { type: 'SYSTEM', text: 'Technician joined the chat' },
  system_no_text: { type: 'SYSTEM' },

  direct_message: {
    type: 'DIRECT_MESSAGE',
    text: 'Hi, human here taking over',
    ownerType: 'ADMIN',
    displayName: 'Jane Admin',
    userId: 'admin-7',
  },
  direct_message_no_text: { type: 'DIRECT_MESSAGE' },

  dialog_closed: { type: 'DIALOG_CLOSED' },

  // ---- Malformed / unknown chunks ------------------------------------
  unknown_type: { type: 'SOMETHING_NEW' },
  missing_type: { text: 'hello' },
  null_chunk: null,
  undefined_chunk: undefined,
  string_chunk: 'TEXT',
  number_chunk: 42,
  empty_object: {},
}

describe('decodeNatsChunk — golden corpus', () => {
  it('maps the full recorded corpus to normalized events (snapshot)', () => {
    const results = Object.fromEntries(
      Object.entries(CORPUS).map(([name, chunk]) => [name, decodeNatsChunk(chunk)]),
    )
    expect(results).toMatchSnapshot()
  })
})

describe('guideEventForNats — the two kernels reconciled', () => {
  // The property that matters for maintenance: `leading-frames` is the ONE
  // place a hub frame kind is taught to the client, so an event kind that
  // reaches this adapter must cross over WITHOUT an edit here. These use event
  // types the frame table cannot produce today on purpose — they stand in for
  // whatever the hub ships next.
  it('passes an unfamiliar event through unchanged', () => {
    const ask: ChatStreamEvent = {
      type: 'ask',
      question: 'Which workspace?',
      options: [{ label: 'Acme' }],
    }
    expect(guideEventForNats(ask)).toEqual(ask)
  })

  it('stamps origin on the events that carry it, so the card routes to the hub', () => {
    expect(
      guideEventForNats({ type: 'approval-request', requestId: 'prop-1', approvalType: 'create_ticket' }),
    ).toMatchObject({ approvalType: 'create_ticket', origin: 'guide' })
    expect(guideEventForNats({ type: 'approval-resolved', requestId: 'prop-1', status: 'approved' })).toMatchObject({
      origin: 'guide',
    })
  })

  it('stops the events the agent owns for this dialog', () => {
    expect(guideEventForNats({ type: 'usage', stage: 'start', input_tokens: 10 })).toBeNull()
    expect(guideEventForNats({ type: 'status', phase: 'thinking' })).toBeNull()
    expect(
      guideEventForNats({ type: 'token-usage', inputTokensSize: 1, outputTokensSize: 2, totalTokensSize: 3, contextSize: 4 }),
    ).toBeNull()
    expect(guideEventForNats({ type: 'dialog-closed' })).toBeNull()
  })

  it('keeps metadata only for the hub conversation id every confirm must quote back', () => {
    expect(guideEventForNats({ type: 'metadata', conversationId: 'conv-1', modelName: 'hub-model' })).toEqual({
      type: 'metadata',
      conversationId: 'conv-1',
      origin: 'guide',
    })
    expect(guideEventForNats({ type: 'metadata', modelName: 'hub-model' })).toBeNull()
  })
})

describe('decodeNatsChunk — seq envelope', () => {
  it('lifts a numeric JetStream `streamSeq` into `seq`, and omits it otherwise (snapshot)', () => {
    expect({
      numeric: decodeNatsChunk({ type: 'TEXT', text: 'hi', streamSeq: 42 }),
      absent: decodeNatsChunk({ type: 'TEXT', text: 'hi' }),
      non_numeric: decodeNatsChunk({ type: 'TEXT', text: 'hi', streamSeq: '42' }),
      zero: decodeNatsChunk({ type: 'MESSAGE_START', streamSeq: 0 }),
    }).toMatchSnapshot()
  })
})

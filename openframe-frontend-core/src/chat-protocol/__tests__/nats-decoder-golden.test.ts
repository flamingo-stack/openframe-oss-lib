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
import { decodeNatsChunk } from '../nats-decoder'

/** Recorded corpus of realistic NATS chunk shapes, keyed by scenario name. */
const CORPUS: Record<string, unknown> = {
  message_start: { type: 'MESSAGE_START' },
  message_end: { type: 'MESSAGE_END' },

  text: { type: 'TEXT', text: 'Hello, ' },
  text_empty_string: { type: 'TEXT', text: '' },
  text_missing_text_field: { type: 'TEXT' },

  thinking: { type: 'THINKING', text: 'Considering options…' },
  thinking_missing_text: { type: 'THINKING' },

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

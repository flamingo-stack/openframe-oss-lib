/**
 * The wire, as data: one fixture per shape the chat protocol states. The conformance test runs them through the real
 * `ai@7.0.159`, and this package's tests run them through its own reader and accumulator, so a shape has one spelling
 * across every suite. Test data: no entry of this package exports it. The Java agent's `RecordKey` holds the same URI
 * vectors in a resource of its own.
 *
 * Pure data. Server-safe: no React, no browser APIs.
 */

import type { WireCommandOverride } from '../components/chat/utils/slash-dispatch-utils';
import type { ChatMessage, ChatPart } from './chat-message';
import type { UiChunk } from './ui-chunks';

// =============================================================================
// The record URI: pinned to the Java agent's `RecordKey` by the same vectors
// =============================================================================

export const RECORD_URI_VECTORS: ReadonlyArray<{ type: string; id: string; href: string }> = [
  { type: 'blog_post', id: '1108', href: 'record://blog_post/1108' },
  { type: 'onboarding_guide', id: 'mac-guide', href: 'record://onboarding_guide/mac-guide' },
  { type: 'markdown', id: 'docs/setup.v2.md', href: 'record://markdown/docs%2Fsetup.v2.md' },
  { type: 'blog', id: 'a slug (draft)', href: 'record://blog/a%20slug%20%28draft%29' },
  { type: 'kbFolder', id: "a/b c(1)!~*'+", href: "record://kbFolder/a%2Fb%20c%281%29!~*'%2B" },
  { type: 'doc', id: 'urn:x:1', href: 'record://doc/urn%3Ax%3A1' },
  { type: 'scheduledScript', id: 'é-ü', href: 'record://scheduledScript/%C3%A9-%C3%BC' },
];

// =============================================================================
// Stored parts and rows
// =============================================================================

export const FIXTURE_BLOG_URI = 'record://blog_post/1108';
export const FIXTURE_BLOG_URL = 'https://www.flamingo.run/blog/openframe-vs-atera';
export const FIXTURE_TICKET_URI = 'record://hubspot_ticket_anon/48582802965';
export const FIXTURE_COLLECTION_URI = 'record://blog_post';
export const FIXTURE_VIDEO_URI = 'record://video/mux-abc';
export const FIXTURE_TASK_URI = 'record://internal_task/86ak';
export const FIXTURE_CONVERSATION_ID = '4539b854-5bc1-4f6e-9a39-6a3f3f2a1c10';
export const FIXTURE_ASSISTANT_ID = '8f6a1f8e-0d1b-4b6d-9a55-1d2c3b4a5f60';
export const FIXTURE_PROPOSAL_ID = 'prop-5f1c';

const BLOG_CITATION_SOURCE = {
  type: 'source',
  sourceType: 'url',
  id: FIXTURE_BLOG_URI,
  url: FIXTURE_BLOG_URL,
  title: 'OpenFrame vs Atera',
} as const;

/** An answer's stored parts: sources lead, then text and cards in stream order. */
export const STORED_ANSWER_PARTS: ChatPart[] = [
  { type: 'source-url', sourceId: FIXTURE_BLOG_URI, url: FIXTURE_BLOG_URL, title: 'OpenFrame vs Atera' },
  {
    type: 'source-document',
    sourceId: FIXTURE_TICKET_URI,
    mediaType: 'text/plain',
    title: 'Agent offline after upgrade',
  },
  { type: 'source-document', sourceId: FIXTURE_COLLECTION_URI, mediaType: 'text/plain', title: 'Blog posts' },
  { type: 'data-record-cards', data: { records: [FIXTURE_BLOG_URI, FIXTURE_VIDEO_URI] } },
  {
    type: 'text',
    text: 'OpenFrame is priced per device. Compare it with [Atera](record://vendor/42).',
    citations: [{ source: BLOG_CITATION_SOURCE, startIndex: 0, endIndex: 31 }],
  },
];

/** A user's stored parts: the text, and a `file` part per attachment on the view proxy. */
export const STORED_USER_PARTS: ChatPart[] = [
  { type: 'text', text: 'whats the next webinar' },
  {
    type: 'file',
    mediaType: 'image/png',
    filename: 'screenshot.png',
    url: 'https://www.flamingo.run/api/storage/view/chat-attachments/chat/2b1f/screenshot.png?t=view-token',
  },
];

export const STORED_RECEIPT_PARTS: ChatPart[] = [
  { type: 'text', text: '✅ Task created.' },
  { type: 'data-record-cards', data: { records: [FIXTURE_TASK_URI] } },
];

/** `chat_messages.parts` of each kind of row, as `GET /api/docs/chat/history` answers it. */
export const HISTORY_RESPONSE: { conversationId: string; found: boolean; messages: ChatMessage[] } = {
  conversationId: FIXTURE_CONVERSATION_ID,
  found: true,
  messages: [
    {
      id: '0d8e7c44-98c4-4a6f-8f7e-5e7f1a2b3c01',
      role: 'user',
      metadata: { seq: 1, createdAt: '2026-11-02T10:00:00Z' },
      parts: STORED_USER_PARTS,
    },
    {
      id: FIXTURE_ASSISTANT_ID,
      role: 'assistant',
      metadata: { seq: 2, createdAt: '2026-11-02T10:00:04Z' },
      parts: STORED_ANSWER_PARTS,
    },
    {
      id: '0d8e7c44-98c4-4a6f-8f7e-5e7f1a2b3c03',
      role: 'assistant',
      metadata: { seq: 3, createdAt: '2026-11-02T10:01:00Z', kind: 'approval_receipt' },
      parts: STORED_RECEIPT_PARTS,
    },
    {
      id: '0d8e7c44-98c4-4a6f-8f7e-5e7f1a2b3c04',
      role: 'assistant',
      metadata: { seq: 4, createdAt: '2026-11-02T10:01:30Z', aborted: true },
      parts: [],
    },
  ],
};

// =============================================================================
// The chat request
// =============================================================================

/** `POST /api/docs/chat`: the last message, the standard's `id`, and extra fields in the transport's `body` option. */
export const CHAT_REQUEST_BODY: { id: string; messages: ChatMessage[]; commandOverride: WireCommandOverride } = {
  id: FIXTURE_CONVERSATION_ID,
  messages: [
    {
      id: 'client-1',
      role: 'user',
      parts: [
        { type: 'text', text: 'whats the next webinar' },
        {
          type: 'file',
          mediaType: 'image/png',
          filename: 'a.png',
          url: '/content/api/storage/view/chat-attachments/chat/2b1f/a.png?t=view-token',
        },
      ],
    },
  ],
  commandOverride: { entityIdFilter: { tableId: 'webinars', id: '1' } },
};

// =============================================================================
// The hub stream
// =============================================================================

const TURN_METADATA: UiChunk = {
  type: 'message-metadata',
  messageMetadata: {
    conversationId: FIXTURE_CONVERSATION_ID,
    model: 'claude-sonnet-5',
    modelLabel: 'Sonnet 5',
    provider: 'anthropic',
    contextWindowMaxTokens: 200000,
    scrollAnchor: 'top',
  },
};

/**
 * A whole answer, every leading chunk included. Wire text splits at the block that has citations and at the card; the
 * stored parts do not split at the first of those.
 */
export const ANSWER_STREAM: UiChunk[] = [
  { type: 'start', messageId: FIXTURE_ASSISTANT_ID },
  TURN_METADATA,
  { type: 'source-url', sourceId: FIXTURE_BLOG_URI, url: FIXTURE_BLOG_URL, title: 'OpenFrame vs Atera' },
  {
    type: 'source-document',
    sourceId: FIXTURE_TICKET_URI,
    mediaType: 'text/plain',
    title: 'Agent offline after upgrade',
  },
  {
    type: 'data-chat-progress',
    id: 'turn-1:searching',
    transient: true,
    data: { stage: 'searching', count: 29, state: 'running' },
  },
  {
    type: 'data-chat-progress',
    id: 'turn-1:searching',
    transient: true,
    data: { stage: 'searching', count: 29, state: 'done' },
  },
  {
    type: 'message-metadata',
    messageMetadata: { routing: { complexity: 'default', model: 'claude-sonnet-5', thinkingBudget: 0 } },
  },
  {
    type: 'message-metadata',
    messageMetadata: { usage: { inputTokens: 1, inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0 } } },
  },
  { type: 'reasoning-start', id: 'r1' },
  { type: 'reasoning-delta', id: 'r1', delta: 'The pricing page states it.' },
  { type: 'reasoning-end', id: 'r1' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'OpenFrame is priced ' },
  { type: 'text-delta', id: 't1', delta: 'per device.' },
  {
    type: 'text-end',
    id: 't1',
    citations: [{ source: BLOG_CITATION_SOURCE, startIndex: 0, endIndex: 31 }],
  },
  { type: 'text-start', id: 't2' },
  { type: 'text-delta', id: 't2', delta: ' Compare it with [Atera](record://vendor/42).\n\n' },
  { type: 'text-end', id: 't2' },
  { type: 'data-record-cards', data: { records: [FIXTURE_BLOG_URI, FIXTURE_VIDEO_URI] } },
  { type: 'text-start', id: 't3' },
  { type: 'text-delta', id: 't3', delta: 'Both are on the pricing page.' },
  { type: 'text-end', id: 't3' },
  {
    type: 'finish',
    finishReason: 'stop',
    messageMetadata: {
      usage: {
        inputTokens: 1200,
        outputTokens: 80,
        totalTokens: 1280,
        inputTokenDetails: { noCacheTokens: 200, cacheReadTokens: 1000, cacheWriteTokens: 0 },
        hit_rate_pct: 83,
        telemetry: { cards: 2, citations: 1, sentences: 3, answerLen: 90 },
        stop_reason: 'end_turn',
      },
    },
  },
];

/** A citation of a table's header block: its collection source arrives at that moment. */
export const COLLECTION_CITATION_STREAM: UiChunk[] = [
  { type: 'start', messageId: 'collection-1' },
  { type: 'source-url', sourceId: FIXTURE_BLOG_URI, url: FIXTURE_BLOG_URL, title: 'OpenFrame vs Atera' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'There are 37 posts.' },
  { type: 'source-document', sourceId: FIXTURE_COLLECTION_URI, mediaType: 'text/plain', title: 'Blog posts' },
  {
    type: 'text-end',
    id: 't1',
    citations: [
      {
        source: {
          type: 'source',
          sourceType: 'document',
          id: FIXTURE_COLLECTION_URI,
          mediaType: 'text/plain',
          title: 'Blog posts',
        },
        startIndex: 0,
        endIndex: 19,
      },
    ],
  },
  { type: 'finish', finishReason: 'stop' },
];

/** One tool failing in a turn that goes on. */
export const TOOL_ERROR_STREAM: UiChunk[] = [
  { type: 'start', messageId: 'tool-error-1' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'Let me look.\n\n' },
  { type: 'text-end', id: 't1' },
  {
    type: 'tool-input-error',
    toolCallId: 'toolu_1',
    toolName: 'update_ticket',
    input: { status: 'CLOSED' },
    dynamic: true,
    errorText: 'That ticket is not yours to change.',
  },
  { type: 'text-start', id: 't2' },
  { type: 'text-delta', id: 't2', delta: 'I could not change it.' },
  { type: 'text-end', id: 't2' },
  { type: 'finish', finishReason: 'stop' },
];

/** A turn-level failure: nothing after `error` reaches a `useChat` client. */
export const TURN_FAILURE_STREAM: UiChunk[] = [
  { type: 'start', messageId: 'failure-1' },
  {
    type: 'message-metadata',
    messageMetadata: { usage: { inputTokens: 0, stop_reason: 'error', stop_detail: 'UPSTREAM_BUSY' } },
  },
  { type: 'error', errorText: 'Something went wrong while answering. Please try again.' },
];

export const ABORT_STREAM: UiChunk[] = [
  { type: 'start', messageId: 'abort-1' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'A partial answ' },
  { type: 'text-end', id: 't1' },
  { type: 'message-metadata', messageMetadata: { usage: { inputTokens: 900, stop_reason: 'timeout' } } },
  { type: 'abort', reason: 'timeout' },
];

const APPROVAL_FIELDS = [{ label: 'Subject', value: 'Agent offline after upgrade' }];

/** A turn that ends on an approval card, with its preamble live. */
export const APPROVAL_STREAM: UiChunk[] = [
  { type: 'start', messageId: FIXTURE_ASSISTANT_ID },
  TURN_METADATA,
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'I can close that ticket.' },
  { type: 'text-end', id: 't1' },
  {
    type: 'tool-input-available',
    toolCallId: FIXTURE_PROPOSAL_ID,
    toolName: 'update_ticket',
    input: { ticket_id: '4858', status: 'CLOSED' },
    dynamic: true,
    title: 'Close ticket',
  },
  {
    type: 'tool-approval-request',
    approvalId: FIXTURE_PROPOSAL_ID,
    toolCallId: FIXTURE_PROPOSAL_ID,
    reason: 'You asked to close it.',
    approvalDescriptor: { fields: APPROVAL_FIELDS, expiresAt: '2026-11-02T10:10:00Z', ttlSeconds: 600 },
  },
  { type: 'finish', finishReason: 'tool-calls' },
];

/** One turn's several proposals: one pair each, one `batchId`. The batch's anchor is never a row's id. */
export const APPROVAL_BATCH_STREAM: UiChunk[] = [
  { type: 'start', messageId: 'batch-1' },
  {
    type: 'tool-input-available',
    toolCallId: 'prop-a',
    toolName: 'delete_task',
    input: { id: 'a' },
    dynamic: true,
    title: 'Delete task A',
  },
  {
    type: 'tool-approval-request',
    approvalId: 'prop-a',
    toolCallId: 'prop-a',
    approvalDescriptor: { batchId: 'batch:prop-a' },
  },
  {
    type: 'tool-input-available',
    toolCallId: 'prop-b',
    toolName: 'delete_task',
    input: { id: 'b' },
    dynamic: true,
    title: 'Delete task B',
  },
  {
    type: 'tool-approval-request',
    approvalId: 'prop-b',
    toolCallId: 'prop-b',
    approvalDescriptor: { batchId: 'batch:prop-a' },
  },
  { type: 'finish', finishReason: 'tool-calls' },
];

// =============================================================================
// The approval round trip
// =============================================================================

/** The message holding the card, as the client holds it after the person approved. */
export const APPROVAL_CARD_MESSAGE: ChatMessage = {
  id: FIXTURE_ASSISTANT_ID,
  role: 'assistant',
  parts: [
    { type: 'text', text: 'I can close that ticket.' },
    {
      type: 'dynamic-tool',
      toolName: 'update_ticket',
      toolCallId: FIXTURE_PROPOSAL_ID,
      title: 'Close ticket',
      state: 'approval-responded',
      input: { ticket_id: '4858', status: 'CLOSED' },
      approval: { id: FIXTURE_PROPOSAL_ID, approved: true },
    },
  ],
};

/** The request of an approval: only the last message, its approval parts responded. */
export const APPROVAL_REQUEST_BODY: { id: string; trigger: 'submit-message'; messages: ChatMessage[] } = {
  id: FIXTURE_CONVERSATION_ID,
  trigger: 'submit-message',
  messages: [
    {
      id: FIXTURE_ASSISTANT_ID,
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolName: 'update_ticket',
          toolCallId: FIXTURE_PROPOSAL_ID,
          state: 'approval-responded',
          input: { ticket_id: '4858', status: 'CLOSED' },
          approval: { id: FIXTURE_PROPOSAL_ID, approved: true },
        },
      ],
    },
  ],
};

/** The response: it continues the card's message, so its `start` names no message. */
export const APPROVAL_RESPONSE_STREAM: UiChunk[] = [
  { type: 'start' },
  {
    type: 'tool-output-available',
    toolCallId: FIXTURE_PROPOSAL_ID,
    dynamic: true,
    output: { ticket_id: '4858', status: 'CLOSED' },
  },
  { type: 'text-start', id: 'receipt-1' },
  { type: 'text-delta', id: 'receipt-1', delta: '✅ Ticket closed.\n\n' },
  { type: 'text-end', id: 'receipt-1' },
  { type: 'data-record-cards', data: { records: ['record://hubspot_ticket/4858'] } },
  { type: 'message-metadata', messageMetadata: { willAutoContinue: true } },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'Anything else on it?' },
  { type: 'text-end', id: 't1' },
  { type: 'finish', finishReason: 'stop' },
];

/** A reject: the same stream, nothing executed and no continuation. */
export const APPROVAL_REJECT_STREAM: UiChunk[] = [
  { type: 'start' },
  { type: 'tool-output-denied', toolCallId: FIXTURE_PROPOSAL_ID },
  { type: 'message-metadata', messageMetadata: { willAutoContinue: false } },
  { type: 'finish', finishReason: 'stop' },
];

/** A proposal the server refuses: an error on its part, status 200, so a batch's other rows proceed. */
export const APPROVAL_REFUSED_STREAM: UiChunk[] = [
  { type: 'start' },
  {
    type: 'tool-output-error',
    toolCallId: FIXTURE_PROPOSAL_ID,
    dynamic: true,
    errorText: 'This approval expired, ask again to get a fresh one.',
  },
  { type: 'message-metadata', messageMetadata: { willAutoContinue: false } },
  { type: 'finish', finishReason: 'stop' },
];

/** Every whole stream that opens with its own message. */
export const NEW_MESSAGE_STREAMS: Readonly<Record<string, UiChunk[]>> = {
  answer: ANSWER_STREAM,
  collectionCitation: COLLECTION_CITATION_STREAM,
  toolError: TOOL_ERROR_STREAM,
  abort: ABORT_STREAM,
  approval: APPROVAL_STREAM,
  approvalBatch: APPROVAL_BATCH_STREAM,
};

/** Every whole stream that continues the message holding the card. */
export const CARD_MESSAGE_STREAMS: Readonly<Record<string, UiChunk[]>> = {
  approvalResponse: APPROVAL_RESPONSE_STREAM,
  approvalReject: APPROVAL_REJECT_STREAM,
  approvalRefused: APPROVAL_REFUSED_STREAM,
};

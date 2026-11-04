/**
 * GOLDEN CHARACTERIZATION: what a wire says, and what the thread holds after it, through the one decoder and the reducer.
 *
 * Each case feeds Mingo chunks the way the adapter does and records the reducer's state. The snapshots are the spec of the
 * thread (parts, order, phase, known statuses, usage). Ids a run mints and clock times are normalised, so a snapshot differs
 * only when behaviour does. Do NOT "fix" behaviours captured here without reading the diff.
 */

import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../../chat-protocol/message-decoder';
import { createChatStreamReducer, type ChatStreamReducer, type ChatStreamReducerOptions } from '../chat-stream-reducer';

function setup(options: ChatStreamReducerOptions = {}) {
  const reducer: ChatStreamReducer = createChatStreamReducer(options);
  let decoder = createMingoDecoder();
  const feed = (chunks: unknown[]) => {
    for (const chunk of chunks) reducer.apply(decoder.decode(chunk));
  };
  const reset = () => {
    reducer.reset();
    decoder = createMingoDecoder();
  };
  return { reducer, feed, reset };
}

/** Replace what a run mints: message and wire ids, and the time a row was first seen. */
function thread(reducer: ChatStreamReducer): unknown {
  const { messages, streamingPhase, dialogTokenUsage, liveModel, approvalStatuses } = reducer.state;
  const names = new Map<string, string>();
  const named = (id: string): string => {
    if (!/\d{13}|[a-z0-9]{8,}$/.test(id) || /^(stream|compaction)-\d{1,6}$/.test(id)) return id;
    const known = names.get(id);
    if (known) return known;
    const name = `<id-${names.size + 1}>`;
    names.set(id, name);
    return name;
  };
  const stable = (message: ChatMessage): ChatMessage => ({
    ...message,
    id: named(message.id),
    ...(message.metadata
      ? {
          metadata: {
            ...message.metadata,
            ...(message.metadata.createdAt ? { createdAt: '<time>' } : {}),
          },
        }
      : {}),
  });
  const body = JSON.stringify({
    messages: messages.map(stable),
    streamingPhase,
    dialogTokenUsage,
    liveModel,
    approvalStatuses,
  })
    // A time inside a part (an execution's, a card's): the clock's, never the wire's.
    .replace(/"(startedAt|finishedAt|createdAt)":"\d{4}-\d{2}-\d{2}T[^"]+"/g, '"$1":"<time>"');
  return JSON.parse(body);
}

const EXECUTING = {
  type: 'EXECUTING_TOOL',
  integratedToolType: 'TACTICAL_RMM',
  toolFunction: 'run_script',
  title: 'Run cleanup script',
  parameters: { script: 'cleanup.sh' },
  toolExecutionRequestId: 'exec-1',
};
const EXECUTED = {
  type: 'EXECUTED_TOOL',
  integratedToolType: 'TACTICAL_RMM',
  toolFunction: 'run_script',
  result: 'Freed 2.3 GB',
  success: true,
  toolExecutionRequestId: 'exec-1',
};

describe('chat stream reducer — what the thread holds after a wire', () => {
  it('normal turn: start → metadata → text ×3 → token usage → end', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'AI_METADATA',
        modelDisplayName: 'Claude Sonnet',
        modelName: 'claude-sonnet-x',
        providerName: 'anthropic',
        contextWindow: 200000,
      },
      { type: 'TEXT', text: 'Hello' },
      { type: 'TEXT', text: ', ' },
      { type: 'TEXT', text: 'world' },
      {
        type: 'TOKEN_USAGE',
        inputTokensSize: 100,
        outputTokensSize: 20,
        totalTokensSize: 120,
        contextSize: 180000,
      },
      { type: 'MESSAGE_END' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('streamSeq on content chunks reaches the message it built', () => {
    const { reducer, feed } = setup();
    feed([{ type: 'MESSAGE_START' }, { type: 'TEXT', text: 'seq-stamped', streamSeq: 7 }, { type: 'MESSAGE_END' }]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('cold start (no MESSAGE_START ever): text opens the first message', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'TEXT', text: 'cold ' },
      { type: 'TEXT', text: 'start' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('post-MESSAGE_END continuation: text and thinking extend the finished message', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'in-stream' },
      { type: 'MESSAGE_END' },
      { type: 'TEXT', text: 'post-end text' },
      { type: 'THINKING', text: 'post-end thinking' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('tool execution OUTSIDE a message window: the agent is busy, and the result lands on the row', () => {
    const { reducer, feed } = setup();
    // No MESSAGE_START — approved commands execute between the approval
    // bubble's MESSAGE_END and the continuation stream.
    feed([EXECUTING]);
    expect(reducer.state.streamingPhase).toBe('thinking');
    feed([EXECUTED]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('tool execution IN-stream: a row in the message, then its result', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'Running now. ' },
      EXECUTING,
      EXECUTED,
      { type: 'MESSAGE_END' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('approval request → approval result: the card flips where it stands, with who resolved it', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'CLIENT',
        toolCalls: [
          {
            toolExecutionRequestId: 'req-1',
            toolName: 'run_command',
            toolTitle: 'systemctl restart nats',
            toolExplanation: 'Restart the broker',
            requiresApproval: true,
          },
        ],
      },
      { type: 'MESSAGE_END' },
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-1',
        approved: true,
        approvalType: 'CLIENT',
        displayName: 'Jane Admin',
      },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('a rejected approval is denied, inside the open turn', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'CLIENT',
        toolCalls: [
          { toolExecutionRequestId: 'req-1', toolName: 'run_command', toolTitle: 'reboot', requiresApproval: true },
        ],
      },
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-1',
        approved: false,
        approvalType: 'CLIENT',
      },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('an approval of a tier this side does not answer stays in the message, with its tier', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-adm',
        approvalType: 'ADMIN',
        toolCalls: [
          {
            toolExecutionRequestId: 'req-adm',
            toolName: 'run_command',
            toolTitle: 'drop database prod',
            requiresApproval: true,
          },
        ],
      },
      { type: 'MESSAGE_END' },
    ]);
    const pending = thread(reducer);
    feed([
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-adm',
        approved: true,
        approvalType: 'ADMIN',
      },
    ]);
    expect({ pending, resolved: thread(reducer) }).toMatchSnapshot();
  });

  it('batch approval: one row per tool on one batch, executions merge into them', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'batch-1',
        approvalType: 'CLIENT',
        toolCalls: [
          {
            toolExecutionRequestId: 'exec-a',
            toolName: 'create_ticket',
            toolTitle: 'Create ticket',
            requiresApproval: true,
            approvalType: 'CLIENT',
            toolCallArguments: { subject: 'Printer down' },
          },
          {
            toolExecutionRequestId: 'exec-b',
            toolName: 'read_kb',
            requiresApproval: false,
          },
        ],
      },
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'batch-1',
        approved: true,
        displayName: 'Alice Client',
      },
      {
        type: 'EXECUTING_TOOL',
        integratedToolType: 'PSA',
        toolFunction: 'create_ticket',
        toolExecutionRequestId: 'exec-a',
      },
      {
        type: 'EXECUTED_TOOL',
        integratedToolType: 'PSA',
        toolFunction: 'create_ticket',
        result: 'Ticket #77 created',
        success: true,
        toolExecutionRequestId: 'exec-a',
      },
      { type: 'MESSAGE_END' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('duplicate / out-of-order: a redelivered EXECUTING after EXECUTED neither adds a row nor downgrades the result', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      EXECUTING,
      EXECUTED,
      EXECUTING, // redelivered
      { type: 'MESSAGE_END' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('error chunks: drawn in the message, with the message a JSON detail names', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'partial' },
      { type: 'ERROR', error: 'Agent crashed', details: '{"error":{"message":"boom"}}' },
      { type: 'ERROR', error: 'Plain details', details: 'not-json' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('user echo / system / direct-message / dialog-closed routing', () => {
    const { reducer, feed } = setup();
    feed([
      {
        type: 'MESSAGE_REQUEST',
        text: 'open a ticket',
        ownerType: 'CLIENT',
        displayName: 'Alice',
        userId: 'user-42',
        streamSeq: 3,
        contextItems: [{ type: 'device', id: 'dev-1' }],
      },
      { type: 'SYSTEM', text: 'User joined the chat', streamSeq: 4 },
      {
        type: 'DIRECT_MESSAGE',
        text: 'Human here now',
        ownerType: 'ADMIN',
        displayName: 'Jane Admin',
        userId: 'admin-7',
        streamSeq: 5,
      },
      { type: 'DIALOG_CLOSED' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('direct-mode barrier: after a DIRECT_MESSAGE, AI chunks are dropped with a one-shot teardown', () => {
    const { reducer, feed } = setup();
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'ai text before takeover' },
      { type: 'DIRECT_MESSAGE', text: 'Human takeover', ownerType: 'ADMIN' },
      // AI chunks now dropped; the first one tears the turn down.
      { type: 'TEXT', text: 'dropped ai text' },
      { type: 'TEXT', text: 'also dropped' },
      // Allowlisted chunks still flow.
      { type: 'SYSTEM', text: 'still visible' },
      { type: 'DIRECT_MESSAGE', text: 'second human message' },
    ]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('context compaction, outside a stream and inside one', () => {
    const { reducer, feed, reset } = setup();
    feed([
      // standalone (no open stream)
      { type: 'CONTEXT_COMPACTION_START' },
      { type: 'CONTEXT_COMPACTION_END', text: 'Summarized 12 messages' },
    ]);
    const standalone = thread(reducer);
    reset();
    feed([
      { type: 'MESSAGE_START' },
      { type: 'CONTEXT_COMPACTION_START' },
      { type: 'CONTEXT_COMPACTION_END', text: 'Mid-stream summary' },
      { type: 'MESSAGE_END' },
    ]);
    expect({ standalone, inStream: thread(reducer) }).toMatchSnapshot();
  });

  it('reset() clears everything so the next dialog cold-starts', () => {
    const { reducer, feed, reset } = setup();
    feed([{ type: 'MESSAGE_START' }, { type: 'TEXT', text: 'dialog one' }, { type: 'MESSAGE_END' }]);
    reset();
    feed([{ type: 'TEXT', text: 'dialog two cold start' }]);
    expect(thread(reducer)).toMatchSnapshot();
  });

  it('a restored partial message: continuation chunks extend it', () => {
    const { reducer, feed } = setup();
    reducer.initializeWithState([
      { id: 'restored', role: 'assistant', parts: [{ type: 'text', text: 'restored partial ' }] },
    ]);
    feed([{ type: 'TEXT', text: 'and the rest' }]);
    expect(thread(reducer)).toMatchSnapshot();
  });
});

import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatPart, ChatToolPart } from '../../../../chat-protocol/chat-message';
import { extractIncompleteTailState } from '../extract-incomplete-message-state';

/**
 * `agentBusy` is the restore-time counterpart of a live busy signal: after a
 * reload nothing on the wire re-establishes the activity indicator, so it has
 * to be derived from the persisted tail. The distinction it draws is the whole
 * point — an unfinished turn can be unfinished because the AGENT is working, or
 * because it is BLOCKED ON THE USER, and only the first should spin.
 */

const assistant = (...parts: ChatPart[]): ChatMessage => ({ id: 'a1', role: 'assistant', parts });

const user = (): ChatMessage => ({ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'go' }] });

const text = (said: string): ChatPart => ({ type: 'text', text: said });

const base = { type: 'dynamic-tool', toolName: 'run', input: {} } as const;

/** A row of a batch, by how far it got. */
const row = (toolCallId: string, state: 'pending' | 'approved' | 'running' | 'done' | 'denied'): ChatToolPart => {
  const asked = { id: toolCallId, descriptor: { batchId: 'req-1' } };
  switch (state) {
    case 'pending':
      return { ...base, toolCallId, state: 'approval-requested', approval: asked };
    case 'approved':
      return { ...base, toolCallId, state: 'approval-responded', approval: { ...asked, approved: true } };
    case 'running':
      return { ...base, toolCallId, state: 'input-available', toolMetadata: { batchId: 'req-1' } };
    case 'done':
      return { ...base, toolCallId, state: 'output-available', output: 'ok', approval: { ...asked, approved: true } };
    default:
      return { ...base, toolCallId, state: 'output-denied', approval: { ...asked, approved: false } };
  }
};

/** A single request: no batch, no run of its own. */
const request = (state: 'pending' | 'approved'): ChatToolPart =>
  state === 'pending'
    ? { ...base, toolCallId: 'req-2', state: 'approval-requested', approval: { id: 'req-2' } }
    : { ...base, toolCallId: 'req-2', state: 'approval-responded', approval: { id: 'req-2', approved: true } };

const running = (): ChatToolPart => ({ ...base, toolCallId: 'exec-9', state: 'input-available' });

describe('extractIncompleteTailState → agentBusy', () => {
  it('is set for an APPROVED batch whose tool calls are still running', () => {
    // The reported case: the operator approves a batch, reloads, and the thread
    // renders as if nothing were happening.
    const extras = extractIncompleteTailState([
      user(),
      assistant(row('exec-1', 'approved'), row('exec-2', 'approved')),
    ]);
    expect(extras?.agentBusy).toBe(true);
  });

  it('is NOT set while the batch is still awaiting the user, a row with no gate of its own included', () => {
    const extras = extractIncompleteTailState([user(), assistant(row('exec-1', 'pending'), row('exec-2', 'running'))]);
    expect(extras).toBeDefined();
    expect(extras?.agentBusy).toBeUndefined();
  });

  it('a row with no gate of its own is working once its batch is answered', () => {
    const extras = extractIncompleteTailState([user(), assistant(row('exec-1', 'approved'), row('exec-2', 'running'))]);
    expect(extras?.agentBusy).toBe(true);
  });

  it('nor does a denied batch spin: its rows never ran', () => {
    const extras = extractIncompleteTailState([user(), assistant(row('exec-1', 'denied'), row('exec-2', 'running'))]);
    expect(extras).toBeUndefined();
  });

  it('is NOT set once every call in the batch is done', () => {
    const extras = extractIncompleteTailState([user(), assistant(row('exec-1', 'done'), row('exec-2', 'done'))]);
    expect(extras).toBeUndefined();
  });

  it('is set for a trailing APPROVED single request (nothing produced since)', () => {
    const extras = extractIncompleteTailState([user(), assistant(request('approved'))]);
    expect(extras?.agentBusy).toBe(true);
  });

  it('is NOT set when work already followed the approved request', () => {
    // Position is the only signal for a single request: work after it means the
    // agent came back. Here that work is itself finished.
    const extras = extractIncompleteTailState([
      user(),
      assistant(request('approved'), text('done, 2 endpoints online')),
    ]);
    expect(extras).toBeUndefined();
  });

  it('a pending request leaves the turn unfinished with nothing running', () => {
    const extras = extractIncompleteTailState([user(), assistant(request('pending'))]);
    expect(extras).toEqual({});
  });

  it('is set for a tool left mid-flight', () => {
    const extras = extractIncompleteTailState([user(), assistant(running())]);
    expect(extras?.agentBusy).toBe(true);
  });

  it('is set for an open compaction (the agent’s own work)', () => {
    const extras = extractIncompleteTailState([
      user(),
      assistant({ type: 'data-context-compaction', id: 'c1', data: { status: 'started' } }),
    ]);
    expect(extras?.agentBusy).toBe(true);
  });

  it('a pending escalation offer is unfinished, and nothing is running', () => {
    const extras = extractIncompleteTailState([
      user(),
      assistant({ type: 'data-escalation-offer', id: 'o1', data: { text: 'Hand off?', status: 'pending' } }),
    ]);
    expect(extras).toEqual({});
  });

  it('reads the whole trailing assistant run: the unfinished part can sit in an earlier bubble', () => {
    const extras = extractIncompleteTailState([
      user(),
      assistant(running()),
      { id: 'a2', role: 'assistant', parts: [text('still going')] },
    ]);
    expect(extras?.agentBusy).toBe(true);
  });

  it('reports nothing for a finished tail, or one the user closed', () => {
    expect(extractIncompleteTailState([user(), assistant(text('all good'))])).toBeUndefined();
    expect(extractIncompleteTailState([assistant(running()), user()])).toBeUndefined();
  });
});

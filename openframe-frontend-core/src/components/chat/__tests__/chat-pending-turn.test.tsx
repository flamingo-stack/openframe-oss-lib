/**
 * Pending-turn + hidden-row contracts.
 *
 * Two reader-visible defects this pins against:
 *
 *  1. Approving a tool call minted an author-label row with NO body
 *     ("Michael Assraf:" then nothing). The approval decision is
 *     out-of-band metadata, so the reducer must not materialize a user
 *     row for it at all — fixing it at render would leave dead state.
 *  2. While the model was thinking, the transcript showed a second,
 *     empty "Mingo:" row ABOVE the footer progress indicator — two
 *     owners for one pending turn, and an `aria-live` log announcing a
 *     bare "Mingo". Exactly one affordance must be present.
 *
 * Plus the two idioms that must SURVIVE both fixes: a hidden row that
 * carries real text (auto-continuation directive) stays in state while
 * never rendering, and the SYSTEM name-only row still renders.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatPart } from '../../../chat-protocol/chat-message';
import { createChatStreamReducer } from '../stream/chat-stream-reducer';
import {
  AUTO_CONTINUATION_DIRECTIVE_PREFIX,
  buildAutoContinuationDirective,
} from '../utils/auto-continuation-directive';

// ─── Render harness (mirrors chat-message-list.test.tsx) ────────────────────

const scrollToBottom = vi.fn();
const stopScroll = vi.fn();

function makeRef() {
  const fn = ((el: HTMLElement | null) => {
    (fn as { current: HTMLElement | null }).current = el;
  }) as ((el: HTMLElement | null) => void) & { current: HTMLElement | null };
  fn.current = null;
  return fn;
}

vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: () => ({
    scrollRef: makeRef(),
    contentRef: makeRef(),
    scrollToBottom,
    stopScroll,
  }),
}));

// Row stub that renders the author label the way the real component does
// (`Name:`), so "labeled row with no body" is directly assertable.
vi.mock('../chat-message-enhanced', () => ({
  ChatMessageEnhanced: ({ name, parts }: { name?: string; parts: ChatPart[] }) => (
    <div data-testid="row">
      <span data-testid="row-name">{name ?? ''}</span>
      <span data-testid="row-body">{parts.map(part => (part.type === 'text' ? part.text : '[part]')).join('')}</span>
    </div>
  ),
}));

import { ChatMessageList } from '../chat-message-list';

const row = (id: string, role: ChatMessage['role'], name: string, text: string): ChatMessage => ({
  id,
  role,
  metadata: { author: { name } },
  parts: [{ type: 'text', text }],
});

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', ObserverStub);
vi.stubGlobal('ResizeObserver', ObserverStub);

const names = () => screen.queryAllByTestId('row-name').map(n => n.textContent);
const bodies = () => screen.queryAllByTestId('row-body').map(n => n.textContent);

// ─── State-level contracts ─────────────────────────────────────────────────

describe('approval sends mint no visible user row', () => {
  it('beginSseSend with empty text pushes only the assistant placeholder', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: '', hidden: true });

    expect(r.state.messages).toHaveLength(1);
    expect(r.state.messages[0].role).toBe('assistant');
    expect(r.state.messages.some(m => m.role === 'user')).toBe(false);
    expect(r.state.streamingPhase).toBe('thinking');
  });

  it('pushOptimisticSend with empty text likewise mints no user row', () => {
    const r = createChatStreamReducer();
    r.pushOptimisticSend('', true);

    expect(r.state.messages).toHaveLength(1);
    expect(r.state.messages[0].role).toBe('assistant');
  });

  it('a normal send still mints the user row', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'hello' });

    expect(r.state.messages).toHaveLength(2);
    expect(r.state.messages[0]).toMatchObject({ role: 'user', parts: [{ type: 'text', text: 'hello' }] });
    expect(r.state.messages[0].metadata?.hidden).toBeUndefined();
  });
});

describe('hidden rows that carry text', () => {
  it('an auto-continuation directive IS state (the model sees it) but is flagged hidden', () => {
    const directive = buildAutoContinuationDirective('create_ticket', { ticketId: '42' });
    expect(directive.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX)).toBe(true);

    const r = createChatStreamReducer();
    r.beginSseSend({ text: directive, hidden: true });

    const userRow = r.state.messages.find(m => m.role === 'user');
    expect(userRow?.parts).toEqual([{ type: 'text', text: directive }]);
    expect(userRow?.metadata?.hidden).toBe(true);
  });

  it('never renders — the raw directive text must not reach the transcript', () => {
    const directive = buildAutoContinuationDirective('create_ticket', { ticketId: '42' });
    const messages: ChatMessage[] = [
      row('u1', 'user', 'Michael Assraf', 'my laptop is dead'),
      { ...row('h1', 'user', 'Michael Assraf', directive), metadata: { hidden: true } },
      row('a1', 'assistant', 'Mingo', 'Opened a ticket.'),
    ];
    const { container } = render(<ChatMessageList dialogId="d" messages={messages} />);

    expect(container.textContent).not.toContain(AUTO_CONTINUATION_DIRECTIVE_PREFIX);
    expect(bodies()).toEqual(['my laptop is dead', 'Opened a ticket.']);
  });
});

// ─── Render-level contracts ────────────────────────────────────────────────

describe('a thinking turn has exactly ONE pending affordance', () => {
  const pending: ChatMessage[] = [
    row('u1', 'user', 'Michael Assraf', 'what is broken?'),
    // Parts of nothing the body draws ARE the empty pending turn.
    { id: 'a1', role: 'assistant', metadata: { author: { name: 'Mingo' } }, parts: [] },
  ];

  it('does not render the empty labeled assistant row while typing', () => {
    render(<ChatMessageList dialogId="d" messages={pending} isTyping />);
    // The bare "Mingo" label must be gone from the transcript entirely —
    // removed from the DOM, not visually hidden (the list is an aria-live
    // log; a zero-height node would still be announced).
    expect(names()).toEqual(['Michael Assraf']);
    expect(bodies()).toEqual(['what is broken?']);
    // …and the single remaining owner is the polite status indicator.
    expect(screen.queryAllByRole('status')).toHaveLength(1);
  });

  it('renders the assistant row as soon as it carries text', () => {
    const withText: ChatMessage[] = [pending[0], row('a1', 'assistant', 'Mingo', 'Chec')];
    render(<ChatMessageList dialogId="d" messages={withText} isTyping />);
    expect(names()).toEqual(['Michael Assraf', 'Mingo']);
  });

  it('does not take a turn of sources alone for one that has drawn something', () => {
    const withSources: ChatMessage[] = [
      pending[0],
      {
        id: 'a1',
        role: 'assistant',
        metadata: { author: { name: 'Mingo' } },
        parts: [{ type: 'source-url', sourceId: 'record://blog_post/1', url: 'https://x.test/a', title: 'A' }],
      },
    ];
    render(<ChatMessageList dialogId="d" messages={withSources} isTyping />);
    expect(names()).toEqual(['Michael Assraf']);
    expect(screen.queryAllByRole('status')).toHaveLength(1);
  });

  it('renders the assistant row when it carries a stage of the turn', () => {
    const withStage: ChatMessage[] = [
      pending[0],
      {
        id: 'a1',
        role: 'assistant',
        metadata: {
          author: { name: 'Mingo' },
          progress: [{ id: 't:searching', stage: 'searching', count: 3, state: 'running' }],
        },
        parts: [],
      },
    ];
    render(<ChatMessageList dialogId="d" messages={withStage} isTyping />);
    expect(names()).toEqual(['Michael Assraf', 'Mingo']);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('renders the assistant row when it carries a NON-text part (tool call)', () => {
    const withTool: ChatMessage[] = [
      pending[0],
      {
        id: 'a1',
        role: 'assistant',
        metadata: { author: { name: 'Mingo' } },
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'run_command',
            toolCallId: 'e1',
            title: 'Run command',
            state: 'input-available',
            input: { cmd: 'ls' },
            toolMetadata: { integratedToolType: 'SHELL' },
          },
        ],
      },
    ];
    render(<ChatMessageList dialogId="d" messages={withTool} isTyping />);
    expect(names()).toEqual(['Michael Assraf', 'Mingo']);
  });

  it('renders a completed empty-ish assistant row when NOT typing', () => {
    render(<ChatMessageList dialogId="d" messages={pending} />);
    expect(names()).toEqual(['Michael Assraf', 'Mingo']);
  });
});

describe('a single card that was approved, while its tool runs', () => {
  const question = row('u1', 'user', 'Michael Assraf', 'close it');
  const answered = (parts: ChatPart[]): ChatMessage[] => [
    question,
    {
      id: 'a1',
      role: 'assistant',
      metadata: { author: { name: 'Mingo' } },
      parts: [{ type: 'text', text: 'I can close that.' }, ...parts],
    },
  ];
  const card = (approved: boolean, batchId?: string): ChatPart => ({
    type: 'dynamic-tool',
    toolName: 'update_ticket',
    toolCallId: 'p1',
    title: 'Close',
    state: 'approval-responded',
    input: {},
    approval: { id: 'p1', approved, ...(batchId ? { descriptor: { batchId } } : {}) },
  });

  it('the footer says the turn is working: the card has no icon of its own', () => {
    render(<ChatMessageList dialogId="d" messages={answered([card(true)])} isTyping />);
    expect(screen.queryAllByRole('status')).toHaveLength(1);
  });

  it('not for a batch: its rows say it themselves', () => {
    render(<ChatMessageList dialogId="d" messages={answered([card(true, 'b1')])} isTyping />);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('not for a rejection: nothing runs', () => {
    render(<ChatMessageList dialogId="d" messages={answered([card(false)])} isTyping />);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('not for a card still waiting on the user', () => {
    const pending: ChatPart = {
      type: 'dynamic-tool',
      toolName: 'update_ticket',
      toolCallId: 'p1',
      state: 'approval-requested',
      input: {},
      approval: { id: 'p1' },
    };
    render(<ChatMessageList dialogId="d" messages={answered([pending])} isTyping />);
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  describe('once the tool has answered, and the turn goes on', () => {
    const done: ChatPart = {
      type: 'dynamic-tool',
      toolName: 'update_ticket',
      toolCallId: 'p1',
      state: 'output-available',
      input: {},
      output: {},
      approval: { id: 'p1', approved: true },
    };

    it('the footer says so: no row does until what follows comes', () => {
      render(<ChatMessageList dialogId="d" messages={answered([done])} isTyping />);
      expect(screen.queryAllByRole('status')).toHaveLength(1);
    });

    it('a tool that failed leaves the same gap', () => {
      const failed: ChatPart = {
        type: 'dynamic-tool',
        toolName: 'update_ticket',
        toolCallId: 'p1',
        state: 'output-error',
        input: {},
        errorText: 'No.',
      };
      render(<ChatMessageList dialogId="d" messages={answered([failed])} isTyping />);
      expect(screen.queryAllByRole('status')).toHaveLength(1);
    });

    it('not once the turn is over', () => {
      render(<ChatMessageList dialogId="d" messages={answered([done])} />);
      expect(screen.queryAllByRole('status')).toHaveLength(0);
    });

    it('not once text follows it', () => {
      render(<ChatMessageList dialogId="d" messages={answered([done, { type: 'text', text: 'Closed.' }])} isTyping />);
      expect(screen.queryAllByRole('status')).toHaveLength(0);
    });
  });
});

describe('a turn whose only cards wait on another tier', () => {
  const cardOf = (toolCallId: string, approvalType: string, batchId?: string): ChatPart => ({
    type: 'dynamic-tool',
    toolName: 'x',
    toolCallId,
    state: 'approval-requested',
    input: {},
    approval: { id: toolCallId, descriptor: { approvalType, ...(batchId ? { batchId } : {}) } },
  });
  const turn = (parts: ChatPart[]): ChatMessage[] => [
    row('u1', 'user', 'Client', 'please do it'),
    { id: 'a1', role: 'assistant', metadata: { author: { name: 'Fae' } }, parts },
  ];
  const clientSide = (parts: ChatPart[], isTyping = false) =>
    render(
      <ChatMessageList dialogId="d" messages={turn(parts)} displayApprovalTypes={['CLIENT']} isTyping={isTyping} />,
    );

  it('draws no row, typing or not', () => {
    const { unmount } = clientSide([cardOf('r1', 'USER')]);
    expect(names()).toEqual(['Client']);
    unmount();
    clientSide([cardOf('r1', 'USER')], true);
    expect(names()).toEqual(['Client']);
  });

  it('nor for a batch one of whose rows waits, or with only sources beside it', () => {
    clientSide([
      { type: 'source-url', sourceId: 'record://blog_post/1', url: 'https://x.test/a', title: 'A' },
      cardOf('r1', 'USER', 'b1'),
      cardOf('r2', 'CLIENT', 'b1'),
    ]);
    expect(names()).toEqual(['Client']);
  });

  it('a card this side answers draws its row', () => {
    clientSide([cardOf('r1', 'CLIENT')]);
    expect(names()).toEqual(['Client', 'Fae']);
  });

  it('text beside it draws its row', () => {
    clientSide([{ type: 'text', text: 'Asking your admin.' }, cardOf('r1', 'USER')]);
    expect(names()).toEqual(['Client', 'Fae']);
  });

  it('a cut turn draws its row: the notice has to go somewhere', () => {
    const messages: ChatMessage[] = [
      row('u1', 'user', 'Client', 'please do it'),
      {
        id: 'a1',
        role: 'assistant',
        metadata: { author: { name: 'Fae' }, finishReason: 'interrupted' },
        parts: [cardOf('r1', 'USER')],
      },
    ];
    render(<ChatMessageList dialogId="d" messages={messages} displayApprovalTypes={['CLIENT']} />);
    expect(names()).toEqual(['Client', 'Fae']);
  });
});

describe('a system line is a row of its own', () => {
  it('still renders, with its words in the body', () => {
    const messages: ChatMessage[] = [
      row('u1', 'user', 'Michael Assraf', 'hi'),
      {
        id: 's1',
        role: 'system',
        metadata: { author: { authorType: 'system' } },
        parts: [{ type: 'text', text: 'Technician joined' }],
      },
    ];
    render(<ChatMessageList dialogId="d" messages={messages} isTyping />);
    expect(bodies()).toContain('Technician joined');
  });
});

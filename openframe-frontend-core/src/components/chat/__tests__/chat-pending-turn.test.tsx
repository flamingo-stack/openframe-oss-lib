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

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createChatStreamReducer } from '../stream/chat-stream-reducer'
import {
  AUTO_CONTINUATION_DIRECTIVE_PREFIX,
  buildAutoContinuationDirective,
} from '../utils/auto-continuation-directive'
import type { Message } from '../types/message.types'

// ─── Render harness (mirrors chat-message-list.test.tsx) ────────────────────

const scrollToBottom = vi.fn()
const stopScroll = vi.fn()

function makeRef() {
  const fn = ((el: HTMLElement | null) => {
    ;(fn as { current: HTMLElement | null }).current = el
  }) as ((el: HTMLElement | null) => void) & { current: HTMLElement | null }
  fn.current = null
  return fn
}

vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: () => ({
    scrollRef: makeRef(),
    contentRef: makeRef(),
    scrollToBottom,
    stopScroll,
  }),
}))

// Row stub that renders the author label the way the real component does
// (`Name:`), so "labeled row with no body" is directly assertable.
vi.mock('../chat-message-enhanced', () => ({
  ChatMessageEnhanced: ({ name, content }: { name?: string; content: unknown }) => (
    <div data-testid="row">
      <span data-testid="row-name">{name ?? ''}</span>
      <span data-testid="row-body">
        {typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .map((s) => (s && (s as { type?: string }).type === 'text' ? (s as { text: string }).text : '[seg]'))
                .join('')
            : ''}
      </span>
    </div>
  ),
}))

import { ChatMessageList } from '../chat-message-list'

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', ObserverStub)
vi.stubGlobal('ResizeObserver', ObserverStub)

const names = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-testid="row-name"]')).map((n) => n.textContent)
const bodies = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('[data-testid="row-body"]')).map((n) => n.textContent)

// ─── State-level contracts ─────────────────────────────────────────────────

describe('approval sends mint no visible user row', () => {
  it('beginSseSend with empty text pushes only the assistant placeholder', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    // What `cardApprove` triggers: ('', { hidden: true, approvalAction }).
    r.beginSseSend({ text: '', hidden: true, assistantName: 'Mingo AI' })

    expect(r.state.messages).toHaveLength(1)
    expect(r.state.messages[0].role).toBe('assistant')
    expect(r.state.messages.some((m) => m.role === 'user')).toBe(false)
    expect(r.state.streamingPhase).toBe('thinking')
  })

  it('pushOptimisticSend with empty text likewise mints no user row', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.pushOptimisticSend('', true)

    expect(r.state.messages).toHaveLength(1)
    expect(r.state.messages[0].role).toBe('assistant')
  })

  it('a normal send still mints the user row', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: 'hello', assistantName: 'Mingo AI' })

    expect(r.state.messages).toHaveLength(2)
    expect(r.state.messages[0]).toMatchObject({ role: 'user', content: 'hello' })
    expect(r.state.messages[0].hidden).toBeUndefined()
  })
})

describe('hidden rows that carry text', () => {
  it('an auto-continuation directive IS state (the model sees it) but is flagged hidden', () => {
    const directive = buildAutoContinuationDirective('create_ticket', { ticketId: '42' })
    expect(directive.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX)).toBe(true)

    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: directive, hidden: true, assistantName: 'Mingo AI' })

    const userRow = r.state.messages.find((m) => m.role === 'user')
    expect(userRow?.content).toBe(directive)
    expect(userRow?.hidden).toBe(true)
  })

  it('never renders — the raw directive text must not reach the transcript', () => {
    const directive = buildAutoContinuationDirective('create_ticket', { ticketId: '42' })
    const messages: Message[] = [
      { id: 'u1', role: 'user', name: 'Michael Assraf', content: 'my laptop is dead' },
      { id: 'h1', role: 'user', name: 'Michael Assraf', content: directive, hidden: true },
      { id: 'a1', role: 'assistant', name: 'Mingo', content: 'Opened a ticket.' },
    ]
    const { container } = render(<ChatMessageList dialogId="d" messages={messages} />)

    expect(container.textContent).not.toContain(AUTO_CONTINUATION_DIRECTIVE_PREFIX)
    expect(bodies(container)).toEqual(['my laptop is dead', 'Opened a ticket.'])
  })
})

// ─── Render-level contracts ────────────────────────────────────────────────

describe('a thinking turn has exactly ONE pending affordance', () => {
  const pending: Message[] = [
    { id: 'u1', role: 'user', name: 'Michael Assraf', content: 'what is broken?' },
    { id: 'a1', role: 'assistant', name: 'Mingo', content: '', segments: [] },
  ]

  it('does not render the empty labeled assistant row while typing', () => {
    const { container } = render(
      <ChatMessageList dialogId="d" messages={pending} isTyping />,
    )
    // The bare "Mingo" label must be gone from the transcript entirely —
    // removed from the DOM, not visually hidden (the list is an aria-live
    // log; a zero-height node would still be announced).
    expect(names(container)).toEqual(['Michael Assraf'])
    expect(bodies(container)).toEqual(['what is broken?'])
    // …and the single remaining owner is the polite status indicator.
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
  })

  it('renders the assistant row as soon as it carries text', () => {
    const withText: Message[] = [
      pending[0],
      { id: 'a1', role: 'assistant', name: 'Mingo', content: [{ type: 'text', text: 'Chec' }] },
    ]
    const { container } = render(
      <ChatMessageList dialogId="d" messages={withText} isTyping />,
    )
    expect(names(container)).toEqual(['Michael Assraf', 'Mingo'])
  })

  it('renders the assistant row when it carries a NON-text segment (tool call)', () => {
    const withTool: Message[] = [
      pending[0],
      {
        id: 'a1',
        role: 'assistant',
        name: 'Mingo',
        content: [
          { type: 'tool_execution', toolExecutionRequestId: 'e1', status: 'executing' },
        ] as Message['content'],
      },
    ]
    const { container } = render(
      <ChatMessageList dialogId="d" messages={withTool} isTyping />,
    )
    expect(names(container)).toEqual(['Michael Assraf', 'Mingo'])
  })

  it('renders a completed empty-ish assistant row when NOT typing', () => {
    const { container } = render(<ChatMessageList dialogId="d" messages={pending} />)
    expect(names(container)).toEqual(['Michael Assraf', 'Mingo'])
  })
})

describe('the SYSTEM name-only row is a legitimate label-without-body', () => {
  it('still renders', () => {
    const messages: Message[] = [
      { id: 'u1', role: 'user', name: 'Michael Assraf', content: 'hi' },
      { id: 's1', role: 'user', name: 'Technician joined', content: '', authorType: 'system' },
    ]
    const { container } = render(<ChatMessageList dialogId="d" messages={messages} isTyping />)
    expect(names(container)).toContain('Technician joined')
  })
})

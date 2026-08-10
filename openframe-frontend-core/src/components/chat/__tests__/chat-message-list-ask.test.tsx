/**
 * Ask cards go stale once answered.
 *
 * The clarification card belongs to ONE turn: as soon as the user replies —
 * by picking an option or by typing their own answer — the question is settled
 * and re-clicking it would send a stale label into a conversation that already
 * moved on. `ChatMessageList` therefore hands `onAskSelect` only to messages
 * that no user message follows, which also locks every card in replayed
 * history (each one is followed by the reply it produced).
 */

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Message } from '../types/message.types'

// The library hands back CALLBACK refs and the list invokes them on attach —
// object refs would throw "scrollRef is not a function" during layout effects.
const noopRef = () => {}
vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: () => ({
    scrollRef: noopRef,
    contentRef: noopRef,
    scrollToBottom: vi.fn(),
    stopScroll: vi.fn(),
    isAtBottom: true,
  }),
}))

/** Records the `onAskSelect` each row received, keyed by message id. */
const askHandlers = new Map<string, unknown>()
vi.mock('../chat-message-enhanced', async () => {
  const { forwardRef } = await import('react')
  return {
    ChatMessageEnhanced: forwardRef<
      HTMLDivElement,
      { name?: string; content: unknown; onAskSelect?: (label: string) => void }
    >(({ name, onAskSelect }, ref) => {
      askHandlers.set(name ?? '', onAskSelect)
      return <div ref={ref} />
    }),
  }
})

import { ChatMessageList } from '../chat-message-list'

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', ObserverStub)
vi.stubGlobal('ResizeObserver', ObserverStub)

const askMessage = (id: string): Message => ({
  id,
  name: id,
  role: 'assistant',
  content: [{ type: 'ask', question: 'What would you like to do with tickets?', options: [{ label: 'Ticket features' }] }],
})

const userMessage = (id: string): Message => ({ id, name: id, role: 'user', content: 'Ticket features' })

describe('ChatMessageList — ask cards lock after a reply', () => {
  beforeEach(() => askHandlers.clear())

  it('keeps the trailing card interactive while nothing follows it', () => {
    const onAskSelect = vi.fn()
    render(<ChatMessageList messages={[userMessage('u1'), askMessage('a1')]} onAskSelect={onAskSelect} />)

    expect(askHandlers.get('a1')).toBe(onAskSelect)
  })

  it('locks a card once the user has replied after it', () => {
    const onAskSelect = vi.fn()
    render(
      <ChatMessageList
        messages={[askMessage('a1'), userMessage('u1'), { id: 'a2', name: 'a2', role: 'assistant', content: 'answer' }]}
        onAskSelect={onAskSelect}
      />,
    )

    expect(askHandlers.get('a1')).toBeUndefined()
    // The turn AFTER the reply is live again — a fresh card there is clickable.
    expect(askHandlers.get('a2')).toBe(onAskSelect)
  })

  it('locks every card in replayed history', () => {
    const onAskSelect = vi.fn()
    render(
      <ChatMessageList
        messages={[askMessage('a1'), userMessage('u1'), askMessage('a2'), userMessage('u2')]}
        onAskSelect={onAskSelect}
      />,
    )

    expect(askHandlers.get('a1')).toBeUndefined()
    expect(askHandlers.get('a2')).toBeUndefined()
  })
})

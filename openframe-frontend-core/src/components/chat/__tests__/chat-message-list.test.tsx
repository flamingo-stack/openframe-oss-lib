import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../types/message.types'

const scrollToBottom = vi.fn()
const stopScroll = vi.fn()

function makeRef() {
  const fn = ((el: HTMLElement | null) => {
    ;(fn as { current: HTMLElement | null }).current = el
  }) as ((el: HTMLElement | null) => void) & { current: HTMLElement | null }
  fn.current = null
  return fn
}
const scrollRefMock = makeRef()
const contentRefMock = makeRef()

vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: () => ({
    scrollRef: scrollRefMock,
    contentRef: contentRefMock,
    scrollToBottom,
    stopScroll,
  }),
}))

// Keep the row renderer trivial — these tests exercise ChatMessageList's
// scroll orchestration, not markdown rendering.
vi.mock('../chat-message-enhanced', () => ({
  ChatMessageEnhanced: ({ content }: { content: string }) => <div>{content}</div>,
}))

import { ChatMessageList } from '../chat-message-list'

// jsdom ships neither observer; the component instantiates both
// (load-more sentinel + top-anchor settle watcher).
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', ObserverStub)
vi.stubGlobal('ResizeObserver', ObserverStub)

const msg = (id: string, role: Message['role']): Message => ({
  id,
  role,
  content: `body of ${id}`,
  timestamp: new Date(),
})

describe('ChatMessageList force-scroll decisions', () => {
  beforeEach(() => {
    scrollToBottom.mockClear()
  })

  it('snaps to bottom when the dialog changes', () => {
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={[msg('m1', 'user')]} />)
    scrollToBottom.mockClear()
    rerender(<ChatMessageList dialogId="d2" messages={[msg('x1', 'user')]} />)
    expect(scrollToBottom).toHaveBeenCalled()
  })

  it('snaps to bottom when a new user message is appended', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')]
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} />)
    scrollToBottom.mockClear()
    rerender(<ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'user')]} />)
    expect(scrollToBottom).toHaveBeenCalled()
  })

  it('does NOT scroll when an older page is prepended (load-more)', () => {
    const initial = [msg('m3', 'user'), msg('m4', 'assistant')]
    const { rerender } = render(
      <ChatMessageList dialogId="d1" messages={initial} hasNextPage onLoadMore={() => {}} />,
    )
    scrollToBottom.mockClear()
    const olderPage = [msg('m1', 'user'), msg('m2', 'assistant')]
    rerender(
      <ChatMessageList dialogId="d1" messages={[...olderPage, ...initial]} hasNextPage onLoadMore={() => {}} />,
    )
    expect(scrollToBottom).not.toHaveBeenCalled()
  })

  it('does NOT scroll on assistant-only appends (library owns streaming follow)', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')]
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} />)
    scrollToBottom.mockClear()
    rerender(<ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'assistant')]} />)
    expect(scrollToBottom).not.toHaveBeenCalled()
  })
})

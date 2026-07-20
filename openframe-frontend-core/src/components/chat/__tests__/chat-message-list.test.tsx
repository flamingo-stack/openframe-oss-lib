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
// Forwards the ref because the list registers each row element for the
// per-message `scrollAnchor: 'top'` path.
vi.mock('../chat-message-enhanced', async () => {
  const { forwardRef } = await import('react')
  return {
    ChatMessageEnhanced: forwardRef<HTMLDivElement, { content: string }>(({ content }, ref) => (
      <div ref={ref}>{content}</div>
    )),
  }
})

import { ChatMessageList } from '../chat-message-list'

// jsdom ships neither observer; the component instantiates both
// (load-more sentinel + top-anchor settle watcher).
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', ObserverStub)

// Recording RO so the bottom-follow tests can drive a resize by hand.
const resizeCallbacks: Array<() => void> = []
class RecordingResizeObserver {
  constructor(cb: () => void) {
    resizeCallbacks.push(cb)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', RecordingResizeObserver)
/** Fire every live ResizeObserver callback — same effect as any content
 *  or scroller-box size change in the real DOM. */
const fireResize = () => {
  for (const cb of resizeCallbacks) cb()
}

// jsdom has no layout, so `scrollIntoView` is undefined.
Element.prototype.scrollIntoView = vi.fn()

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

// The library's own `isAtBottom` lock is lost silently when the scroller's
// box changes (source chips mounting below it) or when a card settling out
// of its skeleton produces a resize-driven scroll the library reads as a
// user gesture. The list therefore owns the INTENT and re-asserts on every
// geometry change until a real gesture releases it.
describe('ChatMessageList bottom-follow intent', () => {
  beforeEach(() => {
    scrollToBottom.mockClear()
    resizeCallbacks.length = 0
  })

  const sendTurn = () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')]
    const view = render(<ChatMessageList dialogId="d1" messages={initial} />)
    // A user send arms the follow intent for the whole turn.
    view.rerender(<ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'user')]} />)
    scrollToBottom.mockClear()
    return view
  }

  it('re-asserts the bottom on geometry changes after the send', () => {
    sendTurn()
    fireResize()
    expect(scrollToBottom).toHaveBeenCalled()
  })

  it('keeps re-asserting for late async growth (cards + covers resolving)', () => {
    sendTurn()
    fireResize()
    fireResize()
    fireResize()
    expect(scrollToBottom).toHaveBeenCalledTimes(3)
  })

  it('releases the intent once the user scrolls up', () => {
    sendTurn()
    scrollRefMock.current?.dispatchEvent(
      new WheelEvent('wheel', { deltaY: -120, bubbles: true }),
    )
    fireResize()
    expect(scrollToBottom).not.toHaveBeenCalled()
  })

  it('ignores downward wheel (never an escape from the bottom)', () => {
    sendTurn()
    scrollRefMock.current?.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 120, bubbles: true }),
    )
    fireResize()
    expect(scrollToBottom).toHaveBeenCalled()
  })

  it('does not follow when autoScroll is off (passive demo hosts)', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')]
    const { rerender } = render(
      <ChatMessageList dialogId="d1" messages={initial} autoScroll={false} />,
    )
    rerender(
      <ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'user')]} autoScroll={false} />,
    )
    scrollToBottom.mockClear()
    fireResize()
    expect(scrollToBottom).not.toHaveBeenCalled()
  })

  it('releases the intent for a top-anchored turn (it parks at the message top)', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')]
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} />)
    const sent = [...initial, msg('m3', 'user')]
    rerender(<ChatMessageList dialogId="d1" messages={sent} />)
    const anchored: Message = { ...msg('m4', 'assistant'), scrollAnchor: 'top' }
    rerender(<ChatMessageList dialogId="d1" messages={[...sent, anchored]} />)
    scrollToBottom.mockClear()
    fireResize()
    expect(scrollToBottom).not.toHaveBeenCalled()
  })
})

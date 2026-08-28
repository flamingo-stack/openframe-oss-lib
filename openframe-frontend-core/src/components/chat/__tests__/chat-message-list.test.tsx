import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../types/message.types';

const scrollToBottom = vi.fn();
const stopScroll = vi.fn();

/**
 * `detachCount` records `ref(null)` invocations. React calls a ref callback with
 * null and then with the element whenever the callback IDENTITY changes, and the
 * real `use-stick-to-bottom` responds to the null by disconnecting its
 * ResizeObserver and dropping its scroll/wheel listeners — so counting detaches
 * is how a test can see the adapter-identity churn that a plain recording ref
 * would silently absorb.
 */
function makeRef() {
  const fn = ((el: HTMLElement | null) => {
    if (el === null) (fn as { detachCount: number }).detachCount += 1;
    (fn as { current: HTMLElement | null }).current = el;
  }) as ((el: HTMLElement | null) => void) & {
    current: HTMLElement | null;
    detachCount: number;
  };
  fn.current = null;
  fn.detachCount = 0;
  return fn;
}
const scrollRefMock = makeRef();
const contentRefMock = makeRef();

vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: () => ({
    scrollRef: scrollRefMock,
    contentRef: contentRefMock,
    scrollToBottom,
    stopScroll,
  }),
}));

// Keep the row renderer trivial — these tests exercise ChatMessageList's
// scroll orchestration, not markdown rendering.
// Forwards the ref because the list registers each row element for the
// per-message `scrollAnchor: 'top'` path.
vi.mock('../chat-message-enhanced', async () => {
  const { forwardRef } = await import('react');
  return {
    ChatMessageEnhanced: forwardRef<HTMLDivElement, { content: string }>(({ content }, ref) => (
      <div ref={ref}>{content}</div>
    )),
  };
});

import { ChatMessageList } from '../chat-message-list';

// jsdom ships neither observer; the component instantiates both (load-more
// sentinel via IO, bottom-follow + top-anchor settle watcher via RO).
/** Recording IO so the load-more tests can see whether the sentinel is
 *  actually being watched — the difference between "pagination is wired" and
 *  "the effect ran once against a null ref and never came back". */
const intersectionObservers: Array<ObserverStub> = [];
class ObserverStub {
  observed: Element[] = [];
  constructor() {
    intersectionObservers.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', ObserverStub);

// Recording RO so the bottom-follow tests can drive a resize by hand.
const resizeCallbacks: Array<() => void> = [];
class RecordingResizeObserver {
  constructor(cb: () => void) {
    resizeCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', RecordingResizeObserver);
/** Fire every live ResizeObserver callback — same effect as any content
 *  or scroller-box size change in the real DOM. */
const fireResize = () => {
  for (const cb of resizeCallbacks) cb();
};

/** jsdom has no layout, so every box metric reads 0. The jump-to-bottom
 *  button is driven off real geometry, so the tests supply it. */
const setGeometry = (geo: { scrollHeight: number; clientHeight: number; scrollTop: number }) => {
  const el = scrollRefMock.current;
  if (!el) throw new Error('scroller not mounted');
  for (const [key, value] of Object.entries(geo)) {
    Object.defineProperty(el, key, { value, configurable: true, writable: true });
  }
};

// jsdom has no layout, so `scrollIntoView` is undefined.
Element.prototype.scrollIntoView = vi.fn();

const msg = (id: string, role: Message['role']): Message => ({
  id,
  role,
  content: `body of ${id}`,
  timestamp: new Date(),
});

describe('ChatMessageList force-scroll decisions', () => {
  beforeEach(() => {
    scrollToBottom.mockClear();
  });

  it('snaps to bottom when the dialog changes', () => {
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={[msg('m1', 'user')]} />);
    scrollToBottom.mockClear();
    rerender(<ChatMessageList dialogId="d2" messages={[msg('x1', 'user')]} />);
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it('snaps to bottom when a new user message is appended', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')];
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} />);
    scrollToBottom.mockClear();
    rerender(<ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'user')]} />);
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it('does NOT scroll when an older page is prepended (load-more)', () => {
    const initial = [msg('m3', 'user'), msg('m4', 'assistant')];
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} hasNextPage onLoadMore={() => {}} />);
    scrollToBottom.mockClear();
    const olderPage = [msg('m1', 'user'), msg('m2', 'assistant')];
    rerender(<ChatMessageList dialogId="d1" messages={[...olderPage, ...initial]} hasNextPage onLoadMore={() => {}} />);
    expect(scrollToBottom).not.toHaveBeenCalled();
  });

  it('does NOT scroll on assistant-only appends (library owns streaming follow)', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')];
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} />);
    scrollToBottom.mockClear();
    rerender(<ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'assistant')]} />);
    expect(scrollToBottom).not.toHaveBeenCalled();
  });
});

// The library's own `isAtBottom` lock is lost silently when the scroller's
// box changes (source chips mounting below it) or when a card settling out
// of its skeleton produces a resize-driven scroll the library reads as a
// user gesture. The list therefore owns the INTENT and re-asserts on every
// geometry change until a real gesture releases it.
describe('ChatMessageList bottom-follow intent', () => {
  beforeEach(() => {
    scrollToBottom.mockClear();
    resizeCallbacks.length = 0;
  });

  const sendTurn = () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')];
    const view = render(<ChatMessageList dialogId="d1" messages={initial} />);
    // A user send arms the follow intent for the whole turn.
    view.rerender(<ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'user')]} />);
    scrollToBottom.mockClear();
    return view;
  };

  it('re-asserts the bottom on geometry changes after the send', () => {
    sendTurn();
    fireResize();
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it('re-asserts through the library COALESCING contract, not a fresh chain', () => {
    // `wait: true` is what lets `scrollToBottom` find the animation already in
    // flight and return its promise. Drop it and the library clears
    // `state.animation` on entry, so each of these per-frame calls starts an
    // independent spring — and they all step the same shared velocity, which is
    // what turned a smooth follow into a fight. `duration` opens the window in
    // which that one chain keeps re-reading the (still growing) target.
    sendTurn();
    fireResize();
    // `expect.any` is declared `any` by vitest; pin it to the slot it stands in
    // for (`ScrollToBottomOptions['duration']`) so the matcher object is typed.
    const anyDuration = expect.any(Number) as number;
    expect(scrollToBottom).toHaveBeenCalledWith(
      expect.objectContaining({ wait: true, ignoreEscapes: true, duration: anyDuration }),
    );
  });

  it('keeps re-asserting for late async growth (cards + covers resolving)', () => {
    sendTurn();
    fireResize();
    fireResize();
    fireResize();
    expect(scrollToBottom).toHaveBeenCalledTimes(3);
  });

  it('releases the intent once the user scrolls up', () => {
    sendTurn();
    scrollRefMock.current?.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }));
    fireResize();
    expect(scrollToBottom).not.toHaveBeenCalled();
  });

  it('ignores downward wheel (never an escape from the bottom)', () => {
    sendTurn();
    scrollRefMock.current?.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));
    fireResize();
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it('does not follow when autoScroll is off (passive demo hosts)', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')];
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} autoScroll={false} />);
    rerender(<ChatMessageList dialogId="d1" messages={[...initial, msg('m3', 'user')]} autoScroll={false} />);
    scrollToBottom.mockClear();
    fireResize();
    expect(scrollToBottom).not.toHaveBeenCalled();
  });

  it('hides jump-to-bottom while the thread is at the bottom', () => {
    sendTurn();
    setGeometry({ scrollHeight: 1000, clientHeight: 500, scrollTop: 500 });
    act(() => fireResize());
    expect(screen.queryByLabelText('Scroll to latest message')).toBeNull();
  });

  it('shows jump-to-bottom once the thread is away from the bottom', () => {
    sendTurn();
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 500 });
    act(() => fireResize());
    expect(screen.getByLabelText('Scroll to latest message')).not.toBeNull();
  });

  it('re-arms the intent when the user clicks jump-to-bottom', () => {
    sendTurn();
    // User scrolls away: intent released, button appears.
    scrollRefMock.current?.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }));
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 500 });
    act(() => fireResize());
    expect(scrollToBottom).not.toHaveBeenCalled();

    const button = screen.getByLabelText('Scroll to latest message');
    act(() => {
      button.click();
    });
    expect(scrollToBottom).toHaveBeenCalled();

    // …and the click re-armed the lock, so growth follows again.
    scrollToBottom.mockClear();
    act(() => fireResize());
    expect(scrollToBottom).toHaveBeenCalled();
  });

  // A drag that ends OUTSIDE the window (button released off-screen, or the
  // tab losing focus mid-drag) never delivers `pointerup`, so a naive
  // `pointerDown` flag stays true forever. Afterwards the very thing this
  // component exists for — a fetch-mode card settling from skeleton to a
  // SHORTER height, which clamps scrollTop down — is misread as a scroll-up
  // gesture and silently drops the lock.
  const dragThenScrollDown = (endEvent: { target: 'window'; type: string }) => {
    sendTurn();
    // Park away from the bottom so the at-bottom re-arm below can't mask the
    // result, and seed `lastScrollTop`.
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 4000 });
    window.dispatchEvent(new Event('pointerdown'));
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    // Drag ends where we can't see it.
    if (endEvent.target === 'window') window.dispatchEvent(new Event(endEvent.type));
    // Resize clamp: content shrank, scrollTop drops. NOT a gesture.
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 3800 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    scrollToBottom.mockClear();
    act(() => fireResize());
  };

  it('keeps the intent when a pointercancel ended the drag (resize clamp is not a gesture)', () => {
    dragThenScrollDown({ target: 'window', type: 'pointercancel' });
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it('keeps the intent when the window lost focus mid-drag', () => {
    dragThenScrollDown({ target: 'window', type: 'blur' });
    expect(scrollToBottom).toHaveBeenCalled();
  });

  // Focus events do not bubble but they DO capture, so a capture-phase `blur`
  // listener on `window` fires for EVERY element blur in the document — the
  // classic focus-delegation idiom. Registering the drag-end `blur` that way
  // made any focus change during a pointer hold (most commonly the chat input
  // blurring as the user presses down on the scrollbar) clear `pointerDown`,
  // which is exactly what re-opens the yank-back-mid-drag bug. Only a TRUE
  // window blur (which targets `window` itself) may end the drag.
  it('a descendant element losing focus does not end the drag', () => {
    sendTurn();
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 4000 });
    window.dispatchEvent(new Event('pointerdown'));
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    // The chat input loses focus as the pointer goes down elsewhere.
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.blur();
    input.remove();
    // The drag is still live, so this held scroll-up IS a gesture.
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 3800 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    scrollToBottom.mockClear();
    act(() => fireResize());
    expect(scrollToBottom).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pointerup'));
  });

  it('still disarms on a genuine scrollbar drag upward', () => {
    sendTurn();
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 4000 });
    window.dispatchEvent(new Event('pointerdown'));
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 3800 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    scrollToBottom.mockClear();
    act(() => fireResize());
    expect(scrollToBottom).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pointerup'));
  });

  // Scrolling back down to the live end by hand expresses exactly the intent
  // the jump-to-bottom button does — the lock has to re-arm, or the thread
  // renders at-bottom (button hidden) and then silently drifts away.
  it('re-arms the intent when the user scrolls back to the bottom by hand', () => {
    sendTurn();
    scrollRefMock.current?.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }));
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 500 });
    act(() => fireResize());
    expect(scrollToBottom).not.toHaveBeenCalled();

    // …and back down to the end.
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 19500 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    scrollToBottom.mockClear();
    act(() => fireResize());
    expect(scrollToBottom).toHaveBeenCalled();
  });

  it('does not re-arm while the user is still parked above the bottom', () => {
    sendTurn();
    scrollRefMock.current?.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }));
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 8000 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    scrollToBottom.mockClear();
    act(() => fireResize());
    expect(scrollToBottom).not.toHaveBeenCalled();
  });

  // A short scrollbar drag that starts at the live end and stays inside the
  // 70px band disarms on the gesture and would immediately re-arm on the very
  // same scroll event if the re-arm didn't wait for the drag to END — yanking
  // the reader back down mid-drag, a miniature of the bug this block exists
  // to prevent.
  it('does not re-arm mid-drag when the drag stays inside the bottom band', () => {
    sendTurn();
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 19500 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    window.dispatchEvent(new Event('pointerdown'));
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 19460 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    scrollToBottom.mockClear();
    act(() => fireResize());
    expect(scrollToBottom).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('pointerup'));
  });

  it('releases the intent for a top-anchored turn (it parks at the message top)', () => {
    const initial = [msg('m1', 'user'), msg('m2', 'assistant')];
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={initial} />);
    const sent = [...initial, msg('m3', 'user')];
    rerender(<ChatMessageList dialogId="d1" messages={sent} />);
    const anchored: Message = { ...msg('m4', 'assistant'), scrollAnchor: 'top' };
    rerender(<ChatMessageList dialogId="d1" messages={[...sent, anchored]} />);
    scrollToBottom.mockClear();
    fireResize();
    expect(scrollToBottom).not.toHaveBeenCalled();
  });
});

/**
 * The whole bottom-follow subsystem — ResizeObserver, wheel/touch/keyboard
 * escape hatches, the jump-to-bottom button — is installed by ONE effect whose
 * deps were all identity-stable (`autoScroll` plus three `[]`-memoized values
 * from `useStickToBottom`). `isLoading` was missing, and on the loading branch
 * the component returns the skeleton, so `scrollRef.current` is null and the
 * effect bails.
 *
 * Net result for any consumer following this repo's own prescribed
 * "skeleton during fetch" pattern: the effect ran once against null refs and
 * NEVER re-ran, so nothing was ever observed, `atBottom` stayed at its initial
 * `true`, the WCAG escape hatch could not render, and the follow lock was never
 * re-asserted — while the observers/listeners bound on a later round trip kept
 * detached nodes alive.
 */
describe('ChatMessageList bottom-follow survives the loading skeleton', () => {
  beforeEach(() => {
    scrollToBottom.mockClear();
    resizeCallbacks.length = 0;
  });

  it('installs the follow observers when the skeleton is replaced by the list', () => {
    const messages = [msg('m1', 'user'), msg('m2', 'assistant')];
    const { rerender } = render(<ChatMessageList dialogId="d1" messages={messages} isLoading />);
    // Nothing to observe while the skeleton is up.
    expect(resizeCallbacks).toHaveLength(0);

    rerender(<ChatMessageList dialogId="d1" messages={messages} />);
    expect(resizeCallbacks.length).toBeGreaterThan(0);
  });

  it('shows the jump-to-bottom escape hatch after a loading round trip', () => {
    const messages = [msg('m1', 'user'), msg('m2', 'assistant')];
    const view = render(<ChatMessageList dialogId="d1" messages={messages} />);
    // A host loading another page / another dialog swaps the scroller out…
    view.rerender(<ChatMessageList dialogId="d1" messages={messages} isLoading />);
    view.rerender(<ChatMessageList dialogId="d1" messages={messages} />);

    // …and the list must still notice it is scrolled away from the bottom.
    setGeometry({ scrollHeight: 20000, clientHeight: 500, scrollTop: 0 });
    act(() => {
      scrollRefMock.current?.dispatchEvent(new Event('scroll'));
    });
    expect(screen.getByLabelText('Scroll to latest message')).not.toBeNull();
  });

  it('keeps the ref adapters identity-stable across re-renders', () => {
    // The adapters are handed to `useStickToBottom`'s ref callbacks, and the
    // library disconnects its ResizeObserver on `ref(null)` and builds a NEW
    // one on re-attach. A fresh arrow per render therefore churned an observer
    // (and two scroll listeners) on every committed frame — ~60/s while
    // streaming — and reset the library's `previousHeight`, which is what it
    // uses to choose between its `initial` and `resize` animations.
    const messages = [msg('m1', 'user'), msg('m2', 'assistant')];
    const view = render(<ChatMessageList dialogId="d1" messages={messages} />);
    const detachesAfterMount = {
      scroll: scrollRefMock.detachCount,
      content: contentRefMock.detachCount,
    };

    for (let i = 0; i < 5; i++) {
      view.rerender(<ChatMessageList dialogId="d1" messages={[...messages]} />);
    }

    // A memoized adapter is never re-invoked with null, so the library keeps its
    // observer and listeners for the whole mount.
    expect(scrollRefMock.detachCount).toBe(detachesAfterMount.scroll);
    expect(contentRefMock.detachCount).toBe(detachesAfterMount.content);
    expect(scrollRefMock.current).not.toBeNull();
  });
});

describe('load-more sentinel (infinite scroll UP)', () => {
  beforeEach(() => {
    intersectionObservers.length = 0;
  });

  it('watches the sentinel once the skeleton is replaced by the thread', () => {
    // The shape a COMPOSITE `isLoading` produces: the messages query already
    // knows an older page exists (`hasNextPage`), while an unrelated query
    // (Mingo's dialog resolution, the ticket view's dialog fetch) keeps the
    // list on its skeleton branch — where neither the scroller nor the
    // sentinel is mounted, so the effect can only bail.
    const messages = [msg('m1', 'user'), msg('m2', 'assistant')];
    const { rerender } = render(
      <ChatMessageList dialogId="d1" messages={messages} hasNextPage onLoadMore={() => {}} isLoading />,
    );
    expect(intersectionObservers).toHaveLength(0);

    // Loading clears. With `isLoading` missing from the effect's deps NOTHING
    // re-ran it here — no observer was ever created and paging up was dead for
    // the life of the component.
    rerender(<ChatMessageList dialogId="d1" messages={messages} hasNextPage onLoadMore={() => {}} />);

    expect(intersectionObservers).toHaveLength(1);
    expect(intersectionObservers[0]?.observed).toHaveLength(1);
  });

  it('re-observes after a page lands so a still-visible sentinel fires again', () => {
    // IntersectionObserver emits nothing while an element stays continuously
    // intersecting, so a small prepend that leaves the sentinel in view has to
    // be re-observed or the load chain stops one page in.
    const messages = [msg('m1', 'user'), msg('m2', 'assistant')];
    const { rerender } = render(
      <ChatMessageList dialogId="d1" messages={messages} hasNextPage onLoadMore={() => {}} isFetchingNextPage />,
    );
    const duringFetch = intersectionObservers.length;

    rerender(<ChatMessageList dialogId="d1" messages={messages} hasNextPage onLoadMore={() => {}} />);

    expect(intersectionObservers.length).toBeGreaterThan(duringFetch);
  });
});

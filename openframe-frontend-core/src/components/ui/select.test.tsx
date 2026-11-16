import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
});

const item = () => document.querySelector<HTMLElement>('[role="option"]');

function mount(description?: string) {
  flushSync(() =>
    root.render(
      <Select open defaultValue="notify">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="notify" description={description}>
            Notify Only
          </SelectItem>
        </SelectContent>
      </Select>,
    ),
  );
}

describe('SelectItem description', () => {
  it('renders the label alone on a fixed-height, non-wrapping row', () => {
    mount();
    const row = item();
    expect(row?.textContent).toBe('Notify Only');
    expect(row?.className).toContain('whitespace-nowrap');
    expect(row?.className).not.toContain('min-h-11');
  });

  it('adds the description as a second line and lets the row grow and wrap', () => {
    mount('No approval prompt. The user sees the session block, can chat and can end the session.');
    const row = item();
    expect(row?.textContent).toContain('can end the session.');
    expect(row?.className).toContain('whitespace-normal');
    expect(row?.className).toContain('min-h-11');
    expect(row?.className).not.toContain('whitespace-nowrap');
  });

  it('keeps the description out of the trigger mirror', () => {
    mount('A long description.');
    const trigger = document.querySelector('[role="combobox"]');
    expect(trigger?.textContent).toContain('Notify Only');
    expect(trigger?.textContent).not.toContain('A long description.');
  });
});

describe('SelectContent scroll arrows', () => {
  // jsdom lays nothing out: an overflowing list is faked on the element that is measured, the viewport.
  // 10 rows of 48px in a 382px list: the list scrolls by 98px.
  const SCROLL_HEIGHT = 480;
  const CLIENT_HEIGHT = 382;
  const realScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  const realClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  const realScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  const realScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  const scrollTops = new WeakMap<Element, number>();
  let scrollIntoViewCalls = 0;

  const isViewport = (el: Element) => el.hasAttribute('data-radix-select-viewport');

  beforeEach(() => {
    scrollIntoViewCalls = 0;
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return isViewport(this) ? SCROLL_HEIGHT : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return isViewport(this) ? CLIENT_HEIGHT : 0;
      },
    });
    Object.defineProperty(Element.prototype, 'scrollTop', {
      configurable: true,
      get(this: Element) {
        return scrollTops.get(this) ?? 0;
      },
      set(this: Element, value: number) {
        scrollTops.set(this, Math.max(0, Math.min(value, SCROLL_HEIGHT - CLIENT_HEIGHT)));
      },
    });
    // Radix scrolls the selected row into view once the list is placed; jsdom has no scrollIntoView.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {
        scrollIntoViewCalls += 1;
      },
    });
  });

  afterEach(() => {
    const restore = (target: object, name: string, real: PropertyDescriptor | undefined) => {
      if (real) Object.defineProperty(target, name, real);
      else Reflect.deleteProperty(target, name);
    };
    restore(HTMLElement.prototype, 'scrollHeight', realScrollHeight);
    restore(HTMLElement.prototype, 'clientHeight', realClientHeight);
    restore(Element.prototype, 'scrollTop', realScrollTop);
    restore(Element.prototype, 'scrollIntoView', realScrollIntoView);
  });

  async function mountLongList() {
    flushSync(() =>
      root.render(
        <Select open defaultValue="m0">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, i) => (
              <SelectItem key={i} value={`m${i}`}>
                {`Model ${i}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      ),
    );
    // Radix places the popper a few ticks later.
    await settle();
  }

  async function settle() {
    await act(async () => {
      for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    });
  }

  const viewportEl = () => document.querySelector<HTMLElement>('[data-radix-select-viewport]');
  const arrows = () =>
    [...document.querySelectorAll<HTMLElement>('[data-select-scroll-arrow]')].map(el =>
      el.getAttribute('data-select-scroll-arrow'),
    );

  async function scrollTo(top: number) {
    const viewport = viewportEl();
    if (!viewport) throw new Error('no viewport');
    viewport.scrollTop = top;
    act(() => {
      viewport.dispatchEvent(new Event('scroll'));
    });
    await settle();
  }

  it('shows an arrow only toward the side that still has rows', async () => {
    await mountLongList();
    expect(arrows()).toEqual(['down']);
    await scrollTo(40);
    expect(arrows()).toEqual(['up', 'down']);
    await scrollTo(98);
    expect(arrows()).toEqual(['up']);
  });

  it('keeps the scroll where the user left it when an arrow appears or goes', async () => {
    await mountLongList();
    const calls = scrollIntoViewCalls;
    await scrollTo(98);
    expect(viewportEl()?.scrollTop).toBe(98);
    await scrollTo(40);
    expect(viewportEl()?.scrollTop).toBe(40);
    expect(scrollIntoViewCalls).toBe(calls);
  });

  it('lays the arrows over the list, above its rows, instead of in its flow', async () => {
    await mountLongList();
    await scrollTo(40);
    const drawn = document.querySelectorAll<HTMLElement>('[data-select-scroll-arrow]');
    expect(drawn).toHaveLength(2);
    for (const arrow of drawn) {
      expect(arrow.className).toContain('absolute');
      expect(arrow.className).toContain('z-10');
      expect(arrow.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('pads the viewport by the arrows so a row reached by keyboard is not hidden under one', async () => {
    await mountLongList();
    expect(viewportEl()?.className).toContain('scroll-py-6');
  });

  it('caps the list at 24rem of rows inside its border', async () => {
    await mountLongList();
    expect(viewportEl()?.parentElement?.className).toContain('max-h-[min(calc(24rem+2px)');
  });

  describe('auto-scroll while the pointer rests on an arrow', () => {
    const ROW_HEIGHT = 48;
    const realOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    const realScrollBy = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollBy');
    let steps: number[] = [];

    beforeEach(() => {
      steps = [];
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return this.getAttribute('role') === 'option' ? ROW_HEIGHT : 0;
        },
      });
      Object.defineProperty(Element.prototype, 'scrollBy', {
        configurable: true,
        value(this: Element, _x: number, y: number) {
          steps.push(y);
        },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      if (realOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', realOffsetHeight);
      else Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
      if (realScrollBy) Object.defineProperty(Element.prototype, 'scrollBy', realScrollBy);
      else Reflect.deleteProperty(Element.prototype, 'scrollBy');
    });

    const arrow = (direction: 'up' | 'down') => {
      const el = document.querySelector<HTMLElement>(`[data-select-scroll-arrow="${direction}"]`);
      if (!el) throw new Error(`no ${direction} arrow`);
      return el;
    };
    const pointer = (el: HTMLElement, type: string) => {
      act(() => {
        // React derives onPointerLeave from a pointerout whose relatedTarget lies outside the element.
        const event =
          type === 'pointerleave'
            ? new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })
            : new MouseEvent(type, { bubbles: true });
        el.dispatchEvent(event);
      });
    };

    async function hoverDownArrow() {
      await mountLongList();
      await scrollTo(40);
      vi.useFakeTimers();
      const down = arrow('down');
      pointer(down, 'pointermove');
      vi.advanceTimersByTime(120);
      return down;
    }

    it('scrolls by one row every tick, down on the down arrow and up on the up arrow', async () => {
      await hoverDownArrow();
      expect(steps).toEqual([ROW_HEIGHT, ROW_HEIGHT]);
      steps = [];
      pointer(arrow('down'), 'pointerleave');
      pointer(arrow('up'), 'pointermove');
      vi.advanceTimersByTime(60);
      expect(steps).toEqual([-ROW_HEIGHT]);
    });

    it('starts one timer however often the pointer moves on the arrow', async () => {
      const down = await hoverDownArrow();
      pointer(down, 'pointermove');
      pointer(down, 'pointerdown');
      steps = [];
      vi.advanceTimersByTime(60);
      expect(steps).toEqual([ROW_HEIGHT]);
    });

    it.each(['pointerleave', 'pointerup', 'pointercancel'])('stops on %s', async type => {
      const down = await hoverDownArrow();
      pointer(down, type);
      steps = [];
      vi.advanceTimersByTime(200);
      expect(steps).toEqual([]);
    });

    it('stops when the arrow goes away under the pointer', async () => {
      await hoverDownArrow();
      flushSync(() => root.unmount());
      root = createRoot(container);
      steps = [];
      vi.advanceTimersByTime(200);
      expect(steps).toEqual([]);
    });
  });
});

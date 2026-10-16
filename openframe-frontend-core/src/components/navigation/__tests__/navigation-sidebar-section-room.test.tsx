/**
 * The grouped sidebar's two room knobs: `sectionMinHeight` (who scrolls the
 * section on a short window) and `expandedWidth` (the expanded width, on every
 * surface that hard-coded 224px).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../../../types/navigation';
import { MobileBurgerMenu } from '../mobile-burger-menu';
import { NAVIGATION_SIDEBAR_WIDTH_VAR, NavigationSidebar } from '../navigation-sidebar';
import { measureNavigationSectionRoom } from '../navigation-sidebar-section';

const icon = <svg />;

const items: NavigationSidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon, path: '/dashboard' },
  {
    id: 'inventory',
    label: 'Inventory',
    icon,
    children: [
      { id: 'customers', label: 'Customers', icon, path: '/customers' },
      { id: 'devices', label: 'Devices', icon, path: '/devices' },
    ],
  },
  { id: 'kb', label: 'Knowledge Base', icon, path: '/knowledge-base' },
];

const history = <p>Chat history</p>;

/**
 * The layout jsdom does not have: the sidebar body's inner height and the
 * tree's height. The body is the element holding the section; the tree is
 * whatever holds (or is) the primary nav.
 */
const layout = { body: 900, tree: 400 };
const resizeCallbacks = new Set<ResizeObserverCallback>();
const relayout = (next: Partial<typeof layout>) => {
  Object.assign(layout, next);
  act(() => {
    for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
  });
};

function rect(height: number): DOMRect {
  return { height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0, toJSON: () => ({}) };
}

beforeEach(() => {
  Object.assign(layout, { body: 900, tree: 400 });
  window.localStorage.clear();
  document.documentElement.style.removeProperty(NAVIGATION_SIDEBAR_WIDTH_VAR);
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function clientHeight(this: Element) {
    return this.querySelector(':scope > [data-section-scroll]') ? layout.body : 0;
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function boundingRect(this: Element) {
    const primary = 'nav[aria-label="Primary navigation"]';
    return rect(this.matches(primary) || this.querySelector(primary) ? layout.tree : 0);
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        resizeCallbacks.add(this.callback);
      }
      unobserve() {}
      disconnect() {
        resizeCallbacks.delete(this.callback);
      }
    },
  );
});

afterEach(() => {
  resizeCallbacks.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function sidebar(config: Partial<NavigationSidebarConfig> = {}) {
  return render(
    <NavigationSidebar
      config={{ variant: 'grouped', items, currentPath: '/devices', sectionSlot: history, ...config }}
    />,
  );
}

const sectionWrapper = () => screen.getByText('Chat history').parentElement as HTMLElement;
const aside = () => screen.getByRole('complementary', { name: 'Main navigation sidebar' });

describe('sectionMinHeight', () => {
  it('lets the section fill the rest and scroll itself while the body has the room', () => {
    sidebar({ sectionMinHeight: 320 });
    const wrapper = sectionWrapper();
    expect(wrapper).toHaveAttribute('data-section-scroll', 'section');
    expect(wrapper).toHaveClass('flex-1', 'overflow-y-auto');
    expect(wrapper.style.minHeight).toBe('320px');
  });

  it('scrolls the whole body once the tree leaves less than the minimum, and gives it back', () => {
    layout.tree = 700; // 900 - 700 = 200 < 320
    sidebar({ sectionMinHeight: 320 });
    const wrapper = sectionWrapper();
    expect(wrapper).toHaveAttribute('data-section-scroll', 'body');
    // In the body's flow at its full height: no own scroll, no shrinking, the minimum kept.
    expect(wrapper).toHaveClass('flex-none');
    expect(wrapper).not.toHaveClass('flex-1');
    expect(wrapper).not.toHaveClass('overflow-y-auto');
    expect(wrapper.style.minHeight).toBe('320px');

    relayout({ body: 1200 }); // a taller window: 1200 - 700 = 500
    expect(wrapper).toHaveAttribute('data-section-scroll', 'section');

    relayout({ tree: 950 }); // a group opens: 1200 - 950 = 250
    expect(wrapper).toHaveAttribute('data-section-scroll', 'body');
  });

  it('keeps today’s floor without the prop, and in the collapsed rail', () => {
    layout.tree = 850;
    const { unmount } = sidebar();
    expect(sectionWrapper()).not.toHaveAttribute('data-section-scroll');
    expect(sectionWrapper()).toHaveClass('min-h-40', 'flex-1', 'overflow-y-auto');
    expect(sectionWrapper()).not.toHaveAttribute('style');
    unmount();

    sidebar({ sectionMinHeight: 320, collapsed: true, onCollapsedChange: vi.fn() });
    expect(sectionWrapper()).not.toHaveAttribute('data-section-scroll');
    expect(sectionWrapper()).toHaveClass('min-h-40');
  });

  it('measures a section the host adds later (a lock lifting)', () => {
    layout.tree = 700;
    function Host() {
      const [locked, setLocked] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setLocked(false)}>
            unlock
          </button>
          <NavigationSidebar
            config={{
              variant: 'grouped',
              items,
              sectionMinHeight: 320,
              sectionSlot: locked ? undefined : history,
            }}
          />
        </>
      );
    }
    render(<Host />);
    expect(screen.queryByText('Chat history')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'unlock' }));
    expect(sectionWrapper()).toHaveAttribute('data-section-scroll', 'body');
  });

  it('applies the same rule in the grouped mobile drawer', () => {
    layout.tree = 700;
    render(
      <MobileBurgerMenu
        isOpen
        onClose={vi.fn()}
        config={{ variant: 'grouped', items, sectionSlot: history, sectionMinHeight: 320 }}
      />,
    );
    expect(sectionWrapper()).toHaveAttribute('data-section-scroll', 'body');
    relayout({ body: 1400 });
    expect(sectionWrapper()).toHaveAttribute('data-section-scroll', 'section');
  });

  it('leaves the flat config alone', () => {
    render(<NavigationSidebar config={{ items, sectionMinHeight: 320, sectionSlot: history }} />);
    expect(sectionWrapper()).not.toHaveAttribute('data-section-scroll');
    expect(sectionWrapper()).toHaveClass('min-h-40');
  });
});

describe('measureNavigationSectionRoom', () => {
  it('takes the body’s padding, the other children and every margin off the body’s height', () => {
    layout.body = 600;
    layout.tree = 300;
    const tree = () => {
      const block = document.createElement('div');
      block.innerHTML = '<nav aria-label="Primary navigation"></nav>';
      return block;
    };
    const body = document.createElement('div');
    body.style.paddingTop = '16px';
    body.style.paddingBottom = '16px';
    const section = document.createElement('div');
    section.setAttribute('data-section-scroll', 'section');
    section.style.marginTop = '16px';
    section.style.marginBottom = '16px';
    const hidden = tree();
    hidden.style.display = 'none';
    body.append(tree(), section, hidden);
    document.body.appendChild(body);
    // 600 - 32 padding - 300 tree - 32 section margins; the hidden child counts for nothing.
    expect(measureNavigationSectionRoom(body, section)).toBe(236);
    body.remove();
  });
});

describe('expandedWidth', () => {
  /** md without lg: the sidebar is a rail that opens as an overlay. */
  function tablet() {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      query =>
        ({
          matches: query === '(min-width: 800px)',
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
  }
  const widthVar = () => document.documentElement.style.getPropertyValue(NAVIGATION_SIDEBAR_WIDTH_VAR);
  const toggle = () => fireEvent.click(screen.getByRole('button', { name: 'Hide Menu' }));

  it('writes the expanded width to the width var, and 56px for the rail', () => {
    function Host() {
      const [collapsed, setCollapsed] = useState(false);
      return (
        <NavigationSidebar
          config={{ variant: 'grouped', items, expandedWidth: 264, collapsed, onCollapsedChange: setCollapsed }}
        />
      );
    }
    render(<Host />);
    expect(widthVar()).toBe('264px');
    expect(aside().style.getPropertyValue('--of-navigation-sidebar-expanded-width')).toBe('264px');
    expect(aside()).toHaveClass(
      'lg:w-[var(--of-navigation-sidebar-width,var(--of-navigation-sidebar-expanded-width))]',
    );
    toggle();
    expect(widthVar()).toBe('56px');
  });

  it('opens the tablet overlay — and its push slot — at that width', () => {
    tablet();
    render(<NavigationSidebar config={{ variant: 'grouped', items, expandedWidth: 264 }} pushOnTablet />);
    const slot = aside().previousElementSibling as HTMLElement;
    expect(aside()).toHaveClass('md:w-14');
    expect(slot).toHaveClass('w-14');
    toggle();
    expect(aside()).toHaveClass('md:w-[var(--of-navigation-sidebar-expanded-width)]');
    expect(aside()).not.toHaveClass('md:w-56');
    expect(slot).toHaveClass('w-[var(--of-navigation-sidebar-expanded-width)]');
    expect(slot.style.getPropertyValue('--of-navigation-sidebar-expanded-width')).toBe('264px');
  });

  it('keeps a width the rows still read as expanded', () => {
    render(<NavigationSidebar config={{ variant: 'grouped', items, expandedWidth: 100 }} />);
    expect(widthVar()).toBe('141px');
  });

  it('renders 224px through the old classes without it, and the flat variant ignores it', () => {
    tablet();
    const { unmount } = render(<NavigationSidebar config={{ variant: 'grouped', items }} />);
    expect(aside()).not.toHaveAttribute('style');
    expect(aside()).toHaveClass('lg:w-[var(--of-navigation-sidebar-width,14rem)]');
    toggle();
    expect(aside()).toHaveClass('md:w-56');
    expect(widthVar()).toBe('224px');
    unmount();

    render(<NavigationSidebar config={{ items, expandedWidth: 264 }} />);
    expect(aside()).not.toHaveAttribute('style');
    toggle();
    expect(aside()).toHaveClass('md:w-56');
    expect(widthVar()).toBe('224px');
  });

  it('snaps to a new width instead of animating to it', async () => {
    const frame = () =>
      act(async () => {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      });
    const { rerender } = render(<NavigationSidebar config={{ variant: 'grouped', items }} />);
    await frame();
    expect(aside()).toHaveClass('transition-[width]');

    rerender(<NavigationSidebar config={{ variant: 'grouped', items, expandedWidth: 264 }} />);
    expect(widthVar()).toBe('264px');
    expect(aside()).not.toHaveClass('transition-[width]');
    await frame();
    expect(aside()).toHaveClass('transition-[width]');
  });
});

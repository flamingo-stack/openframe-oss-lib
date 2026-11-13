/**
 * The chat column and the page column (`AppLayoutWorkArea`), the column header
 * (`AppColumnHeader`), and both wired into `AppLayout` (`chatColumn`,
 * `workAreaMode`, `endSidebarConfig`).
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collapse02Icon } from '../../icons-v2-generated';
import { AppColumnHeader } from '../app-column-header';
import { AppLayout } from '../app-layout';
import { AppLayoutWorkArea, type AppLayoutWorkAreaMode, useWorkAreaColumn } from '../app-layout-work-area';

/** jsdom has no layout: every element reports this width. */
function rowWidth(px: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(px);
}

function area(mode: AppLayoutWorkAreaMode, storageKey?: string) {
  return <AppLayoutWorkArea mode={mode} chat={<h2>Thread</h2>} page={<h2>Page body</h2>} storageKey={storageKey} />;
}

/** A column's heading, found only while its column is not hidden from assistive tech. */
const shownHeading = (name: string) => screen.queryByRole('heading', { name });
const mountedHeading = (name: string) => screen.getByRole('heading', { name, hidden: true });
const chatColumn = () => screen.getByRole('region', { hidden: true });
const pageColumn = () => screen.getByTestId('work-area-page-column');
const divider = () => screen.getByRole('separator', { name: 'Resize chat column' });

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('AppLayoutWorkArea', () => {
  it('chat: the chat column alone; the page stays mounted but hidden', () => {
    rowWidth(1000);
    render(area('chat'));
    expect(shownHeading('Thread')).toBeInTheDocument();
    expect(shownHeading('Page body')).not.toBeInTheDocument();
    expect(mountedHeading('Page body')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('page: the page column alone; the chat stays mounted, hidden and inert', () => {
    rowWidth(1000);
    render(area('page'));
    expect(shownHeading('Thread')).not.toBeInTheDocument();
    expect(mountedHeading('Thread')).toBeInTheDocument();
    expect(chatColumn()).toHaveAttribute('inert');
  });

  it('split: both columns, the chat column at half the room, a divider between', () => {
    rowWidth(1000);
    render(area('split'));
    expect(shownHeading('Thread')).toBeInTheDocument();
    expect(shownHeading('Page body')).toBeInTheDocument();
    expect(chatColumn()).toHaveStyle({ width: '500px' });
    expect(divider()).toHaveAttribute('aria-valuemin', '360');
    expect(divider()).toHaveAttribute('aria-valuemax', '640');
  });

  it('keeps both columns at least 360px wide', () => {
    rowWidth(1000);
    render(area('split'));
    fireEvent.keyDown(divider(), { key: 'End' });
    expect(chatColumn()).toHaveStyle({ width: '640px' });
    fireEvent.keyDown(divider(), { key: 'Home' });
    expect(chatColumn()).toHaveStyle({ width: '360px' });
  });

  it('steps with the arrow keys, resets on double click and keeps the share', () => {
    rowWidth(1000);
    const { unmount } = render(area('split', 'test.split'));
    fireEvent.keyDown(divider(), { key: 'ArrowRight' });
    expect(chatColumn()).toHaveStyle({ width: '516px' });
    expect(JSON.parse(window.localStorage.getItem('test.split') ?? 'null')).toEqual({ share: 0.516 });
    unmount();
    render(area('split', 'test.split'));
    expect(chatColumn()).toHaveStyle({ width: '516px' });
    fireEvent.doubleClick(divider());
    expect(chatColumn()).toHaveStyle({ width: '500px' });
    expect(window.localStorage.getItem('test.split')).toBeNull();
  });

  it('shows the page alone when there is no room for two columns', () => {
    rowWidth(700);
    render(area('split'));
    expect(shownHeading('Thread')).not.toBeInTheDocument();
    expect(shownHeading('Page body')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('keeps a hidden column laid out, invisible, at the width it last had on screen', () => {
    rowWidth(1000);
    const { rerender } = render(area('split'));
    // The page full screen: the chat keeps its split width out of the flow, so nothing in it
    // measures 0 (a stick-to-bottom thread would take that for a jump to its end).
    rerender(area('page'));
    expect(chatColumn()).not.toHaveClass('hidden');
    // Painted at opacity 0, not `invisible`: a descendant's own `visibility: visible` (a remote
    // screen's canvas) would paint through that, and the inherited visibility would transition back.
    // Under the column on screen (`-z-10`), so nothing in it wins a hit test without `inert` either.
    expect(chatColumn()).toHaveClass('opacity-0', 'absolute', 'left-0', '-z-10', 'max-w-full');
    expect(chatColumn()).not.toHaveClass('invisible');
    expect(chatColumn()).toHaveStyle({ width: '500px' });
    expect(chatColumn()).toHaveAttribute('inert');
    expect(shownHeading('Thread')).not.toBeInTheDocument();
    // The chat full screen: the page keeps the whole row it last had.
    rerender(area('chat'));
    expect(pageColumn()).toHaveClass('opacity-0', 'absolute', 'right-0', '-z-10', 'max-w-full');
    expect(pageColumn()).toHaveStyle({ width: '1000px' });
    expect(shownHeading('Page body')).not.toBeInTheDocument();
    // Back side by side: both in the flow again, the chat at the width it left at.
    rerender(area('split'));
    for (const column of [chatColumn(), pageColumn()]) {
      expect(column).not.toHaveClass('opacity-0');
      expect(column).not.toHaveClass('absolute');
    }
    expect(chatColumn()).toHaveStyle({ width: '500px' });
  });

  it('leaves a column never shown yet out of the layout (display: none)', () => {
    rowWidth(1000);
    render(area('page'));
    expect(chatColumn()).toHaveClass('hidden');
    expect(chatColumn()).not.toHaveClass('opacity-0');
  });
});

describe('AppLayoutWorkArea squeezeFloor', () => {
  /** A column's body that says whether its column is squeezed. */
  function Column({ name }: { name: string }) {
    const column = useWorkAreaColumn();
    return <p>{`${name}: ${column?.squeezed ? 'squeezed' : 'full'} at ${column?.minWidth ?? '?'}`}</p>;
  }
  function squeezable(mode: AppLayoutWorkAreaMode = 'split') {
    return (
      <AppLayoutWorkArea mode={mode} chat={<Column name="chat" />} page={<Column name="page" />} squeezeFloor={0.3} />
    );
  }
  const shadow = () => screen.queryByTestId('work-area-squeeze-shadow');
  const shadowSides = () =>
    screen.queryAllByTestId('work-area-squeeze-shadow').map(element => element.getAttribute('data-work-area-shadow'));
  /** jsdom lays nothing out: give the chat column a sideways scroller's metrics, then scroll it. */
  function scrollChat(scrollLeft: number) {
    const column = chatColumn();
    Object.defineProperty(column, 'scrollWidth', { configurable: true, value: 360 });
    Object.defineProperty(column, 'clientWidth', { configurable: true, value: 108 });
    column.scrollLeft = scrollLeft;
    fireEvent.scroll(column);
  }

  it('lets the divider fold either column down to 30% of its min width', () => {
    rowWidth(1000);
    render(squeezable());
    expect(divider()).toHaveAttribute('aria-valuemin', '108');
    expect(divider()).toHaveAttribute('aria-valuemax', '892');
    expect(screen.getByText('chat: full at 360')).toBeInTheDocument();
    expect(screen.getByText('page: full at 360')).toBeInTheDocument();
    expect(shadow()).not.toBeInTheDocument();
  });

  it('squeezes the page past its min width: it keeps 360px of content, a shadow on its side', () => {
    rowWidth(1000);
    render(squeezable());
    fireEvent.keyDown(divider(), { key: 'End' });
    expect(chatColumn()).toHaveStyle({ width: '892px' });
    expect(screen.getByText('page: squeezed at 360')).toBeInTheDocument();
    expect(screen.getByText('chat: full at 360')).toBeInTheDocument();
    // Its content shows from its start: what is hidden is past its right edge, so the shadow is there.
    expect(shadowSides()).toEqual(['page-end']);
    expect(shadow()).toHaveClass('right-0', 'bg-gradient-to-l');
  });

  it('squeezes the chat the other way, and lets go once both fit again', () => {
    rowWidth(1000);
    render(squeezable());
    fireEvent.keyDown(divider(), { key: 'Home' });
    expect(chatColumn()).toHaveStyle({ width: '108px' });
    expect(screen.getByText('chat: squeezed at 360')).toBeInTheDocument();
    // The chat shows its start: its hidden end is at the divider.
    expect(shadowSides()).toEqual(['chat-end']);
    fireEvent.doubleClick(divider());
    expect(screen.getByText('chat: full at 360')).toBeInTheDocument();
    expect(shadow()).not.toBeInTheDocument();
  });

  it("follows a drag: squeezed as soon as the divider passes the other column's min width", () => {
    rowWidth(1000);
    render(squeezable());
    const grip = divider();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(divider(), { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(divider(), { clientX: 600, pointerId: 1 });
    expect(screen.getByText('page: full at 360')).toBeInTheDocument();
    fireEvent.pointerMove(divider(), { clientX: 2000, pointerId: 1 });
    // Written to the column while dragging, clamped at the floor of the page's side.
    expect(chatColumn()).toHaveStyle({ width: '892px' });
    expect(screen.getByText('page: squeezed at 360')).toBeInTheDocument();
    expect(shadowSides()).toEqual(['page-end']);
  });

  it('keeps the width a drag ends at for a column hidden after it', () => {
    rowWidth(1000);
    const { rerender } = render(squeezable());
    const grip = divider();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(divider(), { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(divider(), { clientX: 560, pointerId: 1 });
    fireEvent.pointerMove(divider(), { clientX: 600, pointerId: 1 });
    fireEvent.pointerUp(divider(), { clientX: 600, pointerId: 1 });
    expect(chatColumn()).toHaveStyle({ width: '600px' });
    // The kept width is recorded once the drag lands, not on its frames.
    rerender(squeezable('page'));
    expect(chatColumn()).toHaveStyle({ width: '600px' });
  });

  it('shades the side a squeezed column hides as it is scrolled: its end, both, then its start', () => {
    rowWidth(1000);
    render(squeezable());
    fireEvent.keyDown(divider(), { key: 'Home' });
    scrollChat(0);
    expect(shadowSides()).toEqual(['chat-end']);
    scrollChat(100);
    expect(shadowSides()).toEqual(['chat-end', 'chat-start']);
    scrollChat(252);
    expect(shadowSides()).toEqual(['chat-start']);
    // Its start's shadow is at the row's left edge, fading to the right.
    expect(shadow()).toHaveClass('left-0', 'bg-gradient-to-r');
  });

  it('folds no sidebar when the divider is dragged on past the floor: it just stops there', () => {
    rowWidth(1000);
    render(squeezable());
    const grip = divider();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(grip, { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(grip, { clientX: 1400, pointerId: 1 });
    // At the page's floor and no further: nothing outside the work area is asked to make room.
    expect(chatColumn()).toHaveStyle({ width: '892px' });
    fireEvent.pointerUp(grip, { clientX: 1400, pointerId: 1 });
    expect(chatColumn()).toHaveStyle({ width: '892px' });
  });

  it('keeps the dragged width when the row changes under the drag (a sidebar toggled, the window resized)', () => {
    rowWidth(1000);
    // jsdom has no ResizeObserver: one the test can fire, as the row's would.
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private readonly callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
          observers.push(() => this.callback());
        }
        observe() {}
        disconnect() {}
      },
    );
    render(squeezable());
    const grip = divider();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(grip, { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(grip, { clientX: 108, pointerId: 1 });
    expect(chatColumn()).toHaveStyle({ width: '108px' });
    // The row widens by 224px over a few frames, mid-drag (a sidebar folding, animated).
    for (const width of [1080, 1160, 1224]) {
      rowWidth(width);
      act(() => {
        for (const fire of observers) fire();
      });
      expect(chatColumn()).toHaveStyle({ width: '108px' });
      expect(screen.getByText('chat: squeezed at 360')).toBeInTheDocument();
    }
    vi.unstubAllGlobals();
  });

  it('holds the split in a row too narrow for two min widths: the chat keeps 360px, the page squeezes', () => {
    rowWidth(620);
    const shown = vi.fn();
    render(
      <AppLayoutWorkArea
        mode="split"
        chat={<Column name="chat" />}
        page={<Column name="page" />}
        squeezeFloor={0.3}
        onShownModeChange={shown}
      />,
    );
    expect(chatColumn()).toHaveStyle({ width: '360px' });
    expect(screen.getByText('chat: full at 360')).toBeInTheDocument();
    expect(screen.getByText('page: squeezed at 360')).toBeInTheDocument();
    expect(shown).toHaveBeenLastCalledWith('split');
  });

  it('keeps the chat at 360px in a narrow row whatever share a wider row stored', () => {
    window.localStorage.setItem('test.narrow', JSON.stringify({ share: 0.3 }));
    rowWidth(620);
    render(
      <AppLayoutWorkArea
        mode="split"
        chat={<Column name="chat" />}
        page={<Column name="page" />}
        squeezeFloor={0.3}
        storageKey="test.narrow"
      />,
    );
    expect(chatColumn()).toHaveStyle({ width: '360px' });
  });

  it('follows the divider in a narrow row once it is moved, and a double click returns the chat to 360px', () => {
    rowWidth(620);
    render(squeezable());
    fireEvent.keyDown(divider(), { key: 'Home' });
    expect(chatColumn()).toHaveStyle({ width: '108px' });
    expect(screen.getByText('chat: squeezed at 360')).toBeInTheDocument();
    fireEvent.doubleClick(divider());
    expect(chatColumn()).toHaveStyle({ width: '360px' });
  });

  it('shows the page alone, and says so, only below two floors', () => {
    rowWidth(200);
    const shown = vi.fn();
    render(
      <AppLayoutWorkArea
        mode="split"
        chat={<Column name="chat" />}
        page={<Column name="page" />}
        squeezeFloor={0.3}
        onShownModeChange={shown}
      />,
    );
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(chatColumn()).toHaveAttribute('inert');
    expect(shown).toHaveBeenLastCalledWith('page');
  });

  it('keeps a squeezed column squeezed while it is hidden, and shades it only on screen', () => {
    rowWidth(1000);
    const { rerender } = render(squeezable());
    fireEvent.keyDown(divider(), { key: 'Home' });
    expect(screen.getByText('chat: squeezed at 360')).toBeInTheDocument();
    // Hidden at its squeezed width, its content keeps the min width: it does not reflow on the way.
    rerender(squeezable('page'));
    expect(chatColumn()).toHaveStyle({ width: '108px' });
    expect(screen.getByText('chat: squeezed at 360')).toBeInTheDocument();
    expect(shadow()).not.toBeInTheDocument();
    rerender(squeezable());
    expect(shadowSides()).toEqual(['chat-end']);
  });

  it('without squeezeFloor no column is ever squeezed', () => {
    rowWidth(1000);
    render(<AppLayoutWorkArea mode="split" chat={<Column name="chat" />} page={<Column name="page" />} />);
    fireEvent.keyDown(divider(), { key: 'End' });
    expect(chatColumn()).toHaveStyle({ width: '640px' });
    expect(screen.getByText('page: full at 360')).toBeInTheDocument();
    expect(shadow()).not.toBeInTheDocument();
  });
});

describe('AppColumnHeader', () => {
  it('draws the title alone without actions, in the shell body style', () => {
    render(<AppColumnHeader title="Start Work" />);
    expect(screen.getByText('Start Work')).toBeInTheDocument();
    // Panel ground and the ODS v2 body text (16/20), on the window's tokens in a narrow column.
    expect(screen.getByText('Start Work')).toHaveClass('text-shell-body');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('names the layout and close buttons and calls them', () => {
    const onLayout = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <AppColumnHeader
        title="Devices"
        layoutAction="fullscreen"
        onLayoutAction={onLayout}
        onClose={onClose}
        closeLabel="Close page"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close page' }));
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<AppColumnHeader title="Devices" layoutAction="restore-split" onLayoutAction={onLayout} />);
    expect(screen.getByRole('button', { name: 'Show side by side' })).toBeInTheDocument();
  });

  it('draws restore split with its own glyph (ODS collapse-02), full screen with expand-01', () => {
    const glyph = (name: string) => screen.getByRole('button', { name }).innerHTML;
    const { rerender } = render(
      <AppColumnHeader title="Devices" layoutAction="fullscreen" onLayoutAction={() => undefined} />,
    );
    const fullScreen = glyph('Full screen');
    rerender(<AppColumnHeader title="Devices" layoutAction="restore-split" onLayoutAction={() => undefined} />);
    const restore = glyph('Show side by side');
    expect(restore).not.toBe(fullScreen);
    expect(restore).toContain(render(<Collapse02Icon className="h-5 w-5" />).container.innerHTML);
  });

  it('draws its cells as the chat column header does: 56px, a 20px primary glyph', () => {
    render(
      <AppColumnHeader
        title="Devices"
        layoutAction="fullscreen"
        onLayoutAction={() => undefined}
        onClose={() => undefined}
      />,
    );
    for (const name of ['Full screen', 'Close']) {
      const cell = screen.getByRole('button', { name });
      expect(cell).toHaveClass('w-14', 'text-ods-text-primary', '[&_svg]:h-5', '[&_svg]:w-5');
      expect(cell).not.toHaveClass('w-[var(--top-nav-cell,3.5rem)]', '[&_svg]:h-6');
    }
  });

  it('in a squeezed column keeps the title drawn and the square cells, which shrink only out of room', () => {
    render(
      <div data-testid="squeezed-column" data-squeezed="" className="group/work-area-page">
        <AppColumnHeader
          title="Devices"
          layoutAction="fullscreen"
          onLayoutAction={() => undefined}
          onClose={() => undefined}
        />
      </div>,
    );
    // The title truncates instead of leaving the cells alone in the bar: nothing is drawn only for assistive tech.
    expect(screen.getByText('Devices')).toBeInTheDocument();
    expect(screen.getByTestId('squeezed-column').innerHTML).not.toContain('sr-only');
    for (const name of ['Full screen', 'Close']) {
      const cell = screen.getByRole('button', { name });
      expect(cell).toHaveClass('w-14', 'group-data-[squeezed]/work-area-page:shrink');
      expect(cell).not.toHaveClass('group-data-[squeezed]/work-area-page:flex-1');
    }
  });
});

describe('AppLayout chatColumn and endSidebarConfig', () => {
  const mounts = { count: 0 };
  function Page() {
    useEffect(() => {
      mounts.count += 1;
    }, []);
    return <h1>Page</h1>;
  }

  function layout(mode: AppLayoutWorkAreaMode) {
    return (
      <AppLayout
        sidebarConfig={{ items: [], onNavigate: () => undefined }}
        endSidebarConfig={{
          variant: 'grouped',
          items: [{ id: 'devices', label: 'Devices', icon: <svg />, path: '/devices' }],
        }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        chatColumn={<p>thread</p>}
        workAreaMode={mode}
      >
        <Page />
      </AppLayout>
    );
  }

  it('draws a second sidebar on the right edge', () => {
    rowWidth(1200);
    render(layout('split'));
    const sidebars = screen.getAllByRole('complementary', { name: 'Main navigation sidebar' });
    expect(sidebars).toHaveLength(2);
    expect(sidebars[1]).toHaveClass('border-l');
  });

  it('switches modes without remounting the page', () => {
    rowWidth(1200);
    mounts.count = 0;
    const { rerender } = render(layout('split'));
    expect(screen.getByText('thread')).toBeInTheDocument();
    rerender(layout('page'));
    rerender(layout('chat'));
    rerender(layout('split'));
    expect(mounts.count).toBe(1);
  });
});

describe('AppLayout animateSidebars', () => {
  function layout(animateSidebars?: boolean) {
    return (
      <AppLayout
        sidebarConfig={{ items: [] }}
        endSidebarConfig={{ variant: 'sectioned', items: [] }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        chatColumn={<p>thread</p>}
        animateSidebars={animateSidebars}
      >
        <p>page</p>
      </AppLayout>
    );
  }

  it('snaps the sidebars beside a content area by default', () => {
    render(layout());
    for (const aside of screen.getAllByRole('complementary', { name: 'Main navigation sidebar' })) {
      expect(aside).toHaveClass('lg:transition-none');
    }
  });

  it('animates them with animateSidebars', () => {
    render(layout(true));
    for (const aside of screen.getAllByRole('complementary', { name: 'Main navigation sidebar' })) {
      expect(aside).not.toHaveClass('lg:transition-none');
    }
  });
});

describe('AppLayout pageHeader', () => {
  it('draws the bar over <main>, outside its scroll, and keeps the page mounted when it goes', () => {
    const mounts = { count: 0 };
    function Page() {
      useEffect(() => {
        mounts.count += 1;
      }, []);
      return <h1>Page</h1>;
    }
    const layout = (header: ReactNode) => (
      <AppLayout
        sidebarConfig={{ items: [] }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        chatColumn={<p>thread</p>}
        pageHeader={header}
      >
        <Page />
      </AppLayout>
    );
    const { rerender } = render(layout(<AppColumnHeader title="Devices" onClose={() => undefined} />));

    const main = screen.getByRole('main');
    const bar = screen.getByText('Devices');
    expect(main).not.toContainElement(bar);
    // Before <main> in the page column.
    expect(bar.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(layout(null));
    expect(screen.queryByText('Devices')).not.toBeInTheDocument();
    expect(mounts.count).toBe(1);
  });
});

describe('AppLayout chatColumn null', () => {
  it('keeps the page mounted when the chat column arrives later', () => {
    rowWidth(1200);
    const mounts = { count: 0 };
    function Page() {
      useEffect(() => {
        mounts.count += 1;
      }, []);
      return <h1>Page</h1>;
    }
    const layout = (chat: ReactNode, mode: AppLayoutWorkAreaMode) => (
      <AppLayout
        sidebarConfig={{ items: [] }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        chatColumn={chat}
        workAreaMode={mode}
      >
        <Page />
      </AppLayout>
    );
    const { rerender } = render(layout(null, 'split'));
    // No chat column at all: no region, the page alone.
    expect(screen.queryByRole('region', { hidden: true })).not.toBeInTheDocument();

    rerender(layout(<h2>Thread</h2>, 'split'));
    expect(screen.getByRole('heading', { name: 'Thread' })).toBeInTheDocument();
    expect(mounts.count).toBe(1);
  });
});

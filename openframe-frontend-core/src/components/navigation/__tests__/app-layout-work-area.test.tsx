/**
 * The chat column and the page column (`AppLayoutWorkArea`), the column header
 * (`AppColumnHeader`), and both wired into `AppLayout` (`chatColumn`,
 * `workAreaMode`, `endSidebarConfig`).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});

describe('AppLayoutWorkArea squeezeFloor', () => {
  /** A column's body that says whether its column is squeezed. */
  function Column({ name }: { name: string }) {
    const column = useWorkAreaColumn();
    return <p>{`${name}: ${column?.squeezed ? 'squeezed' : 'full'} at ${column?.minWidth ?? '?'}`}</p>;
  }
  function squeezable() {
    return (
      <AppLayoutWorkArea mode="split" chat={<Column name="chat" />} page={<Column name="page" />} squeezeFloor={0.3} />
    );
  }
  const shadow = () => screen.queryByTestId('work-area-squeeze-shadow');

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
    expect(shadow()).toHaveAttribute('data-work-area-shadow', 'page');
  });

  it('squeezes the chat the other way, and lets go once both fit again', () => {
    rowWidth(1000);
    render(squeezable());
    fireEvent.keyDown(divider(), { key: 'Home' });
    expect(chatColumn()).toHaveStyle({ width: '108px' });
    expect(screen.getByText('chat: squeezed at 360')).toBeInTheDocument();
    expect(shadow()).toHaveAttribute('data-work-area-shadow', 'chat');
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
    expect(shadow()).toHaveAttribute('data-work-area-shadow', 'page');
  });

  it('a drag on past the floor asks once for room on that side, again on the next drag', () => {
    rowWidth(1000);
    const onSqueezePast = vi.fn();
    render(
      <AppLayoutWorkArea
        mode="split"
        chat={<Column name="chat" />}
        page={<Column name="page" />}
        squeezeFloor={0.3}
        onSqueezePast={onSqueezePast}
      />,
    );
    const grip = divider();
    grip.setPointerCapture = vi.fn();
    grip.releasePointerCapture = vi.fn();
    // From 500px: the page's floor is at 892, so 920 is 28px past it (not enough), 960 is 68px.
    fireEvent.pointerDown(grip, { clientX: 500, pointerId: 1, button: 0 });
    fireEvent.pointerMove(grip, { clientX: 920, pointerId: 1 });
    expect(onSqueezePast).not.toHaveBeenCalled();
    fireEvent.pointerMove(grip, { clientX: 960, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientX: 1100, pointerId: 1 });
    expect(onSqueezePast).toHaveBeenCalledTimes(1);
    expect(onSqueezePast).toHaveBeenLastCalledWith('end');
    fireEvent.pointerUp(grip, { clientX: 1100, pointerId: 1 });

    // The chat's floor is at 108: from 892, 892 - 784 = 108, so 40 more px is past it.
    fireEvent.pointerDown(grip, { clientX: 1000, pointerId: 2, button: 0 });
    fireEvent.pointerMove(grip, { clientX: 1000 - 784 - 60, pointerId: 2 });
    expect(onSqueezePast).toHaveBeenCalledTimes(2);
    expect(onSqueezePast).toHaveBeenLastCalledWith('start');
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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from '../app-layout';

// jsdom lays nothing out: give every element the same width so the row the
// content and the panel share has a size to decide on.
function setLayoutWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
}

// No animation: the panel lands in the whole area at once.
function preferReducedMotion() {
  const original = window.matchMedia;
  vi.spyOn(window, 'matchMedia').mockImplementation(query =>
    query.includes('prefers-reduced-motion')
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        } as MediaQueryList)
      : original(query),
  );
}

function renderLayout(collapsed = false) {
  return render(
    <AppLayout
      sidebarConfig={{ items: [], onNavigate: () => undefined }}
      headerProps={{}}
      mobileBurgerMenuProps={{}}
      sidePanel={{
        label: 'Mingo',
        storageKey: 'test:side-panel',
        collapsed,
        children: ({ width, mode }) => (
          <p>
            panel {mode} {width}
          </p>
        ),
      }}
    >
      <h1>Page</h1>
    </AppLayout>,
  );
}

describe('AppLayout side panel', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('docks at its minimum beside an adaptive content area', () => {
    setLayoutWidth(1224);
    renderLayout();
    expect(screen.getByText('panel docked 296')).toBeInTheDocument();
    // The content area the `content-*` variants and the content tokens read:
    // the measured container, and the scope carrying the tokens inside it.
    expect(screen.getByRole('main')).toHaveClass('ods-content-area');
    expect(screen.getByRole('main')).toContainHTML('class="ods-content-scope"');
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Page' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mingo AI' })).not.toBeInTheDocument();
  });

  it('leaves <main> a plain viewport-laid page without a side panel', () => {
    render(
      <AppLayout sidebarConfig={{ items: [], onNavigate: () => undefined }} headerProps={{}} mobileBurgerMenuProps={{}}>
        <h1>Page</h1>
      </AppLayout>,
    );
    expect(screen.getByRole('main')).not.toHaveClass('ods-content-area');
    expect(screen.getByRole('main')).not.toContainHTML('ods-content-scope');
  });

  it('restores the stored width', () => {
    window.localStorage.setItem('test:side-panel', JSON.stringify({ width: 520, expanded: false }));
    setLayoutWidth(1224);
    renderLayout();
    expect(screen.getByText('panel docked 520')).toBeInTheDocument();
  });

  it('resizes from the keyboard and takes the whole area past the content minimum', () => {
    preferReducedMotion();
    setLayoutWidth(1224);
    renderLayout();
    const handle = screen.getByRole('separator', { name: 'Resize Mingo' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(screen.getByText('panel docked 312')).toBeInTheDocument();
    fireEvent.keyDown(handle, { key: 'End' });
    expect(screen.getByText(/panel full/)).toBeInTheDocument();
    expect(screen.getByRole('main', { hidden: true })).toHaveClass('hidden');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(screen.getByText('panel docked 296')).toBeInTheDocument();
  });

  it('grows over the content before hiding it, and shows it again at once on the way back', () => {
    vi.useFakeTimers();
    try {
      setLayoutWidth(1224);
      renderLayout();
      const handle = screen.getByRole('separator', { name: 'Resize Mingo' });
      fireEvent.keyDown(handle, { key: 'End' });
      expect(screen.getByText(/panel full/)).toBeInTheDocument();
      // Still laid out under the growing panel, with its layers kept below it.
      expect(screen.getByRole('main')).not.toHaveClass('hidden');
      expect(screen.getByRole('main')).toHaveClass('isolate');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole('main', { hidden: true })).toHaveClass('hidden');

      fireEvent.keyDown(handle, { key: 'Home' });
      expect(screen.getByText('panel docked 296')).toBeInTheDocument();
      expect(screen.getByRole('main')).not.toHaveClass('hidden');
    } finally {
      vi.useRealTimers();
    }
  });

  it('follows the pointer out of the whole area and settles on the nearer of the two', async () => {
    preferReducedMotion();
    // jsdom has no pointer capture.
    Object.assign(HTMLElement.prototype, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
    window.localStorage.setItem('test:side-panel', JSON.stringify({ width: 520, expanded: true }));
    setLayoutWidth(1224);
    renderLayout();
    const handle = screen.getByRole('separator', { name: 'Resize Mingo' });
    const fullWidth = 1224 - 2 * 16;
    const widestColumn = 1224 - 400 - 16;

    // Barely moved: the panel narrows under the pointer, the content shows
    // beneath it, and letting go returns it to the whole area.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 150 });
    expect(screen.getByText(`panel full ${fullWidth}`)).toBeInTheDocument();

    // Past halfway to the widest column: it settles there.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400 });
    // Moves land once per frame.
    await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
    expect(screen.getByRole('main')).not.toHaveClass('hidden');
    expect(screen.getByText(`panel docked ${fullWidth - 300}`)).toBeInTheDocument();
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 400 });
    expect(screen.getByText(`panel docked ${widestColumn}`)).toBeInTheDocument();
  });

  it('follows the pointer past the widest column and settles on the nearer of the two', async () => {
    preferReducedMotion();
    // jsdom has no pointer capture.
    Object.assign(HTMLElement.prototype, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() });
    setLayoutWidth(1224);
    renderLayout();
    const handle = screen.getByRole('separator', { name: 'Resize Mingo' });
    const widestColumn = 1224 - 400 - 16;

    // Past the widest column, short of halfway to the whole area: the panel is
    // drawn over the content under the pointer, and settles back on the column.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 1000 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 300 });
    await act(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
    expect(screen.getByText('panel docked 996')).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveClass('hidden');
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 300 });
    expect(screen.getByText(`panel docked ${widestColumn}`)).toBeInTheDocument();

    // Past halfway: it takes the whole area.
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 1000 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 700 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 700 });
    expect(screen.getByText(/panel full/)).toBeInTheDocument();
  });

  it('collapses one step at a time: the whole area back to its column, then the minimum', () => {
    preferReducedMotion();
    window.localStorage.setItem('test:side-panel', JSON.stringify({ width: 520, expanded: true }));
    setLayoutWidth(1224);
    render(
      <AppLayout
        sidebarConfig={{ items: [], onNavigate: () => undefined }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        sidePanel={{
          label: 'Mingo',
          storageKey: 'test:side-panel',
          children: ({ mode, width, collapsesTo, collapse }) => (
            <button type="button" onClick={collapse}>
              {`${mode} ${width} to ${collapsesTo ?? 'none'}`}
            </button>
          ),
        }}
      >
        <h1>Page</h1>
      </AppLayout>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^full \d+ to column$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'docked 520 to minimum' }));
    expect(screen.getByRole('button', { name: 'docked 296 to none' })).toBeInTheDocument();
  });

  it('moves behind the header button without room to dock', () => {
    setLayoutWidth(648);
    renderLayout();
    expect(screen.queryByText(/panel/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mingo AI' }));
    expect(screen.getByText(/panel full/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close Mingo AI' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(screen.getByRole('complementary', { name: 'Mingo' }), { key: 'Escape' });
    expect(screen.queryByText(/panel/)).not.toBeInTheDocument();
  });

  it('starts at the minimum on a collapsed page without forgetting the stored width', () => {
    window.localStorage.setItem('test:side-panel', JSON.stringify({ width: 520, expanded: false }));
    setLayoutWidth(1224);
    const { rerender } = renderLayout(true);
    expect(screen.getByText('panel docked 296')).toBeInTheDocument();
    rerender(
      <AppLayout
        sidebarConfig={{ items: [], onNavigate: () => undefined }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        sidePanel={{
          label: 'Mingo',
          storageKey: 'test:side-panel',
          children: ({ width, mode }) => (
            <p>
              panel {mode} {width}
            </p>
          ),
        }}
      >
        <h1>Page</h1>
      </AppLayout>,
    );
    expect(screen.getByText('panel docked 520')).toBeInTheDocument();
  });

  it('lets a host open it and tells the body when it can close', () => {
    setLayoutWidth(648);
    const onOpenChange = vi.fn();
    render(
      <AppLayout
        sidebarConfig={{ items: [], onNavigate: () => undefined }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        sidePanel={{
          label: 'Mingo',
          open: true,
          onOpenChange,
          children: ({ mode, canClose, close }) => (
            <button type="button" onClick={close}>
              {mode} {canClose ? 'closable' : 'fixed'}
            </button>
          ),
        }}
      >
        <h1>Page</h1>
      </AppLayout>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'full closable' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('cannot be closed while docked', () => {
    setLayoutWidth(1224);
    render(
      <AppLayout
        sidebarConfig={{ items: [], onNavigate: () => undefined }}
        headerProps={{}}
        mobileBurgerMenuProps={{}}
        sidePanel={{ label: 'Mingo', children: ({ mode, canClose }) => <p>{`${mode} ${canClose}`}</p> }}
      >
        <h1>Page</h1>
      </AppLayout>,
    );
    expect(screen.getByText('docked false')).toBeInTheDocument();
  });
});

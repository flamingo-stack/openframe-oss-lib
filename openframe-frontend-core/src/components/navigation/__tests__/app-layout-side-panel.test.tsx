import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from '../app-layout';

// jsdom lays nothing out: give every element the same width so the row the
// content and the panel share has a size to decide on.
function setLayoutWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
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
    expect(screen.getByRole('main')).toHaveClass('ods-content-area');
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Page' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mingo AI' })).not.toBeInTheDocument();
  });

  it('restores the stored width', () => {
    window.localStorage.setItem('test:side-panel', JSON.stringify({ width: 520, expanded: false }));
    setLayoutWidth(1224);
    renderLayout();
    expect(screen.getByText('panel docked 520')).toBeInTheDocument();
  });

  it('resizes from the keyboard and takes the whole area past the content minimum', () => {
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

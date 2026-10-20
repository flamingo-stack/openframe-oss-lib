import { fireEvent, render, screen, within } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useContentBreakpoint } from '../../../hooks/ui/use-content-breakpoint';
import { NotificationsProvider } from '../../features/notifications/notifications-context';
import { AppLayout, type AppLayoutProps } from '../app-layout';
import { NotificationsBellButton } from '../notifications-bell-button';

const mounts = { count: 0 };

/** A page that counts its mounts: a remount is a second effect run. */
function Page() {
  useEffect(() => {
    mounts.count += 1;
  }, []);
  return <h1>Page</h1>;
}

const SIDE_PANEL: NonNullable<AppLayoutProps['sidePanel']> = {
  label: 'Mingo',
  minWidth: 296,
  children: ({ mode }) => <p>panel {mode}</p>,
};

type SlotProps = Pick<
  AppLayoutProps,
  'sidePanel' | 'composerDock' | 'composerSheet' | 'contentCorner' | 'desktopHeader'
>;

function layout(props: SlotProps, children: ReactNode = <Page />) {
  return (
    <AppLayout
      sidebarConfig={{ items: [], onNavigate: () => undefined }}
      headerProps={{}}
      mobileBurgerMenuProps={{}}
      {...props}
    >
      {children}
    </AppLayout>
  );
}

/**
 * The layout's markup. These tests are about WHERE the slots hang (outside the
 * scroll container, in which box), which no role query can reach: the slot
 * wrappers are role-less boxes. So they read the serialized tree instead of
 * walking nodes.
 */
function markup() {
  return document.body.innerHTML;
}

/** What the dock reads: the content area's breakpoint, or the viewport's outside one. */
function BreakpointProbe({ name }: { name: string }) {
  return (
    <p>
      {name} {useContentBreakpoint() ?? 'unknown'}
    </p>
  );
}

describe('AppLayout page subtree', () => {
  afterEach(() => {
    mounts.count = 0;
    vi.restoreAllMocks();
  });

  it('keeps the page mounted while the side panel comes and goes', () => {
    const { rerender } = render(layout({}));
    rerender(layout({ sidePanel: SIDE_PANEL }));
    expect(screen.getByText('panel docked')).toBeInTheDocument();
    rerender(layout({}));
    rerender(layout({ sidePanel: SIDE_PANEL }));
    expect(mounts.count).toBe(1);
  });

  it('keeps the page mounted while the dock, the corner and the desktop header change', () => {
    const { rerender } = render(layout({}));
    rerender(layout({ composerDock: <p>dock</p> }));
    rerender(layout({ composerDock: <p>dock</p>, contentCorner: <p>bell</p>, desktopHeader: false }));
    rerender(layout({ composerDock: null, contentCorner: <p>bell</p>, sidePanel: SIDE_PANEL }));
    rerender(layout({}));
    expect(mounts.count).toBe(1);
  });
});

describe('AppLayout composerDock', () => {
  afterEach(() => vi.restoreAllMocks());

  it('docks under <main>, outside the scroll container, in the content area', () => {
    render(layout({ composerDock: <p>dock</p> }));
    const main = screen.getByRole('main');
    expect(within(main).queryByText('dock')).not.toBeInTheDocument();
    // Both sides of the column follow the content width: <main> is the
    // measured area, and the dock — its next sibling, in the same column —
    // carries its own container + token scope.
    expect(main).toHaveClass('ods-content-area');
    expect(markup()).toMatch(
      /<\/main><div class="ods-content-area shrink-0"><div class="ods-content-scope"><p>dock<\/p><\/div><\/div><\/div>/,
    );
  });

  it('hands the dock the measured content width', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    render(layout({ composerDock: <BreakpointProbe name="dock" /> }, <BreakpointProbe name="page" />));
    expect(screen.getByText('dock mobile')).toBeInTheDocument();
    expect(screen.getByText('page mobile')).toBeInTheDocument();
  });

  it('keeps the slot with an empty dock', () => {
    render(layout({ composerDock: null }));
    expect(screen.getByRole('main')).toHaveClass('ods-content-area');
  });

  it('leaves the layout as it was without one', () => {
    render(layout({}));
    expect(screen.getByRole('main')).not.toHaveClass('ods-content-area');
    // Box-less wrappers (`display: contents`) around and inside <main>, so
    // <main> stays the row's flex item and the page its block child; nothing
    // after <main> in the column.
    expect(markup()).toMatch(
      /<div class="contents"><main class="flex-1 overflow-y-auto"><div class="contents"><h1>Page<\/h1><\/div><\/main><\/div>/,
    );
  });
});

describe('AppLayout composerSheet', () => {
  afterEach(() => {
    mounts.count = 0;
    vi.restoreAllMocks();
  });

  it('lays the sheet over the page, between <main> and the dock, outside the scroll container', () => {
    render(layout({ composerDock: <p>dock</p>, composerSheet: <p>sheet</p> }));
    expect(within(screen.getByRole('main')).queryByText('sheet')).not.toBeInTheDocument();
    expect(markup()).toMatch(
      /<\/main><div data-composer-sheet-layer="" class="ods-content-area pointer-events-none absolute inset-x-0 top-0 z-40" style="bottom: 0px;"><div class="ods-content-scope"><p>sheet<\/p><\/div><\/div><div class="ods-content-area shrink-0">/,
    );
  });

  it('draws no layer for an empty sheet, nor without a dock', () => {
    const { rerender } = render(layout({ composerDock: <p>dock</p>, composerSheet: null }));
    expect(markup()).not.toContain('data-composer-sheet-layer');
    rerender(layout({ composerSheet: <p>sheet</p> }));
    expect(screen.queryByText('sheet')).not.toBeInTheDocument();
  });

  it('keeps the page and the dock mounted while the sheet comes and goes', () => {
    const { rerender } = render(layout({ composerDock: <p>dock</p> }));
    rerender(layout({ composerDock: <p>dock</p>, composerSheet: <p>sheet</p> }));
    rerender(layout({ composerDock: <p>dock</p>, composerSheet: false }));
    rerender(layout({ composerDock: <p>dock</p>, composerSheet: <p>sheet</p> }));
    expect(mounts.count).toBe(1);
  });

  it('hands the sheet the measured content width', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    render(layout({ composerDock: <p>dock</p>, composerSheet: <BreakpointProbe name="sheet" /> }));
    expect(screen.getByText('sheet mobile')).toBeInTheDocument();
  });
});

describe('AppLayout composer dock height', () => {
  afterEach(() => vi.restoreAllMocks());

  it("publishes the dock's height to the page column, for a phone's pinned action bar", () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(132);
    render(layout({ composerDock: <p>dock</p> }));
    expect(markup()).toMatch(/style="--of-composer-dock-height: 132px;"[^>]*>(?:(?!<main).)*<main/s);
  });

  it('publishes nothing without a dock', () => {
    render(layout({ composerDock: undefined }));
    expect(markup()).not.toContain('--of-composer-dock-height');
  });
});

describe('AppLayout desktopHeader + contentCorner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the header at every width by default', () => {
    render(layout({}));
    expect(screen.getByRole('banner')).not.toHaveClass('md:hidden');
  });

  it('keeps the phone top bar and drops the desktop header', () => {
    render(layout({ desktopHeader: false }));
    // In CSS, so the first paint is right at every width.
    expect(screen.getByRole('banner')).toHaveClass('md:hidden');
  });

  it('puts the corner over the main column, from md only', () => {
    render(layout({ contentCorner: <p>bell</p>, sidePanel: SIDE_PANEL }));
    expect(within(screen.getByRole('main')).queryByText('bell')).not.toBeInTheDocument();
    // Anchored to the positioned column <main> sits in — not to the row the
    // side panel shares — and displayed from md only.
    expect(markup()).toMatch(
      /<div class="relative flex [^"]*"><div class="absolute [^"]*\bhidden\b[^"]*\bmd:flex"><p>bell<\/p><\/div><main /,
    );
  });

  it('opens and closes the notification drawer from a bell without the header', () => {
    render(
      <NotificationsProvider initialNotifications={[{ id: 'n1', title: 'Disk almost full', createdAt: Date.now() }]}>
        {layout({ desktopHeader: false, contentCorner: <NotificationsBellButton variant="floating" /> })}
      </NotificationsProvider>,
    );
    // The only bell: the phone top bar was given none.
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('New Notifications')).toBeInTheDocument();
    expect(screen.getByText('Disk almost full')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByText('New Notifications'), { key: 'Escape' });
    expect(screen.queryByText('New Notifications')).not.toBeInTheDocument();
  });
});

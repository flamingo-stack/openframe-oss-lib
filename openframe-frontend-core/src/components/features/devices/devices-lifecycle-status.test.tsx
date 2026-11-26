import type { ColumnFiltersState, Updater } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mockPush } from '../../../../vitest.setup';
import { DeviceCard } from '../../ui/device-card';
import { IdleIntersectionObserver } from '../feature-tables.fixtures';
import { DeviceLifecycleTag } from './device-lifecycle-tag';
import { DeviceSelector } from './device-selector/device-selector';
import { DeviceStatusDisplayProvider } from './device-status-display';
import { DeviceOutdatedIcon } from './device-status-hint';
import { ARCHIVE_LIFECYCLE_STATUSES } from './device-statuses';
import { DevicesGrid } from './devices-grid';
import { DevicesTableBody, getDeviceTableColumns } from './devices-table-columns';
import { DevicesViewConfigProvider } from './devices-view-config';
import type { DeviceFilters, DeviceRow } from './types';

/**
 * An outdated client never hides the lifecycle tag (CU-17tkuw6818w): in the lifecycle display the status is the tag
 * after the device's name (none for a managed device), an outdated agent is an orange mark after it, the status funnel
 * sits on DEVICE and LAST SEEN takes the STATUS column's place. The legacy display stays as it was.
 */

const OUTDATED_HINT = 'Outdated agent. Reinstall it to keep this device connected.';
const PENDING_HINT_FIRST = 'Not managed yet: OpenFrame is still connecting this device.';
const PENDING_HINT_SECOND = 'It turns Managed when setup finishes.';
const SEEN = '2026-11-24T11:58:00Z';

function device(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: 'd-1',
    machineId: 'm-1',
    hostname: 'hl-ws-210',
    nickname: null,
    status: 'MANAGED',
    connectivity: 'ONLINE',
    last_seen: SEEN,
    ...overrides,
  };
}

const legacy = ({ children }: { children: ReactNode }) => (
  <DeviceStatusDisplayProvider display="legacy">{children}</DeviceStatusDisplayProvider>
);

const withHref = ({ children }: { children: ReactNode }) => (
  <DevicesViewConfigProvider value={{ getDeviceHref: d => `/devices/${d.machineId}` }}>
    {children}
  </DevicesViewConfigProvider>
);

const outdatedIcon = () => screen.queryByRole('img', { name: OUTDATED_HINT });

/** The rendered markup: what a role-less part (the name's status line, a card's status row) is checked in. */
function markup(container: HTMLElement): string {
  return container.innerHTML;
}

/** The classes of the box that holds the device's name (the name's tooltip trigger). */
function nameBoxClasses(container: HTMLElement): string[] {
  return /class="([^"]*)"[^>]*><span[^>]*>hl-ws-210</.exec(markup(container))?.[1]?.split(' ') ?? [];
}

/** The classes of a card's status row in its `statusLine` form; null when the card draws none. */
function cardStatusRowClasses(container: HTMLElement): string[] | null {
  return /<div class="([^"]*)" data-device-card-status/.exec(markup(container))?.[1]?.split(' ') ?? null;
}

/** Moves keyboard focus onto the control (its tooltip opens on focus, as on hover) and returns the tooltip. */
function focusTooltip(control: HTMLElement): Promise<HTMLElement> {
  fireEvent.focusIn(control);
  return screen.findByRole('tooltip');
}

describe('the DEVICE cell in the lifecycle display, both renderers', () => {
  const cases = [
    { status: 'MANAGED', tag: null, outdatedMark: true },
    { status: 'PENDING', tag: 'PENDING', outdatedMark: true },
    { status: 'PENDING_DELETION', tag: 'PENDING DELETION', outdatedMark: false },
  ] as const;

  for (const layout of ['cards', 'grid'] as const) {
    for (const { status, tag, outdatedMark } of cases) {
      for (const clientOutdated of [false, true]) {
        it(`${layout}: ${status}, ${clientOutdated ? 'outdated' : 'supported'} client`, () => {
          const { container } = render(
            <DevicesTableBody devices={[device({ status, clientOutdated })]} layout={layout} />,
          );
          const html = markup(container);
          const shown = clientOutdated && outdatedMark;
          // A managed device carries no tag; any other status keeps its own, never OUTDATED.
          expect(screen.queryByText('MANAGED')).toBeNull();
          expect(screen.queryByText('OUTDATED')).toBeNull();
          expect(tag === null || screen.queryByText(tag) !== null).toBe(true);
          expect(outdatedIcon() !== null).toBe(shown);
          // The name, then the tag, then the mark.
          expect(html.includes('data-device-name-status')).toBe(tag !== null);
          const order = [
            html.indexOf('hl-ws-210'),
            tag === null ? -1 : html.indexOf(`>${tag}<`),
            html.indexOf('data-device-outdated'),
          ].filter(index => index !== -1);
          expect(order).toEqual([...order].sort((a, b) => a - b));
        });
      }
    }
  }

  it('grid: keeps the unread mark last, after the tag and the outdated mark', () => {
    const { container } = render(
      <DevicesTableBody
        devices={[device({ status: 'PENDING', clientOutdated: true, unreadNotificationCount: 2 })]}
        layout="grid"
      />,
    );
    const html = markup(container).slice(markup(container).indexOf('data-grid-body'));
    expect(html).toMatch(/data-part="tag"[\s\S]*data-device-outdated[\s\S]*data-part="trailing"/);
  });

  it('grid: puts the tag right after the name, not at the end of the line', () => {
    const { container } = render(<DevicesTableBody devices={[device({ status: 'PENDING' })]} layout="grid" />);
    expect(nameBoxClasses(container)).toContain('min-w-0');
    expect(nameBoxClasses(container)).not.toContain('flex-1');
  });

  describe('in a narrow cell (a saved width of 148)', () => {
    const TAG_BOX_FLOOR = 'max-w-[calc(100%_-_5rem_-_var(--spacing-system-xxs))]';
    /** The classes of the box the name's tag sits in: the grid cell's tag slot, or the card row's tag box. */
    const tagBoxClasses = (container: HTMLElement): string[] =>
      (/data-part="tag" class="([^"]*)"/.exec(markup(container)) ??
        /data-device-name-tag="[^"]*" class="([^"]*)"/.exec(markup(container)))?.[1]?.split(' ') ?? [];
    /** The classes of the box that holds the name in a card row (around the name's tooltip trigger). */
    const cardNameBoxClasses = (container: HTMLElement): string[] =>
      /<div class="([^"]*)"><div class="[^"]*"[^>]*><span[^>]*>hl-ws-210</.exec(markup(container))?.[1]?.split(' ') ??
      [];

    for (const layout of ['cards', 'grid'] as const) {
      it(`${layout}: the name keeps a floor and the tag gives way, cut by its own label; the mark never shrinks`, () => {
        const { container } = render(
          <DevicesTableBody
            devices={[device({ status: 'PENDING_DELETION', clientOutdated: false, unreadNotificationCount: 1 })]}
            layout={layout}
          />,
        );
        // The name gives way first, but the tag's box may never take the line's last 5rem: that is the name's floor
        // (a shorter name keeps its own width, the room it leaves goes to the line's end).
        const nameBox = layout === 'grid' ? nameBoxClasses(container) : cardNameBoxClasses(container);
        expect(nameBox).toContain('flex-[0_9999_auto]');
        expect(tagBoxClasses(container)).toEqual(expect.arrayContaining(['min-w-0', TAG_BOX_FLOOR]));
        expect(tagBoxClasses(container)).not.toContain('shrink-0');
        // The tag itself can narrow and clips to its box; its label cuts itself.
        expect(markup(container)).toMatch(
          /class="[^"]*\bmin-w-0\b[^"]*\boverflow-hidden\b[^"]*" data-device-name-status/,
        );
      });
    }

    it("grid: the PENDING tag's hint narrows with it, and the outdated mark keeps its width", () => {
      const { container } = render(
        <DevicesTableBody devices={[device({ status: 'PENDING', clientOutdated: true })]} layout="grid" />,
      );
      expect(markup(container)).toMatch(/data-device-tag-hint="[^"]*" class="[^"]*\bmin-w-0\b/);
      expect(markup(container)).not.toMatch(/data-device-tag-hint="[^"]*" class="[^"]*\bshrink-0\b/);
      expect(markup(container)).toMatch(/data-part="mark" class="flex shrink-0"/);
    });
  });

  it('draws no tag, mark or bar for a row still being read', () => {
    const { container } = render(<DevicesTableBody devices={[]} isLoading layout="grid" />);
    expect(markup(container)).toContain('data-grid-body');
    expect(markup(container)).not.toContain('data-device-name-status');
  });

  it('still draws the empty state', () => {
    render(<DevicesTableBody devices={[]} emptyState={{ title: 'No devices yet' }} />);
    expect(screen.getByText('No devices yet')).toBeTruthy();
  });

  it('legacy display: the name stands alone and OUTDATED replaces the STATUS tag, as before', () => {
    const { container } = render(<DevicesTableBody devices={[device({ status: 'PENDING', clientOutdated: true })]} />, {
      wrapper: legacy,
    });
    expect(markup(container)).not.toContain('data-device-name-status');
    expect(outdatedIcon()).toBeNull();
    expect(screen.getByText('OUTDATED')).toBeTruthy();
    expect(screen.queryByText('PENDING')).toBeNull();
  });
});

describe('DeviceOutdatedIcon', () => {
  it('draws nothing unless the server flags the client', () => {
    for (const clientOutdated of [false, undefined, null]) {
      const { container, unmount } = render(<DeviceOutdatedIcon clientOutdated={clientOutdated} status="MANAGED" />);
      expect(container.innerHTML).toBe('');
      unmount();
    }
  });

  it('draws nothing on a device that is an archive or about to become one, in any case', () => {
    for (const status of [...ARCHIVE_LIFECYCLE_STATUSES, 'pending_deletion', 'Deleted']) {
      const { container, unmount } = render(<DeviceOutdatedIcon clientOutdated status={status} />);
      expect(container.innerHTML).toBe('');
      unmount();
    }
  });

  it('is an orange mark named by its tooltip, which opens on keyboard focus', async () => {
    render(<DeviceOutdatedIcon clientOutdated status="MANAGED" />);
    const icon = screen.getByRole('img', { name: OUTDATED_HINT });
    expect(icon.className).toContain('text-ods-warning');
    expect(icon.tabIndex).toBe(0);
    expect(await focusTooltip(icon)).toHaveTextContent(OUTDATED_HINT);
  });

  it('opens its tooltip on a tap', async () => {
    render(<DeviceOutdatedIcon clientOutdated status="PENDING" />);
    fireEvent.pointerDown(screen.getByRole('img', { name: OUTDATED_HINT }), { pointerType: 'touch' });
    expect(await screen.findByRole('tooltip')).toHaveTextContent(OUTDATED_HINT);
  });

  it('a click or tap on it inside a card never opens the device', async () => {
    const onDeviceClick = vi.fn();
    render(
      <DeviceCard
        device={{ name: 'hl-ws-210' }}
        statusLine={{ text: 'Managed', adornment: <DeviceOutdatedIcon clientOutdated status="MANAGED" /> }}
        onDeviceClick={onDeviceClick}
      />,
    );
    const icon = screen.getByRole('img', { name: OUTDATED_HINT });
    fireEvent.pointerDown(icon, { pointerType: 'touch' });
    fireEvent.click(icon);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(OUTDATED_HINT);
    // A click on the open tooltip (portalled, but still inside the card in React's tree) stays its own too.
    fireEvent.click(screen.getByRole('tooltip'));
    expect(onDeviceClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('hl-ws-210'));
    expect(onDeviceClick).toHaveBeenCalledTimes(1);
  });

  it('a tap on it in a grid card does not navigate to the device', () => {
    render(<DevicesGrid devices={[device({ clientOutdated: true })]} isLoading={false} />, { wrapper: withHref });
    const icon = screen.getByRole('img', { name: OUTDATED_HINT });
    fireEvent.pointerDown(icon, { pointerType: 'touch' });
    fireEvent.click(icon);
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('hl-ws-210'));
    expect(mockPush).toHaveBeenCalledWith('/devices/m-1');
  });

  for (const layout of ['cards', 'grid'] as const) {
    it(`${layout}: a click on it does not follow the row's link`, () => {
      render(<DevicesTableBody devices={[device({ status: 'PENDING', clientOutdated: true })]} layout={layout} />, {
        wrapper: withHref,
      });
      // `fireEvent` answers false when the click's default (following the link) was prevented.
      expect(fireEvent.click(screen.getByRole('img', { name: OUTDATED_HINT }))).toBe(false);
    });
  }
});

describe('the PENDING tag hint', () => {
  it('opens on keyboard focus with its two lines', async () => {
    const { container } = render(<DeviceLifecycleTag status="PENDING" pendingHint />);
    // The tag sits in a focusable box: focus reaches it from the tag's label.
    expect(markup(container)).toMatch(/tabindex="0" data-device-tag-hint/);
    const tooltip = await focusTooltip(screen.getByText('PENDING'));
    expect(tooltip).toHaveTextContent(PENDING_HINT_FIRST);
    expect(tooltip).toHaveTextContent(PENDING_HINT_SECOND);
  });

  it('opens on a tap, in the table row', async () => {
    render(<DevicesTableBody devices={[device({ status: 'PENDING' })]} layout="grid" />, { wrapper: withHref });
    const tag = screen.getByText('PENDING');
    fireEvent.pointerDown(tag, { pointerType: 'touch' });
    expect(await screen.findByRole('tooltip')).toHaveTextContent(PENDING_HINT_FIRST);
    expect(fireEvent.click(tag)).toBe(false);
  });

  it('is on the PENDING tag only, in the lifecycle display only, and only when asked', () => {
    const { container, rerender } = render(<DeviceLifecycleTag status="PENDING_DELETION" pendingHint />);
    expect(markup(container)).not.toContain('data-device-tag-hint');
    rerender(<DeviceLifecycleTag status="MANAGED" pendingHint />);
    expect(markup(container)).not.toContain('data-device-tag-hint');
    // Not asked: a picker row keeps its whole row clickable.
    rerender(<DeviceLifecycleTag status="PENDING" />);
    expect(markup(container)).not.toContain('data-device-tag-hint');
    rerender(
      <DeviceStatusDisplayProvider display="legacy">
        <DeviceLifecycleTag status="PENDING" pendingHint />
      </DeviceStatusDisplayProvider>,
    );
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(markup(container)).not.toContain('data-device-tag-hint');
  });

  it('a tap on it in a grid card does not navigate to the device', async () => {
    render(<DevicesGrid devices={[device({ status: 'PENDING', clientOutdated: true })]} isLoading={false} />, {
      wrapper: withHref,
    });
    const tag = screen.getByText('PENDING');
    fireEvent.pointerDown(tag, { pointerType: 'touch' });
    fireEvent.click(tag);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(PENDING_HINT_SECOND);
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('the columns in the lifecycle display', () => {
  /** The grid header's column ids, in order. */
  function gridColumnIds(container: HTMLElement): string[] {
    const html = markup(container);
    const header = html.slice(html.indexOf('data-grid-header="'), html.indexOf('data-grid-body'));
    return [...header.matchAll(/data-grid-header-cell="[^"]*" data-grid-col="([^"]+)"/g)].map(match => match[1] ?? '');
  }

  it('are DEVICE · LAST SEEN · OS · CUSTOMER, with no STATUS column', () => {
    const { container } = render(<DevicesTableBody devices={[device()]} layout="grid" />);
    expect(gridColumnIds(container).filter(id => id !== 'open')).toEqual(['device', 'lastSeen', 'os', 'organization']);
    expect(screen.getByText('LAST SEEN')).toBeTruthy();
    expect(screen.queryByText('STATUS')).toBeNull();
  });

  it('LAST SEEN prints the date and time, and "—" for a device never seen, in both renderers', () => {
    for (const layout of ['cards', 'grid'] as const) {
      const { container, unmount } = render(
        <DevicesTableBody
          devices={[device(), device({ id: 'd-2', machineId: 'm-2', hostname: 'never', last_seen: undefined })]}
          layout={layout}
        />,
      );
      expect(markup(container)).toMatch(/11\/24\/26/);
      expect(screen.getAllByText('—')).toHaveLength(1);
      unmount();
    }
  });

  it('LAST SEEN reads `lastSeen` where the row has no `last_seen`', () => {
    render(<DevicesTableBody devices={[device({ last_seen: undefined, lastSeen: SEEN })]} layout="grid" />);
    expect(screen.queryByText('—')).toBeNull();
  });

  it('LAST SEEN is 180 wide in the grid and hidden below md in card rows; DEVICE is 380 and cannot be hidden', () => {
    const columns = getDeviceTableColumns();
    const lastSeen = columns.find(column => column.id === 'lastSeen');
    expect(lastSeen?.header).toBe('LAST SEEN');
    // A day-first date and time ("26/11/2026 15:27") fits whole.
    expect(lastSeen?.size).toBe(180);
    // The name shares its line with the tag and the mark (Figma 5262:159608 draws it 379 wide).
    expect(columns.find(column => column.id === 'device')?.size).toBe(380);
    expect(lastSeen?.meta?.label).toBe('Last seen');
    expect(lastSeen?.meta?.hideAt).toBe('md');
    expect(columns.find(column => column.id === 'device')?.enableHiding).toBe(false);
  });

  it('legacy display: the columns are as before (STATUS, no LAST SEEN, DEVICE without a funnel)', () => {
    const columns = getDeviceTableColumns(null, false, { statusDisplay: 'legacy' });
    expect(columns.map(column => column.id)).toEqual(['device', 'status', 'os', 'organization']);
    const deviceColumn = columns.find(column => column.id === 'device');
    expect(deviceColumn?.size).toBe(280);
    expect(deviceColumn?.enableHiding).toBeUndefined();
    expect(deviceColumn?.meta?.filter).toBeUndefined();
    expect(columns.find(column => column.id === 'status')?.meta?.filter?.id).toBeUndefined();
  });
});

describe('the status funnel on DEVICE', () => {
  const FACETS: DeviceFilters = {
    statuses: [
      { value: 'MANAGED', count: 3 },
      { value: 'PENDING', count: 2 },
    ],
    connectivity: [{ value: 'ONLINE', count: 3 }],
    clientOutdated: [{ value: 'true', count: 1 }],
    deviceTypes: [],
    osTypes: [{ value: 'WINDOWS', count: 5 }],
    organizationIds: [],
    tagKeys: [],
    filteredCount: 5,
  };

  /** A host holding the table's filters, as the devices pages do; `onChange` sees what the table hands it. */
  function Host({
    layout,
    initial,
    onChange,
    disableColumnFilters,
  }: {
    layout: 'cards' | 'grid';
    initial: ColumnFiltersState;
    onChange: (updater: Updater<ColumnFiltersState>, next: ColumnFiltersState) => void;
    disableColumnFilters?: string[];
  }) {
    const [filters, setFilters] = useState<ColumnFiltersState>(initial);
    return (
      <DevicesTableBody
        devices={[device()]}
        deviceFilters={FACETS}
        layout={layout}
        columnFilters={filters}
        disableColumnFilters={disableColumnFilters}
        onColumnFiltersChange={updater => {
          const next = typeof updater === 'function' ? updater(filters) : updater;
          onChange(updater, next);
          setFilters(next);
        }}
      />
    );
  }

  for (const layout of ['cards', 'grid'] as const) {
    it(`${layout}: is titled Status and hands the host only a \`status\` entry, through a functional updater`, () => {
      const onChange = vi.fn();
      render(<Host layout={layout} initial={[{ id: 'os', value: ['WINDOWS'] }]} onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Filter by Status'));
      expect(screen.getByRole('heading', { name: 'Status' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Connectivity' })).toBeTruthy();
      expect(screen.getByRole('button', { name: /OUTDATED/ })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /PENDING/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      const [updater, next] = onChange.mock.lastCall as [Updater<ColumnFiltersState>, ColumnFiltersState];
      expect(typeof updater).toBe('function');
      expect(next).toEqual([
        { id: 'os', value: ['WINDOWS'] },
        { id: 'status', value: ['PENDING'] },
      ]);
      expect(next.some(filter => filter.id === 'device')).toBe(false);
    });

    it(`${layout}: reads the host's \`status\` value and replaces it in place; Reset drops only it`, () => {
      const onChange = vi.fn();
      render(
        <Host
          layout={layout}
          initial={[
            { id: 'status', value: ['MANAGED', 'connectivity:ONLINE'] },
            { id: 'os', value: ['WINDOWS'] },
          ]}
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByLabelText('Filter by Status'));
      fireEvent.click(screen.getByRole('button', { name: /PENDING/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect((onChange.mock.lastCall as [unknown, ColumnFiltersState])[1]).toEqual([
        { id: 'status', value: ['MANAGED', 'PENDING', 'connectivity:ONLINE'] },
        { id: 'os', value: ['WINDOWS'] },
      ]);

      fireEvent.click(screen.getByLabelText('Filter by Status'));
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect((onChange.mock.lastCall as [unknown, ColumnFiltersState])[1]).toEqual([{ id: 'os', value: ['WINDOWS'] }]);
    });

    it(`${layout}: disableColumnFilters ['status'] drops it, as on the archive page`, () => {
      render(<Host layout={layout} initial={[]} onChange={vi.fn()} disableColumnFilters={['status']} />);
      expect(screen.queryByLabelText('Filter by Status')).toBeNull();
      expect(screen.getByText('DEVICE')).toBeTruthy();
    });
  }

  it('legacy display: stays on the STATUS column, titled STATUS', () => {
    render(<Host layout="grid" initial={[]} onChange={vi.fn()} />, { wrapper: legacy });
    expect(screen.getByLabelText('Filter by STATUS')).toBeTruthy();
    expect(screen.queryByLabelText('Filter by Status')).toBeNull();
  });
});

describe('the grid cards in the lifecycle display', () => {
  it('a managed device reads "Managed · Last seen <date>" in place of a tag, then the outdated mark', () => {
    const { container } = render(<DevicesGrid devices={[device({ clientOutdated: true })]} isLoading={false} />);
    expect(cardStatusRowClasses(container)).toContain('h-8');
    expect(screen.getByText(/^Managed · Last seen 11\/24\/26 /)).toBeTruthy();
    expect(outdatedIcon()).not.toBeNull();
    expect(markup(container)).toMatch(/Managed · Last seen[\s\S]*data-device-outdated/);
    expect(screen.queryByText('MANAGED')).toBeNull();
    expect(screen.queryByText('Last Seen:')).toBeNull();
  });

  it('a managed device never seen reads "Managed"', () => {
    render(<DevicesGrid devices={[device({ last_seen: undefined })]} isLoading={false} />);
    expect(screen.getByText('Managed')).toBeTruthy();
  });

  it('any other status keeps its tag, then the outdated mark, and no "Last seen"', () => {
    const { container } = render(
      <DevicesGrid devices={[device({ status: 'PENDING', clientOutdated: true })]} isLoading={false} />,
    );
    expect(cardStatusRowClasses(container)).toContain('h-8');
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(outdatedIcon()).not.toBeNull();
    expect(markup(container)).toMatch(/>PENDING<[\s\S]*data-device-outdated/);
    expect(screen.queryByText(/Last seen/i)).toBeNull();
  });

  it('a device pending deletion keeps its tag and has no outdated mark', () => {
    render(<DevicesGrid devices={[device({ status: 'PENDING_DELETION', clientOutdated: true })]} isLoading={false} />);
    expect(screen.getByText('PENDING DELETION')).toBeTruthy();
    expect(screen.queryByText('OUTDATED')).toBeNull();
    expect(outdatedIcon()).toBeNull();
  });

  it('legacy display: the tag (OUTDATED for an outdated client) and "Last Seen:", as before', () => {
    const { container } = render(
      <DevicesGrid devices={[device({ clientOutdated: true, lastSeen: SEEN })]} isLoading={false} />,
      { wrapper: legacy },
    );
    expect(screen.getByText('OUTDATED')).toBeTruthy();
    expect(screen.getByText('Last Seen:')).toBeTruthy();
    expect(cardStatusRowClasses(container)).toBeNull();
    expect(outdatedIcon()).toBeNull();
  });

  it('still draws its skeleton cards and its empty message', () => {
    const { container, rerender } = render(<DevicesGrid devices={[]} isLoading />);
    expect(markup(container)).toContain('data-loading-item');
    rerender(<DevicesGrid devices={[]} isLoading={false} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});

describe('DeviceCard status row', () => {
  it('without a statusLine is the tag and "Last Seen:" as before', () => {
    const { container } = render(
      <DeviceCard device={{ name: 'host', lastSeen: SEEN }} statusTag={{ label: 'ONLINE', variant: 'success' }} />,
    );
    expect(screen.getByText('ONLINE')).toBeTruthy();
    expect(screen.getByText('Last Seen:')).toBeTruthy();
    expect(cardStatusRowClasses(container)).toBeNull();
  });
});

describe('the device picker', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());

  it('keeps its STATUS column and one tag per row: no tag or mark beside the name', () => {
    const { container } = render(
      <DeviceSelector
        devices={[device({ status: 'PENDING', clientOutdated: true })]}
        loading={false}
        showSelectionModeRadio={false}
        layout="grid"
      />,
    );
    expect(markup(container)).not.toContain('data-device-name-status');
    expect(screen.getAllByText('PENDING')).toHaveLength(1);
    expect(outdatedIcon()).toBeNull();
  });
});

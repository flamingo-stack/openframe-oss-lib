import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ReactNode, useState } from 'react';
import {
  LogCopyIconButton,
  LogsPageView,
  LogsTableView,
  type LogsTableDateFilter,
  type LogsTableViewProps,
  type UiLogEntry,
} from '../components/features/logs';
import { LOGS_FIXTURE_ENTRIES, LOGS_FIXTURE_FACETS } from '../components/product-demo/fixtures/logs';
import LogsScreen from '../components/product-demo/screens/logs';
import { cn } from '../utils/cn';

const meta: Meta<typeof LogsTableView> = {
  title: 'Features/LogsTableView',
  component: LogsTableView,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The Logs page from the product-demo fixture, with the selected entry's Log Details drawer docked beside the table. */
export const WithDrawerOpen: Story = {
  render: () => (
    <div className="ods-content-area h-[80vh]">
      <LogsScreen />
    </div>
  ),
};

/** The narrow rendering: the table alone, without its action columns. */
export const Compact: Story = {
  render: () => (
    <div className="ods-content-area h-[80vh] max-w-[420px]">
      <LogsScreen compact />
    </div>
  ),
};

const noop = () => {};
const logHref = () => '#';
const gridCopyAction = () => <LogCopyIconButton grid />;

/** The fixture's logs, repeated to a page worth scrolling, the first with an id and a message too long for its cell. */
const GRID_LOGS: UiLogEntry[] = Array.from({ length: 5 }, (_, page) =>
  LOGS_FIXTURE_ENTRIES.map((log, index) => ({
    ...log,
    id: `${log.id}-${page}`,
    ...(page === 0 && index === 0
      ? {
          logId: 'evt-8f3a61c2-4b7d-49e1-9c05-2d6f1a7e3b90',
          description: {
            title:
              'Sign-in from a new country: the account signed in from an address in a country it has never used before, forty minutes after a sign-in from the office network.',
          },
        }
      : {}),
  })),
).flat();

/** The logs table in the grid layout, holding the date filter and the column filters a host would. */
function GridLogs(props: Partial<LogsTableViewProps>) {
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [sortDirection, setSortDirection] = useState<LogsTableDateFilter['sortDirection']>('desc');
  const [range, setRange] = useState<LogsTableDateFilter['range']>(undefined);
  const logs = sortDirection === 'asc' ? [...GRID_LOGS].reverse() : GRID_LOGS;
  return (
    <LogsTableView
      logs={logs}
      facets={LOGS_FIXTURE_FACETS}
      filters={filters}
      onFilterChange={setFilters}
      dateFilter={{
        sortDirection,
        range,
        onApply: result => {
          setSortDirection(result.sort);
          setRange(result.range);
        },
      }}
      getLogHref={logHref}
      renderCopyAction={gridCopyAction}
      onQuickView={noop}
      layout="grid"
      {...props}
    />
  );
}

/** The Logs page around the table: the search toolbar the table's header sticks under. */
function GridPage({ fill = false, children }: { fill?: boolean; children: ReactNode }) {
  return (
    <div className={cn('ods-content-area bg-ods-bg', fill && 'h-screen overflow-y-auto')}>
      <LogsPageView search="" onSearchChange={noop} onOpenFilters={noop} onRefresh={noop}>
        {children}
      </LogsPageView>
    </div>
  );
}

/**
 * The grid layout (`layout="grid"`): one line per log. The Log ID header is the table's date header (the calendar
 * opens the sort and range menu); the time stays whole and the id after it is cut; copy, quick view and open are
 * action columns, pinned right. Log details, the last column, takes the width the others leave. The page scrolls and
 * the header sticks under the search toolbar.
 */
export const Grid: Story = {
  render: () => (
    <GridPage>
      <GridLogs tableSettings={{ storageKey: 'storybook-logs-grid' }} />
    </GridPage>
  ),
};

/** The grid filling the height the page leaves (the Logs page): the table scrolls and the page does not. */
export const GridFillHeight: Story = {
  render: () => (
    <GridPage fill>
      <GridLogs tableMaxHeight="fill" />
    </GridPage>
  ),
};

/** One customer's logs (a customer's Logs tab): no Source filter. */
export const GridOrganizationLocked: Story = {
  render: () => (
    <GridPage>
      <GridLogs organizationLocked />
    </GridPage>
  ),
};

/** Loading rows in the grid. */
export const GridLoading: Story = {
  render: () => (
    <GridPage>
      <GridLogs logs={[]} loading pageSize={8} />
    </GridPage>
  ),
};

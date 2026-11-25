import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { DeviceSelector, type DeviceRow, type DeviceSelectorProps } from '../components/features/devices';

const MINUTE = 60_000;
/** A time `minutes` before the story is opened: the rows read "5m ago", "3d ago" whenever that is. */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString();

const CUSTOMERS = {
  acme: { organizationId: 'org-acme', organization: 'Acme Logistics', organizationEmail: 'it@acme-logistics.example' },
  harbor: { organizationId: 'org-harbor', organization: 'Harbor Dental Group', organizationEmail: undefined },
  northbridge: {
    organizationId: 'org-northbridge',
    organization: 'Northbridge Architecture and Planning Partners',
    organizationEmail: 'office.manager@northbridge-architecture.example',
  },
};

/** A small fleet with what a row has to fit on one line: a long host name, a long customer with a long contact. */
const DEVICES: DeviceRow[] = [
  { id: 'd-01', hostname: 'RECEPTION-01', type: 'desktop', osType: 'WINDOWS', connectivity: 'ONLINE', seen: 1 },
  { id: 'd-02', hostname: 'MAYA-MBA', type: 'laptop', osType: 'MAC_OS', connectivity: 'ONLINE', seen: 4 },
  { id: 'd-03', hostname: 'SAM-T14', type: 'laptop', osType: 'WINDOWS', connectivity: 'OFFLINE', seen: 190 },
  { id: 'd-04', hostname: 'FRONTDESK-LT02', type: 'laptop', osType: 'WINDOWS', connectivity: 'ONLINE', seen: 2 },
  {
    id: 'd-05',
    hostname: 'northbridge-render-workstation-floor-3-east-wing',
    type: 'desktop',
    osType: 'WINDOWS',
    connectivity: 'OFFLINE',
    seen: 60 * 24 * 3,
  },
  { id: 'd-06', hostname: 'build-server-01', type: 'server', osType: 'LINUX', connectivity: 'ONLINE', seen: 1 },
  { id: 'd-07', hostname: 'LEO-MBP', type: 'laptop', osType: 'MAC_OS', connectivity: 'OFFLINE', seen: 60 * 24 * 9 },
  { id: 'd-08', hostname: 'XRAY-STATION', type: 'desktop', osType: 'WINDOWS', connectivity: 'ONLINE', seen: 7 },
  { id: 'd-09', hostname: 'never-seen-laptop', type: 'laptop', osType: 'WINDOWS', connectivity: 'OFFLINE' },
  { id: 'd-10', hostname: 'OPS-IMAC', type: 'desktop', osType: 'MAC_OS', connectivity: 'ONLINE', seen: 12 },
].map(({ seen, ...device }, index) => ({
  ...device,
  machineId: device.id,
  nickname: null,
  status: 'MANAGED',
  last_seen: seen === undefined ? undefined : minutesAgo(seen),
  ...[CUSTOMERS.acme, CUSTOMERS.harbor, CUSTOMERS.northbridge][index % 3],
}));

/** The picker holding its own selection, as a host's form does. */
function Picker(props: Partial<DeviceSelectorProps>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(['d-02']));
  return (
    <DeviceSelector
      devices={DEVICES}
      loading={false}
      showSelectionModeRadio={false}
      selectedIds={selectedIds}
      onSelectionChange={setSelectedIds}
      {...props}
    />
  );
}

const meta: Meta<typeof Picker> = {
  title: 'Features/DeviceSelector',
  component: Picker,
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="ods-content-area bg-ods-bg p-[var(--spacing-system-l)]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The picker as a form shows it today: card rows, the add button outlined, "added" as its fill. */
export const Cards: Story = {};

/**
 * The grid layout (`layout="grid"`): one line per device. The time a device was last online sits beside its status,
 * the customer's contact after the customer's name, and add / remove is an action column pinned right: a plus, the
 * accent check for a device that is in, the trash on the Selected tab. "Add All Devices" moves above the table.
 */
export const Grid: Story = { args: { layout: 'grid', tableSettings: { storageKey: 'storybook-device-selector' } } };

/** A device that cannot be added: the control is disabled and the reason is its tooltip (hover or focus the plus). */
export const GridDisabledDevice: Story = {
  args: {
    layout: 'grid',
    isDeviceDisabled: device => (device.osType === 'LINUX' ? 'This script does not run on Linux devices' : undefined),
  },
};

/** One device at a time: no tabs, no bulk action, the device count above the table. */
export const GridSingleSelect: Story = { args: { layout: 'grid', singleSelect: true } };

/** A fixed list with nothing to search, in a table that scrolls inside itself (a modal's picker). */
export const GridFixedHeight: Story = { args: { layout: 'grid', showToolbar: false, tableMaxHeight: 320 } };

/** Loading rows in the grid: the action column is already there, so nothing moves when the devices arrive. */
export const GridLoading: Story = { args: { layout: 'grid', devices: [], loading: true, skeletonRows: 5 } };

/** Nothing matches: the empty state inside the table's frame. */
export const GridEmpty: Story = { args: { layout: 'grid', devices: [] } };

/**
 * A desktop window with a narrow content column, as with the Mingo panel docked beside the page (open the story in a
 * window at least 1280px wide). The Device column stays pinned left beside the pinned add column while the table
 * scrolls sideways, at most 40% of the table's width, the long name cut with an ellipsis. On a tablet or a phone it
 * scrolls with the rest, like the first column of every other grid table.
 */
export const GridNarrowContent: Story = {
  args: { layout: 'grid' },
  decorators: [
    Story => (
      <div className="ods-content-area w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

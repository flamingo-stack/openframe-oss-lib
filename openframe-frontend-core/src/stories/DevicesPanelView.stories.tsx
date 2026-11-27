import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  buildDevicePanelActions,
  type DeviceRow,
  DevicesPanelView,
  DevicesViewConfigProvider,
  type DevicesViewMode,
} from '../components/features/devices';
import { resolveProductDemoCast } from '../components/product-demo/cast';
import { buildDevicesFixture } from '../components/product-demo/fixtures/devices';

const DEVICES_FIXTURE = buildDevicesFixture(resolveProductDemoCast());

const meta: Meta<typeof DevicesPanelView<DeviceRow>> = {
  title: 'Features/DevicesPanelView',
  component: DevicesPanelView,
  parameters: { layout: 'fullscreen' },
  args: {
    viewMode: 'table',
    devices: DEVICES_FIXTURE.devices,
    deviceFilters: DEVICES_FIXTURE.deviceFilters,
    totalCount: DEVICES_FIXTURE.totalCount,
    actions: buildDevicePanelActions({ archiveHref: '#', onAddDevice: () => {} }),
    className: 'px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]',
  },
  decorators: [
    Story => (
      <div className="ods-content-area bg-ods-bg">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The Devices page: header, search and tags toolbar, and the table. */
export const Default: Story = {
  render: function Render(args) {
    const [viewMode, setViewMode] = useState<DevicesViewMode>(args.viewMode);
    return <DevicesPanelView {...args} viewMode={viewMode} onViewModeChange={setViewMode} />;
  },
};

/** The narrow rendering: no header buttons, no customer column. */
export const Compact: Story = { args: { actions: undefined, hideColumns: ['organization'] } };

/** The same rows as cards. */
export const Grid: Story = { args: { viewMode: 'grid' } };

/**
 * A host that lists a device's notifications: the unread counts become buttons that open them. Without one (the
 * stories above, the product page) they are counts only.
 */
export const WithNotificationsLink: Story = {
  decorators: [
    Story => (
      <DevicesViewConfigProvider value={{ getDeviceNotificationsHref: device => `#notifications-${device.machineId}` }}>
        <Story />
      </DevicesViewConfigProvider>
    ),
  ],
  render: function Render(args) {
    const [viewMode, setViewMode] = useState<DevicesViewMode>(args.viewMode);
    return <DevicesPanelView {...args} viewMode={viewMode} onViewModeChange={setViewMode} />;
  },
};

/** The request has not answered: the real chrome, locked, over skeleton rows. */
export const Loading: Story = { args: { loading: true, devices: [] } };

/** A host that brings its own header, such as a page hero. */
export const WithHeaderSlot: Story = {
  args: {
    headerSlot: <h2 className="pb-[var(--spacing-system-l)] text-ods-text-primary text-h2">Every device, one list</h2>,
  },
};

/**
 * The table in the grid layout: 48px one-line rows in one bordered block at every width, the action columns pinned
 * right, the device column pinned left on a desktop with at least 720px of content.
 */
export const TableGridLayout: Story = {
  args: { tableLayout: 'grid', tableMaxHeight: 'fill', tableSettings: { storageKey: 'storybook-devices' } },
  render: function Render(args) {
    const [viewMode, setViewMode] = useState<DevicesViewMode>(args.viewMode);
    return <DevicesPanelView {...args} viewMode={viewMode} onViewModeChange={setViewMode} />;
  },
};

/** The grid layout with the directory columns: more columns than fit, so the table scrolls sideways. */
export const TableGridLayoutWithDirectory: Story = { args: { tableLayout: 'grid', directoryColumns: true } };

/** The grid layout while the request has not answered. */
export const TableGridLayoutLoading: Story = { args: { tableLayout: 'grid', loading: true, devices: [] } };

/**
 * The lifecycle display's statuses (Figma 5108:198472): a managed and a pending device on an outdated agent (the
 * warning mark after the name), a pending deletion one on an outdated agent (no mark: nothing to reinstall there) and
 * a pending one never seen ("—" in LAST SEEN). The mark and the PENDING tag explain themselves on hover, focus or tap.
 */
const LIFECYCLE_DEVICES: DeviceRow[] = DEVICES_FIXTURE.devices.map((device, index) => {
  if (index === 0) return { ...device, clientOutdated: true };
  if (index === 1) return { ...device, status: 'PENDING', clientOutdated: true };
  if (index === 2) return { ...device, status: 'PENDING_DELETION', clientOutdated: true };
  if (index === 3) return { ...device, status: 'PENDING', last_seen: undefined, lastSeen: undefined };
  return device;
});

/** The lifecycle statuses in the grid layout: tag after the name unless managed, then the outdated mark. */
export const LifecycleStatuses: Story = {
  args: { tableLayout: 'grid', devices: LIFECYCLE_DEVICES },
};

/** The lifecycle statuses on the grid view's cards: "Managed · Last seen", or the tag, then the outdated mark. */
export const LifecycleStatusesCards: Story = { args: { viewMode: 'grid', devices: LIFECYCLE_DEVICES } };

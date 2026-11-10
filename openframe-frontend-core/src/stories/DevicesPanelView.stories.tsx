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
 * The table in the grid layout: 48px one-line rows in one bordered block, the device column pinned left and the
 * action columns pinned right, from `md` up (card rows below it).
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

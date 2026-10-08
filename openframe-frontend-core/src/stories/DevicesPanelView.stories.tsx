import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  buildDevicePanelActions,
  type DeviceRow,
  DevicesPanelView,
  type DevicesViewMode,
} from '../components/features/devices';
import { DEVICES_FIXTURE } from '../components/product-demo/fixtures/devices';

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

/** The request has not answered: the real chrome, locked, over skeleton rows. */
export const Loading: Story = { args: { loading: true, devices: [] } };

/** A host that brings its own header, such as a page hero. */
export const WithHeaderSlot: Story = {
  args: {
    headerSlot: <h2 className="pb-[var(--spacing-system-l)] text-ods-text-primary text-h2">Every device, one list</h2>,
  },
};

'use client';

import {
  buildDevicePanelActions,
  type DeviceRow,
  DevicesPanelView,
  getDeviceActionsColumn,
} from '../../features/devices';
import { ActionsMenuDropdown, type ActionsMenuGroup } from '../../ui/actions-menu';
import { DEVICES_FIXTURE } from '../fixtures/devices';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

/** The row menu of the product's device list. It stays closed in a picture, so the items carry no icons. */
const ROW_MENU: ActionsMenuGroup[] = [
  {
    separator: true,
    items: [
      { id: 'remote-shell', label: 'Remote Shell', onClick: noop },
      { id: 'remote-control', label: 'Remote Control', onClick: noop },
      { id: 'manage-files', label: 'Manage Files', onClick: noop },
      { id: 'run-script', label: 'Run Script', onClick: noop },
      { id: 'reboot', label: 'Reboot Device', onClick: noop },
    ],
  },
  { items: [{ id: 'delete', label: 'Delete Device', onClick: noop }] },
];

const ACTIONS_COLUMN = getDeviceActionsColumn<DeviceRow>(() => <ActionsMenuDropdown groups={ROW_MENU} />);

/** The page's header buttons, as the Devices page builds them. */
const PAGE_ACTIONS = buildDevicePanelActions({ archiveHref: '#', onAddDevice: noop });

const HIDDEN_WHEN_COMPACT = ['organization'];

/**
 * The product's Devices page in its table view. The narrow rendering drops the
 * header buttons and the customer column and keeps device, status and OS.
 */
export default function DevicesScreen({ compact = false }: ProductScreenViewProps) {
  return (
    <div className="h-full bg-ods-bg">
      <DevicesPanelView
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
        viewMode="table"
        actions={compact ? undefined : PAGE_ACTIONS}
        devices={DEVICES_FIXTURE.devices}
        deviceFilters={DEVICES_FIXTURE.deviceFilters}
        totalCount={DEVICES_FIXTURE.totalCount}
        actionsColumn={ACTIONS_COLUMN}
        hideColumns={compact ? HIDDEN_WHEN_COMPACT : undefined}
      />
    </div>
  );
}
